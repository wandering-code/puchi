# Puchi — Estado actual

> Documento único de contexto para sesiones de Claude Code. Sustituye a `roadmap.md` y a `memory/*.md`. Última sesión: 2026-07-20.
>
> **2026-07-20**: backup real de producción → dev (ver sección "Backups" más abajo) para tener datos realistas de prueba. Cuatro mejoras sobre Luniteca: (1) fecha de inicio/fin visible (pequeña, gris) en la vista de lista de "Mi estantería"; (2) ningún modal de la app se cierra ya al pulsar fuera — solo con la X (afectaba a `SearchOverlay`, `CoverPicker`, `FilterModal`, `ClubFilterModal` en `LunitecaV2.jsx`; el resto de la app ya cumplía esto); (3) **sincronización en vivo**: cambios sociales (actividad de lectura, propuestas/cambios de estado del club, sesiones, perfil de otro jugador) se reflejan sin recargar en Amigos/Club/detalle de sesión, vía el WebSocket global ya existente (`_notify_luni()` en el backend, evento de navegador `luni:ws` ya emitido en `GatOS.jsx`) — no se tocó votos/reveal/logs de lectura del club porque aún no tienen UI; (4) **portadas de libro compartidas con atribución**: subir/elegir una portada ya NO sobrescribe la portada del libro para todo el mundo — cada jugador tiene su propia elección (`PersonalShelf.cover_url`, nuevo, con fallback a `Book.cover_url`), y todas las portadas subidas por cualquiera quedan en una galería nueva (`BookCover`, tabla nueva) visible en `CoverPicker` como sección "Subidas por el club" con el nombre de quién la subió; además `GET /books/search` combina resultados de Open Library con libros ya añadidos por cualquier usuario (buscando por palabra en título/autor, deduplicado en minúsculas), marcados `already_added`, y añadirlos reutiliza el mismo `book_id` (`ShelfAddRequest.book_id`) en vez de crear un libro duplicado. El libro del club (copia única compartida) sigue teniendo una sola portada elegida por el admin, sin override por jugador. Después, tres retoques más: (5) los bloques por año de "Leídos" alternan fondo (zebra) y la etiqueta del año pasa a ser una píldora con fondo, para diferenciarlos mejor al hacer scroll; (6) la búsqueda de libros ya avisa quién los tiene — "ya lo tienes" si eres tú, "añadido por &lt;nombre&gt;" (o "X y N más") si es otro jugador, usando `added_by`/`added_by_me` que devuelve `GET /books/search`; (7) nuevo factor de orden "Fecha de lectura" en Mi estantería (`finished_at`, asc/desc) junto a Título/Autor/Estado/Género. Primer despliegue a producción del día: `git push` + `git pull` en el mini PC, `docker-compose restart backend` (aplica la migración nueva —`personal_shelf.cover_url`, tabla `book_covers`— de forma determinista) y `npm run build` del frontend; verificado sin tocar datos reales (solo lecturas: conteo de libros antes/después, y el JS servido contiene ya "Fecha de lectura"/"Subidas por el club").
>
> Después, retoque de diseño sobre lo anterior — el zebra por año (punto 5) no convenció: (8) los bloques de año en "Leídos" vuelven a tener todos el mismo fondo (sin zebra); lo que destaca ahora es la propia cabecera del año, convertida en una barra con fondo propio, borde de acento a la izquierda y esquinas redondeadas en las cuatro esquinas (`ShelfYearHeader`), con algo más de aire arriba/abajo de la lista de libros dentro de cada bloque; (9) en la vista Netflix (grid), el anillo de acento de "leyendo" ya no se pierde para siempre al pasar el ratón por encima — se restaura suavemente al quitarlo (antes el `onMouseLeave` pisaba el `boxShadow` sin tener en cuenta `highlighted`); (10) **botón "colapsar/expandir todo"** nuevo (icono de chevrons, primero de la barra) que solo afecta a los bloques de año — nunca a Leyendo ahora/Leídos/Por leer, que se dejan aparte a propósito — en Mi estantería, y la misma funcionalidad llevada también al Club: "Leídos" del Club pasa de lista plana a agruparse por año de lectura (`read_date`) igual que Mi estantería, con su propio botón. El colapso de años de ambas vistas se persiste en `localStorage` (`luni_shelf_years_collapsed_<id>` / `luni_club_years_collapsed_<id>`) para recordarlo entre sesiones — antes solo Leyendo/Leídos/Por leer se guardaban, los años se reiniciaban siempre expandidos. Desplegado en producción el mismo día (segundo despliegue), sin cambios de esquema — solo `git pull` + `npm run build` del frontend.
>
> **2026-07-19**: sesión larga. Primero, tandas de retoques en Luniteca (`LunitecaV2.jsx`): Mi estantería reorganizada en tres secciones (Leyendo ahora / Leídos por año, colapsable / Por leer), iconos minimalistas en vez de emoji, franja de fondo por año, buscador por título dentro de `CoverPicker` (para portadas que no existen en Open Library con el título traducido), portada del detalle de libro con ancho fijo y alto automático (`HeroCover`, evita el recorte que daba `height:auto` dentro de un flex con stretch), sinopsis en popover flotante sobre la portada (`SynopsisBox`), estado del libro como desplegable en el detalle (antes solo editable desde el formulario completo), animaciones suave en toda condicional de UI y en el borrado de libros (`BOOK_DELETE_EXIT`/`BOOK_DELETE_TRANSITION`, ver convención en memoria), y cierre animado de todos los modales de Luniteca (antes abrían con transición pero cerraban de golpe). Después, **feature grande: aprobación de cuentas + pertenencia al club** (app nueva **Admin**, ver sección propia más abajo) — el registro deja de ser abierto: una cuenta nueva queda `pending` sin ningún acceso hasta que el admin la aprueba; al aprobarla arranca con acceso mínimo (**solo Luniteca** — ni Diskordkito, ni Pirestore, ni Ajustes, nada de eso tiene sentido sin ser del club); el admin decide aparte, en cualquier momento, si además es `club_member` — eso da acceso a todo el resto de apps y a la pestaña Club de Luniteca, y hace que dejen de estar ocultos para los demás (Diskordkito, "propuesto por", feed de Amigos). La pestaña Club **desaparece del todo** para quien no es miembro (no se muestra deshabilitada — ni debe saber que existe); el icono de cualquier app no-Luniteca desaparece igual del Dock/lanzador móvil/menú (criterio centralizado en `isAppVisible()`, `apps/config.js`). Nuevas columnas `Player.status`/`Player.club_member`, bloqueo en `login`/`get_current_player`/WS/endpoints de Club-sesiones-DM, filtrado de `GET /players` y del feed de actividad. Por último, **desplegado en producción** en el mini PC — `https://puchi.wanderingcode.dev`, systemd + Docker + nginx + Cloudflare Tunnel, mismo patrón que Kokito/Vinted/Sartori (ver sección propia más abajo).
>
> **2026-06-24**: se decidió formalmente abandonar la "vista habitación" y centrar el juego en GatOS como vista única. Se eliminó el código de habitación, RoomDesigner, estantería 3D y tablas `rooms`/`room_items` de la BD local.
>
> **2026-07-13**: se completó Luniteca V2 — tab Club completa (propuestas, leídos, admin), feed de actividad de amigos, sistema de sesiones por libro (pendiente de vista detalle). El componente activo es `LunitecaV2.jsx`.
>
> **2026-07-14**: llamadas WebRTC 1-to-1 en Diskordkito (audio y vídeo), barra de título de ventanas rediseñada (solo icono SVG a la derecha), Dock con trigger zone de 4px al oculto, HTTPS local con mkcert para pruebas desde iPad.
>
> **2026-07-16**: sesión larga — arreglado el bug del chat de llamada (mezclaba canal), icono de cámara remota apagada, notificaciones más precisas (según primer plano/panel abierto). Después, **adaptación completa de GatOS/Puchi a móvil** (táctil, pantalla pequeña, en vertical) manteniendo desktop intacto — ver sección propia más abajo. Filtros/orden/vista lista-Netflix añadidos a la lista de libros del Club (paridad con Mi estantería).
>
> **2026-07-17**: **llamadas grupales en #club-general** (Diskordkito) — sistema independiente del 1-to-1 (mesh P2P, no SFU). Cualquiera conectado puede iniciar una llamada de audio o vídeo desde la cabecera del canal, lo que hace sonar a todo el club conectado; quien no responda (o se le pase el aviso de 30s) puede unirse después mientras la llamada siga en marcha, desde un botón "Unirse" en la cabecera o un indicador (punto verde) junto al canal en el sidebar. Vista de llamada con grid y PiP propio, igual que la 1-to-1. Estado de la llamada (quién está dentro) vive en memoria del backend, no en BD. Ajustes posteriores el mismo día: (1) corregido un vídeo remoto que a veces se quedaba en negro (autoplay bloqueado por el navegador en vídeos no silenciados montados en medio de la negociación mesh — se fuerza `.play()` con reintento); (2) el reparto en columnas de la rejilla ahora lo decide `bestGridCols` según el área real medida (ResizeObserver), no breakpoints fijos — en un contenedor estrecho y alto (móvil con 2 remotos) apila en 1 columna en vez de encoger en 2; (3) sidebar de canales/DMs colapsable en escritorio (botón en la cabecera) para dar más espacio a la llamada; (4) modo "foco": clic en cualquier participante remoto lo agranda ocupando casi todo el área, el resto pasa a una tira de miniaturas debajo (nadie desaparece de pantalla) — clic de nuevo para volver a la rejilla. Pendiente de probar a fondo con dispositivos reales (ver Pendiente). También: **indicador de mensajes no leídos** en Diskordkito (punto azul + nombre en blanco/negrita en el canal o DM con mensajes nuevos), con `last_read_at` por jugador y canal persistido en backend (`channel_members.last_read_at`, mensaje WS `mark_read`), se marca leído al tener la conversación realmente visible (incluido el chat de una llamada). Paleta de Luniteca cambiada a los tonos de Diskordkito (fondo azul-grisáceo + acento blurple `#5865f2`), y Ajustes rediseñado dos veces: primero reducido a solo PIN/borrado (moviendo avatar/color/fondo a Pirestore), después se le devolvió una tarjeta "Identidad" con nombre (validado único) e icono — emoji del sistema o **foto subida**, esta última ya reflejada en toda la app vía el componente nuevo `PlayerAvatar.jsx`. Pirestore dejó de ser un placeholder: catálogo de fondos de pantalla (los iconos se quitaron después, viven solo en Ajustes), con foto recortable al subirla (modal de encuadre, `AvatarCropModal.jsx`) y, más tarde el mismo día, el catálogo pasó de lista fija en el frontend a tabla en BD (`shop_items`) con gestión de admin (añadir/quitar fondos) desde la propia pantalla. Por último: arreglado que las portadas de Luniteca a veces se veían en blanco al cambiar de pestaña (ver detalle en la sección de Luniteca más abajo), y nueva función **"Añadir varios libros de golpe"** en Mi estantería para migrar la estantería desde otra app (detalle también más abajo).

