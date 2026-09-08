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
  búsqueda, filtros y orden, ficha del libro con todo lo editable, y edición de los
  datos del libro y su portada.
- **PWA**: manifest con iconos maskable, service worker y safe areas, para que añadida
  a la pantalla de inicio se comporte como una app.
- **Avisos en vivo**: un WebSocket para toda la app (`platform/live.js`), con
  reconexión, que refresca cuando algo cambia desde otro dispositivo o desde la Puchi
  actual.

Lo que falta (añadir libros, importadores, Club y Amigos) está en
[issue #18](https://github.com/wandering-code/puchi/issues/18).

## Cómo está montado

```
src/
├── platform/     lo que no es "pantalla": sesión, API, WebSocket, viewport, capas
├── ui/           piezas sueltas reutilizables (iconos, gesto de arrastre)
└── screens/
    ├── Shell.jsx        armazón: barra superior, menú lateral, rutas
    ├── LoginScreen.jsx
    └── luniteca/        la app de libros
        ├── shelf.js         reglas de negocio (portadas de la Luniteca actual)
        ├── Luniteca.jsx     estantería: carga, filtros, secciones
        ├── BookDetail.jsx   ficha de un libro
        ├── BookEditForm.jsx edición de los datos del libro
        ├── editores.jsx     estado, fechas, carpeta, veces leído, sinopsis
        ├── HojaInferior.jsx la hoja que sube desde abajo (una para toda la app)
        └── piezas.jsx       portada, estrellas, barra de progreso, insignias
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

## Convenciones de interfaz

Fijadas probando en el móvil; cambiarlas sin motivo rompe la coherencia:

- **Todo lo que se abre encima de algo llega desde abajo** (`HojaInferior`): filtros,
  estado, fechas, carpeta, portada y la propia ficha del libro. Mismo sitio, mismo
  gesto para cerrar.
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
- **Tipografía** por género (ensayo e historia → romana; cómic → condensada de palo) y,
  si no se sabe, estable por libro. La de la portada no se puede detectar: es una
  imagen.

### El reparto del texto

Es la parte con más reglas, y todas salieron de mirar capturas:

- **Se mide el texto de verdad**, con canvas (`medirTexto.js`), no con un "ancho de
  letra media" por tipografía. La estimación fallaba por los dos lados: títulos
  cortados por quedarse corta y títulos en letra de hormiga por pasarse. Se mide a
  100px y se guarda el ancho por punto de tamaño, con caché; hasta que
  `document.fonts.ready` resuelve se usa la estimación y luego se repinta.
- **Manda el título**: se busca el tamaño más grande que quepa **entero**, partiéndolo
  en hasta tres renglones si hace falta. Un lomo de verdad parte el título largo, no lo
  escribe diminuto para que quepa de una tirada.
- **El autor va detrás del título a lo largo del lomo, no a su lado.** El texto está de
  canto (`writing-mode: vertical-rl`), así que lo que se apila a lo ancho son los
  renglones del título; el autor se lleva su trozo del **largo**, esté el título en una
  línea o en tres. Confundir esto cortaba títulos.
- **El autor se abrevia antes que desaparecer**: "Gabriel García Márquez" → "G. García
  Márquez" → "García Márquez" → "Márquez". Solo se va si ni el apellido entra.
- **El autor nunca es más grande que el título**, y prima que se lea sobre que esté
  completo: "Márquez" a 7px vale más que "G. García Márquez" a 5px.
- El hueco entre título y autor (`SEPARACION_AUTOR`) lo reservan **la cuenta y el
  layout con la misma constante**: cuando solo lo reservaba la cuenta, se leía
  "SALVAJESR. Bolaño".
- **El subtítulo va aparte**, en pequeño y detrás del título, y es lo primero que
  se cae si no hay sitio. Metiéndolo en el mismo texto, "Apocalipsis Z: El principio
  del fin" salía a 9px en un lomo de 37px mientras su vecino, más estrecho, llevaba
  el título a 12.
- **Entre dos repartos parecidos gana el de menos renglones** (hasta 2px de
  diferencia): "Apocalipsis" con una "Z" suelta debajo se lee peor que el título
  entero dos puntos más pequeño.
- **Los renglones los parte el código, no el navegador.** Cada uno se pinta en su
  propio elemento, con el ancho y el interlineado que le toca en píxeles, así que el
  número de renglones y el ancho del bloque son los que dice la cuenta y no lo que
  decida cada motor. Dejándoselo al navegador, Safari no repartía igual que Chrome:
  metía cinco renglones donde la cuenta permitía tres y el título se salía del lomo por
  los dos lados (medido: -7,7px) mientras en Chrome se veía perfecto.
- **El reparto se hace palabra a palabra, igual que lo haría el navegador**
  (meter palabras mientras quepan y saltar de renglón cuando una no entra). Dividir el
  largo total entre el disponible se quedaba corto: "El nombre del viento" salía a
  cuatro renglones donde la cuenta decía tres, y el bloque acababa siendo más ancho que
  el propio lomo (medido: 50px de texto en un lomo de 45). De paso, un título de una
  sola palabra ("Beloved") ya no se manda a dos renglones, que es imposible.
- **El bloque de renglones se centra ópticamente.** Los renglones se apilan desde el
  canto derecho y cada uno reserva un interlineado entero aunque sus letras ocupen algo
  menos; ese sobrante se quedaba todo del lado izquierdo (medido: 4,5px de aire a un
  lado y 3,3 al otro).
- **El ancho del bloque de renglones se mide en el DOM**, no se deduce: `medidasDeRenglon`
  monta un span de prueba con esa tipografía y mide un renglón y dos, y de ahí salen lo
  que ocupa uno suelto y lo que suma cada uno de más. Deducirlo de las cotas del canvas
  (el dibujo de las letras) se queda corto, porque un renglón ocupa además el
  interlineado y lo que ascendentes y descendentes sobresalen de su caja: la cuenta daba
  28px a un bloque de dos renglones de Archivo Narrow a 12px que en pantalla medía 31, y
  el título acababa a 1,7px del canto. Con 4px de margen a cada lado, que sin ellos el
  texto queda pegado al canto y, con la curvatura y la sombra del lomo, parece cortado.
- **Nada de palabras viudas**: si el último renglón se queda con una palabra de dos
  letras ("APOCALIPSIS" y debajo una "Z" suelta) se prefiere bajar hasta tres puntos de
  letra para juntarlo. Cada mejora tiene su precio en tamaño —juntar renglones solo
  vale un punto— porque lo que manda sigue siendo que el título se lea.
- **El aire de arriba y abajo va con el alto del libro** (9%), no en píxeles fijos:
  con 8px sueltos el título quedaba pegado al canto en los lomos altos.

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

Y las medidas se toman con **la fuente de verdad**, que tiene más miga de la que
parece: `document.fonts.ready` no vale (solo espera a las fuentes que ya se estaban
usando, y las de los lomos empiezan a cargarse justo al pintar el primer lomo) y
`document.fonts.check` tampoco (en WebKit contesta que sí antes de tiempo: decía que
Libre Baskerville estaba lista mientras el navegador seguía pintando con Georgia, más
estrecha, y la cuenta daba por bueno un renglón de 104px en un hueco de 96). Lo único
fiable es esperar a que resuelva el propio `fonts.load` de esa fuente concreta;
mientras tanto se usa la estimación sin guardarla en la caché. El repintado viaja **como prop hasta cada lomo**: están
memoizados y sin eso se quedaban con el reparto hecho a ojo.

Los anchos se miden **una vez por libro** y luego solo se multiplican: el reparto
prueba muchas combinaciones de tamaño, nombre y renglones, y medir dentro de ese bucle
costaba 160 ms de más con 300 libros (CPU a 1/4).

**Las pruebas se pasan en los dos motores** (`MOTOR=webkit` en los scripts de
`/tmp/luni-test`). Todo lo de arriba se descubrió porque durante días se probó solo en
Chromium mientras el fallo se veía en Safari.

Medido con 20 libros de anchos y títulos variados (`/tmp/luni-test/lomos-aire.mjs`) y
con 216 combinaciones de título, tipografía y grosor (`tipos-titulos.mjs`), en
Chromium y en WebKit: 20 de 20 enseñan autor, ningún texto cortado, ningún libro
solapado, el texto nunca a menos de 3px del canto lateral ni de 12px del de arriba, y
los tochos llevan el título a 10–16px en vez de a 6.

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

## Desarrollo

```bash
cd frontend-next
npm install
npm run dev     # https://<ip-lan>:5176/next/
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

Mismo puerto nginx (3003) y mismo Cloudflare Tunnel que la Puchi actual — esta versión
no gasta ningún puerto nuevo del registro de `dev-standards`.

```bash
ssh minipc
cd /home/wander/apps/puchi && git pull
cd frontend-next && npm install && npm run build
```

En `/etc/nginx/sites-enabled/puchi`, **antes** del `location /` que sirve la Puchi actual:

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
subdominio y el túnel ya existen. Checklist de comprobación tras desplegar, en
[issue #17](https://github.com/wandering-code/puchi/issues/17).

## Cuando esta versión sustituya a la actual

1. Borrar `frontend/`, renombrar `frontend-next/` → `frontend/`.
2. Quitar `base: '/next/'` de `vite.config.js`, el `basename` de `main.jsx` y el
   `scope`/`start_url`/`id` del manifest.
3. Quitar el `location /next/` de nginx.
4. Avisar de que el icono guardado en pantalla de inicio apuntando a `/next` deja de
   valer y hay que volver a guardarlo desde la raíz.
