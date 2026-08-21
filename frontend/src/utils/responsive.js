import { useState, useEffect } from 'react'
import { useAuth } from './auth'

export const MOBILE_BREAKPOINT = 768

// Preferencia de "modo tablet": fuerza el mismo shell táctil que ya usa el
// móvil (una app a pantalla completa + lanzador, sin ventanas flotantes) en
// pantallas anchas donde el viewport por sí solo no lo activaría (p.ej. un
// iPad). Vive en localStorage, no en el backend — es una propiedad física de
// esta pantalla/dispositivo, no algo que deba viajar con la cuenta a otros
// dispositivos. Namespaced por jugador igual que el resto de preferencias de
// GatOS en localStorage (gatos_mobile_tab_<id>, gatos_launcher_pos_<id>),
// por si el mismo dispositivo lo usan varias personas de la familia.
const WINDOW_MODE_EVENT = 'gatos:windowmode'
function windowModeKey(playerId) {
  return `gatos_window_mode_${playerId}`
}
export function getWindowModePref(playerId) {
  if (!playerId) return 'auto'
  return localStorage.getItem(windowModeKey(playerId)) || 'auto'
}
export function setWindowModePref(playerId, mode) {
  if (!playerId) return
  if (mode === 'auto') localStorage.removeItem(windowModeKey(playerId))
  else localStorage.setItem(windowModeKey(playerId), mode)
  window.dispatchEvent(new Event(WINDOW_MODE_EVENT))
}

// Única fuente de verdad para móvil vs desktop: ancho de viewport (reactivo
// a resize/rotación — encoger la ventana del navegador en desktop también
// activa el modo móvil), forzado además a "true" cuando el jugador ha
// elegido el modo tablet a mano desde Ajustes.
export function useIsMobile() {
  const query = `(max-width: ${MOBILE_BREAKPOINT}px)`
  const playerId = useAuth()?.player?.id
  const [viewportMobile, setViewportMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  )
  const [forcedTablet, setForcedTablet] = useState(() => getWindowModePref(playerId) === 'tablet')

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e) => setViewportMobile(e.matches)
    mql.addEventListener('change', onChange)
    setViewportMobile(mql.matches)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  useEffect(() => {
    setForcedTablet(getWindowModePref(playerId) === 'tablet')
    function onPrefChange() { setForcedTablet(getWindowModePref(playerId) === 'tablet') }
    window.addEventListener(WINDOW_MODE_EVENT, onPrefChange)
    return () => window.removeEventListener(WINDOW_MODE_EVENT, onPrefChange)
  }, [playerId])

  return viewportMobile || forcedTablet
}
