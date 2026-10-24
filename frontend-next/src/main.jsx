import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AuthProvider } from './platform/auth'
import { PreferenciasProvider } from './platform/preferencias'
import { aplicarTema, temaGuardado } from './platform/tema'
import { EVENTO_DE_TEMPORADA, aplicarEvento, decoracionGuardada } from './eventos'

// Antes de montar nada: el tema tiene que estar puesto en el primer pintado.
// El que manda es el de la cuenta, pero esa tarda en llegar del servidor, así
// que se arranca con la copia local y el proveedor lo corrige si no coincide.
aplicarTema(temaGuardado())
// Y la decoración de temporada (Halloween…), por lo mismo: que el splash y el
// login ya salgan disfrazados, o sin disfrazar si alguien la apagó.
if (EVENTO_DE_TEMPORADA) aplicarEvento(EVENTO_DE_TEMPORADA, decoracionGuardada(EVENTO_DE_TEMPORADA))

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
    {/* En /kokito las rutas de la app cuelgan de ahí (/kokito/luniteca…);
        en la raíz BASE_URL es '/' y esto queda en '' como siempre. */}
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <AuthProvider>
        <PreferenciasProvider>
          <App />
        </PreferenciasProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
