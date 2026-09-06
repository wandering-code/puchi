import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { useIsMobile } from '../../../utils/responsive'
import { V3, V3_FONT, V3_RADIUS } from './lunitecaV3Theme'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

// ─── Rediseño de Luniteca (issue #8) ──────────────────────────────────────
// Armazón + estantería, construidos sobre la dirección acordada en el canvas
// de diseño (editorial cálido, tipografía recta, radios mínimos). Solo
// admin mientras se prueba (ver apps/config.js, luniteca3.adminOnly).
//
// Comparte backend y BD con Luniteca (LunitecaV2.jsx) tal cual — mismos
// endpoints, sin ningún cambio de servidor. Lo que cambia es únicamente la
// presentación. Club y Amigos son un esqueleto ("Próximamente") a propósito:
// primero se valida la estantería, luego se migran las demás pestañas.
//
// Deliberadamente NO incluye todavía: la ficha de detalle (se abre desde
// la portada) ni funcionalidad real en "Añadir libro" (botón preparado en
// la barra de herramientas, en tuneo de comportamiento) — se irán sumando
// en próximas pasadas en vez de dejar botones sin función.

// Guarda mínima contra un doble toque accidental en una acción destructiva
// (igual que en LunitecaV2.jsx): `armed` no se pone a true hasta 500ms
// después de que `active` lo esté, así que el botón de "confirmar" no
// reacciona al mismo gesto que activó la confirmación.
function useConfirmGuard(active) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!active) { setArmed(false); return }
    const t = setTimeout(() => setArmed(true), 500)
    return () => clearTimeout(t)
  }, [active])
  return armed
}

const STATUS_LABEL = {
  reading:      'Leyendo',
  rereading:    'Releyendo',
  read:         'Leído',
  want_to_read: 'Por leer',
  dropped:      'Dropeado',
}

