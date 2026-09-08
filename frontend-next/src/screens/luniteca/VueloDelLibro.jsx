import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// El libro sale de la balda, gira y se pone de cara: es la animación de abrir
// un libro desde la vista de estantería.
//
// No se anima el lomo de la lista ni la ficha: se anima UN clon, en una capa
// aparte, con transform. Por eso da igual que detrás haya trescientos lomos
// —no se vuelve a pintar ninguno— y por eso todo va por GPU.
//
// La cara del lomo es el nodo del lomo de verdad, clonado tal cual
// (`cloneNode`): así lleva su color, su textura, sus filetes y su título sin
// duplicar aquí ni una línea de cómo se dibuja un lomo.
//
// ES UN CUERPO RÍGIDO, no caras sueltas: el lomo, la tapa y el canto de las
// páginas son las caras de un mismo objeto dentro de un `transform-style:
// preserve-3d`, y lo que gira es el objeto entero. Hubo un rodeo por versiones
// con cada cara girando por su cuenta (con la perspectiva metida en su propio
// transform), y no valen: cada plano tiene su proyección, así que nunca forman
// un volumen —se ve una carta que gira y un trozo pegado al lado—.
//
// El rodeo vino de un diagnóstico equivocado: el WebKit de Playwright no
// compone 3D (ni una página mínima con `preserve-3d`), y di por hecho que
// Safari tampoco. Safari sí lo compone. Así que ESTA VISTA NO SE PUEDE
// VALIDAR con las pruebas automáticas de WebKit: lo que se ve ahí en 3D no
// dice nada. Chromium sí sirve, y el iPhone es el juez.
//
// Lo que sí hay que respetar, y era el fallo original:
//  - la perspectiva va CORTA (un lomo mide 30-56px: con 1400px el escorzo no
//    se ve y el giro parece un fundido);
//  - el giro tiene que durar (antes se comía 150 ms de 620 y no se percibía);
//  - y el elemento que lleva la perspectiva no puede llevar además el
//    transform animado, o Safari aplana el 3D.

const DURACION = 1350
const CURVA = 'cubic-bezier(.32,.72,.24,1)'
const CURVA_GIRO = 'cubic-bezier(.5,.02,.3,1)'
// Qué parte del vuelo se lleva el giro. Es lo que hay que mirar, así que se
// lleva la mayor parte.
const GIRO = [0.12, 0.86]
const PERSPECTIVA = 380

