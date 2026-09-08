import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// El libro sale de la balda, gira y se pone de cara: es la animación de abrir
// un libro desde la vista de estantería.
//
// No se anima el lomo de la lista ni la ficha: se anima UN clon, en `fixed`,
// con transform y opacity. Por eso da igual que detrás haya trescientos lomos
// —no se vuelve a pintar ninguno— y por eso todo va por GPU.
//
// La cara del lomo es el nodo del lomo de verdad, clonado tal cual
// (`cloneNode`): así lleva su color, su textura, sus filetes y su título sin
// duplicar aquí ni una línea de cómo se dibuja un lomo.
//
// Se anima con la API del navegador (`element.animate`) y no con Motion: aquí
// Motion resolvía la animación de golpe —el elemento aparecía ya en su sitio
// final y no llegaba a saltar ni el evento de arranque, ni siquiera con un
// cuadrado de prueba en este mismo portal—. Además, con `animate` el transform
// va como una cadena entera, que para 3D es lo fiable: el orden de rotateY y
// translateZ importa y así no depende de cómo lo componga una librería.
//
// La geometría: el libro gira sobre el eje vertical que pasa por el canto
// DERECHO del lomo, que es la bisagra por donde la portada está unida a él.
// Con el giro de -90°, el lomo se va de perfil y la portada, que estaba
// plegada, queda de frente. De ahí salen las cuentas de abajo.
//
// OJO al probar esto: el WebKit de Playwright NO compone transformaciones 3D.
// Calcula bien la geometría (los rectángulos salen correctos) pero no las
// pinta: en una página mínima con `preserve-3d`, Chromium dibuja el libro en
// escorzo y WebKit solo el lomo, sin girar. Así que esta animación no se puede
// dar por buena con las pruebas de siempre — hay que mirarla en un Safari de
// verdad. Lo demás de la vista sí se comprueba en los dos motores.

const DURACION = 620
const CURVA = 'cubic-bezier(.32,.72,.24,1)'

export default function VueloDelLibro({ lomo, portada, destino, alTerminar }) {
  const [caja, setCaja] = useState(null)
  const exterior = useRef(null)
  const interior = useRef(null)

  useLayoutEffect(() => {
    if (!lomo || !destino) return
    const r = lomo.getBoundingClientRect()
    setCaja({ left: r.left, top: r.top, ancho: r.width, alto: r.height, clon: lomo.cloneNode(true) })
  }, [lomo, destino])

  // La portada tiene la misma proporción que la de la ficha (2/3), así que el
  // vuelo es un escalado uniforme y no deforma nada.
  const anchoPortada = caja ? caja.alto * (2 / 3) : 0
  const escala = caja ? destino.height / caja.alto : 1
  // Adónde va la esquina de arriba a la izquierda de la portada. Tras el giro,
  // esa esquina queda en la bisagra, o sea en el canto derecho del lomo.
  const x = caja ? destino.left - caja.left - escala * caja.ancho : 0
  const y = caja ? destino.top - caja.top : 0

  useLayoutEffect(() => {
    if (!caja || !exterior.current || !interior.current) return
    const opciones = { duration: DURACION, easing: CURVA, fill: 'forwards' }
    // El libro no va en línea recta: primero se despega hacia arriba y hacia el
    // usuario, y luego cae al sitio, como cuando lo sacas de la balda.
    const viaje = exterior.current.animate([
      { transform: 'translate(0px, 0px) scale(1)' },
      { transform: `translate(${x * 0.35}px, ${y * 0.3 - 12}px) scale(${1 + (escala - 1) * 0.45})`, offset: 0.45 },
      { transform: `translate(${x}px, ${y}px) scale(${escala})` },
    ], opciones)
    // El giro se termina antes que el viaje: el libro se pone de cara mientras
    // sale, y el último tramo ya es solo acercarse. Al revés —girando hasta el
    // final— parece que se coloca solo al aterrizar.
    const giro = interior.current.animate([
      { transform: 'rotateY(0deg) translateZ(0px)' },
      { transform: 'rotateY(-58deg) translateZ(80px)', offset: 0.34 },
      { transform: 'rotateY(-90deg) translateZ(24px)', offset: 0.62 },
      { transform: 'rotateY(-90deg) translateZ(0px)' },
    ], opciones)
    viaje.onfinish = () => alTerminar?.()
    return () => { viaje.cancel(); giro.cancel() }
  }, [caja, x, y, escala])

  if (!caja || !destino) return null

  return createPortal(
    // La capa fija va SUELTA, sin perspectiva ni transform: Safari no pinta un
    // `position: fixed` que además lleve perspectiva y 3D dentro (el elemento
    // está en el DOM, con su caja y visible, y no se dibuja). La caja del libro
    // es un absoluto dentro de ella, y es esa la que se anima.
    <div className="pointer-events-none fixed inset-0 z-[70]">
      {/* Tres capas, y cada una hace UNA cosa. Safari aplana el 3D si el mismo
          elemento lleva `perspective` y un transform animado, y no pinta nada
          si además es el `position: fixed`. Así que: la capa fija, dentro la
          caja que viaja (solo transform), y dentro la que da perspectiva. */}
      <div
        ref={exterior}
        className="absolute"
        style={{ left: caja.left, top: caja.top, width: caja.ancho, height: caja.alto, transformOrigin: '0 0' }}
      >
      <div className="h-full w-full" style={{ perspective: 1400 }}>
      <div
        ref={interior}
        className="relative h-full w-full"
        style={{ transformStyle: 'preserve-3d', transformOrigin: '100% 50%' }}
      >
        {/* El lomo, clonado del de la balda */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ borderRadius: 4 }}
          ref={nodo => { if (nodo && !nodo.firstChild) nodo.appendChild(caja.clon) }}
        />

        {/* La portada, unida al lomo por la bisagra y plegada hacia atrás */}
        <div
          className="absolute top-0 overflow-hidden rounded-r-md bg-surface-2 shadow-[0_10px_30px_-8px_rgba(60,40,20,.5)]"
          style={{
            left: '100%', width: anchoPortada, height: '100%',
            transform: 'rotateY(90deg)', transformOrigin: 'left center',
          }}
        >
          {portada
            ? <img src={portada} alt="" className="h-full w-full object-cover" />
            : <span className="block h-full w-full bg-surface-2" />}
          {/* Sombra en el canto de la bisagra: sin ella la portada se ve plana
              en cuanto termina de girar. */}
          <span className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-r from-black/25 to-transparent" />
        </div>
        </div>
      </div>
      </div>
    </div>,
    document.body,
  )
}
