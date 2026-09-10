import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import { execSync } from 'child_process'
import { resolve } from 'path'

// Sello de versión, visible en Ajustes. Sirve para saber de un vistazo QUÉ
// código está viendo un dispositivo: con el service worker de la PWA por medio,
// un móvil puede quedarse en una versión vieja sin que se note, y entonces las
// pruebas de local y lo que se ve en el móvil no hablan de lo mismo.
function selloDeVersion() {
  try {
    const hash = execSync('git rev-parse --short HEAD').toString().trim()
    const sucio = execSync('git status --porcelain').toString().trim() ? '+' : ''
    return `${hash}${sucio}`
  } catch {
    return 'sin-git'
  }
}

// Los certificados mkcert viven en el frontend actual (frontend/certs/, en
// .gitignore) y se reutilizan aquí: sin HTTPS, el móvil no puede instalar la
// PWA ni usar cámara/portapapeles al probar en LAN. Si no están, dev arranca
// en HTTP igual y `vite build` nunca depende de ellos.
const CERTS = '../frontend/certs'
const hasCerts = fs.existsSync(`${CERTS}/key.pem`) && fs.existsSync(`${CERTS}/fullchain.pem`)

// El backend es el de siempre (docker compose up en la raíz del repo), el
// mismo que usa la Puchi actual en local.
const PROXY = {
  '/api':     { target: 'http://localhost:8001', changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
  '/ws':      { target: 'http://localhost:8001', ws: true, changeOrigin: true },
  '/uploads': { target: 'http://localhost:8001', changeOrigin: true },
}

// En `dev`, el sello de arriba se calcula UNA vez, al arrancar Vite, y se queda
// congelado: se sigue commiteando y Ajustes sigue enseñando el commit de
// entonces, que es peor que no enseñar nada — parece que el navegador tiene
// código viejo cuando el viejo es el sello. Este endpoint lo devuelve al
// momento, y el diagnóstico lo pide cuando corre en dev.
const selloEnCaliente = {
  name: 'sello-en-caliente',
  configureServer(server) {
    server.middlewares.use('/next/__version', (_req, res) => {
      res.setHeader('content-type', 'application/json')
      res.setHeader('cache-control', 'no-store')
      res.end(JSON.stringify({ version: selloDeVersion(), compilado: 'en vivo' }))
    })
  },
}

// Un service worker registrado en el origen de dev (de un `vite preview`, de
// una prueba con el build, de lo que sea) se queda mandando para siempre: la
// PWA cachea el arranque y sirve una copia congelada, y como intercepta TODA
// navegación bajo /next/, recargar no arregla nada — ni con ?v=, ni con
// recarga forzada. Pasó de verdad: un iPhone se quedó 31 commits atrás
// enseñando el build de la víspera mientras el servidor servía lo de hoy.
//
// Esta página vive FUERA de /next/, que es justo lo que la salva: el scope del
// SW es /next/, así que esto no lo puede interceptar y siempre llega del
// servidor. Desde aquí se desregistra todo y se borran las cachés.
const limpiezaDeCachés = {
  name: 'limpieza-de-caches',
  configureServer(server) {
    server.middlewares.use('/limpiar', (_req, res) => {
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.setHeader('cache-control', 'no-store')
      res.end(`<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Limpiar la caché de Puchi</title>
<style>
  body { font: 17px/1.5 -apple-system, system-ui, sans-serif; margin: 0; padding: 2rem 1.5rem;
         background: #f5f1ea; color: #2b2118; }
  h1 { font-size: 1.4rem; margin: 0 0 .5rem }
  pre { background: #fff; border: 1px solid #e3dbd0; border-radius: 12px; padding: 1rem;
        white-space: pre-wrap; font-size: 14px }
  button { font: inherit; font-weight: 600; border: 0; border-radius: 999px; padding: .8rem 1.4rem;
           background: #b5603c; color: #fff; margin-top: 1rem }
  a { color: #b5603c }
</style>
<h1>Limpiar la caché de Puchi</h1>
<p>El servidor está en <b>${selloDeVersion()}</b>.</p>
<pre id="estado">Mirando…</pre>
<button id="limpiar">Borrar y volver a /next/</button>
<p><a href="/next/">Ir a /next/ sin borrar nada</a></p>
<script>
  // Sin saltos de línea escapados dentro de esta plantilla, ni siquiera en un
  // comentario: los resolvería el literal de JS de fuera, partiendo la línea en
  // dos y dejando este script roto (pasó dos veces, y la página se quedaba
  // muda). De ahí el rodeo de fromCharCode.
  var NL = String.fromCharCode(10)
  var estado = document.getElementById('estado')
  async function mirar() {
    var regs = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : []
    var cachés = window.caches ? await caches.keys() : []
    var lineas = ['service workers registrados: ' + regs.length]
    regs.forEach(function (r) { lineas.push('   ' + r.scope) })
    lineas.push('cachés: ' + cachés.length)
    cachés.forEach(function (c) { lineas.push('   ' + c) })
    lineas.push(regs.length + cachés.length === 0
      ? 'Limpio: aquí no hay nada que estorbe.'
      : 'Esto es lo que te está sirviendo una copia vieja.')
    estado.textContent = lineas.join(NL)
    return regs.length + cachés.length
  }
  mirar()
  document.getElementById('limpiar').onclick = async function () {
    estado.textContent = 'Borrando…'
    var regs = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : []
    await Promise.all(regs.map(function (r) { return r.unregister() }))
    if (window.caches) {
      var ks = await caches.keys()
      await Promise.all(ks.map(function (k) { return caches.delete(k) }))
    }
    await mirar()
    location.href = '/next/?limpio=' + Date.now()
  }
</script>`)
    })
  },
}

export default defineConfig({
  define: {
    __VERSION__: JSON.stringify(selloDeVersion()),
    __FECHA_BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
  // Se sirve bajo puchi.wanderingcode.dev/next/ durante toda la convivencia
  // con la Puchi actual. Sin este base los dos builds pedirían /assets/… y
  // chocarían en nginx, que sirve los dos dist/ desde el mismo host.
  // Al unificar (cuando esta versión pase a ser la única) se quita, junto
  // con el scope/start_url del manifest de abajo.
  base: '/next/',
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
  plugins: [
    selloEnCaliente,
    limpiezaDeCachés,
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      // El SW cachea el shell, así que sustituye al parche de version.json
      // del frontend actual: es el propio SW quien detecta el build nuevo y
      // avisa (ver useUpdatePrompt en platform/pwa.js). Sin esto, iOS sigue
      // sirviendo de su caché el arranque de la app guardada en inicio,
      // aunque el servidor mande Cache-Control: no-cache.
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        id: '/next/',
        name: 'Puchi',
        short_name: 'Puchi',
        description: 'Puchi',
        // scope/start_url llevan el prefijo porque la app vive bajo /next/:
        // sin scope correcto, Android abre la PWA y se sale de ella al primer
        // enlace, y iOS la trata como marcador normal.
        scope: '/next/',
        start_url: '/next/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f7f3ee',
        theme_color: '#f7f3ee',
        lang: 'es',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          // maskable = el icono que Android recorta a la forma del launcher
          // (círculo, squircle…). Sin una versión con margen propio, recorta
          // el icono normal y se come los bordes del dibujo.
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Nada de /api ni /uploads en la caché del shell: son datos vivos del
        // backend compartido con la Puchi actual, y servirlos de una caché
        // vieja daría estanterías desactualizadas sin que se note.
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/, /^\/ws/],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: '0.0.0.0',
    // 5175 lo usa el frontend actual — los dos pueden correr a la vez.
    port: 5176,
    ...(hasCerts && {
      https: {
        key: fs.readFileSync(`${CERTS}/key.pem`),
        cert: fs.readFileSync(`${CERTS}/fullchain.pem`),
      },
    }),
    proxy: PROXY,
  },
  // `npm run build && npm run preview` sirve el dist/ real: es la única forma
  // de probar la PWA en local, porque en dev el service worker y el manifest
  // están desactivados (devOptions arriba). Es lo que hay que abrir en el
  // móvil para "Añadir a pantalla de inicio" sin desplegar nada en el mini PC.
  preview: {
    host: '0.0.0.0',
    port: 5177,
    ...(hasCerts && {
      https: {
        key: fs.readFileSync(`${CERTS}/key.pem`),
        cert: fs.readFileSync(`${CERTS}/fullchain.pem`),
      },
    }),
    proxy: PROXY,
  },
})
