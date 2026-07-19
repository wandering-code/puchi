import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

// Los certificados mkcert son solo para HTTPS en desarrollo local y no se
// suben al repo (frontend/certs/ está en .gitignore) — sin ellos, `vite build`
// en un servidor de producción fallaría al leer el config.
const hasCerts = fs.existsSync('./certs/key.pem') && fs.existsSync('./certs/fullchain.pem')

export default defineConfig({
  plugins: [react()],
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
