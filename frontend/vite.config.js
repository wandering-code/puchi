import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5175,
    https: {
      key:  fs.readFileSync('./certs/key.pem'),
      cert: fs.readFileSync('./certs/fullchain.pem'),
    },
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
