import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { STATUS_COLOR, STATUS_LABEL, progressPct, totalPages } from './shelf'

// ─── Portada ───────────────────────────────────────────────────────────────
// Proporción de libro fija (2/3) para que la cuadrícula sea una rejilla de
// verdad y no una escalera: las portadas que devuelve Open Library vienen con
// alturas dispares, y recortando con object-cover se alinean todas.
export function Cover({ url, className = '', priority = false }) {
  const [roto, setRoto] = useState(false)
  const [cargada, setCargada] = useState(false)
  const [urlPrevia, setUrlPrevia] = useState(url)
  // Al cambiar de portada (se puede elegir otra) se reinicia el estado sin
  // esperar a un efecto, que dejaría un frame con la imagen anterior ya
  // marcada como cargada.
  if (urlPrevia !== url) { setUrlPrevia(url); setRoto(false); setCargada(false) }
  const hayImagen = !!url && !roto

  return (
    <div className={`relative aspect-[2/3] overflow-hidden rounded-md bg-surface-2 ${className}`}>
      {!hayImagen && (
        <div className="flex h-full w-full items-center justify-center">
          <LomoSinPortada />
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
            onLoad={() => setCargada(true)}
            initial={false}
            animate={{ opacity: cargada ? 1 : 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </>
      )}
    </div>
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

// Puntuar arrastrando o tocando: la mitad izquierda de una estrella es media
// puntuación. Es como se puntúa en el móvil sin abrir ningún diálogo.
export function EditableRating({ rating, onChange, size = 28 }) {
  const fila = useRef(null)
  const [previo, setPrevio] = useState(null)
  const mostrado = previo ?? rating ?? 0

  function valorEn(clientX) {
    const caja = fila.current?.getBoundingClientRect()
    if (!caja) return 0
    const x = Math.min(Math.max(clientX - caja.left, 0), caja.width)
    const bruto = (x / caja.width) * 5
    // A medias estrellas, con mínimo de 0,5: por debajo se entiende "quitar".
    const medio = Math.round(bruto * 2) / 2
    return medio < 0.5 ? 0 : medio
  }

  return (
    <motion.div
      ref={fila}
      className="inline-flex touch-none items-center"
      animate={{ scale: previo !== null ? 1.06 : 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 26 }}
      onPointerDown={(ev) => { ev.currentTarget.setPointerCapture(ev.pointerId); setPrevio(valorEn(ev.clientX)) }}
      onPointerMove={(ev) => { if (previo !== null) setPrevio(valorEn(ev.clientX)) }}
      onPointerUp={() => {
        if (previo !== null && previo !== rating) onChange(previo)
        setPrevio(null)
      }}
      onPointerCancel={() => setPrevio(null)}
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

// ─── Progreso ──────────────────────────────────────────────────────────────
export function ProgressBar({ entry, className = '' }) {
  const pct = progressPct(entry)
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

// Páginas leídas de total, cuando se sabe el total.
export function PagesLabel({ entry }) {
  const total = totalPages(entry)
  if (!total) return null
  const actual = entry.current_page ?? Math.round((entry.progress || 0) * total)
  return <>{actual} / {total} pág.</>
}
