from sqlalchemy import (
    create_engine, Column, Integer, String, DateTime, Boolean,
    Float, ForeignKey, JSON, UniqueConstraint, Text
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://luni:luni@localhost:5436/luni")

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
    # Apps marcadas "adminOnly" (ver frontend/apps/config.js) a las que este
    # jugador tiene acceso aunque no sea admin — p.ej. dejar que alguien sin
    # ser del club pruebe Luniteca (nueva) mientras está en desarrollo, sin
    # tener que dársela a todo el mundo. Lista de ids de app (["luniteca3"]),
    # gestionada desde el panel Admin. Nunca incluye "admin" en sí — eso se
    # comprueba aparte (ver isAppVisible), dar el panel de admin a alguien no
    # es "una app más" que conceder por aquí.
    extra_apps     = Column(JSON, nullable=False, default=list)
    created_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    personal_shelf   = relationship("PersonalShelf", back_populates="player")
    club_reading_logs = relationship("ClubReadingLog", back_populates="player")
    votes            = relationship("Vote", back_populates="player")


class Book(Base):
    """Catálogo de libros. Los metadatos se guardan al añadir para no depender de Open Library en tiempo real."""
    __tablename__ = "books"

    id           = Column(Integer, primary_key=True, index=True)
    title        = Column(String, nullable=False)
    # Título original (normalmente inglés) resuelto vía la "obra" de Open
    # Library — solo para buscar en fuentes que no siempre tienen alias en
    # español (Wikidata, ver issue #8: "La voluntad de muchos" no se
    # encontraba buscando con su título en español). Nunca se muestra en
    # pantalla, `title` sigue siendo el único que ve el jugador. Se rellena
    # solo (y una vez) la primera vez que hace falta — null hasta entonces.
    original_title = Column(String, nullable=True)
    author       = Column(String, nullable=True)
    cover_url    = Column(String, nullable=True)
    isbn         = Column(String, nullable=True)
    open_lib_key = Column(String, nullable=True, unique=True)
    num_pages    = Column(Integer, nullable=True)
    synopsis     = Column(Text, nullable=True)
    year         = Column(Integer, nullable=True)
    genre        = Column(String, nullable=True)
    added_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # El lomo de canto de la vista de estantería. Antes se dibujaba entero con
    # CSS a partir de title/author/num_pages/cover_url (ver frontend-next,
    # Lomos.jsx) — caro de pintar con cientos a la vez. Ahora se genera UNA
    # vez como imagen (mismo dibujo, hecho en un <canvas>) y se guarda aquí;
    # mientras no exista, la vista sigue dibujándolo al vuelo como hasta
    # ahora. `spine_custom` distingue el generado (se puede regenerar solo si
    # cambian título/autor/páginas/portada) del subido a mano por alguien
    # (nunca se pisa solo). Mismo patrón que cover_url/BookCover, con
    # PersonalShelf.spine_url de contrapartida para quien quiera su propia
    # foto del lomo sin cambiárselo a los demás.
    spine_url    = Column(String, nullable=True)
    spine_custom = Column(Boolean, nullable=False, default=False)
    # Cuánto mide el libro de alto, en MILÍMETROS (235 = 23,5 cm). Es el
    # único dato real de tamaño que hay: el grosor del lomo sale de
    # num_pages, pero el alto no se puede deducir de nada —ni las APIs lo
    # dan de fiar— así que hasta ahora la vista de lomos lo sacaba de un
    # hash del título (ver medidas() en Lomos.jsx). Eso hace que dos tomos
    # de la MISMA edición se vean de alturas distintas solo porque sus
    # títulos tienen letras distintas, que es justo lo que este campo
    # arregla. Null = sin definir, y se sigue usando el hash.
    #
    # Va en el libro (compartido), no en la copia de cada jugador, por el
    # mismo motivo que num_pages: es un dato de la edición, no una
    # preferencia personal.
    height_mm    = Column(Integer, nullable=True)


class BookSpine(Base):
    """Galería de lomos subidos a mano para un libro — mismo papel que
    BookCover para las portadas: no sustituye el lomo del libro por sí sola,
    queda disponible con atribución para quien quiera elegirla."""
    __tablename__ = "book_spines"

    id          = Column(Integer, primary_key=True, index=True)
    book_id     = Column(Integer, ForeignKey("books.id"), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("players.id"), nullable=True)
    url         = Column(String, nullable=False)
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    book     = relationship("Book")
    uploader = relationship("Player")


class RelatedCache(Base):
    """Sugerencias en bruto de la ficha de un libro (saga y más del autor,
    ver related_books en main.py), tal como salen de Open Library/Wikidata/
    Google Books — issue #7. Antes vivían solo en memoria y cada despliegue
    o reinicio obligaba a repetir la cadena externa entera (2-4 s por ficha
    y cuota de APIs). Son iguales para cualquier jugador; lo que depende de
    quién mira (qué tiene en su estantería) se calcula aparte, al momento.

    Sin clave foránea a propósito: una fila huérfana de un libro borrado no
    molesta a nadie, y así borrar un libro no tiene que saber que esto existe.
    `signature` (título|autor|idioma) invalida la fila si alguien edita el
    libro: con otro título o autor, la saga y la bibliografía son otras."""
    __tablename__ = "related_cache"

    book_id    = Column(Integer, primary_key=True)
    signature  = Column(String, nullable=False)
    payload    = Column(JSON, nullable=False)
    fetched_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


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
    status      = Column(String, nullable=False, default="want_to_read")  # reading | rereading | read | want_to_read | dropped
    times_read  = Column(Integer, nullable=False, default=0)  # veces marcado "Leído" — editable a mano
    progress           = Column(Float, default=0.0)  # 0.0 – 1.0
    current_page       = Column(Integer, nullable=True)
    custom_total_pages = Column(Integer, nullable=True)
    # Dónde se está leyendo esta copia: 'fisico' | 'ereader' | 'ambos' | NULL
    # (sin especificar). `ereader_total_pages` es la paginación de esa
    # edición — casi nunca coincide con la del libro físico, así que necesita
    # su propio total; `current_page` sigue guardándose en páginas físicas
    # (custom_total_pages o book.num_pages) y el eReader se calcula por regla
    # de tres a partir de los dos totales (ver shelf.js, paginaEnLado).
    reading_format      = Column(String, nullable=True)
    ereader_total_pages = Column(Integer, nullable=True)
    # Además se escucha en audiolibro (fase 5 de audiolibros, #67). Aparte de
    # reading_format a propósito: ese lo usa tal cual la Puchi anterior
    # (fisico | ereader | ambos), y el audio se suma a cualquiera de los tres.
    listening           = Column(Boolean, nullable=False, default=False)
    folder             = Column(String, nullable=True)
    rating             = Column(Float, nullable=True) # 0.5-5.0 con medios puntos
    # Lo que costó esta copia. Dato personal (como las notas): no se enseña
    # en la estantería de otro jugador. De momento solo se guarda; pensado
    # como base para estadísticas y gráficas de gasto más adelante.
    price              = Column(Float, nullable=True)
    # Portada elegida por este jugador para su copia — si es NULL se usa la
    # portada del libro (books.cover_url) como valor por defecto. Así, elegir
    # una portada distinta a la del catálogo no se la cambia a todo el mundo.
    cover_url   = Column(String, nullable=True)
    # Mismo mecanismo que cover_url, para el lomo: NULL usa el del libro
    # (books.spine_url, generado o subido por otro), y aquí solo se guarda
    # cuando ESTE jugador ha subido el suyo para su copia.
    spine_url   = Column(String, nullable=True)
    started_at  = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    notes       = Column(Text, nullable=True)
    sort_order  = Column(Integer, nullable=True)    # orden en la estantería física
    added_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # Cómo llegó el libro a esta estantería — 'search' (buscado en Open
    # Library, alta manual, o carga masiva) o 'copied' (visto en la
    # estantería de otro jugador y añadido con el botón "Añadir a mi
    # estantería"). Nullable: filas de antes de este campo se quedan sin
    # dato, no se puede reconstruir a posteriori.
    origin      = Column(String, nullable=True)

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
    # Hasta qué página hay que llevar leído para la próxima quedada. Es EL
    # objetivo vigente, y por eso vive en el libro y no colgado de una sesión:
    # al estrenar un libro todavía no hay ninguna sesión a la que engancharlo y
    # el objetivo hace falta desde el primer día. Cada sesión guarda además el
    # suyo, que es el registro de lo que se acordó aquel día — el histórico, no
    # el valor vigente.
    next_page    = Column(Integer, nullable=True)
    # Portada y lomo que el admin elige para el libro EN EL CLUB. NULL usa los
    # del libro (books.cover_url / spine_url), igual que PersonalShelf: así el
    # club puede verse como el club quiera sin cambiarle el libro a nadie en
    # su estantería.
    cover_url    = Column(String, nullable=True)
    spine_url    = Column(String, nullable=True)
    # Y el alto en mm, por lo mismo: NULL usa el del libro (books.height_mm).
    height_mm    = Column(Integer, nullable=True)
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
    times_read = Column(Integer, nullable=True)  # solo en 'finished' — para "terminó X por 2ª vez" en Amigos
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
    # Lo que se acordó en ESTA sesión sobre hasta dónde leer para la siguiente:
    # el histórico, que deja escrito por dónde iba la lectura en cada quedada.
    # El objetivo vigente —el que se enseña por toda la app— es el del libro
    # (ClubShelf.next_page); guardar una sesión con este campo lo actualiza
    # también, porque es justo el momento en que se decide.
    next_page        = Column(Integer,  nullable=True)

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


# ─── Audiolibros (issues #58-#71) ─────────────────────────────────────────────
# Tres tablas nuevas y ninguna columna nueva en las de siempre: la Puchi de
# producción no se entera de que existen. Las claves foráneas borran en
# cascada en la propia base de datos (ondelete), para que borrar un libro o un
# jugador desde el código de siempre no tropiece con un enlace de audiolibro.

class Audiobook(Base):
    """Un audiolibro: el EPUB que sube el admin, sus capítulos y la voz con la
    que se va a generar. Es una ficha propia y no una columna de `books`
    porque un mismo audio sirve a varios libros del catálogo (#60): la misma
    novela dada de alta con otro título o en otra edición por otra cuenta."""
    __tablename__ = "audiobooks"

    id          = Column(Integer, primary_key=True, index=True)
    title       = Column(String, nullable=False)
    author      = Column(String, nullable=True)
    # Lo que trae el EPUB como identificador, si es un ISBN: sirve para
    # proponer enlaces con libros del catálogo que tengan el mismo.
    isbn        = Column(String, nullable=True)
    cover_url   = Column(String, nullable=True)
    # Ruta del EPUB en disco, fuera de uploads/: lo que hay en uploads/ se
    # sirve a cualquiera, y el EPUB no debe salir de la máquina.
    epub_path   = Column(String, nullable=False)
    # sha256 del archivo: subir dos veces el mismo EPUB no crea dos fichas.
    epub_hash   = Column(String, nullable=False, unique=True)
    epub_size   = Column(Integer, nullable=True)
    voice       = Column(String, nullable=False, default="voz_femenina_suave")
    # borrador → (fase 2) en_cola / generando / listo
    status      = Column(String, nullable=False, default="borrador")
    # Pausado "al acabar el capítulo": el que se está generando termina, pero
    # el sobremesa no coge ninguno más de este libro. Los que faltan siguen en
    # cola, con su orden, para reanudar sin volver a elegir por dónde empezar.
    queue_hold  = Column(Boolean, nullable=False, default=False)
    created_by  = Column(Integer, ForeignKey("players.id", ondelete="SET NULL"), nullable=True)
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class AudiobookChapter(Base):
    """Un capítulo tal como se va a leer. Se guarda el texto, no solo dónde
    está en el EPUB: el admin puede renombrar, unir y dejar fuera capítulos, y
    eso tiene que sobrevivir a que el extractor cambie algún día."""
    __tablename__ = "audiobook_chapters"

    id           = Column(Integer, primary_key=True, index=True)
    audiobook_id = Column(Integer, ForeignKey("audiobooks.id", ondelete="CASCADE"), nullable=False, index=True)
    position     = Column(Integer, nullable=False)   # orden de lectura, desde 0
    title        = Column(String, nullable=False, default="")
    text         = Column(Text, nullable=False, default="")
    words        = Column(Integer, nullable=False, default=0)
    # Fuera = no se genera ni se escucha (cubierta, índice, créditos…).
    included     = Column(Boolean, nullable=False, default=True)

    # ── Generación (fase 2, #64). Columnas añadidas con ALTER en
    # audiolibros.migrar(): la tabla ya existía cuando llegaron.
    # pendiente → en_cola → generando → listo | error
    status        = Column(String, nullable=False, default="pendiente")
    # Orden de la cola: primero los urgentes (regenerar, o lo que se quedó a
    # medias), luego por cuándo se pidieron y, dentro de una petición, en el
    # orden elegido (empezando por el capítulo que diga el admin).
    priority      = Column(Boolean, nullable=False, default=False)
    queued_at     = Column(DateTime, nullable=True)
    queue_index   = Column(Integer, nullable=True)
    # Quién lo está generando y hasta cuándo se le guarda: si el sobremesa se
    # apaga a medias, al vencer vuelve a la cola (#59).
    worker        = Column(String, nullable=True)
    started_at    = Column(DateTime, nullable=True)
    lease_until   = Column(DateTime, nullable=True)
    progress      = Column(Float, nullable=False, default=0.0)
    progress_note = Column(String, nullable=True)
    error         = Column(Text, nullable=True)
    attempts      = Column(Integer, nullable=False, default=0)
    # El audio: AAC 64k mono (#61), fuera de uploads/.
    audio_path    = Column(String, nullable=True)
    duration_s    = Column(Float, nullable=True)
    audio_size    = Column(Integer, nullable=True)
    generated_at  = Column(DateTime, nullable=True)
    # Con qué se hizo: si un día cambia la voz o la receta, se sabe qué
    # capítulos son de antes.
    voice_used    = Column(String, nullable=True)
    recipe        = Column(JSON, nullable=True)
    # Retocar un trozo suelto (#71). recipe["mapa"] dice dónde empieza y
    # acaba cada trozo en el audio; `retoques` son los que el admin ha pedido
    # rehacer ([{i, texto, emocion, estilo, semilla, pedido}]) y
    # `retoque_lease` hasta cuándo se los guarda el sobremesa que los hace.
    # El capítulo sigue "listo" y se puede escuchar mientras tanto.
    retoques      = Column(JSON, nullable=True)
    retoque_lease = Column(DateTime, nullable=True)


class AudiobookBook(Base):
    """Qué libros del catálogo se escuchan con qué audiolibro. Un libro va con
    un solo audiolibro (si no, no se sabría cuál poner al darle a Escuchar);
    un audiolibro, con tantos libros como haga falta. Los enlaces los confirma
    siempre el admin: nunca se crean solos."""
    __tablename__ = "audiobook_books"
    __table_args__ = (UniqueConstraint("book_id"),)

    id           = Column(Integer, primary_key=True, index=True)
    audiobook_id = Column(Integer, ForeignKey("audiobooks.id", ondelete="CASCADE"), nullable=False, index=True)
    book_id      = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False)
    linked_by    = Column(Integer, ForeignKey("players.id", ondelete="SET NULL"), nullable=True)
    linked_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class AudiobookProgress(Base):
    """Por dónde va cada uno escuchando cada audiolibro (fase 3, #65): el
    capítulo y el segundo. En el servidor, no en el dispositivo, para seguir
    en el móvil donde se dejó en el ordenador."""
    __tablename__ = "audiobook_progress"
    __table_args__ = (UniqueConstraint("player_id", "audiobook_id"),)

    id           = Column(Integer, primary_key=True, index=True)
    player_id    = Column(Integer, ForeignKey("players.id", ondelete="CASCADE"), nullable=False)
    audiobook_id = Column(Integer, ForeignKey("audiobooks.id", ondelete="CASCADE"), nullable=False)
    # SET NULL: volver a leer el EPUB rehace los capítulos, y entonces se
    # empieza por el principio en vez de romper.
    chapter_id   = Column(Integer, ForeignKey("audiobook_chapters.id", ondelete="SET NULL"), nullable=True)
    position_s   = Column(Float, nullable=False, default=0.0)
    updated_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # Por dónde va leyendo el texto en la app (#78): el capítulo y el párrafo.
    # Aparte de lo escuchado: se puede leer por un sitio y escuchar por otro.
    read_chapter_id = Column(Integer, ForeignKey("audiobook_chapters.id", ondelete="SET NULL"), nullable=True)
    read_para       = Column(Integer, nullable=True)


