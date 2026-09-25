import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { relieveLibro } from './piezas'

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

// Los dos relevos —el lomo de la balda que pasa a volar, y el libro que se
// posa en la ficha— tienen que ser invisibles: en ese instante lo que vuela
// tiene que ser IDÉNTICO a lo que sustituye. El trayecto era suave, pero al
// posarse la sombra, las esquinas y el alto cambiaban de golpe, y eso es lo
// que se notaba como un final brusco (y lo mismo, al revés, al despegar de
// vuelta). Por eso la tapa lleva todo el vuelo su propia sombra y, en el
// último tramo (desde ATERRIZAJE), se va convirtiendo en la de la portada de
// la ficha.
const ATERRIZAJE = 0.8
// [x, y, desenfoque, extensión, opacidad] de cada una de las dos sombras.
const SOMBRA_VUELO = [[0, 2, 6, -2, 0.34], [0, 14, 34, -10, 0.45]]
// La de la portada de la ficha: `sombra-portada` en index.css. Si se retoca
// allí, hay que retocarla aquí o el relevo vuelve a notarse.
const SOMBRA_FICHA = [[0, 6, 14, 0, 0.18], [0, 18, 34, -16, 0.4]]
// Las esquinas de la portada de la ficha (Cover: rounded-md).
const RADIO_FICHA = 6
// Lo que tarda el lomo en soltar su sombra y sus esquinas de la balda al
// despegar (y en recuperarlas al volver).
const DESPEGUE = 0.08

// Cuántos fotogramas clave se generan a partir de la tabla de pasos (ver
// curvaSuave).
const MUESTRAS = 50

// Una curva que pasa EXACTAMENTE por los puntos dados, pero sin cambios
// bruscos de velocidad en ellos (interpolación cúbica monótona, la de
// Fritsch-Carlson: nunca se pasa de largo ni hace ondas entre dos puntos).
//
// Es lo que hace falta porque los pasos del vuelo, unidos en línea recta
// —que es lo que hace el navegador entre fotogramas clave—, cambian de
// velocidad de golpe en cada punto. Medido: el giro pasaba de 1,2 a 2°
// por fotograma de un paso al siguiente al arrancar, y al ponerse de frente
// (a los 90°) se paraba en seco a casi 3° por fotograma, justo cuando el
// trayecto y el crecimiento frenaban a la mitad también de golpe. Eso era
// lo "brusco" de los principios y los finales. Con la curva, los mismos
// puntos se alcanzan en los mismos instantes, pero llegando y saliendo de
// ellos con suavidad; y donde un valor se queda quieto (el giro a 90°, el
// punto más alto de la subida) llega con velocidad cero.
function curvaSuave(puntos) {
  const n = puntos.length
  const xs = puntos.map(p => p[0])
  const ys = puntos.map(p => p[1])
  const h = []
  const d = []
  for (let i = 0; i < n - 1; i++) {
    h[i] = xs[i + 1] - xs[i]
    d[i] = (ys[i + 1] - ys[i]) / h[i]
  }
  const m = new Array(n)
  m[0] = d[0]
  m[n - 1] = d[n - 2]
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) { m[i] = 0; continue }
    const w1 = 2 * h[i] + h[i - 1]
    const w2 = h[i] + 2 * h[i - 1]
    m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])
  }
  return (x) => {
    let i = 0
    while (i < n - 2 && x > xs[i + 1]) i++
    const u = (x - xs[i]) / h[i]
    const u2 = u * u
    const u3 = u2 * u
    return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h[i] * m[i]
      + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h[i] * m[i + 1]
  }
}

// Dónde está el libro DERECHO, a partir de la caja que envuelve al libro
// torcido (`caja`, la de getBoundingClientRect). La balda lo gira `grados`
// sobre su esquina de abajo a la izquierda: se giran las cuatro esquinas del
// libro derecho igual, y lo que sobresalen hacia arriba y a la izquierda es
// lo que hay que descontarle a la caja.
function cajaDerecha(caja, ancho, alto, grados) {
  if (!grados) return { left: caja.left, top: caja.top }
  const a = grados * Math.PI / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const esquinas = [[0, 0], [ancho, 0], [ancho, alto], [0, alto]]
    .map(([x, y]) => [x * cos - (y - alto) * sin, x * sin + (y - alto) * cos + alto])
  return {
    left: caja.left - Math.min(...esquinas.map(e => e[0])),
    top: caja.top - Math.min(...esquinas.map(e => e[1])),
  }
}

// De 0 a 1 entre dos puntos, arrancando y llegando con suavidad.
function rampa(x) {
  const c = Math.min(1, Math.max(0, x))
  return c * c * (3 - 2 * c)
}

