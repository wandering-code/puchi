"""Audiolibros, parte de administración (fase 1, issue #63).

El admin sube un EPUB, revisa los capítulos que salen de él (renombrar, unir,
dejar fuera los que no son texto) y enlaza el audiolibro con los libros del
catálogo que se van a escuchar con él. Aquí todavía no se genera audio: eso es
la fase 2 (#64), con el sobremesa pidiendo trabajo a Puchi (#59).

Todo es solo del admin (`require_admin`). La parte de escuchar, que sí es de
todos, irá en endpoints aparte.

Fase 2 (#64): la cola de generación. Puchi solo guarda qué capítulos faltan; el
sobremesa, cuando está encendido, pide trabajo a `/audiobook-worker/…`, genera
el capítulo con Higgs y sube el audio (decisión #59). Si se apaga a medias, el
capítulo vuelve a la cola cuando vence su reserva.
"""
import difflib
import hashlib
import hmac
import json
import os
import re
import shutil
from datetime import datetime, timedelta, timezone
import unicodedata
import uuid
from io import BytesIO
from typing import Optional

import ebooklib
from ebooklib import epub
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse
from PIL import Image
from pydantic import BaseModel
from sqlalchemy import func, or_, text as sql
from sqlalchemy.orm import Session

from auth import require_admin
from database import Audiobook, AudiobookBook, AudiobookChapter, Book, PersonalShelf, Player, get_db
from epub_capitulos import extraer_capitulos_epub

router = APIRouter(prefix="/audiobooks", tags=["audiolibros"])
# El sobremesa, en su propia ruta: con /audiobooks/worker/… chocaría con las
# rutas de cada audiolibro (/audiobooks/{id}/…).
worker_router = APIRouter(prefix="/audiobook-worker", tags=["audiolibros"])

_AQUI = os.path.dirname(__file__)
# Fuera de uploads/ a propósito: uploads/ lo sirve StaticFiles a cualquiera.
DIR_EPUB = os.path.join(_AQUI, "datos", "audiolibros")
DIR_PORTADAS = os.path.join(_AQUI, "uploads", "audiobook_covers")
DIR_AUDIO = os.path.join(DIR_EPUB, "audio")
os.makedirs(DIR_EPUB, exist_ok=True)
os.makedirs(DIR_PORTADAS, exist_ok=True)
os.makedirs(DIR_AUDIO, exist_ok=True)
# La clave del sobremesa: en un archivo fuera del repo (datos/ no se versiona),
# o en el entorno. Sin ninguna de las dos, el sobremesa no puede entrar.
FICHERO_CLAVE = os.path.join(DIR_EPUB, "..", "worker_token.txt")
# Lo que se le guarda un capítulo al sobremesa sin saber de él. Cada aviso de
# progreso la renueva; un capítulo largo avisa cada pocos trozos.
RESERVA = timedelta(minutes=15)
INTENTOS = 3

MAX_EPUB = 60 * 1024 * 1024
# Velocidad de lectura de Higgs con la receta de Kokito, pausas incluidas:
# medida con "5. Instrucciones sangrientas" (3.130 palabras en 23,9 min).
PALABRAS_POR_MINUTO = 131
VOCES = ("voz_femenina_suave", "voz_masculina_media")

# Lo que casi nunca es parte de la historia. Salen desmarcados para que el
# admin los vea y decida, no se borran.
_NO_ES_TEXTO = re.compile(
    r"^(cubierta|portada|titulo|pagina de titulo|creditos|indice|contenido|tabla de contenidos?|"
    r"sinopsis|dedicatoria|epigrafe|cita|sobre el autor|acerca del autor|el autor|biografia|"
    r"otros titulos|del mismo autor|copyright|derechos|notas?|nota del editor|colofon|"
    r"agradecimientos|mapas?|glosario|dramatis personae|personajes)\b"
)
MIN_PALABRAS = 40


# ─── Migración ───────────────────────────────────────────────────────────────

_COLUMNAS_FASE_2 = {
    "status": "VARCHAR NOT NULL DEFAULT 'pendiente'",
    "priority": "BOOLEAN NOT NULL DEFAULT false",
    "queued_at": "TIMESTAMP", "queue_index": "INTEGER",
    "worker": "VARCHAR", "started_at": "TIMESTAMP", "lease_until": "TIMESTAMP",
    "progress": "FLOAT NOT NULL DEFAULT 0", "progress_note": "VARCHAR",
    "error": "TEXT", "attempts": "INTEGER NOT NULL DEFAULT 0",
    "audio_path": "VARCHAR", "duration_s": "FLOAT", "audio_size": "INTEGER",
    "generated_at": "TIMESTAMP", "voice_used": "VARCHAR", "recipe": "JSON",
}


def migrar(engine) -> None:
    """Columnas que llegaron después de crear la tabla. Idempotente, como
    _migrate() de main.py, y solo sobre tablas de audiolibros."""
    with engine.begin() as con:
        for col, tipo in _COLUMNAS_FASE_2.items():
            con.execute(sql(f"ALTER TABLE audiobook_chapters ADD COLUMN IF NOT EXISTS {col} {tipo}"))


