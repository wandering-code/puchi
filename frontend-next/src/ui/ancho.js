import { useEffect, useState } from 'react'

// ¿Hay sitio para poner dos cosas una al lado de la otra?
//
// Casi toda Puchi se usa desde el móvil y se diseña para una columna, pero
// Diskordkito no: hablar se hace desde la tablet o el ordenador. Con ancho de
// sobra, abrir una conversación TAPANDO la lista es desperdiciar media
// pantalla — ahí caben las dos.
//
// 900px y no un breakpoint de Tailwind cualquiera: es lo que mide un iPad en
// vertical (834) más un poco. Por debajo, una columna; por encima, dos.
const DOS_COLUMNAS = '(min-width: 900px)'

export function usarPantallaAncha() {
  const [ancha, setAncha] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(DOS_COLUMNAS).matches,
  )

  useEffect(() => {
    const consulta = window.matchMedia?.(DOS_COLUMNAS)
    if (!consulta) return
    const alCambiar = ev => setAncha(ev.matches)
    setAncha(consulta.matches)
    consulta.addEventListener('change', alCambiar)
    return () => consulta.removeEventListener('change', alCambiar)
  }, [])

  return ancha
}
