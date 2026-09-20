import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { IconRotate, IconX, IconZoom } from '../../ui/icons'

// Recorta una foto con un rectángulo de las CUATRO ESQUINAS libres, para
// calcar tal cual lo que hay en la foto —fino, ancho, lo que sea— en vez de
// obligarlo a una proporción inventada. Lo usan tanto el lomo (RecorteLomo
// antes, hoy SelectorLomo) como la portada (SelectorPortada): las dos son
// "recorta esta foto a mano", con la única diferencia de con qué forma
// empieza el rectángulo de partida (`proporcionInicial`) y qué texto lleva
// arriba.
//
// Antes el lomo tenía su propia "ventana" de tamaño fijo (una proporción de
// reserva) sobre la que solo se podía mover y hacer zoom la foto entera por
// detrás; un lomo real casi nunca la cumplía —visto en persona: uno bastante
// más fino que lo que esa ventana permitía, sin manera de arreglarlo por
// mucho que se acercara la foto—. Ahora el rectángulo se arrastra por sus
// cuatro esquinas (mover el interior lo desplaza entero) hasta calzar justo
// con lo que hay en la foto. Con qué tamaño se ve luego lo recortado sale
// después, leyendo la proporción de la foto ya subida (ver proporcionLomo.js
// para el lomo) — aquí no hace falta decidirlo ni preguntarlo.
//
// La foto no se pinta con un <img> sino con un <canvas>: así se puede girar
// un poco sin más matemática que redibujarla rotada ANTES de que el
// rectángulo y el resto de gestos sepan nada de ella — para todo lo demás
// (arrastrar, hacer zoom, la lupa, el recorte final) el canvas ES la foto,
// tenga la inclinación que tenga.
const ESCENARIO_ANCHO = 300
const ESCENARIO_ALTO = 440
const RADIO_TIRADOR = 10       // el círculo que se ve en cada esquina
// El área donde SÍ se agarra una esquina, bastante mayor que el círculo que
// se ve: con el dedo, acertar justo en 20px de círculo es casi imposible.
const TOQUE_TIRADOR = 24
// El rectángulo no se puede encoger más de esto EN PANTALLA (no en la
// imagen): si no, con la foto muy alejada las dos esquinas se juntan y ya no
// hay sitio para agarrar ninguna de las dos por separado.
const RECT_MIN_PANTALLA = 28
const ZOOM_MIN = 1
const ZOOM_MAX = 6
// El lado más largo de la imagen que se sube, para no mandar fotos enormes
// solo porque el recorte se hizo con mucho zoom.
const SALIDA_MAX = 640
// Cuánto se puede inclinar la foto — un ajuste fino (la mano no sujetaba el
// libro del todo a plomo), no un giro libre.
const ROTACION_MAX = 20
// La lupa que aparece al agarrar una esquina, para ver exactamente dónde va
// a caer antes de soltar — el dedo tapa ese punto mientras se arrastra, así
// que sin esto es adivinar.
const LUPA_TAMANO = 108
const LUPA_ZOOM = 2.8

