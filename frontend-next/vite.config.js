import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import { resolve } from 'path'

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

export default defineConfig({
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
