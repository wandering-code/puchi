import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// El libro sale de la balda, se abre y se pone de cara: es la animación de
// abrir un libro desde la vista de estantería.
//
// No se anima el lomo de la lista ni la ficha: se anima UN clon, en una capa
// aparte, con transform y opacity. Por eso da igual que detrás haya
// trescientos lomos —no se vuelve a pintar ninguno— y por eso todo va por GPU.
//
// La cara del lomo es el nodo del lomo de verdad, clonado tal cual
// (`cloneNode`): así lleva su color, su textura, sus filetes y su título sin
// duplicar aquí ni una línea de cómo se dibuja un lomo.
//
// EL VOLTEO NO ES 3D, aunque lo parezca. Se probó con `rotateY` y
// `preserve-3d`, y en Safari no se ve: el libro pasaba del lomo a la portada
// "haciéndose grande", sin giro, por mucho que se acortara la perspectiva. Así
// que se hace con lo que dibuja igual en todos los motores: las dos caras
// comparten la bisagra —el canto derecho del lomo— y una se cierra en
// horizontal mientras la otra se abre, como una puerta vista de frente. Con la
// sombra que la acompaña, el ojo lo lee como un giro.
//
// Se anima con la API del navegador (`element.animate`) y no con Motion: en
// este portal Motion resolvía la animación de golpe, dejando el elemento en su
// sitio final sin llegar a disparar ni el evento de arranque.

const DURACION = 700
const CURVA = 'cubic-bezier(.32,.72,.24,1)'
// Cuándo se cierra el lomo y cuándo se abre la portada, en tanto por uno de la
// animación. Se solapan un pelín para que no haya un fotograma vacío.
const CIERRE = [0.18, 0.46]
const APERTURA = [0.42, 0.72]

export default function VueloDelLibro({ lomo, portada, destino, alTerminar }) {
  const [caja, setCaja] = useState(null)
  const exterior = useRef(null)
  const caraLomo = useRef(null)
  const caraPortada = useRef(null)
  const sombra = useRef(null)

  useLayoutEffect(() => {
    if (!lomo || !destino) return
    const r = lomo.getBoundingClientRect()
    setCaja({ left: r.left, right: r.right, top: r.top, ancho: r.width, alto: r.height, clon: lomo.cloneNode(true) })
  }, [lomo, destino])

  // La portada tiene la misma proporción que la de la ficha (2/3), así que el
  // vuelo es un escalado uniforme y no deforma nada. El contenedor ya tiene el
  // tamaño de la portada y se apoya en la bisagra: el lomo va pegado a su
  // derecha, ocupando lo que ocupaba en la balda.
  const anchoPortada = caja ? caja.alto * (2 / 3) : 0
  const escala = caja ? destino.height / caja.alto : 1
  const izquierda = caja ? caja.right - anchoPortada : 0
  const x = caja ? destino.left - izquierda : 0
  const y = caja ? destino.top - caja.top : 0

  useLayoutEffect(() => {
    if (!caja || !exterior.current) return
    const opciones = { duration: DURACION, easing: CURVA, fill: 'forwards' }
    // El libro se despega hacia arriba, se abre delante del usuario y luego se
    // acerca a su sitio.
    const viaje = exterior.current.animate([
      { transform: 'translate(0px, 0px) scale(1)' },
      { transform: `translate(${x * 0.18}px, ${y * 0.1 - 16}px) scale(${1 + (escala - 1) * 0.3})`, offset: 0.3 },
      { transform: `translate(${x * 0.62}px, ${y * 0.58}px) scale(${1 + (escala - 1) * 0.72})`, offset: 0.7 },
      { transform: `translate(${x}px, ${y}px) scale(${escala})` },
    ], opciones)

    const cerrar = caraLomo.current.animate([
      { transform: 'scaleX(1)', filter: 'brightness(1)' },
      { transform: 'scaleX(1)', filter: 'brightness(1)', offset: CIERRE[0] },
      { transform: 'scaleX(0)', filter: 'brightness(.55)', offset: CIERRE[1] },
      { transform: 'scaleX(0)', filter: 'brightness(.55)' },
    ], opciones)

    const abrir = caraPortada.current.animate([
      { transform: 'scaleX(0)', opacity: 0 },
      { transform: 'scaleX(0)', opacity: 1, offset: APERTURA[0] },
      { transform: 'scaleX(1)', opacity: 1, offset: APERTURA[1] },
      { transform: 'scaleX(1)', opacity: 1 },
    ], opciones)

    // La luz que barre la portada según se abre: es lo que da la sensación de
    // que la tapa está girando y no simplemente estirándose.
    const luz = sombra.current.animate([
      { opacity: 0 },
      { opacity: 0.75, offset: APERTURA[0] },
      { opacity: 0.2, offset: APERTURA[1] },
      { opacity: 0 },
    ], opciones)

    viaje.onfinish = () => alTerminar?.()
    return () => [viaje, cerrar, abrir, luz].forEach(a => a.cancel())
  }, [caja, x, y, escala])

  if (!caja || !destino) return null

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[70]">
      <div
        ref={exterior}
        className="absolute"
        style={{ left: izquierda, top: caja.top, width: anchoPortada, height: caja.alto, transformOrigin: '0 0' }}
      >
        {/* La portada: se abre desde la bisagra, que es el canto derecho */}
        <div
          ref={caraPortada}
          className="absolute inset-0 overflow-hidden rounded-l-[3px] rounded-r-md bg-surface-2 shadow-[0_10px_30px_-8px_rgba(60,40,20,.5)]"
          style={{ transformOrigin: '100% 50%' }}
        >
          {portada
            ? <img src={portada} alt="" className="h-full w-full object-cover" />
            : <span className="block h-full w-full bg-surface-2" />}
          <span
            ref={sombra}
            className="pointer-events-none absolute inset-0"
            style={{ background: 'linear-gradient(to right, rgba(0,0,0,.75), rgba(0,0,0,.25) 45%, transparent)', opacity: 0 }}
          />
        </div>

        {/* El lomo, clonado del de la balda, pegado a la bisagra */}
        <div
          ref={caraLomo}
          className="absolute top-0 overflow-hidden"
          style={{
            right: 0, width: caja.ancho, height: '100%',
            transformOrigin: '100% 50%', borderRadius: 4,
          }}
        >
          <span ref={nodo => { if (nodo && !nodo.firstChild) nodo.appendChild(caja.clon) }} className="block h-full w-full" />
        </div>
      </div>
    </div>,
    document.body,
  )
}
