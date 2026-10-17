"""Audiolibros, la parte de escuchar (fase 3, issue #65 de puchi).

Esto ya no es solo del admin: puede escuchar un audiolibro quien tenga en su
estantería alguno de los libros enlazados con él (#60). Solo se enseñan los
capítulos que se leen, y de cada uno si ya está o si sigue en camino.

El audio se pide con la sesión de siempre (la cookie): es el mismo origen, así
que el <audio> de la app la manda sola, también en iOS. No hace falta un enlace
firmado aparte, que era lo que se había previsto en el plan.
"""
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_player
from audiolibros import _ahora, _estado, _iso, _minutos
from database import (
    Audiobook, AudiobookBook, AudiobookChapter, AudiobookProgress, Book, PersonalShelf, Player, get_db,
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


def _para_escuchar(db: Session, ab: Audiobook, p: Player) -> dict:
    caps = (db.query(AudiobookChapter)
            .filter(AudiobookChapter.audiobook_id == ab.id, AudiobookChapter.included.is_(True))
            .order_by(AudiobookChapter.position).all())
    prog = (db.query(AudiobookProgress)
            .filter(AudiobookProgress.player_id == p.id, AudiobookProgress.audiobook_id == ab.id).first())
    listos = [c for c in caps if c.status == "listo"]
    # La del EPUB; si no trae, la de alguno de los libros enlazados.
    portada = ab.cover_url or (db.query(Book.cover_url)
                               .join(AudiobookBook, AudiobookBook.book_id == Book.id)
                               .filter(AudiobookBook.audiobook_id == ab.id, Book.cover_url.isnot(None))
                               .limit(1).scalar())
    return {
        "id": ab.id, "title": ab.title, "author": ab.author, "cover_url": portada,
        "status": _estado(caps),
        "chapters_total": len(caps), "chapters_ready": len(listos),
        "audio_minutes": round(sum(c.duration_s or 0 for c in listos) / 60),
        "minutes": _minutos(sum(c.words for c in caps)),
        "chapters": [{
            "id": c.id, "number": i + 1, "title": c.title,
            # Para quien escucha solo hay dos casos: se puede o todavía no.
            "ready": c.status == "listo" and bool(c.audio_path),
            "duration_s": c.duration_s, "minutes": _minutos(c.words),
            "generated_at": _iso(c.generated_at),
        } for i, c in enumerate(caps)],
        "progress": {
            "chapter_id": prog.chapter_id, "position_s": prog.position_s, "updated_at": _iso(prog.updated_at),
        } if prog and prog.chapter_id else None,
    }


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
    if not c or not c.included or c.status != "listo" or not c.audio_path or not os.path.exists(c.audio_path):
        raise HTTPException(status_code=404, detail="Este capítulo todavía no se puede escuchar")
    # Por rangos (FileResponse): se empieza a oír enseguida y se puede saltar
    # a cualquier punto de un capítulo de una hora sin bajárselo entero.
    return FileResponse(c.audio_path, media_type="audio/mp4",
                        headers={"Cache-Control": "private, max-age=86400"})


class Posicion(BaseModel):
    chapter_id: int
    position_s: float


@router.put("/{ab_id}/progress")
def guardar_posicion(ab_id: int, cuerpo: Posicion, db: Session = Depends(get_db),
                     p: Player = Depends(get_current_player)):
    _con_acceso(db, ab_id, p)
    if not db.query(AudiobookChapter.id).filter(AudiobookChapter.id == cuerpo.chapter_id,
                                                 AudiobookChapter.audiobook_id == ab_id).first():
        raise HTTPException(status_code=404, detail="Ese capítulo no es de este audiolibro")
    prog = (db.query(AudiobookProgress)
            .filter(AudiobookProgress.player_id == p.id, AudiobookProgress.audiobook_id == ab_id).first())
    if not prog:
        prog = AudiobookProgress(player_id=p.id, audiobook_id=ab_id)
        db.add(prog)
    prog.chapter_id, prog.position_s, prog.updated_at = cuerpo.chapter_id, max(0.0, cuerpo.position_s), _ahora()
    db.commit()
    return {"ok": True}