function IconShelf({ size = 19, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5V4.5A2 2 0 0 1 6 2.5h8a2 2 0 0 1 2 2v17"/><path d="M20 22H6a2 2 0 0 1 0-4h14"/></svg>
}
function IconClub({ size = 19, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3.5 2.8-6 5.5-6s5.5 2.5 5.5 6"/><circle cx="17.5" cy="9.5" r="2.4"/><path d="M15.8 14c2.2.2 4.2 2.3 4.2 5.4"/></svg>
}
function IconAmigos({ size = 19, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="8.5" cy="9" r="3.3"/><path d="M2.8 20c0-3.4 2.6-5.8 5.7-5.8s5.7 2.4 5.7 5.8"/><path d="M16 8.5c1.8.3 3 1.9 3 4"/><path d="M17.5 14.5c1.8.4 3 2.1 3 4.5"/></svg>
}
function IconGrid({ size = 13, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
}
function IconList({ size = 13, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
}
function IconFilter({ size = 14, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16l-6 7.5V19l-4 2v-8.5z"/></svg>
}
function IconSort({ size = 14, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4v16M7 4l-3 3M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3"/></svg>
}
function IconChevron({ size = 12, color = 'currentColor', down = true }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: down ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s ease' }}><path d="m6 9 6 6 6-6"/></svg>
}
function IconSearch({ size = 14, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>
}
function IconX({ size = 12, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
}
function IconPlus({ size = 14, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
}
function IconCheck({ size = 13, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l6 6L20 6"/></svg>
}
function IconArrowLeft({ size = 15, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>
}
function IconPencil({ size = 13, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3l4 4L7 21H3v-4L17 3z"/></svg>
}
function IconTrash({ size = 13, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>
}
function IconCamera({ size = 14, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-2h6l2 2h3v12H4z"/><circle cx="12" cy="14" r="3.5"/></svg>
}
function IconBarcode({ size = 14, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M4 5v14M8 5v14M11 5v14M15 5v14M18 5v14M21 5v14"/></svg>
}
function IconRefresh({ size = 14, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 0 0-14.9-3.5M4 4v5h5M4 13a8 8 0 0 0 14.9 3.5M20 20v-5h-5"/></svg>
}
// `expand` cambia entre "plegar todo" (flechas hacia dentro) y "desplegar
// todo" (flechas hacia fuera) — mismo icono con las puntas invertidas, para
// que el propio icono ya anticipe qué va a pasar al pulsarlo.
function IconCollapseAll({ size = 14, color = 'currentColor', expand = false }) {
  return expand ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>
  )
}

// Misma lógica de "portada nunca vacía mientras carga" que Cover en
// LunitecaV2.jsx (bug real ya resuelto ahí: reseteo del estado de carga
// durante el render, no en un efecto, o una portada cacheada podía quedarse
// en opacidad 0 para siempre).
function Cover({ url, radius = V3_RADIUS }) {
  const [broken, setBroken] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [prevUrl, setPrevUrl] = useState(url)
  if (prevUrl !== url) { setPrevUrl(url); setBroken(false); setLoaded(false) }
  const showImg = !!url && !broken
  return (
    <div style={{
      width: '100%', height: '100%', borderRadius: radius, position: 'relative', overflow: 'hidden',
      background: V3.surfaceHi, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {!showImg && <span style={{ fontSize: 22, opacity: 0.5 }}>📖</span>}
      {showImg && !loaded && <Skeleton className="absolute inset-0 rounded-none" />}
      {showImg && (
        <motion.img src={url} alt="" onError={() => setBroken(true)} onLoad={() => setLoaded(true)}
          initial={false} animate={{ opacity: loaded ? 1 : 0 }} transition={{ duration: 0.25 }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
    </div>
  )
}

function progressPct(e) {
  const total = e.custom_total_pages || e.book.num_pages
  if (total && e.current_page != null) return Math.min(Math.round(e.current_page / total * 100), 100)
  return Math.round((e.progress || 0) * 100)
}

const EMPTY_FILTERS = { genre: '', folder: '', author: '', maxPages: '', minRating: '' }
// De 50 en 50 hasta 2000 — de sobra para cualquier libro real, y a pasos
// que tienen sentido para un filtro (nadie filtra "máximo 437 páginas").
const MAX_PAGES_FILTER_OPTIONS = Array.from({ length: 40 }, (_, i) => String((i + 1) * 50))

// Igual que el filtrado de LunitecaV2.jsx: se aplica sobre toda la
// estantería ANTES de repartir por estado, así que un filtro por género o
// carpeta se nota en las cuatro secciones a la vez, no solo en una.
function matchesFilters(e, filters) {
  if (filters.genre  && e.book.genre  !== filters.genre)  return false
  if (filters.folder && e.folder      !== filters.folder) return false
  if (filters.author && e.book.author !== filters.author) return false
  if (filters.maxPages) {
    const total = e.custom_total_pages || e.book.num_pages
    if (!total || total > Number(filters.maxPages)) return false
  }
  // Por ahora solo la puntuación propia (`e.rating`) — la de "el resto",
  // con sus propias valoraciones, hace falta una vista de estantería ajena
  // que todavía no existe en esta V3 (sí en LunitecaV2.jsx, ver "Amigos").
  if (filters.minRating && !(e.rating >= Number(filters.minRating))) return false
  return true
}

// Búsqueda por texto dentro de la propia estantería (título o autor) — no
// confundir con el buscador de "Añadir libro" (contra Open Library/Google
// Books), que es una pantalla aparte todavía por hacer.
function matchesQuery(e, query) {
  if (!query.trim()) return true
  const q = query.trim().toLowerCase()
  return (e.book.title || '').toLowerCase().includes(q) || (e.book.author || '').toLowerCase().includes(q)
}

const SORT_FIELDS = [
  { field: 'title',  label: 'Título' },
  { field: 'author', label: 'Autor' },
  { field: 'genre',  label: 'Género' },
  { field: 'date',   label: 'Fecha' },
]

// Mismos 4 campos que ya ofrece la Luniteca actual — cuando hay uno elegido,
// sustituye el orden por defecto DENTRO de cada sección/año (nunca cambia
// qué libro cae en qué sección, eso lo sigue decidiendo el estado).
function compareEntries(a, b, sort) {
  if (!sort.field) return 0
  let va, vb
  if (sort.field === 'title')  { va = a.book.title?.toLowerCase()  || ''; vb = b.book.title?.toLowerCase()  || '' }
  if (sort.field === 'author') { va = a.book.author?.toLowerCase() || ''; vb = b.book.author?.toLowerCase() || '' }
  if (sort.field === 'genre')  { va = a.book.genre?.toLowerCase()  || ''; vb = b.book.genre?.toLowerCase()  || '' }
  if (sort.field === 'date')   { va = a.finished_at || a.started_at || ''; vb = b.finished_at || b.started_at || '' }
  if (va < vb) return sort.dir === 'asc' ? -1 : 1
  if (va > vb) return sort.dir === 'asc' ? 1 : -1
  return 0
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Igual que en LunitecaV2.jsx: "Empezado el X" mientras se lee, rango
// "inicio – fin" al terminar (o "… – dropeado …" si se dejó), con "¿?" en el
// lado que falte — nunca fechas para "por leer".
// Empezado sin terminar (leyendo, o leído/dropeado con la fecha de fin
// todavía sin poner) se queda en una sola fecha con "¿?" señalando lo que
// falta — nunca "Empezado el...", que en la fila de chips ocupa demasiado.
function readingDatesLabel(e) {
  const tracksDates = ['reading', 'rereading', 'read', 'dropped'].includes(e.status)
  if (!tracksDates || (!e.started_at && !e.finished_at)) return null
  const start = e.started_at ? fmtDate(e.started_at) : '¿?'
  if (!e.finished_at) return `${start} – ¿?`
  const end = fmtDate(e.finished_at)
  return e.status === 'dropped' ? `${start} – dropeado ${end}` : `${start} – ${end}`
}

// Reglas de negocio calcadas de LunitecaV2.jsx (statusUpdates): al pasar a
// "leyendo"/"leído"/"dropeado" se rellenan las fechas que falten con la de
// hoy, sin pisar las que ya hubiera; "leído" además marca la página actual
// al total (si se conoce) y suma una lectura; "releyendo" reinicia fecha de
// inicio y borra la de fin; cualquier otro cambio reinicia el progreso.
function statusPatch(newStatus, entry) {
  const today = new Date().toISOString().slice(0, 10)
  const total = entry.custom_total_pages || entry.book.num_pages
  const patch = { status: newStatus }
  if (newStatus === 'reading' && !entry.started_at) patch.started_at = today
  if (newStatus === 'rereading') { patch.started_at = today; patch.finished_at = '' }
  if (newStatus === 'read') {
    if (!entry.started_at)  patch.started_at  = today
    if (!entry.finished_at) patch.finished_at = today
    if (total) patch.current_page = total
    // Solo suma una lectura al venir de "Releyendo" (una relectura de
    // verdad) o al terminarlo por primera vez en la vida (times_read a 0).
    // Terminarlo, corregir a mano que en realidad seguías leyendo (p.ej.
    // arrastrando el progreso hacia atrás) y volver a terminarlo NO cuenta
    // como una lectura nueva — es la misma lectura, no una relectura.
    if (entry.status === 'rereading' || !(entry.times_read > 0)) {
      patch.times_read = (entry.times_read || 0) + 1
    }
  } else if (newStatus === 'dropped') {
    if (!entry.started_at)  patch.started_at  = today
    if (!entry.finished_at) patch.finished_at = today
  } else if (newStatus !== 'reading') {
    patch.current_page = 0
  }
  return patch
}

const STATUS_ORDER = ['want_to_read', 'reading', 'rereading', 'read', 'dropped']

// Selector de fecha propio (día/mes/año en tres <select>) — nunca
// `<input type="date">`: en Safari de iOS ese input nativo tiene bugs de
// hace años que nunca se han arreglado (probado a fondo en su momento, ver
// memoria de proyecto). Mismo mecanismo que CustomDateInput en
// BulkAddModal.jsx/ExcelImportModal.jsx/GoodreadsImportModal.jsx, con
// estilo propio de V3.
const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
function daysInMonth(month, year) { return new Date(year, month + 1, 0).getDate() }

function DateFields({ value, onChange }) {
  const initial = value ? value.split('-') : ['', '', '']
  const [year,  setYear]  = useState(initial[0] || '')
  const [month, setMonth] = useState(initial[1] ? String(parseInt(initial[1], 10) - 1) : '')
  const [day,   setDay]   = useState(initial[2] ? String(parseInt(initial[2], 10)) : '')
  const maxDay = (month !== '' && year) ? daysInMonth(parseInt(month), parseInt(year)) : 31
  const days = Array.from({ length: maxDay }, (_, i) => i + 1)
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 90 }, (_, i) => thisYear - i)

  function commit(nextDay, nextMonth, nextYear) {
    if (nextDay === '' || nextMonth === '' || nextYear === '') { onChange(''); return }
    const clamped = Math.min(parseInt(nextDay), daysInMonth(parseInt(nextMonth), parseInt(nextYear)))
    onChange(`${nextYear}-${String(parseInt(nextMonth) + 1).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`)
  }
  const selCls = 'h-8 rounded-md border border-input bg-background px-1.5 text-xs outline-none focus:ring-1 focus:ring-ring'
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <select value={day} onChange={ev => { setDay(ev.target.value); commit(ev.target.value, month, year) }} className={selCls} style={{ flex: 0.8 }}>
        <option value="">Día</option>
        {days.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      <select value={month} onChange={ev => { setMonth(ev.target.value); commit(day, ev.target.value, year) }} className={selCls} style={{ flex: 1.6 }}>
        <option value="">Mes</option>
        {MONTHS_ES.map((m, i) => <option key={i} value={i}>{m}</option>)}
      </select>
      <select value={year} onChange={ev => { setYear(ev.target.value); commit(day, month, ev.target.value) }} className={selCls} style={{ flex: 1 }}>
        <option value="">Año</option>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  )
}

// "4" en vez de "4.0", pero "4.5" se queda tal cual (rating en pasos de 0.5).
function ratingLabel(rating) {
  return Number.isInteger(rating) ? String(rating) : rating.toFixed(1)
}

function statusDotColor(status) {
  if (status === 'reading' || status === 'rereading') return V3.accent
  if (status === 'read') return V3.read
  if (status === 'dropped') return V3.dropped
  return V3.want
}

// ─── Tarjetas de estantería ────────────────────────────────────────────────

function ReadingCard({ e, isMobile, onSelect }) {
  const w = isMobile ? 118 : 148
  const pct = progressPct(e)
  return (
    <div style={{ width: w, flexShrink: 0, minWidth: 0 }}>
      <div onClick={() => onSelect(e)} style={{ width: w, aspectRatio: '2/3', boxShadow: '0 1px 3px rgba(60,40,20,0.15), 0 6px 14px -8px rgba(60,40,20,0.28)', borderRadius: V3_RADIUS, cursor: 'pointer' }}>
        <Cover url={e.book.cover_url} />
      </div>
      <Progress value={pct} className="mt-[9px] h-[3px]" />
      <div style={{ marginTop: 8, fontSize: isMobile ? 12.5 : 13, fontWeight: 600, color: V3.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.book.title}</div>
      <div style={{ fontSize: 11.5, color: V3.sub }}>{isMobile ? `${pct}%` : `${e.book.author || ''} · ${pct}%`}</div>
    </div>
  )
}

function GridCard({ e, isMobile, onSelect }) {
  return (
    // Sin título/autor de momento (probando solo-portada) — título y
    // desplegable, ver historial. min-width:0 se queda por si vuelven: sin
    // eso, un texto nowrap fuerza la columna del grid a ensancharse hasta
    // caber el texto entero.
    <div style={{ minWidth: 0 }}>
      <div onClick={() => onSelect(e)} style={{ position: 'relative', width: '100%', aspectRatio: '2/3', boxShadow: '0 1px 3px rgba(60,40,20,0.15), 0 5px 12px -8px rgba(60,40,20,0.28)', borderRadius: V3_RADIUS, cursor: 'pointer' }}>
        <Cover url={e.book.cover_url} />
        {e.status === 'read' && e.rating > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            background: 'rgba(20,14,8,0.72)', color: '#fff',
            fontSize: 10, fontWeight: 700, lineHeight: 1,
            padding: '3px 5px', borderRadius: V3_RADIUS,
            backdropFilter: 'blur(2px)',
          }}>
            {ratingLabel(e.rating)}
          </span>
        )}
      </div>
    </div>
  )
}

// Estrellas con relleno proporcional real (no redondeado a estrella entera)
// — una fila de estrellas vacías de fondo y una copia rellena encima,
// recortada al porcentaje exacto de la puntuación (0.5 en 0.5 en la práctica,
// ver PersonalShelf.rating, pero el recorte funciona para cualquier
// fracción). Con 4.5 se ven 4 estrellas llenas y la 5ª a la mitad, en vez de
// redondear a 5 (Math.round(4.5) === 5 en JS).
const STAR_PATH = 'M10 1.3l2.68 5.62 6.12.62-4.55 4.24 1.24 6.05L10 14.77l-5.49 3.06 1.24-6.05L1.2 7.54l6.12-.62L10 1.3z'
function StarRating({ rating, size = 11 }) {
  const pct = Math.max(0, Math.min(1, (rating || 0) / 5)) * 100
  const stars = (color) => (
    <div style={{ display: 'flex', gap: 1 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 20 20" fill={color} style={{ flexShrink: 0 }}><path d={STAR_PATH} /></svg>
      ))}
    </div>
  )
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      {stars(V3.border)}
      <span style={{ position: 'absolute', inset: 0, overflow: 'hidden', width: `${pct}%` }}>{stars(V3.accent)}</span>
    </span>
  )
}

// Filtro por puntuación — misma interacción exacta que EditableRating en la
// ficha (mantener pulsado para desbloquear con zoom, arrastrar ajusta de
// 0.5 en 0.5, soltar confirma) en vez de estrellas sueltas clicables, para
// que se sienta el mismo control en los dos sitios. Un toque simple (sin
// llegar a mantener pulsado el tiempo suficiente) resetea el filtro — es el
// equivalente aquí a "quitar puntuación", ya que no hay ningún valor de
// arrastre posible por debajo de 0.5 que represente "cualquiera".
function RatingFilter({ value, onChange, size = 17 }) {
  const [editing, setEditing] = useState(false)
  const [preview, setPreview] = useState(null)
  const trackRef = useRef(null)
  const timerRef = useRef(null)
  const draggingRef = useRef(false)

  function valueFromX(clientX) {
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.max(0.5, Math.min(5, Math.round(ratio * 5 * 2) / 2))
  }
  function finish(commit) {
    const wasDragging = draggingRef.current
    clearTimeout(timerRef.current)
    if (wasDragging) {
      draggingRef.current = false
      setEditing(false)
      if (commit && preview != null) onChange(preview)
      setPreview(null)
    } else if (commit) {
      onChange('')
    }
  }
  function onPointerDown(ev) {
    timerRef.current = setTimeout(() => {
      draggingRef.current = true
      setEditing(true)
      setPreview(Number(value) || 0)
      try { ev.target.setPointerCapture(ev.pointerId) } catch {}
    }, RATING_HOLD_MS)
  }
  function onPointerMove(ev) {
    if (draggingRef.current) setPreview(valueFromX(ev.clientX))
  }

  const shown = editing ? preview : (Number(value) || 0)
  return (
    <motion.div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => finish(true)}
      onPointerCancel={() => finish(false)}
      onContextMenu={ev => editing && ev.preventDefault()}
      animate={{ scale: editing ? RATING_ZOOM_SCALE : 1 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      title="Mantén pulsado para elegir puntuación mínima · toca para quitar el filtro"
      style={{
        cursor: 'pointer', touchAction: 'none', userSelect: 'none', WebkitTouchCallout: 'none',
        // Anclado a la izquierda, no al centro — issue reportada: con zoom
        // centrado, crecía tanto a la izquierda como a la derecha y
        // terminaba invadiendo el desplegable de "Páginas máx." justo al
        // lado. Ancladas por la izquierda, las estrellas solo crecen hacia
        // la derecha (donde hay hueco libre), nunca hacia ese lado.
        transformOrigin: 'left center', display: 'inline-flex',
      }}
    >
      <StarRating rating={shown} size={size} />
    </motion.div>
  )
}

// Puntuación editable — reutiliza el mismo StarRating (el recorte por ancho
// ya funciona en pasos de medio en medio, da igual que sea de solo lectura o
// clicable) bajo una capa que traduce la posición del clic/hover a un valor
// de 0.5 en 0.5. "Quitar puntuación" solo aparece si ya hay una puesta.
// Puntuación editable por mantener pulsado — de primeras es solo lectura
// (nada que arrastrar sin querer al hacer scroll por la ficha); mantener
// pulsado ~⅓s sobre las estrellas la desbloquea con un pequeño zoom (deja
// claro que ahora sí responde) y a partir de ahí arrastrar el dedo/ratón
// ajusta el valor en pasos de 0.5, en vivo. Soltar confirma y vuelve a
// bloquearla sola. Un solo elemento fijo (nunca dos ramas distintas
// intercambiándose) para que no haya ni un milímetro de salto en el resto
// de la ficha al entrar o salir de edición — solo cambia una transform de
// escala, que no mueve nada a su alrededor.
const RATING_HOLD_MS   = 320
const RATING_ZOOM_SCALE = 1.6

function EditableRating({ rating, onChange, size = 19 }) {
  const [editing, setEditing] = useState(false)
  const [preview, setPreview] = useState(null)
  const trackRef = useRef(null)
  const timerRef = useRef(null)
  const draggingRef = useRef(false)

  function valueFromX(clientX) {
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.max(0.5, Math.min(5, Math.round(ratio * 5 * 2) / 2))
  }
  function finish(commit) {
    clearTimeout(timerRef.current)
    if (draggingRef.current) {
      draggingRef.current = false
      setEditing(false)
      if (commit && preview != null && preview !== rating) onChange(preview)
      setPreview(null)
    }
  }
  function onPointerDown(ev) {
    timerRef.current = setTimeout(() => {
      draggingRef.current = true
      setEditing(true)
      setPreview(rating || 0)
      try { ev.target.setPointerCapture(ev.pointerId) } catch {}
    }, RATING_HOLD_MS)
  }
  function onPointerMove(ev) {
    if (draggingRef.current) setPreview(valueFromX(ev.clientX))
  }

  const shown = editing ? preview : (rating || 0)
  return (
    <motion.div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => finish(true)}
      onPointerCancel={() => finish(false)}
      onContextMenu={ev => editing && ev.preventDefault()}
      animate={{ scale: editing ? RATING_ZOOM_SCALE : 1 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      title="Mantén pulsado para puntuar"
      style={{
        ...EDITABLE_BOX, cursor: 'pointer',
        // Fijo siempre, no solo mientras se edita — así el gesto de mantener
        // pulsado nunca compite con el scroll de la página empezando justo
        // encima de las estrellas (antes, si el scroll ganaba la carrera
        // antes de completarse la espera, se perdía el "foco" del gesto).
        touchAction: 'none', userSelect: 'none', WebkitTouchCallout: 'none',
        transformOrigin: 'center center',
      }}
    >
      <StarRating rating={shown} size={size} />
    </motion.div>
  )
}

// Progreso de lectura editable — mismo gesto que la puntuación (mantener
// pulsado, arrastrar, soltar confirma). El arrastre es sobre página real
// (0..total), no sobre el % directamente, para que el número de página que
// se ve mientras se arrastra sea siempre exacto — el % es solo derivado.
// Sin páginas conocidas del libro no hay "total" con el que mapear el
// arrastre a una página, así que en ese caso la barra se queda de solo
// lectura (se ve, no se puede tocar).
// Píxeles de arrastre por página — a diferencia de mapear la posición
// absoluta del dedo al ancho de la barra (lo que había antes: la precisión
// dependía de lo ancha que se pudiera hacer la barra en un móvil, con
// límite real), esto mide el DESPLAZAMIENTO desde donde se empezó a
// arrastrar. Se puede seguir afinando más allá de lo que mide la barra en
// pantalla — y si no basta un solo gesto, soltar y volver a mantener pulsado
// sigue ajustando desde la página actual, en vez de reiniciar.
const PROGRESS_PX_PER_PAGE = 3

function EditableProgress({ e, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [previewPage, setPreviewPage] = useState(null)
  const trackRef = useRef(null)
  const timerRef = useRef(null)
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const startPageRef = useRef(0)
  const total = e.custom_total_pages || e.book.num_pages
  // Un libro "Leído" no siempre tiene current_page a mano (pudo marcarse
  // leído por otra vía) — de cara a la barra, se asume el total.
  const baselinePage = e.current_page ?? (e.status === 'read' ? total : 0)

  function finish(commit) {
    clearTimeout(timerRef.current)
    if (draggingRef.current) {
      draggingRef.current = false
      setEditing(false)
      if (commit && previewPage != null && previewPage !== baselinePage) {
        if (previewPage >= total && e.status !== 'read') {
          // Llegar al 100% arrastrando pasa el libro a Leído directamente
          // (mismas reglas que cambiar el estado a mano: fecha de fin, suma
          // una lectura) — arrastrar hasta el final es, en la práctica,
          // decir "lo he terminado".
          onUpdate(statusPatch('read', e))
        } else if (previewPage < total && e.status === 'read') {
          // Y al revés: bajar del 100% en un libro ya "Leído" lo vuelve a
          // "Leyendo" — nunca "Releyendo" (eso es una decisión aparte, se
          // marca a mano desde el estado cuando de verdad se empieza una
          // relectura, no aquí).
          onUpdate({ ...statusPatch('reading', e), current_page: previewPage })
        } else {
          onUpdate({ current_page: previewPage })
        }
      }
      setPreviewPage(null)
    }
  }
  function onPointerDown(ev) {
    if (!total) return
    timerRef.current = setTimeout(() => {
      draggingRef.current = true
      setEditing(true)
      startXRef.current = ev.clientX
      startPageRef.current = baselinePage
      setPreviewPage(startPageRef.current)
      try { trackRef.current.setPointerCapture(ev.pointerId) } catch {}
    }, RATING_HOLD_MS)
  }
  function onPointerMove(ev) {
    if (!draggingRef.current) return
    const deltaPages = (ev.clientX - startXRef.current) / PROGRESS_PX_PER_PAGE
    setPreviewPage(Math.round(Math.max(0, Math.min(total, startPageRef.current + deltaPages))))
  }

  const currentPage = editing ? previewPage : baselinePage
  const pct = total ? Math.min(100, Math.round((currentPage / total) * 100)) : Math.round((e.progress || 0) * 100)

  return (
    <motion.div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => finish(true)}
      onPointerCancel={() => finish(false)}
      onContextMenu={ev => editing && ev.preventDefault()}
      // El ancho real durante el arrastre (para mapear pixel→página, ver
      // valueFromX) es el que devuelve getBoundingClientRect ya escalado —
      // por eso agrandarla tanto de base (300px) como al mantener pulsado
      // (1.3x) hace directamente más preciso el arrastre: más píxeles por
      // página sin cambiar el cálculo. No tan agresivo como el 1.6x de la
      // puntuación (esto ya empieza ancho — a 1.6x se saldría del móvil).
      animate={{ scale: editing ? 1.3 : 1 }}
      transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
      title={total ? 'Mantén pulsado para ajustar el progreso' : undefined}
      style={{
        ...EDITABLE_BOX,
        display: 'flex', flexDirection: 'column', alignItems: 'stretch', width: 300,
        cursor: total ? 'pointer' : 'default',
        touchAction: 'none', userSelect: 'none', WebkitTouchCallout: 'none',
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 5,
        color: editing ? V3.accent : V3.sub, fontWeight: editing ? 700 : 400,
      }}>
        <span>{total ? `Pág. ${currentPage} de ${total}` : 'Progreso'}</span>
        <span>{pct}%</span>
      </div>
      <Progress value={pct} className="h-[4px]" />
    </motion.div>
  )
}

function ListRow({ e, isMobile, onSelect }) {
  const status = e.status
  const pct = progressPct(e)
  const showProgress = status === 'reading' || status === 'rereading'
  return (
    <div onClick={() => onSelect(e)} style={{
      display: 'flex', alignItems: 'center', gap: isMobile ? 13 : 16,
      padding: isMobile ? '11px 4px' : '13px 10px', borderRadius: V3_RADIUS,
      borderBottom: `1px solid ${V3.border}`, cursor: 'pointer',
    }}>
      <div style={{ width: 44, height: 66, flexShrink: 0, boxShadow: '0 1px 3px rgba(60,40,20,0.15)', borderRadius: V3_RADIUS }}>
        <Cover url={e.book.cover_url} radius={V3_RADIUS} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: V3.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.book.title}</div>
        <div style={{ fontSize: 12, color: V3.sub, marginTop: 1 }}>{e.book.author}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusDotColor(status), flexShrink: 0 }} />
          <span style={{ fontSize: 10.5, color: V3.sub, display: 'flex', alignItems: 'center', gap: 5 }}>
            {STATUS_LABEL[status]}
            {showProgress && ` · ${pct}%`}
            {status === 'want_to_read' && (e.custom_total_pages || e.book.num_pages) && ` · ${e.custom_total_pages || e.book.num_pages} pág.`}
            {status === 'read' && e.rating > 0 && <>· <StarRating rating={e.rating} /></>}
          </span>
        </div>
        {showProgress && <Progress value={pct} className="mt-[5px] h-[3px]" />}
      </div>
    </div>
  )
}

// ─── Secciones ─────────────────────────────────────────────────────────────

// El degradado sutil vive solo en la propia cabecera (banda de ancho
// completo detrás del texto), no en todo el bloque de la sección — así
// separa visualmente "Leyendo"/"Leídos"/"Por leer"/"Dropeados" sin teñir
// las portadas de debajo.
function SectionLabel({ children, count, collapsible, collapsed, onToggle, tint, isMobile }) {
  const bandStyle = {
    background: `linear-gradient(to right, ${tint}, transparent 70%)`,
    // Más redondeo en las esquinas izquierdas (donde el degradado es
    // sólido) que en las derechas (donde ya se ha ido a transparente y no
    // se nota ningún borde) — da un aire de "pestaña" a la cabecera.
    borderTopLeftRadius: 10, borderBottomLeftRadius: 10,
    borderTopRightRadius: V3_RADIUS, borderBottomRightRadius: V3_RADIUS,
    padding: isMobile ? '9px 12px' : '10px 14px',
  }
  const content = (
    <>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: V3.text }}>{children}</span>
      <span style={{ fontSize: 12, color: V3.sub }}>{count}</span>
      {collapsible && <span style={{ marginLeft: 'auto' }}><IconChevron down={!collapsed} color={V3.sub} /></span>}
    </>
  )
  if (!collapsible) {
    return <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, ...bandStyle }}>{content}</div>
  }
  return (
    <Button variant="ghost" onClick={onToggle} style={bandStyle}
      className="mb-3.5 h-auto w-full justify-start gap-2 hover:bg-transparent">
      {content}
    </Button>
  )
}

// Número de columnas fijo (pasado desde ShelfTab, medido una vez con
// ResizeObserver) en vez de "auto-fill" — con auto-fill cada sección/año es
// su propia rejilla independiente, y basta una pequeña diferencia de ancho
// disponible entre una y otra para que el número de columnas calculado no
// coincida y las portadas salgan de tamaños distintos entre secciones (bug
// ya visto y resuelto así en LunitecaV2.jsx). Con un número fijo compartido,
// todas las rejillas de la estantería miden exactamente lo mismo.
function Grid({ entries, isMobile, columns, onSelect }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap: isMobile ? '10px 8px' : 14,
    }}>
      {entries.map(e => <GridCard key={e.id} e={e} isMobile={isMobile} onSelect={onSelect} />)}
    </div>
  )
}

function List({ entries, isMobile, onSelect }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxWidth: isMobile ? 'none' : 820 }}>
      {entries.map(e => <ListRow key={e.id} e={e} isMobile={isMobile} onSelect={onSelect} />)}
    </div>
  )
}

// Cabecera de año dentro de "Leídos" — más discreta que SectionLabel (es un
// subnivel), pero igualmente plegable.
function YearLabel({ year, collapsed, onToggle }) {
  return (
    <Button variant="ghost" onClick={onToggle}
      style={{
        background: `linear-gradient(to right, ${V3.surfaceHi}, transparent 70%)`,
        borderTopLeftRadius: 10, borderBottomLeftRadius: 10,
        borderTopRightRadius: V3_RADIUS, borderBottomRightRadius: V3_RADIUS,
        padding: '7px 10px',
      }}
      className="mb-3 h-auto w-full justify-start gap-2 hover:bg-transparent">
      <span style={{ fontSize: 12, fontWeight: 600, color: V3.sub }}>{year === 'sin-fecha' ? 'Sin fecha' : year}</span>
      <IconChevron size={10} down={!collapsed} color={V3.muted} />
    </Button>
  )
}

// Memoizada por el mismo motivo que CollapsibleSection (ver comentario
// justo debajo): "Leyendo" no pliega nunca, así que vivía como bloque
// inline dentro de ShelfTab en vez de como sección aparte — pero con 75
// libros "en curso" a la vez (nada raro si se usa para varios clubs/retos),
// ese carrusel de ReadingCard (cada uno con su propia barra de progreso
// arrastrable) pesaba tanto como Leídos/Por leer/Dropeados juntos a la hora
// de reconciliar. `reading` sale ya memoizado del useMemo de ShelfTab, así
// que basta con envolver esto igual.
const ReadingSection = memo(function ReadingSection({ reading, viewMode, isMobile, onSelect }) {
  if (reading.length === 0) return null
  return (
    <div style={{ marginBottom: isMobile ? 28 : 34 }}>
      <SectionLabel count={reading.length} tint={V3.accentBg} isMobile={isMobile}>Leyendo</SectionLabel>
      {viewMode === 'grid' ? (
        // Carrusel de tarjetas grandes con progreso — solo en vista grid
        // (mismo criterio que el resto de secciones, que también cambian de
        // forma con el toggle). Scroll horizontal propio y contenido, nunca
        // empuja el ancho del resto de la estantería.
        <div className="luni3-hscroll" style={{ display: 'flex', gap: isMobile ? 14 : 26, overflowX: 'auto' }}>
          {reading.map(e => <ReadingCard key={e.id} e={e} isMobile={isMobile} onSelect={onSelect} />)}
        </div>
      ) : (
        <List entries={reading} isMobile={isMobile} onSelect={onSelect} />
      )}
    </div>
  )
})

// `memo` de verdad (no solo cosmético): sin él, React reconcilia esta
// sección entera — cientos de `GridCard` en una estantería grande — cada
// vez que `ShelfTab` re-renderiza por CUALQUIER motivo, aunque no le toque
// nada a esta sección (p. ej. abrir/cerrar "Añadir libro"). Medido con
// Playwright + `PerformanceObserver('longtask')` bajo CPU 4x: 116-129ms de
// long task en ese único re-render, con el propio render de `ShelfTab`
// tardando <1ms — el coste real estaba aquí abajo, no arriba. Para que el
// memo sirva de algo, todas las props deben ser estables entre renders no
// relacionados: `entries`/`yearGroups` vienen de un `useMemo` en ShelfTab
// (mismo array si `shelf`/`filters`/`shelfQuery`/`sort` no cambiaron), y
// `onToggle`/`onToggleYear`/`onSelect` vienen de `useCallback` — si algún
// día se le pasa una función inline nueva en cada render, el memo deja de
// servir de nada sin ningún aviso visible.
const CollapsibleSection = memo(function CollapsibleSection({ label, entries, viewMode, isMobile, columns, collapsed, onToggle, yearGroups, collapsedYears, onToggleYear, onSelect }) {
  if (entries.length === 0) return null
  return (
    <div style={{ marginBottom: collapsed ? 4 : (isMobile ? 28 : 34) }}>
      <SectionLabel count={entries.length} collapsible collapsed={collapsed} onToggle={onToggle} tint={V3.accentBg} isMobile={isMobile}>{label}</SectionLabel>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {yearGroups ? yearGroups.map(({ year, items }) => {
              const yearCollapsed = collapsedYears.has(year)
              return (
                <div key={year} style={{ marginBottom: yearCollapsed ? 2 : 18 }}>
                  {yearGroups.length > 1 && <YearLabel year={year} collapsed={yearCollapsed} onToggle={() => onToggleYear(year)} />}
                  <AnimatePresence initial={false}>
                    {!yearCollapsed && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                        {viewMode === 'grid' ? <Grid entries={items} isMobile={isMobile} columns={columns} onSelect={onSelect} /> : <List entries={items} isMobile={isMobile} onSelect={onSelect} />}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            }) : (
              viewMode === 'grid' ? <Grid entries={entries} isMobile={isMobile} columns={columns} onSelect={onSelect} /> : <List entries={entries} isMobile={isMobile} onSelect={onSelect} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

// Portadas de 2/3 con un mínimo cómodo de ~130px — igual que en el mockup,
// pero el número de columnas se mide una vez con ResizeObserver (ver
// ShelfTab) y se comparte entre TODAS las rejillas de la estantería, en vez
// de dejar que cada una lo recalcule por su cuenta con CSS auto-fill.
const GRID_MIN_COVER = 70

// Duración/curva compartidas por TODA la coreografía lupa⇄buscador — los 3
// botones de la izquierda salen deslizándose, la lupa viaja a su sitio, y
// solo cuando ambas cosas han terminado (SLIDE_S completo) empieza a
// aparecer el input. Un único número en vez de repetirlo en cada
// transición, para que cambiarlo lo cambie todo a la vez de verdad.
const SLIDE_S = 0.26
const SLIDE_EASE = [0.4, 0, 0.2, 1]

// Etiqueta clicable — sustituye tanto a la lista de opciones de Ordenar como
// al desplegable de Género en Filtrar: se toca la opción directamente en
// vez de abrirla de una lista. Mismo radio que el resto de la app (nunca
// píldora — la píldora era la inconsistencia), y un recuadro en un tono
// claro del propio acento en vez de un gris neutro sin relación con la
// paleta, para que se note que "pertenecen" al mismo color que cuando se
// activan.
function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={cn(
      'inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
      active
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-primary/20 bg-primary/10 text-foreground hover:bg-primary/15'
    )}>
      {children}
    </button>
  )
}

// Contenido del panel de orden — vive plegado dentro de la propia página
// (ver openPanel en ShelfTab), no en un popover flotando encima.
function SortPanelContent({ sort, onChange }) {
  function pick(field) {
    onChange(s => s.field === field
      ? (s.dir === 'asc' ? { field, dir: 'desc' } : { field: '', dir: 'asc' })
      : { field, dir: 'asc' })
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 12, fontWeight: 700, color: V3.text }}>Ordenar por</span>
        {sort.field && (
          <button onClick={() => onChange({ field: '', dir: 'asc' })} style={{ fontSize: 11, color: V3.accent, background: 'none', border: 'none', cursor: 'pointer' }}>
            Quitar
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {SORT_FIELDS.map(({ field, label }) => {
          const isActive = sort.field === field
          return (
            <Chip key={field} active={isActive} onClick={() => pick(field)}>
              {label}
              {isActive && <span>{sort.dir === 'asc' ? '↑' : '↓'}</span>}
            </Chip>
          )
        })}
      </div>
    </div>
  )
}

function FilterField({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span style={{ fontSize: 10, fontWeight: 600, color: V3.sub, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      {children}
    </label>
  )
}

function FilterSelect({ value, onChange, placeholder, options, container, compact }) {
  return (
    <Select value={value || '__all'} onValueChange={v => onChange(v === '__all' ? '' : v)}>
      <SelectTrigger className={compact ? 'h-7 text-[11px] text-muted-foreground' : undefined}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent container={container?.current}>
        <SelectItem value="__all">{placeholder}</SelectItem>
        {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

// Contenido del panel de filtro — mismos 4 campos que ya ofrece la Luniteca
// actual (FilterModal en LunitecaV2.jsx): género/carpeta/autor con las
// opciones que YA existen en la estantería (no texto libre, para no acabar
// escribiendo un género que no coincide con ninguno tal cual), más páginas
// máximas como número. Vive plegado dentro de la propia página (ver
// openPanel en ShelfTab), no en un popover flotando encima.
function FilterPanelContent({ shelf, filters, onChange, active, container }) {
  const genres  = [...new Set(shelf.map(e => e.book.genre).filter(Boolean))].sort()
  const folders = [...new Set(shelf.map(e => e.folder).filter(Boolean))].sort()
  const authors = [...new Set(shelf.map(e => e.book.author).filter(Boolean))].sort()

  function set(key, value) { onChange(f => ({ ...f, [key]: value })) }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 12, fontWeight: 700, color: V3.text }}>Filtrar</span>
        {active && (
          <button onClick={() => onChange(EMPTY_FILTERS)} style={{ fontSize: 11, color: V3.accent, background: 'none', border: 'none', cursor: 'pointer' }}>
            Limpiar
          </button>
        )}
      </div>
      {genres.length > 0 && (
        <FilterField label="Género">
          <div className="flex flex-wrap gap-1.5">
            {genres.map(g => (
              <Chip key={g} active={filters.genre === g} onClick={() => set('genre', filters.genre === g ? '' : g)}>
                {g}
              </Chip>
            ))}
          </div>
        </FilterField>
      )}

      {/* Carpeta/Autor/Páginas — secundarios frente al género, con menos
          peso visual a propósito (sin mayúsculas ni negrita en la
          etiqueta, controles más bajos). */}
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1" style={{ minWidth: 130, flex: 1 }}>
          <span style={{ fontSize: 10.5, color: V3.muted }}>Carpeta</span>
          <FilterSelect value={filters.folder} onChange={v => set('folder', v)} placeholder="Todas" options={folders} container={container} compact />
        </label>
        <label className="flex flex-col gap-1" style={{ minWidth: 130, flex: 1 }}>
          <span style={{ fontSize: 10.5, color: V3.muted }}>Autor</span>
          <FilterSelect value={filters.author} onChange={v => set('author', v)} placeholder="Todos" options={authors} container={container} compact />
        </label>
        {/* Ancho fijo y pequeño a propósito, no flex:1 — issue reportada:
            al mantener pulsado el filtro de puntuación (que hace zoom, ver
            RATING_ZOOM_SCALE), se superponía con este desplegable si
            quedaba justo al lado ocupando todo el ancho sobrante. */}
        <label className="flex flex-col gap-1" style={{ width: 90, flexShrink: 0 }}>
          <span style={{ fontSize: 10.5, color: V3.muted }}>Páginas máx.</span>
          <FilterSelect value={filters.maxPages} onChange={v => set('maxPages', v)} placeholder="Sin límite" options={MAX_PAGES_FILTER_OPTIONS} container={container} compact />
        </label>
        <label className="flex flex-col gap-1" style={{ minWidth: 100 }}>
          <span style={{ fontSize: 10.5, color: V3.muted }}>Puntuación mín.</span>
          <div style={{ height: 28, display: 'flex', alignItems: 'center' }}>
            <RatingFilter value={filters.minRating} onChange={v => set('minRating', v)} />
          </div>
        </label>
      </div>
    </div>
  )
}

// ─── Ficha de un libro ─────────────────────────────────────────────────────
// Maqueta inicial (issue #8) — deliberadamente NO calcada de BookDetailFull
// en LunitecaV2.jsx (paneles utilitarios apilados): aquí es una página, no
// un panel de control — portada grande, tipografía como protagonista, mucho
// aire. Todavía sin editar nada (estado/progreso/notas/relacionados vendrán
// en próximas pasadas) — de momento solo lectura de lo que ya hay.
// Mismo umbral/gesto que la puntuación (EditableRating) — mantener pulsado
// revela las 5 opciones, arrastrar resalta la que está bajo el dedo, soltar
// la confirma. Nada de esto es "modo edición" del libro: son datos del
// jugador (issue #8 — separados a propósito de portada/título/autor/etc.,
// que son del libro y comparten el mismo Guardar/Cancelar de siempre).
// Mismo lenguaje visual que los chips de filtro (borde + esquinas
// redondeadas, ver Chip más arriba) para marcar de un vistazo qué se puede
// tocar o mantener pulsado en la ficha — estado, fechas, puntuación y notas.
// Radio propio, más redondeado que V3_RADIUS (4px, "radios mínimos" del
// resto de la app) — a propósito solo para estos recuadros interactivos y
// sus modales, no un cambio del radio global de Luniteca (nueva).
const BOX_RADIUS = 14

const EDITABLE_BOX = {
  border: `1px solid ${V3.border}`, borderRadius: BOX_RADIUS,
  padding: '5px 11px', display: 'inline-flex', alignItems: 'center',
}

// Modal centrado en la pantalla (a diferencia del panel de filtros/orden de
// la barra, que flota anclado debajo del botón) — para estado y fechas, que
// el jugador prefiere tocar-y-elegir en vez de mantener pulsado/arrastrar
// (eso se queda solo para la puntuación). Portal a document.body: así
// escapa de cualquier overflow:hidden/transform de los contenedores de
// GatOS por encima (ventanas, pestañas móviles) sin tener que rastrearlos.
function CenteredModal({ onClose, width = 300, children }) {
  // Nada de portal a document.body: los tokens de color (--luni3-*) solo
  // existen dentro de .luniteca3-root (ver index.css) — fuera de ahí
  // V3.surfaceHi no resuelve a nada y el modal sale transparente.
  //
  // top:0 (NO var(--vvtop) — CenteredModal vive dentro de #root sin portal,
  // así que YA hereda el translateY(vv.offsetTop) que useLockViewportToKeyboard
  // (main.jsx) le aplica a #root; sumarle además top:var(--vvtop) aquí
  // compensaba el mismo desplazamiento DOS veces).
  //
  // height: var(--vvh) + var(--vvtop), NO solo var(--vvh) — issue reportada:
  // con solo --vvh se quedaba corto por abajo (un hueco sin oscurecer justo
  // encima del teclado). --vvh es el alto del visual viewport ya "paneado"
  // dentro de su propio marco de referencia, pero como el transform de
  // #root cancela ese paneo (trae el contenido de vuelta a coordenadas
  // físicas reales), el hueco visible real desde el TOP físico hasta el
  // teclado es --vvh MÁS lo que se paneó (--vvtop), no --vvh a secas.
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: 'calc(var(--vvh, 100vh) + var(--vvtop, 0px))', zIndex: 1000, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 24,
        background: 'rgba(36,31,26,0.4)',
        transition: 'height 0.25s cubic-bezier(0.17, 0.59, 0.4, 1)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 8 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        onClick={ev => ev.stopPropagation()}
        className="luni3-vscroll"
        style={{
          background: V3.surfaceHi, borderRadius: BOX_RADIUS, padding: '20px 20px 16px',
          width, maxWidth: '100%', boxShadow: '0 20px 50px rgba(20,14,8,0.35)',
          // Con un tope relativo al hueco visible real y scroll propio, el
          // contenido siempre queda entero y alcanzable por encima del
          // teclado, sin desbordarse. Mismo cálculo que el backdrop de
          // arriba (--vvh + --vvtop, no solo --vvh).
          maxHeight: 'calc(var(--vvh, 100vh) + var(--vvtop, 0px) - 48px)',
          // Mismo --vv-transition que el backdrop de arriba (main.jsx) —
          // este es en `style` (CSS puro), no en la prop `transition` de
          // Framer Motion de aquí abajo, que solo gobierna opacity/scale/y
          // del initial-animate-exit y no pisa esto.
          transition: 'max-height 0.25s cubic-bezier(0.17, 0.59, 0.4, 1)',
          overflowY: 'auto', overflowX: 'hidden',
          // Sin esto, al llegar al final/principio del scroll interno el
          // gesto se "encadenaba" al documento — issue reportada: hacer
          // scroll dentro del modal movía TODO el fondo (barra inferior
          // incluida).
          overscrollBehavior: 'contain',
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

function StatusPicker({ status, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} style={{
        ...EDITABLE_BOX,
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
        color: statusDotColor(status), borderColor: statusDotColor(status), cursor: 'pointer',
      }}>
        {STATUS_LABEL[status]}
      </button>
      <AnimatePresence>
        {open && (
          <CenteredModal onClose={() => setOpen(false)} width={260}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: V3.muted, margin: '0 0 14px' }}>
              Estado
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {STATUS_ORDER.map(id => {
                const active = status === id
                const color = statusDotColor(id)
                return (
                  <button key={id} onClick={() => { setOpen(false); if (id !== status) onChange(id) }} style={{
                    padding: '10px 14px', borderRadius: BOX_RADIUS, fontSize: 13, fontWeight: 600, textAlign: 'left',
                    border: `1px solid ${color}`, background: active ? color : 'transparent',
                    color: active ? 'white' : V3.text, cursor: 'pointer',
                  }}>
                    {STATUS_LABEL[id]}
                  </button>
                )
              })}
            </div>
          </CenteredModal>
        )}
      </AnimatePresence>
    </>
  )
}

// Fechas: tocar abre un modal flotante con los selectores de día/mes/año —
// mismo mecanismo que el panel de filtros/orden de la barra de herramientas
// (position:absolute sobre el resto, nunca empuja la ficha hacia abajo).
// Nunca `<input type="date">` (ver DateFields) — "pinchar y elegir", sin
// arrastrar nada.
function DatesEditor({ e, onUpdate }) {
  const [open, setOpen] = useState(false)
  const showStarted  = ['reading', 'rereading', 'read', 'dropped'].includes(e.status)
  const showFinished = ['read', 'dropped'].includes(e.status)
  if (!showStarted) return null
  const label = readingDatesLabel(e)

  return (
    <>
      <button onClick={() => setOpen(true)} style={{ ...EDITABLE_BOX, background: 'none', fontSize: 12, color: V3.sub, cursor: 'pointer' }}>
        {label || 'Añadir fecha'}
      </button>
      <AnimatePresence>
        {open && (
          // Bastante más ancho que el primer intento (220px) — con 3
          // `<select>` por fecha a ese ancho las opciones largas (nombres de
          // mes) sobresalían del propio modal.
          <CenteredModal onClose={() => setOpen(false)} width={320}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: V3.muted, margin: '0 0 14px' }}>
              Fechas
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 600, color: V3.muted, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Empezado</label>
                <DateFields value={e.started_at ? e.started_at.slice(0, 10) : ''} onChange={v => onUpdate({ started_at: v })} />
              </div>
              {showFinished && (
                <div>
                  <label style={{ fontSize: 10.5, fontWeight: 600, color: V3.muted, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>Terminado</label>
                  <DateFields value={e.finished_at ? e.finished_at.slice(0, 10) : ''} onChange={v => onUpdate({ finished_at: v })} />
                </div>
              )}
            </div>
          </CenteredModal>
        )}
      </AnimatePresence>
    </>
  )
}

// Carpeta: propia de cada jugador (PersonalShelf.folder), nunca del libro
// compartido — texto libre en un modal centrado, igual que estado/fechas.
function FolderEditor({ folder, existingFolders, onUpdate }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(folder || '')

  // Elegir una carpeta ya existente aplica al momento y cierra, igual que el
  // estado. El texto libre no tiene un botón de guardar aparte — se guarda
  // solo al cerrar (tocar fuera), como el resto de estos modales.
  function pick(name) { onUpdate({ folder: name }); setOpen(false) }
  function closeAndSave() {
    if (draft.trim() !== (folder || '')) onUpdate({ folder: draft.trim() })
    setOpen(false)
  }

  return (
    <>
      <button onClick={() => { setDraft(folder || ''); setOpen(true) }} style={{ ...EDITABLE_BOX, background: 'none', fontSize: 12, color: V3.sub, cursor: 'pointer' }}>
        {folder || 'Añadir carpeta'}
      </button>
      <AnimatePresence>
        {open && (
          <CenteredModal onClose={closeAndSave} width={280}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: V3.muted, margin: '0 0 14px' }}>
              Carpeta
            </p>
            {existingFolders?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {folder && (
                  <button onClick={() => pick('')} style={{
                    padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${V3.border}`, background: 'none', color: V3.muted, cursor: 'pointer',
                  }}>
                    Sin carpeta
                  </button>
                )}
                {existingFolders.map(name => {
                  const active = name === folder
                  return (
                    <button key={name} onClick={() => pick(name)} style={{
                      padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${active ? V3.accent : V3.border}`,
                      background: active ? V3.accent : 'transparent',
                      color: active ? 'white' : V3.text, cursor: 'pointer',
                    }}>
                      {name}
                    </button>
                  )
                })}
              </div>
            )}
            <label style={{ fontSize: 10.5, fontWeight: 600, color: V3.muted, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>
              O escribe una nueva
            </label>
            <input value={draft} onChange={ev => setDraft(ev.target.value)} placeholder="Nombre de la carpeta"
              className="w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-1 focus:ring-ring" style={{ height: 38 }} />
          </CenteredModal>
        )}
      </AnimatePresence>
    </>
  )
}

// Veces leído: propio de cada jugador (PersonalShelf.times_read) — normalmente
// se incrementa solo al pasar a "Leído" (ver statusPatch), pero puede
// corregirse a mano si ese cambio de estado no debía contar como una
// lectura real, o si se leyó más veces de las registradas.
function TimesReadEditor({ timesRead, onUpdate }) {
  const [open, setOpen] = useState(false)
  const label = (timesRead || 1) === 1 ? '1 lectura' : `×${timesRead} lecturas`
  // +/- guardan al momento (como las fechas) — sin botón de guardar, cerrar
  // el modal (tocar fuera) solo lo cierra, el valor ya está guardado.
  function step(delta) { onUpdate({ times_read: Math.max(1, (timesRead || 1) + delta) }) }
  return (
    <>
      <button onClick={() => setOpen(true)} style={{ ...EDITABLE_BOX, background: 'none', fontSize: 12, color: V3.sub, cursor: 'pointer' }}>
        {label}
      </button>
      <AnimatePresence>
        {open && (
          <CenteredModal onClose={() => setOpen(false)} width={240}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: V3.muted, margin: '0 0 14px' }}>
              Veces leído
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
              <button onClick={() => step(-1)} style={{
                width: 36, height: 36, borderRadius: '50%', border: `1px solid ${V3.border}`,
                background: 'none', fontSize: 18, color: V3.text, cursor: 'pointer',
              }}>
                −
              </button>
              <span style={{ fontSize: 26, fontWeight: 700, color: V3.text, minWidth: 36, textAlign: 'center' }}>{timesRead || 1}</span>
              <button onClick={() => step(1)} style={{
                width: 36, height: 36, borderRadius: '50%', border: `1px solid ${V3.border}`,
                background: 'none', fontSize: 18, color: V3.text, cursor: 'pointer',
              }}>
                +
              </button>
            </div>
          </CenteredModal>
        )}
      </AnimatePresence>
    </>
  )
}

// Notas: tocar revela el textarea, "Guardar" lo cierra — dato del jugador,
// nunca dentro del formulario de datos del libro.
function NotesEditor({ notes, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(notes || '')
  if (!editing) {
    return (
      <button onClick={() => { setDraft(notes || ''); setEditing(true) }} style={{
        marginTop: 28, width: '100%', textAlign: 'left', background: V3.surfaceHi,
        border: `1px solid ${V3.border}`, borderRadius: BOX_RADIUS, padding: '14px 16px', cursor: 'pointer',
      }}>
        <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: V3.muted, margin: '0 0 6px' }}>Notas</p>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: notes ? V3.text : V3.muted, whiteSpace: 'pre-line', overflowWrap: 'anywhere', margin: 0 }}>
          {notes || 'Toca para añadir una nota…'}
        </p>
      </button>
    )
  }
  return (
    <div style={{ marginTop: 28 }}>
      <label style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: V3.muted, display: 'block', marginBottom: 6 }}>Notas</label>
      <textarea autoFocus value={draft} onChange={ev => setDraft(ev.target.value)} rows={4}
        placeholder="Notas privadas — solo las ves tú"
        className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
        style={{ lineHeight: 1.5, resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button onClick={() => { onUpdate({ notes: draft }); setEditing(false) }} style={{
          background: V3.accent, color: 'white', border: 'none', borderRadius: V3_RADIUS,
          padding: '6px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
        }}>
          Guardar
        </button>
        <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', color: V3.sub, fontSize: 12.5, cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

function BookDetailMeta({ e, isMobile, onUpdate, existingFolders }) {
  const b = e.book
  const showProgress = e.status === 'reading' || e.status === 'rereading' || e.status === 'read'
  const showRating = e.status === 'read'
  const showTimesRead = e.status === 'read' || e.status === 'rereading'
  const pages = e.custom_total_pages || b.num_pages
  const align = isMobile ? 'center' : 'flex-start'
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: align, width: '100%', maxWidth: 320 }}>
        {b.genre && <span style={{ fontSize: 12.5, color: V3.muted }}>{b.genre}</span>}
        {b.year && <span style={{ fontSize: 12.5, color: V3.muted }}>· {b.year}</span>}
        {pages && <span style={{ fontSize: 12.5, color: V3.muted }}>· {pages} pág.</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: align, marginTop: 10, width: '100%', maxWidth: 320 }}>
        <StatusPicker status={e.status} onChange={status => onUpdate(statusPatch(status, e))} />
        <DatesEditor e={e} onUpdate={onUpdate} />
        <FolderEditor folder={e.folder} existingFolders={existingFolders} onUpdate={onUpdate} />
        {showTimesRead && <TimesReadEditor timesRead={e.times_read} onUpdate={onUpdate} />}
      </div>

      {showRating && (
        <div style={{ marginTop: 14 }}>
          <EditableRating rating={e.rating} onChange={rating => onUpdate({ rating })} />
        </div>
      )}
      {showProgress && (
        <div style={{ marginTop: 16 }}>
          <EditableProgress e={e} onUpdate={onUpdate} />
        </div>
      )}
    </>
  )
}

// Colapsada por defecto (issue #8: entera de primeras ocupaba demasiado
// espacio) — se mide la altura real del texto completo una vez montado y se
// anima entre esa altura y unas pocas líneas, con un degradado hacia el
// fondo de la página en vez de un corte seco. Si el texto ya cabe en las
// líneas colapsadas, ni se muestra el degradado ni el botón de "Leer más".
const SYNOPSIS_FONT_SIZE   = 14.5
const SYNOPSIS_LINE_HEIGHT = 1.75
const SYNOPSIS_LINES       = 6

function Synopsis({ text }) {
  const [expanded, setExpanded] = useState(false)
  const [fullHeight, setFullHeight] = useState(null)
  const measureRef = useRef(null)
  const collapsedHeight = Math.round(SYNOPSIS_FONT_SIZE * SYNOPSIS_LINE_HEIGHT * SYNOPSIS_LINES)

  useLayoutEffect(() => {
    setExpanded(false)
    if (measureRef.current) setFullHeight(measureRef.current.scrollHeight)
  }, [text])

  if (!text) {
    return <p style={{ fontSize: SYNOPSIS_FONT_SIZE, color: V3.muted }}>Todavía no hay sinopsis para este libro.</p>
  }

  const overflowing = fullHeight != null && fullHeight > collapsedHeight + 4
  return (
    <div>
      <motion.div
        style={{ overflow: 'hidden', position: 'relative' }}
        initial={{ height: collapsedHeight }}
        animate={{ height: expanded ? (fullHeight ?? 'auto') : collapsedHeight }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <p ref={measureRef} style={{
          fontSize: SYNOPSIS_FONT_SIZE, lineHeight: SYNOPSIS_LINE_HEIGHT, color: V3.text,
          whiteSpace: 'pre-line', textAlign: 'justify', margin: 0,
        }}>
          {text}
        </p>
        {!expanded && overflowing && (
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: 36,
            background: `linear-gradient(to bottom, transparent, ${V3.bg})`, pointerEvents: 'none',
          }} />
        )}
      </motion.div>
      {overflowing && (
        <button onClick={() => setExpanded(v => !v)} style={{
          marginTop: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontSize: 12.5, fontWeight: 700, color: V3.accent,
        }}>
          {expanded ? 'Leer menos' : 'Leer más'}
        </button>
      )}
    </div>
  )
}

const FIELD_LABEL = { fontSize: 10.5, fontWeight: 600, color: V3.muted, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }
// Mismo lenguaje que EDITABLE_BOX (esquinas BOX_RADIUS, borde V3.border) en
// vez de los grises genéricos de shadcn — para que la vista de edición se
// sienta parte de la misma Luniteca, no un formulario aparte.
const FIELD_INPUT_STYLE = {
  width: '100%', boxSizing: 'border-box', border: `1px solid ${V3.border}`, borderRadius: BOX_RADIUS,
  background: V3.surface, color: V3.text, fontSize: 14, padding: '0 12px', outline: 'none',
}
// Un tinte por campo (no todos iguales) — ver petición de "recuadros... de
// diferente color". Sutil (10% del acento de cada campo sobre el fondo),
// nunca tan fuerte que dificulte leer el texto que se escribe encima.
const FIELD_TINTS = { title: V3.accent, author: '#8a6d4f', genre: V3.read, year: '#6b7fb5', pages: V3.dropped, synopsis: V3.want }
function tintedField(key) {
  return { ...FIELD_INPUT_STYLE, borderColor: FIELD_TINTS[key], background: `color-mix(in srgb, ${FIELD_TINTS[key]} 6%, ${V3.surface})` }
}

// Un <select> nativo (a diferencia del Select de shadcn/Radix que usa
// FilterSelect, que se dibuja entero a mano) es un control del propio
// sistema operativo — algunos navegadores no respetan del todo el
// border-radius de un select nativo salvo que se le quite primero su
// apariencia por defecto. Issue reportada: "los recuadros de género/año/
// páginas son cuadrados" a pesar de llevar el mismo borderRadius que el
// resto de campos. `appearance:none` lo arregla, pero también se lleva la
// flechita nativa por delante — hace falta devolvérsela a mano con un SVG
// de fondo, del mismo estilo de línea que el resto de iconos de la app.
const SELECT_CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23948a7c' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`
function tintedSelectField(key) {
  return {
    ...tintedField(key), height: 34, paddingRight: 30,
    appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
    backgroundImage: SELECT_CHEVRON, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: 12,
  }
}

function draftFromEntry(e) {
  const b = e.book
  return {
    title: b.title || '', author: b.author || '', genre: b.genre || '',
    year: b.year != null ? String(b.year) : '', num_pages: b.num_pages != null ? String(b.num_pages) : '',
    synopsis: b.synopsis || '',
    cover_url: b.cover_url || '',
  }
}

// Borrar la entrada es la única acción realmente destructiva de la ficha —
// useConfirmGuard (igual que en LunitecaV2.jsx) no exige mantener pulsado ni
// una segunda pantalla, solo mete una espera mínima de 500ms entre "Eliminar"
// y que el botón de confirmar responda, para que un doble toque por error no
// baste para borrar el libro.
function DeleteEntryButton({ onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const armed = useConfirmGuard(confirming)
  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} title="Eliminar de la estantería" style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
        cursor: 'pointer', color: V3.muted, fontSize: 12.5, padding: '8px 4px',
      }}>
        <IconTrash size={12} color={V3.muted} /> Eliminar de la estantería
      </button>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12.5, color: V3.sub }}>¿Seguro?</span>
      <button onClick={() => armed && onDelete()} disabled={!armed} style={{
        background: V3.dropped, color: 'white', border: 'none', borderRadius: BOX_RADIUS,
        padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: armed ? 'pointer' : 'default',
        opacity: armed ? 1 : 0.5,
      }}>
        Sí, eliminar
      </button>
      <button onClick={() => setConfirming(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: V3.muted, fontSize: 12.5 }}>
        Cancelar
      </button>
    </div>
  )
}

