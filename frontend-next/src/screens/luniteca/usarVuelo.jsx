import { useCallback, useLayoutEffect, useState } from 'react'
import VueloDelLibro from './VueloDelLibro'

// Abrir un libro desde la vista de estantería tiene su propia animación: el
// lomo sale de la balda, gira y se pone de cara, y la ficha se descubre justo
// debajo de esa portada (ver VueloDelLibro). Al cerrar, el libro desanda el
// camino.
//
// Vive aquí y no en la pantalla porque lo usan las dos estanterías que hay: la
// tuya y la de cualquiera desde su perfil. Que en la de otro los libros se
// abrieran de golpe, con la vista de lomos puesta, se notaba enseguida.
//
// Desde la cuadrícula y la lista no hay nada que volar (no hay lomo del que
// salir), y quien pide menos movimiento tampoco lo ve: en esos casos la ficha
// sube como siempre.
export function usarVuelo(ficha) {
  const [vuelo, setVuelo] = useState(null)

  const abrirLibro = useCallback((entrada, nodo) => {
    const menosMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (nodo && !menosMovimiento) {
      setVuelo({ id: entrada.id, nodo, portada: entrada.book?.cover_url, destino: null, aterrizado: false })
    }
    ficha.abrir(entrada)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ficha.abrir])

  // La ficha se monta invisible pero ya en su sitio, así que aquí se puede
  // medir dónde cae su portada: ese es el destino del vuelo.
  useLayoutEffect(() => {
    if (!vuelo || vuelo.destino) return
    const marca = document.querySelector('[data-portada-ficha]')
    if (marca) setVuelo(v => (v && !v.destino ? { ...v, destino: marca.getBoundingClientRect() } : v))
  })

  const cerrarFicha = useCallback(() => {
    setVuelo(v => (v && v.aterrizado ? { ...v, sentido: 'vuelta', aterrizado: false } : null))
    ficha.cerrar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ficha.cerrar])

  // Para abrir una ficha sin animación (por ejemplo la que llega en la URL,
  // que no tiene ningún lomo del que salir).
  const abrirSinVuelo = useCallback(entrada => { setVuelo(null); ficha.abrir(entrada) }, [ficha.abrir])

  const enVuelo = vuelo && !vuelo.aterrizado
    ? (
      <VueloDelLibro
        key={vuelo.sentido || 'ida'}
        lomo={vuelo.nodo}
        portada={vuelo.portada}
        destino={vuelo.destino}
        sentido={vuelo.sentido || 'ida'}
        alTerminar={() => setVuelo(v => {
          if (!v) return null
          // De vuelta no queda nada que enseñar: el lomo ya está en su sitio.
          return v.sentido === 'vuelta' ? null : { ...v, aterrizado: true }
        })}
      />
    )
    : null

  return { vuelo, abrirLibro, abrirSinVuelo, cerrarFicha, enVuelo, volandoId: vuelo?.id }
}
