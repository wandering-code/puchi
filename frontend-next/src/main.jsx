import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AuthProvider } from './platform/auth'
import { PreferenciasProvider } from './platform/preferencias'
import { ASPECTO, aplicarAspecto, aplicarTema, aspectoGuardado, temaGuardado } from './platform/tema'
import { EVENTO_DE_TEMPORADA, aplicarEvento, decoracionGuardada } from './eventos'
import { puedeVer } from './screens/secciones'

// Antes de montar nada: el tema tiene que estar puesto en el primer pintado.
// El que manda es el de la cuenta, pero esa tarda en llegar del servidor, así
// que se arranca con la copia local y el proveedor lo corrige si no coincide.
aplicarTema(temaGuardado())
// Y el resto del aspecto (acento, textura, portadas), por lo mismo.
for (const que of Object.keys(ASPECTO)) aplicarAspecto(que, aspectoGuardado(que))
// Y la decoración de temporada (Halloween…), por lo mismo: que el splash y el
// login ya salgan disfrazados, o sin disfrazar si alguien la apagó.
if (EVENTO_DE_TEMPORADA) aplicarEvento(EVENTO_DE_TEMPORADA, decoracionGuardada(EVENTO_DE_TEMPORADA))

// La pantalla de arranque (Ajustes), puesta en la URL ANTES del primer render.
// La colocaba un efecto del Shell después de pintar, así que al abrir la app
// desde el icono (que siempre entra por la raíz) se veía Inicio un momento y
// luego se iba: medido, ~300ms de Inicio más su salida antes de la Luniteca.
// Con la cuenta guardada se sabe ya cuál es; el efecto del Shell sigue ahí
// para cuando se entra recién iniciada la sesión. Mismas reglas que él: solo
// por la raíz, solo si esa sección se puede ver, y sin dejar Inicio en el
// historial.
try {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const guardado = JSON.parse(localStorage.getItem('luni_player') || 'null')
  const inicio = guardado?.customization?.next?.inicio
  if (inicio && inicio !== '/' && location.pathname.replace(/\/$/, '') === base && puedeVer(guardado, inicio)) {
    history.replaceState(history.state, '', base + inicio)
  }
} catch { /* sin localStorage, se arranca en Inicio como siempre */ }

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