---

## Qué es Puchi

App de club de lectura para un grupo de amigos (N personas, pensado para escalar — nunca hardcodear número de jugadores). Gamificado con estética de mini sistema operativo retro. Proyecto personal del usuario para su club de lectura real.

> **⚠️ Puchi está en uso real en producción** (desde el despliegue del 2026-07-19) — el usuario lleva ahí su Luniteca real (control de sus lecturas). La BBDD de producción es **intocable**: nada de operaciones destructivas (truncar, recrear volúmenes, `docker-compose down -v`, reset de migraciones) contra `puchi-db-1` en el mini PC. Migraciones de esquema en producción deben ser aditivas/no destructivas. Ver "Backups de producción → dev" más abajo para el único flujo soportado de sacar datos de prod (siempre de solo lectura sobre prod, destructivo solo permitido sobre dev).

**Naming**: todo el universo (apps, juego) lleva nombres de gatos del grupo de amigos — Kokito, Luni, Puchi, Pire.
- Juego: **Puchi**
- Chat: **Diskordkito** (Discord + Kokito)
- Libros: **Luniteca** (Luni + biblioteca)
- Tienda: **Pirestore** (Pire + App Store)

**Stack**: React + Vite + Framer Motion (frontend) · FastAPI + SQLAlchemy + PostgreSQL (backend) · WebSocket nativo para tiempo real · WebRTC para llamadas 1-to-1 (STUN: stun.l.google.com).