export default function VueloDelLibro({ lomo, portada, destino, alTerminar }) {
  const [caja, setCaja] = useState(null)
  const viaje = useRef(null)
  const libro = useRef(null)

  useLayoutEffect(() => {
    if (!lomo || !destino) return
    const r = lomo.getBoundingClientRect()
    const clon = lomo.cloneNode(true)
    // El lomo de la balda se marca como invisible en cuanto empieza el vuelo,
    // para que no se vea por duplicado, y el clon se hace DESPUÉS: hay que
    // quitarle esa marca o el clon nace invisible. Era el motivo de que en el
    // vuelo no se viera nunca el lomo, y de que todo pareciera una portada
    // plana que crece.
    clon.classList.remove('invisible')
    clon.style.visibility = 'visible'
    setCaja({ left: r.left, right: r.right, top: r.top, ancho: r.width, alto: r.height, clon })
  }, [lomo, destino])

  // La tapa tiene la misma proporción que la portada de la ficha (2/3), así que
  // el vuelo es un escalado uniforme y no deforma nada. La caja del vuelo mide
  // lo que la tapa y se apoya en la bisagra: el lomo va pegado a su derecha,
  // con el grosor que tenía en la balda.
  const anchoTapa = caja ? caja.alto * (2 / 3) : 0
  const escala = caja ? destino.height / caja.alto : 1
  // La bisagra es el canto IZQUIERDO del lomo, que es donde va unida la tapa
  // en un libro nuestro: abierto, el lomo queda a la izquierda de la portada.
  // Con la bisagra en el canto derecho —que fue el primer montaje— el libro se
  // abría al revés, con el lomo a la derecha.
  const izquierda = caja ? caja.left : 0
  const x = caja ? destino.left - izquierda : 0
  const y = caja ? destino.top - caja.top : 0

  useLayoutEffect(() => {
    if (!caja || !viaje.current || !libro.current) return
    // El libro se planta en el centro CUANTO ANTES y allí se abre: el paso de
    // lado se hace al principio, mientras todavía es pequeño y no se está
    // mirando. Antes el 70% del desplazamiento caía en el último 20% del
    // vuelo, y el libro parecía irse hacia un lado justo al final.
    const vuelo = viaje.current.animate([
      { transform: 'translate(0px, 0px) scale(1)' },
      { transform: `translate(${x * 0.55}px, ${y * 0.12 - 22}px) scale(${1 + (escala - 1) * 0.3})`, offset: 0.2 },
      { transform: `translate(${x * 0.94}px, ${y * 0.3}px) scale(${1 + (escala - 1) * 0.5})`, offset: 0.5 },
      { transform: `translate(${x}px, ${y * 0.55}px) scale(${1 + (escala - 1) * 0.66})`, offset: 0.86 },
      { transform: `translate(${x}px, ${y}px) scale(${escala})` },
    ], { duration: DURACION, easing: CURVA, fill: 'forwards' })

    // El objeto entero gira sobre la bisagra: el lomo se va de perfil y la tapa
    // viene de canto a ponerse de frente, sin que ninguna cara se mueva por su
    // cuenta. De paso se inclina un poco arriba (rotateX), que es como se mira
    // un libro que sacas de la balda.
    // El giro se demora donde tiene gracia: entre 45 y 60 grados es donde se
    // ven a la vez el lomo y la tapa, así que ahí casi se para. Pasando de
    // largo, ese momento —que es el que dice que aquello es un libro— no da
    // tiempo ni a verse.
    const giro = libro.current.animate([
      { transform: 'rotateX(0deg) rotateY(0deg) translateZ(0px)' },
      { transform: 'rotateX(-5deg) rotateY(6deg) translateZ(55px)', offset: GIRO[0] },
      { transform: 'rotateX(-9deg) rotateY(46deg) translateZ(95px)', offset: 0.4 },
      { transform: 'rotateX(-9deg) rotateY(58deg) translateZ(95px)', offset: 0.62 },
      { transform: 'rotateX(0deg) rotateY(90deg) translateZ(30px)', offset: GIRO[1] },
      { transform: 'rotateX(0deg) rotateY(90deg) translateZ(0px)' },
    ], { duration: DURACION, easing: CURVA_GIRO, fill: 'forwards' })

    vuelo.onfinish = () => alTerminar?.()
    return () => { vuelo.cancel(); giro.cancel() }
  }, [caja, x, y, escala])

  if (!caja || !destino) return null

  // El grosor del libro: lo que mide su lomo.
  //
  // Se probó a añadir el corte de las páginas como tercera cara, al otro
  // extremo de la tapa. Se descarta: con la perspectiva tan corta se separa
  // visualmente de la tapa y se lee como un trozo pegado al lado, no como el
  // canto del libro. El volumen ya lo da el cuerpo girando.
  const grosor = caja.ancho

  return createPortal(
    // Tres capas y cada una con un solo trabajo: la fija, la que viaja y la que
    // da la perspectiva. Safari aplana el 3D si la perspectiva y el transform
    // animado caen en el mismo elemento.
    <div className="pointer-events-none fixed inset-0 z-[70]">
      <div
        ref={viaje}
        className="absolute"
        style={{ left: izquierda, top: caja.top, width: anchoTapa, height: caja.alto, transformOrigin: '0 0' }}
      >
        <div className="h-full w-full" style={{ perspective: PERSPECTIVA, perspectiveOrigin: '50% 42%' }}>
          <div
            ref={libro}
            className="relative h-full w-full"
            style={{ transformStyle: 'preserve-3d', transformOrigin: '0% 50%' }}
          >
            {/* La tapa, en el plano del objeto: parte de la bisagra hacia atrás */}
            <div
              className="absolute inset-0 overflow-hidden rounded-l-[2px] rounded-r-md bg-surface-2 shadow-[0_10px_30px_-8px_rgba(60,40,20,.5)]"
              // Plegada hacia el observador y no hacia el fondo. Es lo que
              // hace que, al girar, sea EL LOMO el que se va hacia atrás y la
              // tapa la que viene: al revés el lomo salía hacia el usuario y el
              // libro parecía hueco, con la portada colgada del canto de atrás.
              style={{ transformOrigin: '0% 50%', transform: 'rotateY(-90deg)', backfaceVisibility: 'hidden' }}
            >
              {portada
                ? <img src={portada} alt="" className="h-full w-full object-cover" />
                : <span className="block h-full w-full bg-surface-2" />}
              {/* El canto de la tapa por la bisagra, en sombra */}
              <span className="pointer-events-none absolute inset-y-0 left-0 w-[4px] bg-gradient-to-r from-black/35 to-transparent" />
            </div>

            {/* El lomo, clonado del de la balda: es la cara que mira al frente
                cuando el libro está en la estantería. */}
            <div
              className="absolute top-0 overflow-hidden"
              style={{ left: 0, width: grosor, height: '100%', borderRadius: 4, backfaceVisibility: 'hidden' }}
            >
              <span ref={nodo => { if (nodo && !nodo.firstChild) nodo.appendChild(caja.clon) }} className="block h-full w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
