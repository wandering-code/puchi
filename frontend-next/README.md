# Puchi (versión nueva)

Rediseño de Puchi que se desarrolla **en paralelo a la Puchi actual**, sin tocarla.
Vive en `puchi.wanderingcode.dev/next` hasta que sustituya a la actual.

- `frontend/` — Puchi actual. **Congelada**: solo se toca para arreglar fallos.
- `frontend-next/` — esto. Proyecto independiente (su `package.json`, su lockfile,
  su stack), para que instalar o actualizar algo aquí no pueda romper el build de la actual.
- `backend/` — **compartido**. Mismo FastAPI y **misma base de datos**: lo que se ve
  aquí son los datos reales. Regla mientras convivan las dos versiones: los endpoints
  que ya usa la Puchi actual no se modifican ni se borran; lo que necesite otra forma
  de respuesta se añade como endpoint nuevo, y las migraciones siguen siendo aditivas
  e idempotentes (`ADD COLUMN IF NOT EXISTS`).

Decisión completa de la bifurcación: [issue #16](https://github.com/wandering-code/puchi/issues/16).

## Stack

Vite + React 19 + Tailwind 4 + [Motion](https://motion.dev) + React Router 7 + PWA
(`vite-plugin-pwa`). Se compila a `dist/` estático — no lleva Dockerfile, lo sirve
nginx directamente, igual que el frontend actual.

## Qué hay hecho

- **Armazón**: login contra el backend real, menú lateral, y pantallas de Inicio
  (vacía), Luniteca y Ajustes.
- **Luniteca**: la estantería completa contra los datos reales — sesiones por estado,
  leídos agrupados por año, tres vistas (cuadrícula, lista y estantería de lomos),
  búsqueda, filtros y orden, ficha del libro con todo lo editable, edición de los
  datos del libro y su portada, y alta de libros (buscador contra Open Library y a
  mano; falta el escáner de código de barras).
- **Lo social**: Actividad, perfiles y la estantería de otra persona, que se ve y se
  maneja igual que la tuya (mismas vistas, misma barra de herramientas, filtros y
  búsqueda propios que se deshacen al salir) pero sin poder editar nada suyo.
- **Club de lectura**: la estantería del club, con su lectura actual, lo propuesto y
  lo leído por año; la ficha de cada libro con quién lo propuso, las puntuaciones de
  todo el club y sus sesiones. Y **hasta qué página hay que leer para la próxima
  quedada**, a la vista en la tarjeta del libro que se está leyendo y en su ficha.
  Solo la ven los miembros del club, desde el menú lateral. Ver más abajo.
- **Administración**: aprobar, rechazar, desactivar y borrar cuentas, y marcar quién
  entra en el club. Solo la ve el admin, desde el menú lateral.
- **Claro y oscuro**: el tema se elige en el pie del menú lateral y vale para toda la
  app. Ver más abajo.
- **PWA**: manifest con iconos maskable, service worker y safe areas, para que añadida
  a la pantalla de inicio se comporte como una app.
- **Avisos en vivo**: un WebSocket para toda la app (`platform/live.js`), con
  reconexión, que refresca cuando algo cambia desde otro dispositivo o desde la Puchi
  actual.

Lo que falta (escáner de código de barras, importadores de Excel y Goodreads, Amigos)
está en [issue #18](https://github.com/wandering-code/puchi/issues/18).

## Cómo está montado

```
src/
├── platform/     lo que no es "pantalla": sesión, API, WebSocket, viewport, capas
├── ui/           piezas sueltas reutilizables (iconos, gesto de arrastre)
└── screens/
    ├── Shell.jsx        armazón: barra superior, menú lateral, rutas
    ├── LoginScreen.jsx
    ├── luniteca/        la app de libros
    │   ├── shelf.js         reglas de negocio (portadas de la Luniteca actual)
    │   ├── Luniteca.jsx     estantería: carga, filtros, secciones
    │   ├── BookDetail.jsx   ficha de un libro
    │   ├── BookEditForm.jsx edición de los datos del libro
    │   ├── editores.jsx     estado, fechas, carpeta, veces leído, sinopsis
    │   ├── HojaInferior.jsx la hoja que sube desde abajo (una para toda la app)
    │   └── piezas.jsx       portada, estrellas, barra de progreso, insignias
    ├── club/            el club de lectura, montado sobre lo de luniteca/
    │   ├── clubShelf.js     traducción club → estantería y reparto por secciones
    │   ├── Club.jsx         la estantería del club
    │   ├── ClubBookDetail.jsx  ficha de un libro del club
    │   ├── Puntuaciones.jsx    la nota de cada uno
    │   └── Sesiones.jsx        las quedadas de cada libro
    └── admin/
        └── Admin.jsx    cuentas: aprobar, club, desactivar, borrar
```

### Reglas de negocio: no se inventan aquí

`shelf.js` está portado de `LunitecaV3.jsx` de la Puchi actual: reparto por estado,
agrupación por año, orden, filtros y sobre todo `statusPatch` — qué fechas se rellenan
solas al cambiar de estado y cuándo suma una lectura. **Las dos Lunitecas escriben en
las mismas tablas**, así que cambiar esto aquí las desincroniza. Lo que sí es nuevo es
la presentación.

### Qué es de quién

- Del **libro** (compartido con todo el club, `PATCH /books/{id}`): título, autor,
  género, año, páginas, sinopsis. Se editan desde el lápiz de la ficha.
- De **tu copia** (`PATCH /shelf/personal/{id}`): estado, fechas, puntuación, notas,
  carpeta, veces leído, progreso **y la portada**. Se tocan directamente en la ficha.
  Que la portada sea personal es a propósito: cada jugador ve la que ha elegido.

### El club es una estantería más

La estantería del club no es otra app: es la misma, con otros libros. `clubShelf.js`
traduce el estado de un libro del club al de una estantería —`active` → *leyendo*,
`proposed` → *por leer*, `finished` → *leído*— y a partir de ahí lo pintan los mismos
componentes que la Luniteca: las tres vistas, la barra de herramientas con su búsqueda
y sus filtros, el vuelo del libro al abrirlo desde los lomos y la misma ficha con la
portada grande y las pastillas. Lo único propio del club es lo que no cabe en una
entrada personal —quién lo propuso, las notas del club, las puntuaciones de todos y las
sesiones—, y eso viaja en `.club` dentro de la entrada traducida.

Lo mismo con proponer un libro: `AnadirLibro` recibe `destino="club"` y manda al
endpoint del club en vez de al de tu estantería. No hay dos altas de libro.

### Hasta qué página, y por qué vive en la sesión

El número que dice hasta dónde hay que llevar leído para la próxima quedada se
guarda en **la sesión en la que se acordó** (`sessions.next_page`), no en el libro:
se decide al cerrar una quedada ("lo dejamos aquí; para la próxima, hasta la 250"),
así que cada sesión deja escrito hasta dónde llegaba la lectura siguiente y el
historial cuenta por dónde fue cada una.

El que vale **ahora mismo** es el de la última sesión **ya celebrada** que dejara uno
apuntado. Lo que se escriba en una quedada que todavía no ha llegado es para después
de esa, no para la que viene. Ese cálculo lo hace el backend y llega ya resuelto en la
entrada del club (`next_page`, `next_page_session_id`, `last_session_id`), para que la
estantería pueda enseñarlo de un vistazo sin pedir las sesiones de cada libro.

El admin lo cambia desde el formulario de la sesión o, más rápido, tocando la propia
banda en la tarjeta o en la ficha — que escribe en esa misma sesión. Sin ninguna
sesión celebrada no hay dónde apuntarlo, y la banda lo dice en vez de fingir que sí.

### Quién puede qué

Dos permisos distintos, los dos del backend:

- **Miembro del club** (`Player.club_member`): abre `/club`. Sin él la entrada no
  aparece en el menú y la pantalla explica por qué; el servidor lo rechaza igual
  (`require_club_member`, 403).
- **Admin** (el jugador que se llama `wander`, tal cual lo decide `require_admin`):
  abre `/admin`, y dentro del club es quien elige la lectura actual, pone fechas y
  notas, gestiona las sesiones y quita libros. Proponer puede cualquier miembro.

Las pantallas solo deciden **qué botones se enseñan**, para no ofrecer acciones que van
a devolver 403. Quien lo impide de verdad es el backend.

## Los gustos de cada uno van con la cuenta

Lo que cada persona elige para mirar —la vista de la estantería, cómo se separan
las secciones— se guarda en su **jugador**, no en el navegador
(`platform/preferencias.jsx`). En localStorage significaba que la misma persona
veía una cosa en el móvil y otra en el ordenador, y que al entrar desde otro
sitio empezaba de cero.

Y valen para todo lo que esa persona mira: si eliges ver la estantería como
lomos, así verás también las de los demás cuando te asomes. Es tu forma de
mirar, no una propiedad de cada estantería.

Van bajo su propia clave (`next`) dentro de `Player.customization`, que es un
objeto compartido con la Puchi actual —ahí guarda el fondo de pantalla, entre
otras cosas— y cuyo endpoint lo **reemplaza entero**. Por eso, antes de escribir
se relee lo que hay y se mezcla: si no, guardar una preferencia se llevaría por
delante lo que la otra app tenga puesto.

## Claro y oscuro

**Todo el color sale de las variables de `@theme` en `index.css`, así que un tema es
exactamente eso: los mismos nombres con otros valores.** Ningún componente sabe en
cuál está. El claro vive en `@theme` (que es donde Tailwind los espera) y el oscuro en
`:root[data-tema="oscuro"]`. Si algún día hace falta un tercero, es otro bloque igual.

El corolario, y la regla que hay que respetar al escribir componentes: **ningún color
escrito a mano**. Lo que se salía de los tokens fue justo lo que hubo que arreglar al
añadir el oscuro:

- El grano de papel del fondo era ruido negro. Sobre un fondo oscuro no se ve y la
  superficie se queda lisa, que es el banding que ese grano evita. Ahora es
  `--textura-papel` y en oscuro son manchas claras.
- Las sombras estaban escritas como `rgba(60,40,20,…)` dentro de cinco componentes.
  Ahora son utilidades con nombre (`sombra-panel`, `sombra-portada`, `relieve-portada`)
  y su tinta es `--color-sombra`, que en oscuro es negro puro.
- El velo de detrás de las hojas usaba `bg-ink/25`, y en oscuro la tinta es casi
  blanca: **aclaraba** el fondo en vez de apagarlo. Token propio, `--color-velo`.
- La barra de estado de iOS es una `<meta>`, no una variable, así que hay que moverla
  a mano: lo hace `platform/tema.js`.

**En oscuro la profundidad se hace con luz, no con sombra.** Un negro sobre casi negro
no se ve. De ahí que la balda de los lomos tenga la cara MÁS clara que el fondo, y que
el filo de las portadas (`--filo-portada`) sea claro en oscuro y pardo en claro.

**El tema de verdad vive en la cuenta**, como el resto de gustos, con una copia en
`localStorage` que `main.jsx` aplica antes del primer pintado: si no, abrir con el
oscuro puesto suelta un fogonazo blanco mientras llega la cuenta.

### El círculo que abre y cierra la luz

El cambio de tema se anima con la View Transitions API: el navegador guarda una foto
de la pantalla de antes, se aplica el cambio y se animan una encima de otra. Es la
única forma de que se vea el contenido nuevo apareciendo; tapando con un color plano,
el contenido sale de golpe al destaparlo.

Tres cosas que no son opcionales, las tres descubiertas midiendo:

1. **Guardar la preferencia va DENTRO de la transición.** Provoca un render de React, y
   su efecto vuelve a aplicar el tema; fuera, eso se cuela antes de que se saque la
   foto del "antes" y las dos fotos salen idénticas: la animación corre entera sin que
   se vea nada.
2. **El grupo de la transición tiene que durar lo mismo que el círculo.** El navegador
   le pone 250 ms por su cuenta y al acabar se lleva las capas por delante: el círculo
   se cortaba a la mitad.
3. **Encima va siempre la foto que se recorta.** Encendiendo se recorta la nueva (la
   luz crece desde el botón); apagando, la de antes (la luz se recoge hacia él). El
   `z-index` de un `::view-transition-*` no se puede tocar desde JS, de ahí el
   `data-transicion` que pone `platform/tema.js`.

`page.screenshot()` **no captura las capas de `::view-transition`**: para verlo hay que
grabar (screencast por CDP en Chromium, vídeo en WebKit).

## Convenciones de interfaz

Fijadas probando en el móvil; cambiarlas sin motivo rompe la coherencia:

- **Todo lo que se abre encima de algo llega desde abajo** (`HojaInferior` para lo
  corto, `PantallaInferior` para la ficha y añadir libro): filtros, estado, fechas,
  carpeta, portada y la propia ficha del libro. Mismo sitio, mismo gesto para cerrar.
- **Ninguna llega hasta arriba del todo.** Queda una franja de la pantalla de debajo a
  la vista, difuminada (`backdrop-blur`), como las hojas del propio iPhone: recuerda
  que lo de abajo sigue ahí y que eso se cierra. En un móvil con notch la franja es la
  zona segura, que ya deja el hueco justo bajo la barra de estado. Medido con 300
  lomos detrás: el difuminado no cuesta nada (61 fps con y sin él, CPU a 1/4).
- **El gesto de arrastrar para cerrar vive en el asa, nunca en el panel.** El `drag` de
  Motion le pone `touch-action` al elemento, y si ese elemento es el que scrollea, el
  contenido deja de poder desplazarse con el dedo. Ver `ui/arrastre.js`.
- **Cada capa que se abre mete una entrada en el historial** para que el gesto de volver
  la cierre (`platform/capas.js`). Un único listener de `popstate` y una pila: si no,
  un solo "atrás" cierra varias capas a la vez, porque el evento llega a todas.
- **Puntuar y ajustar páginas: mantener pulsado, se amplía, arrastrar, soltar guarda.**
  Un toque suelto no cambia nada — están dentro de zonas que se scrollean con el dedo.
- **Nunca `<input type="date">`**: el nativo de iOS lleva años roto. Tres `<select>` de
  día/mes/año, como el `CustomDateInput` de la Puchi actual.
- **Los `<select>` llevan `appearance: none`** y flecha propia: sin eso iOS los pinta
  con su estilo y se saltan el redondeo del resto de la app.
- **Las listas largas de `<option>` se montan un frame después** de que aparezca la
  hoja. Con 300 libros son ~387 opciones y se comían los primeros fotogramas.
- **Un solo color de fondo, plano.** Hubo un degradado y hacía que la cabecera pareciera
  de otro color.
- Paleta y tipografía: los tokens de `index.css` salen de la Luniteca nueva
  (`--luni3-*`), y los títulos van en Public Sans, la misma que usa allí.

## La vista de estantería (lomos)

Es la tercera vista de la Luniteca y vive entera en `screens/luniteca/Lomos.jsx` +
`colorPortada.js` + `medirTexto.js`. Está aparte **a propósito**: si no acaba de
convencer, se borran esos tres archivos y su entrada en el selector de vista, y las
otras dos siguen exactamente igual.

**La balda es un canto, no una línea.** Se dibuja con un `repeating-linear-gradient`
que se repite cada fila, así que no hay que partir los libros en filas a mano ni saber
cuántos caben. Y tiene cuatro piezas, que es lo que tiene un canto de verdad: la sombra
donde los libros la tocan, el filo de luz, la cara y la sombra que proyecta debajo
(`--balda-*`). En oscuro se invierte: la cara queda MÁS clara que el fondo.

**Los lomos se dibujan, no se buscan.** No existe ninguna fuente de imágenes de lomos
por ISBN: Open Library y Google Books sirven la portada (la cara frontal), y el lomo
solo aparece en las contadísimas ediciones con la sobrecubierta entera escaneada. Así
que cada lomo se construye con los datos del libro:

- **Grosor** por páginas (26–56px), **alto** variable (134–180px, aparte del grosor:
  dos libros igual de gordos pueden tener formatos distintos) y **tapa dura** (lomo
  redondeado con nervios) a partir de 500 páginas. La escala se subió entera porque con
  22–46px el título salía pegado a los cantos y había que achicar mucho la letra; el
  orden lo siguen mandando las páginas, un libro de 700 nunca es más fino que uno de
  300. Uno de cada siete va **torcido**, y el ancho
  extra que ocupa al inclinarse se le reserva al lado que toca: son libros físicos y no
  pueden atravesar al vecino.
- **Color** sacado de la **franja izquierda de la portada** (`colorPortada.js`), que es
  por donde continúa el lomo en un libro real. Un promedio de la portada entera saldría
  gris. Limitación conocida: solo funciona con portadas del mismo origen (las cacheadas
  en `/uploads`); con una de `covers.openlibrary.org` el navegador prohíbe leer los
  píxeles del canvas y se usa un color estable sacado del título. Lo suyo, cuando esto
  se asiente, es calcularlo en el servidor al cachear la portada.
- **Tipografía** por género (ensayo e historia → romana; cómic → condensada de palo;
  fantasía → Cinzel, capitales romanas, que es lo que llevan de verdad esos lomos) y,
  si no se sabe, una de las cuatro generales, estable por autor. La de la portada no se
  puede detectar: es una imagen. Cinzel vive **fuera** de la lista del sorteo: si
  entrara en ella le tocaría también a una novela negra. Y como no tiene caja baja, en
  esos lomos el nombre del autor va en Libre Baskerville (`familiaAutor`).

### El reparto del texto

Es la parte con más reglas, y todas salieron de mirar capturas y medir. En orden de
importancia:

- **Los renglones los parte el código, no el navegador.** Cada uno se pinta en su
  propio elemento, con su ancho y su interlineado en píxeles, así que el número de
  renglones y el ancho del bloque son los que dice la cuenta y no lo que decida cada
  motor. Dejándoselo al navegador, Safari no repartía igual que Chrome: metía cinco
  renglones donde la cuenta permitía tres y el título se salía del lomo por los dos
  lados (medido: -7,7px) mientras en Chrome se veía perfecto.
- **El reparto se hace palabra a palabra**, igual que lo haría el navegador: se meten
  palabras mientras quepan y se salta de renglón cuando una no entra. Dividir el largo
  total entre el disponible se quedaba corto ("El nombre del viento" necesitaba cuatro
  renglones donde la cuenta decía tres) y además un título de una sola palabra
  ("Beloved") no puede partirse en dos.
- **Se mide el texto de verdad**, con canvas (`medirTexto.js`), no con un "ancho de
  letra media" por tipografía: esa estimación fallaba por los dos lados, cortando unos
  títulos y dejando otros en letra de hormiga. Se mide a 100px y se guarda el ancho por
  punto de tamaño, con caché.
- **Y se mide con la fuente de verdad**, que tiene más miga de la que parece:
  `document.fonts.ready` no vale (solo espera a las fuentes que ya se estaban usando, y
  las de los lomos empiezan a cargarse justo al pintar el primer lomo) y
  `document.fonts.check` tampoco (en WebKit contesta que sí antes de tiempo: decía que
  Libre Baskerville estaba lista mientras el navegador seguía pintando con Georgia, más
  estrecha, y la cuenta daba por bueno un renglón de 104px en un hueco de 96). Lo único
  fiable es esperar a que resuelva el propio `fonts.load` de esa fuente concreta;
  mientras tanto se usa la estimación **sin guardarla** en la caché, y al llegar la
  fuente se repinta. El repintado viaja **como prop hasta cada lomo**: están memoizados
  y sin eso se quedaban con el reparto hecho a ojo.
- **Manda el título**: se busca el tamaño más grande que quepa **entero**, en hasta tres
  renglones. Un lomo de verdad parte el título largo, no lo escribe diminuto para que
  quepa de una tirada.
- **El autor va detrás del título a lo largo del lomo, no a su lado.** El texto está de
  canto (`writing-mode: vertical-rl`), así que lo que se apila a lo ancho son los
  renglones del título; el autor se lleva su trozo del **largo**, esté el título en una
  línea o en tres. Confundir esto cortaba títulos.
- **El autor se abrevia antes que desaparecer**: "Gabriel García Márquez" → "G. García
  Márquez" → "García Márquez" → "Márquez". Solo se va si ni el apellido entra. Nunca es
  más grande que el título, y prima que se lea sobre que esté completo: "Márquez" a 7px
  vale más que "G. García Márquez" a 5px.
- **El subtítulo va aparte**, en pequeño y detrás del título, y es lo primero que se cae
  si no hay sitio. Metiéndolo en el mismo texto, "Apocalipsis Z: El principio del fin"
  salía a 9px en un lomo de 37px mientras su vecino, más estrecho, llevaba el título a
  12.
- **Nada de palabras viudas**: si el último renglón se queda con una palabra de dos
  letras ("APOCALIPSIS" y debajo una "Z" suelta), se baja hasta tres puntos de letra
  para juntarlo. Cada mejora tiene su precio en tamaño, porque lo que manda sigue siendo
  que el título se lea: juntar renglones **no** vale ninguno (solo se prefiere a igualdad
  de tamaño), y pagando un punto por ello los títulos salían de una tirada pero más
  pequeños y con el lomo medio vacío.
- **Los márgenes**: arriba y abajo, un 9% del alto del libro (con 8px fijos el título
  quedaba pegado al canto en los lomos altos); a los lados, 4px, que sin ellos el texto
  queda pegado al canto y, con la curvatura y la sombra del lomo, parece cortado. El
  hueco entre título y autor (`SEPARACION_AUTOR`) lo reservan **la cuenta y el layout
  con la misma constante**: cuando solo lo reservaba la cuenta, se leía "SALVAJESR.
  Bolaño".

Los anchos se miden **una vez por libro** y luego solo se multiplican: el reparto prueba
muchas combinaciones de tamaño, nombre y renglones, y medir dentro de ese bucle costaba
160 ms de más con 300 libros (CPU a 1/4).

**Las pruebas se pasan en los dos motores** (`MOTOR=webkit` en los scripts de
`/tmp/luni-test`). Casi todo lo de arriba se descubrió porque durante días se probó solo
en Chromium mientras el fallo se veía en Safari. Los lomos llevan `data-parte` en cada
pieza (`titulo`, `renglon`, `subtitulo`, `autor`) para que las pruebas no dependan de
clases ni de estilos.

Medido con 20 libros de anchos y títulos variados (`lomos-aire.mjs`), 87 en el barrido
general (`barrido.mjs`) y 216 combinaciones de título, tipografía y grosor
(`tipos-titulos.mjs`), en Chromium y en WebKit: 20 de 20 enseñan autor, ningún texto
cortado, ningún libro solapado, el texto nunca a menos de 3px del canto lateral ni de
12px del de arriba, y los tochos llevan el título a 10–16px en vez de a 6.

### Legibilidad sobre la portada

- **La tinta la decide la portada**: por encima del 58% de luminosidad (la real de la
  franja, que `colorPortada` devuelve junto al color) el lomo se trata como un libro
  de cubierta clara y el título va en negro. Antes era siempre blanco y en una
  portada gris o crema no se leía.
- **Un velo del propio color del lomo calma la portada estirada.** Esa franja trae
  las bandas horizontales del diseño (cielo, tierra, la faja de color) y con tanto
  contraste el texto competía con ellas.
- El promedio de color **ignora los píxeles transparentes**. Sin eso, una portada con
  alfa (un PNG recortado, un SVG) se iba a negro: el tono salía bien pero la
  luminosidad daba 3 sobre 100, y con ella la decisión de la tinta.

Otros detalles de encuadernación: **cabezada** (el hilo trenzado que asoma arriba y
abajo) en los de tapa dura, y **la tipografía se elige por autor, no por libro**, para
que los tomos del mismo escritor se vean de la misma colección, como en una balda de
verdad (la clave es el apellido en minúsculas y sin acentos, para que "James Islington"
e "Islington" no salgan con dos diseños distintos).

Descartado por el camino: la franja de canto de páginas en el borde derecho del lomo.
Quedaba rara — en una balda con los libros metidos ves el lomo y nada más.

Lo que queda por hacer en esta vista está en
[issue #20](https://github.com/wandering-code/puchi/issues/20).

## Rendimiento: lo medido

Con Playwright, CPU a 1/4 y una estantería de 300 libros:

- Las tarjetas y secciones van con `memo` y handlers estables. Sin eso, plegar una
  sección bloqueaba 346 ms.
- **Las tarjetas no son componentes de Motion.** Se midió sustituyéndolas: 300
  `motion.button` eran casi todo el coste de teclear en el buscador. El "hundido" al
  tocar es una transición CSS.
- Las cinco estrellas son **un solo SVG** con el relleno recortado, no cinco con su
  gradiente: en una estantería de 300 eran 1.500 SVG.
- Resultado: teclear en el buscador y plegar secciones no producen ningún bloqueo;
  cambiar de cuadrícula a lista cuesta 425 ms (era 752), que es remontar las 300
  tarjetas. Bajarlo pide virtualizar y no compensa todavía.

**Al medir, calienta primero.** La primera apertura de cualquier cosa paga su montaje,
y comparar "la primera vez" contra "las siguientes" lleva a culpar a quien no es (aquí
pasó: parecía el grano del fondo y era el montaje).

### Nada se monta dentro del gesto

Todo lo que se abre encima —el menú lateral, las hojas, la ficha de un libro— vive
montado, apartado de la pantalla, inerte y sin recibir toques, y al abrirse solo se
mueve. Antes se montaba y desmontaba con `AnimatePresence`, y construirlo caía dentro
del propio toque.

Lo que costaba, medido en WebKit sobre la build de producción (mediana de la tarea que
ocupa el toque, ocho aperturas):

| | antes | ahora |
|---|---|---|
| abrir el menú lateral | 21 ms | 5 ms |
| abrir la hoja de filtros | 20 ms | 6 ms |
| abrir la ficha de un libro | 21 ms | 8 ms |

En frames: el menú y las hojas pasaron de perder uno o dos por apertura a no perder
ninguno. La ficha aún pierde uno de ~30 ms que no es suyo —abrir el mismo libro cuesta
igual que abrir otro, y quitarle el velo, el difuminado, la sombra o el tamaño no
cambia nada—: es el precio de animar un panel así en WebKit.

Tres cosas que costaron tiempo y conviene no repetir:

- **Chromium no sirve para juzgar esto.** Con la CPU sin frenar, Chromium abría la
  ficha sin perder un solo frame mientras WebKit perdía dos en cada apertura. Wander
  usa Safari: lo que no se ve en WebKit no está medido.
- **No era el contenido.** Quitarle a la ficha la mitad de lo que lleva dentro ahorraba
  2 ms de 22. El gasto está en levantar el armazón, no en llenarlo. Por eso las hojas
  mantienen montado el armazón pero esperan al primer uso para montar lo de dentro: una
  ficha lleva cuatro colgando (estado, fechas, carpeta, lecturas) que casi nunca se abren.
- **Los frames largos sueltos engañan.** Medir "el peor frame de una apertura" tiene
  tanto ruido (28-67 ms para el mismo código) que hace parecer buenas variantes que no
  cambian nada. Sirve la mediana de muchas repeticiones, o mejor, el tiempo que ocupa la
  tarea del toque: se mide poniendo un listener en captura y un `setTimeout(0)` dentro,
  y es estable a ±2 ms.

Y una consecuencia para los tests: con las capas montadas siempre, `isVisible()` ya no
significa "abierta" —el panel está en el DOM, solo que fuera de pantalla—. Se comprueba
con `[role="dialog"]:not([inert])` o mirando dónde cae su caja.

### Estado de este componente al re-renderizar

Que una capa esté abierta es estado de React, y de quien lo tenga cuelga lo que se
vuelve a renderizar. El `Shell` guardaba el estado del menú y renderizaba también las
rutas: cada pulsación del menú volvía a renderizar la Luniteca entera, ~85 ms con 120
libros. Las rutas están ahora en un `useMemo` con la ubicación como única dependencia,
así que el elemento es el mismo objeto entre renders y React se salta ese subárbol.

## Desarrollo

```bash
cd frontend-next
npm install
npm run dev -- --strictPort   # https://<ip-lan>:5176/next/
```

- Escucha en `0.0.0.0`: se abre desde el móvil con la IP LAN del Mac
  (`ipconfig getifaddr en0`), no con `localhost`.
- HTTPS reutilizando los certificados mkcert de `frontend/certs/` (no versionados).
  Sin HTTPS el móvil no deja instalar la PWA ni usar la cámara.
- El puerto 5176 no choca con el 5175 del frontend actual: los dos pueden correr a la vez.
- `/api`, `/ws` y `/uploads` van por proxy al backend local (`localhost:8001`), que se
  levanta desde la raíz del repo con `docker compose up`.
- `npm run build && npm run preview` sirve el `dist/` real en el puerto 5177: es la
  única forma de probar la PWA (service worker y manifest están desactivados en `dev`).

**Si un cambio "no se ve", mira primero la versión.** Ajustes → Diagnóstico enseña el
commit que está corriendo (`versión`) y cuándo se compiló. Con el service worker por
medio, el 5177 y la app instalada en el móvil pueden quedarse en una versión vieja sin
que se note —el `registerType` es `prompt`, así que no se actualiza hasta aceptar el
aviso—, y entonces lo que se mide en local y lo que se ve en el móvil no son el mismo
código. Para desarrollo, el 5176 va siempre al día.

**El sello de versión va en vivo en dev.** `__VERSION__` se calcula al arrancar Vite y
se queda congelado: se sigue commiteando y el sello sigue enseñando el commit de
entonces, que engaña más que no poner nada. Por eso hay un endpoint `/next/__version`
(plugin `selloEnCaliente` en `vite.config.js`) que lo devuelve al momento, y la app lo
consulta cuando corre en dev.

**Si un dispositivo se queda atascado en una versión vieja: `/limpiar`.** Un service
worker registrado en el origen de dev —de alguna prueba con el build— cachea el
arranque y sirve una copia congelada para siempre. Intercepta TODA navegación bajo
`/next/`, así que recargar no arregla nada, ni con `?v=`, ni con recarga forzada: no
hay forma de salir desde el propio navegador. Pasó de verdad, con un iPhone 31 commits
por detrás. `https://<ip>:5176/limpiar` vive FUERA de `/next/` —que es justo lo que la
salva, porque el scope del service worker es `/next/`— y desde ahí se desregistra todo.
Además, en dev la app desregistra al arrancar cualquier service worker que encuentre,
que cubre las próximas veces pero no la actual (un dispositivo atascado tiene código
viejo que por definición no lo trae).

**Arranca el dev con `--strictPort`.** Si el 5176 está ocupado, Vite se mueve solo al
siguiente y te deja mirando una versión vieja en el puerto de antes sin avisar. Pasó,
con tres servidores apilados a la vez.

**Prueba en los dos motores.** Chromium y WebKit no maquetan igual, y hay fallos que
solo se ven en uno: el texto de los lomos se salía por los lados en Safari mientras en
Chrome estaba perfecto (84 casos de 216 contra 0), y estuvo días así porque todas las
pruebas corrían en Chromium. Los scripts de `/tmp/luni-test` aceptan `MOTOR=webkit`.

### Probar en el móvil

Lo que solo se puede comprobar en un iPhone de verdad (teclado, rebote elástico, safe
areas) tiene su panel en **Ajustes → Diagnóstico**: si la app va instalada o en pestaña,
las safe areas medidas, el viewport y `--kb`.

Y al escribir pruebas automáticas de gestos, **usa eventos táctiles de verdad**. Un test
que desplazaba con `scrollTo()` dio por bueno un scroll que en el móvil no funcionaba.

### Lo que no se toca sin probar en un iPhone

`src/platform/viewport.js` está portado tal cual de la Puchi actual y resume la issue
#13 entera: no se compensa el paneo del teclado de iOS, el contenido se aparta con
`padding-bottom` (nunca encogiendo la caja), y lo que sube con el teclado se oculta.
`index.html` lleva `viewport-fit=cover` e `interactive-widget=resizes-content`.

## Despliegue (mini PC)

**Desplegada y conviviendo con la Puchi actual** desde el 8/9/2026 (al día el 9/9/2026,
con la parte social, los gustos por cuenta y todo lo de rendimiento):
`puchi.wanderingcode.dev/next`. Mismo puerto nginx (3003) y mismo Cloudflare Tunnel que
la Puchi actual —esta versión no gasta ningún puerto nuevo del registro de
`dev-standards`—, mismo backend y misma base de datos. La de siempre sigue en la raíz y
no se ha tocado nada suyo: son dos frontales sobre el mismo servidor.

```bash
ssh minipc
cd /home/wander/apps/puchi
git checkout -- frontend-next/package-lock.json   # npm lo ensucia en el servidor
git pull
cd frontend-next && npm install && npm run build
```

Si el despliegue trae también cambios de backend (`/books/{id}/lecturas` los trajo),
hay que recrear su contenedor, y eso corta unos segundos la Puchi actual, que comparte
el mismo backend:

```bash
cd /home/wander/apps/puchi
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d backend
```

`docker-compose` con guion: el plugin `docker compose` no existe en el mini PC. Las
migraciones corren solas al arrancar, no hay paso manual. Para comprobar que ha ido
bien: la Puchi de siempre debe seguir dando 200 en `/`, `/next/` también, y el bundle
que sirve `/next/` debe llevar dentro el hash del commit desplegado.

En `/etc/nginx/sites-available/puchi`, dentro del mismo `server` que ya sirve la Puchi
actual (el orden no importa: `location /next/` es más específica que `location /`, y
nginx elige por prefijo más largo):

```nginx
location /next/ {
    alias /home/wander/apps/puchi/frontend-next/dist/;
    try_files $uri $uri/ /next/index.html;
}

# El service worker y el manifest nunca se cachean: si el navegador se queda con un
# sw.js viejo, deja de enterarse de los despliegues nuevos — que es justo el problema
# que el service worker viene a resolver.
location = /next/sw.js {
    alias /home/wander/apps/puchi/frontend-next/dist/sw.js;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
location = /next/manifest.webmanifest {
    alias /home/wander/apps/puchi/frontend-next/dist/manifest.webmanifest;
    add_header Cache-Control "no-cache";
}
```

`sudo nginx -t && sudo systemctl reload nginx`. No hay que tocar cloudflared: el
subdominio y el túnel ya existen.

Para volver atrás, la configuración anterior queda guardada al lado
(`/etc/nginx/sites-available/puchi.bak-<fecha>`): basta con restaurarla y recargar. La
Puchi actual no depende de nada de esto.

Tras desplegar conviene comprobar las dos, que es lo que se hizo la primera vez:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://puchi.wanderingcode.dev/        # la de siempre
curl -s -o /dev/null -w '%{http_code}\n' https://puchi.wanderingcode.dev/next/   # la nueva
```

## Cuando esta versión sustituya a la actual

1. Borrar `frontend/`, renombrar `frontend-next/` → `frontend/`.
2. Quitar `base: '/next/'` de `vite.config.js`, el `basename` de `main.jsx` y el
   `scope`/`start_url`/`id` del manifest.
3. Quitar el `location /next/` de nginx.
4. Avisar de que el icono guardado en pantalla de inicio apuntando a `/next` deja de
   valer y hay que volver a guardarlo desde la raíz.