def _ahora() -> datetime:
    # Naive en UTC, como el resto de DateTime de la base de datos.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _iso(d: Optional[datetime]) -> Optional[str]:
    return d.replace(tzinfo=timezone.utc).isoformat() if d else None


# ─── Utilidades ──────────────────────────────────────────────────────────────

def _normal(s: Optional[str]) -> str:
    """Sin tildes, en minúsculas y solo letras y números."""
    if not s:
        return ""
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def _titulo_base(s: Optional[str]) -> str:
    """El título sin lo que cambia de una edición a otra: lo que va entre
    paréntesis o corchetes, el subtítulo tras ':' y la parte de un título
    bilingüe tras '/'."""
    if not s:
        return ""
    s = re.split(r"\s*/\s*", s)[0]
    s = re.sub(r"[\(\[][^\)\]]*[\)\]]", " ", s)
    s = s.split(":")[0]
    return _normal(s)


def _isbn(s: Optional[str]) -> Optional[str]:
    if not s:
        return None
    d = re.sub(r"[^0-9Xx]", "", s)
    return d.upper() if len(d) in (10, 13) else None


def _minutos(palabras: int) -> int:
    return round(palabras / PALABRAS_POR_MINUTO)


def _parece_no_texto(titulo: str, palabras: int) -> bool:
    return palabras < MIN_PALABRAS or bool(_NO_ES_TEXTO.match(_normal(titulo)))


# ─── Lectura del EPUB ────────────────────────────────────────────────────────

def _metadatos(datos: bytes) -> dict:
    """Título, autor, ISBN y portada que declara el propio EPUB."""
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".epub", delete=False) as tmp:
        tmp.write(datos)
        ruta = tmp.name
    try:
        libro = epub.read_epub(ruta)
    finally:
        os.unlink(ruta)

    def uno(campo):
        v = libro.get_metadata("DC", campo)
        return v[0][0].strip() if v and v[0] and v[0][0] else None

    isbn = None
    for valor, _attrs in libro.get_metadata("DC", "identifier") or []:
        isbn = _isbn(valor)
        if isbn:
            break

    portada = None
    candidatos = list(libro.get_items_of_type(ebooklib.ITEM_COVER))
    for valor, attrs in libro.get_metadata("OPF", "cover") or []:
        item = libro.get_item_with_id((attrs or {}).get("content", ""))
        if item:
            candidatos.insert(0, item)
    candidatos += [i for i in libro.get_items_of_type(ebooklib.ITEM_IMAGE) if "cover" in i.get_name().lower()]
    for item in candidatos:
        try:
            Image.open(BytesIO(item.get_content())).verify()
            portada = item.get_content()
            break
        except Exception:
            continue

    return {"title": uno("title"), "author": uno("creator"), "isbn": isbn, "cover": portada}


def _guardar_portada(datos: Optional[bytes]) -> Optional[str]:
    if not datos:
        return None
    try:
        img = Image.open(BytesIO(datos)).convert("RGB")
        img.thumbnail((600, 900))
        nombre = f"{uuid.uuid4().hex}.jpg"
        img.save(os.path.join(DIR_PORTADAS, nombre), "JPEG", quality=85, optimize=True)
        return f"/uploads/audiobook_covers/{nombre}"
    except Exception:
        return None


def _borrar_portada(url: Optional[str]) -> None:
    if url and url.startswith("/uploads/audiobook_covers/"):
        ruta = os.path.join(DIR_PORTADAS, os.path.basename(url))
        if os.path.exists(ruta):
            os.remove(ruta)


def _crear_capitulos(db: Session, ab: Audiobook, datos: bytes) -> None:
    capitulos = extraer_capitulos_epub(datos)
    if not capitulos:
        raise HTTPException(status_code=422, detail="No se ha encontrado texto en el EPUB")
    for i, c in enumerate(capitulos):
        titulo = (c.get("titulo") or "").strip() or f"Capítulo {i + 1}"
        db.add(AudiobookChapter(
            audiobook_id=ab.id, position=i, title=titulo, text=c["texto"],
            words=c["palabras"], included=not _parece_no_texto(titulo, c["palabras"]),
        ))


# ─── Respuestas ──────────────────────────────────────────────────────────────

def _enlaces(db: Session, ids: list[int]) -> dict[int, list[dict]]:
    """Libros enlazados de cada audiolibro, con quién los tiene."""
    if not ids:
        return {}
    filas = (db.query(AudiobookBook.audiobook_id, Book)
             .join(Book, Book.id == AudiobookBook.book_id)
             .filter(AudiobookBook.audiobook_id.in_(ids))
             .order_by(Book.title).all())
    duenos = _duenos(db, [b.id for _, b in filas])
    out: dict[int, list[dict]] = {}
    for ab_id, b in filas:
        out.setdefault(ab_id, []).append(_libro_out(b, duenos.get(b.id, [])))
    return out


