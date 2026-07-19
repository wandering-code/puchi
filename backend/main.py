from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, Response, WebSocket, WebSocketDisconnect, Query, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
from io import BytesIO
from PIL import Image
import httpx
import os, uuid, shutil, re, unicodedata
from jose import JWTError, jwt

from database import (
    get_db, crear_tablas, SessionLocal, engine,
    Player, Book, PersonalShelf, ClubShelf, ClubReadingLog, Vote,
    Channel, ChannelMember, Message, Activity, ShopItem,
    Session as ClubSession,
)
from auth import hash_pin, verify_pin, create_token, get_current_player, SECRET_KEY, ALGORITHM
from ws_manager import manager

# Estado en memoria de la llamada grupal de #club-general (efímero, como el resto de señalización de llamadas).
# "active" solo pasa a True cuando hay >=2 participantes a la vez (llamada "iniciada" de verdad);
# se mantiene True mientras el conteo no baje a 0, para permitir reincorporarse aunque baje a 1 temporalmente.
general_call: dict = {
    "active": False,
    "participants": set(),   # player_ids actualmente en el mesh
    "call_type": "video",
}


def _general_member_ids(db) -> list[int]:
    general = db.query(Channel).filter(Channel.name == "club-general").first()
    if not general:
        return []
    return [m.player_id for m in db.query(ChannelMember).filter_by(channel_id=general.id).all()]


def _general_call_state() -> dict:
    return {
        "type": "group_call_state",
        "active": general_call["active"],
        "callType": general_call["call_type"],
        "participantIds": list(general_call["participants"]),
    }

# Mapeo de etiquetas Open Library → géneros canónicos en español (orden = prioridad)
_GENRE_MAP = [
    ('Fantasía',              ['fantasy']),
    ('Ciencia ficción',       ['science fiction', 'sci-fi', 'scifi']),
    ('Misterio',              ['mystery', 'detective']),
    ('Thriller',              ['thriller', 'suspense']),
    ('Romance',               ['romance']),
    ('Ficción histórica',     ['historical fiction', 'historical novel']),
    ('Terror',                ['horror']),
    ('Aventura',              ['adventure fiction', 'adventure stories']),
    ('Literatura infantil',   ['juvenile fiction', 'juvenile literature', "children's fiction"]),
    ('Juvenil',               ['young adult', 'ya fiction']),
    ('Ficción literaria',     ['literary fiction']),
    ('Novela gráfica',        ['graphic novel', 'comics']),
    ('Biografía',             ['biography', 'biographical']),
    ('Memorias',              ['memoir', 'autobiography']),
    ('Autoayuda',             ['self-help', 'personal development']),
    ('No ficción',            ['nonfiction', 'non-fiction']),
    ('Poesía',                ['poetry', 'poems']),
    ('Drama',                 ['drama', 'plays']),
    ('Distopía',              ['dystopian', 'dystopia']),
    ('Realismo mágico',       ['magical realism']),
    ('Crimen',                ['crime fiction', 'noir']),
    ('Western',               ['western stories', 'western fiction']),
    ('Clásico',               ['classic', 'classics']),
    ('Ficción',               ['fiction']),
]

def _pick_genre(subjects: list) -> str | None:
    """Devuelve el primer género canónico que coincida con las etiquetas, o None."""
    if not subjects:
        return None
    lowered = [s.lower() for s in subjects]
    for genre_name, keywords in _GENRE_MAP:
        for s in lowered:
            for kw in keywords:
                if kw in s:
                    return genre_name
    return None


_UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads', 'covers')
os.makedirs(_UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="Luni API")
app.mount("/uploads", StaticFiles(directory=os.path.join(os.path.dirname(__file__), 'uploads')), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5175",
        "http://localhost:5176",
        "http://192.168.1.94:5175",
        "http://192.168.1.89:5176",
        "https://luni.wanderingcode.dev",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


@app.on_event("startup")
def startup():
    crear_tablas()
    _migrate()
    _seed_channels()
    _seed_shop_items()


def _migrate():
    """Añade columnas nuevas a tablas existentes sin romper datos. Idempotente."""
    from sqlalchemy import text
    stmts = [
        # books: metadatos enriquecidos
        "ALTER TABLE books ADD COLUMN IF NOT EXISTS num_pages INTEGER",
        "ALTER TABLE books ADD COLUMN IF NOT EXISTS synopsis TEXT",
        "ALTER TABLE books ADD COLUMN IF NOT EXISTS year INTEGER",
        "ALTER TABLE books ADD COLUMN IF NOT EXISTS genre VARCHAR",

        # personal_shelf: estado y orden físico
        "ALTER TABLE personal_shelf ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'read'",
        "ALTER TABLE personal_shelf ADD COLUMN IF NOT EXISTS sort_order INTEGER",
        # Inferir estado de lectura para filas existentes
        "UPDATE personal_shelf SET status = 'reading' WHERE status = 'read' AND finished_at IS NULL AND progress > 0",

        # personal_shelf: progreso por páginas y carpetas
        "ALTER TABLE personal_shelf ADD COLUMN IF NOT EXISTS current_page INTEGER",
        "ALTER TABLE personal_shelf ADD COLUMN IF NOT EXISTS custom_total_pages INTEGER",
        "ALTER TABLE personal_shelf ADD COLUMN IF NOT EXISTS folder VARCHAR",

        # personal_shelf: rating pasa a float para admitir medios puntos
        """DO $$ BEGIN
             IF (SELECT data_type FROM information_schema.columns
                 WHERE table_name='personal_shelf' AND column_name='rating') = 'integer'
             THEN ALTER TABLE personal_shelf ALTER COLUMN rating TYPE FLOAT USING rating::float;
             END IF;
           END $$""",

        # activity: registro de eventos de lectura
        """CREATE TABLE IF NOT EXISTS activity (
             id         SERIAL PRIMARY KEY,
             player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
             book_id    INTEGER NOT NULL REFERENCES books(id)   ON DELETE CASCADE,
             event_type VARCHAR NOT NULL,
             rating     FLOAT,
             created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
           )""",

        # club_shelf: estado del libro en el ciclo de vida del club
        "ALTER TABLE club_shelf ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'finished'",
        "ALTER TABLE club_shelf ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP WITH TIME ZONE",
        # Renombrar added_by → proposed_by (ADD + UPDATE + DROP es seguro y repetible)
        "ALTER TABLE club_shelf ADD COLUMN IF NOT EXISTS proposed_by INTEGER REFERENCES players(id)",
        """DO $$ BEGIN
             IF EXISTS (SELECT 1 FROM information_schema.columns
                        WHERE table_name='club_shelf' AND column_name='added_by')
             THEN UPDATE club_shelf SET proposed_by = added_by WHERE proposed_by IS NULL AND added_by IS NOT NULL;
                  ALTER TABLE club_shelf DROP COLUMN added_by;
             END IF;
           END $$""",

        # sessions: hora fin y parte a comentar
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS end_time VARCHAR",
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS part_to_discuss TEXT",

        # channel_members: hasta cuándo ha leído cada jugador ese canal (indicador de no leído)
        "ALTER TABLE channel_members ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP",

        # players: foto de perfil subida (sustituye al emoji si está presente)
        "ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_url VARCHAR",

        # players: aprobación de cuenta + pertenencia al club (app de admin).
        # Los defaults protegen a las cuentas ya existentes (quedan aprobadas
        # y con acceso al club, sin cambio de comportamiento); los registros
        # nuevos fijan explícitamente 'pending'/false en el INSERT.
        "ALTER TABLE players ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'approved'",
        "ALTER TABLE players ADD COLUMN IF NOT EXISTS club_member BOOLEAN NOT NULL DEFAULT true",
    ]
    with engine.connect() as conn:
        for stmt in stmts:
            conn.execute(text(stmt))
        conn.commit()

    # La tabla club_reading_logs se crea sola con create_all (modelo nuevo)


def _seed_channels():
    """Crea el canal general del club y añade todos los jugadores."""
    db = next(get_db())
    general = db.query(Channel).filter(Channel.name == "club-general").first()
    if not general:
        general = Channel(name="club-general", type="group")
        db.add(general)
        db.flush()
    players = db.query(Player).all()
    for p in players:
        exists = db.query(ChannelMember).filter_by(channel_id=general.id, player_id=p.id).first()
        if not exists:
            db.add(ChannelMember(channel_id=general.id, player_id=p.id))
    db.commit()
    db.close()


def _seed_shop_items():
    """Precarga en BD los fondos de pantalla que antes venían hardcodeados en
    el frontend — idempotente, no hace nada si ya hay fondos guardados."""
    db = next(get_db())
    if db.query(ShopItem).filter_by(type="wallpaper").count() == 0:
        defaults = [
            ("default",  "Noche púrpura",   "radial-gradient(ellipse at 30% 20%, #1a1040 0%, #0a0a14 60%)"),
            ("ocean",    "Océano profundo", "radial-gradient(ellipse at 70% 30%, #0c1a3a 0%, #060d1f 60%)"),
            ("forest",   "Bosque nocturno", "radial-gradient(ellipse at 20% 80%, #0a2010 0%, #060f08 60%)"),
            ("ember",    "Brasas",          "radial-gradient(ellipse at 80% 20%, #2a0f00 0%, #0f0500 60%)"),
            ("galaxy",   "Galaxia",         "radial-gradient(ellipse at 50% 50%, #1a0a2e 0%, #06030f 70%)"),
            ("midnight", "Medianoche",      "linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 100%)"),
            ("teal",     "Abismo teal",     "radial-gradient(ellipse at 40% 60%, #041a18 0%, #020d0c 70%)"),
            ("rose",     "Rosa oscuro",     "radial-gradient(ellipse at 60% 40%, #2a0a1a 0%, #0f0308 70%)"),
        ]
        for item_id, label, bg in defaults:
            db.add(ShopItem(type="wallpaper", item_id=item_id, label=label, data={"bg": bg}, price=0))
        db.commit()
    db.close()


def _add_player_to_general(player_id: int, db):
    general = db.query(Channel).filter(Channel.name == "club-general").first()
    if general:
        exists = db.query(ChannelMember).filter_by(channel_id=general.id, player_id=player_id).first()
        if not exists:
            db.add(ChannelMember(channel_id=general.id, player_id=player_id))


def require_club_member(current: Player = Depends(get_current_player)) -> Player:
    """Dependency para endpoints de Club/sesiones/DM — quien no es miembro del
    club no debe poder acceder aunque conozca la URL (defensa en profundidad,
    además de ocultarse en el frontend)."""
    if not current.club_member:
        raise HTTPException(status_code=403, detail="Esto es solo para miembros del club de lectura")
    return current


# ── Auth ────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    player_id: int
    pin: str

@app.post("/auth/login")
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    player = db.query(Player).filter(Player.id == body.player_id).first()
    if not player or not verify_pin(body.pin, player.pin_hash):
        raise HTTPException(status_code=401, detail="PIN incorrecto")
    if player.status == "pending":
        raise HTTPException(status_code=403, detail="Tu cuenta está pendiente de aprobación.")
    if player.status == "rejected":
        raise HTTPException(status_code=403, detail="Tu solicitud de acceso fue rechazada.")
    token = create_token(player.id)
    response.set_cookie(
        "luni_token", token,
        httponly=True, samesite="lax", max_age=60 * 60 * 24 * 30
    )
    return {"token": token, "player": _player_out(player)}

@app.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie("luni_token")
    return {"ok": True}

@app.get("/auth/me")
def me(player: Player = Depends(get_current_player)):
    return _player_out(player)

class RegisterRequest(BaseModel):
    name:        str
    pin:         str
    color:       str = "#60a5fa"
    avatar_emoji: str = "⭐"

@app.post("/auth/register")
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    name = body.name.strip()
    if not name or len(name) > 30:
        raise HTTPException(422, "Nombre inválido")
    if db.query(Player).filter(Player.name == name).first():
        raise HTTPException(400, "Ese nombre ya está en uso")
    if not body.pin.isdigit() or not (4 <= len(body.pin) <= 8):
        raise HTTPException(422, "El PIN debe tener entre 4 y 8 dígitos")

    # Cuenta pendiente de aprobación por el admin — sin acceso a nada todavía:
    # no se emite cookie/token, no se une a #club-general y no se avisa por WS
    # a nadie (eso ocurre cuando el admin la apruebe, ver PATCH /admin/players).
    player = Player(
        name=name, pin_hash=hash_pin(body.pin),
        color=body.color, avatar_emoji=body.avatar_emoji,
        customization={}, status="pending", club_member=False,
    )
    db.add(player)
    db.commit()

    return {"pending": True, "message": "Cuenta creada. Un admin tiene que aprobarla antes de que puedas entrar."}


# ── Players ─────────────────────────────────────────────────────────────────

class CustomizationUpdate(BaseModel):
    customization: dict

@app.patch("/players/{player_id}/customization")
def update_customization(
    player_id: int,
    body: CustomizationUpdate,
    db: Session = Depends(get_db),
    current: Player = Depends(get_current_player),
):
    if current.id != player_id:
        raise HTTPException(status_code=403, detail="Solo puedes editar tu propio personaje")
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    player.customization = body.customization
    db.commit()
    db.refresh(player)
    return _player_out(player)


@app.get("/players")
def list_players(db: Session = Depends(get_db)):
    """Público — necesario para la pantalla de login. Solo cuentas aprobadas:
    una pendiente/rechazada no debe ni aparecer como opción para entrar."""
    return [_player_out(p) for p in db.query(Player).filter(Player.status == "approved").all()]


# ── Administración (app "Admin", solo wander) ────────────────────────────────

def require_admin(current: Player = Depends(get_current_player)) -> Player:
    if current.name.lower() != "wander":
        raise HTTPException(status_code=403, detail="Solo el admin puede hacer esto")
    return current

def _admin_player_out(p: Player) -> dict:
    return {
        "id":          p.id,
        "name":        p.name,
        "avatar_emoji": p.avatar_emoji,
        "avatar_url":  p.avatar_url,
        "color":       p.color,
        "status":      p.status,
        "club_member": p.club_member,
        "created_at":  p.created_at.isoformat() + "Z" if p.created_at else None,
    }

@app.get("/admin/players")
def admin_list_players(db: Session = Depends(get_db), _: Player = Depends(require_admin)):
    """Todos los jugadores (cualquier status), para las pestañas Pendientes/Jugadores del panel."""
    players = db.query(Player).order_by(Player.created_at.desc()).all()
    return [_admin_player_out(p) for p in players]

class AdminPlayerUpdate(BaseModel):
    status:      Optional[str]  = None   # approved | rejected
    club_member: Optional[bool] = None

@app.patch("/admin/players/{player_id}")
def admin_update_player(
    player_id: int,
    body: AdminPlayerUpdate,
    db: Session = Depends(get_db),
    _: Player = Depends(require_admin),
):
    player = db.query(Player).filter(Player.id == player_id).first()
    if not player:
        raise HTTPException(404, "Jugador no encontrado")

    if body.status is not None:
        if body.status not in ("approved", "rejected"):
            raise HTTPException(422, "Estado inválido")
        player.status = body.status

    if body.club_member is not None:
        player.club_member = body.club_member

    # Si queda aprobado y con acceso al club (ya sea por esta llamada o por
    # una anterior), asegurar que esté en #club-general — igual que hacía el
    # registro automáticamente antes de exigir aprobación.
    if player.status == "approved" and player.club_member:
        _add_player_to_general(player.id, db)

    db.commit()
    db.refresh(player)
    return _admin_player_out(player)


class DeleteAccountRequest(BaseModel):
    pin: str

@app.delete("/players/me")
def delete_account(
    body: DeleteAccountRequest,
    response: Response,
    db: Session = Depends(get_db),
    current: Player = Depends(get_current_player),
):
    player = db.query(Player).filter(Player.id == current.id).first()
    if not verify_pin(body.pin, player.pin_hash):
        raise HTTPException(401, "PIN incorrecto")

    # Los mensajes quedan en BD con player_id = NULL (SET NULL)
    # Limpiar membresías, shelf, votos
    from database import ChannelMember, PersonalShelf, Vote, ClubShelf, ClubReadingLog
    db.query(ChannelMember).filter(ChannelMember.player_id == player.id).delete()
    db.query(PersonalShelf).filter(PersonalShelf.player_id == player.id).delete()
    db.query(ClubReadingLog).filter(ClubReadingLog.player_id == player.id).delete()
    db.query(Vote).filter(Vote.player_id == player.id).delete()
    db.query(ClubShelf).filter(ClubShelf.proposed_by == player.id).update({"proposed_by": None})

    db.delete(player)
    db.commit()

    response.delete_cookie("luni_token")
    return {"ok": True}

class ProfileUpdate(BaseModel):
    name:         Optional[str] = None
    color:        Optional[str] = None
    avatar_emoji: Optional[str] = None

@app.patch("/players/me/profile")
def update_profile(
    body: ProfileUpdate,
    db: Session = Depends(get_db),
    current: Player = Depends(get_current_player),
):
    player = db.query(Player).filter(Player.id == current.id).first()
    if body.name is not None:
        new_name = body.name.strip()
        if not new_name:
            raise HTTPException(422, "El nombre no puede estar vacío")
        exists = db.query(Player).filter(
            func.lower(Player.name) == new_name.lower(), Player.id != player.id
        ).first()
        if exists:
            raise HTTPException(409, "Ya hay un jugador con ese nombre")
        player.name = new_name
    if body.color:
        player.color = body.color
    if body.avatar_emoji:
        # Elegir un icono del sistema sustituye a la foto subida, si había una.
        player.avatar_emoji = body.avatar_emoji
        player.avatar_url   = None
    db.commit()
    db.refresh(player)
    return _player_out(player)

_AVATAR_UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads', 'avatars')
os.makedirs(_AVATAR_UPLOAD_DIR, exist_ok=True)

@app.post("/players/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: Player = Depends(get_current_player),
):
    player = db.query(Player).filter(Player.id == current.id).first()
    ext = os.path.splitext(file.filename or '')[1].lower()
    if ext not in ('.jpg', '.jpeg', '.png', '.webp', '.gif'):
        ext = '.jpg'
    filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(_AVATAR_UPLOAD_DIR, filename), 'wb') as f:
        shutil.copyfileobj(file.file, f)
    player.avatar_url = f"/uploads/avatars/{filename}"
    db.commit()
    db.refresh(player)
    return _player_out(player)

