import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AuthProvider } from './platform/auth'
import { PreferenciasProvider } from './platform/preferencias'
import { aplicarTema, temaGuardado } from './platform/tema'

// Antes de montar nada: el tema tiene que estar puesto en el primer pintado.
// El que manda es el de la cuenta, pero esa tarda en llegar del servidor, así
// que se arranca con la copia local y el proveedor lo corrige si no coincide.
aplicarTema(temaGuardado())

// En dev no hay service worker (devOptions está desactivado), así que si hay
// uno registrado es basura de alguna prueba con el build servida en este mismo
// origen. No es inofensivo: la PWA cachea el arranque y sigue sirviendo esa
// copia congelada aunque el servidor tenga otra cosa, e intercepta también las
// recargas, así que no hay forma de salir desde el propio navegador. Se
// desregistra y se recarga una vez.
//
// Cuando el que está atascado es un dispositivo con código viejo (que por
// definición no trae esto), la salida es /limpiar.
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PreferenciasProvider>
          <App />
        </PreferenciasProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
