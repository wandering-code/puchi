import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { usarPreferencia } from '../../platform/preferencias'
import { proporcionConocida } from './proporcionLomo'
import { IconCamara, IconImagen, IconLinterna, IconNivel, IconRejilla, IconX } from '../../ui/icons'

// Cámara propia para fotografiar un lomo o una portada, en vez de la del
// sistema: con la del sistema no se veía si el libro salía recto ni centrado,
// y había que arreglarlo después girando la foto a mano en el recorte.
//
// Tres ayudas, que se encienden y apagan (y se recuerdan en la cuenta):
//   - El MARCO, con la forma que debería tener lo que se fotografía: para un
//     lomo, su grosor (estimado por las páginas) contra su alto de verdad;
//     para una portada, su proporción. Con un eje en medio.
//   - El NIVEL, con los sensores del móvil: la línea que se mueve es el
//     horizonte de verdad; cuando coincide con la del marco, el móvil está
//     recto y el marco se pone verde. Avisa también si el móvil está
//     inclinado hacia delante o hacia atrás, que es lo que deforma el lomo en
//     trapecio.
//   - La REJILLA de tercios.
//
// Al disparar, la foto sale ya enderezada con el ángulo que marcaba el nivel
// y recortada alrededor del marco (con margen), y sigue al recorte fino de
// siempre (RecortarFoto). La galería sigue a mano, y si el navegador no deja
// usar la cámara se ofrece la del sistema.

// Por debajo de esto, "recto".
const TOLERANCIA = 1
// Más torcido que esto ya no es un pulso tembloroso: no se endereza solo.
const ENDEREZAR_MAX = 10
// El nivel mide el giro respecto a la gravedad, y eso solo tiene sentido con
// el móvil más o menos de pie (fotografiando un libro de pie). Tumbado, sobre
// un libro en la mesa, cualquier giro es tan bueno como otro.
const DE_PIE_MAX = 35
// A partir de aquí se avisa de que el móvil está inclinado (perspectiva).
const INCLINACION_AVISO = 8
// Cuánto se deja alrededor del marco al recortar la foto que pasa al
// recorte fino, en proporción al lado largo del marco.
const MARGEN = 0.14
const VERDE = '#4ade80'

// La forma que debería tener lo que se fotografía (ancho/alto).
//
// Un lomo de verdad es mucho más fino que el de la balda (allí se exagera
// para que quepa el título): se estima con el grosor de un libro real —unas
// 0,065 mm por página más las tapas— contra su alto de verdad (o una rústica
// de 21 cm si no se sabe).
export function proporcionEsperada(tipo, libro) {
  if (tipo === 'portada') return proporcionConocida(libro?.cover_url) || 2 / 3
  const alto = Number(libro?.height_mm) || 210
  const paginas = Number(libro?.num_pages) || 0
  if (!paginas) return 0.12
  return Math.min(0.35, Math.max(0.05, (paginas * 0.065 + 3) / alto))
}

// Safari de iOS no da los sensores sin permiso, y el permiso solo se puede
// pedir dentro de un toque. Por eso lo llama el botón que abre la cámara (y
// el del nivel, si se denegó), no la cámara al montarse. En el resto no hace
// nada.
export function pedirSensores() {
  const D = typeof window !== 'undefined' ? window.DeviceOrientationEvent : null
  if (typeof D?.requestPermission !== 'function') return Promise.resolve('granted')
  return D.requestPermission().catch(() => 'denied')
}

// El giro del móvil sobre su pantalla (en grados; positivo = girado en el
// sentido de las agujas del reloj) y cuánto se aparta de estar de pie (0 =
// pantalla vertical). Se sacan de la gravedad expresada en los ejes del
// móvil, que sale de beta y gamma (el orden de giros del estándar de
// DeviceOrientation); alpha no influye en la gravedad.
function leerNivel(beta, gamma) {
  const b = beta * Math.PI / 180
  const g = gamma * Math.PI / 180
  const gx = Math.sin(g) * Math.cos(b)
  const gy = -Math.sin(b)
  const gz = -Math.cos(g) * Math.cos(b)
  const giroPantalla = (window.screen?.orientation?.angle ?? window.orientation ?? 0)
  let giro = Math.atan2(gx, -gy) * 180 / Math.PI - giroPantalla
  giro = ((giro + 540) % 360) - 180
  const inclinacion = Math.atan2(-gz, Math.hypot(gx, gy)) * 180 / Math.PI
  return { giro, inclinacion }
}