@app.delete("/players/me/avatar")
def remove_avatar(
    db: Session = Depends(get_db),
    current: Player = Depends(get_current_player),
):
    player = db.query(Player).filter(Player.id == current.id).first()
    player.avatar_url = None
    db.commit()
    db.refresh(player)
    return _player_out(player)


# ── Pirestore ────────────────────────────────────────────────────────────────

_WALLPAPER_UPLOAD_DIR = os.path.join(os.path.dirname(__file__), 'uploads', 'wallpapers')
os.makedirs(_WALLPAPER_UPLOAD_DIR, exist_ok=True)

# Requisitos de las imágenes de fondo de pantalla que sube el admin.
_WALLPAPER_MAX_BYTES = 5 * 1024 * 1024   # 5 MB
_WALLPAPER_MIN_W      = 1280              # HD — por debajo se ve pixelado al cubrir pantallas grandes
_WALLPAPER_MIN_H      = 720
_WALLPAPER_MAX_W      = 2560              # se reescala hacia abajo si la imagen es más ancha
_WALLPAPER_EXTS = {'.jpg': 'JPEG', '.jpeg': 'JPEG', '.png': 'PNG', '.webp': 'WEBP'}

def _slugify(s: str) -> str:
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode('ascii')
    s = re.sub(r'[^a-zA-Z0-9]+', '-', s).strip('-').lower()
    return s or uuid.uuid4().hex[:8]

def _shop_item_out(i: ShopItem) -> dict:
    return {
        "id":      i.id,
        "type":    i.type,
        "item_id": i.item_id,
        "label":   i.label,
        "data":    i.data,
        "price":   i.price,
    }

@app.get("/shop/items")
def list_shop_items(
    type: Optional[str] = None,
    db: Session = Depends(get_db),
    current: Player = Depends(get_current_player),
):
    q = db.query(ShopItem)
    if type:
        q = q.filter(ShopItem.type == type)
    return [_shop_item_out(i) for i in q.order_by(ShopItem.created_at).all()]

class ShopItemCreate(BaseModel):
    type:    str
    item_id: str
    label:   str
    data:    dict

@app.post("/shop/items")
def create_shop_item(
    body: ShopItemCreate,
    db: Session = Depends(get_db),
    current: Player = Depends(get_current_player),
):
    """Solo el admin (wander) puede añadir contenido al catálogo de Pirestore."""
    if current.name.lower() != "wander":
        raise HTTPException(403, "Solo el admin puede gestionar la tienda")
    item_id = body.item_id.strip()
    label   = body.label.strip()
    if not item_id or not label:
        raise HTTPException(422, "Faltan campos")
    exists = db.query(ShopItem).filter_by(type=body.type, item_id=item_id).first()
    if exists:
        raise HTTPException(409, "Ya hay un item con ese identificador para ese tipo")
    item = ShopItem(type=body.type, item_id=item_id, label=label, data=body.data, price=0)
    db.add(item)
    db.commit()
    db.refresh(item)
    return _shop_item_out(item)

@app.post("/shop/items/wallpaper-image")
async def upload_wallpaper_image(
    label: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: Player = Depends(get_current_player),
):
    """Solo el admin (wander): sube una imagen como fondo de pantalla nuevo.
    Requisitos: JPG/PNG/WEBP, máx. 5 MB, mínimo 1280x720px — se reescala si
    es más ancha de 2560px para no acumular archivos innecesariamente pesados."""
    if current.name.lower() != "wander":
        raise HTTPException(403, "Solo el admin puede gestionar la tienda")
    label = label.strip()
    if not label:
        raise HTTPException(422, "Falta el nombre")

    ext = os.path.splitext(file.filename or '')[1].lower()
    if ext not in _WALLPAPER_EXTS:
        raise HTTPException(422, "Formato no soportado — usa JPG, PNG o WEBP")

    content = await file.read()
    if len(content) > _WALLPAPER_MAX_BYTES:
        raise HTTPException(422, "La imagen pesa demasiado (máximo 5 MB)")

    try:
        img = Image.open(BytesIO(content))
        img.load()
    except Exception:
        raise HTTPException(422, "El archivo no es una imagen válida")

    w, h = img.size
    if w < _WALLPAPER_MIN_W or h < _WALLPAPER_MIN_H:
        raise HTTPException(422, f"La imagen es demasiado pequeña (mínimo {_WALLPAPER_MIN_W}x{_WALLPAPER_MIN_H}px, esta es {w}x{h}px)")

    save_format = _WALLPAPER_EXTS[ext]
    if save_format == "JPEG":
        img = img.convert("RGB")
    if w > _WALLPAPER_MAX_W:
        new_h = round(h * _WALLPAPER_MAX_W / w)
        img = img.resize((_WALLPAPER_MAX_W, new_h), Image.LANCZOS)

    item_id = _slugify(label)
    if db.query(ShopItem).filter_by(type="wallpaper", item_id=item_id).first():
        raise HTTPException(409, "Ya hay un fondo con ese nombre")

    filename = f"{uuid.uuid4().hex}{ext}"
    save_kwargs = {"quality": 88} if save_format == "JPEG" else {}
    img.save(os.path.join(_WALLPAPER_UPLOAD_DIR, filename), format=save_format, **save_kwargs)

    item = ShopItem(
        type="wallpaper", item_id=item_id, label=label,
        data={"image_url": f"/uploads/wallpapers/{filename}"}, price=0,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _shop_item_out(item)

@app.delete("/shop/items/{id}")
def delete_shop_item(
    id: int,
    db: Session = Depends(get_db),
    current: Player = Depends(get_current_player),
):
    """Solo el admin (wander) puede quitar contenido del catálogo de Pirestore."""
    if current.name.lower() != "wander":
        raise HTTPException(403, "Solo el admin puede gestionar la tienda")
    item = db.query(ShopItem).filter(ShopItem.id == id).first()
    if not item:
        raise HTTPException(404, "Item no encontrado")
    db.delete(item)
    db.commit()
    return {"ok": True}

class PinChange(BaseModel):
    current_pin: str
    new_pin:     str

@app.patch("/players/me/pin")
def change_pin(
    body: PinChange,
    db: Session = Depends(get_db),
    current: Player = Depends(get_current_player),
):
    player = db.query(Player).filter(Player.id == current.id).first()
    if not verify_pin(body.current_pin, player.pin_hash):
        raise HTTPException(status_code=401, detail="PIN actual incorrecto")
    if not body.new_pin.isdigit() or not (4 <= len(body.new_pin) <= 8):
        raise HTTPException(status_code=422, detail="El nuevo PIN debe tener entre 4 y 8 dígitos")
    player.pin_hash = hash_pin(body.new_pin)
    db.commit()
    return {"ok": True}


# ── Books — Open Library proxy ───────────────────────────────────────────────

class BookUpdateRequest(BaseModel):
    title:     Optional[str] = None
    author:    Optional[str] = None
    genre:     Optional[str] = None
    synopsis:  Optional[str] = None
    cover_url: Optional[str] = None

@app.patch("/books/{book_id}")
def update_book(
    book_id: int,
    body: BookUpdateRequest,
    db: Session = Depends(get_db),
    current: Player = Depends(get_current_player),
):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Libro no encontrado")
    if body.title     is not None: book.title     = body.title.strip()
    if body.author    is not None: book.author    = body.author.strip()
    if body.genre     is not None: book.genre     = body.genre.strip()
    if body.synopsis  is not None: book.synopsis  = body.synopsis.strip()
    if body.cover_url is not None: book.cover_url = body.cover_url.strip() or None
    db.commit()
    db.refresh(book)
    return _book_out(book)


@app.post("/books/{book_id}/cover")
async def upload_cover(
    book_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: Player = Depends(get_current_player),
):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(404, "Libro no encontrado")
    ext = os.path.splitext(file.filename or '')[1].lower()
    if ext not in ('.jpg', '.jpeg', '.png', '.webp', '.gif'):
        ext = '.jpg'
    filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(_UPLOAD_DIR, filename), 'wb') as f:
        shutil.copyfileobj(file.file, f)
    book.cover_url = f"/uploads/covers/{filename}"
    db.commit()
    db.refresh(book)
    return _book_out(book)


