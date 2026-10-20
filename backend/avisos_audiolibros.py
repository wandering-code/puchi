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

Y al admin, por el mismo camino (decidió que no hacía falta ntfy): cada
petición nueva, cada audiolibro que se termina de generar y cada capítulo
que falla del todo.

Cada aviso se guarda (player_notices) para verlo aunque no tuviera la app
abierta, se le manda en directo por el WebSocket si la tiene y, si ha
activado los avisos en su móvil, le llega también como push (push.py).
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

def quiere(p: Player, tipo: str) -> bool:
    """Si esa persona quiere este tipo de aviso. Lo elige en Ajustes y se
    guarda con su cuenta (customization["next"]["avisos"], como el resto de
    preferencias de la app); lo que no ha tocado, sí."""
    cust = p.customization if isinstance(p.customization, dict) else {}
    elegidos = (cust.get("next") or {}).get("avisos") or {}
    return elegidos.get(tipo, True) is not False


# Cuánto del último capítulo tiene que haber escuchado para contar como "al
# día": casi todo, o los dos últimos minutos.
AL_DIA = 0.85


def _repartir(db: Session, avisos: list[PlayerNotice]) -> None:
    """Los avisos recién guardados, a donde estén: push a sus móviles y, si
    tienen la app abierta, en directo por el WebSocket. Si algo falla no pasa
    nada: el aviso ya está guardado y lo verá al abrir la app."""
    if not avisos:
        return
    try:
        import push
        sin_leer = {}
        mensajes = []
        for n in avisos:
            if n.player_id not in sin_leer:
                sin_leer[n.player_id] = (db.query(PlayerNotice)
                                         .filter(PlayerNotice.player_id == n.player_id,
                                                 PlayerNotice.read_at.is_(None)).count())
            mensajes.append((n.player_id, {
                "title": n.title, "body": n.body or "",
                # Uno por libro: un "nuevo capítulo" sustituye al anterior en
                # la pantalla de bloqueo en vez de amontonarse.
                "tag": (f"adm-{n.id}" if n.kind.startswith("adm_")
                        else f"ab-{n.audiobook_id}" if n.audiobook_id else f"libro-{n.book_id}"),
                "url": f"/kokito/?aviso={n.id}",
                "badge": sin_leer[n.player_id],
            }))
        push.enviar(mensajes)
    except Exception as e:
        print(f"[avisos] no se pudo mandar el push: {e!r}", flush=True)
    _avisar_en_directo({n.player_id for n in avisos})


def _avisar_en_directo(ids: set[int]) -> None:
    """Le dice a la app abierta de cada uno que tiene avisos nuevos. Los
    endpoints que llaman aquí son síncronos (corren en un hilo aparte), así
    que se vuelve al bucle de eventos con anyio."""
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
    nuevos: list[PlayerNotice] = []
    vistos: set[int] = set()

    for r, pl, b, e in _vigentes(db, libros):
        if r.rejected_at or pl.id in vistos:
            continue
        vistos.add(pl.id)
        ya = _ya(db, pl.id, ab_id)
        titulo = ab.title

        if "ab_ready" not in ya:
            if not quiere(pl, "ab_ready"):
                continue
            objetivo, _como = capitulo_deseado(caps, r.start_page, r.start_chapter, _paginas(e, b))
            pedido = objetivo is not None
            objetivo = objetivo or caps[0]
            if not _listo(objetivo):
                continue
            nuevos.append(PlayerNotice(
                player_id=pl.id, kind="ab_ready", audiobook_id=ab_id, book_id=b.id, chapter_id=objetivo.id,
                title=f"Ya puedes escuchar «{titulo}»",
                body=(f"Empieza por «{objetivo.title}», como pediste" if pedido
                      else "El primer capítulo está listo"),
            ))
            db.add(nuevos[-1])
            # Si ya está todo, con este aviso basta: el de "completo" se da
            # por visto para no mandar dos a la vez.
            if completo:
                db.add(PlayerNotice(player_id=pl.id, kind="ab_complete", audiobook_id=ab_id, book_id=b.id,
                                    title=f"«{titulo}» está completo", read_at=_ahora()))
            continue

        if completo and "ab_complete" not in ya and quiere(pl, "ab_complete"):
            nuevos.append(PlayerNotice(
                player_id=pl.id, kind="ab_complete", audiobook_id=ab_id, book_id=b.id,
                title=f"«{titulo}» está completo",
                body=f"Ya se pueden escuchar los {len(caps)} capítulos",
            ))
            db.add(nuevos[-1])
            continue

        if nuevo is not None and quiere(pl, "ab_new_chapter") and _al_dia(db, pl.id, ab_id, caps, nuevo):
            # Uno sin leer basta: si no lo ha visto, no se le amontonan más.
            previo = ya.get("ab_new_chapter")
            if previo and not previo.read_at:
                previo.chapter_id, previo.created_at = nuevo.id, _ahora()
                previo.body = f"«{nuevo.title}» ya está listo"
                nuevos.append(previo)
            else:
                if previo:
                    db.delete(previo)
                nuevos.append(PlayerNotice(
                    player_id=pl.id, kind="ab_new_chapter", audiobook_id=ab_id, book_id=b.id, chapter_id=nuevo.id,
                    title=f"Nuevo capítulo de «{titulo}»", body=f"«{nuevo.title}» ya está listo",
                ))
                db.add(nuevos[-1])

    if nuevos:
        db.commit()
        _repartir(db, nuevos)