function usarNivel(activo) {
  const [nivel, setNivel] = useState(null)
  const [sinSensores, setSinSensores] = useState(false)
  useEffect(() => {
    if (!activo) { setNivel(null); setSinSensores(false); return }
    let suave = null
    let llego = false
    const alMoverse = (ev) => {
      if (ev.beta == null || ev.gamma == null) return
      // Tarde también vale (el permiso de iOS puede tardar en darse).
      if (!llego) setSinSensores(false)
      llego = true
      const n = leerNivel(ev.beta, ev.gamma)
      // Un poco de suavizado: los sensores tiemblan y la línea bailaba.
      suave = suave
        ? { giro: suave.giro + (n.giro - suave.giro) * 0.3, inclinacion: suave.inclinacion + (n.inclinacion - suave.inclinacion) * 0.3 }
        : n
      setNivel(suave)
    }
    window.addEventListener('deviceorientation', alMoverse)
    // Un ordenador no tiene sensores: el evento no llega nunca (o llega vacío).
    const reloj = setTimeout(() => { if (!llego) setSinSensores(true) }, 1200)
    return () => { window.removeEventListener('deviceorientation', alMoverse); clearTimeout(reloj) }
  }, [activo])
  return { nivel, sinSensores }
}

// `tipo`: 'lomo' o 'portada'. `libro`: lo que se sepa del libro (páginas,
// alto, portada) para dar forma al marco. `onFoto(file)` recibe la foto ya
// enderezada y recortada alrededor del marco.
export default function CamaraGuiada({ abierta, ...props }) {
  return createPortal(
    <AnimatePresence>{abierta && <Visor key="camara" {...props} />}</AnimatePresence>,
    document.body,
  )
}

