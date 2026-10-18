"""Avisos de audiolibros (fase 7, issue #69 de puchi).

A quién y cuándo, según lo que decidió el usuario:

- Solo a quien lo pidió (#68). El resto de dueños del libro lo descubre por
  su cuenta (filtro de "tiene audiolibro", #74).
- "Ya puedes escuchar": cuando está listo el capítulo por el que pidió
  empezar, o el primero si no dijo nada. También al enlazar su petición con
  un audiolibro que ya lo tenía hecho.
- "Nuevo capítulo": solo si va al día, es decir, si ha escuchado hasta el
  final del último capítulo que había y está esperando el siguiente. Si va
  por detrás, no hace falta molestarle.
- "Completo": cuando ya está todo, una vez.
- "No se va a preparar": al rechazar su petición.

Cada aviso se guarda (player_notices) para verlo aunque no tuviera la app
abierta, y se le manda en directo por el WebSocket si la tiene.
"""
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_player
from audiolibros import _ahora, _iso
from audiolibros_peticiones import _paginas, _vigentes, capitulo_deseado
from database import (
    Audiobook, AudiobookBook, AudiobookChapter, AudiobookProgress, AudiobookRequest, Book, Player,
    PlayerNotice, get_db,
)

router = APIRouter(prefix="/notices", tags=["avisos"])

# Cuánto del último capítulo tiene que haber escuchado para contar como "al
# día": casi todo, o los dos últimos minutos.
AL_DIA = 0.85


def _avisar_en_directo(ids: set[int]) -> None:
    """Le dice a la app abierta de cada uno que tiene avisos nuevos. Los
    endpoints que llaman aquí son síncronos (corren en un hilo aparte), así
    que se vuelve al bucle de eventos con anyio. Si falla no pasa nada: el
    aviso ya está guardado y lo verá al abrir la app."""
    if not ids:
        return
    try:
        import anyio.from_thread
        from ws_manager import manager
        anyio.from_thread.run(manager.send_to_players, list(ids), {"type": "aviso_nuevo"})
    except Exception as e:
        print(f"[avisos] no se pudo avisar en directo: {e!r}", flush=True)


def _ya(db: Session, player_id: int, ab_id: int) -> dict[str, PlayerNotice]:
    return {n.kind: n for n in db.query(PlayerNotice)
            .filter(PlayerNotice.player_id == player_id, PlayerNotice.audiobook_id == ab_id).all()}


def _listo(c) -> bool:
    return c.status == "listo" and bool(c.audio_path)


def _al_dia(db: Session, player_id: int, ab_id: int, caps: list, nuevo) -> bool:
    """Si estaba esperando justo este capítulo: el último que escuchó es el
    anterior a este y lo ha terminado (o casi)."""
    prog = (db.query(AudiobookProgress)
            .filter(AudiobookProgress.player_id == player_id, AudiobookProgress.audiobook_id == ab_id).first())
    if not prog or not prog.chapter_id:
        return False
    i = next((n for n, c in enumerate(caps) if c.id == nuevo.id), None)
    if not i:
        return False
    anterior = caps[i - 1]
    if anterior.id != prog.chapter_id or not anterior.duration_s:
        return False
    return prog.position_s >= min(anterior.duration_s * AL_DIA, anterior.duration_s - 120)


def revisar(db: Session, ab_id: int, nuevo: Optional[AudiobookChapter] = None) -> None:
    """Mira a quién hay que avisar de este audiolibro ahora mismo. Se llama
    al entregar un capítulo (`nuevo`) y al enlazar libros con él. Hace commit
    si crea algún aviso."""
    ab = db.query(Audiobook).filter(Audiobook.id == ab_id).first()
    if not ab:
        return
    caps = (db.query(AudiobookChapter)
            .filter(AudiobookChapter.audiobook_id == ab_id, AudiobookChapter.included.is_(True))
            .order_by(AudiobookChapter.position).all())
    if not caps:
        return
    libros = [b for (b,) in db.query(AudiobookBook.book_id).filter(AudiobookBook.audiobook_id == ab_id).all()]
    if not libros:
        return
    completo = all(_listo(c) for c in caps)
    avisados: set[int] = set()
    vistos: set[int] = set()

    for r, pl, b, e in _vigentes(db, libros):
        if r.rejected_at or pl.id in vistos:
            continue
        vistos.add(pl.id)
        ya = _ya(db, pl.id, ab_id)
        titulo = ab.title

        if "ab_ready" not in ya:
            objetivo, _como = capitulo_deseado(caps, r.start_page, r.start_chapter, _paginas(e, b))
            pedido = objetivo is not None
            objetivo = objetivo or caps[0]
            if not _listo(objetivo):
                continue
            db.add(PlayerNotice(
                player_id=pl.id, kind="ab_ready", audiobook_id=ab_id, book_id=b.id, chapter_id=objetivo.id,
                title=f"Ya puedes escuchar «{titulo}»",
                body=(f"Empieza por «{objetivo.title}», como pediste" if pedido
                      else "El primer capítulo está listo"),
            ))
            # Si ya está todo, con este aviso basta: el de "completo" se da
            # por visto para no mandar dos a la vez.
            if completo:
                db.add(PlayerNotice(player_id=pl.id, kind="ab_complete", audiobook_id=ab_id, book_id=b.id,
                                    title=f"«{titulo}» está completo", read_at=_ahora()))
            avisados.add(pl.id)
            continue

        if completo and "ab_complete" not in ya:
            db.add(PlayerNotice(
                player_id=pl.id, kind="ab_complete", audiobook_id=ab_id, book_id=b.id,
                title=f"«{titulo}» está completo",
                body=f"Ya se pueden escuchar los {len(caps)} capítulos",
            ))
            avisados.add(pl.id)
            continue

        if nuevo is not None and _al_dia(db, pl.id, ab_id, caps, nuevo):
            # Uno sin leer basta: si no lo ha visto, no se le amontonan más.
            previo = ya.get("ab_new_chapter")
            if previo and not previo.read_at:
                previo.chapter_id, previo.created_at = nuevo.id, _ahora()
                previo.body = f"«{nuevo.title}» ya está listo"
            else:
                if previo:
                    db.delete(previo)
                db.add(PlayerNotice(
                    player_id=pl.id, kind="ab_new_chapter", audiobook_id=ab_id, book_id=b.id, chapter_id=nuevo.id,
                    title=f"Nuevo capítulo de «{titulo}»", body=f"«{nuevo.title}» ya está listo",
                ))
            avisados.add(pl.id)

    if avisados:
        db.commit()
        _avisar_en_directo(avisados)


