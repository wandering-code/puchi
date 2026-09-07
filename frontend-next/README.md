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
  leídos agrupados por año, cuadrícula o lista, búsqueda, filtros y orden, ficha del
  libro con todo lo editable, y edición de los datos del libro y su portada.
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
