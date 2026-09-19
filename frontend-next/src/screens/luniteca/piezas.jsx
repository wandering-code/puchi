import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { STATUS_COLOR, STATUS_LABEL, progressPct, totalPages } from './shelf'
import { IconX } from '../../ui/icons'

// ─── Portada ───────────────────────────────────────────────────────────────
// Proporción de libro fija (2/3) para que la cuadrícula sea una rejilla de
// verdad y no una escalera: las portadas que devuelve Open Library vienen con
// alturas dispares, y recortando con object-cover se alinean todas.
// El acabado de libro de una portada: el lomo insinuado en el canto izquierdo y
// un brillo de barniz cruzando. Lo comparten la portada de la ficha y la tapa
// del libro que vuela hasta ella (VueloDelLibro): si no llevan lo mismo, al
// aterrizar se nota el cambio.
//
// `factor` está para eso último: la franja del lomo va en píxeles, y la tapa en
// vuelo llega agrandada, así que sin corregirlo esa franja se ve más ancha
// mientras vuela y se encoge de golpe al acoplarse. Pasándole 1/escala, los dos
// coinciden al milímetro en el relevo.
export function relieveLibro(factor = 1) {
  const px = n => `${(n * factor).toFixed(2)}px`
  return [
    // el lomo: sombra en el canto y un filo de luz justo después
    `linear-gradient(to right, rgba(0,0,0,.42) 0, rgba(0,0,0,.14) ${px(5)}, rgba(255,255,255,.10) ${px(8)}, transparent ${px(16)})`,
    // el barniz de la cubierta, cruzando. Va en porcentajes, así que la escala
    // no le afecta.
    'linear-gradient(115deg, rgba(255,255,255,.16) 0%, transparent 32%, transparent 62%, rgba(255,255,255,.07) 100%)',
  ].join(',')
}

export const RELIEVE_LIBRO = relieveLibro()

// `relieve`: le da a la portada el acabado de un libro —el lomo insinuado en el
// canto izquierdo y un brillo de barniz en diagonal—. Se usa donde la portada
// se ve grande, o sea en la ficha: en una miniatura de 40px esos matices no se
// aprecian y solo ensucian.
// `realce`: el peso de la portada —sombrita y filo— va aquí dentro y no
// suelto en cada sitio, así que lo llevan todas por igual. Se apaga solo donde
// ya hay una sombra propia más grande (la portada de la ficha), porque las dos
// son box-shadow y la segunda pisaría a la primera.
// `ajustar`: la proporción 2/3 de arriba es para que una CUADRÍCULA de
// portadas quede alineada (Open Library las sirve con alturas dispares) — en
// un sitio donde la portada va SOLA, sin nada al lado con lo que alinearse
// (la ficha grande de un libro), ese recorte no aporta nada y solo esconde
// parte de la imagen sin motivo (visto: "El perfume", con una portada más
// alargada que 2/3, perdía título y pie por el recorte). Con `ajustar` la
// caja adopta la proporción REAL de la portada en cuanto se conoce (antes de
// eso, mientras carga, se usa 2/3 como reserva) y no se recorta nada.
export function Cover({ url, title, className = '', priority = false, relieve = false, realce = true, ajustar = false }) {
  const [roto, setRoto] = useState(false)
  const [cargada, setCargada] = useState(false)
  const [ratioNatural, setRatioNatural] = useState(null)
  const [urlPrevia, setUrlPrevia] = useState(url)
  // Al cambiar de portada (se puede elegir otra) se reinicia el estado sin
  // esperar a un efecto, que dejaría un frame con la imagen anterior ya
  // marcada como cargada.
  if (urlPrevia !== url) { setUrlPrevia(url); setRoto(false); setCargada(false); setRatioNatural(null) }
  const hayImagen = !!url && !roto

  return (
    <div
      className={`relative overflow-hidden rounded-md bg-surface-2 ${realce ? 'relieve-portada' : ''} ${ajustar ? '' : 'aspect-[2/3]'} ${className}`}
      style={ajustar ? { aspectRatio: ratioNatural || 2 / 3 } : undefined}
    >
      {/* Sin portada se pinta el título dentro del hueco. En la cuadrícula el
          título ya no va debajo (la portada identifica el libro de sobra), así
          que un libro sin imagen se quedaría sin nada que lo identifique. */}
      {!hayImagen && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1.5 text-center">
          <LomoSinPortada />
          {title && (
            <span className="line-clamp-4 text-[9px] leading-tight text-ink-mute">{title}</span>
          )}
        </div>
      )}
      {hayImagen && (
        <>
          {!cargada && <div className="absolute inset-0 animate-pulse bg-surface-2" />}
          <motion.img
            src={url}
            alt=""
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            onError={() => setRoto(true)}
            onLoad={e => { setCargada(true); if (ajustar) setRatioNatural(e.target.naturalWidth / e.target.naturalHeight) }}
            initial={false}
            animate={{ opacity: cargada ? 1 : 0 }}
            transition={{ duration: 0.25 }}
            className={`absolute inset-0 h-full w-full ${ajustar ? 'object-contain' : 'object-cover'}`}
          />
        </>
      )}
      {relieve && hayImagen && (
        <span
          className="pointer-events-none absolute inset-0"
          style={{ background: RELIEVE_LIBRO }}
        />
      )}
      {/* El filo, en su propia capa y la última: como `inset` en el contenedor
          se pinta DEBAJO del contenido, y la portada va encima tapándolo —
          comprobado por píxeles, el borde salía del mismo color que el centro.
          Va siempre, también en la portada grande de la ficha: es lo que
          recorta la portada contra el fondo, y en oscuro es lo único que
          separa una portada oscura de un fondo casi negro. */}
      <span
        className="pointer-events-none absolute inset-0 rounded-md"
        style={{ boxShadow: 'inset 0 0 0 1px var(--filo-portada)' }}
      />
    </div>
  )
}