---

## Flujo real actual

```
Login (LoginScreen, a pantalla completa)
  → GatOS arranca directamente, a pantalla completa
```

GatOS es la única vista del juego. No hay habitación, ni hotspots, ni marco de monitor decorativo — todo eso se eliminó. Cualquier interacción nueva se construye como app/ventana de GatOS.

Sigue habiendo código Phaser muerto sin usar (`scenes/`, `game.js`, `GamePage.jsx`, `LoginPage.jsx`, `partyClient.js`, carpeta `party/`) — restos de la versión pixel-art previa. Candidato a limpieza futura.

---

## GatOS — sistema de ventanas

- `src/components/gatos/GatOS.jsx`
- **Estética macOS**: barra superior fina (`MenuBar.jsx`, 28px) + Dock flotante abajo (`Dock.jsx`). Ventanas con barra de título translúcida. Tipografía de sistema; `"Press Start 2P"` solo en el wordmark "GatOS".
- **Sin iconos en el escritorio**: `Desktop.jsx` eliminado — todo desde el Dock.
- **Dock con comportamiento real de macOS**: clic trae al frente o minimiza según estado.
- Ventanas redimensionables (8 handles), maximizables con animación, respetando barras.
- Persistencia en localStorage (`gatos_windows_<player_id>`): posición, tamaño, estado, z-order.
- Fondo personalizable (8 gradientes, guardado en BD).
- WebSocket global conectado al arrancar GatOS — notificaciones aunque apps estén minimizadas.
- Constantes: `MENU_BAR_H` (en `MenuBar.jsx`) y `DOCK_RESERVED` (en `Dock.jsx`).

### Apps activas (`gatos/apps/`)

**🐱 Diskordkito** — chat en tiempo real vía WebSocket. Canal `#club-general` + DMs. Presencia online/offline. Mensajes persistentes en BD. **Llamadas WebRTC 1-to-1** (audio y vídeo) vía señalización WS, y **llamada grupal en `#club-general`** (mesh P2P, sistema separado).
- Dos botones en el header del DM: teléfono (llamada de voz) y cámara (videollamada).
- Flujo 1-to-1: caller envía `call_offer` → backend reenvía con `from_player` → callee ve modal → acepta/rechaza → `call_answer` → ICE exchange → llamada activa.
- `CallView`: vídeo remoto a pantalla completa, PiP local clickable para expandir (124×94 → 240×180), controles (mute/cámara/colgar/chat), panel lateral de chat (a pantalla completa en móvil, no panel lateral).
- El chat de la llamada 1-to-1 está anclado al canal DM de la llamada (`callChannelId`), no al canal que esté abierto en el sidebar — evita que se mezclen conversaciones. Corregido 2026-07-16.
- Señalización de llamada 1-to-1 (WebRTC + `call_media` para estado de cámara) vive en `GatOS.jsx`, no en Diskordkito, para que suene/notifique aunque la app esté cerrada o minimizada. Icono de cámara apagada también para el remoto (antes solo para uno mismo).
- **Llamada grupal en `#club-general`** (añadida 2026-07-17): sistema de señalización independiente del 1-to-1 (tipos WS `group_call_*`), también en `GatOS.jsx`. Mesh P2P — cada participante abre una `RTCPeerConnection` por cada otro (`groupPcsRef`, mapa por `player_id`), sin servidor de media. Backend guarda el estado de la llamada (participantes, tipo audio/vídeo) en memoria (`general_call` en `main.py`, efímero — no sobrevive a un reinicio del backend). Cualquier miembro conectado puede iniciarla desde la cabecera del canal; arranca haciendo sonar a todo el club conectado (`group_call_ring`, toast `GroupCallNotification` con auto-dismiss a los 30s — no afecta al estado del backend, solo dejan de sonarle). Quien no entra a tiempo puede unirse después mientras siga activa (botón "Unirse" en la cabecera + punto verde junto al canal en el sidebar, visibles según `participantIds`). `GroupCallView` (en `Diskordkito.jsx`) pinta un grid adaptable de participantes remotos (1/2/3 columnas según el conteo) + PiP propio, igual que la 1-to-1. Chat de la llamada grupal anclado siempre al `channel_id` real de `#club-general` (no a un DM). Pendiente de probar con varios dispositivos reales.
- ⚠️ `scrollIntoView` prohibido aquí: cambia el `scrollTop` del div raíz de GatOS. Usar `scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight` directamente.

**📚 Luniteca V2** (`LunitecaV2.jsx`) — app principal del club. Tres tabs (Estantería/Club/Amigos):

