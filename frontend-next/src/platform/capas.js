import { useEffect } from 'react'

// El gesto de volver del móvil cierra lo último que se abrió: una hoja, la
// ficha de un libro, el menú lateral. Cada una de esas capas mete una entrada
// en el historial al abrirse y la deshace al cerrarse.
//
// El problema que resuelve esto: `popstate` se reparte a TODOS los que
// escuchan, no solo al de arriba. Con una hoja abierta dentro de la ficha de
// un libro, un solo "atrás" cerraba las dos a la vez — comprobado en una
// prueba automática, no razonado. Con esta pila, cada capa mira si es la de
// arriba antes de hacer nada, así que un "atrás" cierra exactamente una.
const pila = []

export function useCapaHistorial(activa, cerrar) {
  useEffect(() => {
    if (!activa) return
    window.history.pushState({ capa: true }, '')
    const capa = { cerrar }
    pila.push(capa)

    function alVolver() {
      if (pila[pila.length - 1] !== capa) return
      pila.pop()
      // desdeHistorial: es el propio gesto de volver quien cierra, así que
      // quien reciba esto NO debe volver a tocar el historial.
      cerrar({ desdeHistorial: true })
    }
    function alPulsar(ev) {
      // Escape hace lo mismo en el escritorio, y también solo en la de arriba.
      if (ev.key === 'Escape' && pila[pila.length - 1] === capa) cerrar()
    }

    window.addEventListener('popstate', alVolver)
    window.addEventListener('keydown', alPulsar)
    return () => {
      window.removeEventListener('popstate', alVolver)
      window.removeEventListener('keydown', alPulsar)
      const i = pila.indexOf(capa)
      if (i >= 0) pila.splice(i, 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activa])
}

// Cerrar una capa "a mano" (botón, velo, arrastre): se deshace su entrada del
// historial, que es lo que dispara el popstate que baja el estado. Así no
// queda una entrada muerta que obligue a pulsar atrás dos veces.
export function cerrarCapa(setAbierta) {
  return (opciones = {}) => {
    if (!opciones.desdeHistorial && window.history.state?.capa) window.history.back()
    else setAbierta(false)
  }
}