class AudiobookRequest(Base):
    """Alguien pide escuchar un libro de su estantería (fase 6, #68). Se pide
    el libro, no un audiolibro: lo normal es que aún no exista. Cuando el admin
    lo enlaza con uno, el estado de la petición sale de ese audiolibro; aquí
    solo se guarda si la rechazó y por qué."""
    __tablename__ = "audiobook_requests"
    __table_args__ = (UniqueConstraint("player_id", "book_id"),)

    id            = Column(Integer, primary_key=True, index=True)
    player_id     = Column(Integer, ForeignKey("players.id", ondelete="CASCADE"), nullable=False, index=True)
    book_id       = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    rejected_at   = Column(DateTime, nullable=True)
    reject_reason = Column(String, nullable=True)
    # Por dónde quiere empezar quien lo pide: una página de su libro o un
    # capítulo escrito a mano ("12", "el de la boda"). Sin ninguno, desde el
    # principio. Cuando hay EPUB se traduce a un capítulo de verdad
    # (audiolibros_peticiones.capitulo_deseado).
    start_page    = Column(Integer, nullable=True)
    start_chapter = Column(String, nullable=True)


class PlayerNotice(Base):
    """Un aviso para una persona (fase 7 de audiolibros, #69): "ya puedes
    escuchar…", "nuevo capítulo", "completo", "no se va a preparar". Se guarda
    para que lo vea aunque no tuviera la app abierta cuando pasó, y para que
    el admin sepa a quién se ha avisado ya."""
    __tablename__ = "player_notices"

    id           = Column(Integer, primary_key=True, index=True)
    player_id    = Column(Integer, ForeignKey("players.id", ondelete="CASCADE"), nullable=False, index=True)
    # ab_ready | ab_new_chapter | ab_complete | ab_rejected
    kind         = Column(String, nullable=False)
    audiobook_id = Column(Integer, ForeignKey("audiobooks.id", ondelete="CASCADE"), nullable=True, index=True)
    book_id      = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=True)
    chapter_id   = Column(Integer, ForeignKey("audiobook_chapters.id", ondelete="SET NULL"), nullable=True)
    title        = Column(String, nullable=False)
    body         = Column(String, nullable=True)
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    read_at      = Column(DateTime, nullable=True)