// El botón de borrar una miniatura SUBIDA POR TI MISMO (SelectorPortada,
// SelectorLomo): una cruz pequeña en una esquina, con el mismo mecanismo de
// "arma, luego confirma" que IconoPeligro (BotonPeligro.jsx) —un solo toque
// no basta, y se desarma solo si no se confirma a tiempo— pero a un tamaño
// que cabe en la esquina de una miniatura en vez de un botón de fila entera.
//
// Va SIEMPRE fuera del botón que elige la miniatura, nunca dentro: dos
// `<button>` uno metido en el otro es HTML inválido (el navegador cierra el
// de fuera antes de tiempo) y aquí además el toque de borrar no puede
// disparar también el de elegir.
const ARMADO_MS = 500
export function BotonBorrarEsquina({ etiqueta = 'Borrar', onConfirmar }) {
  const [confirmando, setConfirmando] = useState(false)
  const [armado, setArmado] = useState(false)
  const temporizador = useRef(null)

  useEffect(() => () => clearTimeout(temporizador.current), [])
  // Si no se confirma en unos segundos, vuelve a su sitio: un botón que se
  // quedó en rojo de antes es justo el que se toca sin querer.
  useEffect(() => {
    if (!confirmando) return
    const id = setTimeout(() => setConfirmando(false), 3000)
    return () => clearTimeout(id)
  }, [confirmando])

  function alPulsar() {
    if (!confirmando) {
      setConfirmando(true)
      setArmado(false)
      clearTimeout(temporizador.current)
      temporizador.current = setTimeout(() => setArmado(true), ARMADO_MS)
      return
    }
    if (armado) { setConfirmando(false); onConfirmar() }
  }

  return (
    <motion.button
      type="button"
      onClick={alPulsar}
      whileTap={{ scale: 0.85 }}
      aria-label={confirmando ? `Confirmar: ${etiqueta}` : etiqueta}
      title={confirmando ? '¿Seguro?' : etiqueta}
      animate={{ opacity: confirmando && !armado ? 0.5 : 1 }}
      className={`absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm transition-colors ${
        confirmando ? 'border-danger bg-danger text-on-accent' : 'border-white/40 bg-black/55 text-white'
      }`}
    >
      <IconX className="h-3 w-3" />
    </motion.button>
  )
}