- **2026-07-17**: arreglado que a veces las portadas se veían en blanco al abrir Luniteca o cambiar de pestaña/vista. Causa: a diferencia de `GatOS.jsx` (que mantiene sus apps siempre montadas), la navegación *interna* de Luniteca entre Estantería/Club/Amigos usaba `AnimatePresence` con `key={nav}`, que desmontaba y volvía a montar todo el árbol (y todas las `&lt;img&gt;` de portada) en cada cambio. Ahora las tres pestañas se quedan siempre montadas y solo se ocultan con transform/opacidad (mismo patrón que `GatOS.jsx`) — `tabAnimate(id)` calcula la posición según el índice relativo a la pestaña activa (desliza en móvil, cambio instantáneo en desktop). Además, el componente `Cover` (portada compartida) ahora pinta siempre un fondo + 📖 de fallback detrás de la imagen real (nunca un hueco transparente mientras carga) y se recupera solo si la petición falla (`onError`); se sustituyeron por `&lt;Cover&gt;` los ~8 sitios que antes duplicaban esa lógica a mano (detalle de libro, tarjetas de Club, feed de Amigos, vista Netflix...). El toggle Lista/Netflix dentro de Estantería sigue remontando al cambiar de vista (no se tocó, menor impacto) — si se vuelve a notar ahí, aplicar el mismo patrón.
- **Añadir varios libros de golpe** (2026-07-17, en Mi estantería) — botón junto al de "Añadir libro" abre `BulkAddModal.jsx` (880px de ancho, no se cierra si clicas fuera por accidente — solo con la "×" o "Cancelar"/"Cerrar", para no perder la lista a medio rellenar). Una fila por libro: título, autor opcional, estado, y si el estado es "Leído" aparecen también fecha de inicio y de fin en la misma línea. Botón de buscar por fila que consulta Open Library (`GET /books/search`, mismo endpoint que el buscador normal); elegir un resultado rellena portada/género/año/páginas/ISBN y el autor (solo si estaba vacío) pero **nunca sobrescribe el título** — así puedes buscar por el título original para encontrar los metadatos y quedarte con tu propio título (p. ej. en castellano) sin perder lo demás; solo el botón "quitar" descarta esa asociación. Solo un desplegable de resultados puede estar abierto a la vez (abrir uno cierra cualquier otro). Pegar una lista de títulos (uno por línea) en cualquier campo de título la reparte sola en filas nuevas. Sustituye a un primer intento con pegado de JSON en crudo (quitado el mismo día: obligaba a escribir a mano datos que la búsqueda ya puede rellenar). Backend: `POST /shelf/personal/bulk` (`{"books": [...]}`), que valida y hace `commit()` **por separado** por libro (uno con un dato mal puesto no tumba los demás del mismo envío), recibiendo cada libro como `dict` suelto, no un modelo Pydantic estricto. Los tokens de diseño de Luniteca (`C`) viven en `lunitecaTheme.js` para que este modal (y futuros) los reutilicen sin crear una importación circular con `LunitecaV2.jsx`.

- **Mi estantería**: estados `want_to_read → reading → read`, progreso por páginas, carpetas con datalist, edición de metadatos (título/autor/género/sinopsis/portada vía CoverPicker — Open Library + subida de archivo), vista de detalle por libro, `started_at`/`finished_at` editables, ratings. En móvil, lista y Netflix tienen acciones rápidas (cambiar estado, ver ficha, borrar) sin entrar al detalle.
- **Club**: dos secciones — *Propuestas* y *Leídos*.
  - Cualquier usuario puede proponer libros (queda registrado quién propuso).
  - Admin (`player.name.toLowerCase() === 'wander'`) puede editar/borrar cualquier libro, marcar uno como "Lectura actual" (status `active` — solo puede haber uno), y mover libros entre propuestas y leídos cambiando el estado en el formulario de edición.
  - Edición completa de libros del club: portada (CoverPicker), título, autor, género, sinopsis, estado, "propuesto por" (reasignable a cualquier jugador), fechas de inicio/fin (si estado es leídos/lectura actual).
  - Tarjetas de Leídos muestran: portada full-height, fechas inicio → fin en horizontal, número de sesiones.
  - `ClubShelf.status`: `proposed | active | finished`. Al activar uno, el anterior `active` vuelve a `proposed` automáticamente (constraint en backend).
  - Filtros (autor/género/propuesto por), ordenación y vista lista/Netflix — mismo patrón que Mi estantería (añadido 2026-07-16). En vista Netflix, tocar la portada despliega acciones rápidas (pin/editar/borrar para admin en Propuestos) sobre la propia carátula.
  - Cabecera reorganizada: título "Club" + botones de filtro/orden/vista/añadir en una fila; pestañas Propuestas/Leídos en la fila de debajo.
- **Amigos**: feed de actividad paginado (50 items, botón "Cargar más"). Eventos: `added | started | finished | proposed`. Timestamps en UTC con sufijo 'Z'.

- **Sesiones por libro**: la vista detalle de cada libro del club tendrá sus sesiones (pendiente — ver abajo).

**🛍️ Pirestore** (2026-07-17) — tienda de fondos de pantalla (los iconos de perfil se quitaron de aquí el mismo día: se editan solo desde Ajustes, para no duplicar esa función en dos sitios). El catálogo ya **no es una lista estática del frontend**: vive en BD, tabla `shop_items` (`type`, `item_id`, `label`, `data` JSON, `price`, pensada para admitir tipos nuevos sin cambiar el esquema). Sembrada al arrancar (`_seed_shop_items()`) con los 8 fondos que antes venían hardcodeados (esos siguen siendo gradiente CSS puro, `data.bg`). Todo gratis por ahora (etiqueta "Gratis", sin gating real) porque no hay sistema de monedas. Cualquiera puede tocar una tarjeta para equiparla.

  **El admin (wander)** ve además un botón "Añadir fondo" — **sube una imagen propia** (no escribe CSS) y una papelera en cada tarjeta para quitarla del catálogo. Requisitos de la imagen, validados de verdad en el backend (`_WALLPAPER_*` en `main.py`, con una comprobación rápida igual en el navegador para avisar antes de subir):
  - Formato: JPG, PNG o WEBP (se rechaza cualquier otro, incluido GIF — nada de fondos animados por ahora).
  - Tamaño de archivo: máximo 5 MB.
  - Resolución mínima: 1280×720 (HD) — por debajo se rechaza, para que no se vea pixelado al cubrir pantallas grandes.
  - Resolución máxima: si supera 2560px de ancho se reescala automáticamente (proporcional) al guardarla, para no acumular archivos enormes.
  - Proporción: sin restricción — el fondo siempre se muestra con `background-size: cover` (recorta para rellenar cualquier ventana/pantalla), aunque una imagen apaisada da mejor resultado.
  Sube el archivo con Pillow (nueva dependencia, `requirements.txt`) para validar dimensiones/formato de verdad (no solo por la extensión) y reescalar si hace falta; se guarda en `backend/uploads/wallpapers/`. `data.image_url` en vez de `data.bg` para los fondos subidos así — `wallpaperCss()` (`frontend/src/utils/wallpaper.js`) resuelve cualquiera de los dos formatos a un valor de `background` válido, usado tanto en `GatOS.jsx` (fondo del escritorio) como en las tarjetas de Pirestore.

  Endpoints: `GET/POST /shop/items`, `POST /shop/items/wallpaper-image` (multipart: `label` + `file`), `DELETE /shop/items/{id}` — los tres de escritura exigen `current.name.lower() == "wander"`, mismo patrón que el resto de acciones de admin del Club. `GatOS.jsx` hace `fetch` de `/shop/items?type=wallpaper` para resolver el fondo del escritorio en vez de importar una lista fija.

