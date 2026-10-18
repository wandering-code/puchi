"""Audiolibros, la parte de escuchar (fase 3, issue #65 de puchi).

Esto ya no es solo del admin: puede escuchar un audiolibro quien tenga en su
estantería alguno de los libros enlazados con él (#60). Solo se enseñan los
capítulos que se leen, y de cada uno si ya está o si sigue en camino.

Fase 5 (#67): escuchar mueve el progreso de lectura del libro en tu
estantería, solo hacia delante (nunca deshace lo leído en papel o eReader), y
empezar a escuchar un libro "Por leer" lo pasa a "Leyendo". Lo eligió el
usuario.

El audio se pide con la sesión de siempre (la cookie): es el mismo origen, así
que el <audio> de la app la manda sola, también en iOS. No hace falta un enlace
firmado aparte, que era lo que se había previsto en el plan.
"""
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import get_current_player
from audiolibros import _ahora, _estado, _iso, _minutos
from audiolibros_peticiones import capitulo_deseado
from ws_manager import manager
from database import (
    Activity,
    Audiobook, AudiobookBook, AudiobookChapter, AudiobookProgress, AudiobookRequest, Book, PersonalShelf,
    Player, get_db,
)

router = APIRouter(prefix="/listen", tags=["audiolibros"])


def _es_admin(p: Player) -> bool:
    return p.name.lower() == "wander"


def _con_acceso(db: Session, ab_id: int, p: Player) -> Audiobook:
    ab = db.query(Audiobook).filter(Audiobook.id == ab_id).first()
    if not ab:
        raise HTTPException(status_code=404, detail="Ese audiolibro no existe")
    if _es_admin(p):
        return ab
    tiene = (db.query(PersonalShelf.id)
             .join(AudiobookBook, AudiobookBook.book_id == PersonalShelf.book_id)
             .filter(AudiobookBook.audiobook_id == ab.id, PersonalShelf.player_id == p.id).first())
    if not tiene:
        raise HTTPException(status_code=403, detail="Para escucharlo tienes que tener el libro en tu estantería")
    return ab


def _suena(c: AudiobookChapter) -> bool:
    """Se puede escuchar si tiene audio, aunque se esté regenerando: el audio
    de antes se queda hasta que llega el nuevo."""
    return bool(c.audio_path)


def _porcentaje(caps: list, cap_id: Optional[int], segundo: float) -> Optional[float]:
    """Qué parte del libro va escuchada, por palabras: las de los capítulos
    de antes, más lo que va del actual (por tiempo). Por palabras y no por
    minutos porque los capítulos aún sin generar no tienen duración."""
    total = sum(c.words for c in caps)
    i = next((n for n, c in enumerate(caps) if c.id == cap_id), None)
    if not total or i is None:
        return None
    actual = caps[i]
    fraccion = min(1.0, segundo / actual.duration_s) if actual.duration_s else 0.0
    return min(1.0, (sum(c.words for c in caps[:i]) + fraccion * actual.words) / total)


# Margen para decir que la lectura va "por delante" del audio: lo que se lee
# de más en una sentada, no una página suelta.
POR_DELANTE = 0.01


def _donde_lees(db: Session, ab: Audiobook, p: Player, caps: list) -> Optional[dict]:
    """Por dónde vas leyendo este libro en papel o eReader (fase 9, #71): la
    página, en qué parte del libro cae y el capítulo que le corresponde. Solo
    si lo estás leyendo y hay página guardada."""
    e = (db.query(PersonalShelf)
         .join(AudiobookBook, AudiobookBook.book_id == PersonalShelf.book_id)
         .filter(AudiobookBook.audiobook_id == ab.id, PersonalShelf.player_id == p.id,
                 PersonalShelf.status.in_(("reading", "rereading")), PersonalShelf.current_page > 0)
         .order_by(PersonalShelf.current_page.desc()).first())
    if not e:
        return None
    total = e.custom_total_pages or (e.book.num_pages if e.book else None) or e.ereader_total_pages
    if not total:
        return None
    cap, _como = capitulo_deseado(caps, e.current_page, None, total)
    if not cap:
        return None
    # La página como la ve quien lee: en las de su eReader si lee ahí (la
    # misma regla de tres que la ficha del libro).
    pagina, de = e.current_page, total
    er = e.ereader_total_pages
    if e.reading_format == "ereader" and er and er != total:
        pagina, de = max(1, round(e.current_page * er / total)), er
    return {"page": pagina, "of": de, "fraction": min(1.0, (e.current_page - 1) / total),
            "chapter_id": cap.id, "chapter_title": cap.title,
            "ready": _suena(cap)}


