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
// El volteo es un giro de verdad, con su escorzo, pero la perspectiva va
// DENTRO del transform de cada cara —`perspective(420px) rotateY(...)`— y no
// en un padre con `transform-style: preserve-3d`. Esa diferencia lo es todo en
// Safari: con la perspectiva en el padre pinta las caras planas (el libro
// pasaba del lomo a la portada "haciéndose grande", sin giro), y con la
// perspectiva propia dibuja el trapecio en escorzo como Chrome. Comprobado con
// una página mínima en los dos motores.
//
// Las dos caras comparten bisagra —el canto derecho del lomo— y giran a la vez
// separadas 90°: cuando el lomo llega a -90° y desaparece de canto, la portada
// llega a 0° y queda de frente. Es una puerta que se abre.
//
// Se anima con la API del navegador (`element.animate`) y no con Motion: en
// este portal Motion resolvía la animación de golpe, dejando el elemento en su
// sitio final sin llegar a disparar ni el evento de arranque.

const DURACION = 700
const CURVA = 'cubic-bezier(.32,.72,.24,1)'
// Cuándo se cierra el lomo y cuándo se abre la portada, en tanto por uno de la
// animación. Se solapan un pelín para que no haya un fotograma vacío.
const GIRO = [0.2, 0.68]
// Corta: un lomo mide 30-56px, y con una perspectiva larga el escorzo no se
// aprecia. Va en el espacio del propio elemento, así que la escala del vuelo
// la acompaña.
const PERSPECTIVA = 420

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

    // El lomo gira de 0 a -90° y se apaga: al final está de canto y ya no se ve.
    const cerrar = caraLomo.current.animate([
      { transform: `perspective(${PERSPECTIVA}px) rotateY(0deg)`, filter: 'brightness(1)' },
      { transform: `perspective(${PERSPECTIVA}px) rotateY(0deg)`, filter: 'brightness(1)', offset: GIRO[0] },
      { transform: `perspective(${PERSPECTIVA}px) rotateY(-90deg)`, filter: 'brightness(.5)', offset: GIRO[1] },
      { transform: `perspective(${PERSPECTIVA}px) rotateY(-90deg)`, filter: 'brightness(.5)' },
    ], opciones)

    // La portada va 90° por delante: empieza de canto y acaba de frente.
    const abrir = caraPortada.current.animate([
      { transform: `perspective(${PERSPECTIVA}px) rotateY(90deg)` },
      { transform: `perspective(${PERSPECTIVA}px) rotateY(90deg)`, offset: GIRO[0] },
      { transform: `perspective(${PERSPECTIVA}px) rotateY(0deg)`, offset: GIRO[1] },
      { transform: `perspective(${PERSPECTIVA}px) rotateY(0deg)` },
    ], opciones)

    // La luz que barre la tapa mientras gira: una cara que se abre hacia ti
    // recibe la luz de lado, y sin eso el giro se ve de cartón.
    const luz = sombra.current.animate([
      { opacity: 0.9 },
      { opacity: 0.9, offset: GIRO[0] },
      { opacity: 0.35, offset: (GIRO[0] + GIRO[1]) / 2 },
      { opacity: 0, offset: GIRO[1] },
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
          style={{ transformOrigin: '100% 50%', backfaceVisibility: 'hidden', transform: `perspective(${PERSPECTIVA}px) rotateY(90deg)` }}
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
            transformOrigin: '100% 50%', borderRadius: 4, backfaceVisibility: 'hidden',
          }}
        >
          <span ref={nodo => { if (nodo && !nodo.firstChild) nodo.appendChild(caja.clon) }} className="block h-full w-full" />
        </div>
      </div>
    </div>,
    document.body,
  )
}