def al_rechazar(db: Session, peticiones: list[AudiobookRequest]) -> None:
    """Avisa a cada uno de que su petición no se va a preparar. Hace commit."""
    nuevos = []
    for r in peticiones:
        libro = db.query(Book).filter(Book.id == r.book_id).first()
        quien = db.query(Player).filter(Player.id == r.player_id).first()
        if not libro or not quien or not quiere(quien, "ab_rejected"):
            continue
        nuevos.append(PlayerNotice(
            player_id=r.player_id, kind="ab_rejected", book_id=r.book_id,
            title=f"No se va a preparar «{libro.title}»",
            body=r.reject_reason or "De momento este libro se queda sin audiolibro",
        ))
        db.add(nuevos[-1])
    db.commit()
    _repartir(db, nuevos)


def al_deshacer_rechazo(db: Session, book_ids: list[int]) -> None:
    """Si el admin se arrepiente, el aviso de rechazo sobra."""
    (db.query(PlayerNotice)
     .filter(PlayerNotice.kind == "ab_rejected", PlayerNotice.book_id.in_(book_ids))
     .delete(synchronize_session=False))
    db.commit()


# ─── Para el admin ───────────────────────────────────────────────────────────

def _admins(db: Session, tipo: str) -> list[int]:
    # El admin es la cuenta "wander" (auth.require_admin), si quiere ese aviso.
    return [p.id for p in db.query(Player)
            .filter(Player.name.ilike("wander"), Player.status == "approved").all() if quiere(p, tipo)]


def _duracion(segundos: float) -> str:
    minutos = round(segundos / 60)
    h, m = divmod(minutos, 60)
    return f"{h} h {m:02d} min" if h else f"{m} min"


def admin_peticion(db: Session, r: AudiobookRequest, quien: Player) -> None:
    """Alguien ha pedido un audiolibro. Hace commit."""
    admins = [a for a in _admins(db, "adm_request") if a != quien.id]
    libro = db.query(Book).filter(Book.id == r.book_id).first()
    if not admins or not libro:
        return
    if r.start_chapter:
        desde = f"Quiere empezar por «{r.start_chapter}»"
    elif r.start_page:
        desde = f"Quiere empezar por la pág. {r.start_page}"
    else:
        desde = "Desde el principio"
    nuevos = [PlayerNotice(player_id=a, kind="adm_request", book_id=libro.id,
                           title=f"{quien.name} pide «{libro.title}»", body=desde) for a in admins]
    db.add_all(nuevos)
    db.commit()
    _repartir(db, nuevos)


def admin_anulada(db: Session, book_id: int, quien: Player) -> None:
    """Quien pidió un audiolibro se ha echado atrás. Sin esto, el aviso de
    la petición se quedaba apuntando a algo que ya no está en la bandeja.
    Hace commit."""
    admins = [a for a in _admins(db, "adm_request_cancelled") if a != quien.id]
    libro = db.query(Book).filter(Book.id == book_id).first()
    if not admins or not libro:
        return
    nuevos = [PlayerNotice(player_id=a, kind="adm_request_cancelled", book_id=libro.id,
                           title=f"{quien.name} anula su petición de «{libro.title}»",
                           body="Ya no está en la bandeja de peticiones") for a in admins]
    db.add_all(nuevos)
    db.commit()
    _repartir(db, nuevos)


def admin_si_terminado(db: Session, ab_id: int) -> None:
    """Si con este capítulo ya está todo generado, avisa una vez. Hace commit."""
    caps = (db.query(AudiobookChapter)
            .filter(AudiobookChapter.audiobook_id == ab_id, AudiobookChapter.included.is_(True)).all())
    if not caps or not all(_listo(c) for c in caps):
        return
    admins = _admins(db, "adm_ab_done")
    ya = {pid for (pid,) in db.query(PlayerNotice.player_id)
          .filter(PlayerNotice.kind == "adm_ab_done", PlayerNotice.audiobook_id == ab_id).all()}
    ab = db.query(Audiobook).filter(Audiobook.id == ab_id).first()
    nuevos = [PlayerNotice(player_id=a, kind="adm_ab_done", audiobook_id=ab_id,
                           title=f"«{ab.title}» ya está generado entero",
                           body=f"{len(caps)} capítulos · {_duracion(sum(c.duration_s or 0 for c in caps))}")
              for a in admins if a not in ya]
    if nuevos:
        db.add_all(nuevos)
        db.commit()
        _repartir(db, nuevos)


def admin_fallo(db: Session, c: AudiobookChapter, intentos: int) -> None:
    """Un capítulo ha fallado todas las veces y se ha quedado en error."""
    ab = db.query(Audiobook).filter(Audiobook.id == c.audiobook_id).first()
    nuevos = [PlayerNotice(player_id=a, kind="adm_ch_error", audiobook_id=c.audiobook_id, chapter_id=c.id,
                           title=f"Falla un capítulo de «{ab.title if ab else '?'}»",
                           body=f"«{c.title}» tras {intentos} intentos: {(c.error or '')[:140]}")
              for a in _admins(db, "adm_ch_error")]
    if nuevos:
        db.add_all(nuevos)
        db.commit()
        _repartir(db, nuevos)


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