**⚙️ Ajustes** — reducida (2026-07-17) a cuenta: identidad (nombre, icono) + seguridad (PIN, borrado). Panel único con tres tarjetas: "Identidad", "Cambiar PIN" y "Zona de peligro" — ya no tiene pestañas. El fondo de escritorio se quitó de aquí y vive en Pirestore (ver arriba). Al subir una foto de perfil se abre antes un modal para encuadrarla (`AvatarCropModal.jsx`: arrastrar para mover, deslizador para zoom, recorte hecho en canvas en el propio navegador). La tarjeta "Identidad" permite: 
  - Cambiar el **nombre** — valida que no lo tenga ya otro jugador (case-insensitive) antes de guardar; si coincide, el backend devuelve 409 y se muestra el error tal cual.
  - Cambiar el **icono**: o uno de los emoji del sistema (misma lista `AVATARS`, ahora exportada) o subir una **foto** propia (`POST /players/me/avatar`, multipart, guarda en `backend/uploads/avatars/`, mismo patrón que las portadas de libro). Elegir un emoji del sistema y guardar borra la foto subida (`avatar_url = null` en backend); subir/quitar foto es inmediato, no necesita el botón "Guardar cambios" (ese botón solo aplica a nombre + emoji).
  - La foto sustituye al emoji **en toda la app** (no solo en Ajustes): mensajes de chat, llamadas 1-to-1 y grupales, sidebar de Diskordkito, MenuBar, LoginScreen, notificaciones. Se centralizó en un componente nuevo, `PlayerAvatar.jsx` (`src/components/gatos/`), que decide entre `<img>` y emoji según si `avatar_url` está presente. Backend: `Player.avatar_url` (nullable), incluido en `_player_out` y en `_message_out` (como `player_avatar_url`).

**🛡️ Admin** (`AdminPanel.jsx`, 2026-07-19) — solo visible/usable por el admin (`wander`), icono oculto en Dock/lanzador móvil para el resto (accesible además desde el menú GatOS ⚙️→Admin, mismo patrón que Ajustes en móvil). Dos pestañas:
  - **Pendientes**: cuentas recién registradas (`status='pending'`), con checkbox "Miembro del club" + botones Aprobar/Rechazar.
  - **Jugadores**: cuentas aprobadas, cada una con un toggle de "Miembro del club" (no se puede quitar a sí mismo el admin).
  Backend: `GET /admin/players`, `PATCH /admin/players/{id}` (`{status?, club_member?}`), protegidos igual que el resto de acciones de admin (`current.name.lower() == "wander"`).

  **Sin `club_member`, solo se ve Luniteca** — ni Diskordkito, ni Pirestore, ni Ajustes (icono oculto del Dock, del lanzador móvil y del menú GatOS ⚙️, no solo deshabilitado). Un único criterio centralizado, `isAppVisible(app, player, isAdmin)` en `apps/config.js`, marcado en cada app de `APPS` con `requires: 'club_member'` (Diskordkito, Pirestore, Ajustes) o `adminOnly: true` (Admin) — lo usan `Dock.jsx`, `MobileLauncher.jsx` (`visibleTabApps()`) y `MenuBar.jsx`. Dentro de Luniteca, la pestaña **Club directamente no existe** para un no-miembro (no aparece deshabilitada) — `NAV` se filtra a `visibleNav` en `LunitecaV2.jsx`, y `ClubTab` ni se monta (no llega a pedir datos que el backend rechazaría con 403 igualmente). Además, **modo "kiosco"** en `GatOS.jsx`: sin `club_member` (y sin ser admin) no hay Dock ni ventanas — Luniteca ocupa toda la pantalla desde el principio, fija, sin poder moverse/redimensionarse/cerrarse, igual en móvil que en escritorio (rama nueva antes del split móvil/escritorio, activada por `kiosk = !player.club_member && !isAdmin`).

  **`player` se revalida al cargar la app** (`frontend/src/utils/auth.jsx`) — antes el objeto de jugador se guardaba en `localStorage` al loguear y no se volvía a tocar nunca (ni al recargar), así que una sesión abierta desde antes de un cambio de esquema (p.ej. añadir `club_member`) se quedaba para siempre con ese campo a `undefined`. Ahora, al montar `AuthProvider`, se llama a `GET /auth/me` (la cookie de sesión sigue siendo válida) y se refresca el `player` completo — soluciona tanto eso como el "no te enteras si el admin te cambia un permiso mientras tienes sesión abierta" (ahora se coge en la siguiente carga de la página, no hace falta re-loguear del todo).

---

## Adaptación móvil (2026-07-16)

GatOS funciona ahora en dos modos según el ancho de pantalla — **desktop se mantiene exactamente igual que antes**, todo lo nuevo vive detrás de un hook.

