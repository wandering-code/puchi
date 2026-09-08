import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { RELIEVE_LIBRO } from './piezas'

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

// Lo que dura el vuelo entero. Los pasos van en tanto por uno, así que
// cambiando este número se acelera o se frena todo a la vez sin descuadrar el
// giro ni el trayecto.
const DURACION = 880
const CURVA = 'cubic-bezier(.32,.72,.24,1)'
const CURVA_GIRO = 'cubic-bezier(.5,.02,.3,1)'
// Qué parte del vuelo se lleva el giro. Es lo que hay que mirar, así que se
// lleva la mayor parte.
const GIRO = [0.12, 0.86]
const PERSPECTIVA = 380

export default function VueloDelLibro({ lomo, portada, destino, alTerminar }) {
  const [caja, setCaja] = useState(null)
  const viaje = useRef(null)
  const enderezar = useRef(null)
  const libro = useRef(null)

  useLayoutEffect(() => {
    if (!lomo || !destino) return
    // Uno de cada siete libros está torcido en la balda. Para que el vuelo
    // arranque justo donde está ese libro hay que medirlo DERECHO —si no, el
    // rectángulo que devuelve el navegador es el que envuelve al torcido, que
    // es más ancho y está desplazado— y luego enderezarlo por el camino. Se
    // quita el giro un instante, se mide y se devuelve: pasa dentro del mismo
    // ciclo de layout, así que no se ve.
    const giroPrevio = lomo.style.transform
    const transicionPrevia = lomo.style.transition
    const torcido = Number(/rotate\((-?[\d.]+)deg\)/.exec(giroPrevio)?.[1] || 0)
    // La transición hay que apagarla ANTES de quitar el giro: el lomo de la
    // balda anima su transform (300ms), así que al quitárselo no se endereza al
    // instante y lo que se medía era el libro todavía torcido. De ahí salía una
    // caja más ancha que el lomo —hasta 10px en uno de 29— y ese sobrante se
    // veía como un hueco entre el lomo y la tapa.
    lomo.style.transition = 'none'
    lomo.style.transform = 'none'
    // El tamaño, mejor de offsetWidth/Height: no lo tocan las transformaciones.
    const ancho = lomo.offsetWidth
    const alto = lomo.offsetHeight
    const r = lomo.getBoundingClientRect()
    lomo.style.transform = giroPrevio
    lomo.style.transition = transicionPrevia
    const clon = lomo.cloneNode(true)
    // El clon va derecho: el giro de la balda lo pone (y lo quita) la capa que
    // endereza, con el mismo punto de apoyo que usa la estantería.
    clon.style.transform = 'none'
    // El lomo de la balda va redondeado por sus cuatro esquinas. Por el canto
    // de la bisagra no puede estarlo: ahí es donde se pega la tapa, y el
    // redondeo dejaba ver el fondo entre las dos caras.
    clon.style.borderTopRightRadius = '0'
    clon.style.borderBottomRightRadius = '0'
    // Y sin la sombra que proyecta sobre el libro de al lado: en la balda
    // separa un lomo de su vecino, pero aquí cae justo en la unión con la tapa
    // y se ve como una rendija entre las dos caras. La sombra del vuelo la pone
    // la tapa.
    clon.style.boxShadow = 'none'
    // El lomo de la balda se marca como invisible en cuanto empieza el vuelo,
    // para que no se vea por duplicado, y el clon se hace DESPUÉS: hay que
    // quitarle esa marca o el clon nace invisible. Era el motivo de que en el
    // vuelo no se viera nunca el lomo, y de que todo pareciera una portada
    // plana que crece.
    clon.classList.remove('invisible')
    clon.style.visibility = 'visible'
    setCaja({ left: r.left, right: r.left + ancho, top: r.top, ancho, alto, torcido, clon })
  }, [lomo, destino])

  // La geometría del libro, que tiene su intríngulis y se ha llegado a ella
  // por eliminación:
  //
  //   - El lomo ocupa el frente, con el grosor que tenía en la balda.
  //   - La tapa cuelga del canto DERECHO del lomo y se pliega hacia el FONDO,
  //     que es como está un libro de pie en una estantería.
  //   - Al girar el cuerpo, la tapa viene a ponerse de cara por la derecha de
  //     la bisagra y el lomo se va al fondo, quedando a su izquierda.
  //
  // Plegando la tapa hacia el observador (el intento anterior) el ángulo entre
  // lomo y tapa se abre hacia ti: se ve el libro por dentro. Y con la bisagra
  // en el canto izquierdo, el libro se abre al revés y el lomo acaba a la
  // derecha de la portada.
  const anchoTapa = caja ? caja.alto * (2 / 3) : 0
  const escala = caja ? destino.height / caja.alto : 1
  const grosorLomo = caja ? caja.ancho : 0
  // La caja del vuelo empieza donde empieza el lomo y da cabida a los dos.
  const izquierda = caja ? caja.left : 0
  const anchoCaja = grosorLomo + anchoTapa
  // La tapa acaba a la derecha de la bisagra, así que lo que tiene que
  // aterrizar en la portada de la ficha es ese trozo, no la caja entera.
  const x = caja ? destino.left - izquierda - escala * grosorLomo : 0
  const y = caja ? destino.top - caja.top : 0

  useLayoutEffect(() => {
    if (!caja || !viaje.current || !libro.current) return
    // El libro se mueve por su CENTRO VISIBLE, no por su esquina. Al abrirse
    // sobre la bisagra el bulto crece hacia la derecha, así que llevando la
    // esquina en línea recta lo que se ve es un vaivén: primero se va de lado y
    // luego vuelve. Sabiendo cuánto ocupa a cada ángulo se compensa, y el
    // trayecto queda limpio.
    //
    // Dónde cae el centro de lo que se ve, a cada ángulo del giro. No se deduce
    // con senos y cosenos: la perspectiva no reparte de forma lineal —lo que se
    // acerca se agranda— y con la cuenta teórica el libro seguía haciendo un
    // vaivén. Se mide poniendo el libro en cada ángulo un instante, antes de
    // empezar, dentro del mismo ciclo de layout.
    const medirCentro = (grados) => {
      libro.current.style.transform = `rotateY(-${grados}deg)`
      const caras = [...libro.current.children].map(c => c.getBoundingClientRect())
      const base = viaje.current.getBoundingClientRect()
      const izq = Math.min(...caras.map(c => c.left))
      const der = Math.max(...caras.map(c => c.right))
      return (izq + der) / 2 - base.left
    }
    // Los puntos del trayecto van con los mismos tiempos que el giro, y para
    // cada uno se sabe el ángulo: así la compensación es exacta en cada paso.
    const centroSalida = { x: caja.left + grosorLomo / 2, y: caja.top + caja.alto / 2 }
    const centroLlegada = { x: destino.left + destino.width / 2, y: destino.top + destino.height / 2 }
    // Los pasos del vuelo. Giro y trayecto comparten esta tabla, los mismos
    // tiempos y la misma curva: si cada uno va por su lado, entre un paso y el
    // siguiente el ángulo real no es el que se supuso al compensar el centro, y
    // el libro vuelve a bailar de lado. Por eso hay bastantes puntos.
    const pasos = [
      { t: 0,    grados: 0,  crece: 0,    avance: 0,    alto: 0 },
      { t: 0.08, grados: 3,  crece: 0.04, avance: 0.02, alto: -10 },
      { t: 0.12, grados: 6,  crece: 0.08, avance: 0.05, alto: -14 },
      { t: 0.25, grados: 24, crece: 0.22, avance: 0.17, alto: -13 },
      { t: 0.4,  grados: 46, crece: 0.4,  avance: 0.34, alto: -10 },
      { t: 0.52, grados: 53, crece: 0.5,  avance: 0.46, alto: -7 },
      { t: 0.62, grados: 58, crece: 0.6,  avance: 0.57, alto: -4 },
      { t: 0.72, grados: 74, crece: 0.73, avance: 0.71, alto: -2 },
      { t: 0.8,  grados: 90, crece: 0.86, avance: 0.85, alto: 0 },
      { t: 0.9,  grados: 90, crece: 0.94, avance: 0.94, alto: 0 },
      { t: 1,    grados: 90, crece: 1,    avance: 1,    alto: 0 },
    ]
    const centros = pasos.map(paso => medirCentro(paso.grados))
    libro.current.style.transform = ''
    const vuelo = viaje.current.animate(pasos.map(({ t, crece, avance, alto }, i) => {
      const s = 1 + (escala - 1) * crece
      const cx = centroSalida.x + (centroLlegada.x - centroSalida.x) * avance
      const cy = centroSalida.y + (centroLlegada.y - centroSalida.y) * avance + alto
      return {
        offset: t,
        transform: `translate(${cx - izquierda - s * centros[i]}px, ${cy - caja.top - s * (caja.alto / 2)}px) scale(${s})`,
      }
    }), { duration: DURACION, easing: CURVA_GIRO, fill: 'forwards' })

    // El objeto entero gira sobre la bisagra: el lomo se va de perfil y la tapa
    // viene de canto a ponerse de frente, sin que ninguna cara se mueva por su
    // cuenta. De paso se inclina un poco arriba (rotateX), que es como se mira
    // un libro que sacas de la balda.
    // El giro se demora donde tiene gracia: entre 45 y 60 grados es donde se
    // ven a la vez el lomo y la tapa, así que ahí casi se para. Pasando de
    // largo, ese momento —que es el que dice que aquello es un libro— no da
    // tiempo ni a verse.
    // El libro se endereza mientras se despega, con el mismo punto de apoyo
    // que usa la balda para torcerlo (su esquina de abajo).
    const derecho = enderezar.current.animate([
      { transform: `rotate(${caja.torcido}deg)` },
      { transform: `rotate(${caja.torcido * 0.35}deg)`, offset: 0.12 },
      { transform: 'rotate(0deg)', offset: 0.3 },
      { transform: 'rotate(0deg)' },
    ], { duration: DURACION, easing: CURVA, fill: 'forwards' })

    const giro = libro.current.animate([
      // Sin translateZ: acercar el libro al observador y devolverlo lo
      // desplazaba de lado en la proyección —la perspectiva empuja hacia fuera
      // lo que se acerca—, y eso era el vaivén que se veía en el trayecto. La
      // sensación de que se acerca ya la da el tamaño, que crece durante todo
      // el vuelo.
      { transform: 'rotateX(0deg) rotateY(0deg)' },
      { transform: 'rotateX(-5deg) rotateY(-6deg)', offset: GIRO[0] },
      { transform: 'rotateX(-9deg) rotateY(-46deg)', offset: 0.4 },
      { transform: 'rotateX(-9deg) rotateY(-58deg)', offset: 0.62 },
      { transform: 'rotateX(0deg) rotateY(-90deg)', offset: GIRO[1] },
      { transform: 'rotateX(0deg) rotateY(-90deg)' },
    ], { duration: DURACION, easing: CURVA_GIRO, fill: 'forwards' })

    vuelo.onfinish = () => alTerminar?.()
    return () => { vuelo.cancel(); derecho.cancel(); giro.cancel() }
  }, [caja, x, y, escala])

  if (!caja || !destino) return null

  // Se probó a añadir el corte de las páginas como tercera cara, al otro
  // extremo de la tapa. Se descarta: con la perspectiva tan corta se separa
  // visualmente de la tapa y se lee como un trozo pegado al lado, no como el
  // canto del libro. El volumen ya lo da el cuerpo girando.

  return createPortal(
    // Tres capas y cada una con un solo trabajo: la fija, la que viaja y la que
    // da la perspectiva. Safari aplana el 3D si la perspectiva y el transform
    // animado caen en el mismo elemento.
    <div className="pointer-events-none fixed inset-0 z-[70]">
      <div
        ref={viaje}
        className="absolute"
        style={{ left: izquierda, top: caja.top, width: anchoCaja, height: caja.alto, transformOrigin: '0 0' }}
      >
        <div
          ref={enderezar}
          className="h-full w-full"
          // El giro de la balda, con su mismo punto de apoyo: la esquina de
          // abajo a la izquierda, que es donde se apoya un libro torcido.
          style={{ transformOrigin: '0% 100%', transform: `rotate(${caja.torcido}deg)` }}
        >
        <div className="h-full w-full" style={{ perspective: PERSPECTIVA, perspectiveOrigin: '50% 42%' }}>
          <div
            ref={libro}
            className="relative h-full w-full"
            // La bisagra: el canto derecho del lomo.
            style={{ transformStyle: 'preserve-3d', transformOrigin: `${grosorLomo}px 50%` }}
          >
            {/* La tapa, en el plano del objeto: parte de la bisagra hacia atrás */}
            <div
              className="absolute top-0 overflow-hidden rounded-l-[2px] rounded-r-md bg-surface-2 shadow-[0_10px_30px_-8px_rgba(60,40,20,.5)]"
              style={{
                // Medio píxel de solape con el lomo: los dos planos se juntan
                // en la bisagra y, al redondear el navegador a subpíxeles, sin
                // él se cuela una línea de fondo entre ambos.
                left: grosorLomo - 0.5, width: anchoTapa + 0.5, height: '100%',
                transformOrigin: '0% 50%', transform: 'rotateY(90deg)', backfaceVisibility: 'hidden',
              }}
            >
              {portada
                ? <img src={portada} alt="" className="h-full w-full object-cover" />
                : <span className="block h-full w-full bg-surface-2" />}
              {/* El mismo acabado que tendrá al aterrizar en la ficha —el lomo
                  insinuado y el barniz—, para que no se note el relevo. Ese
                  degradado ya oscurece el canto de la bisagra, así que aquí
                  basta un filo para marcar el pliegue. */}
              <span className="pointer-events-none absolute inset-0" style={{ background: RELIEVE_LIBRO }} />
              <span className="pointer-events-none absolute inset-y-0 left-0 w-px bg-black/25" />
            </div>

            {/* El lomo, clonado del de la balda: es la cara que mira al frente
                cuando el libro está en la estantería. */}
            <div
              className="absolute top-0 overflow-hidden"
              style={{
                left: 0, width: grosorLomo, height: '100%',
                // Redondeado solo por fuera; por la bisagra, a escuadra.
                borderRadius: '4px 0 0 4px', backfaceVisibility: 'hidden',
              }}
            >
              <span ref={nodo => { if (nodo && !nodo.firstChild) nodo.appendChild(caja.clon) }} className="block h-full w-full" />
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
