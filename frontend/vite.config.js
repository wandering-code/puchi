import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import { resolve } from 'path'

// Los certificados mkcert son solo para HTTPS en desarrollo local y no se
// suben al repo (frontend/certs/ está en .gitignore) — sin ellos, `vite build`
// en un servidor de producción fallaría al leer el config.
const hasCerts = fs.existsSync('./certs/key.pem') && fs.existsSync('./certs/fullchain.pem')

// Un identificador de build, no un número de versión real (no hay control de
// versiones semántico en este repo). Sirve solo para que el cliente sepa que
// hay un build más nuevo en el servidor — ver src/utils/useVersionCheck.js.
// Mismo mecanismo ya usado en el proyecto pokemongo.
const APP_VERSION = String(Date.now())

// iOS cachea de forma agresiva el arranque de las apps guardadas en pantalla
// de inicio (Safari a veces ni revalida contra el servidor, aunque
// index.html se sirva con Cache-Control: no-cache) — de ahí que hasta ahora
// hubiera que borrar y volver a guardar el icono para ver cambios (ver
// Pendiente en ESTADO_ACTUAL.md). Este plugin escribe version.json en dist/
// en cada build; el cliente lo consulta periódicamente y avisa si hay una
// versión más reciente que la que tiene cargada.
function versionFilePlugin() {
  return {
    name: 'version-file',
    writeBundle(options) {
      fs.writeFileSync(
        resolve(options.dir, 'version.json'),
        JSON.stringify({ version: APP_VERSION })
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), versionFilePlugin()],
  // Un `define` con un identificador global suelto (p.ej. `__APP_VERSION__`)
  // no se sustituye en modo dev con esta versión de Vite (comprobado: el
  // código se sirve tal cual, sin reemplazar) — solo funciona así en
  // `vite build`. Apuntando en cambio a una clave de `import.meta.env`, Vite
  // sí la inyecta también en dev (mismo objeto runtime que ya usa para
  // `import.meta.env.MODE`/`DEV`/etc.), así que el aviso de versión nueva
  // también se puede probar sin necesidad de un build real.
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION),
  },
  server: {
    host: '0.0.0.0',
    port: 5175,
    ...(hasCerts && {
      https: {
        key: fs.readFileSync('./certs/key.pem'),
        cert: fs.readFileSync('./certs/fullchain.pem'),
      },
    }),
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/ws': {
        target: 'http://localhost:8001',
        ws: true,
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      }
    }
  }
})
