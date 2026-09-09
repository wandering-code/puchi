import { useCallback, useLayoutEffect, useState } from 'react'
import VueloDelLibro from './VueloDelLibro'
import { usarPantallaQuieta } from '../../ui/quieto'

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

  // Dónde cae la portada dentro de la ficha: ese es el destino del vuelo.
  //
  // La ficha ya no se monta al abrirla —vive montada y aparcada abajo, para no
  // construirla dentro del toque—, así que al medir puede estar todavía fuera
  // de la pantalla. Hay que descontarle lo que le falte por colocarse: sin eso
  // el libro volaba hacia donde está aparcada, es decir, hacia abajo.
  useLayoutEffect(() => {
    if (!vuelo || vuelo.destino) return
    const marca = document.querySelector('[data-portada-ficha]')
    if (!marca) return
    const caja = marca.getBoundingClientRect()
    const panel = document.querySelector('[data-panel="pantalla"]')
    const enReposo = panel ? parseFloat(getComputedStyle(panel).top) || 0 : 0
    const falta = panel ? panel.getBoundingClientRect().top - enReposo : 0
    const destino = new DOMRect(caja.x, caja.y - falta, caja.width, caja.height)
    setVuelo(v => (v && !v.destino ? { ...v, destino } : v))
  })

  const cerrarFicha = useCallback(() => {
    setVuelo(v => (v && v.aterrizado ? { ...v, sentido: 'vuelta', aterrizado: false } : null))
    ficha.cerrar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ficha.cerrar])

  // Para abrir una ficha sin animación (por ejemplo la que llega en la URL,
  // que no tiene ningún lomo del que salir).
  const abrirSinVuelo = useCallback(entrada => { setVuelo(null); ficha.abrir(entrada) }, [ficha.abrir])

  // Mientras el libro está en el aire, la pantalla no se mueve: el vuelo sale
  // de un lomo concreto y vuelve a él, así que un scroll a media animación lo
  // deja aterrizando donde ya no hay nada. Lo mismo que hace la ficha al
  // subir y bajar, y por el mismo camino, que si no se pisan entre ellos.
  const volando = !!(vuelo && !vuelo.aterrizado)
  usarPantallaQuieta(volando, 1400)

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

  // El libro que ahora mismo NO está en la balda: el que vuela y, mientras la
  // ficha siga abierta, el que se abrió. Se ha sacado de la estantería, no se
  // ha hecho una copia, y el hueco tiene que notarse.
  const fueraId = vuelo?.id ?? ficha.abierta?.id ?? null

  return { vuelo, abrirLibro, abrirSinVuelo, cerrarFicha, enVuelo, fueraId }
}