// Marcador para los libros sin portada: un lomo dibujado, no un emoji.
function LomoSinPortada() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-ink-mute/60" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 4h5v16H5zM12 4h3v16h-3z" />
      <path d="m17.5 5 2.6.7-2.4 14.6-2.6-.7z" />
    </svg>
  )
}

// ─── Puntuación ────────────────────────────────────────────────────────────
const STAR_PATH = 'M10 1.3l2.68 5.62 6.12.62-4.55 4.24 1.24 6.05L10 14.77l-5.49 3.06 1.24-6.05L1.2 7.54l6.12-.62L10 1.3z'

export function StarRating({ rating, size = 12, className = '' }) {
  if (!rating) return null
  return (
    <div className={className} aria-label={`${rating} de 5`}>
      <FilaEstrellas valor={rating} size={size} />
    </div>
  )
}

// UN SOLO <svg> para las cinco estrellas, con el relleno recortado por un
// <rect>. La versión anterior montaba un <svg> con su propio <linearGradient>
// por estrella: con 300 libros en pantalla eso son 1.500 SVG y 1.500
// gradientes que crear al montar la estantería.
function FilaEstrellas({ valor, size }) {
  const ancho = Math.max(0, Math.min(5, valor)) / 5 * 100
  const id = `luni-clip-${Math.round(ancho)}`
  return (
    <svg width={size * 5 + 4} height={size} viewBox="0 0 104 20" aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <rect x="0" y="0" width={`${ancho}%`} height="20" />
        </clipPath>
      </defs>
      <g fill="var(--color-line)">
        {[0, 21, 42, 63, 84].map(x => <path key={x} d={STAR_PATH} transform={`translate(${x} 0)`} />)}
      </g>
      <g fill="var(--color-accent)" clipPath={`url(#${id})`}>
        {[0, 21, 42, 63, 84].map(x => <path key={x} d={STAR_PATH} transform={`translate(${x} 0)`} />)}
      </g>
    </svg>
  )
}

// Mantener pulsado, arrastrar y soltar. Mismo gesto que en la Luniteca nueva
// de la Puchi actual, y por los mismos motivos:
//
// - No se puntúa con un toque suelto. Las estrellas van dentro de una lista
//   que se scrollea con el dedo justo encima de ellas; puntuar al primer roce
//   sería puntuar sin querer cada dos por tres.
// - Al mantener, la fila se AMPLÍA. Cinco estrellas a tamaño de lectura son
//   demasiado poco recorrido para elegir medios puntos con el pulgar; grande,
//   cada medio punto cae en una zona que se acierta.
// - Solo se guarda al soltar, así que se puede recorrer arriba y abajo hasta
//   dar con la nota sin mandar una petición por cada paso.
export const MANTENER_MS = 320
const ZOOM_PUNTUACION = 1.6