function Visor({ tipo = 'lomo', libro, onFoto, onCerrar, onGaleria, onCamaraSistema }) {
  const video = useRef(null)
  const zona = useRef(null)
  const marco = useRef(null)
  const pista = useRef(null)
  const [estado, setEstado] = useState('cargando')   // cargando | lista | { error }
  const [rejilla, setRejilla] = usarPreferencia('camaraRejilla', false)
  const [conNivel, setConNivel] = usarPreferencia('camaraNivel', true)
  const [linterna, setLinterna] = useState(null)       // null = no hay
  const [destello, setDestello] = useState(0)
  const [disparando, setDisparando] = useState(false)
  const { nivel, sinSensores } = usarNivel(conNivel)

  // La cámara trasera, a la mayor resolución que dé el navegador: el recorte
  // de después amplía mucho un lomo fino.
  useEffect(() => {
    let vivo = true
    let flujo = null
    if (!navigator.mediaDevices?.getUserMedia) {
      setEstado({ error: 'NoSoportado' })
      return
    }
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } },
    }).then(s => {
      if (!vivo) { s.getTracks().forEach(t => t.stop()); return }
      flujo = s
      pista.current = s.getVideoTracks()[0]
      if (pista.current?.getCapabilities?.().torch) setLinterna(false)
      const v = video.current
      v.srcObject = s
      const lista = () => { if (vivo) setEstado('lista') }
      if (v.readyState >= 1) lista()
      else v.addEventListener('loadedmetadata', lista, { once: true })
      v.play?.().catch(() => {})
    }).catch(err => { if (vivo) setEstado({ error: err?.name || 'Error' }) })
    return () => { vivo = false; flujo?.getTracks().forEach(t => t.stop()) }
  }, [])

  useEffect(() => {
    const alPulsar = ev => { if (ev.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [onCerrar])

  // El marco se dimensiona sobre el hueco que dejan las barras de arriba y
  // abajo: un lomo ocupa casi todo el alto; una portada, casi todo el ancho.
  const proporcion = proporcionEsperada(tipo, libro)
  const [tamano, setTamano] = useState(null)
  useLayoutEffect(() => {
    const medir = () => {
      const r = zona.current?.getBoundingClientRect()
      if (!r) return
      let alto, ancho
      if (tipo === 'lomo') {
        alto = r.height * 0.9
        ancho = alto * proporcion
        if (ancho > r.width * 0.8) { ancho = r.width * 0.8; alto = ancho / proporcion }
      } else {
        ancho = r.width * 0.8
        alto = ancho / proporcion
        if (alto > r.height * 0.9) { alto = r.height * 0.9; ancho = alto * proporcion }
      }
      setTamano({ ancho, alto })
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [tipo, proporcion])

  const nivelValido = conNivel && nivel && Math.abs(nivel.inclinacion) <= DE_PIE_MAX
  const recto = nivelValido && Math.abs(nivel.giro) < TOLERANCIA
  const inclinado = nivelValido && Math.abs(nivel.inclinacion) > INCLINACION_AVISO
  const colorMarco = recto ? VERDE : 'rgba(255,255,255,.92)'

  async function disparar() {
    const v = video.current
    if (!v?.videoWidth || !marco.current || disparando) return
    setDisparando(true)
    setDestello(n => n + 1)
    try {
      // De la pantalla al vídeo: el <video> va con object-cover, así que se
      // escala para llenar la pantalla y se recorta lo que sobra por un lado.
      const vw = v.videoWidth
      const vh = v.videoHeight
      const caja = v.getBoundingClientRect()
      const escala = Math.max(caja.width / vw, caja.height / vh)
      const ox = caja.left + (caja.width - vw * escala) / 2
      const oy = caja.top + (caja.height - vh * escala) / 2
      const m = marco.current.getBoundingClientRect()
      const fw = m.width / escala
      const fh = m.height / escala
      const cx = (m.left + m.width / 2 - ox) / escala
      const cy = (m.top + m.height / 2 - oy) / escala
      const pad = MARGEN * Math.max(fw, fh)
      const ancho = Math.round(Math.min(vw, fw + 2 * pad))
      const alto = Math.round(Math.min(vh, fh + 2 * pad))
      // Enderezar: si el móvil estaba girado a la derecha, lo fotografiado
      // sale girado a la izquierda; se gira la foto lo mismo hacia el otro
      // lado, sobre el centro del marco.
      const giro = nivelValido && Math.abs(nivel.giro) <= ENDEREZAR_MAX ? nivel.giro : 0
      const lienzo = document.createElement('canvas')
      lienzo.width = ancho
      lienzo.height = alto
      const ctx = lienzo.getContext('2d')
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, ancho, alto)
      ctx.translate(ancho / 2, alto / 2)
      ctx.rotate(giro * Math.PI / 180)
      ctx.drawImage(v, -cx, -cy)
      const blob = await new Promise(res => lienzo.toBlob(res, 'image/jpeg', 0.92))
      if (!blob) throw new Error('sin imagen')
      onFoto(new File([blob], `${tipo}.jpg`, { type: 'image/jpeg' }))
    } catch {
      setDisparando(false)
    }
  }

  async function alternarLinterna() {
    const nuevo = !linterna
    try {
      await pista.current?.applyConstraints({ advanced: [{ torch: nuevo }] })
      setLinterna(nuevo)
    } catch { /* hay móviles que dicen tenerla y luego no dejan */ }
  }

  async function alternarNivel() {
    if (conNivel) return setConNivel(false)
    await pedirSensores()
    setConNivel(true)
  }

  const error = typeof estado === 'object' ? estado.error : null
  const textoError = error === 'NotAllowedError'
    ? 'No hay permiso para usar la cámara. Puedes darlo en los ajustes del navegador para esta web.'
    : error === 'NotFoundError' || error === 'OverconstrainedError'
      ? 'No se ha encontrado ninguna cámara en este dispositivo.'
      : 'Este navegador no deja usar la cámara desde aquí.'

  return (
    <motion.div
      className="fixed inset-0 z-[85] select-none overflow-hidden bg-black text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <motion.video
        ref={video}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 h-full w-full object-cover"
        initial={{ opacity: 0 }}
        animate={{ opacity: estado === 'lista' ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      />

      {/* El hueco entre las dos barras, donde va el marco. */}
      <div
        ref={zona}
        className="pointer-events-none absolute inset-x-0"
        style={{ top: 'calc(env(safe-area-inset-top) + 64px)', bottom: 'calc(env(safe-area-inset-bottom) + 150px)' }}
      >
        <AnimatePresence>
          {rejilla && !error && (
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                backgroundImage: 'linear-gradient(to right, transparent calc(33.33% - .5px), rgba(255,255,255,.28) calc(33.33% - .5px) calc(33.33% + .5px), transparent calc(33.33% + .5px) calc(66.67% - .5px), rgba(255,255,255,.28) calc(66.67% - .5px) calc(66.67% + .5px), transparent calc(66.67% + .5px)), linear-gradient(to bottom, transparent calc(33.33% - .5px), rgba(255,255,255,.28) calc(33.33% - .5px) calc(33.33% + .5px), transparent calc(33.33% + .5px) calc(66.67% - .5px), rgba(255,255,255,.28) calc(66.67% - .5px) calc(66.67% + .5px), transparent calc(66.67% + .5px))',
              }}
            />
          )}
        </AnimatePresence>

        {tamano && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              ref={marco}
              className="relative"
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              style={{
                width: tamano.ancho,
                height: tamano.alto,
                borderRadius: tipo === 'lomo' ? 4 : 8,
                // Fuera del marco, la imagen se oscurece: lo que cuenta es lo
                // de dentro.
                boxShadow: '0 0 0 100vmax rgba(0,0,0,.42)',
                outline: `1px solid ${colorMarco}`,
                transition: 'outline-color .15s',
              }}
            >
              <Esquinas color={colorMarco} />
              {/* El eje: el lomo va centrado en él. */}
              <span
                className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2"
                style={{ backgroundImage: `linear-gradient(to bottom, ${colorMarco} 50%, transparent 50%)`, backgroundSize: '1px 8px', opacity: 0.7 }}
              />
              {tipo === 'portada' && (
                <span
                  className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2"
                  style={{ backgroundImage: `linear-gradient(to right, ${colorMarco} 50%, transparent 50%)`, backgroundSize: '8px 1px', opacity: 0.5 }}
                />
              )}
            </motion.div>
          </div>
        )}

        {/* El nivel: la línea del marco se queda quieta; la otra es el
            horizonte de verdad. Cuando se juntan, el móvil está recto. */}
        {nivelValido && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative h-0 w-[64%]">
              <span className="absolute left-0 top-0 h-[2px] w-[18%] -translate-y-1/2 rounded-full" style={{ background: colorMarco }} />
              <span className="absolute right-0 top-0 h-[2px] w-[18%] -translate-y-1/2 rounded-full" style={{ background: colorMarco }} />
              <span
                className="absolute left-[22%] right-[22%] top-0 h-[2px] rounded-full"
                style={{ background: recto ? VERDE : '#fbbf24', transform: `translateY(-50%) rotate(${-nivel.giro}deg)`, boxShadow: '0 0 6px rgba(0,0,0,.5)' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Arriba: cerrar, qué se fotografía y las ayudas. */}
      <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}>
        <Redondo onClick={onCerrar} etiqueta="Cerrar la cámara"><IconX className="h-5 w-5" /></Redondo>
        <div className="flex-1 text-center">
          <p className="text-[15px] font-semibold drop-shadow">{tipo === 'lomo' ? 'Lomo' : 'Portada'}</p>
          <Estado nivelValido={nivelValido} recto={recto} inclinado={inclinado} nivel={nivel} conNivel={conNivel} sinSensores={sinSensores} />
        </div>
        {!error && (
          <div className="flex gap-2">
            {linterna !== null && (
              <Redondo onClick={alternarLinterna} activo={linterna} etiqueta="Linterna"><IconLinterna className="h-5 w-5" /></Redondo>
            )}
            <Redondo onClick={() => setRejilla(!rejilla)} activo={rejilla} etiqueta="Rejilla"><IconRejilla className="h-5 w-5" /></Redondo>
            <Redondo onClick={alternarNivel} activo={conNivel} etiqueta="Nivel"><IconNivel className="h-5 w-5" /></Redondo>
          </div>
        )}
      </div>

      {/* Abajo: la galería y el disparador. */}
      {!error && (
        <div className="absolute inset-x-0 bottom-0 px-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 22px)' }}>
          <p className="mb-4 text-center text-[13px] text-white/80 drop-shadow">
            {tipo === 'lomo' ? 'Mete el lomo en el marco, centrado en el eje' : 'Mete la portada en el marco'}
          </p>
          <div className="flex items-center justify-between">
            <button
              onClick={onGaleria}
              className="flex w-16 flex-col items-center gap-1 text-[11px] text-white/85 active:opacity-60"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur"><IconImagen className="h-5 w-5" /></span>
              Galería
            </button>
            <motion.button
              onClick={disparar}
              disabled={estado !== 'lista' || disparando}
              whileTap={{ scale: 0.9 }}
              aria-label="Hacer la foto"
              className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-[4px] border-white disabled:opacity-40"
            >
              <span className="h-[60px] w-[60px] rounded-full bg-white" style={{ background: recto ? VERDE : '#fff', transition: 'background .15s' }} />
            </motion.button>
            <span className="w-16" />
          </div>
        </div>
      )}

      <AnimatePresence>
        {estado === 'cargando' && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center text-sm text-white/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.3 }}
          >
            Abriendo la cámara…
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center p-8"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-full max-w-xs text-center">
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/10"><IconCamara className="h-6 w-6" /></span>
            <p className="font-semibold">No se puede abrir la cámara</p>
            <p className="mt-2 text-sm leading-relaxed text-white/70">{textoError}</p>
            <div className="mt-6 flex flex-col gap-2.5">
              {onCamaraSistema && (
                <button onClick={onCamaraSistema} className="h-12 rounded-xl2 bg-white text-[14px] font-semibold text-black">
                  Usar la cámara del móvil
                </button>
              )}
              <button onClick={onGaleria} className="h-12 rounded-xl2 border border-white/30 text-[14px] font-semibold">
                Elegir de la galería
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* El destello al disparar. */}
      <AnimatePresence>
        {destello > 0 && (
          <motion.div
            key={destello}
            className="pointer-events-none absolute inset-0 bg-white"
            initial={{ opacity: 0.75 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Estado({ nivelValido, recto, inclinado, nivel, conNivel, sinSensores }) {
  let texto = null
  let color = 'text-white/75'
  if (!conNivel) texto = null
  else if (sinSensores) texto = 'Este dispositivo no tiene nivel'
  else if (!nivel) texto = null
  else if (!nivelValido) texto = 'El nivel funciona con el móvil de pie'
  else if (inclinado) { texto = `Ponlo más vertical · ${Math.round(Math.abs(nivel.inclinacion))}°`; color = 'text-amber-300' }
  else if (recto) { texto = 'Recto'; color = 'text-green-400' }
  else texto = `${Math.abs(nivel.giro).toFixed(1).replace('.', ',')}°`
  return (
    <p className={`h-4 text-[12px] font-medium tabular-nums drop-shadow ${color}`}>{texto}</p>
  )
}

function Redondo({ onClick, activo = false, etiqueta, children }) {
  return (
    <button
      onClick={onClick}
      aria-label={etiqueta}
      aria-pressed={activo}
      className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur transition-colors ${
        activo ? 'bg-white text-black' : 'bg-black/35 text-white'
      }`}
    >
      {children}
    </button>
  )
}

// Las cuatro esquinas del marco, más gruesas que el borde: es lo que el ojo
// busca para encajar el libro.
function Esquinas({ color }) {
  const lado = 16
  const comun = { position: 'absolute', width: lado, height: lado, borderStyle: 'solid', borderWidth: 0, borderColor: color, transition: 'border-color .15s' }
  return (
    <>
      <span style={{ ...comun, left: -2, top: -2, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 6 }} />
      <span style={{ ...comun, right: -2, top: -2, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 6 }} />
      <span style={{ ...comun, right: -2, bottom: -2, borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 6 }} />
      <span style={{ ...comun, left: -2, bottom: -2, borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 6 }} />
    </>
  )
}