@app.get("/books/{book_id}/covers")
async def get_book_covers(
    book_id: int,
    db: Session = Depends(get_db),
    _: Player = Depends(get_current_player),
):
    """Devuelve URLs de portadas disponibles para el libro (desde ediciones de Open Library)."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(404, "Libro no encontrado")

    seen, covers = set(), []

    def add(url):
        if url and url not in seen:
            seen.add(url); covers.append(url)

    if book.cover_url:
        add(book.cover_url)

    if book.open_lib_key:
        clean = book.open_lib_key.lstrip('/')
        async with httpx.AsyncClient() as client:
            try:
                r = await client.get(
                    f"https://openlibrary.org/{clean}/editions.json",
                    params={"limit": 30}, timeout=10,
                )
                if r.status_code == 200:
                    for entry in r.json().get("entries", []):
                        for cid in (entry.get("covers") or []):
                            if cid > 0:
                                add(f"https://covers.openlibrary.org/b/id/{cid}-M.jpg")
                            if len(covers) >= 16:
                                break
                        if len(covers) >= 16:
                            break
            except Exception:
                pass

    if book.isbn:
        add(f"https://covers.openlibrary.org/b/isbn/{book.isbn}-M.jpg")

    return {"covers": covers}


@app.get("/books/search")
async def search_books(q: str, _: Player = Depends(get_current_player)):
    if len(q.strip()) < 3:
        raise HTTPException(status_code=400, detail="Escribe al menos 3 caracteres para buscar")
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(
                "https://openlibrary.org/search.json",
                params={
                    "q": q, "limit": 10,
                    "fields": "key,title,author_name,isbn,cover_i,number_of_pages_median,first_publish_year,subject",
                },
                timeout=10,
            )
        except Exception:
            raise HTTPException(status_code=502, detail="No se pudo contactar con Open Library")
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="Open Library no disponible")
    docs = r.json().get("docs", [])
    return [
        {
            "open_lib_key": d.get("key"),
            "title":        d.get("title"),
            "author":       (d.get("author_name") or [""])[0],
            "isbn":         (d.get("isbn") or [None])[0],
            "cover_url":    f"https://covers.openlibrary.org/b/id/{d['cover_i']}-M.jpg"
                            if d.get("cover_i") else None,
            "num_pages":    d.get("number_of_pages_median"),
            "year":         d.get("first_publish_year"),
            "genre":        _pick_genre(d.get("subject") or []),
        }
        for d in docs
    ]

@app.get("/books/isbn/{isbn}")
async def book_by_isbn(isbn: str, _: Player = Depends(get_current_player)):
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data",
            timeout=10,
        )
    data = r.json().get(f"ISBN:{isbn}", {})
    if not data:
        raise HTTPException(status_code=404, detail="ISBN no encontrado")
    cover = data.get("cover", {})
    return {
        "title":     data.get("title"),
        "author":    (data.get("authors") or [{}])[0].get("name"),
        "cover_url": cover.get("medium") or cover.get("small"),
        "isbn":      isbn,
        "num_pages": data.get("number_of_pages"),
        "year":      (data.get("publish_date") or "")[:4] or None,
    }

@app.get("/books/synopsis/{open_lib_key:path}")
async def book_synopsis(open_lib_key: str, _: Player = Depends(get_current_player)):
    """Obtiene la sinopsis de Open Library. Clave tiene formato /works/OL123W"""
    # Si ya está en BD, devolvemos la guardada
    # (el frontend usa esto solo cuando el campo synopsis está vacío)
    clean = open_lib_key.lstrip('/')
    url = f"https://openlibrary.org/{clean}.json"
    async with httpx.AsyncClient() as client:
        r = await client.get(url, timeout=10)
    if r.status_code != 200:
        raise HTTPException(502, "Open Library no disponible")
    data = r.json()
    desc = data.get("description")
    if isinstance(desc, dict):
        desc = desc.get("value")
    return {"synopsis": desc or None}


# ── Personal shelf ───────────────────────────────────────────────────────────

class ShelfAddRequest(BaseModel):
    open_lib_key:   Optional[str]   = None
    title:          str
    author:         Optional[str]   = None
    cover_url:      Optional[str]   = None
    isbn:           Optional[str]   = None
    num_pages:      Optional[int]   = None
    synopsis:       Optional[str]   = None
    year:           Optional[int]   = None
    genre:          Optional[str]   = None
    status:         str             = "want_to_read"   # reading | read | want_to_read
    # Club-specific (ignored by personal shelf)
    initial_status: str             = "proposed"       # proposed | finished (admin only for finished)
    read_date:      Optional[str]   = None
    club_notes:     Optional[str]   = None

class ShelfUpdateRequest(BaseModel):
    status:             Optional[str]   = None
    progress:           Optional[float] = None
    current_page:       Optional[int]   = None
    custom_total_pages: Optional[int]   = None
    folder:             Optional[str]   = None
    rating:             Optional[float] = None   # 0.5-5.0
    notes:              Optional[str]   = None
    started_at:         Optional[str]   = None
    finished_at:        Optional[str]   = None
    sort_order:         Optional[int]   = None

@app.get("/shelf/personal")
def get_personal_shelf(
    player_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current: Player = Depends(get_current_player),
):
    target_id = player_id or current.id
    entries = (
        db.query(PersonalShelf)
        .filter(PersonalShelf.player_id == target_id)
        .all()
    )
    return [_shelf_entry_out(e, hide_notes=(target_id != current.id)) for e in entries]

def _log_activity(db, player_id: int, book_id: int, event_type: str, rating: float = None):
    db.add(Activity(player_id=player_id, book_id=book_id, event_type=event_type, rating=rating))

@app.post("/shelf/personal")
def add_to_personal_shelf(
    body: ShelfAddRequest,
    db: Session = Depends(get_db),
    current: Player = Depends(get_current_player),
):
    book = _get_or_create_book(db, body)
    existing = db.query(PersonalShelf).filter_by(
        player_id=current.id, book_id=book.id
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="El libro ya está en tu estantería")
    # sort_order: al final de la estantería actual
    max_order = db.query(PersonalShelf).filter_by(player_id=current.id).count()
    entry = PersonalShelf(
        player_id=current.id, book_id=book.id,
        status=body.status, sort_order=max_order,
    )
    db.add(entry)
    _log_activity(db, current.id, book.id, 'added')
    if body.status == 'reading':
        _log_activity(db, current.id, book.id, 'started')
    elif body.status == 'read':
        _log_activity(db, current.id, book.id, 'finished')
    db.commit()
    db.refresh(entry)
    return _shelf_entry_out(entry)

class BulkShelfRequest(BaseModel):
    # Cada libro es un dict suelto (no un modelo tipado) a propósito: así un
    # campo con el tipo equivocado en un libro no invalida el envío entero
    # (Pydantic rechazaría todo el body de golpe antes de llegar al endpoint)
    # — se valida y convierte a mano dentro del bucle, libro a libro.
    books: list[dict]

def _parse_bulk_date(s, field: str):
    if not s:
        return None
    try:
        return datetime.fromisoformat(str(s))
    except ValueError:
        raise ValueError(f'"{field}" no es una fecha válida (usa AAAA-MM-DD)')

def _parse_bulk_int(v, field: str):
    if v in (None, ""):
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        raise ValueError(f'"{field}" debe ser un número')

def _parse_bulk_float(v, field: str):
    if v in (None, ""):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        raise ValueError(f'"{field}" debe ser un número')

@app.post("/shelf/personal/bulk")
def bulk_add_personal_shelf(
    body: BulkShelfRequest,
    db: Session = Depends(get_db),
    current: Player = Depends(get_current_player),
):
    """Importación masiva a la estantería personal (p.ej. migrando desde otra
    app) — cada libro se procesa y confirma por separado, así que un error en
    uno no deshace los que ya se guardaron antes en el mismo envío."""
    results = []
    next_order = db.query(PersonalShelf).filter_by(player_id=current.id).count()
    for i, raw in enumerate(body.books):
        title = ""
        try:
            if not isinstance(raw, dict):
                raise ValueError("Cada libro debe ser un objeto JSON ({\"title\": ...})")
            title = str(raw.get("title") or "").strip()
            if not title:
                raise ValueError("Falta el título")
            status = raw.get("status") or "want_to_read"
            if status not in ("want_to_read", "reading", "read"):
                raise ValueError('"status" debe ser want_to_read, reading o read')

            rating       = _parse_bulk_float(raw.get("rating"), "rating")
            if rating is not None and not (0 <= rating <= 5):
                raise ValueError('"rating" debe estar entre 0 y 5')
            year         = _parse_bulk_int(raw.get("year"), "year")
            num_pages    = _parse_bulk_int(raw.get("num_pages"), "num_pages")
            current_page = _parse_bulk_int(raw.get("current_page"), "current_page")
            started_at   = _parse_bulk_date(raw.get("started_at"), "started_at")
            finished_at  = _parse_bulk_date(raw.get("finished_at"), "finished_at")
            folder = raw.get("folder")
            folder = folder.strip() if isinstance(folder, str) and folder.strip() else None

            book = Book(
                title=title,
                author=raw.get("author") or None,
                cover_url=raw.get("cover_url") or None,
                isbn=raw.get("isbn") or None,
                num_pages=num_pages,
                synopsis=raw.get("synopsis") or None,
                year=year,
                genre=raw.get("genre") or None,
            )
            db.add(book)
            db.flush()

            progress = 1.0 if status == "read" else 0.0
            if current_page and num_pages:
                progress = min(current_page / num_pages, 1.0)

            entry = PersonalShelf(
                player_id=current.id, book_id=book.id, status=status,
                rating=rating, current_page=current_page, progress=progress,
                folder=folder, notes=raw.get("notes") or None,
                started_at=started_at, finished_at=finished_at,
                sort_order=next_order,
            )
            db.add(entry)
            next_order += 1

            _log_activity(db, current.id, book.id, "added")
            if status == "reading":
                _log_activity(db, current.id, book.id, "started")
            elif status == "read":
                _log_activity(db, current.id, book.id, "finished", rating=rating)

            db.commit()
            results.append({"index": i, "ok": True, "title": title})
        except Exception as e:
            db.rollback()
            results.append({"index": i, "ok": False, "title": title or f"(libro {i + 1})", "error": str(e)})
    return {"results": results}

@app.patch("/shelf/personal/{entry_id}")
def update_personal_shelf(
    entry_id: int,
    body: ShelfUpdateRequest,
    db: Session = Depends(get_db),
    current: Player = Depends(get_current_player),
):
    entry = db.query(PersonalShelf).filter(PersonalShelf.id == entry_id).first()
    if not entry or entry.player_id != current.id:
        raise HTTPException(status_code=404, detail="Entrada no encontrada")
    old_status = entry.status
    if body.status             is not None: entry.status             = body.status
    if body.progress           is not None: entry.progress           = body.progress
    if body.rating             is not None: entry.rating             = body.rating
    if body.notes              is not None: entry.notes              = body.notes
    if body.started_at         is not None: entry.started_at         = body.started_at
    if body.finished_at        is not None: entry.finished_at        = body.finished_at
    if body.sort_order         is not None: entry.sort_order         = body.sort_order
    if body.current_page       is not None: entry.current_page       = body.current_page
    if body.custom_total_pages is not None: entry.custom_total_pages = body.custom_total_pages
    if body.folder             is not None: entry.folder             = body.folder or None
    # Recalcular progress cuando se actualizan páginas
    total = entry.custom_total_pages or (entry.book.num_pages if entry.book else None)
    if total and entry.current_page is not None:
        entry.progress = min(entry.current_page / total, 1.0)
    # Registrar actividad al cambiar estado
    if body.status and body.status != old_status:
        if body.status == 'reading':
            _log_activity(db, current.id, entry.book_id, 'started')
        elif body.status == 'read':
            _log_activity(db, current.id, entry.book_id, 'finished', rating=entry.rating)
    db.commit()
    db.refresh(entry)
    return _shelf_entry_out(entry)

@app.delete("/shelf/personal/{entry_id}")
def delete_personal_shelf(
    entry_id: int,
    db: Session = Depends(get_db),
    current: Player = Depends(get_current_player),
):
    entry = db.query(PersonalShelf).filter(PersonalShelf.id == entry_id).first()
    if not entry or entry.player_id != current.id:
        raise HTTPException(status_code=404, detail="Entrada no encontrada")
    db.delete(entry)
    db.commit()
    return {"ok": True}


# ── Activity feed ─────────────────────────────────────────────────────────────

@app.get("/activity/feed")
def get_activity_feed(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current: Player = Depends(get_current_player),
):
    # La actividad es "cosa del club" — un jugador sin club_member no genera
    # entradas para nadie (ni para sí mismo), su estantería personal sigue
    # intacta, solo no aparece en este feed.
    activities = (
        db.query(Activity)
        .join(Player, Activity.player_id == Player.id)
        .filter(Player.club_member == True)  # noqa: E712
        .order_by(Activity.created_at.desc(), Activity.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    total = (
        db.query(Activity)
        .join(Player, Activity.player_id == Player.id)
        .filter(Player.club_member == True)  # noqa: E712
        .count()
    )
    return {
        "items": [
            {
                "id":         a.id,
                "event_type": a.event_type,
                "rating":     a.rating,
                "created_at": a.created_at.isoformat() + 'Z' if a.created_at else None,
                "player":     _player_out(a.player),
                "book":       _book_out(a.book),
            }
            for a in activities
        ],
        "total":    total,
        "has_more": offset + limit < total,
    }


# ── Rankings ─────────────────────────────────────────────────────────────────

@app.get("/shelf/rankings")
def get_rankings(
    db: Session = Depends(get_db),
    current: Player = Depends(get_current_player),
):
    players = db.query(Player).all()
    result = []
    for p in players:
        entries = db.query(PersonalShelf).filter_by(player_id=p.id).all()
        books_read = sum(1 for e in entries if e.status == 'read')
        pages_read = 0
        for e in entries:
            if e.current_page is not None:
                pages_read += e.current_page
            elif e.progress and e.book:
                total = e.custom_total_pages or e.book.num_pages
                if total:
                    pages_read += int(e.progress * total)
        result.append({
            "player":     _player_out(p),
            "books_read": books_read,
            "pages_read": pages_read,
        })
    return result


# ── Club shelf ───────────────────────────────────────────────────────────────

@app.get("/shelf/club")
def get_club_shelf(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current: Player = Depends(require_club_member),
):
    """Devuelve todos los libros del club. Filtrable por status: proposed|active|finished."""
    q = db.query(ClubShelf)
    if status:
        q = q.filter(ClubShelf.status == status)
    entries = q.order_by(ClubShelf.added_at).all()
    return [_club_entry_out(e, current.id) for e in entries]

@app.post("/shelf/club")
def propose_club_book(
    body: ShelfAddRequest,
    db: Session = Depends(get_db),
    current: Player = Depends(require_club_member),
):
    """Cualquier usuario puede proponer. El admin puede añadir directamente como 'finished'."""
    is_admin = current.name.lower() == "wander"
    initial  = body.initial_status if is_admin else "proposed"
    if initial not in ("proposed", "finished"):
        initial = "proposed"

    book = _get_or_create_book(db, body)
    existing = db.query(ClubShelf).filter_by(book_id=book.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="El libro ya está en la estantería del club")

    read_date = None
    if body.read_date:
        try:
            read_date = datetime.fromisoformat(body.read_date)
        except ValueError:
            pass

    entry = ClubShelf(
        book_id=book.id, proposed_by=current.id, status=initial,
        read_date=read_date or (datetime.now(timezone.utc) if initial == "finished" else None),
        club_notes=body.club_notes,
    )
    db.add(entry)
    _log_activity(db, current.id, book.id, 'proposed')
    db.commit()
    db.refresh(entry)
    return _club_entry_out(entry, current.id)

class ClubStatusUpdate(BaseModel):
    status:     str               # proposed | active | finished
    club_notes: Optional[str] = None

@app.patch("/shelf/club/{entry_id}/status")
def update_club_book_status(
    entry_id: int,
    body: ClubStatusUpdate,
    db: Session = Depends(get_db),
    current: Player = Depends(require_club_member),
):
    """Solo el admin (wander) puede activar o finalizar libros del club."""
    if current.name.lower() != "wander":
        raise HTTPException(403, "Solo el admin puede cambiar el estado de los libros del club")
    entry = db.query(ClubShelf).filter(ClubShelf.id == entry_id).first()
    if not entry:
        raise HTTPException(404, "No encontrado")
    if body.status not in ("proposed", "active", "finished"):
        raise HTTPException(422, "Estado inválido")
    if body.status == "active":
        db.query(ClubShelf).filter(
            ClubShelf.status == "active", ClubShelf.id != entry_id
        ).update({"status": "proposed"})
    entry.status = body.status
    if body.status == "active" and not entry.activated_at:
        entry.activated_at = datetime.now(timezone.utc)
    if body.status == "finished" and not entry.read_date:
        entry.read_date = datetime.now(timezone.utc)
    if body.club_notes is not None:
        entry.club_notes = body.club_notes
    db.commit()
    db.refresh(entry)
    return _club_entry_out(entry, current.id)

class ClubEntryUpdateRequest(BaseModel):
    activated_at: Optional[str] = None
    read_date:    Optional[str] = None
    club_notes:   Optional[str] = None
    proposed_by:  Optional[int] = None

@app.patch("/shelf/club/{entry_id}")
def update_club_entry(
    entry_id: int,
    body: ClubEntryUpdateRequest,
    db: Session = Depends(get_db),
    current: Player = Depends(require_club_member),
):
    """Admin puede editar fechas, notas y proposer de un libro del club."""
    if current.name.lower() != "wander":
        raise HTTPException(403, "Solo el admin puede editar entradas del club")
    entry = db.query(ClubShelf).filter(ClubShelf.id == entry_id).first()
    if not entry:
        raise HTTPException(404, "No encontrado")
    if body.activated_at is not None:
        entry.activated_at = datetime.fromisoformat(body.activated_at) if body.activated_at else None
    if body.read_date is not None:
        entry.read_date = datetime.fromisoformat(body.read_date) if body.read_date else None
    if body.club_notes is not None:
        entry.club_notes = body.club_notes or None
    if body.proposed_by is not None:
        player = db.query(Player).filter(Player.id == body.proposed_by).first()
        if player:
            entry.proposed_by = body.proposed_by
    db.commit()
    db.refresh(entry)
    return _club_entry_out(entry, current.id)

@app.delete("/shelf/club/{entry_id}")
def delete_club_book(
    entry_id: int,
    db: Session = Depends(get_db),
    current: Player = Depends(require_club_member),
):
    """Solo el admin puede borrar libros del club."""
    if current.name.lower() != "wander":
        raise HTTPException(403, "Solo el admin puede borrar libros del club")
    entry = db.query(ClubShelf).filter(ClubShelf.id == entry_id).first()
    if not entry:
        raise HTTPException(404, "No encontrado")
    db.delete(entry)
    db.commit()
    return {"ok": True}


# ── Club reading logs ─────────────────────────────────────────────────────────

class ClubLogUpsert(BaseModel):
    started_at:  Optional[str]   = None
    finished_at: Optional[str]   = None
    rating:      Optional[float] = None   # 0.5-5.0
    notes:       Optional[str]   = None

@app.get("/shelf/club/{entry_id}/my-log")
def get_my_club_log(
    entry_id: int,
    db: Session = Depends(get_db),
    current: Player = Depends(require_club_member),
):
    log = db.query(ClubReadingLog).filter_by(
        club_shelf_id=entry_id, player_id=current.id
    ).first()
    return _club_log_out(log) if log else None

@app.put("/shelf/club/{entry_id}/my-log")
def upsert_my_club_log(
    entry_id: int,
    body: ClubLogUpsert,
    db: Session = Depends(get_db),
    current: Player = Depends(require_club_member),
):
    """Crea o actualiza el registro de lectura personal del usuario sobre un libro del club."""
    entry = db.query(ClubShelf).filter(ClubShelf.id == entry_id).first()
    if not entry:
        raise HTTPException(404, "Libro del club no encontrado")
    log = db.query(ClubReadingLog).filter_by(
        club_shelf_id=entry_id, player_id=current.id
    ).first()
    if not log:
        log = ClubReadingLog(club_shelf_id=entry_id, player_id=current.id)
        db.add(log)
    if body.started_at  is not None: log.started_at  = body.started_at
    if body.finished_at is not None: log.finished_at = body.finished_at
    if body.rating      is not None: log.rating      = body.rating
    if body.notes       is not None: log.notes       = body.notes
    log.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(log)
    return _club_log_out(log)

@app.get("/shelf/club/{entry_id}/logs")
def get_club_logs_summary(
    entry_id: int,
    db: Session = Depends(get_db),
    current: Player = Depends(require_club_member),
):
    """Devuelve los logs del club para mostrar rating medio y participación. Las notas son privadas."""
    logs = db.query(ClubReadingLog).filter_by(club_shelf_id=entry_id).all()
    ratings = [l.rating for l in logs if l.rating is not None]
    avg = round(sum(ratings) / len(ratings), 2) if ratings else None
    return {
        "count":      len(logs),
        "avg_rating": avg,
        "my_log":     _club_log_out(next((l for l in logs if l.player_id == current.id), None)),
    }


# ── Votos (estilo Kahoot — se revelan a la vez) ──────────────────────────────

class VoteRequest(BaseModel):
    rating: int

@app.post("/shelf/club/{entry_id}/vote")
def cast_vote(
    entry_id: int,
    body: VoteRequest,
    db: Session = Depends(get_db),
    current: Player = Depends(require_club_member),
):
    if not 1 <= body.rating <= 5:
        raise HTTPException(status_code=422, detail="La puntuación debe ser 1-5")
    existing = db.query(Vote).filter_by(player_id=current.id, club_shelf_id=entry_id).first()
    if existing:
        existing.rating   = body.rating
        existing.revealed = False
        db.commit()
        return {"ok": True, "updated": True}
    db.add(Vote(player_id=current.id, club_shelf_id=entry_id, rating=body.rating))
    db.commit()
    return {"ok": True, "updated": False}

@app.post("/shelf/club/{entry_id}/reveal")
def reveal_votes(
    entry_id: int,
    db: Session = Depends(get_db),
    _: Player = Depends(require_club_member),
):
    db.query(Vote).filter(Vote.club_shelf_id == entry_id).update({"revealed": True})
    db.commit()
    votes = db.query(Vote).filter(Vote.club_shelf_id == entry_id).all()
    return [{"player_id": v.player_id, "rating": v.rating} for v in votes]


# ── Sesiones ──────────────────────────────────────────────────────────────────

def _session_out(s: ClubSession) -> dict:
    # held_at contiene fecha + hora inicio; extraemos la hora como "HH:MM"
    start_time = s.held_at.strftime('%H:%M') if s.held_at else None
    return {
        "id":              s.id,
        "club_shelf_id":   s.club_shelf_id,
        "held_at":         s.held_at.isoformat() + 'Z' if s.held_at else None,
        "date":            s.held_at.strftime('%Y-%m-%d') if s.held_at else None,
        "start_time":      start_time,
        "end_time":        s.end_time,
        "part_to_discuss": s.part_to_discuss,
        "notes":           s.notes,
        "book":            _book_out(s.club_entry.book) if s.club_shelf_id and s.club_entry else None,
    }

class SessionCreateRequest(BaseModel):
    date:            str
    start_time:      Optional[str] = None   # "HH:MM"
    end_time:        Optional[str] = None   # "HH:MM"
    club_shelf_id:   Optional[int] = None
    part_to_discuss: Optional[str] = None
    notes:           Optional[str] = None

class SessionUpdateRequest(BaseModel):
    date:            Optional[str] = None
    start_time:      Optional[str] = None
    end_time:        Optional[str] = None
    club_shelf_id:   Optional[int] = None
    part_to_discuss: Optional[str] = None
    notes:           Optional[str] = None

def _parse_held_at(date: str, start_time: str = None) -> datetime:
    time_part = start_time or "00:00"
    return datetime.fromisoformat(f"{date}T{time_part}")

@app.get("/sessions")
def get_sessions(
    club_shelf_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current: Player = Depends(require_club_member),
):
    q = db.query(ClubSession)
    if club_shelf_id is not None:
        q = q.filter(ClubSession.club_shelf_id == club_shelf_id)
    sessions = q.order_by(ClubSession.held_at.desc()).all()
    return [_session_out(s) for s in sessions]

@app.post("/sessions")
def create_session(
    body: SessionCreateRequest,
    db: Session = Depends(get_db),
    current: Player = Depends(require_club_member),
):
    if current.name.lower() != "wander":
        raise HTTPException(403, "Solo el admin puede gestionar sesiones")
    try:
        held_at = _parse_held_at(body.date, body.start_time)
    except ValueError:
        raise HTTPException(422, "Fecha u hora inválida")
    s = ClubSession(
        held_at=held_at,
        end_time=body.end_time or None,
        club_shelf_id=body.club_shelf_id,
        part_to_discuss=body.part_to_discuss or None,
        notes=body.notes or None,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return _session_out(s)

@app.patch("/sessions/{session_id}")
def update_session(
    session_id: int,
    body: SessionUpdateRequest,
    db: Session = Depends(get_db),
    current: Player = Depends(require_club_member),
):
    if current.name.lower() != "wander":
        raise HTTPException(403, "Solo el admin puede gestionar sesiones")
    s = db.query(ClubSession).filter(ClubSession.id == session_id).first()
    if not s:
        raise HTTPException(404, "Sesión no encontrada")
    if body.date is not None:
        try:
            s.held_at = _parse_held_at(body.date, body.start_time or s.held_at.strftime('%H:%M'))
        except ValueError:
            raise HTTPException(422, "Fecha u hora inválida")
    elif body.start_time is not None:
        try:
            date_str = s.held_at.strftime('%Y-%m-%d')
            s.held_at = _parse_held_at(date_str, body.start_time)
        except ValueError:
            raise HTTPException(422, "Hora inválida")
    if body.end_time        is not None: s.end_time        = body.end_time        or None
    if body.club_shelf_id   is not None: s.club_shelf_id   = body.club_shelf_id   or None
    if body.part_to_discuss is not None: s.part_to_discuss = body.part_to_discuss or None
    if body.notes           is not None: s.notes           = body.notes           or None
    db.commit()
    db.refresh(s)
    return _session_out(s)

@app.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current: Player = Depends(require_club_member),
):
    if current.name.lower() != "wander":
        raise HTTPException(403, "Solo el admin puede gestionar sesiones")
    s = db.query(ClubSession).filter(ClubSession.id == session_id).first()
    if not s:
        raise HTTPException(404, "Sesión no encontrada")
    db.delete(s)
    db.commit()
    return {"ok": True}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_or_create_book(db, body: ShelfAddRequest) -> Book:
    if body.open_lib_key:
        book = db.query(Book).filter(Book.open_lib_key == body.open_lib_key).first()
        if book:
            # Actualiza metadatos si ahora tenemos más info
            if body.num_pages and not book.num_pages: book.num_pages = body.num_pages
            if body.synopsis  and not book.synopsis:  book.synopsis  = body.synopsis
            if body.year      and not book.year:      book.year      = body.year
            if body.genre     and not book.genre:     book.genre     = body.genre
            db.commit()
            return book
    book = Book(
        title=body.title, author=body.author,
        cover_url=body.cover_url, isbn=body.isbn,
        open_lib_key=body.open_lib_key,
        num_pages=body.num_pages, synopsis=body.synopsis,
        year=body.year, genre=body.genre,
    )
    db.add(book)
    db.commit()
    db.refresh(book)
    return book

def _book_out(b: Book) -> dict:
    return {
        "id":          b.id,
        "title":       b.title,
        "author":      b.author,
        "cover_url":   b.cover_url,
        "isbn":        b.isbn,
        "open_lib_key": b.open_lib_key,
        "num_pages":   b.num_pages,
        "synopsis":    b.synopsis,
        "year":        b.year,
        "genre":       b.genre,
    }

def _player_out(p: Player) -> dict:
    return {
        "id":            p.id,
        "name":          p.name,
        "color":         p.color,
        "avatar_emoji":  p.avatar_emoji,
        "avatar_url":    p.avatar_url,
        "customization": p.customization,
        "club_member":   p.club_member,
    }

def _shelf_entry_out(e: PersonalShelf, hide_notes=False) -> dict:
    return {
        "id":          e.id,
        "player_id":   e.player_id,
        "book":        _book_out(e.book),
        "status":      e.status,
        "progress":           e.progress,
        "current_page":       e.current_page,
        "custom_total_pages": e.custom_total_pages,
        "folder":             e.folder,
        "rating":             e.rating,
        "notes":       None if hide_notes else e.notes,
        "started_at":  e.started_at.isoformat()  if e.started_at  else None,
        "finished_at": e.finished_at.isoformat()  if e.finished_at else None,
        "sort_order":  e.sort_order,
        "added_at":    e.added_at.isoformat(),
    }

def _club_entry_out(e: ClubShelf, current_player_id: int = None) -> dict:
    revealed_votes = [v for v in e.votes if v.revealed]
    avg_votes = round(sum(v.rating for v in revealed_votes) / len(revealed_votes), 2) if revealed_votes else None
    my_log = next((l for l in e.reading_logs if l.player_id == current_player_id), None) if current_player_id else None
    return {
        "id":           e.id,
        "book":         _book_out(e.book),
        "status":       e.status,
        "proposed_by":  _player_out(e.proposer) if e.proposer else None,
        "activated_at": e.activated_at.isoformat() if e.activated_at else None,
        "read_date":    e.read_date.isoformat()    if e.read_date    else None,
        "club_notes":   e.club_notes,
        "avg_rating":    avg_votes,
        "vote_count":    len(revealed_votes),
        "session_count": len(e.sessions),
        "my_log":        _club_log_out(my_log),
        "added_at":      e.added_at.isoformat()     if e.added_at     else None,
    }

def _club_log_out(log: ClubReadingLog) -> dict | None:
    if not log:
        return None
    return {
        "id":           log.id,
        "started_at":   log.started_at.isoformat()  if log.started_at  else None,
        "finished_at":  log.finished_at.isoformat() if log.finished_at else None,
        "rating":       log.rating,
        "notes":        log.notes,
        "updated_at":   log.updated_at.isoformat(),
    }

def _message_out(m: Message) -> dict:
    return {
        "id":              m.id,
        "channel_id":      m.channel_id,
        "player_id":       m.player_id,
        "player_name":     m.player.name  if m.player else "[eliminado]",
        "player_color":    m.player.color if m.player else "#6b7280",
        "player_emoji":    m.player.avatar_emoji if m.player else "👻",
        "player_avatar_url": m.player.avatar_url if m.player else None,
        "content":         m.content,
        "created_at":      m.created_at.isoformat(),
    }


# ── Canales ──────────────────────────────────────────────────────────────────

@app.get("/channels")
def get_channels(db: Session = Depends(get_db), current: Player = Depends(get_current_player)):
    memberships = db.query(ChannelMember).filter(ChannelMember.player_id == current.id).all()
    result = []
    for m in memberships:
        ch = m.channel
        extra = {}
        if ch.type == "dm":
            other = db.query(ChannelMember).filter(
                ChannelMember.channel_id == ch.id,
                ChannelMember.player_id  != current.id,
            ).first()
            if other:
                extra["other_player"] = _player_out(other.player)
        last_msg = (
            db.query(Message)
            .filter(Message.channel_id == ch.id)
            .order_by(Message.created_at.desc())
            .first()
        )
        result.append({
            "id": ch.id, "name": ch.name, "type": ch.type,
            "last_message_at": last_msg.created_at.isoformat() + "Z" if last_msg else None,
            "last_read_at":    m.last_read_at.isoformat() + "Z" if m.last_read_at else None,
            **extra,
        })
    return result

@app.get("/channels/{channel_id}/messages")
def get_channel_messages(
    channel_id: int, limit: int = 60,
    db: Session = Depends(get_db), current: Player = Depends(get_current_player)
):
    member = db.query(ChannelMember).filter_by(channel_id=channel_id, player_id=current.id).first()
    if not member:
        raise HTTPException(403, "No eres miembro de este canal")
    msgs = (
        db.query(Message)
        .filter(Message.channel_id == channel_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_message_out(m) for m in reversed(msgs)]

@app.post("/channels/dm/{other_id}")
def get_or_create_dm(
    other_id: int, db: Session = Depends(get_db), current: Player = Depends(require_club_member)
):
    other = db.query(Player).filter(Player.id == other_id).first()
    if not other or not other.club_member:
        raise HTTPException(404, "Jugador no encontrado")
    # Buscar canal DM existente
    my_dms = (
        db.query(ChannelMember)
        .join(Channel)
        .filter(ChannelMember.player_id == current.id, Channel.type == "dm")
        .all()
    )
    for m in my_dms:
        partner = db.query(ChannelMember).filter_by(
            channel_id=m.channel_id, player_id=other_id
        ).first()
        if partner:
            return {"id": m.channel_id}
    # Crear nuevo DM
    ch = Channel(name=f"dm_{min(current.id, other_id)}_{max(current.id, other_id)}", type="dm")
    db.add(ch)
    db.flush()
    db.add(ChannelMember(channel_id=ch.id, player_id=current.id))
    db.add(ChannelMember(channel_id=ch.id, player_id=other_id))
    db.commit()
    return {"id": ch.id}


# ── WebSocket ────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str = Query(...)):
    # Autenticar
    try:
        payload   = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        player_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        await ws.close(code=1008)
        return

    db = SessionLocal()
    try:
        player = db.query(Player).filter(Player.id == player_id).first()
        if not player:
            await ws.close(code=1008)
            return
        # Solo aprobados y miembros del club se conectan — el WS es hoy
        # exclusivamente presencia/chat/llamadas de Diskordkito, así que
        # bloquearlo aquí basta para que un no-miembro nunca aparezca online
        # ni pueda entrar a ningún canal, sin tener que filtrar en más sitios.
        if player.status != "approved" or not player.club_member:
            await ws.close(code=1008)
            return

        await manager.connect(player_id, ws)
        # Anunciar presencia
        await manager.broadcast({"type": "presence", "online": manager.online_ids})
        # Si hay una llamada grupal en curso, que quien se acaba de conectar la vea de inmediato
        if general_call["participants"]:
            await manager.send_to_players([player_id], _general_call_state())

        while True:
            data = await ws.receive_json()
            msg_type = data.get("type")

            if msg_type in (
                "call_offer", "call_answer", "call_ice", "call_reject", "call_end", "call_media",
                "group_call_offer", "group_call_answer", "group_call_ice",
            ):
                target_id = int(data.get("target_id", 0))
                if target_id:
                    await manager.send_to_players([target_id], {
                        **data,
                        "from_player": _player_out(player),
                    })

            elif msg_type == "group_call_join":
                call_type = data.get("callType", "video")
                member_ids = _general_member_ids(db)
                if player_id not in member_ids:
                    continue
                existing_ids = [pid for pid in general_call["participants"] if pid != player_id]
                is_first = len(general_call["participants"]) == 0

                if is_first:
                    general_call["call_type"] = call_type
                general_call["participants"].add(player_id)
                if len(general_call["participants"]) >= 2:
                    general_call["active"] = True

                # Al que se une, decirle quién está ya dentro para que inicie el mesh con ellos
                await manager.send_to_players([player_id], {
                    "type": "group_call_peers",
                    "peerIds": existing_ids,
                    "callType": general_call["call_type"],
                })

                # Llamar a todo el club conectado, solo cuando la llamada arranca de cero
                if is_first:
                    ring_targets = [pid for pid in member_ids if pid != player_id]
                    await manager.send_to_players(ring_targets, {
                        "type": "group_call_ring",
                        "from_player": _player_out(player),
                        "callType": call_type,
                    })

                await manager.send_to_players(member_ids, _general_call_state())

            elif msg_type == "group_call_leave":
                general_call["participants"].discard(player_id)
                if not general_call["participants"]:
                    general_call["active"] = False
                member_ids = _general_member_ids(db)
                await manager.send_to_players(member_ids, _general_call_state())

            elif msg_type == "group_call_media":
                peers = [pid for pid in general_call["participants"] if pid != player_id]
                await manager.send_to_players(peers, {
                    **data,
                    "from_player": _player_out(player),
                })

            elif msg_type == "message":
                channel_id = int(data.get("channel_id", 0))
                content    = str(data.get("content", "")).strip()
                if not content or not channel_id:
                    continue
                member = db.query(ChannelMember).filter_by(
                    channel_id=channel_id, player_id=player_id
                ).first()
                if not member:
                    continue
                msg = Message(channel_id=channel_id, player_id=player_id, content=content)
                db.add(msg)
                db.commit()
                db.refresh(msg)

                member_ids = [
                    m.player_id for m in
                    db.query(ChannelMember).filter_by(channel_id=channel_id).all()
                ]
                await manager.send_to_players(member_ids, {
                    "type":    "message",
                    **_message_out(msg),
                })

            elif msg_type == "mark_read":
                channel_id = int(data.get("channel_id", 0))
                member = db.query(ChannelMember).filter_by(
                    channel_id=channel_id, player_id=player_id
                ).first()
                if not member:
                    continue
                member.last_read_at = datetime.now(timezone.utc)
                db.commit()

    except (WebSocketDisconnect, Exception):
        pass
    finally:
        await manager.disconnect(player_id, ws)
        await manager.broadcast({"type": "presence", "online": manager.online_ids})
        if player_id in general_call["participants"]:
            general_call["participants"].discard(player_id)
            if not general_call["participants"]:
                general_call["active"] = False
            await manager.send_to_players(_general_member_ids(db), _general_call_state())
        db.close()
