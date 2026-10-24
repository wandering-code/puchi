import { useContext, useLayoutEffect, useRef, useState } from 'react'
import { PresenceContext, usePresence } from 'motion/react'
import { LLEGADA, SALIDA } from './curvas'
import { deslizar, fotografiar, movimientoReducido } from './telon'

// Llama a `seguir` en cuanto el navegador dé un fotograma corto (menos de
// ~2 a 60Hz), sin esperar nunca más de 600ms. Los fotogramas se miden por la
// distancia entre dos requestAnimationFrame seguidos.
function cuandoHayaFluidez(seguir) {
  const limite = performance.now() + 600
  let antes = null
  const mirar = ahora => {
    if ((antes != null && ahora - antes < 34) || ahora > limite) return seguir()
    antes = ahora
    requestAnimationFrame(mirar)
  }
  requestAnimationFrame(mirar)
}

// El aviso de que algo empieza a plegarse, con cuánto encoge (ver más abajo).
export const ENCOGE = 'puchi:encoge'

// Abrir y cerrar un trozo de contenido a la frecuencia de la pantalla (120 en
// los iPhone Pro).
//
// Safari solo mueve a 120 lo que anima `transform` y `opacity`, que lo hace
// la GPU. Todo lo demás —también la altura— va en el hilo principal y lo deja
// a 60. La versión anterior animaba la altura (una rejilla de 0fr a 1fr) y
// por eso iba a 60 aunque fuera CSS.
//
// Así que la altura NO se anima: cambia de golpe, y lo que se ve es un telón
// (ver ui/telon.js). Lo que hay debajo se desliza desde donde estaba hasta su
// sitio nuevo y el contenido aparece con un fundido. Al cerrar es al revés:
// lo de debajo sube tapando el contenido, que se funde, y solo en el último
// fotograma se pliega de verdad.
//
// El contenido sigue montado cerrado (con display: none), y mientras se
// cierra se sigue viendo lo último que tenía: así se puede usar como
// `{error && …}` sin que se quede vacío a media animación.