def _para_escuchar(db: Session, ab: Audiobook, p: Player) -> dict:
    caps = (db.query(AudiobookChapter)
            .filter(AudiobookChapter.audiobook_id == ab.id, AudiobookChapter.included.is_(True))
            .order_by(AudiobookChapter.position).all())
    prog = (db.query(AudiobookProgress)
            .filter(AudiobookProgress.player_id == p.id, AudiobookProgress.audiobook_id == ab.id).first())
    listos = [c for c in caps if _suena(c)]
    # Si lo pidió diciendo por dónde empezar, la primera vez empieza ahí
    # (fase 6, #68). Después manda lo que haya escuchado.
    empezar = None
    if not (prog and prog.chapter_id):
        pet = (db.query(AudiobookRequest, PersonalShelf, Book)
               .join(AudiobookBook, AudiobookBook.book_id == AudiobookRequest.book_id)
               .join(PersonalShelf, (PersonalShelf.book_id == AudiobookRequest.book_id)
                     & (PersonalShelf.player_id == AudiobookRequest.player_id))
               .join(Book, Book.id == AudiobookRequest.book_id)
               .filter(AudiobookBook.audiobook_id == ab.id, AudiobookRequest.player_id == p.id,
                       AudiobookRequest.rejected_at.is_(None)).first())
        if pet:
            r, e, b = pet
            cap, _como = capitulo_deseado(caps, r.start_page, r.start_chapter, e.custom_total_pages or b.num_pages or e.ereader_total_pages)
            empezar = cap.id if cap else None
    motivo = "peticion" if empezar else None

    # Lo que llevas leído (#71). La primera vez, si vas más adelante que lo
    # que pediste (o no pediste nada), se empieza por donde lees. Después,
    # si lees por delante de lo escuchado, se ofrece saltar ahí.
    lectura = _donde_lees(db, ab, p, caps)
    if lectura and not (prog and prog.chapter_id):
        pos = {c.id: c.position for c in caps}
        if empezar is None or pos[lectura["chapter_id"]] > pos.get(empezar, -1):
            empezar, motivo = lectura["chapter_id"], "lectura"
    if lectura:
        escuchado = _porcentaje(caps, prog.chapter_id, prog.position_s) if prog and prog.chapter_id else None
        lectura["ahead"] = escuchado is not None and lectura["fraction"] > escuchado + POR_DELANTE
        del lectura["fraction"]
    # La del EPUB; si no trae, la de alguno de los libros enlazados.
    portada = ab.cover_url or (db.query(Book.cover_url)
                               .join(AudiobookBook, AudiobookBook.book_id == Book.id)
                               .filter(AudiobookBook.audiobook_id == ab.id, Book.cover_url.isnot(None))
                               .limit(1).scalar())
    return {
        "id": ab.id, "title": ab.title, "author": ab.author, "cover_url": portada,
        "status": _estado(caps),
        "start_chapter_id": empezar,
        # Por qué empieza ahí: "peticion" (lo pidió así) o "lectura" (por
        # donde va leyendo).
        "start_reason": motivo,
        "reading": lectura,
        "chapters_total": len(caps), "chapters_ready": len(listos),
        "audio_minutes": round(sum(c.duration_s or 0 for c in listos) / 60),
        "minutes": _minutos(sum(c.words for c in caps)),
        "chapters": [{
            "id": c.id, "number": i + 1, "title": c.title,
            # Para quien escucha solo hay dos casos: se puede o todavía no.
            "ready": _suena(c),
            "duration_s": c.duration_s, "minutes": _minutos(c.words),
            "generated_at": _iso(c.generated_at),
            # Lo que ocupa, para saber cuánto se va a descargar (#71).
            "size": c.audio_size,
        } for i, c in enumerate(caps)],
        "progress": {
            "chapter_id": prog.chapter_id, "position_s": prog.position_s, "updated_at": _iso(prog.updated_at),
            "percent": _porcentaje(caps, prog.chapter_id, prog.position_s),
        } if prog and prog.chapter_id else None,
    }


# ─── Descubrir (issue #74) ───────────────────────────────────────────────────
# Los avisos van solo a quien pidió el audiolibro (#69). El resto los
# encuentra aquí: un filtro en su Luniteca y la lista de todos los que hay.

def _escuchables(db: Session) -> dict[int, list[AudiobookChapter]]:
    """Audiolibros con al menos un capítulo que ya suena, con sus capítulos
    incluidos en orden."""
    caps: dict[int, list] = {}
    for c in (db.query(AudiobookChapter)
              .filter(AudiobookChapter.included.is_(True))
              .order_by(AudiobookChapter.audiobook_id, AudiobookChapter.position).all()):
        caps.setdefault(c.audiobook_id, []).append(c)
    return {ab: cs for ab, cs in caps.items() if any(_suena(c) for c in cs)}