export function EditableRating({ rating, onChange, size = 26 }) {
  const [editando, setEditando] = useState(false)
  const [previo, setPrevio] = useState(null)
  const fila = useRef(null)
  const temporizador = useRef(null)
  const arrastrando = useRef(false)

  function valorEn(clientX) {
    const caja = fila.current?.getBoundingClientRect()
    if (!caja) return 0
    const proporcion = Math.max(0, Math.min(1, (clientX - caja.left) / caja.width))
    // A medias, y hasta 0: arrastrar del todo a la izquierda es la forma de
    // quitar la puntuación, y 0 es justo lo que ya trata el resto de la app
    // como "sin puntuar" (StarRating no pinta nada, los `rating > 0` de la
    // ficha y la actividad la esconden). No hace falta guardar null aparte.
    return Math.max(0, Math.min(5, Math.round(proporcion * 5 * 2) / 2))
  }

  function terminar(guardar) {
    clearTimeout(temporizador.current)
    if (!arrastrando.current) return
    arrastrando.current = false
    setEditando(false)
    if (guardar && previo != null && previo !== rating) onChange(previo)
    setPrevio(null)
  }

  const mostrado = editando ? previo : (rating || 0)

  return (
    <motion.div
      ref={fila}
      onPointerDown={(ev) => {
        temporizador.current = setTimeout(() => {
          arrastrando.current = true
          setEditando(true)
          setPrevio(rating || 0)
          try { ev.target.setPointerCapture(ev.pointerId) } catch { /* el navegador puede negarlo; el gesto sigue valiendo */ }
        }, MANTENER_MS)
      }}
      onPointerMove={(ev) => { if (arrastrando.current) setPrevio(valorEn(ev.clientX)) }}
      onPointerUp={() => terminar(true)}
      onPointerCancel={() => terminar(false)}
      onContextMenu={(ev) => { if (editando) ev.preventDefault() }}
      animate={{ scale: editando ? ZOOM_PUNTUACION : 1 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      title="Mantén pulsado para puntuar"
      // touch-action fijo, no solo mientras se edita: si el scroll de la
      // página gana la carrera antes de que se cumpla la espera, el gesto se
      // pierde a medias.
      // pan-y y no none: se puntúa arrastrando de lado, así que el dedo que
      // sube o baja tiene que poder desplazar la ficha. Con touch-none, tocar
      // justo encima de las estrellas dejaba la ficha clavada, y no había forma
      // de adivinar por qué.
      className="inline-flex touch-pan-y select-none items-center"
      role="slider"
      aria-label="Puntuación"
      aria-valuemin={0}
      aria-valuemax={5}
      aria-valuenow={mostrado}
    >
      <FilaEstrellas valor={mostrado} size={size} />
    </motion.div>
  )
}

// Tu puntuación, en la esquina de la portada. Un número se lee de un vistazo
// en una cuadrícula donde cada portada mide 76px; cinco estrellas a ese tamaño
// hay que pararse a contarlas. Con coma decimal, que es como se escribe en
// español (4,5 y no 4.5).
export function NotaBadge({ rating }) {
  if (!rating) return null
  return (
    // Sin z-index: con z-10 competía de tú a tú con la barra de herramientas
    // pegada arriba y, al ir después en el documento, ganaba — las notas se
    // veían pasar POR ENCIMA de la barra al hacer scroll. Va después de la
    // portada en el marcado, que es todo lo que necesita para pintarse encima
    // de ella.
    <span className="absolute right-1 top-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold leading-none text-on-accent shadow-sm">
      {rating.toLocaleString('es')}
    </span>
  )
}

// ─── Progreso ──────────────────────────────────────────────────────────────
// `pct` explícito para cuando la barra tiene que reflejar un lado concreto
// (físico o eReader) y no el que calcularía `progressPct` a partir de la
// entrada tal cual llega — ver el interruptor de formato en la ficha.
export function ProgressBar({ entry, pct: pctProp, className = '' }) {
  const pct = pctProp ?? progressPct(entry)
  return (
    <div className={`h-1 w-full overflow-hidden rounded-full bg-surface-2 ${className}`}>
      <motion.div
        className="h-full rounded-full bg-accent"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      />
    </div>
  )
}

// ─── Etiquetas ─────────────────────────────────────────────────────────────
export function StatusDot({ status, className = '' }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${className}`}
      style={{ background: STATUS_COLOR[status] || 'var(--color-ink-mute)' }}
      aria-hidden="true"
    />
  )
}

export function StatusChip({ status }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-dim">
      <StatusDot status={status} />
      {STATUS_LABEL[status] || status}
    </span>
  )
}

export function Chip({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-dim">
      {children}
    </span>
  )
}

// Por dónde vas, en páginas o en porcentaje. Las dos formas dicen lo mismo y
// cada una sirve para algo distinto: las páginas para saber cuánto queda de
// verdad, el porcentaje para comparar libros de tamaños que no se parecen.
// Quien mira elige tocando la etiqueta (ver TarjetaLeyendo).
export function PagesLabel({ entry, modo = 'paginas' }) {
  const total = totalPages(entry)
  if (!total) return null
  if (modo === 'porcentaje') return <>{progressPct(entry)}%</>
  const actual = entry.current_page ?? Math.round((entry.progress || 0) * total)
  return <>{actual} / {total} pág.</>
}