- **Detección**: `useIsMobile()` en `src/utils/responsive.js` — `matchMedia('(max-width: 768px)')`, reactivo a resize/rotación (encoger la ventana del navegador en desktop también activa el modo móvil).
- **Shell móvil** (`GatOS.jsx`): sin ventanas flotantes ni Dock. Cada app (Diskordkito/Luniteca/Pirestore) ocupa toda la pantalla; las tres se mantienen siempre montadas (ocultas con CSS, no desmontadas) para no perder scroll/conversación al cambiar. Se recuerda la última pestaña visitada por jugador (`gatos_mobile_tab_<player_id>`). Ajustes sigue accesible solo desde el menú superior (⚙️), como en desktop — se abre como overlay a pantalla completa.
- **Lanzador flotante** (`MobileLauncher.jsx`, sustituye a una barra de pestañas descartada por poco convincente): una muesca circular abajo a la derecha, siempre con el icono (real, de `DockIcons.jsx`) de la app activa. Un toque despliega un menú circular en abanico con las otras apps; mantener pulsado y arrastrar la mueve a cualquier parte de la pantalla — posición guardada por jugador (`gatos_launcher_pos_<player_id>`).
- **Barra superior**: en móvil también muestra el nombre de la app activa junto a "GatOS" (patrón macOS), igual que ya hacía en desktop. Las apps ya no repiten su propio icono/nombre dentro de su UI (se quitó de Diskordkito y Pirestore).
- **Diskordkito móvil**: navegación lista/detalle tipo WhatsApp (`mobileView: 'channels'|'chat'`, con `navDirection` para animar la dirección del gesto) en vez de sidebar+chat lado a lado. El chat de una llamada activa ocupa toda la pantalla en vez de panel lateral. Los avisos de llamada entrante se ven aunque se esté mirando la lista de canales (viven al nivel raíz del componente, no dentro del panel de chat).
- **Luniteca móvil**: la navegación entre Estantería/Club/Amigos es por **swipe horizontal** (con indicador de puntos arriba, tocable) — se probó antes una barra de pestañas abajo pero chocaba con el lanzador flotante y no convenció. El rail lateral de desktop no se toca.
- **Ajustes/LoginScreen**: sidebar de Ajustes pasa a pestañas horizontales arriba en móvil; paddings de LoginScreen ajustados para 375px de ancho.
- **Animaciones**: framer-motion en cambios de pestaña/app, apertura de Ajustes (slide desde abajo), navegación de Diskordkito y Luniteca, y en modales de Luniteca (Buscar, Filtros, Cambiar portada) que antes aparecían de golpe.
- **Popovers**: los que se cerraban solo con `onMouseLeave` (nunca dispara en táctil) ahora también cierran al tocar fuera, vía hook `useOutsideClose` (`pointerdown` en documento) en Luniteca, y `pointerdown` en el menú de `MenuBar.jsx`.
- Archivos nuevos clave: `src/utils/responsive.js`, `src/components/gatos/MobileLauncher.jsx`. `MobileTabBar.jsx` (barra de pestañas, primer intento) se creó y se eliminó en la misma sesión al pasar al lanzador flotante.

---

## Backend