@router.get("/books")
def libros_con_audio(db: Session = Depends(get_db), _: Player = Depends(get_current_player)):
    """Qué libros del catálogo tienen un audiolibro que ya se puede escuchar:
    para el filtro "Con audiolibro" de la Luniteca."""
    ids = list(_escuchables(db))
    if not ids:
        return {"book_ids": []}
    return {"book_ids": [b for (b,) in db.query(AudiobookBook.book_id)
                         .filter(AudiobookBook.audiobook_id.in_(ids)).all()]}


@router.get("/catalog")
def catalogo(db: Session = Depends(get_db), p: Player = Depends(get_current_player)):
    """Todos los audiolibros que ya se pueden escuchar, estén o no en tu
    estantería. Para escuchar uno hay que tener el libro (#60): si no lo
    tienes, `add_book_id` es el que se añadiría (de sus ediciones, la que
    más gente tiene)."""
    caps = _escuchables(db)
    if not caps:
        return []
    abs_ = db.query(Audiobook).filter(Audiobook.id.in_(caps)).all()
    enlaces: dict[int, list[Book]] = {}
    for ab_id, b in (db.query(AudiobookBook.audiobook_id, Book)
                     .join(Book, Book.id == AudiobookBook.book_id)
                     .filter(AudiobookBook.audiobook_id.in_(caps)).all()):
        enlaces.setdefault(ab_id, []).append(b)
    todos = [b.id for bs in enlaces.values() for b in bs]
    mios = {e.book_id: e for e in db.query(PersonalShelf)
            .filter(PersonalShelf.player_id == p.id, PersonalShelf.book_id.in_(todos)).all()} if todos else {}
    cuantos = dict(db.query(PersonalShelf.book_id, func.count(PersonalShelf.id))
                   .filter(PersonalShelf.book_id.in_(todos)).group_by(PersonalShelf.book_id).all()) if todos else {}
    progresos = {g.audiobook_id: g for g in db.query(AudiobookProgress)
                 .filter(AudiobookProgress.player_id == p.id, AudiobookProgress.audiobook_id.in_(caps)).all()}

    out = []
    for ab in abs_:
        cs = caps[ab.id]
        libros = enlaces.get(ab.id, [])
        if not libros:
            continue
        listos = [c for c in cs if _suena(c)]
        mio = next((mios[b.id] for b in libros if b.id in mios), None)
        prog = progresos.get(ab.id)
        canonico = max(libros, key=lambda b: (cuantos.get(b.id, 0), -b.id))
        out.append({
            "id": ab.id, "title": ab.title, "author": ab.author,
            "cover_url": ab.cover_url or next((b.cover_url for b in libros if b.cover_url), None),
            "chapters_total": len(cs), "chapters_ready": len(listos),
            "audio_minutes": round(sum(c.duration_s or 0 for c in listos) / 60),
            "minutes": _minutos(sum(c.words for c in cs)),
            "complete": len(listos) == len(cs),
            "ready_since": _iso(max((c.generated_at for c in listos if c.generated_at), default=None)),
            # Cuánta gente lo tiene en su estantería (con cualquiera de sus ediciones).
            "shelves": sum(cuantos.get(b.id, 0) for b in libros),
            "mine": {"book_id": mio.book_id, "status": mio.status} if mio else None,
            "add_book_id": canonico.id,
            "percent": _porcentaje(cs, prog.chapter_id, prog.position_s) if prog and prog.chapter_id else None,
        })
    # Lo tuyo primero (lo que vas escuchando, arriba); luego lo más reciente.
    mias = sorted([a for a in out if a["mine"]], key=lambda a: (a["percent"] is None, a["title"].lower()))
    otras = sorted([a for a in out if not a["mine"]], key=lambda a: a["ready_since"] or "", reverse=True)
    return mias + otras


@router.get("/book/{book_id}")
def de_un_libro(book_id: int, db: Session = Depends(get_db), p: Player = Depends(get_current_player)):
    """El audiolibro de un libro, si lo hay y si lo puede escuchar quien
    pregunta. Sin audiolibro (o sin nada generado todavía) devuelve null: la
    ficha del libro simplemente no enseña nada."""
    enlace = db.query(AudiobookBook).filter(AudiobookBook.book_id == book_id).first()
    if not enlace:
        return None
    try:
        ab = _con_acceso(db, enlace.audiobook_id, p)
    except HTTPException:
        return None
    datos = _para_escuchar(db, ab, p)
    if datos["status"] == "borrador" and not datos["chapters_ready"]:
        return None
    return datos


