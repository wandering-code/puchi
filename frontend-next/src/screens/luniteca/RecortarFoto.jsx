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
// El zoom se cuenta desde la foto entera a la vista (ver `ajusteBase`), que
// es bastante más lejos de lo que se empezaba antes — con el tope de 6 de
// entonces ya no se llegaba igual de cerca, y hace falta: en la foto de una
// balda entera, el lomo que se quiere recortar puede ocupar un 5% del ancho.
const ZOOM_MAX = 12
// El lado más largo de la imagen que se sube, para no mandar fotos enormes
// solo porque el recorte se hizo con mucho zoom.
const SALIDA_MAX = 640
// El lado más largo con el que se TRABAJA la foto dentro de este recorte.
// No es una cuestión de gusto: iOS Safari no pinta un <canvas> de cualquier
// tamaño —pasada un área de unos 16,7 megapíxeles deja de pintar, sin
// lanzar ningún error, y el lienzo se queda transparente— y el lienzo de
// aquí es aún mayor que la foto (lleva margen para poder girarla). Una foto
// normal de la galería de un iPhone son 4032×3024 (12 MP), que exige un
// lienzo de 4824×4222 ≈ 20 MP: por encima del límite. Bajar a 2048 de lado
// deja el lienzo en unos 5 MP, con sitio de sobra, y no se pierde nada de
// verdad porque lo que se sube no pasa de SALIDA_MAX de todos modos.
const TRABAJO_MAX = 2048
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
  // Nombre/tipo/tamaño del archivo tal cual lo dio el selector — visible en
  // pantalla mientras carga y si falla, para poder diagnosticar sin acceso
  // a las herramientas de desarrollador del móvil (no siempre hay un Mac a
  // mano para el inspector remoto de Safari).
  const [infoArchivo, setInfoArchivo] = useState(null)
  // Red de seguridad: CUALQUIER excepción de JS (no solo las de la carga de
  // la foto) mientras este componente está montado, capturada y mostrada en
  // pantalla. Sin esto, un fallo síncrono en cualquier punto del efecto de
  // carga (por ejemplo al leer `file.size`) se pierde como un error sin
  // capturar de React — no hay ErrorBoundary en la app — y deja la pantalla
  // en negro exactamente igual que el bug que se lleva rato persiguiendo,
  // pero sin ninguna pista de qué lo causó.
  const [errorJS, setErrorJS] = useState(null)
  useEffect(() => {
    function alError(e) {
      setErrorJS(`${e.message || e.error?.message || 'error desconocido'} — ${e.filename || ''}:${e.lineno || ''}`)
    }
    function alRechazo(e) {
      setErrorJS(`promesa rechazada sin capturar: ${e.reason?.message || e.reason}`)
    }
    window.addEventListener('error', alError)
    window.addEventListener('unhandledrejection', alRechazo)
    return () => {
      window.removeEventListener('error', alError)
      window.removeEventListener('unhandledrejection', alRechazo)
    }
  }, [])
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
  const lienzoComprobadoRef = useRef(null)  // el lienzo del que ya se comprobó que se pinta (ver el efecto de redibujar)

  // Confirmado en un dispositivo real: la foto hecha con la cámara se ve
  // bien; la elegida de la galería se quedaba en negro. Durante mucho
  // tiempo el sospechoso fue el formato (la cámara del selector entrega
  // JPEG, la galería de un iPhone entrega HEIC), pero la diferencia que
  // importaba era otra: el TAMAÑO. La foto de la galería viene a resolución
  // completa (12 MP o más) y con ella el lienzo se pasaba del tamaño máximo
  // que iOS Safari es capaz de pintar, que no da ningún error — simplemente
  // deja el canvas transparente, o sea negro sobre el fondo del escenario.
  // De ahí que ninguna de las rondas anteriores (createImageBitmap, blob:
  // URL vs data: URI, heic2any) cambiara nada: la foto se decodificaba
  // bien, lo que fallaba era pintarla. La foto se reduce ahora a
  // TRABAJO_MAX antes de tocar ningún canvas (ver `reducirATrabajo`).
  //
  // Se mantiene aparte la conversión de HEIC/HEIF a JPEG con
  // heic2any (decodificador HEIC de verdad escrito en JS/WASM, no depende
  // de que el navegador sepa hacerlo) y solo entonces se muestra con <img>
  // a partir de un data: URI (vía FileReader, sin blob: URL — evita aparte
  // el bug de WebKit con blob: URLs en una PWA instalada). Import
  // dinámico porque heic2any pesa ~1.3MB y la inmensa mayoría de fotos no
  // son HEIC (las hechas con la cámara de este selector, o subidas desde
  // Android, nunca lo son).
  useEffect(() => {
    let cancelado = false
    let liquidado = false   // ya se resolvió con éxito o con error definitivo
    setErrorCarga(null)
    setLienzo(null)

    function marcarError(motivo) {
      if (cancelado || liquidado) return
      liquidado = true
      const detalle = motivo ? ` (${motivo})` : ''
      setErrorCarga(`No se ha podido leer esta foto${detalle}. Prueba con otra.`)
    }

    // Reduce la foto a TRABAJO_MAX de lado antes de que nada la dibuje, y
    // devuelve la fuente ya reducida (un canvas pequeño) con su tamaño: a
    // partir de aquí el resto del componente trabaja como si la foto
    // siempre hubiera sido de ese tamaño, sin saber nada de esto.
    function reducirATrabajo(img) {
      const natW = img.naturalWidth, natH = img.naturalHeight
      const factor = Math.min(1, TRABAJO_MAX / Math.max(natW, natH))
      if (factor === 1) return { fuente: img, w: natW, h: natH }
      const w = Math.max(1, Math.round(natW * factor))
      const h = Math.max(1, Math.round(natH * factor))
      const reducido = document.createElement('canvas')
      reducido.width = w
      reducido.height = h
      const ctx = reducido.getContext('2d')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, w, h)
      return { fuente: reducido, w, h }
    }

    function marcarExito(img) {
      if (cancelado || liquidado) return
      let foto
      try {
        foto = reducirATrabajo(img)
      } catch (err) {
        marcarError(`reducir: ${err?.message || err}`)
        return
      }
      liquidado = true
      bitmapRef.current = foto.fuente
      onImgLoad(foto.w, foto.h)
    }

    function mostrar(blob) {
      const reader = new FileReader()
      reader.onload = () => {
        if (cancelado || liquidado) return
        const img = new Image()
        img.onload = () => {
          // naturalWidth/Height en 0 es la otra forma en que un <img> puede
          // "tener éxito" sin haber decodificado nada de verdad.
          if (!img.naturalWidth || !img.naturalHeight) { marcarError('imagen vacía (0×0)'); return }
          marcarExito(img)
        }
        img.onerror = () => marcarError('img')
        img.src = reader.result
      }
      reader.onerror = () => marcarError(`FileReader: ${reader.error?.name || 'desconocido'}`)
      reader.readAsDataURL(blob)
    }

    // Todo envuelto en try/catch: incluso leer `file.size` podría fallar de
    // alguna forma que no se ha visto todavía — sin esto, ese fallo se
    // perdía como un error sin capturar y ni el texto de info ni ningún
    // mensaje de error llegaban a pintarse.
    try {
      // Info del archivo tal cual lo entregó el selector — se ve en pantalla
      // mientras carga (y se queda si falla) para poder diagnosticar sin
      // acceso a las herramientas de desarrollador del móvil: qué tipo MIME
      // manda iOS de verdad (HEIC, JPEG…), tamaño, si acaso llegó vacío.
      const pesoMB = (file.size / 1024 / 1024).toFixed(2)
      setInfoArchivo(`${file.name || 'sin nombre'} · ${file.type || 'sin tipo'} · ${pesoMB} MB`)

      // El tipo MIME a veces llega vacío en iOS para archivos HEIC, así que
      // también se mira la extensión del nombre como reserva.
      const esHEIC = /^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name || '')
      if (esHEIC) {
        import('heic2any').then(({ default: heic2any }) =>
          heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
        ).then(resultado => {
          if (cancelado || liquidado) return
          mostrar(Array.isArray(resultado) ? resultado[0] : resultado)
        }).catch(err => {
          if (!cancelado && !liquidado) marcarError(`heic2any: ${err?.message || err}`)
        })
      } else {
        mostrar(file)
      }
    } catch (err) {
      marcarError(`arranque: ${err?.message || err}`)
    }

    // HEIC tarda más (cargar heic2any + decodificar) que una foto normal —
    // 6s se quedaba corto y disparaba el error antes de que le diera tiempo
    // a terminar.
    const limite = setTimeout(() => marcarError('tiempo agotado'), 15000)

    return () => {
      cancelado = true
      clearTimeout(limite)
      bitmapRef.current?.close?.()
      // Si la fuente es el canvas reducido, dejarlo en 0×0 suelta sus
      // píxeles ya mismo en vez de esperar al recolector de basura —
      // importa en un móvil, donde la memoria de canvas es justo lo que
      // escasea al venir de una foto grande.
      if (bitmapRef.current instanceof HTMLCanvasElement) {
        bitmapRef.current.width = 0
        bitmapRef.current.height = 0
      }
      bitmapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  // El zoom mínimo (zoomFactor 1) deja la FOTO ENTERA a la vista dentro del
  // escenario, con bandas de fondo donde sobre sitio — un `contain`, no un
  // `cover`. Antes era un cover: la foto tapaba el escenario de punta a
  // punta y lo que se saliera, se salía. Con una foto vertical eso da casi
  // igual (el escenario también lo es), pero con una foto HORIZONTAL —una
  // balda entera, con el libro que se busca en un extremo— recortaba justo
  // los dos extremos, y no había forma de ver la foto entera para encuadrar
  // el lomo de la izquierda del todo. Lo que se pedía al hacerlo cover ("que
  // al alejar del todo se vea mi foto entera y punto") es literalmente esto.
  //
  // El ángulo hace falta porque lo que tiene que caber es la foto GIRADA
  // (su caja envolvente crece con la inclinación). Recibe `natW`/`natH`
  // aparte (no los lee de `lienzo`) para poder usarse también al cargar la
  // foto, antes de que ese estado exista todavía.
  function ajusteBase(anguloGrados, natW, natH) {
    const { w, h } = cajaGirada(anguloGrados, natW, natH)
    return Math.min(ESCENARIO_ANCHO / w, ESCENARIO_ALTO / h)
  }

  // El ancho y el alto que ocupa una foto de natW×natH inclinada este
  // ángulo — su caja envolvente, en unidades de la propia foto.
  function cajaGirada(anguloGrados, natW, natH) {
    const rad = (Math.abs(anguloGrados) * Math.PI) / 180
    return {
      w: natW * Math.cos(rad) + natH * Math.sin(rad),
      h: natW * Math.sin(rad) + natH * Math.cos(rad),
    }
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
    // Un canvas que el navegador se niega a pintar (demasiado grande, sin
    // memoria…) no lanza ningún error: se queda transparente, y sobre el
    // fondo negro del escenario eso se ve exactamente como una foto en
    // negro. Fue justo lo que costó rondas y rondas de diagnóstico. Un par
    // de píxeles del centro —donde la foto siempre tapa el lienzo, tenga la
    // forma que tenga— bastan para distinguir "no se ha pintado nada" de
    // una foto oscura de verdad (esa sí trae alfa 255).
    // Una sola vez por foto, no en cada redibujado: girar redibuja en cada
    // paso del deslizador y leer píxeles del canvas es caro en un móvil.
    if (lienzoComprobadoRef.current !== lienzo) {
      lienzoComprobadoRef.current = lienzo
      try {
        const enBlanco = [[0.5, 0.5], [0.42, 0.42], [0.58, 0.58]].every(([fx, fy]) =>
          ctx.getImageData(Math.floor(lienzo.w * fx), Math.floor(lienzo.h * fy), 1, 1).data[3] === 0
        )
        if (enBlanco) setErrorCarga(`El navegador no ha podido pintar esta foto (lienzo ${lienzo.w}×${lienzo.h}).`)
      } catch { /* getImageData bloqueado: no es motivo para romper el recorte */ }
    }
  }, [lienzo, rotacion])

  function aPantalla(nx, ny) {
    return { x: offset.x + nx * scale, y: offset.y + ny * scale }
  }

  function puntoEnEscenario(clientX, clientY) {
    const r = escenarioRef.current.getBoundingClientRect()
    return { x: clientX - r.left, y: clientY - r.top }
  }

  // Deja el recorte ENTERO dentro del escenario si cabe (con un margen para
  // poder agarrar los tiradores de las esquinas, que si no quedan pegados al
  // borde). Solo mueve lo justo, y por eso nunca puede abrir un hueco sin
  // foto: el recorte siempre está dentro de la foto, así que acercar su
  // borde al borde del escenario acerca el de la foto como mucho hasta ahí.
  function offsetParaVerRecorte(candidato, escalaUsada) {
    if (!rect) return candidato
    const margen = RADIO_TIRADOR + 6
    function ajuste(inicio, tamano, tamanoEscenario) {
      if (tamano + margen * 2 >= tamanoEscenario) return 0   // no cabe entero: se deja donde está
      if (inicio < margen) return margen - inicio
      if (inicio + tamano > tamanoEscenario - margen) return tamanoEscenario - margen - (inicio + tamano)
      return 0
    }
    return {
      x: candidato.x + ajuste(candidato.x + rect.x * escalaUsada, rect.w * escalaUsada, ESCENARIO_ANCHO),
      y: candidato.y + ajuste(candidato.y + rect.y * escalaUsada, rect.h * escalaUsada, ESCENARIO_ALTO),
    }
  }

  // `traerRecorte`: solo al acercar con la BARRA, que es cuando no hay un
  // punto de la foto bajo el dedo que mandar respetar. Con el pellizco o la
  // rueda el punto de referencia es el del gesto y moverlo por su cuenta se
  // notaría como un tirón.
  function cambiarZoom(nuevoZoom, centroPantalla, traerRecorte = false) {
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nuevoZoom))
    // El punto del lienzo bajo el dedo/rueda se queda fijo en pantalla — si
    // no, cada pellizco desplaza la foto y es imposible afinar.
    const natX = (centroPantalla.x - offset.x) / scale
    const natY = (centroPantalla.y - offset.y) / scale
    const nuevaScale = baseScale * z
    const candidato = { x: centroPantalla.x - natX * nuevaScale, y: centroPantalla.y - natY * nuevaScale }
    setZoomFactor(z)
    // Alejar (zoom hacia ZOOM_MIN) con el pellizco lejos del centro deja la
    // foto descolocada respecto al escenario — se topa aquí, igual que un
    // arrastre.
    setOffset(offsetTopado(traerRecorte ? offsetParaVerRecorte(candidato, nuevaScale) : candidato, nuevaScale))
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

  // Dónde cae la FOTO (ya girada) dentro del escenario si el lienzo se
  // coloca en `candidato`: su caja envolvente, en coordenadas de pantalla.
  // La foto va centrada en el lienzo, así que sale del centro del lienzo
  // más media caja a cada lado.
  function cajaDeLaFoto(candidato, escalaUsada = scale) {
    const caja = cajaGirada(rotacion, lienzo.natW, lienzo.natH)
    const w = caja.w * escalaUsada, h = caja.h * escalaUsada
    const cx = candidato.x + (lienzo.w / 2) * escalaUsada
    const cy = candidato.y + (lienzo.h / 2) * escalaUsada
    return { x: cx - w / 2, y: cy - h / 2, w, h }
  }

  // El tope del desplazamiento de la foto, eje a eje. Ya no es "que la foto
  // cubra el escenario entero" —desde que el zoom mínimo enseña la foto
  // entera, eso es imposible, y además esas bandas son justo lo que se
  // quiere ver—, sino "que la foto no se pueda perder de vista":
  //
  //   · si por ese eje la foto es MÁS GRANDE que el escenario, se arrastra
  //     libremente pero sin despegar su borde del borde del escenario (lo
  //     de siempre: nada de dejar media pantalla vacía al lado de la foto);
  //   · si es MÁS PEQUEÑA (las bandas del ajuste entero), se queda centrada
  //     en ese eje — moverla ahí no llevaría a ningún sitio y solo despista.
  //
  // Es un tope directo, sin la bisección que hacía falta antes: la condición
  // anterior miraba las cuatro esquinas del escenario contra una foto
  // inclinada y no se podía despejar; esta sí.
  function offsetTopado(candidato, escalaUsada = scale) {
    if (!lienzo) return candidato
    const caja = cajaDeLaFoto(candidato, escalaUsada)
    function ajuste(inicio, tamano, tamanoEscenario) {
      if (tamano < tamanoEscenario) return (tamanoEscenario - tamano) / 2 - inicio
      if (inicio > 0) return -inicio
      if (inicio + tamano < tamanoEscenario) return tamanoEscenario - (inicio + tamano)
      return 0
    }
    return {
      x: candidato.x + ajuste(caja.x, caja.w, ESCENARIO_ANCHO),
      y: candidato.y + ajuste(caja.y, caja.h, ESCENARIO_ALTO),
    }
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

  // Girar cambia el tamaño que ocupa la foto (`baseScale` depende del
  // ángulo, porque lo que tiene que caber es la foto inclinada) — si estaba
  // desplazada del centro por un arrastre previo, el giro puede dejarla
  // descolocada respecto al escenario.
  useEffect(() => {
    if (!lienzo) return
    setOffset(o => offsetTopado(o, scale))
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
      // Topado para que la foto no se pueda arrastrar hasta perderla de
      // vista (ver offsetTopado).
      setOffset(offsetTopado({
        x: g.offsetInicial.x + (e.clientX - g.puntero.x),
        y: g.offsetInicial.y + (e.clientY - g.puntero.y),
      }))
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
      //
      // pt-safe/pb-safe: sin esto el título quedaba pegado contra el notch o
      // la isla dinámica — el resto de overlays a pantalla completa de la
      // app (HojaInferior, Shell, UpdatePrompt…) ya los llevan, a este se le
      // había olvidado.
      className="fixed inset-0 z-[80] flex items-center justify-center bg-velo p-4 pt-safe pb-safe backdrop-blur-[6px]"
    >
      <motion.div
        initial={{ transform: 'translateY(8px) scale(0.94)', opacity: 0 }} animate={{ transform: 'translateY(0px) scale(1)', opacity: 1 }} exit={{ transform: 'translateY(8px) scale(0.94)', opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 340 }}
        onClick={e => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-sm flex-col items-center gap-4 overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-xl"
      >
        {errorJS && (
          <p className="w-full rounded-lg border border-red-300 bg-red-50 p-2 text-[10px] text-red-700 break-words">
            Error de JS: {errorJS}
          </p>
        )}
        <div className="flex w-full items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold">{titulo}</p>
            <p className="text-xs text-ink-mute">{instrucciones}</p>
            {infoArchivo && (!lienzo || errorCarga) && (
              <p className="mt-1 text-[10px] text-ink-mute/70">{infoArchivo}</p>
            )}
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
          {/* Después del lienzo y del recorte a propósito: si algo ha ido
              mal, el mensaje tiene que quedar por encima de todo. */}
          {errorCarga && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center text-sm text-white/90">
              {errorCarga}
            </div>
          )}
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
          {/* min-w-0: un <input type="range"> dentro de un flex item con
              flex-1 puede ignorar el encogimiento y desbordar el contenedor
              por la derecha (min-width: auto por defecto en flexbox, muy
              visible en iOS Safari) — sin esto la barra se salía del modal. */}
          {/* Acercar con la barra lo hace alrededor del RECORTE, no del
              centro del escenario: si no, al encuadrar algo que está en un
              extremo de la foto (el lomo de la izquierda del todo en la foto
              de una balda entera) el recorte se salía de la vista justo al
              acercar para afinarlo, y había que volver a buscarlo
              arrastrando. Con el pellizco el centro sigue siendo el de los
              dos dedos, que ahí sí es lo que se espera. */}
          <input
            type="range" min={ZOOM_MIN} max={ZOOM_MAX} step="0.01" value={zoomFactor}
            onChange={e => cambiarZoom(Number(e.target.value), rp
              ? { x: rp.x + rp.w / 2, y: rp.y + rp.h / 2 }
              : { x: ESCENARIO_ANCHO / 2, y: ESCENARIO_ALTO / 2 }, true)}
            className="min-w-0 flex-1 accent-accent"
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
            className="min-w-0 flex-1 accent-accent"
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