// Todas las medidas van divididas por la escala del paso: el vuelo escala el
// contenedor entero, así que así quedan del mismo tamaño en pantalla todo el
// rato (el mismo truco que el relieve de la tapa).
function sombraTapa(k, s) {
  const px = n => `${(n / s).toFixed(2)}px`
  return SOMBRA_VUELO.map((a, i) => {
    const m = j => a[j] + (SOMBRA_FICHA[i][j] - a[j]) * k
    return `${px(m(0))} ${px(m(1))} ${px(m(2))} ${px(m(3))} rgb(var(--color-sombra) / ${m(4).toFixed(3)})`
  }).join(', ')
}

// `sentido`: 'ida' saca el libro de la balda y lo abre en la ficha; 'vuelta'
// hace el camino contrario, con las mismas animaciones puestas del revés.
export default function VueloDelLibro({ lomo, portada, destino, alTerminar, sentido = 'ida' }) {
  const volviendo = sentido === 'vuelta'
  const [caja, setCaja] = useState(null)
  const viaje = useRef(null)
  const enderezar = useRef(null)
  const libro = useRef(null)
  const tapa = useRef(null)
  const cara = useRef(null)

  useLayoutEffect(() => {
    if (!lomo || !destino) return
    // Uno de cada siete libros está torcido en la balda. Para que el vuelo
    // arranque justo donde está ese libro hay que medirlo DERECHO —si no, el
    // rectángulo que devuelve el navegador es el que envuelve al torcido, que
    // es más ancho y está desplazado— y luego enderezarlo por el camino.
    //
    // No se le quita el giro para medirlo (se hacía, apagando antes su
    // transición): tocar el transform del lomo hacía que el navegador
    // recolocara el scroll de la balda —toda ella bajaba 1,5px al tocar un
    // libro torcido, y el vuelo salía de esa posición ya movida—. En su lugar
    // se deshace el giro con la cuenta: se sabe el ángulo, el tamaño y el
    // punto de apoyo (la esquina de abajo a la izquierda), así que de la caja
    // que envuelve al libro torcido sale exacta la del libro derecho.
    const torcido = Number(/rotate\((-?[\d.]+)deg\)/.exec(lomo.style.transform)?.[1] || 0)
    // El tamaño, mejor de offsetWidth/Height: no lo tocan las transformaciones.
    const ancho = lomo.offsetWidth
    const alto = lomo.offsetHeight
    const r = cajaDerecha(lomo.getBoundingClientRect(), ancho, alto, torcido)
    // Cómo se ve en la balda justo ahora, para que la cara que vuela arranque
    // (y, de vuelta, acabe) exactamente igual: sus esquinas y su sombra.
    const estilo = getComputedStyle(lomo)
    const enLaBalda = {
      borderTopLeftRadius: estilo.borderTopLeftRadius,
      borderTopRightRadius: estilo.borderTopRightRadius,
      borderBottomRightRadius: estilo.borderBottomRightRadius,
      borderBottomLeftRadius: estilo.borderBottomLeftRadius,
      boxShadow: estilo.boxShadow,
    }
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
    // (Esa sombra, al despegar, no desaparece de golpe: la lleva un instante
    // la cara del lomo y la suelta en cuanto la tapa empieza a verse — ver
    // `cara` más abajo.)
    clon.style.boxShadow = 'none'
    // El lomo de la balda se marca como invisible en cuanto empieza el vuelo,
    // para que no se vea por duplicado, y el clon se hace DESPUÉS: hay que
    // quitarle esa marca o el clon nace invisible. Era el motivo de que en el
    // vuelo no se viera nunca el lomo, y de que todo pareciera una portada
    // plana que crece.
    clon.classList.remove('invisible')
    // Y sin el fundido de "acaba de llegar" (ver Lomos.jsx): en el clon se
    // repetiría desde cero justo al despegar.
    clon.classList.remove('lomo-llega')
    clon.style.visibility = 'visible'
    setCaja({ left: r.left, right: r.left + ancho, top: r.top, ancho, alto, torcido, clon, enLaBalda })
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
  // La proporción de la tapa que vuela tiene que ser la MISMA que la portada
  // de la ficha donde aterriza (destino.width/height) — antes era 2/3 fija,
  // que es lo que la ficha usaba también hasta hace nada; ahora que la ficha
  // respeta la proporción real de cada portada (ver `ajustar` en Cover,
  // piezas.jsx) una tapa siempre-2/3 aterrizaba con un ancho distinto al de
  // la ficha y se veía "saltar" de tamaño al acoplarse.
  const anchoTapa = caja ? caja.alto * (destino ? destino.width / destino.height : 2 / 3) : 0
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
    //
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
    //
    // La salida se toma del centro MEDIDO a 0°, no del centro del lomo: de
    // canto, la tapa asoma en perspectiva como una franja de 3-4px a la
    // derecha del lomo (transparente al despegar, ver `sombra`), así que el
    // centro medido cae un poco a la derecha del lomo. Salir del centro del
    // lomo hacía que la compensación colocara el libro 3px a la izquierda del
    // de la balda: un saltito al tocarlo y otro al posarse de vuelta.
    // (Se asigna en cuanto están medidos los centros, más abajo.)
    const centroSalida = { x: 0, y: caja.top + caja.alto / 2 }
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
    // La tabla de arriba son los puntos por los que pasa el vuelo; los
    // fotogramas clave que se le dan al navegador salen de unirlos con una
    // curva suave (ver curvaSuave), muchos y seguidos, para que entre uno y
    // otro no haya cambios de velocidad que se noten.
    const curva = clave => curvaSuave(pasos.map(p => [p.t, p[clave]]))
    const [grados, crece, avance, alto] = ['grados', 'crece', 'avance', 'alto'].map(curva)
    // La inclinación hacia ti (rotateX) mientras gira. Antes entraba y salía
    // entera en un suspiro (de 0 a -9° entre los 3° y los 6° de giro, y de
    // vuelta a 0 en el último tramo antes de ponerse de frente); ahora entra
    // y sale con su propia rampa suave, y se va del todo justo cuando el
    // libro queda de cara.
    const inclinacion = curvaSuave([[0, 0], [DESPEGUE, 0], [0.2, -9], [0.66, -9], [0.8, 0], [1, 0]])
    const fotogramas = Array.from({ length: MUESTRAS + 1 }, (_, i) => {
      const t = i / MUESTRAS
      return { t, grados: grados(t), crece: crece(t), avance: avance(t), alto: alto(t), inclinacion: inclinacion(t) }
    })
    // Los centros se miden con el libro DERECHO, aunque salga de la balda
    // torcido. El contenedor que endereza arrastra su giro al rectángulo que
    // devuelve el navegador —que es el que envuelve a lo torcido: más ancho y
    // desplazado—, y con esa medida el libro aterrizaba desviado en proporción
    // al ángulo: 8,6px en uno de 4°. Caían justo en el canto izquierdo, que es
    // donde va pintado el lomo insinuado, así que al acoplarse en la ficha ese
    // canto se recolocaba y parecía un cambio de luz.
    const giroDeLaBalda = enderezar.current.style.transform
    enderezar.current.style.transform = 'none'
    const centros = fotogramas.map(f => medirCentro(f.grados))
    centroSalida.x = izquierda + centros[0]
    enderezar.current.style.transform = giroDeLaBalda
    libro.current.style.transform = ''
    const vuelo = viaje.current.animate(fotogramas.map(({ t, crece, avance, alto }, i) => {
      const s = 1 + (escala - 1) * crece
      const cx = centroSalida.x + (centroLlegada.x - centroSalida.x) * avance
      const cy = centroSalida.y + (centroLlegada.y - centroSalida.y) * avance + alto
      return {
        offset: t,
        transform: `translate(${cx - izquierda - s * centros[i]}px, ${cy - caja.top - s * (caja.alto / 2)}px) scale(${s})`,
      }
    }), { duration: DURACION, easing: CURVA_GIRO, fill: 'forwards', direction: volviendo ? 'reverse' : 'normal' })

    // El libro se endereza mientras se despega, con el mismo punto de apoyo
    // que usa la balda para torcerlo (su esquina de abajo). Los mismos puntos
    // de siempre (35% del giro a 0,12 y derecho del todo a 0,3), unidos con
    // la misma curva suave que el resto.
    const torcer = curvaSuave([[0, 1], [0.12, 0.35], [0.3, 0], [1, 0]])
    const derecho = enderezar.current.animate(
      fotogramas.map(({ t }) => ({ offset: t, transform: `rotate(${caja.torcido * torcer(t)}deg)` })),
      { duration: DURACION, easing: CURVA, fill: 'forwards', direction: volviendo ? 'reverse' : 'normal' },
    )

    // El cuerpo entero gira sobre la bisagra: el lomo se va de perfil y la tapa
    // viene de canto a ponerse de frente, sin que ninguna cara se mueva por su
    // cuenta. Se inclina además un poco (rotateX), que es como se mira un libro
    // recién sacado de la balda.
    //
    // Va con la MISMA tabla de pasos que el trayecto, y por eso están
    // sincronizados: la compensación del centro se calculó para estos ángulos
    // en estos tiempos.
    //
    // Sin translateZ: acercar el libro al observador y devolverlo lo desplaza
    // de lado en la proyección —la perspectiva empuja hacia fuera lo que se
    // acerca—, y eso era parte del vaivén. La sensación de que viene hacia ti
    // ya la da el tamaño.
    const giro = libro.current.animate(
      fotogramas.map(({ t, grados, inclinacion }) => ({
        offset: t,
        transform: `rotateX(${inclinacion.toFixed(3)}deg) rotateY(-${grados.toFixed(3)}deg)`,
      })),
      { duration: DURACION, easing: CURVA_GIRO, fill: 'forwards', direction: volviendo ? 'reverse' : 'normal' },
    )

    // La sombra, dividida por la escala de cada paso.
    //
    // El vuelo escala el contenedor entero, así que la sombra se agranda con
    // él: un desenfoque de 30px se convierte en 120px cuando el libro llega a
    // cuadruplicar su tamaño, y a esa anchura el mismo negro repartido no se
    // ve. Quitarla del todo no cambiaba la captura, que es lo que delató que
    // no estaba pintando nada. Declarándola dividida por la escala del paso,
    // al multiplicarse por ella queda del mismo tamaño en pantalla todo el
    // rato. Es el mismo truco que ya usa el relieve de la tapa.
    //
    // Dos sombras: la de contacto, corta y pegada, y la larga que separa el
    // libro de lo que tiene detrás. Sin la primera el libro flota; sin la
    // segunda parece pegado a la pantalla.
    //
    // En el último tramo (ATERRIZAJE) la sombra y las esquinas se convierten
    // en las de la portada de la ficha, para que al posarse no cambie nada.
    // Las esquinas del lado de la bisagra van casi a escuadra mientras se ve
    // el lomo pegado a ellas; cuando llega ese tramo la tapa ya está de
    // frente y el lomo de perfil, así que pueden redondearse como las otras.
    const sombra = tapa.current.animate(
      fotogramas.map(({ t, crece }) => {
        const s = 1 + (escala - 1) * crece
        const k = rampa((t - ATERRIZAJE) / (1 - ATERRIZAJE))
        const bisagra = `${((2 + (RADIO_FICHA - 2) * k) / s).toFixed(2)}px`
        const fuera = `${(RADIO_FICHA / s).toFixed(2)}px`
        return {
          offset: t,
          boxShadow: sombraTapa(k, s),
          borderRadius: `${bisagra} ${fuera} ${fuera} ${bisagra}`,
          // En la balda no se ve la tapa. De canto, la perspectiva la dejaba
          // asomar como una franja junto al lomo que aparecía de golpe al
          // tocarlo (y desaparecía de golpe al volver): llega fundiéndose en
          // lo que el lomo tarda en soltar su sombra.
          opacity: rampa(t / DESPEGUE),
        }
      }),
      { duration: DURACION, easing: CURVA_GIRO, fill: 'forwards', direction: volviendo ? 'reverse' : 'normal' },
    )

    // La cara del lomo arranca con las esquinas y la sombra que tenía en la
    // balda y las suelta en cuanto la tapa empieza a asomar (al volver,
    // al revés: las recupera justo antes de posarse). Sin esto, al tocar el
    // lomo su sombra desaparecía de golpe y sus esquinas cambiaban.
    const b = caja.enLaBalda
    const enVuelo = {
      borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px',
      borderTopRightRadius: '0px', borderBottomRightRadius: '0px',
      boxShadow: 'none',
    }
    const soltar = cara.current.animate([
      { ...b, offset: 0 },
      { ...enVuelo, offset: DESPEGUE },
      { ...enVuelo, offset: 1 },
    ], { duration: DURACION, easing: CURVA_GIRO, fill: 'forwards', direction: volviendo ? 'reverse' : 'normal' })

    vuelo.onfinish = () => alTerminar?.()
    return () => { vuelo.cancel(); derecho.cancel(); giro.cancel(); sombra.cancel(); soltar.cancel() }
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
    <div data-vuelo className="pointer-events-none fixed inset-0 z-[70]">
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
              ref={tapa}
              className="absolute top-0 overflow-hidden rounded-l-[2px] rounded-r-md bg-surface-2"
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
                  insinuado y el barniz—, para que no se note el relevo. Y nada
                  más: cualquier añadido que no lleve la portada de la ficha
                  (un filo en la bisagra, por ejemplo) se ve desaparecer al
                  acoplarse. */}
              {/* El acabado, con las medidas divididas por la escala del
                  vuelo: la tapa llega agrandada, y sin esto la franja del lomo
                  se ve más ancha mientras vuela y pega un salto al acoplarse. */}
              <span className="pointer-events-none absolute inset-0" style={{ background: relieveLibro(1 / escala) }} />
            </div>

            {/* El lomo, clonado del de la balda: es la cara que mira al frente
                cuando el libro está en la estantería. */}
            <div
              ref={cara}
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