// Datos del LIBRO (compartidos con todo el club, ver PATCH /books/{id}) —
// separados a propósito de los datos del jugador (estado/fechas/notas/
// puntuación, ver StatusPicker/DatesEditor/NotesEditor/EditableRating más
// arriba), que se editan directamente sobre la ficha sin pasar por aquí.
// La portada casi nunca va a ser una URL pegada a mano — lo normal es subir
// una foto propia (issue #8; elegir una de la búsqueda de portadas vendrá
// cuando exista el buscador de "Añadir libro").
// Lista fija, no "años ya usados en la estantería" (a diferencia del género
// o la carpeta) — un año de publicación puede ser cualquiera, no solo los
// que ya tienen otros libros. +1 para dar cabida a próximos lanzamientos.
const YEAR_OPTIONS = (() => {
  const years = []
  for (let y = new Date().getFullYear() + 1; y >= 1000; y--) years.push(y)
  return years
})()

// Igual que los años: lista fija, no derivada de la estantería (el número
// de páginas de un libro nuevo no tiene por qué coincidir con ninguno ya
// visto). 2000 páginas cubre de sobra el caso normal.
const PAGE_OPTIONS = Array.from({ length: 2000 }, (_, i) => i + 1)

// Buscar portada — misma lógica (no estética) que SearchOverlay en
// LunitecaV2.jsx: GET /books/search?q= (busca en la BD local y en Open
// Library, devuelve varios candidatos, cada uno con su propia cover_url).
// Aquí solo interesan resultados CON portada — se filtran los que no la
// tienen, es la única diferencia con la búsqueda de "Añadir libro".
// Elegir portada — misma lógica que CoverPicker en LunitecaV2.jsx: GET
// /books/{id}/covers devuelve ya separado lo automático (ediciones de Open
// Library del propio libro, por su open_lib_key/isbn) de lo subido a mano
// por cualquier jugador (con atribución) — de ahí las dos secciones. La
// tercera vía, subir desde la propia biblioteca del dispositivo, es el
// mismo input de archivo que ya existía, ahora dentro de este mismo modal
// en vez de un icono aparte sobre la portada.
function CoverPickerModal({ bookId, currentUrl, myPlayerId, onPick, onUploadFile, onClose }) {
  const [covers, setCovers] = useState([])
  const [userUploads, setUserUploads] = useState([])
  const [coverCacheMap, setCoverCacheMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/books/${bookId}/covers`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { covers: [], user_uploads: [], cover_cache_map: {} })
      .then(data => {
        if (cancelled) return
        setCovers(data.covers || [])
        setUserUploads(data.user_uploads || [])
        // Ninguna de "De la API" coincide nunca con currentUrl tal cual si
        // ya está elegida: se sirve cacheada bajo otra ruta local (hash de
        // la URL externa, ver backend) — este mapa trae, por cada URL
        // externa, cuál sería su ruta cacheada, para poder comparar.
        setCoverCacheMap(data.cover_cache_map || {})
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [bookId])

  async function handleFile(file) {
    if (!file) return
    setUploading(true)
    try {
      const url = await onUploadFile(file)
      onPick(url)
    } finally {
      setUploading(false)
    }
  }

  // La portada activa se marca (borde de acento) en cualquier sección en la
  // que aparezca — antes no había forma de saber, entre 17 miniaturas
  // parecidas, cuál era la que ya tenías puesta. Se compara siempre contra
  // currentUrl (la elección real ahora mismo, viva durante toda la sesión
  // del modal): una de "De la API" se da por activa también si su versión
  // cacheada es currentUrl — si no, al elegir una portada distinta se
  // quedaba però resaltada la anterior para siempre (currentApiCover se
  // calculaba una sola vez contra la portada del libro, no contra la
  // elección actual).
  function CoverGrid({ items, renderCaption }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {items.map((item, i) => {
          const url = typeof item === 'string' ? item : item.url
          const active = url === currentUrl || coverCacheMap[url] === currentUrl
          return (
            <button key={i} onClick={() => onPick(url)} style={{
              padding: 0, border: 'none', background: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{
                position: 'relative', aspectRatio: '2/3', borderRadius: V3_RADIUS, overflow: 'hidden',
                boxShadow: '0 2px 6px rgba(60,40,20,0.25)',
                outline: active ? `2px solid ${V3.accent}` : 'none', outlineOffset: 2,
              }}>
                <Cover url={url} />
              </div>
              {renderCaption && <span style={{ fontSize: 9.5, color: V3.muted, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{renderCaption(item)}</span>}
            </button>
          )
        })}
      </div>
    )
  }

  const myUploads    = userUploads.filter(u => u.uploaded_by_id === myPlayerId)
  const otherUploads = userUploads.filter(u => u.uploaded_by_id !== myPlayerId)
  const empty = !loading && covers.length === 0 && userUploads.length === 0

  return (
    <CenteredModal onClose={onClose} width={340}>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: V3.muted, margin: '0 0 14px' }}>
        Elegir portada
      </p>
      <div className="luni3-vscroll" style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, padding: 4, margin: -4 }}>
        {loading && <p style={{ fontSize: 12, color: V3.sub, textAlign: 'center', margin: '20px 0' }}>Buscando portadas…</p>}

        {!loading && myUploads.length > 0 && (
          <div>
            <p style={{ fontSize: 10.5, fontWeight: 600, color: V3.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Tus portadas ({myUploads.length})
            </p>
            <CoverGrid items={myUploads} />
          </div>
        )}

        {!loading && otherUploads.length > 0 && (
          <div>
            <p style={{ fontSize: 10.5, fontWeight: 600, color: V3.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Subidas por otros ({otherUploads.length})
            </p>
            <CoverGrid items={otherUploads} renderCaption={u => u.uploaded_by ? `de ${u.uploaded_by}` : null} />
          </div>
        )}

        {!loading && covers.length > 0 && (
          <div>
            <p style={{ fontSize: 10.5, fontWeight: 600, color: V3.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              De la API ({covers.length})
            </p>
            <CoverGrid items={covers} />
          </div>
        )}

        {empty && (
          <p style={{ fontSize: 12, color: V3.sub, textAlign: 'center', margin: '8px 0' }}>
            No hay portadas conocidas para este libro todavía.
          </p>
        )}
      </div>

      <label style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16,
        border: `1px solid ${V3.border}`, borderRadius: BOX_RADIUS, padding: '10px 14px',
        cursor: uploading ? 'default' : 'pointer', fontSize: 12.5, color: V3.sub, opacity: uploading ? 0.6 : 1,
      }}>
        <input type="file" accept="image/*" disabled={uploading} onChange={ev => handleFile(ev.target.files[0])} style={{ display: 'none' }} />
        <IconCamera size={13} color={V3.sub} />
        {uploading ? 'Subiendo…' : 'Subir desde mi biblioteca'}
      </label>
    </CenteredModal>
  )
}

function BookEditForm({ entry, draft, setDraft, isMobile, onSave, onCancel, onDelete, onCoverFile, existingGenres, myPlayerId }) {
  const [showCoverPicker, setShowCoverPicker] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState(null) // null | 'ok' | 'nomatch'
  function set(key) { return ev => setDraft(d => ({ ...d, [key]: ev.target.value })) }
  const genreOptions = [...new Set([...(existingGenres || []), draft.genre].filter(Boolean))].sort()

  // Misma lógica que refreshBookData en LunitecaV2.jsx (GET /books/enrich,
  // combina Google Books + Open Library) — la diferencia es que aquí, al
  // estar ya dentro de un borrador de edición, rellena el propio draft en
  // vez de guardar directo, así se revisa antes de pulsar Guardar en vez de
  // sobrescribir el libro al momento. Nunca toca el título.
  async function handleRefreshData() {
    setRefreshing(true); setRefreshResult(null)
    try {
      const params = new URLSearchParams({ title: draft.title })
      if (draft.author) params.set('author', draft.author)
      const r = await fetch(`/api/books/enrich?${params}`, { credentials: 'include' })
      const updates = {}
      if (r.ok) {
        const fresh = await r.json()
        if (fresh.author && !draft.author)     updates.author = fresh.author
        if (fresh.genre)                       updates.genre = fresh.genre
        if (fresh.synopsis)                    updates.synopsis = fresh.synopsis
        if (fresh.year)                        updates.year = String(fresh.year)
        if (fresh.num_pages)                   updates.num_pages = String(fresh.num_pages)
      }
      if (Object.keys(updates).length > 0) setDraft(d => ({ ...d, ...updates }))
      setRefreshResult(Object.keys(updates).length > 0 ? 'ok' : 'nomatch')
    } catch {
      setRefreshResult('nomatch')
    } finally {
      setRefreshing(false)
      setTimeout(() => setRefreshResult(null), 2500)
    }
  }

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', padding: isMobile ? '52px 24px 48px' : '24px 40px 60px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <button onClick={() => setShowCoverPicker(true)} style={{
          position: 'relative', width: 90, flexShrink: 0, aspectRatio: '2/3', borderRadius: V3_RADIUS,
          boxShadow: '0 4px 10px rgba(60,40,20,0.2)', cursor: 'pointer', overflow: 'hidden', padding: 0, border: 'none', display: 'block',
        }}>
          <Cover url={draft.cover_url} />
          <span style={{
            position: 'absolute', bottom: 6, right: 6, width: 26, height: 26, borderRadius: '50%',
            background: 'rgba(20,14,8,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IconCamera size={13} color="white" />
          </span>
        </button>
        <div style={{ flex: 1, minWidth: 0, alignSelf: 'center' }}>
          <p style={{ fontSize: 12, color: V3.sub, margin: 0 }}>
            Toca la portada para elegir una — de la API, subida por otros, o desde tu biblioteca.
          </p>
        </div>
      </div>

      {/* Al principio del todo y a lo ancho — no junto a un campo suelto
          (estaba junto a "Sinopsis" y parecía que solo tocaba eso): rellena
          autor, género, sinopsis, año y páginas de golpe, nunca el título. */}
      <motion.button layout onClick={handleRefreshData} disabled={refreshing} title="Actualizar datos del libro" style={{
        display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
        background: 'none', border: 'none', padding: 0,
        color: V3.accent, fontSize: 12.5, fontWeight: 700, cursor: refreshing ? 'default' : 'pointer',
        opacity: refreshing ? 0.6 : 1,
      }}>
        <motion.span layout="position" animate={{ rotate: refreshing ? 360 : 0 }} transition={refreshing ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : { duration: 0 }} style={{ display: 'flex' }}>
          <IconRefresh size={13} color={V3.accent} />
        </motion.span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={refreshResult || 'idle'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {refreshResult === 'ok' ? 'Datos actualizados' : refreshResult === 'nomatch' ? 'Sin novedades' : 'Actualizar autor, género, sinopsis, año y páginas'}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      <div>
        <label style={FIELD_LABEL}>Título</label>
        <input value={draft.title} onChange={set('title')} style={{ ...tintedField('title'), height: 38, fontWeight: 600 }} />
      </div>
      <div>
        <label style={FIELD_LABEL}>Autor</label>
        <input value={draft.author} onChange={set('author')} style={{ ...tintedField('author'), height: 34 }} />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1.4 }}>
          <label style={FIELD_LABEL}>Género</label>
          <select value={draft.genre} onChange={set('genre')} style={tintedSelectField('genre')}>
            <option value="">Sin género</option>
            {genreOptions.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL}>Año</label>
          <select value={draft.year} onChange={set('year')} style={tintedSelectField('year')}>
            <option value="">–</option>
            {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL}>Páginas</label>
          <select value={draft.num_pages} onChange={set('num_pages')} style={tintedSelectField('pages')}>
            <option value="">–</option>
            {PAGE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label style={FIELD_LABEL}>Sinopsis</label>
        <textarea value={draft.synopsis} onChange={set('synopsis')} rows={6}
          style={{ ...tintedField('synopsis'), padding: '10px 12px', lineHeight: 1.5, resize: 'vertical' }} />
      </div>

      <AnimatePresence>
        {showCoverPicker && (
          <CoverPickerModal
            bookId={entry.book.id}
            currentUrl={draft.cover_url}
            myPlayerId={myPlayerId}
            onUploadFile={onCoverFile}
            onPick={url => { setDraft(d => ({ ...d, cover_url: url })); setShowCoverPicker(false) }}
            onClose={() => setShowCoverPicker(false)}
          />
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <button onClick={onSave} style={{
          background: V3.accent, color: 'white', border: 'none', borderRadius: BOX_RADIUS,
          padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>
          Guardar
        </button>
        <button onClick={onCancel} style={{
          background: 'none', border: 'none', color: V3.sub, fontSize: 13, cursor: 'pointer', padding: '9px 6px',
        }}>
          Cancelar
        </button>
        <div style={{ flex: 1 }} />
        <DeleteEntryButton onDelete={onDelete} />
      </div>
    </div>
  )
}

// Una fila de "Más de este autor" — misma lógica de añadido rápido que
// RelatedBookCard en LunitecaV2.jsx (issue #7: POST /shelf/personal directo
// como "Por leer", con estado propio de idle/adding/done/error para no
// esperar a la recarga de la estantería), pero sin el gesto de mantener
// pulsado: aquí no hay una fila con scroll horizontal táctil con la que
// pueda confundirse (es una lista vertical dentro de un modal), así que un
// botón "+" normal ya es inequívoco.
function AuthorBookRow({ b, onQuickAdd }) {
  const [phase, setPhase] = useState('idle') // idle | adding | done | error
  const inShelf = b.in_shelf || phase === 'done'

  async function add() {
    setPhase('adding')
    const ok = await onQuickAdd({ ...b, status: 'want_to_read' })
    if (ok) setPhase('done')
    else { setPhase('error'); setTimeout(() => setPhase('idle'), 2000) }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
      <div style={{ width: 40, flexShrink: 0, aspectRatio: '2/3', borderRadius: V3_RADIUS, overflow: 'hidden', boxShadow: '0 2px 6px rgba(60,40,20,0.2)' }}>
        <Cover url={b.cover_url} />
      </div>
      {/* textAlign: left explícito, no implícito — este modal no usa portal
          (ver CenteredModal), así que cuelga dentro del contenedor de la
          cabecera de la ficha, que en móvil centra su texto; sin fijarlo
          aquí, esta columna heredaba ese centrado en vez de quedar a la
          izquierda junto a la portada. */}
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <p style={{
          fontSize: 13, fontWeight: b.is_current ? 700 : 500, color: V3.text, margin: 0, lineHeight: 1.3,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {b.title}
        </p>
        {(b.year || b.num_pages) && (
          <p style={{ fontSize: 11, color: V3.muted, margin: '2px 0 0' }}>
            {[b.year, b.num_pages ? `${b.num_pages} pág.` : null].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
      {/* Ancho fijo siempre, sea cual sea el contenido (botón, etiqueta de
          estado, "Estás aquí"...) — antes cada uno ocupaba lo que su propio
          contenido pedía, así que el título de al lado (flex:1) se
          desplazaba tanto entre filas distintas como, más llamativo aún, en
          la MISMA fila al pasar de "+" a la etiqueta de estado justo
          después de añadir. */}
      <div style={{ width: 72, flexShrink: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        {b.is_current ? (
          <span style={{ fontSize: 10.5, fontWeight: 700, color: V3.accent, textAlign: 'right' }}>Estás aquí</span>
        ) : phase === 'error' ? (
          <span style={{ fontSize: 10.5, color: '#c0392b', textAlign: 'right' }}>Error</span>
        ) : inShelf ? (
          <span style={{
            fontSize: 10, fontWeight: 700, textAlign: 'right',
            color: statusDotColor(phase === 'done' ? 'want_to_read' : (b.shelf_status || 'want_to_read')),
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {phase === 'done' ? STATUS_LABEL.want_to_read : STATUS_LABEL[b.shelf_status] || 'Añadido'}
          </span>
        ) : (
          <button onClick={add} disabled={phase === 'adding'} title='Añadir a "Por leer"' style={{
            width: 26, height: 26, borderRadius: '50%', flexShrink: 0, border: `1px solid ${V3.border}`,
            background: 'none', color: V3.accent, fontSize: 16, lineHeight: 1, cursor: phase === 'adding' ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: phase === 'adding' ? 0.5 : 1,
          }}>
            +
          </button>
        )}
      </div>
    </div>
  )
}

// Modal con una lista de libros relacionados — issue #7/#8, misma fuente
// para las dos cosas que puede mostrar (GET /books/{id}/related, ver
// BookDetail): la bibliografía del resto del autor (`same_author`) al tocar
// su nombre, o la saga a la que pertenece el libro actual (`series`) al
// tocar la insignia de la portada. `books` ya viene resuelto por quien
// llama (BookDetail hace un único fetch para ambas cosas) — este componente
// es solo presentación, `null` mientras carga.
function BookListModal({ title, books, emptyText, onQuickAdd, onClose }) {
  return (
    <CenteredModal onClose={onClose} width={340}>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: V3.muted, margin: '0 0 14px' }}>
        {title}
      </p>
      <div className="luni3-vscroll" style={{ maxHeight: 420, overflowY: 'auto', padding: 4, margin: -4 }}>
        {books === null && (
          <p style={{ fontSize: 12, color: V3.sub, textAlign: 'center', margin: '20px 0' }}>Buscando…</p>
        )}
        {books?.length === 0 && (
          <p style={{ fontSize: 12, color: V3.sub, textAlign: 'center', margin: '20px 0' }}>{emptyText}</p>
        )}
        {books?.map((b, i) => (
          <div key={b.open_lib_key || b.book_id || `${b.title}-${i}`} style={{ borderTop: i > 0 ? `1px solid ${V3.border}` : 'none' }}>
            <AuthorBookRow b={b} onQuickAdd={onQuickAdd} />
          </div>
        ))}
      </div>
    </CenteredModal>
  )
}

function BookDetail({ entry, isMobile, onBack, onUpdate, onUpdateBook, onUploadCover, onDelete, existingFolders, existingGenres, myPlayerId, onQuickAdd }) {
  const e = entry
  const b = e.book
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [showAuthorModal, setShowAuthorModal] = useState(false)
  const [showSagaModal, setShowSagaModal] = useState(false)

  // Un único fetch para autor y saga (issue #7/#8) — antes el modal de autor
  // pedía esto por su cuenta solo al abrirse; la insignia de saga necesita
  // saberlo ya al entrar en la ficha (para pintar "2/3" sin esperar a que el
  // jugador toque nada), así que se adelanta aquí y se comparte con el modal.
  const [related, setRelated] = useState(null) // null = cargando
  useEffect(() => {
    let cancelled = false
    setRelated(null)
    fetch(`/api/books/${b.id}/related`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { same_author: [], series: [] })
      .then(data => { if (!cancelled) setRelated(data) })
      .catch(() => { if (!cancelled) setRelated({ same_author: [], series: [] }) })
    return () => { cancelled = true }
  }, [b.id])

  // La saga a la que pertenece ESTE libro: el primer grupo (de haber varios
  // — un libro con varias etiquetas de saga es raro pero posible, ver
  // backend) que incluya al propio libro actual. Sin grupo -> sin insignia,
  // en silencio, igual que "Sigue con..." en LunitecaV2.jsx cuando no hay
  // saga que mostrar.
  const rawSagaGroup = related?.series.find(g => g.books.some(gb => gb.is_current)) || null
  // La etiqueta la trae Open Library con el "slug" tal cual ("Harry_Potter",
  // "the_mistborn_saga") en vez de un nombre para enseñar — se arregla solo
  // aquí en pantalla, sin tocar la etiqueta real que usa el backend para
  // agrupar/excluir de "Más de este autor".
  const sagaGroup = rawSagaGroup && { ...rawSagaGroup, label: rawSagaGroup.label.replace(/_/g, ' ') }
  const sagaIndex = sagaGroup ? sagaGroup.books.findIndex(gb => gb.is_current) : -1

  function startEditing() { setDraft(draftFromEntry(e)); setEditing(true) }
  function cancelEditing() { setEditing(false); setDraft(null) }

  async function saveEdits() {
    const bookPatch = {}
    if (draft.title !== (b.title || ''))   bookPatch.title = draft.title
    if (draft.author !== (b.author || '')) bookPatch.author = draft.author
    if (draft.genre !== (b.genre || ''))   bookPatch.genre = draft.genre
    const draftYear  = draft.year === ''      ? null : parseInt(draft.year, 10)
    const draftPages = draft.num_pages === '' ? null : parseInt(draft.num_pages, 10)
    if (draftYear !== (b.year ?? null))         bookPatch.year = draftYear
    if (draftPages !== (b.num_pages ?? null))   bookPatch.num_pages = draftPages
    if (draft.synopsis !== (b.synopsis || ''))  bookPatch.synopsis = draft.synopsis
    if (Object.keys(bookPatch).length) await onUpdateBook(bookPatch)

    // La portada es la excepción: cada jugador puede tener su propia
    // elección para su copia (PersonalShelf.cover_url — ver docstring del
    // backend), que pisa la del libro compartido solo para él. Va por
    // PATCH /shelf/personal, igual que en LunitecaV2.jsx (onUpdateEntry),
    // nunca por PATCH /books/{id} — si no, elegir portada no hacía nada
    // visible para quien ya tuviera una propia puesta.
    if (draft.cover_url !== (entry.own_cover_url || '')) await onUpdate({ cover_url: draft.cover_url })

    setEditing(false)
    setDraft(null)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
      className="luni3-vscroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
      <div style={{
        position: isMobile ? 'absolute' : 'relative', top: isMobile ? 16 : 0, left: isMobile ? 16 : 0, right: isMobile ? 16 : 0,
        zIndex: 2, margin: isMobile ? 0 : '24px 40px 0', display: 'flex', justifyContent: 'space-between',
      }}>
        <button onClick={onBack} title="Volver" className="hover:bg-accent" style={{
          height: 36, width: 36, borderRadius: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isMobile ? V3.surface : 'transparent', border: 'none', cursor: 'pointer', padding: 0,
          boxShadow: isMobile ? '0 2px 8px rgba(60,40,20,0.18)' : 'none',
        }}>
          <IconArrowLeft color={V3.sub} />
        </button>
        {!editing && (
          <button onClick={startEditing} title="Editar" className="hover:bg-accent" style={{
            height: 36, width: 36, borderRadius: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isMobile ? V3.surface : 'transparent', border: 'none', cursor: 'pointer', padding: 0,
            boxShadow: isMobile ? '0 2px 8px rgba(60,40,20,0.18)' : 'none',
          }}>
            <IconPencil color={V3.sub} />
          </button>
        )}
      </div>

      {editing ? (
        <BookEditForm entry={e} draft={draft} setDraft={setDraft} isMobile={isMobile}
          onSave={saveEdits} onCancel={cancelEditing} onDelete={onDelete} onCoverFile={onUploadCover}
          existingGenres={existingGenres} myPlayerId={myPlayerId} />
      ) : (
        <>
          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'center' : 'flex-start', textAlign: isMobile ? 'center' : 'left',
            gap: isMobile ? 20 : 44,
            maxWidth: 900, margin: '0 auto', padding: isMobile ? '52px 24px 0' : '8px 40px 0',
          }}>
            <div style={{
              position: 'relative', width: isMobile ? 168 : 220, flexShrink: 0, aspectRatio: '2/3', borderRadius: V3_RADIUS,
              boxShadow: '0 6px 14px rgba(60,40,20,0.2), 0 18px 34px -16px rgba(60,40,20,0.4)',
            }}>
              <Cover url={b.cover_url} />
              {/* Mientras se resuelve la saga (autor y saga van en el mismo
                  fetch, puede tardar unos segundos — Wikidata+Google Books
                  encadenados) esta esquina se queda vacía sin avisar de que
                  algo está en camino; issue reportada. Un anillo girando en
                  el mismo sitio donde luego sale la insignia (o nada, si al
                  final no hay saga) dice "esto puede tardar" sin ocupar
                  hueco de más ni prometer una insignia que quizá no llegue.

                  El paso de uno a otro comparte layoutId ("saga-badge") —
                  issue reportada: antes eran dos elementos sueltos sin
                  relación entre sí, así que el círculo desaparecía de golpe
                  y la pastilla aparecía de golpe en su lugar. Con el mismo
                  layoutId, Framer Motion anima el propio círculo
                  transformándose en la pastilla (tamaño, forma y contenido a
                  la vez) en vez de un corte seco. */}
              <AnimatePresence>
                {related === null ? (
                  <motion.div
                    key="saga-loading" layoutId="saga-badge"
                    initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    style={{
                      position: 'absolute', right: -6, bottom: -6, width: 22, height: 22, borderRadius: '50%',
                      background: V3.surfaceHi, border: `1px solid ${V3.border}`, boxShadow: '0 2px 6px rgba(20,14,8,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <motion.span
                      animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
                      style={{ display: 'flex' }}
                    >
                      <IconRefresh size={11} color={V3.muted} />
                    </motion.span>
                  </motion.div>
                ) : sagaGroup && (
                  // Insignia de saga — issue #8, en silencio si el libro no
                  // pertenece a ninguna (sagaGroup null): posición dentro
                  // del grupo ya resuelto por el backend (orden de
                  // publicación), nunca inventado aquí.
                  <motion.button
                    key="saga-badge" layoutId="saga-badge"
                    onClick={() => setShowSagaModal(true)} title={sagaGroup.label}
                    initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    style={{
                      position: 'absolute', right: -6, bottom: -6, background: V3.accent, color: 'white',
                      fontSize: 12.5, fontWeight: 800, letterSpacing: '0.01em', border: 'none', borderRadius: 10,
                      padding: '4px 8px', cursor: 'pointer', boxShadow: '0 2px 6px rgba(20,14,8,0.35)',
                    }}
                  >
                    {sagaIndex + 1}/{sagaGroup.books.length}
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'center' : 'flex-start' }}>
              <h1 style={{
                fontFamily: V3_FONT, fontWeight: 700, letterSpacing: '-0.015em', color: V3.text,
                fontSize: isMobile ? 26 : 34, lineHeight: 1.15, margin: '2px 0 6px',
              }}>
                {b.title}
              </h1>
              {b.author && (
                <button onClick={() => setShowAuthorModal(true)} style={{
                  ...EDITABLE_BOX, fontSize: isMobile ? 14.5 : 16, color: V3.sub, margin: '0 0 16px', cursor: 'pointer',
                }}>
                  {b.author}
                </button>
              )}
              <AnimatePresence>
                {showAuthorModal && (
                  <BookListModal
                    title={`Más de ${b.author}`} books={related?.same_author ?? null}
                    emptyText="No se ha encontrado más bibliografía de este autor."
                    onQuickAdd={onQuickAdd} onClose={() => setShowAuthorModal(false)}
                  />
                )}
                {showSagaModal && sagaGroup && (
                  <BookListModal
                    title={sagaGroup.label} books={sagaGroup.books}
                    emptyText="No se ha encontrado la saga de este libro."
                    onQuickAdd={onQuickAdd} onClose={() => setShowSagaModal(false)}
                  />
                )}
              </AnimatePresence>
              <BookDetailMeta e={e} isMobile={isMobile} onUpdate={onUpdate} existingFolders={existingFolders} />
            </div>
          </div>

          <div style={{ maxWidth: 640, margin: isMobile ? '32px auto 0' : '48px auto 0', padding: isMobile ? '0 24px 48px' : '0 40px 60px' }}>
            <Synopsis text={b.synopsis} />
            <NotesEditor notes={e.notes} onUpdate={onUpdate} />
          </div>
        </>
      )}
    </motion.div>
  )
}

// Fila de un resultado del buscador — mismo lenguaje visual que
// AuthorBookRow (portada · texto a la izquierda · acción de ancho fijo a
// la derecha), pero con su propio significado: `already_added` es que ESE
// libro ya existe en el catálogo compartido (de cualquier jugador, no
// necesariamente tuyo — ver _accept_search_result en el backend), y
// `added_by_me`/`added_by` (nombres, no ids) vienen ya resueltos ahí. Igual
// que en LunitecaV2.jsx (addedByLabel): "ya lo tienes" si es tuyo, si no
// "añadido por X" / "añadido por X y N más" — pero SIEMPRE se puede añadir
// salvo que ya sea tuyo (que alguien más lo tenga no te lo impide).
function addedByLabel(book) {
  if (book.added_by_me) return 'ya lo tienes'
  const names = book.added_by || []
  if (names.length === 0) return null
  if (names.length === 1) return `añadido por ${names[0]}`
  if (names.length === 2) return `añadido por ${names[0]} y ${names[1]}`
  return `añadido por ${names[0]} y ${names.length - 1} más`
}

function SearchResultRow({ b, onPick }) {
  const [phase, setPhase] = useState('idle') // idle | adding | done | error
  const done = phase === 'done' || b.added_by_me

  async function add() {
    setPhase('adding')
    const ok = await onPick(b)
    if (ok) setPhase('done')
    else { setPhase('error'); setTimeout(() => setPhase('idle'), 2000) }
  }

  const caption = addedByLabel({ ...b, added_by_me: b.added_by_me && phase !== 'done' ? true : b.added_by_me })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
      <div style={{ width: 40, flexShrink: 0, aspectRatio: '2/3', borderRadius: V3_RADIUS, overflow: 'hidden', boxShadow: '0 2px 6px rgba(60,40,20,0.2)' }}>
        <Cover url={b.cover_url} />
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <p style={{
          fontSize: 13, fontWeight: 500, color: V3.text, margin: 0, lineHeight: 1.3,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {b.title}
        </p>
        <p style={{ fontSize: 11, color: V3.muted, margin: '2px 0 0' }}>
          {[b.author, b.year].filter(Boolean).join(' · ')}
        </p>
        {caption && <p style={{ fontSize: 10.5, color: V3.accent, margin: '2px 0 0' }}>{caption}</p>}
      </div>
      <div style={{ width: 60, flexShrink: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        {done ? (
          phase === 'done' ? (
            // Mismo círculo de 26px que el botón "+" de abajo (mismo sitio
            // exacto, ya que sustituye a ese botón nada más añadir) — antes
            // era un simple carácter "✓" suelto, sin círculo, y se notaba
            // "descolocado" al lado de los "+" con borde de las demás filas
            // (reportado por Wander con captura: "Esos Ojos", el libro que
            // acababa de añadir en esa sesión).
            <span style={{
              width: 26, height: 26, borderRadius: '50%', flexShrink: 0, border: `1px solid ${V3.read}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconCheck color={V3.read} />
            </span>
          ) : (
            <span style={{ fontSize: 10.5, fontWeight: 700, color: V3.read, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tuyo
            </span>
          )
        ) : phase === 'error' ? (
          <span style={{ fontSize: 10.5, color: '#c0392b' }}>Error</span>
        ) : (
          <button onClick={add} disabled={phase === 'adding'} title='Añadir a "Por leer"' style={{
            width: 26, height: 26, borderRadius: '50%', flexShrink: 0, border: `1px solid ${V3.border}`,
            background: 'none', color: V3.accent, fontSize: 16, lineHeight: 1, cursor: phase === 'adding' ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: phase === 'adding' ? 0.5 : 1,
          }}>
            +
          </button>
        )}
      </div>
    </div>
  )
}

