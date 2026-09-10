import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AuthProvider } from './platform/auth'
import { PreferenciasProvider } from './platform/preferencias'

// En dev no hay service worker (devOptions está desactivado), así que si hay
// uno registrado es basura de alguna prueba con el build servida en este mismo
// origen. No es inofensivo: la PWA cachea el arranque y sigue sirviendo esa
// copia congelada aunque el servidor tenga otra cosa, e intercepta también las
// recargas, así que no hay forma de salir desde el propio navegador. Se
// desregistra y se recarga una vez.
//
// Cuando el que está atascado es un dispositivo con código viejo (que por
// definición no trae esto), la salida es /limpiar, que vive fuera de /next/ y
// el service worker no puede interceptar.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(async regs => {
    if (!regs.length) return
    await Promise.all(regs.map(r => r.unregister()))
    if (window.caches) {
      const claves = await caches.keys()
      await Promise.all(claves.map(k => caches.delete(k)))
    }
    location.reload()
  }).catch(() => {})
}

// basename: la app vive bajo /next/ mientras conviva con la Puchi actual.
// Sin esto el router creería que la ruta es "/next/algo" y no encontraría
// ninguna de sus rutas. Se quita el día de la unificación, con el base de
// vite.config.js y el scope del manifest.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/next">
      <AuthProvider>
        <PreferenciasProvider>
          <App />
        </PreferenciasProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