- Puerto: **8001** · BD: PostgreSQL puerto **5433** (Docker, `docker-compose up -d db` solo levanta la BD)
- Auth: PIN (4-8 dígitos) + JWT cookie `luni_token`. Registro requiere aprobación del admin (ver 2026-07-19) — ya no es "abierto".
- Migraciones ad-hoc (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` en `_migrate()` al arrancar, no Alembic).

### Modelos (`database.py`)

- `players` — `customization` JSONB (color, avatar, wallpaper)
- `books` — catálogo compartido; `cover_url`, `synopsis`, `genre`, `open_lib_key`
- `personal_shelf` — estantería personal, `status/progress/rating/started_at/finished_at/folder`
- `club_shelf` — `status` (`proposed|active|finished`), `proposed_by` FK players, `activated_at`, `read_date`, `club_notes`; relaciones: `proposer`, `votes`, `reading_logs`, `sessions`
- `club_reading_logs` — log personal de cada jugador sobre un libro del club
- `votes` — puntuación secreta Kahoot-style, revelable por admin
- `activity` — eventos públicos: `event_type` (`added|started|finished|proposed`), `player_id`, `book_id`, `created_at` (UTC)
- `sessions` — sesiones del club: `club_shelf_id`, `held_at` (DateTime = fecha+hora inicio), `end_time` (VARCHAR "HH:MM"), `part_to_discuss`, `notes`
- `channels`, `channel_members`, `messages` — chat

### Endpoints relevantes (`backend/main.py`)

- Auth: `POST /auth/login`, `/auth/logout`, `/auth/register`, `GET /auth/me`
- Players: `GET /players`, `PATCH /players/{id}/customization`, `PATCH /players/me/profile`, `PATCH /players/me/pin`, `DELETE /players/me`
- Libros: `GET /books/search`, `/books/isbn/{isbn}`, `/books/synopsis/{key}`, `PATCH /books/{id}`, `POST /books/{id}/cover`, `GET /books/{id}/covers`
- Estantería personal: `GET /shelf/personal`, `POST /shelf/personal`, `PATCH /shelf/personal/{id}`, `DELETE /shelf/personal/{id}`, `GET /shelf/rankings`
- Club: `GET /shelf/club?status=`, `POST /shelf/club`, `PATCH /shelf/club/{id}`, `PATCH /shelf/club/{id}/status`, `DELETE /shelf/club/{id}`, + `/vote`, `/reveal`, `/my-log`, `/logs`
- Actividad: `GET /activity/feed?limit=&offset=` — devuelve `{items, total, has_more}`
- Sesiones: `GET /sessions`, `POST /sessions`, `PATCH /sessions/{id}`, `DELETE /sessions/{id}`
- Chat: `GET /channels`, `/channels/{id}/messages`, `POST /channels/dm/{other_id}`

---

## Cómo arrancar en local

```bash
# 1. Base de datos
cd /Users/wander/repos/puchi && docker-compose up -d db

# 2. Backend (puerto 8001)
cd /Users/wander/repos/puchi/backend && source venv/bin/activate
uvicorn main:app --port 8001 --reload

# 3. Frontend (puerto 5175, HTTPS)
cd /Users/wander/repos/puchi/frontend && npm run dev
```

**Puertos ocupados por otros proyectos:** 5173/8000 = Kokito · 5174/8003 = Sartori · 5175/8001 = **Puchi** · 5433 = BD de Puchi.

Al empezar cualquier sesión sobre Puchi, arrancar estos tres servicios sin esperar a que se pida.

**HTTPS local**: el frontend sirve HTTPS (necesario para WebRTC/cámara en dispositivos externos). Certs en `frontend/certs/` generados con mkcert. URL local Mac: `https://localhost:5175`. URL desde iPad (misma red): `https://192.168.1.81:5175`. La CA de mkcert está instalada y confiada en el Mac y el iPad del usuario.

---

## Pendiente, por prioridad

### Inmediato

- [ ] **Seguir probando la adaptación móvil en dispositivo real** — la sesión del 2026-07-16 se hizo a base de feedback en directo (móvil real vía `https://192.168.1.81:5175`) y fue bien, pero conviene un repaso completo: llamadas en móvil, formularios largos (ClubBookEditForm/SessionForm/BookDetailFull) a una columna, tamaños táctiles pequeños que queden (botones de cabecera ~28-32px).
- [ ] **Vista detalle de libro del club** — al pulsar una tarjeta (propuesto o leído) se abre una vista dentro del Club tab con la info completa del libro + sus sesiones. El admin podrá añadir/editar/borrar sesiones desde ahí. Cada sesión tiene: día, hora inicio, hora fin, parte a comentar, notas. La tab "Sesiones" global se eliminó — las sesiones viven dentro de cada libro.
- [ ] **BookDetail fase 3** — el modal de detalle de libro personal es simple, candidato a elaborarse.
- [ ] **Probar la llamada grupal de #club-general con dispositivos reales** — implementada 2026-07-17 (mesh P2P), falta validar con 2+ personas de verdad: calidad con varios vídeos a la vez, reconexión si alguien pierde red, comportamiento en móvil (grid + PiP + lanzador flotante conviviendo).
- [ ] **Probar el flujo de aprobación/club_member de extremo a extremo con una cuenta real** — implementado 2026-07-19, verificado por API (curl) pero no aún desde la propia UI (Admin, LoginScreen en estado "pending", Dock ocultando Diskordkito/Club a un no-miembro).

### Medio plazo

- [ ] **Recortes deliberados de la feature de aprobación/club (2026-07-19)**, quedan fuera de esta pasada: (1) los ~11 sitios que comprueban admin con `name.lower() == "wander"` no se tocaron — la app Admin usa el mismo patrón por consistencia, no se añadió columna `is_admin`; (2) no hay forma de volver a "pending" a alguien ya aprobado, ni de banear — solo pending→approved/rejected y el toggle de `club_member`. (El refresco del `player` al cambiarle un permiso en caliente sí se arregló el mismo día — ver `auth.jsx` en la sección de arriba — se coge en la siguiente carga de página, no instantáneo pero ya no hace falta re-loguear.)

- [ ] Más rankings en la tab Clasificación de Luniteca
- [ ] Notificaciones en Diskordkito de actividad del club ("Nadia ha propuesto un libro")
- [ ] **Contenido de pago real en Pirestore** — hoy todo el catálogo (fondos + iconos) es gratis porque no hay sistema de monedas; falta decidir qué será exclusivo/de pago y montar el gating cuando exista la moneda.
- [ ] **Color de nombre** — se quitó de Ajustes junto con el resto de estética (2026-07-17) y todavía no tiene hueco en Pirestore ni en ningún otro sitio; de momento no hay forma de cambiarlo en la UI.
- [ ] Sistema de monedas — placeholder pendiente de diseño
- [ ] Citas guardadas (fragmentos de libros para compartir)
- [ ] **Sembrar una cuenta admin ya aprobada en el seed/`_migrate()` del backend** — en este despliegue, el volumen de Postgres vacío + primera cuenta registrada en `pending` sin ningún admin aprobado dejó el sistema bloqueado (nadie podía entrar al panel Admin para aprobar a nadie); se resolvió a mano por `psql` una vez (ver sección de despliegue). Evitaría el mismo bloqueo en una reinstalación completa futura.

### Largo plazo

- [ ] Avatar/personaje visible — estilo artístico sin decidir
- [ ] Personalización del personaje (cuerpo, ropa, accesorios)
- [ ] Responsive para tablet — el breakpoint móvil actual es `max-width: 768px`, así que un iPad cae en modo desktop tal cual; revisar si conviene un modo intermedio.
- [ ] Ideas para nuevas apps de GatOS: tamagotchi/mascota, minijuego, diario, moodboard, tablón de anuncios, to-do list, colección genérica (películas/música)

---

## Decisiones de diseño validadas (no revertir sin motivo)

- **Dinámico por defecto**: ningún número de jugadores hardcodeado. Listas de jugadores siempre desde `/api/players`.
- **Player-aware desde el día 1**: cualquier UI que referencie a un jugador se ata a la identidad real.
- **Género masculino por defecto** en textos en español ("jugador", "conectado").
- **WebSocket global en GatOS**, no por app — notificaciones llegan con apps minimizadas/cerradas.
- **localStorage para persistencia de ventanas** — clave `gatos_windows_<player_id>`.
- **`scrollIntoView` prohibido en Diskordkito** — rompe el scroll del contenedor raíz de GatOS.
- **Sin cafetería física**: reuniones del club por videollamada en Diskordkito (WebRTC 1-to-1 y grupal en #club-general).
- **Llamada grupal como sistema separado del 1-to-1** (no unificados en un único modelo) — decisión explícita para no arriesgar regresiones en la llamada 1-to-1 ya estable. Mesh P2P (no SFU) por simplicidad, válido para grupos pequeños (2-6 aprox); si el club creciera mucho habría que revisar.
- **Estado de la llamada grupal en memoria del backend**, no en BD — coherente con que toda la señalización de llamadas ya es efímera.
- **Barra de título de ventanas**: solo icono SVG del Dock (22×22) a la derecha, sin nombre. El nombre no se muestra en la titlebar.
- **Dock trigger zone**: cuando está oculto (ventana maximizada), solo 4px en el borde inferior activan el dock — el resto del espacio queda libre para controles de la app.
- **PIN en lugar de OAuth**: login simple nombre + PIN numérico.
- **Registro con aprobación del admin** (cambiado 2026-07-19, antes era abierto) — sin límite de jugadores, pero una cuenta nueva no entra a nada hasta ser aprobada.
- **GatOS como única vista del juego, a pantalla completa** — nada de habitación ni marco de monitor.
- **Admin = `player.name.toLowerCase() === 'wander'`** — comprobación en frontend y backend.
- **Solo un libro `active` en el club a la vez** — al activar uno, el backend resetea automáticamente el anterior a `proposed`.
- **Timestamps de actividad con sufijo 'Z'** en el backend (`isoformat() + 'Z'`) para que JS los parsee como UTC correctamente.
- **Breakpoint móvil**: `matchMedia('(max-width: 768px)')` vía `useIsMobile()`, única fuente de verdad para toda la app.
- **Móvil sin ventanas flotantes**: apps a pantalla completa, siempre montadas (ocultas con CSS al cambiar, no desmontadas) para conservar su estado.
- **Móvil sin Dock ni barra de pestañas**: lanzador flotante (muesca + menú circular), arrastrable, posición guardada por jugador. Se descartaron explícitamente una barra de pestañas fija abajo en GatOS y otra dentro de Luniteca — no convencieron, chocaban con el lanzador.
- **Luniteca en móvil navega por swipe horizontal** entre Estantería/Club/Amigos, con indicador de puntos (no barra).
- **Las apps no repiten su propio nombre/icono en su UI** — el nombre de la app activa se muestra en la barra superior junto a "GatOS" (patrón macOS), en desktop y en móvil.

---

## Despliegue en producción (mini PC, desplegado 2026-07-19)

Vive en `~/apps/puchi` en el mini PC (Ubuntu Server), junto a Kokito/Sartori/Vinted, siguiendo el mismo patrón que Kokito (ver `../kokito/DIARIO.md`, sesión 18). URL: **https://puchi.wanderingcode.dev** (mismo túnel de Cloudflare `kokito`, reutilizado — solo se añadió una entrada de ingress nueva).

- **Docker**: `docker-compose.yml` (base, sin puertos publicados) + `docker-compose.override.yml` (dev — puertos 8001/5433, se carga solo sin `-f` explícito) + `docker-compose.prod.yml` (prod — backend en `8002:8001`, BD sin puerto publicado). Importante: Compose **combina** listas de `ports` entre archivos `-f`, no las reemplaza — por eso los puertos de dev viven en un `override.yml` aparte y nunca se cargan a la vez que `prod.yml`.
- **Backend**: contenedor propio con su propia Postgres (no comparte instancia con Kokito/Vinted/Sartori), puerto externo **8002** (el 8001 ya lo usa Vinted). BD no expuesta al host.
- **Frontend**: `npm run build` servido como estático por nginx en el puerto **3003** (Kokito=80, Vinted=3001, Sartori=3002 → Puchi=3003, mismo convenio de "un puerto dedicado por app").
- **nginx**: `/etc/nginx/sites-available/puchi`, con proxy a `/api/`, `/uploads/` y `/ws` (con cabeceras de upgrade para WebSocket — necesario para Diskordkito).
- **systemd**: `puchi.service`, `ExecStart=/usr/local/bin/docker-compose ...` (ruta correcta del binario — ver nota siguiente).
- **`frontend/vite.config.js`**: la carga de certs mkcert (HTTPS local) se hizo condicional (`fs.existsSync` antes de leerlos) — antes `vite build` fallaba en cualquier máquina sin `frontend/certs/` (gitignored), como el mini PC.
- Acceso SSH del Mac al mini PC vía host `minipc` en `~/.ssh/config` (clave dedicada `id_puchi_minipc`).

**Bug de otras apps encontrado y arreglado de paso (2026-07-19):** `kokito.service` y `vinted.service` tenían `ExecStart=/usr/bin/docker-compose`, ruta que ya no existe en este host (el binario real está en `/usr/local/bin/docker-compose`, probablemente se movió en una actualización del sistema). Vinted llevaba **~4 semanas totalmente caído** por esto (systemd en bucle `activating (auto-restart)`, cada intento fallaba con `203/EXEC`); Kokito seguía sirviendo de milagro con el proceso viejo ya arrancado, pero se habría caído igual en el próximo reinicio del mini PC. Corregidas ambas rutas (backups en `/etc/systemd/system/{kokito,vinted}.service.bak` en el propio mini PC), `daemon-reload` + `restart` de los dos — verificado que ambos responden por HTTPS de nuevo.

**Arranque en frío de la primera cuenta (bootstrap):** el volumen de Postgres de producción se creó vacío en este despliegue. Al registrar la primera cuenta (`Wander`) por la web, quedó en `pending`/`club_member=false` como cualquier registro nuevo — pero al no existir *ningún* admin ya aprobado, nadie podía entrar al panel Admin para aprobarla (candado cerrado sin llave). Se resolvió con un `UPDATE players SET status='approved', club_member=true` + `INSERT INTO channel_members` directo por `psql` dentro del contenedor `puchi-db-1`, una única vez. **Pendiente a futuro** (no urgente): sembrar la primera cuenta admin ya aprobada en `_migrate()`/seed del backend, para no depender de este paso manual en el próximo despliegue desde cero (p. ej. otra reinstalación completa del mini PC).

---

## Backups de producción → dev (Puchi está en uso real, ver nota al principio)

Puchi ya no es solo desarrollo: el usuario lleva en producción su Luniteca real (control de lecturas). La BBDD de producción es intocable — cualquier backup/restauración es de solo lectura sobre prod, y solo se aplica destructivamente sobre **dev**.

Proceso probado el 2026-07-20, dump completo (no solo tablas de libros, ya que el resto de prod estaba vacío — sin club/sesiones):

```bash
# 1) Dump completo de la BBDD de prod (solo lectura, no toca nada en el mini PC)
ssh minipc "docker exec puchi-db-1 pg_dump -U luni -Fc luni" > backend/backups/puchi_prod_<fecha>.dump

# 2) Portadas/avatares subidos a mano — el pg_dump NO los incluye (son ficheros,
#    no filas de BBDD); sin este paso, cover_url apunta a /uploads/covers/*.ext
#    que no existen en local y las portadas salen rotas.
rsync -avz minipc:/home/wander/apps/puchi/backend/uploads/covers/  backend/uploads/covers/
rsync -avz minipc:/home/wander/apps/puchi/backend/uploads/avatars/ backend/uploads/avatars/

# 3) Restaurar en dev (destruye lo que hubiera en dev)
docker exec puchi-db-1 psql -U luni -d luni -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
PGPASSWORD=luni pg_restore -h localhost -p 5433 -U luni -d luni --no-owner --no-privileges backend/backups/puchi_prod_<fecha>.dump
```

`backend/backups/` y `backend/uploads/` están gitignored (datos personales reales) — el dump vive solo en el Mac, no en el repo.
