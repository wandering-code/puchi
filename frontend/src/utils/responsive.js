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

// Preferencia de "ocultar la barra inferior de apps" en modo móvil/tablet
// (MobileBottomNav en GatOS.jsx) — pensada para quien casi siempre usa solo
// Luniteca desde el móvil y prefiere aprovechar esos ~64px de más. Ajustes
// sigue accesible igual (se entra desde el menú GatOS, no desde esta barra),
// así que ocultarla nunca deja sin forma de volver a mostrarla. Mismo
// criterio que el modo tablet: por dispositivo, no por cuenta.
const BOTTOM_NAV_EVENT = 'gatos:bottomnav'
function bottomNavKey(playerId) {
  return `gatos_hide_bottom_nav_${playerId}`
}
export function getBottomNavHidden(playerId) {
  if (!playerId) return false
  return localStorage.getItem(bottomNavKey(playerId)) === '1'
}
export function setBottomNavHidden(playerId, hidden) {
  if (!playerId) return
  if (hidden) localStorage.setItem(bottomNavKey(playerId), '1')
  else localStorage.removeItem(bottomNavKey(playerId))
  window.dispatchEvent(new Event(BOTTOM_NAV_EVENT))
}
export function useBottomNavHidden() {
  const playerId = useAuth()?.player?.id
  const [hidden, setHidden] = useState(() => getBottomNavHidden(playerId))
  useEffect(() => {
    setHidden(getBottomNavHidden(playerId))
    function onPrefChange() { setHidden(getBottomNavHidden(playerId)) }
    window.addEventListener(BOTTOM_NAV_EVENT, onPrefChange)
    return () => window.removeEventListener(BOTTOM_NAV_EVENT, onPrefChange)
  }, [playerId])
  return hidden
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
