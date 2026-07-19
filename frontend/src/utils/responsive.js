import { useState, useEffect } from 'react'

export const MOBILE_BREAKPOINT = 768

// Única fuente de verdad para móvil vs desktop: ancho de viewport, reactivo
// a resize/rotación (también permite ver el modo móvil encogiendo la
// ventana del navegador en desktop).
export function useIsMobile() {
  const query = `(max-width: ${MOBILE_BREAKPOINT}px)`
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e) => setIsMobile(e.matches)
    mql.addEventListener('change', onChange)
    setIsMobile(mql.matches)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return isMobile
}