def _duenos(db: Session, ids: list[int]) -> dict[int, list[dict]]:
    """Quién tiene cada libro en su estantería (solo cuentas aprobadas) y en
    qué estado: es a quien le sirve el audiolibro y, más adelante, a quien
    se avisará cuando esté listo (#68)."""
    if not ids:
        return {}
    out: dict[int, list[dict]] = {}
    filas = (db.query(PersonalShelf.book_id, PersonalShelf.status, Player)
             .join(Player, Player.id == PersonalShelf.player_id)
             .filter(PersonalShelf.book_id.in_(ids), Player.status == "approved")
             .order_by(Player.name).all())
    for book_id, estado, p in filas:
        out.setdefault(book_id, []).append({
            "id": p.id, "name": p.name, "color": p.color, "avatar_url": p.avatar_url,
            "avatar_emoji": p.avatar_emoji, "shelf_status": estado,
        })
    return out


def _libro_out(b: Book, duenos: list[dict]) -> dict:
    return {"id": b.id, "title": b.title, "author": b.author, "cover_url": b.cover_url,
            "year": b.year, "shelves": len(duenos), "owners": duenos}


def _estado(incluidos: list) -> str:
    """El estado del audiolibro sale de sus capítulos, no se guarda aparte:
    así no puede desincronizarse."""
    estados = [c.status for c in incluidos]
    if "generando" in estados:
        return "generando"
    if "en_cola" in estados:
        return "en_cola"
    if incluidos and all(e == "listo" for e in estados):
        return "listo"
    if "error" in estados:
        return "error"
    return "pausado" if "listo" in estados else "borrador"


def _resumen(ab: Audiobook, caps: list[AudiobookChapter], enlaces: list[dict]) -> dict:
    incluidos = [c for c in caps if c.included]
    palabras = sum(c.words for c in incluidos)
    listos = [c for c in incluidos if c.status == "listo"]
    return {
        "id": ab.id, "title": ab.title, "author": ab.author, "isbn": ab.isbn,
        "cover_url": ab.cover_url or next((l["cover_url"] for l in enlaces if l["cover_url"]), None),
        "voice": ab.voice, "status": _estado(incluidos),
        "created_at": ab.created_at.isoformat() if ab.created_at else None,
        "chapters_total": len(caps), "chapters_included": len(incluidos),
        "chapters_ready": len(listos),
        "chapters_pending": sum(1 for c in incluidos if c.status in ("en_cola", "generando")),
        "audio_minutes": round(sum(c.duration_s or 0 for c in listos) / 60),
        "words": palabras, "minutes": _minutos(palabras),
        "books": enlaces,
    }


def _detalle(db: Session, ab: Audiobook) -> dict:
    caps = (db.query(AudiobookChapter).filter(AudiobookChapter.audiobook_id == ab.id)
            .order_by(AudiobookChapter.position).all())
    out = _resumen(ab, caps, _enlaces(db, [ab.id]).get(ab.id, []))
    out["voices"] = list(VOCES)
    # Quién podrá escucharlo: todos los que tienen alguno de los libros
    # enlazados, una vez cada uno aunque tenga dos ediciones.
    oyentes: dict[int, dict] = {}
    for libro in out["books"]:
        for d in libro["owners"]:
            oyentes.setdefault(d["id"], {**d, "book_title": libro["title"]})
    out["listeners"] = sorted(oyentes.values(), key=lambda d: d["name"].lower())
    out["chapters"] = [{
        "id": c.id, "position": c.position, "title": c.title, "words": c.words,
        "minutes": _minutos(c.words), "included": c.included,
        # Para reconocer el capítulo sin abrirlo: cubiertas y créditos se
        # delatan en la primera línea.
        "preview": re.sub(r"\s+", " ", c.text[:220]).strip(),
        "looks_like_extra": _parece_no_texto(c.title, c.words),
        "status": c.status, "progress": c.progress, "progress_note": c.progress_note,
        "started_at": _iso(c.started_at), "error": c.error, "priority": c.priority,
        "duration_s": c.duration_s, "generated_at": _iso(c.generated_at), "voice_used": c.voice_used,
        "has_audio": bool(c.audio_path),
    } for c in caps]
    return out


def _borrar_archivo(ruta: Optional[str]) -> None:
    if ruta and os.path.exists(ruta):
        os.remove(ruta)


def _olvidar_audio(c: AudiobookChapter) -> None:
    """El texto del capítulo ha cambiado: su audio ya no le corresponde."""
    _borrar_archivo(c.audio_path)
    c.audio_path = c.duration_s = c.audio_size = c.generated_at = c.voice_used = c.recipe = None
    c.status, c.progress, c.progress_note, c.error, c.worker, c.lease_until = "pendiente", 0.0, None, None, None, None


def _dir_audio(ab_id: int) -> str:
    return os.path.join(DIR_AUDIO, str(ab_id))


def _cargar(db: Session, ab_id: int) -> Audiobook:
    ab = db.query(Audiobook).filter(Audiobook.id == ab_id).first()
    if not ab:
        raise HTTPException(status_code=404, detail="Ese audiolibro no existe")
    return ab