// Formulario de alta manual — mismos campos y mismo lenguaje visual que la
// edición de un libro ya guardado (BookEditForm: recuadros con tinte por
// campo, año/páginas/género como <select>, nunca texto libre — ver
// FIELD_TINTS). Escapatoria para cuando el buscador no encuentra nada, como
// "manualMode" en LunitecaV2.jsx — aquí siempre visible como pestaña, no
// escondida detrás de un botón aparte.
function ManualAddForm({ existingGenres, onAdd, onUploadCover, onClose }) {
  const [draft, setDraft] = useState({ title: '', author: '', year: '', num_pages: '', genre: '', isbn: '', synopsis: '' })
  const [coverFile,    setCoverFile]    = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const genreOptions = [...new Set(existingGenres || [])].sort()
  function set(key) { return ev => setDraft(d => ({ ...d, [key]: ev.target.value })) }

  // Vista previa local (nunca se sube hasta que se confirme el alta entera)
  // — url de objeto liberada al elegir otra o al desmontar, para no dejar
  // memoria reservada de sobra.
  useEffect(() => () => { if (coverPreview) URL.revokeObjectURL(coverPreview) }, [coverPreview])
  function pickCoverFile(file) {
    if (!file) return
    setCoverFile(file)
    setCoverPreview(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file) })
  }

  async function submit() {
    if (!draft.title.trim() || saving) return
    setSaving(true)
    const entry = await onAdd({
      title: draft.title.trim(), author: draft.author.trim() || null,
      year: draft.year ? Number(draft.year) : null, num_pages: draft.num_pages ? Number(draft.num_pages) : null,
      genre: draft.genre || null, isbn: draft.isbn.trim() || null, synopsis: draft.synopsis.trim() || null,
      status: 'want_to_read',
    })
    // La portada se sube en un segundo paso, ya con el libro creado — no
    // hay ningún endpoint que acepte "sube esta imagen para un libro que
    // todavía no existe". Como es un libro recién creado sin ninguna
    // portada previa, el propio backend la deja puesta de forma automática
    // (ver POST /books/{id}/cover), sin que haga falta un tercer paso.
    if (entry && coverFile) {
      try { await onUploadCover(entry.book.id, coverFile) } catch {}
    }
    setSaving(false)
    if (entry) onClose()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <label style={{
          position: 'relative', width: 66, flexShrink: 0, aspectRatio: '2/3', borderRadius: V3_RADIUS,
          boxShadow: '0 4px 10px rgba(60,40,20,0.2)', cursor: 'pointer', overflow: 'hidden', display: 'block',
        }}>
          <input type="file" accept="image/*" onChange={ev => pickCoverFile(ev.target.files[0])} style={{ display: 'none' }} />
          <Cover url={coverPreview} />
          <span style={{
            position: 'absolute', bottom: 4, right: 4, width: 21, height: 21, borderRadius: '50%',
            background: 'rgba(20,14,8,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IconCamera size={10.5} color="white" />
          </span>
        </label>
        <p style={{ fontSize: 11.5, color: V3.sub, margin: 0, flex: 1, paddingTop: 4, lineHeight: 1.5 }}>
          Portada opcional — súbela tú si la tienes. Aquí no se busca en internet (para eso está "Buscar").
        </p>
      </div>
      <div>
        <label style={FIELD_LABEL}>Título</label>
        <input autoFocus value={draft.title} onChange={set('title')} style={{ ...tintedField('title'), height: 34 }} />
      </div>
      <div>
        <label style={FIELD_LABEL}>Autor</label>
        <input value={draft.author} onChange={set('author')} style={{ ...tintedField('author'), height: 34 }} />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL}>Género</label>
          <select value={draft.genre} onChange={set('genre')} style={tintedSelectField('genre')}>
            <option value="">–</option>
            {genreOptions.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL}>Año</label>
          <select value={draft.year} onChange={set('year')} style={tintedSelectField('year')}>
            <option value="">–</option>
            {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL}>Páginas</label>
          <select value={draft.num_pages} onChange={set('num_pages')} style={tintedSelectField('pages')}>
            <option value="">–</option>
            {PAGE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label style={FIELD_LABEL}>ISBN <span style={{ textTransform: 'none', fontWeight: 400 }}>(opcional)</span></label>
        <input value={draft.isbn} onChange={set('isbn')} style={{ ...tintedField('title'), height: 34 }} />
      </div>
      <div>
        <label style={FIELD_LABEL}>Sinopsis</label>
        <textarea value={draft.synopsis} onChange={set('synopsis')} rows={5}
          style={{ ...tintedField('synopsis'), padding: '10px 12px', lineHeight: 1.5, resize: 'vertical' }} />
      </div>
      <button onClick={submit} disabled={!draft.title.trim() || saving} style={{
        background: V3.accent, color: 'white', border: 'none', borderRadius: BOX_RADIUS,
        padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: (!draft.title.trim() || saving) ? 'default' : 'pointer',
        opacity: (!draft.title.trim() || saving) ? 0.6 : 1, marginTop: 4,
      }}>
        {saving ? 'Añadiendo…' : 'Añadir a la estantería'}
      </button>
    </div>
  )
}

// Vista de "Añadir libro" (AddBookView, más abajo) — issue #8, primera
// pieza de lo que en LunitecaV2.jsx son 5 entradas sueltas (lupa, cámara,
// alta manual, "añadir varios", Goodreads/Excel). Aquí, buscador y alta
// manual conviven en el mismo sitio (pestaña "A mano" siempre visible, no
// escondida) — el resto (importaciones) se aborda más adelante.
const SCAN_ELEMENT_ID = 'luni3-barcode-scanner'

// Hueco horizontal DENTRO de cada contenedor con scroll propio de "Añadir
// libro" (resultados de Buscar, Escanear, A mano) — tiene que ir en el
// elemento que de verdad tiene overflow-y:auto, no en un ancestro sin
// scroll: puesto en un ancestro, el padding solo aparta el CONTENIDO del
// borde del ancestro, pero la barra de scroll la pinta el propio elemento
// con overflow, comiéndose ese hueco igual — bug reportado dos veces por
// Wander (los "+" de los resultados quedaban debajo de la barra de scroll)
// porque la primera vez el padding se puso en el div de fuera.
const ADD_PANEL_HPAD = 14

// Escáner de código de barras (ISBN) con la cámara — misma lógica exacta
// que BarcodeScannerModal.jsx en LunitecaV2.jsx (misma librería, mismos
// formatos, mismo margen de 2.5s para no disparar el mismo código decenas
// de veces por segundo mientras la cámara sigue encuadrando el libro), solo
// que aquí vive integrado como una pestaña más de AddBookView en vez de un
// modal aparte, y con la estética de V3. `onDetect(isbn)` es quien decide
// qué hacer con el código leído (el lookup en sí vive en AddBookView, para
// poder enseñar el resultado en la misma lista que "Buscar").
function ScanTab({ onDetect }) {
  const [starting, setStarting] = useState(true)
  const [cameraError, setCameraError] = useState(null)
  const [manualIsbn, setManualIsbn] = useState('')
  const [manualFocused, setManualFocused] = useState(false)
  const [camHeight, setCamHeight] = useState(null)
  const camContentRef = useRef(null)
  const lastCodeRef = useRef({ code: null, at: 0 })
  const scannerRef = useRef(null)

  // Mide la altura real del bloque de cámara (vídeo + texto de ayuda) para
  // poder colapsarlo a 0 sin adivinar un número fijo — mismo patrón que
  // CenteredModal (getBoundingClientRect, no contentRect, para no perder el
  // padding/alto real).
  useLayoutEffect(() => {
    const el = camContentRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setCamHeight(entry.target.getBoundingClientRect().height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Mientras se escribe el ISBN a mano, se pausa el escaneo (para que no
  // detecte un código de fondo mientras el input está enfocado) y se
  // colapsa visualmente la cámara — si no, el teclado móvil empuja el
  // recuadro de vídeo y queda un desplazamiento raro (reportado por Wander).
  useEffect(() => {
    const scanner = scannerRef.current
    if (!scanner || starting || cameraError) return
    try {
      if (manualFocused) scanner.pause(true)
      else scanner.resume()
    } catch { /* si ya estaba parado/arrancando, ignorar */ }
  }, [manualFocused, starting, cameraError])

  useEffect(() => {
    let cancelled = false
    const scanner = new Html5Qrcode(SCAN_ELEMENT_ID, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
      ],
      verbose: false,
    })
    scannerRef.current = scanner

    // `Html5Qrcode.stop()` lanza una excepción SÍNCRONA (no una promesa
    // rechazada) si se llama antes de que la cámara termine de arrancar
    // (su estado interno no pasa a "scanning" hasta que resuelve el
    // render() de la cámara) — issue reportada por Wander: al cambiar de
    // Escanear a Buscar justo en ese margen, la excepción se escapaba sin
    // capturar desde el cleanup de este efecto, y sin ErrorBoundary de por
    // medio React tiraba toda la app, dejando ver el fondo azul marino de
    // <body> (index.css) por debajo. El try/catch absorbe ese caso; si
    // sigue arrancando, se para en cuanto el start() de abajo resuelva
    // (si no, la cámara se queda encendida en segundo plano para siempre).
    function stopAndClear() {
      try {
        scanner.stop().then(() => scanner.clear()).catch(() => {})
      } catch { /* todavía arrancando */ }
    }

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 260, height: 160 } },
      decodedText => {
        const now = Date.now()
        if (lastCodeRef.current.code === decodedText && now - lastCodeRef.current.at < 2500) return
        lastCodeRef.current = { code: decodedText, at: now }
        onDetect(decodedText.trim())
      },
      () => {} // "no se ve ningún código en este frame" — se dispara constantemente, se ignora
    )
      .then(() => {
        if (cancelled) { stopAndClear(); return }
        setStarting(false)
      })
      .catch(() => {
        if (!cancelled) {
          setCameraError('No se pudo acceder a la cámara. Compruébalo en los permisos del navegador, o escribe el ISBN a mano.')
          setStarting(false)
        }
      })

    return () => {
      cancelled = true
      stopAndClear()
    }
  }, [])

  function submitManual() {
    const isbn = manualIsbn.trim().replace(/[^0-9Xx]/g, '')
    if (isbn.length < 8) return
    onDetect(isbn)
    setManualIsbn('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <motion.div
        initial={false}
        animate={{ height: manualFocused ? 0 : (camHeight ?? 'auto') }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        style={{ overflow: 'hidden' }}
      >
        <div ref={camContentRef}>
          <div style={{ position: 'relative', borderRadius: V3_RADIUS, overflow: 'hidden', background: '#000', minHeight: 220 }}>
            <div id={SCAN_ELEMENT_ID} style={{ width: '100%' }} />
            {starting && !cameraError && (
              <p style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: 0 }}>
                Iniciando cámara…
              </p>
            )}
          </div>

          {cameraError
            ? <p style={{ fontSize: 11.5, color: '#c0392b', margin: '10px 0 0' }}>{cameraError}</p>
            : <p style={{ fontSize: 11, color: V3.muted, margin: '10px 0 0' }}>Apunta al código de barras de la contraportada (el de 13 dígitos).</p>}
        </div>
      </motion.div>

      <div style={{ display: 'flex', gap: 8, borderTop: `1px solid ${V3.border}`, paddingTop: 10 }}>
        <input
          value={manualIsbn} onChange={ev => setManualIsbn(ev.target.value)}
          onFocus={() => setManualFocused(true)}
          onBlur={() => setManualFocused(false)}
          onKeyDown={ev => ev.key === 'Enter' && submitManual()}
          placeholder="O escribe el ISBN a mano"
          style={{ ...FIELD_INPUT_STYLE, flex: 1, height: 34, borderColor: V3.border }}
        />
        <button onClick={submitManual} disabled={manualIsbn.trim().length < 8} style={{
          background: V3.accent, color: 'white', border: 'none', borderRadius: BOX_RADIUS,
          padding: '0 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          opacity: manualIsbn.trim().length < 8 ? 0.5 : 1,
        }}>
          Buscar
        </button>
      </div>
    </div>
  )
}