// `proporcionInicial`: ancho/alto del rectángulo con el que se abre, antes
// de que el jugador lo toque — un lomo empieza fino y alto (como el hueco de
// la balda), una portada empieza como un libro (2/3). Es solo el punto de
// partida: las cuatro esquinas siguen sueltas y se pueden llevar a cualquier
// forma.
export default function RecortarFoto({
  file, onCancelar, onConfirmar,
  titulo = 'Encuadra la imagen',
  instrucciones = 'Ajusta las esquinas al encuadre · pellizca o usa la rueda para acercar',
  proporcionInicial = 0.28,
}) {
  // Foto que no se ha podido leer (formato no soportado, archivo corrupto…)
  // — antes esto dejaba el recorte en negro para siempre sin explicar nada.
  const [errorCarga, setErrorCarga] = useState(null)
  // El tamaño del LIENZO de trabajo — no el de la foto: algo mayor EN CADA
  // EJE por separado (no un cuadrado del lado mayor — eso malgastaba media
  // pantalla en bandas negras con una foto claramente vertical u horizontal,
  // sobre todo en un escenario también vertical como este) para que quepa
  // entera girada hasta ROTACION_MAX sin que ninguna esquina se salga. No
  // cambia con la rotación (solo con la foto de partida), así que el resto
  // de coordenadas nunca hay que remaparlas al mover el deslizador de girar.
  const [lienzo,    setLienzo]    = useState(null)  // {w, h, natW, natH}
  const [rotacion,  setRotacion]  = useState(0)
  const [zoomFactor, setZoomFactor] = useState(1)
  // Dónde cae la esquina (0,0) del LIENZO dentro del escenario.
  const [offset,    setOffset]    = useState({ x: 0, y: 0 })
  // El recorte, en coordenadas del LIENZO — así no se mueve ni cambia de
  // tamaño en pantalla al hacer pan, zoom o girar.
  const [rect,      setRect]      = useState(null)  // {x,y,w,h}
  const [guardando, setGuardando] = useState(false)
  const escenarioRef = useRef(null)
  const bitmapRef = useRef(null)     // la foto tal cual se cargó, sin girar — fuente para redibujar el lienzo
  const canvasRef = useRef(null)     // el lienzo visible: la foto ya girada
  const lupaRef = useRef(null)       // el canvas pequeño de la lupa
  const gestoRef = useRef(null)      // el arrastre en curso: pan de la foto, mover el recorte, o una esquina
  const pinchRef = useRef(null)      // pellizco con dos dedos
  const [lupaEn, setLupaEn] = useState(null)  // {x,y} en coords del lienzo, mientras se arrastra una esquina

  // `createImageBitmap` decodifica directo desde los bytes del File, sin
  // pasar por una blob: URL ni por la carga de un <img> — evita el fallo
  // silencioso (recorte en negro, sin ningún aviso) que daba esa vía con
  // fotos en un formato que el <img> no sabía decodificar (típico de una
  // foto de galería de iPhone) o, en una PWA instalada, con el propio bug
  // de WebKit resolviendo blob: URLs.
  useEffect(() => {
    let cancelado = false
    setErrorCarga(null)
    setLienzo(null)
    createImageBitmap(file).then(bitmap => {
      if (cancelado) { bitmap.close(); return }
      bitmapRef.current = bitmap
      onImgLoad(bitmap.width, bitmap.height)
    }).catch(() => {
      if (!cancelado) setErrorCarga('No se ha podido leer esta foto. Prueba con otra.')
    })
    return () => {
      cancelado = true
      bitmapRef.current?.close()
      bitmapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  // El zoom mínimo (zoomFactor 1) tiene que dejar la FOTO —no el lienzo
  // entero, que es más grande por el margen para poder girarla— cubriendo
  // el escenario de punta a punta: nada de fondo detrás, como pide "que al
  // alejar del todo se vea mi foto entera y punto". Es el mismo cálculo que
  // un `background-size: cover`, pero para una foto que además puede estar
  // girada — el ángulo hace falta (a más inclinación, más hay que acercar
  // para seguir tapando las esquinas del escenario). Recibe `natW`/`natH`
  // aparte (no los lee de `lienzo`) para poder usarse también al cargar la
  // foto, antes de que ese estado exista todavía.
  function ajusteBase(anguloGrados, natW, natH) {
    const rad = (Math.abs(anguloGrados) * Math.PI) / 180
    const porAncho = (ESCENARIO_ANCHO * Math.cos(rad) + ESCENARIO_ALTO * Math.sin(rad)) / natW
    const porAlto = (ESCENARIO_ANCHO * Math.sin(rad) + ESCENARIO_ALTO * Math.cos(rad)) / natH
    return Math.max(porAncho, porAlto)
  }
  const baseScale = lienzo ? ajusteBase(rotacion, lienzo.natW, lienzo.natH) : 1
  const scale = baseScale * zoomFactor

  function onImgLoad(w, h) {
    // El lienzo tiene que caber entera la foto girada hasta ROTACION_MAX a
    // cada lado — la caja que envuelve un rectángulo girado, con su ANCHO y
    // su ALTO calculados cada uno por separado (no un cuadrado del mayor de
    // los dos, que era lo que dejaba esas bandas negras enormes con una
    // foto claramente vertical u horizontal).
    const rad = (ROTACION_MAX * Math.PI) / 180
    const lw = Math.ceil(w * Math.cos(rad) + h * Math.sin(rad))
    const lh = Math.ceil(w * Math.sin(rad) + h * Math.cos(rad))
    setLienzo({ w: lw, h: lh, natW: w, natH: h })
    setZoomFactor(1)
    const bs = ajusteBase(0, w, h)
    setOffset({ x: (ESCENARIO_ANCHO - lw * bs) / 2, y: (ESCENARIO_ALTO - lh * bs) / 2 })
    // Un rectángulo de partida ya con la forma esperada (ver
    // `proporcionInicial`), en el centro de la foto: así solo hace falta
    // ajustarlo a las esquinas de verdad, no dibujarlo desde cero.
    const altoIni = h * 0.7
    const anchoIni = Math.min(w, altoIni * proporcionInicial)
    setRect({ x: (lw - anchoIni) / 2, y: (lh - altoIni) / 2, w: anchoIni, h: altoIni })
  }

  // Redibuja el lienzo visible cada vez que cambia el ángulo (o al cargar la
  // foto): la foto original, centrada y girada, sobre un rectángulo vacío.
  // El recorte y el resto de gestos no saben nada de esto — para ellos el
  // lienzo ES la foto.
  useEffect(() => {
    if (!lienzo || !canvasRef.current || !bitmapRef.current) return
    const canvas = canvasRef.current
    canvas.width = lienzo.w
    canvas.height = lienzo.h
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, lienzo.w, lienzo.h)
    ctx.save()
    ctx.translate(lienzo.w / 2, lienzo.h / 2)
    ctx.rotate((rotacion * Math.PI) / 180)
    ctx.drawImage(bitmapRef.current, -lienzo.natW / 2, -lienzo.natH / 2, lienzo.natW, lienzo.natH)
    ctx.restore()
  }, [lienzo, rotacion])

  function aPantalla(nx, ny) {
    return { x: offset.x + nx * scale, y: offset.y + ny * scale }
  }

  function puntoEnEscenario(clientX, clientY) {
    const r = escenarioRef.current.getBoundingClientRect()
    return { x: clientX - r.left, y: clientY - r.top }
  }

  function cambiarZoom(nuevoZoom, centroPantalla) {
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nuevoZoom))
    // El punto del lienzo bajo el dedo/rueda se queda fijo en pantalla — si
    // no, cada pellizco desplaza la foto y es imposible afinar.
    const natX = (centroPantalla.x - offset.x) / scale
    const natY = (centroPantalla.y - offset.y) / scale
    const nuevaScale = baseScale * z
    const candidato = { x: centroPantalla.x - natX * nuevaScale, y: centroPantalla.y - natY * nuevaScale }
    setZoomFactor(z)
    // Alejar (zoom hacia ZOOM_MIN) con el pellizco lejos del centro podía
    // dejar la foto sin cubrir una esquina del escenario — se topa aquí,
    // igual que un arrastre.
    setOffset(offsetHaciaValido(candidato, nuevaScale))
  }

  // Qué hay bajo el dedo al EMPEZAR a arrastrar: una esquina del recorte
  // (redimensiona), su interior (lo mueve entero) o fuera de él (desplaza la
  // foto por debajo, como antes).
  function detectarGesto(clientX, clientY) {
    const p = puntoEnEscenario(clientX, clientY)
    if (!rect) return { tipo: 'pan' }
    const esquinas = {
      no: aPantalla(rect.x, rect.y), ne: aPantalla(rect.x + rect.w, rect.y),
      so: aPantalla(rect.x, rect.y + rect.h), se: aPantalla(rect.x + rect.w, rect.y + rect.h),
    }
    for (const [clave, esq] of Object.entries(esquinas)) {
      if (Math.abs(p.x - esq.x) <= TOQUE_TIRADOR && Math.abs(p.y - esq.y) <= TOQUE_TIRADOR) return { tipo: 'esquina', esquina: clave }
    }
    const a = aPantalla(rect.x, rect.y), b = aPantalla(rect.x + rect.w, rect.y + rect.h)
    if (p.x >= a.x && p.x <= b.x && p.y >= a.y && p.y <= b.y) return { tipo: 'mover' }
    return { tipo: 'pan' }
  }

  // Arrastrar una esquina: el resultado se calcula siempre a partir del
  // rectángulo de cuando EMPEZÓ el gesto (no del último frame), para que no
  // arrastre error de redondeo, y con el `dx`/`dy` ya topado para que ni se
  // salga del lienzo ni cruce a la esquina opuesta (un rectángulo "al
  // revés" no significa nada aquí).
  function moverEsquina(rectInicial, esquina, dx, dy) {
    const minN = RECT_MIN_PANTALLA / scale
    const r = rectInicial
    let { x, y, w, h } = r
    if (esquina === 'se' || esquina === 'ne') {
      const ndx = Math.min(Math.max(dx, minN - r.w), lienzo.w - r.x - r.w)
      w = r.w + ndx
    } else {
      const ndx = Math.min(Math.max(dx, -r.x), r.w - minN)
      x = r.x + ndx; w = r.w - ndx
    }
    if (esquina === 'so' || esquina === 'se') {
      const ndy = Math.min(Math.max(dy, minN - r.h), lienzo.h - r.y - r.h)
      h = r.h + ndy
    } else {
      const ndy = Math.min(Math.max(dy, -r.y), r.h - minN)
      y = r.y + ndy; h = r.h - ndy
    }
    return { x, y, w, h }
  }

  function moverRect(rectInicial, dx, dy) {
    const r = rectInicial
    const ndx = Math.min(Math.max(dx, -r.x), lienzo.w - r.x - r.w)
    const ndy = Math.min(Math.max(dy, -r.y), lienzo.h - r.y - r.h)
    return { x: r.x + ndx, y: r.y + ndy, w: r.w, h: r.h }
  }

  // ¿Cae este punto del LIENZO dentro de la foto de verdad? El lienzo es más
  // grande que la foto (deja sitio para poder girarla sin que ninguna
  // esquina se salga — ver `onImgLoad`), así que fuera de la foto no hay
  // ninguna imagen: es transparente, y un JPEG no sabe pintar transparencia
  // — el navegador lo rellena de NEGRO al exportar. Si el recorte llegaba a
  // pisar esa franja (fácil de hacer sin darse cuenta: en el escenario los
  // dos —el fondo y la zona sin foto— se ven igual de negros), el archivo
  // que se subía llevaba ese borde negro pegado para siempre. Por eso el
  // recorte no puede tocar esa zona: se topa contra el borde real de la
  // foto, no contra el lienzo.
  function puntoDentroDeFoto(px, py) {
    const cx = lienzo.w / 2, cy = lienzo.h / 2
    const rad = (-rotacion * Math.PI) / 180
    const dx = px - cx, dy = py - cy
    const ox = dx * Math.cos(rad) - dy * Math.sin(rad)
    const oy = dx * Math.sin(rad) + dy * Math.cos(rad)
    return Math.abs(ox) <= lienzo.natW / 2 && Math.abs(oy) <= lienzo.natH / 2
  }
  function rectDentroDeFoto(r) {
    return puntoDentroDeFoto(r.x, r.y) && puntoDentroDeFoto(r.x + r.w, r.y)
      && puntoDentroDeFoto(r.x, r.y + r.h) && puntoDentroDeFoto(r.x + r.w, r.y + r.h)
  }

  // Envuelve `moverEsquina`/`moverRect`: si el movimiento pedido saca el
  // recorte de la foto de verdad, lo recorta a la mayor parte de ese mismo
  // movimiento que SÍ quepa entera dentro — así la esquina se para justo en
  // el borde real en vez de colarse en la franja transparente. Búsqueda
  // binaria porque, con la foto girada, ese borde no es un simple tope de
  // x/y: es la arista de un rectángulo inclinado.
  function limitarAFoto(rectInicial, calcular, dx, dy) {
    const candidato = calcular(rectInicial, dx, dy)
    if (rectDentroDeFoto(candidato)) return candidato
    let lo = 0, hi = 1
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2
      if (rectDentroDeFoto(calcular(rectInicial, dx * mid, dy * mid))) lo = mid; else hi = mid
    }
    return calcular(rectInicial, dx * lo, dy * lo)
  }

  // ¿El escenario entero queda cubierto por la foto si el lienzo se coloca
  // en `candidato`? Las cuatro esquinas del escenario, pasadas a
  // coordenadas del lienzo, tienen que caer dentro de la foto real — el
  // mismo `puntoDentroDeFoto` de arriba, mirado al revés: ahí acota dónde
  // puede estar el RECORTE, aquí acota dónde puede estar la FOTO. Sin esto,
  // arrastrar para mover la foto (o hacer zoom hacia fuera) no tenía ningún
  // tope, así que era fácil dejar una esquina o un borde del escenario sin
  // foto detrás — otra vía hacia el mismo fondo negro que `limitarAFoto`
  // evita en el recorte.
  function escenarioCubierto(candidato, escalaUsada = scale) {
    const esquinas = [[0, 0], [ESCENARIO_ANCHO, 0], [0, ESCENARIO_ALTO], [ESCENARIO_ANCHO, ESCENARIO_ALTO]]
    return esquinas.every(([ex, ey]) =>
      puntoDentroDeFoto((ex - candidato.x) / escalaUsada, (ey - candidato.y) / escalaUsada))
  }

  // Mismo truco de bisección que `limitarAFoto`, pero para el desplazamiento
  // de la foto: si el destino directo deja algún borde del escenario sin
  // foto, se prueba la mayor parte de ese mismo movimiento que sí sirva —
  // así arrastrar o hacer zoom hacia fuera se para justo en el borde, en vez
  // de dejar ver el fondo negro de detrás.
  function limitarOffset(offsetInicial, calcular, dx, dy, escalaUsada = scale) {
    const candidato = calcular(offsetInicial, dx, dy)
    if (escenarioCubierto(candidato, escalaUsada)) return candidato
    let lo = 0, hi = 1
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2
      if (escenarioCubierto(calcular(offsetInicial, dx * mid, dy * mid), escalaUsada)) lo = mid; else hi = mid
    }
    return calcular(offsetInicial, dx * lo, dy * lo)
  }

  // Para el zoom y el giro no hay un "arrastre" del que partir — el destino
  // se calcula de golpe (por el pellizco, o porque acaba de cambiar el
  // ángulo) — así que aquí el punto de referencia seguro es el lienzo
  // centrado en el escenario a esa escala (el único del que se SABE, por
  // cómo se calcula `baseScale`, que cubre el escenario entero): si el
  // destino directo no cubre el escenario, se busca el punto más cercano a
  // él, en la línea hacia el centrado, que sí lo cubra.
  function offsetHaciaValido(candidato, escalaUsada) {
    if (escenarioCubierto(candidato, escalaUsada)) return candidato
    const centrado = { x: (ESCENARIO_ANCHO - lienzo.w * escalaUsada) / 2, y: (ESCENARIO_ALTO - lienzo.h * escalaUsada) / 2 }
    let lo = 0, hi = 1
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2
      const prueba = { x: candidato.x + (centrado.x - candidato.x) * mid, y: candidato.y + (centrado.y - candidato.y) * mid }
      if (escenarioCubierto(prueba, escalaUsada)) hi = mid; else lo = mid
    }
    return { x: candidato.x + (centrado.x - candidato.x) * hi, y: candidato.y + (centrado.y - candidato.y) * hi }
  }

  // El punto exacto de la esquina que se está arrastrando, en coordenadas
  // del lienzo — lo que enseña la lupa.
  function puntoDeEsquina(r, esquina) {
    return {
      x: esquina === 'no' || esquina === 'so' ? r.x : r.x + r.w,
      y: esquina === 'no' || esquina === 'ne' ? r.y : r.y + r.h,
    }
  }

  // Dibuja la lupa: un trozo ampliado del LIENZO (ya girado, con zoom y todo
  // aplicado) centrado en el punto exacto de la esquina, con una cruz para
  // marcarlo. Se redibuja en cada movimiento del dedo, no con CSS, porque el
  // lienzo de origen ya está compuesto (rotado) y esto es solo recortarlo.
  function dibujarLupa(punto) {
    const destino = lupaRef.current
    const origen = canvasRef.current
    if (!destino || !origen) return
    const ctx = destino.getContext('2d')
    ctx.clearRect(0, 0, LUPA_TAMANO, LUPA_TAMANO)
    const ladoOrigen = LUPA_TAMANO / (scale * LUPA_ZOOM)
    ctx.save()
    ctx.beginPath()
    ctx.arc(LUPA_TAMANO / 2, LUPA_TAMANO / 2, LUPA_TAMANO / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(
      origen,
      punto.x - ladoOrigen / 2, punto.y - ladoOrigen / 2, ladoOrigen, ladoOrigen,
      0, 0, LUPA_TAMANO, LUPA_TAMANO,
    )
    ctx.restore()
    // La cruz que marca el punto exacto — el centro de la lupa es justo la
    // esquina que se está soltando.
    ctx.strokeStyle = 'rgba(255,255,255,.9)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(LUPA_TAMANO / 2, 6); ctx.lineTo(LUPA_TAMANO / 2, LUPA_TAMANO - 6)
    ctx.moveTo(6, LUPA_TAMANO / 2); ctx.lineTo(LUPA_TAMANO - 6, LUPA_TAMANO / 2)
    ctx.stroke()
  }

  useEffect(() => {
    if (lupaEn) dibujarLupa(lupaEn)
  })

  // Girar puede dejar un recorte que antes cabía de sobra ahora asomando
  // fuera de la foto real (al girar, sus esquinas "giran hacia dentro"). Se
  // encoge hacia su propio centro —sin desplazarlo— hasta que vuelve a caber
  // entero, por el mismo motivo que limitarAFoto: fuera de la foto no hay
  // imagen, y eso acaba siendo un borde negro en el archivo subido.
  useEffect(() => {
    if (!rect || !lienzo || rectDentroDeFoto(rect)) return
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2
    let lo = 0, hi = 1
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      const w = rect.w * mid, h = rect.h * mid
      if (rectDentroDeFoto({ x: cx - w / 2, y: cy - h / 2, w, h })) lo = mid; else hi = mid
    }
    const w = rect.w * lo, h = rect.h * lo
    setRect({ x: cx - w / 2, y: cy - h / 2, w, h })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotacion])

  // Girar también cambia cuánto hace falta acercar para seguir cubriendo el
  // escenario entero (`baseScale` depende del ángulo) — si la foto estaba
  // desplazada del centro (por un arrastre previo), un giro puede dejar
  // igualmente una esquina del escenario sin foto detrás.
  useEffect(() => {
    if (!lienzo) return
    setOffset(o => (escenarioCubierto(o) ? o : offsetHaciaValido(o, scale)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotacion])

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (gestoRef.current?.tipo === 'pan' && !pinchRef.current) {
      // Segundo dedo mientras se desplazaba la foto: pasa a pellizco.
      pinchRef.current = { uno: gestoRef.current.puntero, otro: { id: e.pointerId, x: e.clientX, y: e.clientY } }
      gestoRef.current = null
      return
    }
    if (pinchRef.current || gestoRef.current) return   // gesto ya en marcha (mover/redimensionar): un dedo de más se ignora
    const detectado = detectarGesto(e.clientX, e.clientY)
    gestoRef.current = { ...detectado, puntero: { id: e.pointerId, x: e.clientX, y: e.clientY }, rectInicial: rect, offsetInicial: offset }
    if (detectado.tipo === 'esquina') setLupaEn(puntoDeEsquina(rect, detectado.esquina))
  }

  function onPointerMove(e) {
    if (pinchRef.current) {
      const p = pinchRef.current
      const otro = p.uno.id === e.pointerId ? p.otro : (p.otro?.id === e.pointerId ? p.uno : null)
      if (!otro) return
      const mio = { id: e.pointerId, x: e.clientX, y: e.clientY }
      if (p.uno.id === e.pointerId) p.uno = mio; else p.otro = mio
      if (!p.distInicial) { p.distInicial = Math.hypot(p.uno.x - p.otro.x, p.uno.y - p.otro.y); p.zoomInicial = zoomFactor; return }
      const dist = Math.hypot(p.uno.x - p.otro.x, p.uno.y - p.otro.y)
      const medio = puntoEnEscenario((p.uno.x + p.otro.x) / 2, (p.uno.y + p.otro.y) / 2)
      cambiarZoom(p.zoomInicial * (dist / p.distInicial), medio)
      return
    }
    const g = gestoRef.current
    if (!g || g.puntero.id !== e.pointerId) return
    const dx = (e.clientX - g.puntero.x) / scale, dy = (e.clientY - g.puntero.y) / scale
    if (g.tipo === 'pan') {
      // Topado para que la foto no se pueda arrastrar hasta dejar un borde
      // del escenario sin ella detrás (ver limitarOffset/escenarioCubierto).
      setOffset(limitarOffset(
        g.offsetInicial,
        (o, ddx, ddy) => ({ x: o.x + ddx, y: o.y + ddy }),
        e.clientX - g.puntero.x, e.clientY - g.puntero.y,
      ))
    } else if (g.tipo === 'mover') {
      setRect(limitarAFoto(g.rectInicial, moverRect, dx, dy))
    } else if (g.tipo === 'esquina') {
      const nuevo = limitarAFoto(g.rectInicial, (r, dx2, dy2) => moverEsquina(r, g.esquina, dx2, dy2), dx, dy)
      setRect(nuevo)
      setLupaEn(puntoDeEsquina(nuevo, g.esquina))
    }
  }

  function onPointerUp(e) {
    if (pinchRef.current) {
      const p = pinchRef.current
      const quedaOtro = p.uno.id === e.pointerId ? p.otro : (p.otro?.id === e.pointerId ? p.uno : null)
      pinchRef.current = null
      if (quedaOtro) gestoRef.current = { tipo: 'pan', puntero: quedaOtro, offsetInicial: offset }
      return
    }
    gestoRef.current = null
    setLupaEn(null)
  }

  // React registra los listeners de rueda como pasivos: un onWheel normal no
  // puede impedir que la página se desplace por debajo mientras se hace zoom
  // aquí encima. Hace falta uno nativo, con `passive: false` — añadido una
  // sola vez (no en cada render) y con la lógica de verdad en un ref que se
  // mantiene al día solo, para no dejar el gesto a medias al re-renderizar.
  const alZoomearRef = useRef(() => {})
  alZoomearRef.current = (e) => {
    cambiarZoom(zoomFactor * (e.deltaY < 0 ? 1.08 : 1 / 1.08), puntoEnEscenario(e.clientX, e.clientY))
  }
  useEffect(() => {
    const el = escenarioRef.current
    const handler = (e) => { e.preventDefault(); alZoomearRef.current(e) }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  function confirmar() {
    if (!lienzo || !rect) return
    setGuardando(true)
    const outScale = Math.min(1, SALIDA_MAX / Math.max(rect.w, rect.h))
    const anchoSalida = Math.max(1, Math.round(rect.w * outScale))
    const altoSalida = Math.max(1, Math.round(rect.h * outScale))
    const canvas = document.createElement('canvas')
    canvas.width = anchoSalida
    canvas.height = altoSalida
    const ctx = canvas.getContext('2d')
    // Fondo blanco antes de pintar: el recorte ya no debería tocar nunca la
    // franja sin foto del lienzo (ver limitarAFoto), pero el filtrado de
    // suavizado de `rotate`+`drawImage` dora el borde mismo de la foto con
    // algún píxel semitransparente — sin esto, ese pelín se iba a negro al
    // exportar a JPEG (que no tiene canal alfa) en vez de mezclarse con blanco.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, anchoSalida, altoSalida)
    // Se recorta del LIENZO (ya girado a mano), no de la foto original: así
    // lo que se sube es exactamente lo que se ha visto encuadrar.
    ctx.drawImage(canvasRef.current, rect.x, rect.y, rect.w, rect.h, 0, 0, anchoSalida, altoSalida)
    canvas.toBlob(blob => {
      setGuardando(false)
      if (blob) onConfirmar(blob)
    }, 'image/jpeg', 0.92)
  }

  const rp = rect ? { ...aPantalla(rect.x, rect.y), w: rect.w * scale, h: rect.h * scale } : null
  const lupaPantalla = lupaEn ? aPantalla(lupaEn.x, lupaEn.y) : null

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      // Sin onClick aquí a propósito: se cierra con la X o "Cancelar", nunca
      // tocando fuera sin querer — perder el encuadre a mitad de ajustarlo
      // (o la foto entera) por un toque de más es peor que un botón de más.
      className="fixed inset-0 z-[80] flex items-center justify-center bg-velo p-4 backdrop-blur-[6px]"
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.94, opacity: 0, y: 8 }}
        transition={{ type: 'spring', damping: 24, stiffness: 340 }}
        onClick={e => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-sm flex-col items-center gap-4 overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-xl"
      >
        <div className="flex w-full items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold">{titulo}</p>
            <p className="text-xs text-ink-mute">{instrucciones}</p>
          </div>
          <button onClick={onCancelar} aria-label="Cancelar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-mute transition-colors active:bg-surface-2">
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div
          ref={escenarioRef}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          style={{ width: ESCENARIO_ANCHO, height: ESCENARIO_ALTO, touchAction: 'none' }}
          className="relative mx-auto select-none overflow-hidden rounded-xl bg-black"
        >
          {errorCarga && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/90">
              {errorCarga}
            </div>
          )}
          {lienzo && (
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute', left: offset.x, top: offset.y,
                width: lienzo.w * scale, height: lienzo.h * scale,
              }}
            />
          )}
          {/* El recorte se ve nítido; el resto de la foto —solo ahí para dar
              contexto y sitio de sobra donde encuadrar— queda oscurecido. */}
          {rp && (<>
            <div
              style={{
                position: 'absolute', left: rp.x, top: rp.y, width: rp.w, height: rp.h,
                boxShadow: '0 0 0 9999px rgba(0,0,0,.6)',
                border: '1px solid rgba(255,255,255,.85)',
                pointerEvents: 'none',
              }}
            />
            {[[rp.x, rp.y], [rp.x + rp.w, rp.y], [rp.x, rp.y + rp.h], [rp.x + rp.w, rp.y + rp.h]].map(([x, y], i) => (
              <div
                key={i}
                style={{
                  position: 'absolute', left: x - RADIO_TIRADOR, top: y - RADIO_TIRADOR,
                  width: RADIO_TIRADOR * 2, height: RADIO_TIRADOR * 2, borderRadius: '999px',
                  background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.5)', pointerEvents: 'none',
                }}
              />
            ))}
          </>)}
          {/* La lupa: aparece al agarrar una esquina, encima del dedo (que
              si no, tapa justo el punto que se está encuadrando) y topada
              para no salirse del escenario. */}
          {lupaPantalla && (
            <canvas
              ref={lupaRef}
              width={LUPA_TAMANO}
              height={LUPA_TAMANO}
              style={{
                position: 'absolute',
                left: Math.min(Math.max(lupaPantalla.x - LUPA_TAMANO / 2, 4), ESCENARIO_ANCHO - LUPA_TAMANO - 4),
                top: lupaPantalla.y < ESCENARIO_ALTO * 0.42 ? lupaPantalla.y + 34 : lupaPantalla.y - LUPA_TAMANO - 34,
                borderRadius: '999px', border: '2px solid rgba(255,255,255,.95)',
                boxShadow: '0 6px 18px rgba(0,0,0,.55)', pointerEvents: 'none',
              }}
            />
          )}
        </div>

        <div className="flex w-full items-center gap-2.5">
          <IconZoom className="h-4 w-4 shrink-0 text-ink-mute" />
          <input
            type="range" min={ZOOM_MIN} max={ZOOM_MAX} step="0.01" value={zoomFactor}
            onChange={e => cambiarZoom(Number(e.target.value), { x: ESCENARIO_ANCHO / 2, y: ESCENARIO_ALTO / 2 })}
            className="flex-1 accent-accent"
          />
        </div>

        <div className="flex w-full items-center gap-2.5">
          <button
            type="button"
            onClick={() => setRotacion(0)}
            aria-label="Enderezar (quitar la inclinación)"
            title="Enderezar"
            className="flex h-4 w-4 shrink-0 items-center justify-center text-ink-mute"
          >
            <IconRotate className="h-4 w-4" />
          </button>
          <input
            type="range" min={-ROTACION_MAX} max={ROTACION_MAX} step="0.5" value={rotacion}
            onChange={e => setRotacion(Number(e.target.value))}
            className="flex-1 accent-accent"
          />
          <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-ink-mute">{rotacion.toFixed(0)}°</span>
        </div>

        <div className="flex w-full gap-2.5">
          <button onClick={onCancelar} className="h-11 flex-1 rounded-xl2 border border-line text-sm text-ink-dim">
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={guardando || !lienzo || !rect}
            className="h-11 flex-1 rounded-xl2 bg-accent text-sm font-semibold text-on-accent disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : 'Usar esta foto'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
