"""Notificaciones push de la PWA (fase 7 de audiolibros, #69, parte 2).

Para que un aviso llegue al móvil con la app cerrada. Cada dispositivo que lo
activa deja aquí su suscripción (la da el navegador: una URL del servicio de
push de Apple, Google o Mozilla y dos claves). Para mandarle algo se le hace
un POST cifrado a esa URL, firmado con nuestra clave VAPID.

- La clave VAPID se genera sola la primera vez y se guarda en
  datos/vapid_private.pem, fuera del repo. Si se pierde, todas las
  suscripciones dejan de valer y cada uno tendría que volver a activarlas.
- En iPhone solo funciona con la app añadida a la pantalla de inicio
  (iOS 16.4 o posterior). Eso lo explica el frontend.
- Una suscripción que el servicio de push da por muerta (404/410: se
  desinstaló la app, se quitó el permiso) se borra al intentar usarla.
"""
import base64
import json
import os
import threading
from typing import Optional

from cryptography.hazmat.primitives import serialization
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from py_vapid import Vapid01
from pywebpush import WebPushException, webpush
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Session

from auth import get_current_player
from database import Base, Player, SessionLocal, engine, get_db
from audiolibros import _ahora

router = APIRouter(prefix="/push", tags=["avisos"])

_AQUI = os.path.dirname(__file__)
FICHERO_VAPID = os.path.join(_AQUI, "datos", "vapid_private.pem")
# Quién manda los push (lo exige VAPID). Una URL y no un correo: así no sale
# ninguna dirección personal hacia los servicios de push.
CONTACTO = "https://puchi.wanderingcode.dev"
# Si el móvil está apagado, el servicio de push lo guarda hasta un día.
VIDA_S = 24 * 3600


class PushSubscription(Base):
    """Un dispositivo que quiere recibir push. Aquí y no en database.py para
    que todo lo de push viva junto; create_all la crea igual."""
    __tablename__ = "push_subscriptions"

    id         = Column(Integer, primary_key=True, index=True)
    player_id  = Column(Integer, ForeignKey("players.id", ondelete="CASCADE"), nullable=False, index=True)
    endpoint   = Column(String, nullable=False, unique=True)
    p256dh     = Column(String, nullable=False)
    auth       = Column(String, nullable=False)
    user_agent = Column(String, nullable=True)
    created_at = Column(DateTime, default=_ahora)
    last_ok_at = Column(DateTime, nullable=True)


def migrar() -> None:
    PushSubscription.__table__.create(bind=engine, checkfirst=True)


# ─── Clave VAPID ─────────────────────────────────────────────────────────────

_vapid: Optional[Vapid01] = None
_bloqueo = threading.Lock()


def _clave() -> Vapid01:
    global _vapid
    with _bloqueo:
        if _vapid is None:
            if not os.path.exists(FICHERO_VAPID):
                os.makedirs(os.path.dirname(FICHERO_VAPID), exist_ok=True)
                v = Vapid01()
                v.generate_keys()
                v.save_key(FICHERO_VAPID)
            _vapid = Vapid01.from_file(FICHERO_VAPID)
        return _vapid


def clave_publica() -> str:
    """La que necesita el navegador para suscribirse (applicationServerKey)."""
    crudo = _clave().public_key.public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    return base64.urlsafe_b64encode(crudo).rstrip(b"=").decode()


# ─── Enviar ──────────────────────────────────────────────────────────────────

def _mandar(sub_id: int, endpoint: str, p256dh: str, auth: str, datos: dict) -> Optional[bool]:
    """True si llegó, False si la suscripción está muerta, None si fue otro
    fallo (red, servicio caído): ese se deja estar."""
    try:
        webpush(
            subscription_info={"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}},
            data=json.dumps(datos, ensure_ascii=False),
            vapid_private_key=FICHERO_VAPID,
            vapid_claims={"sub": CONTACTO},
            ttl=VIDA_S,
            timeout=15,
        )
        return True
    except WebPushException as e:
        codigo = getattr(e.response, "status_code", None)
        if codigo in (404, 410):
            return False
        print(f"[push] fallo con la suscripción {sub_id}: {codigo} {e!r}", flush=True)
        return None
    except Exception as e:
        print(f"[push] fallo con la suscripción {sub_id}: {e!r}", flush=True)
        return None


def _enviar_ya(mensajes: list[tuple[int, dict]]) -> None:
    db = SessionLocal()
    try:
        for player_id, datos in mensajes:
            for s in db.query(PushSubscription).filter(PushSubscription.player_id == player_id).all():
                r = _mandar(s.id, s.endpoint, s.p256dh, s.auth, datos)
                if r is True:
                    s.last_ok_at = _ahora()
                elif r is False:
                    db.delete(s)
            db.commit()
    finally:
        db.close()


def enviar(mensajes: list[tuple[int, dict]]) -> None:
    """Manda cada (jugador, datos) a todos sus dispositivos, en un hilo
    aparte: quien llama (p. ej. la entrega de un capítulo del sobremesa) no
    espera a los servicios de push."""
    if not mensajes:
        return
    try:
        _clave()
    except Exception as e:
        print(f"[push] sin clave VAPID: {e!r}", flush=True)
        return
    threading.Thread(target=_enviar_ya, args=(mensajes,), daemon=True).start()


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/key")
def ver_clave(_: Player = Depends(get_current_player)):
    return {"key": clave_publica()}


class Claves(BaseModel):
    p256dh: str
    auth: str


class Suscripcion(BaseModel):
    endpoint: str
    keys: Claves
    user_agent: Optional[str] = None


@router.post("/subscribe")
def suscribir(cuerpo: Suscripcion, db: Session = Depends(get_db), p: Player = Depends(get_current_player)):
    if not cuerpo.endpoint.startswith("https://"):
        raise HTTPException(status_code=422, detail="Suscripción no válida")
    s = db.query(PushSubscription).filter(PushSubscription.endpoint == cuerpo.endpoint).first()
    if not s:
        s = PushSubscription(endpoint=cuerpo.endpoint)
        db.add(s)
    # Si el mismo dispositivo lo activa otra cuenta, pasa a ser de esa.
    s.player_id, s.p256dh, s.auth = p.id, cuerpo.keys.p256dh, cuerpo.keys.auth
    s.user_agent = (cuerpo.user_agent or "")[:300] or None
    db.commit()
    return {"ok": True}


class Baja(BaseModel):
    endpoint: str


@router.post("/unsubscribe")
def darse_de_baja(cuerpo: Baja, db: Session = Depends(get_db), p: Player = Depends(get_current_player)):
    db.query(PushSubscription).filter(PushSubscription.endpoint == cuerpo.endpoint,
                                      PushSubscription.player_id == p.id).delete()
    db.commit()
    return {"ok": True}


@router.post("/test")
def probar(db: Session = Depends(get_db), p: Player = Depends(get_current_player)):
    """Un push de prueba a tus dispositivos, para comprobar que llega."""
    n = db.query(PushSubscription).filter(PushSubscription.player_id == p.id).count()
    if not n:
        raise HTTPException(status_code=404, detail="Este dispositivo no tiene los avisos activados")
    enviar([(p.id, {"title": "Avisos activados", "body": "Así te llegarán los avisos de Kokito.",
                    "tag": "prueba", "url": "/kokito/"})])
    return {"devices": n}