// Alto disponible desde el borde superior de `ref` hasta donde empieza a
// tapar el teclado — mismo cálculo que CenteredModal (más arriba,
// var(--vvh) + var(--vvtop)), pero localizado: CenteredModal es
// position:fixed con top:0, así que le basta esa suma directamente; este
// panel vive más abajo, dentro del layout normal de ShelfTab (no es un
// modal — ver comentario grande de "Añadir libro" aquí debajo, issue #12,
// sobre por qué no lo es), así que hace falta restar dónde empieza de
// verdad `ref` en pantalla. `getBoundingClientRect().top` ya devuelve la
// posición real (tras el translateY que useLockViewportToKeyboard, en
// main.jsx, le aplica a #root), así que no hace falta duplicar esa cuenta
// aquí — solo restarla del hueco visible total. Se recalcula en cada
// evento de visualViewport, igual que useLockViewportToKeyboard — issue
// #13: la estantería y "Añadir libro" tenían el hueco de scroll con altura
// fija ajena al teclado (`bottom:0` sin más), así que un campo como
// Sinopsis, más abajo del formulario, no tenía sitio de sobra para
// desplazarse por encima del teclado al enfocarlo.
function useAvailableHeight(ref, ready) {
  const [height, setHeight] = useState(null)
  // `ready` (no solo `ref`, que como tal nunca cambia de identidad y no
  // dispararía una nueva ejecución) — mismo motivo/patrón que el
  // ResizeObserver de scrollWidth más abajo en ShelfTab: mientras la
  // estantería está cargando, `ref.current` todavía es null (el nodo real
  // no existe hasta que se deja de mostrar "Cargando…"), así que hace
  // falta reintentar el efecto justo cuando esa transición ocurre.
  useEffect(() => {
    const vv = window.visualViewport
    const el = ref.current
    if (!vv || !el) return
    function update() {
      const top = el.getBoundingClientRect().top
      setHeight(Math.max(120, vv.height + vv.offsetTop - top))
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [ref, ready])
  return height
}

// "Añadir libro" — issue #12: vivía en un CenteredModal (position:fixed +
// backdrop) que competía con la gestión de viewport del teclado móvil
// (#root, --vvh, MobileBottomNav) y nunca quedó bien resuelto pese a varios
// intentos. Se descartó también una versión con vista propia a pantalla
// completa (con su propio "Volver" flotante, estilo BookDetail): Wander la
// vio como "otra pantalla" en vez de un modo de la propia estantería.
//
// Enfoque actual: el modo "añadir" vive dentro del propio ShelfTab (estado y
// handlers más abajo, `add*`) y sustituye en el sitio el título, la barra de
// herramientas y la lista de la estantería por las pestañas Buscar/Escanear/
// A mano y su contenido — misma cabecera, mismo layout, solo cambia qué hay
// dentro de cada hueco (igual que ya hace el buscador de la estantería, que
// transforma esta misma barra en vez de abrir algo aparte). Sigue sin haber
// ni position:fixed ni backdrop, así que el bug de la issue #12 no puede
// volver a darse aquí — pero además ya no hay una "pantalla nueva" que
// navegar, solo un modo distinto de la pantalla de siempre.
function ShelfTab({ player, isMobile, container }) {
  const [shelf, setShelf]       = useState(null) // null = cargando
  const [selected, setSelected] = useState(null) // entrada abierta en la ficha, o null = estantería
  const [viewMode, setViewMode] = useState(() => localStorage.getItem(`luni3_viewmode_${player.id}`) || 'grid')
  const [collapsedRead,    setCollapsedRead]    = useState(false)
  const [collapsedWant,    setCollapsedWant]    = useState(false)
  const [collapsedDropped, setCollapsedDropped] = useState(true)
  const [collapsedYears,   setCollapsedYears]   = useState(() => new Set())
  // useCallback — se pasan a CollapsibleSection (memoizado, ver su
  // definición): una función inline nueva en cada render invalidaría el
  // memo para esa sección en cada re-render de ShelfTab, sea cual sea el
  // motivo (incluido abrir/cerrar "Añadir libro", que no tiene nada que
  // ver con la estantería).
  const toggleCollapsedRead    = useCallback(() => setCollapsedRead(v => !v), [])
  const toggleCollapsedWant    = useCallback(() => setCollapsedWant(v => !v), [])
  const toggleCollapsedDropped = useCallback(() => setCollapsedDropped(v => !v), [])
  const [sort,    setSort]    = useState({ field: '', dir: 'asc' })
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [shelfQuery,      setShelfQuery]      = useState('')
  const [showShelfSearch, setShowShelfSearch] = useState(false)
  const [showAddModal,    setShowAddModal]    = useState(false)
  // Estado del propio modo "añadir" (ver comentario grande más arriba) —
  // vive aquí, no en un componente aparte, porque título/barra/contenido
  // necesitan leerlo los tres a la vez dentro del mismo return.
  const [addMode,    setAddMode]    = useState('search') // 'search' | 'scan' | 'manual'
  const [addQuery,   setAddQuery]   = useState('')
  const [addResults, setAddResults] = useState(null) // null = sin buscar todavía
  const [addLoading, setAddLoading] = useState(false)
  const [addError,   setAddError]   = useState(null)
  function openAddBook() {
    setAddMode('search'); setAddQuery(''); setAddResults(null); setAddError(null)
    setShowAddModal(true)
  }
  // Ver comentario junto al contenedor de la estantería (más abajo, issue
  // #12) sobre por qué esto ya no remonta 300 libros al volver.
  function closeAddBook() {
    setShowAddModal(false)
  }
  async function runAddSearch(ev) {
    ev?.preventDefault()
    const q = addQuery.trim()
    if (q.length < 3) { setAddError('Escribe al menos 3 caracteres para buscar'); return }
    setAddLoading(true); setAddError(null)
    try {
      const r = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`, { credentials: 'include' })
      if (!r.ok) {
        const body = await r.json().catch(() => null)
        throw new Error(body?.detail || `Error ${r.status}`)
      }
      const data = await r.json()
      setAddResults(data)
      if (data.length === 0) setAddError(`Sin resultados para "${q}"`)
    } catch (err) {
      setAddResults(null)
      setAddError(err.message || 'No se pudo contactar con el servidor.')
    } finally {
      setAddLoading(false)
    }
  }
  // Un código de barras escaneado es un ISBN exacto — mismo lookup dedicado
  // que usa LunitecaV2.jsx (GET /books/isbn/{isbn}), no la búsqueda de texto
  // libre (esa es difusa y a veces no encuentra nada con solo el ISBN como
  // consulta). El resultado se enseña en la MISMA lista que "Buscar" — no
  // hace falta una vista aparte solo para un resultado — así que en cuanto
  // se detecta algo, se cambia a esa pestaña con el resultado ya puesto.
  async function handleAddIsbnDetected(isbn) {
    setAddMode('search')
    setAddQuery(isbn)
    setAddLoading(true); setAddError(null); setAddResults(null)
    try {
      const r = await fetch(`/api/books/isbn/${encodeURIComponent(isbn)}`, { credentials: 'include' })
      if (!r.ok) { setAddError(`ISBN ${isbn} no encontrado`); setAddLoading(false); return }
      const book = await r.json()
      setAddResults([{ ...book, already_added: false }])
    } catch {
      setAddError('No se pudo contactar con el servidor.')
    }
    setAddLoading(false)
  }
  // null | 'filter' | 'sort' — un panel plegable dentro de la propia página
  // (empuja el contenido de abajo), no un popover flotando encima. Uno solo
  // a la vez: abrir el otro cierra este.
  const [openPanel, setOpenPanel] = useState(null)
  function openSearch() { setShowShelfSearch(true); setOpenPanel(null) }
  function toggleSearch() {
    if (showShelfSearch) { setShowShelfSearch(false); setShelfQuery('') }
    else openSearch()
  }
  // Envuelve la barra de herramientas Y el panel plegado (no solo el panel)
  // — así un clic en el propio botón de filtro/orden para cambiar de uno a
  // otro cuenta como "dentro" y no se cierra solo para volver a abrirse.
  const toolsAreaRef = useRef(null)
  useEffect(() => {
    if (!openPanel) return
    function onPointerDown(e) {
      // El desplegable de Carpeta/Autor (dentro del propio panel) se
      // renderiza vía portal directamente sobre .luniteca3-root, así que un
      // clic en una de sus opciones NO cuenta como "dentro" de
      // toolsAreaRef aunque lo sea visualmente — se trata aparte.
      if (e.target.closest('[data-select-content]')) return
      if (toolsAreaRef.current && !toolsAreaRef.current.contains(e.target)) setOpenPanel(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [openPanel])
  // useCallback (no solo function normal) — esto se pasa como prop a
  // CollapsibleSection, que está memoizado; si esta función fuera una
  // referencia nueva en cada render de ShelfTab, el memo de abajo no
  // serviría de nada.
  const toggleYear = useCallback((year) => {
    setCollapsedYears(prev => {
      const next = new Set(prev)
      next.has(year) ? next.delete(year) : next.add(year)
      return next
    })
  }, [])
  const [scrollWidth, setScrollWidth] = useState(0)
  // Mantener el scroll de la estantería al entrar a la ficha de un libro y
  // volver — issue reportada, mismo problema y misma solución que ya se
  // aplicó en LunitecaV2.jsx: el contenedor con scroll se desmonta del todo
  // al abrir un libro (más abajo, "if (selected) return <BookDetail .../>"
  // es un return distinto, no una rama que se quede montada oculta) y
  // remonta desde cero al volver, perdiendo el scrollTop. La posición se
  // guarda en un ref (sobrevive al desmontaje, a diferencia de un estado)
  // y se restaura con un ref-callback (se dispara justo cuando el nodo
  // vuelve a existir, sin depender de en qué momento exacto del ciclo de
  // render de React pasa eso).
  const scrollNode = useRef(null)
  const scrollPos  = useRef(0)
  const scrollRef = useCallback((node) => {
    scrollNode.current = node
    if (node) node.scrollTop = scrollPos.current
  }, [])
  // useCallback por el mismo motivo que toggleYear (ver comentario ahí) —
  // se pasa a CollapsibleSection, que está memoizado.
  const openBook = useCallback((entry) => {
    if (scrollNode.current) scrollPos.current = scrollNode.current.scrollTop
    setSelected(entry)
  }, [])

  // Empezar a hacer scroll en la estantería también cierra el panel
  // plegado — el propio scroll del contenedor ya lo desplaza fuera de la
  // vista, así que dejarlo abierto no tendría sentido.
  useEffect(() => {
    const el = scrollNode.current
    if (!el || !openPanel) return
    function onScroll() { setOpenPanel(null) }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [openPanel])

  // Depende de "shelf === null" (no del ref, que como tal no dispara
  // re-renders) — mientras la estantería está cargando, este componente
  // devuelve el <div>Cargando…</div> de más abajo, así que el contenedor con
  // scroll todavía no existe en el DOM y este efecto se queda sin nada que
  // observar. Con deps [] no se ha vuelto a ejecutar una vez montado el
  // contenedor real tras cargar, dejando columns fijo en el mínimo de
  // seguridad (3) para siempre. Al depender de esa transición, se vuelve a
  // intentar justo cuando el contenedor ya existe.
  useEffect(() => {
    const el = scrollNode.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setScrollWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [shelf === null])

  // Alto disponible para "Añadir libro" por encima del teclado — ver
  // useAvailableHeight más arriba (issue #13).
  const addPanelHeight = useAvailableHeight(scrollNode, shelf === null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/shelf/personal?player_id=${player.id}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (!cancelled) setShelf(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setShelf([]) })
    return () => { cancelled = true }
  }, [player.id])

  // Sincronización en vivo con LunitecaV2.jsx (comparten la misma BBDD): un
  // cambio hecho ahí — o desde otra pestaña/dispositivo con esta misma V3 —
  // no se veía aquí hasta recargar a mano. Mismo patrón que ya usa V2 para
  // esto (scope 'books' o 'shelf'), releído en vivo también aquí. La ficha
  // abierta (`selected`) se resincroniza con la entrada fresca por id — si
  // ya no existe (borrada en la otra pestaña), se cierra sola.
  useEffect(() => {
    function onWs(ev) {
      const msg = ev.detail
      if (msg?.type !== 'luni_update' || (msg.scope !== 'books' && msg.scope !== 'shelf')) return
      fetch(`/api/shelf/personal?player_id=${player.id}`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!Array.isArray(data)) return
          setShelf(data)
          setSelected(prev => prev ? (data.find(x => x.id === prev.id) || null) : prev)
        })
        .catch(() => {})
    }
    window.addEventListener('luni:ws', onWs)
    return () => window.removeEventListener('luni:ws', onWs)
  }, [player.id])

  function changeViewMode(mode) {
    localStorage.setItem(`luni3_viewmode_${player.id}`, mode)
    setViewMode(mode)
  }

  // Optimista: la ficha y la tarjeta correspondiente en la estantería
  // reflejan el cambio al instante (útil sobre todo para la puntuación,
  // arrastrando el dedo/ratón sobre las estrellas), y si el PATCH falla se
  // revierte a lo que había — nunca se queda mostrando un dato que en
  // realidad no se guardó.
  async function updateEntry(id, patch) {
    const prevEntry = shelf.find(x => x.id === id)
    setShelf(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x))
    setSelected(prev => prev && prev.id === id ? { ...prev, ...patch } : prev)
    try {
      const res = await fetch(`/api/shelf/personal/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('update failed')
      const updated = await res.json()
      setShelf(prev => prev.map(x => x.id === id ? updated : x))
      setSelected(prev => prev && prev.id === id ? updated : prev)
    } catch {
      if (prevEntry) {
        setShelf(prev => prev.map(x => x.id === id ? prevEntry : x))
        setSelected(prev => prev && prev.id === id ? prevEntry : prev)
      }
    }
  }

  // El libro (título/autor/género/año/páginas/sinopsis) es compartido — a
  // diferencia de la puntuación/notas/fechas, que son de PersonalShelf y
  // van por updateEntry. Mismo patrón optimista con reversión si falla.
  async function updateBook(bookId, patch) {
    const prevBook = shelf.find(x => x.book.id === bookId)?.book
    const applyBook = book => ({ ...book, ...patch })
    setShelf(prev => prev.map(x => x.book.id === bookId ? { ...x, book: applyBook(x.book) } : x))
    setSelected(prev => prev && prev.book.id === bookId ? { ...prev, book: applyBook(prev.book) } : prev)
    try {
      const res = await fetch(`/api/books/${bookId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('update failed')
      const updatedBook = await res.json()
      // El book_out del PATCH no lleva la portada propia del jugador — se
      // reaplica aquí para no perderla si tenía una distinta a la del libro.
      const withOwnCover = x => ({ ...updatedBook, cover_url: x.own_cover_url || updatedBook.cover_url })
      setShelf(prev => prev.map(x => x.book.id === bookId ? { ...x, book: withOwnCover(x) } : x))
      setSelected(prev => prev && prev.book.id === bookId ? { ...prev, book: withOwnCover(prev) } : prev)
    } catch {
      if (prevBook) {
        setShelf(prev => prev.map(x => x.book.id === bookId ? { ...x, book: prevBook } : x))
        setSelected(prev => prev && prev.book.id === bookId ? { ...prev, book: prevBook } : prev)
      }
    }
  }

  // Sube la foto a la galería del libro (compartida) y devuelve su URL — el
  // llamador (BookEditForm) decide si la usa como portada del libro en el
  // Guardar; no se aplica sola hasta ese punto.
  async function uploadCover(bookId, file) {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/books/${bookId}/cover`, { method: 'POST', credentials: 'include', body: fd })
    if (!res.ok) throw new Error('upload failed')
    const data = await res.json()
    return data.url
  }

  // Añadido rápido desde "Más de este autor" (issue #7) — siempre como "Por
  // leer", igual que addBook en LunitecaV2.jsx. No hace falta refrescar la
  // estantería a mano tras un 200: el propio backend ya emite el aviso de
  // WebSocket (scope 'shelf') que el efecto de más arriba ya escucha.
  // Devuelve la entrada creada (no solo un booleano) — el alta manual con
  // portada (ver ManualAddForm) necesita el book.id recién creado para
  // poder subir la imagen justo después, en un segundo paso. El resto de
  // llamadores (SearchResultRow, AuthorBookRow) solo miran si el resultado
  // es "truthy", así que este cambio no les afecta.
  async function addToShelf(book) {
    const res = await fetch('/api/shelf/personal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ ...book, status: book.status || 'want_to_read', origin: 'search' }),
    })
    if (!res.ok) return null
    return await res.json()
  }

  async function deleteEntry(id) {
    const prevShelf = shelf
    setSelected(null)
    setShelf(prev => prev.filter(x => x.id !== id))
    try {
      const res = await fetch(`/api/shelf/personal/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error('delete failed')
    } catch {
      setShelf(prevShelf)
    }
  }

  // useMemo (no un simple const) — SOLO recalcula cuando cambian
  // shelf/filters/shelfQuery/sort. Sin esto, `read`/`want`/`dropped`
  // (los arrays que recibe CollapsibleSection, memoizado — ver su
  // definición) son un array NUEVO en cada render de ShelfTab, por CUALQUIER
  // motivo (p. ej. abrir/cerrar "Añadir libro", que no toca la estantería
  // para nada) — eso invalida el memo de abajo igual que si no existiera, y
  // React reconcilia cientos de `GridCard` de la estantería en cada uno de
  // esos renders. Medido con Playwright + CPU 4x + `PerformanceObserver`:
  // 116-129ms de long task en ese único re-render sin esto, con el propio
  // render de `ShelfTab` tardando <1ms — el hook (más `memo` en
  // CollapsibleSection y `useCallback` en los handlers que se le pasan) es
  // lo que de verdad elimina ese coste, no un ajuste de CSS. Tiene que ir
  // antes de los `return` de "cargando"/"ficha abierta" de aquí abajo — los
  // hooks no pueden ser condicionales.
  const { visible, reading, read, dropped, want, years, readYearGroups, filtersActive, empty, noneVisible } = useMemo(() => {
    const s = shelf || []
    const visible = s.filter(e => matchesFilters(e, filters) && matchesQuery(e, shelfQuery))
    const reading = visible.filter(e => e.status === 'reading' || e.status === 'rereading')
    const read    = visible.filter(e => e.status === 'read')
    const dropped = visible.filter(e => e.status === 'dropped')
    const want    = [...visible.filter(e => e.status === 'want_to_read')].sort((a, b) => {
      if (sort.field) return compareEntries(a, b, sort)
      const authorA = a.book.author?.toLowerCase() || '', authorB = b.book.author?.toLowerCase() || ''
      if (!authorA && authorB) return 1
      if (authorA && !authorB) return -1
      if (authorA !== authorB) return authorA < authorB ? -1 : 1
      return (a.book.title || '').toLowerCase() < (b.book.title || '').toLowerCase() ? -1 : 1
    })
    if (sort.field) {
      reading.sort((a, b) => compareEntries(a, b, sort))
      dropped.sort((a, b) => compareEntries(a, b, sort))
    }

    const yearBuckets = {}
    for (const e of read) {
      const year = e.finished_at ? e.finished_at.slice(0, 4) : 'sin-fecha'
      ;(yearBuckets[year] ||= []).push(e)
    }
    const years = Object.keys(yearBuckets).filter(y => y !== 'sin-fecha').sort((a, b) => b.localeCompare(a))
    if (yearBuckets['sin-fecha']) years.push('sin-fecha')
    for (const y of years) {
      yearBuckets[y].sort((a, b) => sort.field ? compareEntries(a, b, sort) : (b.finished_at || '').localeCompare(a.finished_at || ''))
    }
    const readYearGroups = years.map(year => ({ year, items: yearBuckets[year] }))

    const filtersActive = Object.keys(EMPTY_FILTERS).some(k => filters[k] !== EMPTY_FILTERS[k])
    const empty = s.length === 0
    const noneVisible = !empty && visible.length === 0

    return { visible, reading, read, dropped, want, years, readYearGroups, filtersActive, empty, noneVisible }
  }, [shelf, filters, shelfQuery, sort])

  if (shelf === null) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: V3.sub, fontSize: 13 }}>Cargando…</div>
  }

  if (selected) {
    const existingFolders = [...new Set(shelf.map(x => x.folder).filter(Boolean))].sort()
    const existingGenres  = [...new Set(shelf.map(x => x.book.genre).filter(Boolean))].sort()
    return <BookDetail entry={selected} isMobile={isMobile} onBack={() => setSelected(null)}
      onUpdate={patch => updateEntry(selected.id, patch)}
      onUpdateBook={patch => updateBook(selected.book.id, patch)}
      onUploadCover={file => uploadCover(selected.book.id, file)}
      onDelete={() => deleteEntry(selected.id)}
      onQuickAdd={addToShelf}
      existingFolders={existingFolders} existingGenres={existingGenres} myPlayerId={player.id} />
  }

  const gridGap = isMobile ? 8 : 14
  const columns = isMobile ? 6 : Math.max(3, Math.floor((scrollWidth + gridGap) / (GRID_MIN_COVER + gridGap)) || 3)

  // Un solo botón que pliega/despliega Leídos, Por leer, Dropeados y todos
  // los años de golpe — "Leyendo" no pliega nunca (no forma parte de esta
  // cuenta). Si YA está todo plegado, el botón pasa a desplegar todo.
  const allCollapsed = collapsedRead && collapsedWant && collapsedDropped && years.every(y => collapsedYears.has(y))
  function toggleCollapseAll() {
    const next = !allCollapsed
    setCollapsedRead(next)
    setCollapsedWant(next)
    setCollapsedDropped(next)
    setCollapsedYears(next ? new Set(years) : new Set())
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: isMobile ? '16px 20px 0' : '0 0 0', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: isMobile ? 12 : 10, flexShrink: 0 }}>
          <h1 style={{ fontFamily: V3_FONT, fontWeight: 700, fontSize: isMobile ? 23 : 27, letterSpacing: '-0.01em', margin: 0, color: V3.text }}>Mi estantería</h1>
          <span style={{ fontSize: 13, color: V3.sub }}>{shelf.length}</span>
          <div style={{ flex: 1 }} />

          <div className="flex gap-0.5 rounded-md bg-secondary p-0.5">
            <Button variant="ghost" size="icon" onClick={() => changeViewMode('grid')}
              className={cn('h-6 w-6 rounded-sm', viewMode === 'grid' ? 'bg-card shadow-sm hover:bg-card' : 'hover:bg-transparent')}>
              <IconGrid color={viewMode === 'grid' ? V3.accent : V3.sub} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => changeViewMode('list')}
              className={cn('h-6 w-6 rounded-sm', viewMode === 'list' ? 'bg-card shadow-sm hover:bg-card' : 'hover:bg-transparent')}>
              <IconList color={viewMode === 'list' ? V3.accent : V3.sub} />
            </Button>
          </div>
        </div>

        {/* Barra de herramientas. Todo dentro va con position:absolute sobre
            un contenedor relative de alto fijo (36px) — a propósito: nada
            de flex/width/layout-flip aquí, porque mezclar una animación de
            ancho real (dispara reflow en cada frame) con animaciones
            `layout` de sus hermanos (que miden esa misma caja) es lo que
            causaba el movimiento brusco — el navegador tenía que recalcular
            el layout de la fila en cada frame en vez de solo mover píxeles
            ya pintados. Con posición absoluta, lo único que cambia frame a
            frame es transform/opacity — eso sí lo compone la GPU sin volver
            a calcular nada, así que es literalmente imposible que dé tirones.
            La lupa vive fija a la izquierda del todo y NUNCA se desvanece
            ni desaparece, ni siquiera al entrar/salir de "añadir" — es
            literalmente el mismo botón en los dos sitios (buscar en la
            estantería / pestaña "Buscar" de añadir), así que Wander pidió
            que se notara como tal en vez de disolverse y volver a aparecer
            cada vez. Solo cambia de icono/acción/resaltado en el sitio
            según el modo. El grupo plegar-todo/filtros/orden (fuera de
            "añadir") y el de Escanear/A mano (dentro) sí se desvanecen —
            son los que de verdad son distintos según el modo — deslizándose
            desde el mismo hueco a la derecha de la lupa. "Añadir libro"
            vive aparte, fijo a la derecha del todo y ajeno al buscador. */}
        <div ref={toolsAreaRef}>
        <div style={{ marginBottom: isMobile ? 18 : 20, flexShrink: 0, height: 36, position: 'relative' }}>
          <Button variant="ghost" size="icon"
            title={showAddModal ? 'Buscar' : (showShelfSearch ? 'Cerrar búsqueda' : 'Buscar en la estantería')}
            onClick={() => { if (showAddModal) setAddMode('search'); else toggleSearch() }}
            className={cn('absolute left-0 top-0 z-[1]', showAddModal && addMode === 'search' && 'bg-primary/10 hover:bg-primary/10')}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={(!showAddModal && showShelfSearch) ? 'x' : 'search'}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
                style={{ display: 'flex' }}>
                {(!showAddModal && showShelfSearch)
                  ? <IconX size={14} color={V3.sub} />
                  : <IconSearch color={showAddModal && addMode === 'search' ? V3.accent : V3.sub} />}
              </motion.span>
            </AnimatePresence>
          </Button>

          {/* El hueco entre la lupa (izq, siempre visible — ver comentario
              de arriba) y el +/X (der, ver más abajo) — normalmente
              plegar-todo/filtros/orden, pero en modo "añadir" las pestañas
              Escanear/A mano ("Buscar" ya no vive aquí: es la propia lupa).
              Solo cambia lo de dentro de este hueco: título y toggle
              grid/list (fuera de este bloque) nunca se tocan. */}
          <AnimatePresence mode="wait" initial={false}>
            {showAddModal ? (
              <motion.div key="add-tabs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{ position: 'absolute', left: 42, top: 0, display: 'flex', alignItems: 'center', gap: 4, height: 36 }}>
                {/* Iconos, no texto — con "Añadir varios"/Goodreads/Excel
                    todavía por sumar aquí (issue #8), unas pocas pestañas de
                    texto ya no caben cómodas en 36px de alto en móvil. */}
                {[
                  ['scan', 'Escanear', IconBarcode],
                  ['manual', 'A mano', IconPencil],
                ].map(([id, label, Icon]) => (
                  <Button key={id} variant="ghost" size="icon" title={label} onClick={() => setAddMode(id)}
                    className={cn('relative h-9 w-9', addMode === id && 'bg-primary/10 hover:bg-primary/10')}>
                    <Icon size={15} color={addMode === id ? V3.accent : V3.sub} />
                  </Button>
                ))}
              </motion.div>
            ) : !showShelfSearch && (
              <motion.div key="tools" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                transition={{ duration: SLIDE_S, ease: SLIDE_EASE }}
                style={{ position: 'absolute', left: 42, top: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Button variant="ghost" size="icon" title={allCollapsed ? 'Desplegar todo' : 'Plegar todo'} onClick={toggleCollapseAll} className="h-9 w-9">
                  <IconCollapseAll expand={allCollapsed} color={V3.sub} />
                </Button>
                <Button variant="ghost" size="icon"
                  onClick={() => setOpenPanel(p => p === 'filter' ? null : 'filter')}
                  className={cn('relative h-9 w-9', (openPanel === 'filter' || filtersActive) && 'bg-primary/10 hover:bg-primary/10')}>
                  <IconFilter color={(openPanel === 'filter' || filtersActive) ? V3.accent : V3.sub} />
                  {filtersActive && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />}
                </Button>
                <Button variant="ghost" size="icon"
                  onClick={() => setOpenPanel(p => p === 'sort' ? null : 'sort')}
                  className={cn('h-9 w-9', (openPanel === 'sort' || sort.field) && 'bg-primary/10 hover:bg-primary/10')}>
                  <IconSort color={(openPanel === 'sort' || sort.field) ? V3.accent : V3.sub} />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Añadir libro — mismo botón de siempre, fijo a la derecha del
              todo: solo cambia de icono/acción (+ / X) según el modo, igual
              que ya hace la lupa con buscar/cerrar. Nunca se mueve ni
              desaparece. */}
          <Button variant="ghost" size="icon" title={showAddModal ? 'Cerrar añadir libro' : 'Añadir libro'}
            onClick={showAddModal ? closeAddBook : openAddBook}
            className="absolute right-0 top-0">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={showAddModal ? 'x' : 'plus'}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
                style={{ display: 'flex' }}>
                {showAddModal ? <IconX size={14} color={V3.sub} /> : <IconPlus color={V3.sub} />}
              </motion.span>
            </AnimatePresence>
          </Button>

          <AnimatePresence initial={false}>
            {showShelfSearch && !showAddModal && (
              <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.18, delay: SLIDE_S } }} exit={{ opacity: 0, transition: { duration: 0.1 } }}
                style={{ position: 'absolute', left: 42, right: 42, top: 0, height: 36 }}>
                <input autoFocus value={shelfQuery} onChange={ev => setShelfQuery(ev.target.value)}
                  placeholder="Buscar por título o autor…"
                  style={{ height: 36, borderRadius: 18 }}
                  className="w-full border border-input bg-background pl-4 pr-9 text-sm outline-none focus:ring-1 focus:ring-ring" />
                {shelfQuery && (
                  <button onClick={() => setShelfQuery('')} title="Borrar texto"
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: V3.sub, display: 'flex' }}>
                    <IconX size={12} />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Panel de filtro/orden — flota SOBRE la estantería (top:100% del
              propio botón, o sea justo debajo de la barra) en vez de
              empujarla hacia abajo. "por encima del bloque de libros" — con
              overflow:hidden en el contenedor de más arriba, se recorta él
              solo si algún día midiera más que el hueco visible, así que no
              hace falta preocuparse por ese caso. */}
          <AnimatePresence initial={false}>
            {openPanel && !showAddModal && (
              <motion.div key={openPanel} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: SLIDE_EASE }}
                style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 10, zIndex: 20 }}>
                <div style={{
                  background: V3.surfaceHi, borderRadius: V3_RADIUS, padding: '14px 16px',
                  boxShadow: '0 8px 24px rgba(60,40,20,0.18), 0 2px 6px rgba(60,40,20,0.1)',
                }}>
                  {openPanel === 'filter'
                    ? <FilterPanelContent shelf={shelf} filters={filters} onChange={setFilters} active={filtersActive} container={container} />
                    : <SortPanelContent sort={sort} onChange={setSort} />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </div>

        <div ref={scrollRef} className="luni3-vscroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: isMobile ? '0 0 20px' : '30px 0 40px', position: 'relative' }}>
        {/* La estantería NUNCA se desmonta al entrar/salir de "añadir" — issue
            #12: desmontar y remontar de golpe cientos de tarjetas con
            portada daba tirones al volver. "Añadir" flota encima en
            position:absolute (mismo patrón que el panel de filtro/orden de
            más arriba) y aquí abajo solo se oculta con display:none (barato:
            nada que recrear al volver a mostrarla).

            display:none por sí solo NO bastaba, ojo — se midió con
            Playwright + CPU 4x + PerformanceObserver('longtask') y el
            propio display:none resultó irrelevante (probado quitándolo del
            todo: mismo tirón). El coste real era que CADA re-render de
            ShelfTab (por CUALQUIER motivo, incluido abrir/cerrar "añadir",
            que no toca la estantería) hacía que React reconciliara los
            ~300 `GridCard` de golpe, porque `read`/`want`/`dropped` eran un
            array nuevo cada vez y CollapsibleSection recibía funciones
            inline nuevas como onToggle/onSelect — sin memo real, da igual
            lo que diga el CSS. Arreglado con `useMemo` (más arriba, en el
            cálculo de visible/reading/read/dropped/want/years) + `memo` en
            CollapsibleSection + `useCallback` en openBook/toggleYear/los
            handlers de plegar. El display:none de aquí abajo se queda de
            cualquier forma, ya que es gratis y evita pintar/interactuar con
            la estantería mientras no se ve. */}
        <div style={{ display: showAddModal ? 'none' : 'block' }}>
          {empty && <p style={{ color: V3.sub, fontSize: 13, textAlign: 'center', marginTop: 40 }}>Todavía no hay libros en la estantería.</p>}
          {noneVisible && <p style={{ color: V3.sub, fontSize: 13, textAlign: 'center', marginTop: 40 }}>Ningún libro coincide con los filtros.</p>}

          <ReadingSection reading={reading} viewMode={viewMode} isMobile={isMobile} onSelect={openBook} />

          <CollapsibleSection label="Leídos" entries={read} viewMode={viewMode} isMobile={isMobile} columns={columns}
            collapsed={collapsedRead} onToggle={toggleCollapsedRead} yearGroups={readYearGroups}
            collapsedYears={collapsedYears} onToggleYear={toggleYear} onSelect={openBook} />

          <CollapsibleSection label="Por leer" entries={want} viewMode={viewMode} isMobile={isMobile} columns={columns}
            collapsed={collapsedWant} onToggle={toggleCollapsedWant} onSelect={openBook} />

          <CollapsibleSection label="Dropeados" entries={dropped} viewMode={viewMode} isMobile={isMobile} columns={columns}
            collapsed={collapsedDropped} onToggle={toggleCollapsedDropped} onSelect={openBook} />
        </div>

        <AnimatePresence initial={false}>
        {showAddModal && (
          <motion.div key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            style={{
              position: 'absolute', left: 0, right: 0, top: 0, maxWidth: 460, overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              // Alto = hueco disponible por encima del teclado de verdad
              // (useAvailableHeight, más arriba — mismo principio que
              // CenteredModal con --vvh/--vvtop, pero calculado desde donde
              // este panel empieza de verdad en pantalla, no desde el borde
              // físico superior). Antes esto era bottom:0 a secas (todo el
              // hueco del contenedor, ajeno al teclado) o altura automática
              // sin más — ninguna de las dos deja al navegador sitio de
              // sobra para desplazar un campo (p.ej. Sinopsis, en A mano)
              // por encima del teclado al enfocarlo — issue #13, reportada
              // por Wander con captura. Con esto, el panel entero (no solo
              // "Buscar") se encoge de verdad cuando aparece el teclado, y
              // overflowY:auto aquí mismo le da scroll propio a Escanear/A
              // mano cuando su contenido no cabe en ese hueco reducido.
              height: addPanelHeight ? `${addPanelHeight}px` : undefined,
              overflowY: 'auto',
              margin: isMobile ? '4px auto 0' : '8px auto 0',
            }}>
            {/* Buscar/Escanear/A mano cambiaban de golpe (sin transición) —
                feedback de Wander, convención general de animaciones de
                Puchi (ver memoria feedback-animaciones-ui): cualquier
                contenido que aparece/desaparece se anima siempre, nunca de
                golpe. El `AnimatePresence` de aquí abajo hace el cross-fade
                del contenido en sí (opacidad, sin `layout`: se probó y no
                ayudaba al problema de FPS que motivó esta nota — ver más
                abajo, junto al contenedor de la estantería). El cambio de
                alto entre pestañas se hace de golpe a propósito, no vale la
                pena una animación de layout aquí.

                Este panel ahora ocupa SIEMPRE la altura completa disponible
                (top:0, bottom:0, en vez de altura automática según el
                contenido) y cada pestaña es su propia columna flex con la
                cabecera fija arriba y SU PROPIO scroll debajo — issue
                reportada dos veces por Wander con `position: sticky` para
                la barra de "Buscar": primero una rendija de fondo al hacer
                el rebote elástico de iOS en el tope del scroll, y al
                arreglar eso, una sombra de las portadas "colándose" por el
                borde de la barra al deslizar. Las dos son bugs conocidos de
                Safari con sticky + capas compuestas — no una capa
                translúcida a medias en la práctica, aunque el CSS diga
                fondo opaco. Quitar `position: sticky` de raíz y separar
                "cabecera fija" de "contenido con scroll propio" (patrón de
                toda la vida, sin trucos) es lo único que evita esa familia
                entera de bugs, en vez de perseguir cada síntoma suelto. */}
            <AnimatePresence mode="wait" initial={false}>
              {addMode === 'search' ? (
                <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                  style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ flexShrink: 0, paddingTop: isMobile ? 4 : 8, paddingBottom: 12, paddingLeft: ADD_PANEL_HPAD, paddingRight: ADD_PANEL_HPAD }}>
                    <form onSubmit={runAddSearch} style={{ display: 'flex', gap: 8 }}>
                      <input
                        autoFocus value={addQuery} onChange={ev => setAddQuery(ev.target.value)}
                        placeholder="Título o autor…"
                        style={{ ...FIELD_INPUT_STYLE, flex: 1, height: 34, borderColor: V3.border }}
                      />
                      <button type="submit" disabled={addLoading} style={{
                        background: V3.accent, color: 'white', border: 'none', borderRadius: BOX_RADIUS,
                        padding: '0 16px', fontSize: 13, fontWeight: 700, cursor: addLoading ? 'default' : 'pointer', opacity: addLoading ? 0.6 : 1,
                      }}>
                        {addLoading ? '…' : 'Buscar'}
                      </button>
                    </form>
                    {addError && <p style={{ fontSize: 12, color: addResults ? V3.sub : '#c0392b', textAlign: 'center', margin: '10px 0 0' }}>{addError}</p>}
                  </div>

                  <div className="luni3-vscroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingLeft: ADD_PANEL_HPAD, paddingRight: ADD_PANEL_HPAD }}>
                    {addResults && addResults.length > 0 && (
                      <div>
                        {addResults.map((b, i) => (
                          <div key={b.book_id || b.open_lib_key || `${b.title}-${i}`} style={{ borderTop: i > 0 ? `1px solid ${V3.border}` : 'none' }}>
                            <SearchResultRow b={b} onPick={addToShelf} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : addMode === 'scan' ? (
                <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                  style={{ paddingLeft: ADD_PANEL_HPAD, paddingRight: ADD_PANEL_HPAD }}>
                  <ScanTab onDetect={handleAddIsbnDetected} />
                </motion.div>
              ) : (
                <motion.div key="manual" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                  style={{ paddingLeft: ADD_PANEL_HPAD, paddingRight: ADD_PANEL_HPAD }}>
                  <ManualAddForm existingGenres={[...new Set(shelf.map(x => x.book.genre).filter(Boolean))].sort()}
                    onAdd={addToShelf} onUploadCover={uploadCover} onClose={closeAddBook} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
        </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function ComingSoonTab({ label }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, color: V3.sub }}>{label}</span>
      <span style={{ fontSize: 12, color: V3.muted }}>Todavía no migrado a esta estética</span>
    </div>
  )
}

// ─── Armazón (nav + shell) ─────────────────────────────────────────────────

const SECTIONS = [
  { id: 'shelf',  label: 'Estantería', Icon: IconShelf },
  { id: 'club',   label: 'Club',       Icon: IconClub },
  { id: 'amigos', label: 'Amigos',     Icon: IconAmigos },
]

export default function LunitecaV3({ player }) {
  const isMobile = useIsMobile()
  const [nav, setNav] = useState('shelf')
  const visibleSections = player.club_member ? SECTIONS : SECTIONS.filter(s => s.id !== 'club')
  // Los menús de Radix (filtro/orden) se portalan fuera del árbol por
  // defecto — sin apuntarlos a este nodo se salen de .luniteca3-root y
  // pierden los tokens de color escopados (ver container en popover.jsx).
  const rootRef = useRef(null)

  return (
    <div ref={rootRef} className="luniteca3-root" style={{
      display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100%',
      background: V3.bg, fontFamily: V3_FONT, color: V3.text, overflow: 'hidden',
    }}>

      {!isMobile && (
        <div style={{
          width: 88, flexShrink: 0, height: '100%', background: V3.surfaceHi,
          borderRight: `1px solid ${V3.border}`, display: 'flex', flexDirection: 'column',
          alignItems: 'center', padding: '28px 0',
        }}>
          <div style={{ fontWeight: 700, fontSize: 20, color: V3.accent }}>L</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 52 }}>
            {visibleSections.map(({ id, label, Icon }) => {
              const active = nav === id
              return (
                <Button key={id} title={label} variant="ghost" size="icon" onClick={() => setNav(id)}
                  className={cn('h-10 w-10', active ? 'bg-primary/10 hover:bg-primary/10' : 'hover:bg-accent')}>
                  <Icon color={active ? V3.accent : V3.sub} />
                </Button>
              )
            })}
          </div>
        </div>
      )}

      {isMobile && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '18px 0 8px', flexShrink: 0 }}>
          {visibleSections.map(({ id }) => (
            <button key={id} onClick={() => setNav(id)} style={{
              width: nav === id ? 18 : 5, height: 5, borderRadius: 3, border: 'none', padding: 0, cursor: 'pointer',
              background: nav === id ? V3.accent : V3.border, transition: 'width 0.2s ease, background 0.2s ease',
            }} />
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: isMobile ? 0 : '0 56px', paddingTop: isMobile ? 0 : 0 }}>
        {nav === 'shelf'  && <div style={{ flex: 1, overflow: 'hidden', display: 'flex', paddingTop: isMobile ? 0 : 46 }}><ShelfTab player={player} isMobile={isMobile} container={rootRef} /></div>}
        {nav === 'club'   && <ComingSoonTab label="Club" />}
        {nav === 'amigos' && <ComingSoonTab label="Amigos" />}
      </div>
    </div>
  )
}
