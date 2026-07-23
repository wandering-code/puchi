from sqlalchemy import (
    create_engine, Column, Integer, String, DateTime, Boolean,
    Float, ForeignKey, JSON, UniqueConstraint, Text
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://luni:luni@localhost:5433/luni")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class Player(Base):
    __tablename__ = "players"

    id             = Column(Integer, primary_key=True, index=True)
    name           = Column(String, unique=True, nullable=False)
    pin_hash       = Column(String, nullable=False)
    color          = Column(String, nullable=False, default="#ffffff")
    avatar_emoji   = Column(String, nullable=False, default="⭐")
    avatar_url     = Column(String, nullable=True)
    customization  = Column(JSON, nullable=False, default=dict)
    status         = Column(String, nullable=False, default="approved")   # pending | approved | rejected
    club_member    = Column(Boolean, nullable=False, default=True)
    created_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    personal_shelf   = relationship("PersonalShelf", back_populates="player")
    club_reading_logs = relationship("ClubReadingLog", back_populates="player")
    votes            = relationship("Vote", back_populates="player")


class Book(Base):
    """Catálogo de libros. Los metadatos se guardan al añadir para no depender de Open Library en tiempo real."""
    __tablename__ = "books"

    id           = Column(Integer, primary_key=True, index=True)
    title        = Column(String, nullable=False)
    author       = Column(String, nullable=True)
    cover_url    = Column(String, nullable=True)
    isbn         = Column(String, nullable=True)
    open_lib_key = Column(String, nullable=True, unique=True)
    num_pages    = Column(Integer, nullable=True)
    synopsis     = Column(Text, nullable=True)
    year         = Column(Integer, nullable=True)
    genre        = Column(String, nullable=True)
    added_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class BookCover(Base):
    """Galería de portadas subidas a mano para un libro — no sustituyen la
    portada del libro, se ofrecen como opción adicional en el selector, con
    atribución a quién la subió (para que otros jugadores que añadan el
    mismo libro puedan elegir entre la de la API o la de cualquier jugador)."""
    __tablename__ = "book_covers"

    id          = Column(Integer, primary_key=True, index=True)
    book_id     = Column(Integer, ForeignKey("books.id"), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("players.id"), nullable=True)
    url         = Column(String, nullable=False)
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    book     = relationship("Book")
    uploader = relationship("Player")


class PersonalShelf(Base):
    """Estantería personal de cada jugador."""
    __tablename__ = "personal_shelf"
    __table_args__ = (UniqueConstraint("player_id", "book_id"),)

    id          = Column(Integer, primary_key=True, index=True)
    player_id   = Column(Integer, ForeignKey("players.id"), nullable=False)
    book_id     = Column(Integer, ForeignKey("books.id"), nullable=False)
    status      = Column(String, nullable=False, default="want_to_read")  # reading | read | want_to_read
    progress           = Column(Float, default=0.0)  # 0.0 – 1.0
    current_page       = Column(Integer, nullable=True)
    custom_total_pages = Column(Integer, nullable=True)
    folder             = Column(String, nullable=True)
    rating             = Column(Float, nullable=True) # 0.5-5.0 con medios puntos
    # Portada elegida por este jugador para su copia — si es NULL se usa la
    # portada del libro (books.cover_url) como valor por defecto. Así, elegir
    # una portada distinta a la del catálogo no se la cambia a todo el mundo.
    cover_url   = Column(String, nullable=True)
    started_at  = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    notes       = Column(Text, nullable=True)
    sort_order  = Column(Integer, nullable=True)    # orden en la estantería física
    added_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    player = relationship("Player", back_populates="personal_shelf")
    book   = relationship("Book")


class ClubShelf(Base):
    """Libros del club: propuestos por cualquiera, activados/finalizados por el admin."""
    __tablename__ = "club_shelf"

    id           = Column(Integer, primary_key=True, index=True)
    book_id      = Column(Integer, ForeignKey("books.id"), nullable=False, unique=True)
    status       = Column(String, nullable=False, default="finished")  # proposed | active | finished
    proposed_by  = Column(Integer, ForeignKey("players.id"), nullable=True)  # renombrado de added_by
    activated_at = Column(DateTime, nullable=True)
    read_date    = Column(DateTime, nullable=True)   # fecha en que el club lo terminó (finished_at)
    club_notes   = Column(Text, nullable=True)
    added_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    book             = relationship("Book")
    proposer         = relationship("Player", foreign_keys=[proposed_by])
    votes            = relationship("Vote", back_populates="club_entry")
    reading_logs     = relationship("ClubReadingLog", back_populates="club_entry")
    sessions         = relationship("Session", foreign_keys="[Session.club_shelf_id]")


class ClubReadingLog(Base):
    """Registro de lectura personal de cada jugador sobre un libro del club."""
    __tablename__ = "club_reading_logs"
    __table_args__ = (UniqueConstraint("player_id", "club_shelf_id"),)

    id            = Column(Integer, primary_key=True, index=True)
    player_id     = Column(Integer, ForeignKey("players.id"), nullable=False)
    club_shelf_id = Column(Integer, ForeignKey("club_shelf.id"), nullable=False)
    started_at    = Column(DateTime, nullable=True)
    finished_at   = Column(DateTime, nullable=True)
    rating        = Column(Float, nullable=True)    # 0.5-5.0 con medios puntos
    notes         = Column(Text, nullable=True)     # notas privadas del lector
    updated_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    player     = relationship("Player", back_populates="club_reading_logs")
    club_entry = relationship("ClubShelf", back_populates="reading_logs")


class Vote(Base):
    """Puntuación Kahoot-style: secreta hasta que el admin revela."""
    __tablename__ = "votes"
    __table_args__ = (UniqueConstraint("player_id", "club_shelf_id"),)

    id            = Column(Integer, primary_key=True, index=True)
    player_id     = Column(Integer, ForeignKey("players.id"), nullable=False)
    club_shelf_id = Column(Integer, ForeignKey("club_shelf.id"), nullable=False)
    rating        = Column(Float, nullable=False)   # 0.5-5.0 con medios puntos
    revealed      = Column(Boolean, default=False)
    voted_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    player     = relationship("Player", back_populates="votes")
    club_entry = relationship("ClubShelf", back_populates="votes")


class Activity(Base):
    """Registro de eventos públicos de lectura de cada jugador."""
    __tablename__ = "activity"

    id         = Column(Integer, primary_key=True, index=True)
    player_id  = Column(Integer, ForeignKey("players.id", ondelete="CASCADE"), nullable=False)
    book_id    = Column(Integer, ForeignKey("books.id",   ondelete="CASCADE"), nullable=False)
    event_type = Column(String, nullable=False)  # added | started | finished | proposed | voted
    rating     = Column(Float, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    player = relationship("Player")
    book   = relationship("Book")


class Session(Base):
    __tablename__ = "sessions"

    id               = Column(Integer, primary_key=True, index=True)
    club_shelf_id    = Column(Integer, ForeignKey("club_shelf.id"), nullable=True)
    held_at          = Column(DateTime, nullable=False)   # fecha + hora inicio
    end_time         = Column(String,   nullable=True)    # "HH:MM" hora fin
    part_to_discuss  = Column(Text,     nullable=True)    # parte/capítulos a comentar
    notes            = Column(Text,     nullable=True)

    club_entry    = relationship("ClubShelf", foreign_keys=[club_shelf_id])


class Channel(Base):
    __tablename__ = "channels"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String, nullable=False)
    type       = Column(String, nullable=False, default="group")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    members  = relationship("ChannelMember", back_populates="channel")
    messages = relationship("Message", back_populates="channel", order_by="Message.created_at")


class ChannelMember(Base):
    __tablename__ = "channel_members"
    __table_args__ = (UniqueConstraint("channel_id", "player_id"),)

    id           = Column(Integer, primary_key=True, index=True)
    channel_id   = Column(Integer, ForeignKey("channels.id"), nullable=False)
    player_id    = Column(Integer, ForeignKey("players.id"),  nullable=False)
    last_read_at = Column(DateTime, nullable=True)

    channel = relationship("Channel", back_populates="members")
    player  = relationship("Player")


class Message(Base):
    __tablename__ = "messages"

    id         = Column(Integer, primary_key=True, index=True)
    channel_id = Column(Integer, ForeignKey("channels.id"), nullable=False)
    player_id  = Column(Integer, ForeignKey("players.id", ondelete="SET NULL"), nullable=True)
    content    = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    channel = relationship("Channel", back_populates="messages")
    player  = relationship("Player")


class ShopItem(Base):
    """Catálogo de Pirestore — gestionado por el admin. "data" guarda lo
    específico de cada tipo (p.ej. {"bg": "..."} para fondos de pantalla);
    permite añadir tipos nuevos (iconos, sonidos...) sin cambiar el esquema.
    "price" existe ya para cuando haya monedas del juego — de momento todo
    se crea a 0 (gratis)."""
    __tablename__ = "shop_items"
    __table_args__ = (UniqueConstraint("type", "item_id"),)

    id         = Column(Integer, primary_key=True, index=True)
    type       = Column(String, nullable=False)
    item_id    = Column(String, nullable=False)
    label      = Column(String, nullable=False)
    data       = Column(JSON, nullable=False, default=dict)
    price      = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


def crear_tablas():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