@router.get("/{ab_id}")
def ver(ab_id: int, db: Session = Depends(get_db), p: Player = Depends(get_current_player)):
    return _para_escuchar(db, _con_acceso(db, ab_id, p), p)


@router.get("/{ab_id}/chapters/{cap_id}/audio")
def audio(ab_id: int, cap_id: int, db: Session = Depends(get_db), p: Player = Depends(get_current_player)):
    _con_acceso(db, ab_id, p)
    c = (db.query(AudiobookChapter)
         .filter(AudiobookChapter.id == cap_id, AudiobookChapter.audiobook_id == ab_id).first())
    if not c or not c.included or not _suena(c) or not os.path.exists(c.audio_path):
        raise HTTPException(status_code=404, detail="Este capítulo todavía no se puede escuchar")
    # Por rangos (FileResponse): se empieza a oír enseguida y se puede saltar
    # a cualquier punto de un capítulo de una hora sin bajárselo entero.
    return FileResponse(c.audio_path, media_type="audio/mp4",
                        headers={"Cache-Control": "private, max-age=86400"})


class Posicion(BaseModel):
    chapter_id: int
    position_s: float


@router.put("/{ab_id}/progress")
async def guardar_posicion(ab_id: int, cuerpo: Posicion, db: Session = Depends(get_db),
                           p: Player = Depends(get_current_player)):
    ab = _con_acceso(db, ab_id, p)
    caps = (db.query(AudiobookChapter)
            .filter(AudiobookChapter.audiobook_id == ab.id, AudiobookChapter.included.is_(True))
            .order_by(AudiobookChapter.position).all())
    if not any(c.id == cuerpo.chapter_id for c in caps):
        raise HTTPException(status_code=404, detail="Ese capítulo no es de este audiolibro")
    prog = (db.query(AudiobookProgress)
            .filter(AudiobookProgress.player_id == p.id, AudiobookProgress.audiobook_id == ab.id).first())
    primera_vez = prog is None
    if not prog:
        prog = AudiobookProgress(player_id=p.id, audiobook_id=ab.id)
        db.add(prog)
    prog.chapter_id, prog.position_s, prog.updated_at = cuerpo.chapter_id, max(0.0, cuerpo.position_s), _ahora()

    pct = _porcentaje(caps, cuerpo.chapter_id, prog.position_s)
    estanteria, actividad = _llevar_a_la_estanteria(db, ab, p, pct, primera_vez)
    db.commit()
    # Solo si ha cambiado algo de verdad: esto llega cada 15 s mientras suena,
    # y cada aviso hace que las Lunitecas abiertas vuelvan a pedir la estantería.
    if estanteria:
        await manager.broadcast({"type": "luni_update", "scope": "shelf"})
    if actividad:
        await manager.broadcast({"type": "luni_update", "scope": "activity"})
    return {"ok": True, "percent": pct}


def _llevar_a_la_estanteria(db: Session, ab: Audiobook, p: Player, pct: Optional[float],
                            primera_vez: bool) -> tuple[bool, bool]:
    """Lo escuchado, en tu copia del libro (la que esté enlazada con este
    audiolibro; normalmente una). Devuelve si cambió la estantería y si hubo
    actividad nueva."""
    libros = [b for (b,) in db.query(AudiobookBook.book_id).filter(AudiobookBook.audiobook_id == ab.id).all()]
    copias = (db.query(PersonalShelf)
              .filter(PersonalShelf.player_id == p.id, PersonalShelf.book_id.in_(libros)).all()) if libros else []
    cambio, actividad = False, False
    for e in copias:
        if e.status == "want_to_read":
            # Empezar a escuchar es empezarlo: pasa a Leyendo como si se
            # hubiera tocado a mano, con fecha de hoy y el audio marcado.
            e.status = "reading"
            e.started_at = e.started_at or _ahora()
            e.listening = True
            db.add(Activity(player_id=p.id, book_id=e.book_id, event_type="started"))
            cambio = actividad = True
        if primera_vez:
            if not e.listening:
                e.listening, cambio = True, True
            # "Empezó a escuchar", solo en /kokito (ver /activity/feed).
            db.add(Activity(player_id=p.id, book_id=e.book_id, event_type="listening"))
            actividad = True
        # Solo hacia delante, y solo mientras se está leyendo: lo terminado o
        # dejado no se toca.
        if pct is None or e.status not in ("reading", "rereading"):
            continue
        total = e.custom_total_pages or (e.book.num_pages if e.book else None)
        if total:
            pagina = int(pct * total)
            if pagina > (e.current_page or 0):
                e.current_page, e.progress, cambio = pagina, min(pagina / total, 1.0), True
        elif pct > (e.progress or 0) + 0.005:
            e.progress, cambio = pct, True
    return cambio, actividad
