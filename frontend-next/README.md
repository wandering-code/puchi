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

## Stack

Vite + React 19 + Tailwind 4 + [Motion](https://motion.dev) + React Router 7 + PWA
(`vite-plugin-pwa`). Se compila a `dist/` estático — no lleva Dockerfile, lo sirve
nginx directamente, igual que el frontend actual.

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

## Móvil: lo que no se toca sin probar en un iPhone de verdad

`src/platform/viewport.js` está portado tal cual de la Puchi actual y resume la issue
#13 entera. Las reglas: no se compensa el paneo del teclado de iOS, el contenido se
aparta con `padding-bottom` (nunca encogiendo la caja), y la barra inferior se oculta
mientras se escribe en vez de pelearse con el teclado. `index.html` lleva
`viewport-fit=cover` (sin él las safe areas valen 0 y la barra de gestos se come el
borde inferior en la app instalada) e `interactive-widget=resizes-content`.

La pantalla de **Ajustes** muestra un panel de diagnóstico con los valores que solo se
pueden comprobar en el dispositivo real: si la app va instalada o en pestaña, las safe
areas medidas, el tamaño del viewport y `--kb`.

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
subdominio y el túnel ya existen.

## Cuando esta versión sustituya a la actual

1. Borrar `frontend/`, renombrar `frontend-next/` → `frontend/`.
2. Quitar `base: '/next/'` de `vite.config.js`, el `basename` de `main.jsx` y el
   `scope`/`start_url`/`id` del manifest.
3. Quitar el `location /next/` de nginx.
4. Avisar de que el icono guardado en pantalla de inicio apuntando a `/next` deja de
   valer y hay que volver a guardarlo desde la raíz.