def _capitulo(db: Session, ab_id: int, cap_id: int) -> AudiobookChapter:
    c = (db.query(AudiobookChapter)
         .filter(AudiobookChapter.id == cap_id, AudiobookChapter.audiobook_id == ab_id).first())
    if not c:
        raise HTTPException(status_code=404, detail="Ese capítulo no existe")
    return c


# ─── Endpoints ───────────────────────────────────────────────────────────────
# Síncronos a propósito: leer un EPUB es trabajo de CPU de uno o dos segundos,
# y FastAPI los ejecuta en un hilo aparte sin parar el resto del servidor.

@router.get("")
def listar(db: Session = Depends(get_db), _: Player = Depends(require_admin)):
    abs_ = db.query(Audiobook).order_by(Audiobook.created_at.desc()).all()
    ids = [a.id for a in abs_]
    caps: dict[int, list] = {}
    if ids:
        for c in (db.query(AudiobookChapter.audiobook_id, AudiobookChapter.words, AudiobookChapter.included,
                           AudiobookChapter.status, AudiobookChapter.duration_s)
                  .filter(AudiobookChapter.audiobook_id.in_(ids)).all()):
            caps.setdefault(c.audiobook_id, []).append(c)
    enlaces = _enlaces(db, ids)
    return [_resumen(a, caps.get(a.id, []), enlaces.get(a.id, [])) for a in abs_]


@router.post("")
def subir(epub_file: UploadFile = File(...), db: Session = Depends(get_db),
          admin: Player = Depends(require_admin)):
    datos = epub_file.file.read(MAX_EPUB + 1)
    if len(datos) > MAX_EPUB:
        raise HTTPException(status_code=413, detail="El EPUB pasa de 60 MB")
    if not datos.startswith(b"PK"):
        raise HTTPException(status_code=422, detail="Eso no parece un EPUB")

    huella = hashlib.sha256(datos).hexdigest()
    ya = db.query(Audiobook).filter(Audiobook.epub_hash == huella).first()
    if ya:
        raise HTTPException(status_code=409, detail=f"Este EPUB ya está subido como «{ya.title}»")

    try:
        meta = _metadatos(datos)
    except Exception:
        raise HTTPException(status_code=422, detail="No se ha podido leer el EPUB")

    nombre_archivo = os.path.splitext(epub_file.filename or "")[0].strip()
    ruta = os.path.join(DIR_EPUB, f"{huella[:16]}.epub")
    with open(ruta, "wb") as f:
        f.write(datos)

    ab = Audiobook(
        title=meta["title"] or nombre_archivo or "Sin título", author=meta["author"], isbn=meta["isbn"],
        cover_url=_guardar_portada(meta["cover"]), epub_path=ruta, epub_hash=huella,
        epub_size=len(datos), created_by=admin.id,
    )
    db.add(ab)
    db.flush()
    try:
        _crear_capitulos(db, ab, datos)
    except HTTPException:
        db.rollback()
        os.remove(ruta)
        _borrar_portada(ab.cover_url)
        raise
    except Exception:
        db.rollback()
        os.remove(ruta)
        _borrar_portada(ab.cover_url)
        raise HTTPException(status_code=422, detail="No se han podido sacar los capítulos del EPUB")
    db.commit()
    db.refresh(ab)
    return _detalle(db, ab)


@router.get("/{ab_id}")
def ver(ab_id: int, db: Session = Depends(get_db), _: Player = Depends(require_admin)):
    return _detalle(db, _cargar(db, ab_id))