class Announcement(Base):
    """Un aviso de novedades del admin (#72): sale a cada persona a la que va
    dirigido hasta que le da a "Entendido". Relanzarlo (`launched_at`) hace
    que vuelva a salir a todos, también a quien ya lo había aceptado."""
    __tablename__ = "announcements"

    id          = Column(Integer, primary_key=True, index=True)
    title       = Column(String, nullable=False)
    body        = Column(Text, nullable=False, default="")
    # todos | club | personas (entonces, las de player_ids)
    audience    = Column(String, nullable=False, default="todos")
    player_ids  = Column(JSON, nullable=True)
    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    launched_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class AnnouncementAck(Base):
    """Quién ha aceptado un aviso, y cuándo. Cuenta como aceptado si fue
    después del último lanzamiento."""
    __tablename__ = "announcement_acks"
    __table_args__ = (UniqueConstraint("announcement_id", "player_id"),)

    id              = Column(Integer, primary_key=True, index=True)
    announcement_id = Column(Integer, ForeignKey("announcements.id", ondelete="CASCADE"), nullable=False, index=True)
    player_id       = Column(Integer, ForeignKey("players.id", ondelete="CASCADE"), nullable=False, index=True)
    accepted_at     = Column(DateTime, nullable=False)


def crear_tablas():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