// `onTelon`: para quien tenga que acompañar el cambio de alto (el marco de la
// tarjeta en la que va, ver ui/Marco.jsx). Recibe { abriendo, delta, opciones }
// y devuelve sus animaciones, que se quitan a la vez que estas.
// `extraAlPlegar`: si se da (aunque sea 0), quien lo usa garantiza que al
// plegarse lo de debajo sube justo lo que mide esto más ese extra (lo que
// encoja además a la vez, como la franja de una sección), y el telón se
// ahorra medirlo plegando de mentira (ver `encoge` en ui/telon.js).
export default function Desplegable({ abierto = true, children, className = '', onTelon = null, extraAlPlegar = null }) {
  const raiz = useRef(null)
  const [visible, setVisible] = useState(abierto)
  if (abierto && !visible) setVisible(true)

  // Lo último que tuvo abierto, para enseñarlo mientras se cierra.
  const ultimo = useRef(children)
  if (abierto) ultimo.current = children

  // Antes de que cambie nada, dónde estaba todo.
  const previo = useRef(abierto)
  const foto = useRef(null)
  if (previo.current !== abierto) {
    previo.current = abierto
    if (raiz.current) foto.current = fotografiar(raiz.current)
  }

  const animaciones = useRef([])
  const parar = () => { animaciones.current.forEach(a => a.cancel()); animaciones.current = [] }

  useLayoutEffect(() => {
    const f = foto.current
    foto.current = null
    const el = raiz.current
    if (!f || !el) return
    parar()
    if (movimientoReducido()) { if (!abierto) setVisible(false); return }

    const { animaciones: hechas, opciones } = deslizar(f, {
      abriendo: abierto,
      t: abierto ? LLEGADA : SALIDA,
      encoge: extraAlPlegar == null ? null : el.offsetHeight + extraAlPlegar,
      // El atributo también: la tarjeta de una sección cambia de forma al
      // quedarse plegada (ver .titulo-banda en index.css), y el telón tiene
      // que medir ese final para llevar ahí lo de debajo.
      plegar: si => { el.style.display = si ? 'none' : ''; el.toggleAttribute('data-plegado', si) },
    })
    // El contenido, con el fundido a destiempo: abriendo aparece cuando lo de
    // debajo ya casi ha pasado, y cerrando se va antes de que lo tape. Así no
    // se ve un texto encima de otro mientras se cruzan.
    const fundido = el.animate(
      abierto
        ? [{ opacity: 0 }, { opacity: 0, offset: 0.3 }, { opacity: 1 }]
        : [{ opacity: 1 }, { opacity: 0, offset: 0.45 }, { opacity: 0 }],
      opciones,
    )
    const delMarco = onTelon?.({ abriendo: abierto, delta: el.offsetHeight, opciones }) || []
    // Al empezar a plegar se avisa de cuánto va a encoger la página: lo que se
    // estira con el contenido (CapaDeContenido, en eventos/Adorno) encoge ya,
    // sin medir nada. Si encogiera al final, ese fotograma tendría que
    // recolocar la página dos veces (o, sin esperar, el scroll se recolocaría
    // un fotograma tarde: medido, un salto de 580px y vuelta).
    if (!abierto) window.dispatchEvent(new CustomEvent(ENCOGE, { detail: el.offsetHeight + (extraAlPlegar || 0) }))
    const todas = [...hechas, fundido, ...delMarco]
    animaciones.current = todas
    // No arrancan todavía: se quedan en su primer fotograma (el estado de
    // antes, gracias a fill) hasta que el navegador vuelve a dar fotogramas
    // fluidos. Mostrar u ocultar de golpe una sección llena de lomos le cuesta
    // a Safari de iOS uno o dos fotogramas larguísimos de pintar (medido en
    // el simulador: 150-300ms), y como el reloj de la animación ya corría,
    // cuando por fin se pintaba la animación había terminado: el despliegue
    // se veía de golpe y el plegado a saltos. Así se ve entera y suave, un
    // instante después del toque.
    todas.forEach(a => a.pause())
    cuandoHayaFluidez(() => { if (animaciones.current === todas) todas.forEach(a => a.play()) })
    fundido.onfinish = () => {
      if (abierto) parar()
      else setVisible(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  // Ya plegado de verdad: ahora sí se quitan las animaciones, en el mismo
  // fotograma en que el contenido desaparece. No hay salto.
  useLayoutEffect(() => { if (!visible) parar() }, [visible])
  useLayoutEffect(() => parar, [])

  return (
    <div ref={raiz} data-desplegable className={className} style={visible ? undefined : { display: 'none' }} data-plegado={visible ? undefined : ''} inert={!visible}>
      {abierto ? children : ultimo.current}
    </div>
  )
}

// Lo mismo para algo que aparece al montarse y se va al quitarlo, dentro de un
// <AnimatePresence> (una fila que llega a una lista, una sección que llega
// cuando hay datos): el telón al entrar y al salir, sin `abierto`. Para saber
// dónde estaba lo de debajo se esconde un momento, se mide y se vuelve a
// poner, sin que llegue a pintarse.
export function Aparece({ children, className = '' }) {
  const raiz = useRef(null)
  const [presente, quitar] = usePresence()
  // Con <AnimatePresence initial={false}>, lo que ya está al montarse no entra
  // animado (como con Motion).
  const conEntrada = useContext(PresenceContext)?.initial !== false
  const animaciones = useRef([])
  const parar = () => { animaciones.current.forEach(a => a.cancel()); animaciones.current = [] }

  const telon = (abriendo) => {
    const el = raiz.current
    if (!el) return null
    parar()
    let foto
    if (abriendo) {
      el.style.display = 'none'
      foto = fotografiar(el)
      el.style.display = ''
    } else {
      foto = fotografiar(el)
    }
    const { animaciones: hechas, opciones } = deslizar(foto, {
      abriendo,
      t: abriendo ? LLEGADA : SALIDA,
      plegar: si => { el.style.display = si ? 'none' : '' },
    })
    const fundido = el.animate(
      abriendo
        ? [{ opacity: 0 }, { opacity: 0, offset: 0.3 }, { opacity: 1 }]
        : [{ opacity: 1 }, { opacity: 0, offset: 0.45 }, { opacity: 0 }],
      opciones,
    )
    animaciones.current = [...hechas, fundido]
    return fundido
  }

  useLayoutEffect(() => {
    if (!conEntrada || movimientoReducido()) return
    const f = telon(true)
    if (f) f.onfinish = parar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useLayoutEffect(() => {
    if (presente) return
    if (movimientoReducido()) { quitar?.(); return }
    const f = telon(false)
    if (!f) { quitar?.(); return }
    // Se queda en su último fotograma hasta que AnimatePresence la quita;
    // entonces (abajo, al desmontarse) se cancela todo en el mismo fotograma.
    f.onfinish = () => quitar?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presente])

  useLayoutEffect(() => parar, [])

  return <div ref={raiz} className={className}>{children}</div>
}