class CambiosAudiolibro(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    voice: Optional[str] = None


@router.patch("/{ab_id}")
def editar(ab_id: int, cambios: CambiosAudiolibro, db: Session = Depends(get_db),
           _: Player = Depends(require_admin)):
    ab = _cargar(db, ab_id)
    if cambios.title is not None:
        if not cambios.title.strip():
            raise HTTPException(status_code=422, detail="El título no puede quedar vacío")
        ab.title = cambios.title.strip()
    if cambios.author is not None:
        ab.author = cambios.author.strip() or None
    if cambios.voice is not None:
        if cambios.voice not in VOCES:
            raise HTTPException(status_code=422, detail="Esa voz no existe")
        ab.voice = cambios.voice
    db.commit()
    return _detalle(db, ab)


@router.delete("/{ab_id}", status_code=204)
def borrar(ab_id: int, db: Session = Depends(get_db), _: Player = Depends(require_admin)):
    ab = _cargar(db, ab_id)
    ruta, portada = ab.epub_path, ab.cover_url
    db.query(AudiobookChapter).filter(AudiobookChapter.audiobook_id == ab.id).delete()
    db.query(AudiobookBook).filter(AudiobookBook.audiobook_id == ab.id).delete()
    db.delete(ab)
    db.commit()
    _borrar_archivo(ruta)
    _borrar_portada(portada)
    shutil.rmtree(_dir_audio(ab_id), ignore_errors=True)


@router.post("/{ab_id}/reread")
def releer(ab_id: int, db: Session = Depends(get_db), _: Player = Depends(require_admin)):
    """Vuelve a sacar los capítulos del EPUB y deshace todo lo editado en
    ellos, también el audio ya generado. Los enlaces con libros no se tocan."""
    ab = _cargar(db, ab_id)
    if not os.path.exists(ab.epub_path):
        raise HTTPException(status_code=410, detail="El EPUB ya no está en el servidor")
    with open(ab.epub_path, "rb") as f:
        datos = f.read()
    db.query(AudiobookChapter).filter(AudiobookChapter.audiobook_id == ab.id).delete()
    _crear_capitulos(db, ab, datos)
    db.commit()
    shutil.rmtree(_dir_audio(ab.id), ignore_errors=True)
    return _detalle(db, ab)


# ─── Capítulos ───────────────────────────────────────────────────────────────

@router.get("/{ab_id}/chapters/{cap_id}/text")
def texto_capitulo(ab_id: int, cap_id: int, db: Session = Depends(get_db),
                   _: Player = Depends(require_admin)):
    c = _capitulo(db, ab_id, cap_id)
    return {"id": c.id, "title": c.title, "text": c.text, "words": c.words}


class CambiosCapitulo(BaseModel):
    title: Optional[str] = None
    included: Optional[bool] = None


@router.patch("/{ab_id}/chapters/{cap_id}")
def editar_capitulo(ab_id: int, cap_id: int, cambios: CambiosCapitulo, db: Session = Depends(get_db),
                    _: Player = Depends(require_admin)):
    c = _capitulo(db, ab_id, cap_id)
    if cambios.title is not None:
        if not cambios.title.strip():
            raise HTTPException(status_code=422, detail="El capítulo necesita un título")
        c.title = cambios.title.strip()
    if cambios.included is not None:
        c.included = cambios.included
        # Apartado: sale de la cola. Si se estaba generando, el sobremesa se
        # entera en su siguiente aviso de progreso y lo deja.
        if not c.included and c.status in ("en_cola", "generando"):
            c.status, c.worker, c.lease_until, c.progress = "pendiente", None, None, 0.0
    db.commit()
    return _detalle(db, _cargar(db, ab_id))


@router.post("/{ab_id}/chapters/{cap_id}/merge")
def unir_con_siguiente(ab_id: int, cap_id: int, db: Session = Depends(get_db),
                       _: Player = Depends(require_admin)):
    """Une el capítulo con el que viene detrás: el texto seguido, el título del
    primero. Para los EPUB que parten un capítulo en dos documentos."""
    c = _capitulo(db, ab_id, cap_id)
    sig = (db.query(AudiobookChapter)
           .filter(AudiobookChapter.audiobook_id == ab_id, AudiobookChapter.position > c.position)
           .order_by(AudiobookChapter.position).first())
    if not sig:
        raise HTTPException(status_code=422, detail="Es el último capítulo: no hay ninguno detrás")
    en_cola = c.status in ("en_cola", "generando") or sig.status in ("en_cola", "generando")
    c.text = f"{c.text}\n\n{sig.text}".strip()
    c.words = c.words + sig.words
    c.included = c.included or sig.included
    # Con el texto cambiado, ningún audio de los dos vale ya.
    _olvidar_audio(c)
    _borrar_archivo(sig.audio_path)
    if en_cola:
        c.status, c.queued_at = "en_cola", c.queued_at or _ahora()
    db.delete(sig)
    db.flush()
    for i, cap in enumerate(db.query(AudiobookChapter).filter(AudiobookChapter.audiobook_id == ab_id)
                            .order_by(AudiobookChapter.position).all()):
        cap.position = i
    db.commit()
    return _detalle(db, _cargar(db, ab_id))


# ─── Enlaces con libros del catálogo ─────────────────────────────────────────

def _enlazados(db: Session) -> dict[int, tuple[int, str]]:
    """book_id → (audiolibro, título) de todo lo ya enlazado."""
    return {b: (a, t) for b, a, t in
            db.query(AudiobookBook.book_id, Audiobook.id, Audiobook.title)
            .join(Audiobook, Audiobook.id == AudiobookBook.audiobook_id).all()}


def _con_enlace(db: Session, libros: list[tuple[Book, float]], ab_id: int) -> list[dict]:
    duenos = _duenos(db, [b.id for b, _ in libros])
    enlazados = _enlazados(db)
    out = []
    for b, puntos in libros:
        d = _libro_out(b, duenos.get(b.id, []))
        d["score"] = round(puntos, 2)
        otro = enlazados.get(b.id)
        d["linked_to"] = {"id": otro[0], "title": otro[1]} if otro and otro[0] != ab_id else None
        out.append(d)
    return out


@router.get("/{ab_id}/suggestions")
def sugerencias(ab_id: int, db: Session = Depends(get_db), _: Player = Depends(require_admin)):
    """Libros del catálogo que probablemente son este audiolibro. Solo se
    proponen: enlazar lo decide el admin."""
    ab = _cargar(db, ab_id)
    ya = {b for (b,) in db.query(AudiobookBook.book_id).filter(AudiobookBook.audiobook_id == ab.id).all()}
    base = _titulo_base(ab.title)
    autor = set(_normal(ab.author).split())
    isbn = _isbn(ab.isbn)
    candidatos = []
    for b in db.query(Book).all():
        if b.id in ya:
            continue
        if isbn and _isbn(b.isbn) == isbn:
            candidatos.append((b, 1.0))
            continue
        titulo = 0.0
        for t in (b.title, b.original_title):
            tb = _titulo_base(t)
            if not tb or not base:
                continue
            p = 0.95 if (tb == base or tb in base or base in tb) and min(len(tb), len(base)) >= 4 \
                else difflib.SequenceMatcher(None, tb, base).ratio()
            titulo = max(titulo, p)
        if titulo < 0.6:
            continue
        mismo_autor = bool(autor & set(_normal(b.author).split())) if autor and b.author else None
        if mismo_autor is False and titulo < 0.9:
            continue
        puntos = titulo * 0.8 + (0.2 if mismo_autor else 0.1 if mismo_autor is None else 0)
        candidatos.append((b, puntos))
    candidatos.sort(key=lambda x: -x[1])
    return _con_enlace(db, candidatos[:8], ab.id)


@router.get("/{ab_id}/catalog")
def buscar_en_catalogo(ab_id: int, q: str, db: Session = Depends(get_db),
                       _: Player = Depends(require_admin)):
    """Búsqueda en los libros que ya tiene alguien, sin salir a Open Library:
    solo se puede enlazar lo que está en el catálogo."""
    # Sin tildes ni mayúsculas: "aleacion" tiene que encontrar "Aleación de
    # ley". El catálogo es de unos cientos de libros, así que se compara aquí
    # en vez de pedirle a Postgres la extensión unaccent.
    palabras = [p for p in _normal(q).split() if len(p) >= 2]
    if not palabras:
        return []
    libros = []
    for b in db.query(Book).order_by(Book.title).all():
        donde = f"{_normal(b.title)} {_normal(b.original_title)} {_normal(b.author)}"
        if all(p in donde for p in palabras):
            libros.append(b)
            if len(libros) == 25:
                break
    return _con_enlace(db, [(b, 0.0) for b in libros], ab_id)


class Enlace(BaseModel):
    book_id: int
    # Si el libro ya va con otro audiolibro: false da error, true lo cambia.
    move: bool = False


@router.post("/{ab_id}/books")
def enlazar(ab_id: int, cuerpo: Enlace, db: Session = Depends(get_db),
            admin: Player = Depends(require_admin)):
    ab = _cargar(db, ab_id)
    if not db.query(Book.id).filter(Book.id == cuerpo.book_id).first():
        raise HTTPException(status_code=404, detail="Ese libro no existe")
    actual = db.query(AudiobookBook).filter(AudiobookBook.book_id == cuerpo.book_id).first()
    if actual and actual.audiobook_id != ab.id:
        if not cuerpo.move:
            otro = db.query(Audiobook.title).filter(Audiobook.id == actual.audiobook_id).scalar()
            raise HTTPException(status_code=409, detail=f"Ese libro ya va con «{otro}»")
        db.delete(actual)
        db.flush()
        actual = None
    if not actual:
        db.add(AudiobookBook(audiobook_id=ab.id, book_id=cuerpo.book_id, linked_by=admin.id))
    db.commit()
    return _detalle(db, ab)


@router.delete("/{ab_id}/books/{book_id}")
def desenlazar(ab_id: int, book_id: int, db: Session = Depends(get_db),
               _: Player = Depends(require_admin)):
    ab = _cargar(db, ab_id)
    db.query(AudiobookBook).filter(AudiobookBook.audiobook_id == ab.id,
                                   AudiobookBook.book_id == book_id).delete()
    db.commit()
    return _detalle(db, ab)


# ─── Generación: lo que pide el admin ────────────────────────────────────────

class Generar(BaseModel):
    # Por dónde empezar. Sin él, por el primero que falte.
    start_chapter_id: Optional[int] = None


@router.post("/{ab_id}/generate")
def generar(ab_id: int, cuerpo: Generar, db: Session = Depends(get_db), _: Player = Depends(require_admin)):
    """Pone en cola todo lo que falta, empezando por el capítulo elegido y
    siguiendo hasta el final; lo de antes de ese capítulo va detrás."""
    ab = _cargar(db, ab_id)
    caps = (db.query(AudiobookChapter)
            .filter(AudiobookChapter.audiobook_id == ab.id, AudiobookChapter.included.is_(True))
            .order_by(AudiobookChapter.position).all())
    faltan = [c for c in caps if c.status in ("pendiente", "error")]
    if not faltan:
        raise HTTPException(status_code=422, detail="No queda ningún capítulo por generar")
    inicio = 0
    if cuerpo.start_chapter_id:
        elegido = next((c for c in caps if c.id == cuerpo.start_chapter_id), None)
        if not elegido:
            raise HTTPException(status_code=422, detail="Ese capítulo no se lee: inclúyelo antes")
        inicio = elegido.position
    orden = [c for c in faltan if c.position >= inicio] + [c for c in faltan if c.position < inicio]
    ahora = _ahora()
    for i, c in enumerate(orden):
        c.status, c.queued_at, c.queue_index = "en_cola", ahora, i
        c.priority, c.error, c.attempts, c.progress, c.progress_note = False, None, 0, 0.0, None
    db.commit()
    return _detalle(db, ab)


@router.post("/{ab_id}/pause")
def pausar(ab_id: int, db: Session = Depends(get_db), _: Player = Depends(require_admin)):
    """Saca de la cola lo que falta y para lo que se esté generando. Lo ya
    hecho se queda."""
    ab = _cargar(db, ab_id)
    for c in (db.query(AudiobookChapter)
              .filter(AudiobookChapter.audiobook_id == ab.id,
                      AudiobookChapter.status.in_(("en_cola", "generando"))).all()):
        c.status, c.worker, c.lease_until, c.progress, c.progress_note = "pendiente", None, None, 0.0, None
    db.commit()
    return _detalle(db, ab)


@router.post("/{ab_id}/chapters/{cap_id}/regenerate")
def regenerar(ab_id: int, cap_id: int, db: Session = Depends(get_db), _: Player = Depends(require_admin)):
    """Vuelve a generar un capítulo, el primero de la cola. Su audio actual se
    queda hasta que llegue el nuevo."""
    c = _capitulo(db, ab_id, cap_id)
    if not c.included:
        raise HTTPException(status_code=422, detail="Ese capítulo está apartado")
    if c.status == "generando":
        raise HTTPException(status_code=409, detail="Ya se está generando")
    c.status, c.priority, c.queued_at, c.queue_index = "en_cola", True, _ahora(), 0
    c.error, c.attempts, c.progress, c.progress_note = None, 0, 0.0, None
    db.commit()
    return _detalle(db, _cargar(db, ab_id))


@router.get("/{ab_id}/chapters/{cap_id}/audio")
def audio_capitulo(ab_id: int, cap_id: int, db: Session = Depends(get_db), _: Player = Depends(require_admin)):
    # FileResponse atiende las peticiones por rangos: el reproductor puede
    # saltar a cualquier punto sin bajarse el capítulo entero.
    c = _capitulo(db, ab_id, cap_id)
    if not c.audio_path or not os.path.exists(c.audio_path):
        raise HTTPException(status_code=404, detail="Este capítulo todavía no tiene audio")
    return FileResponse(c.audio_path, media_type="audio/mp4",
                        headers={"Cache-Control": "private, max-age=3600"})


# ─── Generación: el sobremesa ────────────────────────────────────────────────
# Puchi no llama al sobremesa: es él quien pregunta (#59). Así da igual si está
# encendido o no, y nada se pierde si se apaga a medias.

# El último aviso del sobremesa. En memoria: si Puchi se reinicia, basta con
# el siguiente aviso (cada 20 s) para volver a saberlo.
_LATIDO: dict = {}
EN_LINEA = timedelta(seconds=90)


def _clave_valida(token: Optional[str]) -> bool:
    esperada = os.getenv("AUDIOLIBROS_WORKER_TOKEN", "").strip()
    if not esperada and os.path.exists(FICHERO_CLAVE):
        with open(FICHERO_CLAVE, encoding="utf-8") as f:
            esperada = f.read().strip()
    return bool(esperada and token and hmac.compare_digest(esperada, token.strip()))


def _solo_sobremesa(x_worker_token: Optional[str] = Header(None)) -> None:
    if not _clave_valida(x_worker_token):
        raise HTTPException(status_code=401, detail="Clave del sobremesa no válida")


def _latir(nombre: str, higgs_ok: bool, capitulo: Optional[int] = None) -> None:
    _LATIDO.update({"at": _ahora(), "name": nombre, "higgs_ok": higgs_ok, "chapter_id": capitulo})


class Pedir(BaseModel):
    name: str = "sobremesa"
    # Si Higgs no responde, el sobremesa avisa de que está vivo pero no
    # recibe trabajo.
    higgs_ok: bool = True


@worker_router.post("/claim")
def pedir_trabajo(cuerpo: Pedir, db: Session = Depends(get_db), _=Depends(_solo_sobremesa)):
    _latir(cuerpo.name, cuerpo.higgs_ok)
    ahora = _ahora()
    # Lo que se quedó a medias (reserva vencida) vuelve a la cola, delante.
    for c in (db.query(AudiobookChapter)
              .filter(AudiobookChapter.status == "generando", AudiobookChapter.lease_until < ahora).all()):
        c.status, c.priority, c.worker, c.progress_note = "en_cola", True, None, "Se quedó a medias"
    db.commit()
    if not cuerpo.higgs_ok:
        return Response(status_code=204)

    c = (db.query(AudiobookChapter)
         .filter(AudiobookChapter.status == "en_cola", AudiobookChapter.included.is_(True))
         .order_by(AudiobookChapter.priority.desc(), AudiobookChapter.queued_at,
                   AudiobookChapter.queue_index, AudiobookChapter.position)
         .with_for_update(skip_locked=True).first())
    if not c:
        return Response(status_code=204)
    ab = db.query(Audiobook).filter(Audiobook.id == c.audiobook_id).first()
    c.status, c.worker, c.started_at, c.lease_until = "generando", cuerpo.name, ahora, ahora + RESERVA
    c.progress, c.progress_note, c.attempts = 0.0, "Empezando", (c.attempts or 0) + 1
    db.commit()
    _latir(cuerpo.name, True, c.id)
    return {
        "chapter_id": c.id, "audiobook_id": ab.id, "audiobook_title": ab.title,
        "title": c.title, "position": c.position, "text": c.text, "voice": ab.voice,
        "lease_seconds": int(RESERVA.total_seconds()),
    }


class Progreso(BaseModel):
    name: str = "sobremesa"
    progress: float
    note: Optional[str] = None


@worker_router.post("/{cap_id}/progress")
def avisar_progreso(cap_id: int, cuerpo: Progreso, db: Session = Depends(get_db), _=Depends(_solo_sobremesa)):
    """Renueva la reserva. La respuesta dice si seguir: el admin puede haber
    pausado, apartado o borrado el capítulo mientras tanto."""
    _latir(cuerpo.name, True, cap_id)
    c = db.query(AudiobookChapter).filter(AudiobookChapter.id == cap_id).first()
    if not c or c.status != "generando" or c.worker != cuerpo.name:
        return {"continue": False}
    c.progress = max(0.0, min(1.0, cuerpo.progress))
    c.progress_note = (cuerpo.note or "")[:200] or None
    c.lease_until = _ahora() + RESERVA
    db.commit()
    return {"continue": True}


@worker_router.post("/{cap_id}/result")
def entregar_audio(
    cap_id: int,
    audio: UploadFile = File(...),
    duration_s: float = Form(...),
    recipe: str = Form("{}"),
    name: str = Form("sobremesa"),
    db: Session = Depends(get_db),
    _=Depends(_solo_sobremesa),
):
    c = db.query(AudiobookChapter).filter(AudiobookChapter.id == cap_id).first()
    # Solo si sigue siendo suyo y se está generando. Si el admin lo ha pausado,
    # apartado o le ha cambiado el texto (unir, volver a leer), ese audio ya no
    # le corresponde o no se quería.
    if not c or c.worker != name or c.status != "generando":
        raise HTTPException(status_code=409, detail="Ese capítulo ya no es tuyo")
    os.makedirs(_dir_audio(c.audiobook_id), exist_ok=True)
    ruta = os.path.join(_dir_audio(c.audiobook_id), f"{c.id}-{int(datetime.now().timestamp())}.m4a")
    with open(ruta, "wb") as f:
        shutil.copyfileobj(audio.file, f)
    anterior = c.audio_path
    try:
        receta = json.loads(recipe or "{}")
    except ValueError:
        receta = {}
    c.audio_path, c.audio_size, c.duration_s = ruta, os.path.getsize(ruta), duration_s
    c.generated_at, c.voice_used, c.recipe = _ahora(), receta.get("voice"), receta
    c.status, c.progress, c.progress_note, c.error = "listo", 1.0, None, None
    c.worker, c.lease_until, c.priority = None, None, False
    db.commit()
    if anterior and anterior != ruta:
        _borrar_archivo(anterior)
    _latir(name, True)
    return {"ok": True}


class Fallo(BaseModel):
    name: str = "sobremesa"
    message: str


@worker_router.post("/{cap_id}/error")
def avisar_error(cap_id: int, cuerpo: Fallo, db: Session = Depends(get_db), _=Depends(_solo_sobremesa)):
    """Un fallo se reintenta (hasta INTENTOS veces); después se queda en error
    para que lo mire el admin."""
    c = db.query(AudiobookChapter).filter(AudiobookChapter.id == cap_id).first()
    if not c or c.worker != cuerpo.name:
        return {"ok": True}
    c.error = cuerpo.message[:2000]
    c.worker, c.lease_until, c.progress = None, None, 0.0
    if (c.attempts or 0) >= INTENTOS:
        c.status, c.progress_note = "error", None
    else:
        c.status, c.priority, c.progress_note = "en_cola", True, f"Reintento tras un fallo ({c.attempts}/{INTENTOS})"
    db.commit()
    _latir(cuerpo.name, True)
    return {"ok": True}


@worker_router.get("/status")
def estado_sobremesa(db: Session = Depends(get_db), _: Player = Depends(require_admin)):
    """Para el admin: si el sobremesa está encendido y qué tiene la cola."""
    at = _LATIDO.get("at")
    en_cola = db.query(func.count(AudiobookChapter.id)).filter(AudiobookChapter.status == "en_cola").scalar()
    return {
        "online": bool(at and _ahora() - at < EN_LINEA),
        "last_seen": _iso(at), "name": _LATIDO.get("name"),
        "higgs_ok": _LATIDO.get("higgs_ok"), "chapter_id": _LATIDO.get("chapter_id"),
        "queued": en_cola,
        "token_configured": bool(os.getenv("AUDIOLIBROS_WORKER_TOKEN") or os.path.exists(FICHERO_CLAVE)),
    }
