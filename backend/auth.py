from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Cookie, Depends, HTTPException, status
from database import SessionLocal, Player
import os

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
ALGORITHM  = "HS256"
EXPIRE_DAYS = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_pin(pin: str) -> str:
    return pwd_context.hash(pin)


def verify_pin(pin: str, hashed: str) -> bool:
    return pwd_context.verify(pin, hashed)


def create_token(player_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=EXPIRE_DAYS)
    return jwt.encode({"sub": str(player_id), "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)


def get_current_player(luni_token: Optional[str] = Cookie(None)):
    if not luni_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado")
    try:
        payload    = jwt.decode(luni_token, SECRET_KEY, algorithms=[ALGORITHM])
        player_id  = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    db = SessionLocal()
    try:
        player = db.query(Player).filter(Player.id == player_id).first()
        if not player:
            raise HTTPException(status_code=404, detail="Jugadora no encontrada")
        if player.status != "approved":
            raise HTTPException(status_code=401, detail="Cuenta sin aprobar")
        return player
    finally:
        db.close()
