import { useCallback, useEffect, useRef, useState } from 'react'

// El gesto de volver del móvil cierra lo último que se abrió: una hoja, la
// ficha de un libro, el menú lateral. Cada una de esas "capas" mete una
// entrada en el historial al abrirse y la deshace al cerrarse.
//
// Dos cosas que hay que hacer bien, y que costaron un cierre inesperado de la
// ficha al cambiar de estado:
//
// 1. UN SOLO listener de popstate para todas, no uno por capa. El evento se
//    reparte a todos los que escuchan, así que con una hoja abierta encima de
//    la ficha, un solo "atrás" cerraba las dos.
// 2. Los back() que pedimos nosotros al cerrar con un botón NO deben cerrar
//    nada más al volver. Se llevan contados: cuando llega su popstate, se
//    consume y ahí acaba. Sin esto, cerrar una hoja con un doble toque (o con
//    el toque fantasma que Safari manda a veces detrás del primero) pedía dos
//    back seguidos y el segundo se llevaba por delante la ficha de debajo.
//
// El pushState va en abrir(), no en un efecto: un efecto puede ejecutarse dos
// veces (StrictMode lo hace a propósito en desarrollo) y meteríamos dos
// entradas por apertura.
const pila = []
let backsPropios = 0
let listenerPuesto = false

function asegurarListener() {
  if (listenerPuesto) return
  listenerPuesto = true
  window.addEventListener('popstate', () => {
    if (backsPropios > 0) { backsPropios--; return }
    const capa = pila[pila.length - 1]
    if (capa) capa.cerrar({ desdeHistorial: true })
  })
}

export function useCapa(valorCerrado = false) {
  const [abierta, setAbierta] = useState(valorCerrado)
  const cerrando = useRef(false)

  const abrir = useCallback((valor = true) => {
    cerrando.current = false
    window.history.pushState({ capa: true }, '')
    setAbierta(valor)
  }, [])

  const cerrar = useCallback((opciones = {}) => {
    // Segunda llamada a cerrar antes de que se complete la primera: se ignora.
    if (cerrando.current) return
    cerrando.current = true
    setAbierta(valorCerrado)
    if (!opciones.desdeHistorial) {
      backsPropios++
      window.history.back()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!abierta) return
    asegurarListener()
    const capa = { cerrar }
    pila.push(capa)
    // Escape hace lo mismo que el gesto de volver, y solo en la capa de arriba.
    const alPulsar = (ev) => { if (ev.key === 'Escape' && pila[pila.length - 1] === capa) cerrar() }
    window.addEventListener('keydown', alPulsar)
    return () => {
      window.removeEventListener('keydown', alPulsar)
      const i = pila.indexOf(capa)
      if (i >= 0) pila.splice(i, 1)
    }
  }, [abierta, cerrar])

  // Refrescar el contenido de una capa ya abierta (la ficha se resincroniza
  // con la entrada fresca cuando cambia en el servidor) sin tocar el
  // historial: no es abrir ni cerrar nada, es el mismo sitio con otros datos.
  return { abierta, abrir, cerrar, reemplazar: setAbierta }
}