def al_rechazar(db: Session, peticiones: list[AudiobookRequest]) -> None:
    """Avisa a cada uno de que su petición no se va a preparar. Hace commit."""
    ids = set()
    for r in peticiones:
        libro = db.query(Book).filter(Book.id == r.book_id).first()
        if not libro:
            continue
        db.add(PlayerNotice(
            player_id=r.player_id, kind="ab_rejected", book_id=r.book_id,
            title=f"No se va a preparar «{libro.title}»",
            body=r.reject_reason or "De momento este libro se queda sin audiolibro",
        ))
        ids.add(r.player_id)
    db.commit()
    _avisar_en_directo(ids)


def al_deshacer_rechazo(db: Session, book_ids: list[int]) -> None:
    """Si el admin se arrepiente, el aviso de rechazo sobra."""
    (db.query(PlayerNotice)
     .filter(PlayerNotice.kind == "ab_rejected", PlayerNotice.book_id.in_(book_ids))
     .delete(synchronize_session=False))
    db.commit()


def avisados(db: Session, ab_id: int) -> dict[int, list[dict]]:
    """Para la ficha del admin: qué avisos se le han dado a cada uno."""
    out: dict[int, list[dict]] = {}
    for n in (db.query(PlayerNotice).filter(PlayerNotice.audiobook_id == ab_id)
              .order_by(PlayerNotice.created_at).all()):
        out.setdefault(n.player_id, []).append(
            {"kind": n.kind, "at": _iso(n.created_at), "read": bool(n.read_at)})
    return out


# ─── La bandeja de avisos de cada uno ────────────────────────────────────────

def _salida(n: PlayerNotice, portadas: dict) -> dict:
    return {"id": n.id, "kind": n.kind, "title": n.title, "body": n.body,
            "audiobook_id": n.audiobook_id, "book_id": n.book_id, "chapter_id": n.chapter_id,
            "cover_url": portadas.get(n.audiobook_id) or portadas.get(("b", n.book_id)),
            "created_at": _iso(n.created_at), "read": bool(n.read_at)}


@router.get("")
def mis_avisos(db: Session = Depends(get_db), p: Player = Depends(get_current_player)):
    # Los de "completo" que nacieron leídos (iban con el de "ya puedes") no
    # se enseñan: no le llegaron como aviso.
    lista = (db.query(PlayerNotice)
             .filter(PlayerNotice.player_id == p.id,
                     ~((PlayerNotice.kind == "ab_complete") & PlayerNotice.body.is_(None)))
             .order_by(PlayerNotice.created_at.desc()).limit(50).all())
    abs_ = {n.audiobook_id for n in lista if n.audiobook_id}
    libros = {n.book_id for n in lista if n.book_id}
    portadas: dict = {}
    if abs_:
        portadas.update({i: c for i, c in db.query(Audiobook.id, Audiobook.cover_url).filter(Audiobook.id.in_(abs_)).all()})
    if libros:
        portadas.update({("b", i): c for i, c in db.query(Book.id, Book.cover_url).filter(Book.id.in_(libros)).all()})
    for n in lista:
        if not portadas.get(n.audiobook_id) and n.book_id:
            portadas[n.audiobook_id] = portadas.get(("b", n.book_id))
    return [_salida(n, portadas) for n in lista]


@router.get("/unread")
def sin_leer(db: Session = Depends(get_db), p: Player = Depends(get_current_player)):
    n = (db.query(PlayerNotice)
         .filter(PlayerNotice.player_id == p.id, PlayerNotice.read_at.is_(None)).count())
    return {"count": n}


class Leidos(BaseModel):
    # Sin ids, todos.
    ids: Optional[list[int]] = None


@router.post("/read")
def marcar_leidos(cuerpo: Leidos, db: Session = Depends(get_db), p: Player = Depends(get_current_player)):
    q = db.query(PlayerNotice).filter(PlayerNotice.player_id == p.id, PlayerNotice.read_at.is_(None))
    if cuerpo.ids:
        q = q.filter(PlayerNotice.id.in_(cuerpo.ids))
    q.update({PlayerNotice.read_at: _ahora()}, synchronize_session=False)
    db.commit()
    return {"ok": True}
