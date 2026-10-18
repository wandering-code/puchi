"""Avisos de novedades del admin (issue #72 de puchi).

Como el que tenía Kokito: el admin escribe un aviso y le sale a cada persona
a la que va dirigido, hasta que le da a "Entendido".

- A quién: a todos, solo a los del club o a personas concretas.
- El admin ve quién lo ha aceptado y quién no.
- Puede editarlo, relanzarlo (vuelve a salir a todos, también a quien ya lo
  había aceptado) o borrarlo.
- Al lanzarlo (y al relanzarlo) se puede mandar también como notificación al
  móvil, a quien las tenga activadas.

Le sale a quien tenga la app abierta en ese momento (por el WebSocket) y, si
no, al abrirla.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_player, require_admin
from audiolibros import _ahora, _iso
from database import Announcement, AnnouncementAck, Player, get_db

router = APIRouter(prefix="/announcements", tags=["novedades"])

PUBLICOS = ("todos", "club", "personas")


def _es_admin(p: Player) -> bool:
    return p.name.lower() == "wander"


def _destinatarios(db: Session, a: Announcement) -> list[Player]:
    """A quién va, ahora mismo: las cuentas aprobadas que encajan, sin el
    admin (lo ha escrito él). Se calcula cada vez, así que quien entra en el
    club después también lo recibe."""
    q = db.query(Player).filter(Player.status == "approved")
    if a.audience == "club":
        q = q.filter(Player.club_member.is_(True))
    elif a.audience == "personas":
        ids = [int(i) for i in (a.player_ids or [])]
        if not ids:
            return []
        q = q.filter(Player.id.in_(ids))
    return [p for p in q.order_by(Player.name).all() if not _es_admin(p)]


def _le_toca(a: Announcement, p: Player) -> bool:
    if _es_admin(p) or p.status != "approved":
        return False
    if a.audience == "club":
        return bool(p.club_member)
    if a.audience == "personas":
        return p.id in {int(i) for i in (a.player_ids or [])}
    return True


def _aceptados(db: Session, a: Announcement) -> dict[int, AnnouncementAck]:
    """Los que lo han aceptado desde el último lanzamiento."""
    return {k.player_id: k for k in db.query(AnnouncementAck)
            .filter(AnnouncementAck.announcement_id == a.id,
                    AnnouncementAck.accepted_at >= a.launched_at).all()}


def _salida(a: Announcement) -> dict:
    return {"id": a.id, "title": a.title, "body": a.body or "", "launched_at": _iso(a.launched_at)}


def _avisar(db: Session, a: Announcement, con_push: bool) -> None:
    """Que salga ya a quien tenga la app abierta y, si se pide, como
    notificación al móvil. Si algo falla no pasa nada: le saldrá al abrirla."""
    ids = [p.id for p in _destinatarios(db, a)]
    if not ids:
        return
    try:
        import anyio.from_thread
        from ws_manager import manager
        anyio.from_thread.run(manager.send_to_players, ids, {"type": "novedad"})
    except Exception as e:
        print(f"[novedades] no se pudo avisar en directo: {e!r}", flush=True)
    if con_push:
        try:
            import push
            push.enviar([(i, {"title": a.title, "body": (a.body or "")[:180],
                              "tag": f"novedad-{a.id}", "url": "/kokito/"}) for i in ids])
        except Exception as e:
            print(f"[novedades] no se pudo mandar el push: {e!r}", flush=True)


# ─── Para cada uno ───────────────────────────────────────────────────────────

@router.get("/pending")
def pendientes(db: Session = Depends(get_db), p: Player = Depends(get_current_player)):
    """Los avisos que le faltan por aceptar, del más antiguo al más nuevo."""
    salida = []
    for a in db.query(Announcement).order_by(Announcement.launched_at).all():
        if not _le_toca(a, p):
            continue
        k = (db.query(AnnouncementAck)
             .filter(AnnouncementAck.announcement_id == a.id, AnnouncementAck.player_id == p.id).first())
        if k and k.accepted_at >= a.launched_at:
            continue
        salida.append(_salida(a))
    return salida


@router.post("/{a_id}/accept")
def aceptar(a_id: int, db: Session = Depends(get_db), p: Player = Depends(get_current_player)):
    a = db.query(Announcement).filter(Announcement.id == a_id).first()
    if not a:
        return {"ok": True}  # borrado mientras lo leía: nada que aceptar
    k = (db.query(AnnouncementAck)
         .filter(AnnouncementAck.announcement_id == a.id, AnnouncementAck.player_id == p.id).first())
    if not k:
        k = AnnouncementAck(announcement_id=a.id, player_id=p.id)
        db.add(k)
    k.accepted_at = _ahora()
    db.commit()
    return {"ok": True}


# ─── Para el admin ───────────────────────────────────────────────────────────

class Aviso(BaseModel):
    title: str
    body: str = ""
    audience: str = "todos"
    player_ids: Optional[list[int]] = None
    push: bool = False


class CambiosAviso(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    audience: Optional[str] = None
    player_ids: Optional[list[int]] = None


class Relanzar(BaseModel):
    push: bool = False


def _validar(audience: Optional[str], player_ids: Optional[list[int]], title: Optional[str]) -> None:
    if audience is not None and audience not in PUBLICOS:
        raise HTTPException(status_code=422, detail="A quién va: todos, club o personas")
    if audience == "personas" and not player_ids:
        raise HTTPException(status_code=422, detail="Elige al menos a una persona")
    if title is not None and not title.strip():
        raise HTTPException(status_code=422, detail="Ponle un título")


def _detalle(db: Session, a: Announcement, con_gente: bool = False) -> dict:
    gente = _destinatarios(db, a)
    ok = _aceptados(db, a)
    out = {
        **_salida(a),
        "audience": a.audience, "player_ids": a.player_ids or [],
        "created_at": _iso(a.created_at),
        "total": len(gente), "accepted": sum(1 for p in gente if p.id in ok),
    }
    if con_gente:
        out["people"] = [{
            "id": p.id, "name": p.name, "avatar_emoji": p.avatar_emoji, "avatar_url": p.avatar_url,
            "color": p.color, "accepted_at": _iso(ok[p.id].accepted_at) if p.id in ok else None,
        } for p in gente]
    return out


def _cargar(db: Session, a_id: int) -> Announcement:
    a = db.query(Announcement).filter(Announcement.id == a_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Ese aviso ya no existe")
    return a


@router.get("")
def lista(db: Session = Depends(get_db), _: Player = Depends(require_admin)):
    return [_detalle(db, a) for a in db.query(Announcement).order_by(Announcement.launched_at.desc()).all()]


@router.get("/{a_id}")
def ver(a_id: int, db: Session = Depends(get_db), _: Player = Depends(require_admin)):
    return _detalle(db, _cargar(db, a_id), con_gente=True)


@router.post("")
def crear(cuerpo: Aviso, db: Session = Depends(get_db), _: Player = Depends(require_admin)):
    _validar(cuerpo.audience, cuerpo.player_ids, cuerpo.title)
    ahora = _ahora()
    a = Announcement(title=cuerpo.title.strip(), body=cuerpo.body.strip(), audience=cuerpo.audience,
                     player_ids=cuerpo.player_ids if cuerpo.audience == "personas" else None,
                     created_at=ahora, launched_at=ahora)
    db.add(a)
    db.commit()
    _avisar(db, a, cuerpo.push)
    return _detalle(db, a, con_gente=True)


@router.patch("/{a_id}")
def editar(a_id: int, cuerpo: CambiosAviso, db: Session = Depends(get_db), _: Player = Depends(require_admin)):
    """Cambiar el texto o a quién va no lo vuelve a sacar a quien ya lo
    aceptó (para eso está relanzar). Si se añade gente, a esa le sale."""
    a = _cargar(db, a_id)
    publico = cuerpo.audience if cuerpo.audience is not None else a.audience
    personas = cuerpo.player_ids if cuerpo.player_ids is not None else a.player_ids
    _validar(publico, personas, cuerpo.title)
    antes = {p.id for p in _destinatarios(db, a)}
    if cuerpo.title is not None:
        a.title = cuerpo.title.strip()
    if cuerpo.body is not None:
        a.body = cuerpo.body.strip()
    a.audience = publico
    a.player_ids = personas if publico == "personas" else None
    db.commit()
    nuevos = [p.id for p in _destinatarios(db, a) if p.id not in antes]
    if nuevos:
        try:
            import anyio.from_thread
            from ws_manager import manager
            anyio.from_thread.run(manager.send_to_players, nuevos, {"type": "novedad"})
        except Exception as e:
            print(f"[novedades] no se pudo avisar en directo: {e!r}", flush=True)
    return _detalle(db, a, con_gente=True)


@router.post("/{a_id}/relaunch")
def relanzar(a_id: int, cuerpo: Relanzar, db: Session = Depends(get_db), _: Player = Depends(require_admin)):
    a = _cargar(db, a_id)
    a.launched_at = _ahora()
    db.commit()
    _avisar(db, a, cuerpo.push)
    return _detalle(db, a, con_gente=True)


@router.delete("/{a_id}")
def borrar(a_id: int, db: Session = Depends(get_db), _: Player = Depends(require_admin)):
    a = db.query(Announcement).filter(Announcement.id == a_id).first()
    if a:
        db.delete(a)
        db.commit()
    return {"ok": True}
