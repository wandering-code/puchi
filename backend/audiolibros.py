"""Audiolibros, parte de administración (fase 1, issue #63).

El admin sube un EPUB, revisa los capítulos que salen de él (renombrar, unir,
dejar fuera los que no son texto) y enlaza el audiolibro con los libros del
catálogo que se van a escuchar con él. Aquí todavía no se genera audio: eso es
la fase 2 (#64), con el sobremesa pidiendo trabajo a Puchi (#59).

Todo es solo del admin (`require_admin`). La parte de escuchar, que sí es de
todos, irá en endpoints aparte.
"""
import difflib
import hashlib
import os
import re
import unicodedata
import uuid
from io import BytesIO
from typing import Optional

import ebooklib
from ebooklib import epub
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from auth import require_admin
from database import Audiobook, AudiobookBook, AudiobookChapter, Book, PersonalShelf, Player, get_db
from epub_capitulos import extraer_capitulos_epub

router = APIRouter(prefix="/audiobooks", tags=["audiolibros"])

_AQUI = os.path.dirname(__file__)
# Fuera de uploads/ a propósito: uploads/ lo sirve StaticFiles a cualquiera.
DIR_EPUB = os.path.join(_AQUI, "datos", "audiolibros")
DIR_PORTADAS = os.path.join(_AQUI, "uploads", "audiobook_covers")
os.makedirs(DIR_EPUB, exist_ok=True)
os.makedirs(DIR_PORTADAS, exist_ok=True)

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
    """Libros enlazados de cada audiolibro, con en cuántas estanterías están."""
    if not ids:
        return {}
    filas = (
        db.query(AudiobookBook.audiobook_id, Book, func.count(PersonalShelf.id))
        .join(Book, Book.id == AudiobookBook.book_id)
        .outerjoin(PersonalShelf, PersonalShelf.book_id == Book.id)
        .filter(AudiobookBook.audiobook_id.in_(ids))
        .group_by(AudiobookBook.audiobook_id, Book.id)
        .order_by(Book.title)
        .all()
    )
    out: dict[int, list[dict]] = {}
    for ab_id, b, estanterias in filas:
        out.setdefault(ab_id, []).append(_libro_out(b, estanterias))
    return out


def _libro_out(b: Book, estanterias: int) -> dict:
    return {"id": b.id, "title": b.title, "author": b.author, "cover_url": b.cover_url,
            "year": b.year, "shelves": estanterias}


def _resumen(ab: Audiobook, caps: list[AudiobookChapter], enlaces: list[dict]) -> dict:
    incluidos = [c for c in caps if c.included]
    palabras = sum(c.words for c in incluidos)
    return {
        "id": ab.id, "title": ab.title, "author": ab.author, "isbn": ab.isbn,
        "cover_url": ab.cover_url or next((l["cover_url"] for l in enlaces if l["cover_url"]), None),
        "voice": ab.voice, "status": ab.status,
        "created_at": ab.created_at.isoformat() if ab.created_at else None,
        "chapters_total": len(caps), "chapters_included": len(incluidos),
        "words": palabras, "minutes": _minutos(palabras),
        "books": enlaces,
    }


def _detalle(db: Session, ab: Audiobook) -> dict:
    caps = (db.query(AudiobookChapter).filter(AudiobookChapter.audiobook_id == ab.id)
            .order_by(AudiobookChapter.position).all())
    out = _resumen(ab, caps, _enlaces(db, [ab.id]).get(ab.id, []))
    out["voices"] = list(VOCES)
    out["chapters"] = [{
        "id": c.id, "position": c.position, "title": c.title, "words": c.words,
        "minutes": _minutos(c.words), "included": c.included,
        # Para reconocer el capítulo sin abrirlo: cubiertas y créditos se
        # delatan en la primera línea.
        "preview": re.sub(r"\s+", " ", c.text[:220]).strip(),
        "looks_like_extra": _parece_no_texto(c.title, c.words),
    } for c in caps]
    return out


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
        for c in (db.query(AudiobookChapter.audiobook_id, AudiobookChapter.words, AudiobookChapter.included)
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
    if ruta and os.path.exists(ruta):
        os.remove(ruta)
    _borrar_portada(portada)


@router.post("/{ab_id}/reread")
def releer(ab_id: int, db: Session = Depends(get_db), _: Player = Depends(require_admin)):
    """Vuelve a sacar los capítulos del EPUB y deshace todo lo editado en
    ellos. Los enlaces con libros no se tocan."""
    ab = _cargar(db, ab_id)
    if not os.path.exists(ab.epub_path):
        raise HTTPException(status_code=410, detail="El EPUB ya no está en el servidor")
    with open(ab.epub_path, "rb") as f:
        datos = f.read()
    db.query(AudiobookChapter).filter(AudiobookChapter.audiobook_id == ab.id).delete()
    _crear_capitulos(db, ab, datos)
    db.commit()
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
    c.text = f"{c.text}\n\n{sig.text}".strip()
    c.words = c.words + sig.words
    c.included = c.included or sig.included
    db.delete(sig)
    db.flush()
    for i, cap in enumerate(db.query(AudiobookChapter).filter(AudiobookChapter.audiobook_id == ab_id)
                            .order_by(AudiobookChapter.position).all()):
        cap.position = i
    db.commit()
    return _detalle(db, _cargar(db, ab_id))


# ─── Enlaces con libros del catálogo ─────────────────────────────────────────

def _estanterias(db: Session, ids: list[int]) -> dict[int, int]:
    if not ids:
        return {}
    return dict(db.query(PersonalShelf.book_id, func.count(PersonalShelf.id))
                .filter(PersonalShelf.book_id.in_(ids)).group_by(PersonalShelf.book_id).all())


def _enlazados(db: Session) -> dict[int, tuple[int, str]]:
    """book_id → (audiolibro, título) de todo lo ya enlazado."""
    return {b: (a, t) for b, a, t in
            db.query(AudiobookBook.book_id, Audiobook.id, Audiobook.title)
            .join(Audiobook, Audiobook.id == AudiobookBook.audiobook_id).all()}


def _con_enlace(db: Session, libros: list[tuple[Book, float]], ab_id: int) -> list[dict]:
    estanterias = _estanterias(db, [b.id for b, _ in libros])
    enlazados = _enlazados(db)
    out = []
    for b, puntos in libros:
        d = _libro_out(b, estanterias.get(b.id, 0))
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
    palabras = [p for p in q.strip().split() if len(p) >= 2]
    if not palabras:
        return []
    libros = (db.query(Book)
              .filter(*[or_(Book.title.ilike(f"%{p}%"), Book.author.ilike(f"%{p}%")) for p in palabras])
              .order_by(Book.title).limit(25).all())
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
