import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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

const EMPTY_FILTERS = { genre: '', folder: '', author: '', maxPages: '' }

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

function CollapsibleSection({ label, entries, viewMode, isMobile, columns, collapsed, onToggle, yearGroups, collapsedYears, onToggleYear, onSelect }) {
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
}

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
        <label className="flex flex-col gap-1" style={{ minWidth: 100, flex: 1 }}>
          <span style={{ fontSize: 10.5, color: V3.muted }}>Páginas máx.</span>
          <input type="number" min="1" value={filters.maxPages} onChange={ev => set('maxPages', ev.target.value)}
            placeholder="Sin límite"
            className="h-7 w-full rounded-md border border-input bg-background px-2.5 text-xs outline-none focus:ring-1 focus:ring-ring" />
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
  // V3.surfaceHi no resuelve a nada y el modal sale transparente. `position:
  // fixed` ya centra sobre toda la pantalla sin necesitar salir del árbol.
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 24,
        background: 'rgba(36,31,26,0.4)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 8 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        onClick={ev => ev.stopPropagation()}
        style={{
          background: V3.surfaceHi, borderRadius: BOX_RADIUS, padding: '20px 20px 16px',
          width, maxWidth: '100%', boxShadow: '0 20px 50px rgba(20,14,8,0.35)',
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
            <input autoFocus value={draft} onChange={ev => setDraft(ev.target.value)} placeholder="Nombre de la carpeta"
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
        <p style={{ fontSize: 13, lineHeight: 1.6, color: notes ? V3.text : V3.muted, whiteSpace: 'pre-line', margin: 0 }}>
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
          <select value={draft.genre} onChange={set('genre')} style={{ ...tintedField('genre'), height: 34 }}>
            <option value="">Sin género</option>
            {genreOptions.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL}>Año</label>
          <select value={draft.year} onChange={set('year')} style={{ ...tintedField('year'), height: 34 }}>
            <option value="">–</option>
            {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL}>Páginas</label>
          <select value={draft.num_pages} onChange={set('num_pages')} style={{ ...tintedField('pages'), height: 34 }}>
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

function BookDetail({ entry, isMobile, onBack, onUpdate, onUpdateBook, onUploadCover, onDelete, existingFolders, existingGenres, myPlayerId }) {
  const e = entry
  const b = e.book
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)

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
              width: isMobile ? 168 : 220, flexShrink: 0, aspectRatio: '2/3', borderRadius: V3_RADIUS,
              boxShadow: '0 6px 14px rgba(60,40,20,0.2), 0 18px 34px -16px rgba(60,40,20,0.4)',
            }}>
              <Cover url={b.cover_url} />
            </div>

            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'center' : 'flex-start' }}>
              <h1 style={{
                fontFamily: V3_FONT, fontWeight: 700, letterSpacing: '-0.015em', color: V3.text,
                fontSize: isMobile ? 26 : 34, lineHeight: 1.15, margin: '2px 0 6px',
              }}>
                {b.title}
              </h1>
              {b.author && <p style={{ fontSize: isMobile ? 14.5 : 16, color: V3.sub, margin: '0 0 16px' }}>{b.author}</p>}
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

function ShelfTab({ player, isMobile, container }) {
  const [shelf, setShelf]       = useState(null) // null = cargando
  const [selected, setSelected] = useState(null) // entrada abierta en la ficha, o null = estantería
  const [viewMode, setViewMode] = useState(() => localStorage.getItem(`luni3_viewmode_${player.id}`) || 'grid')
  const [collapsedRead,    setCollapsedRead]    = useState(false)
  const [collapsedWant,    setCollapsedWant]    = useState(false)
  const [collapsedDropped, setCollapsedDropped] = useState(true)
  const [collapsedYears,   setCollapsedYears]   = useState(() => new Set())
  const [sort,    setSort]    = useState({ field: '', dir: 'asc' })
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [shelfQuery,      setShelfQuery]      = useState('')
  const [showShelfSearch, setShowShelfSearch] = useState(false)
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
  function toggleYear(year) {
    setCollapsedYears(prev => {
      const next = new Set(prev)
      next.has(year) ? next.delete(year) : next.add(year)
      return next
    })
  }
  const [scrollWidth, setScrollWidth] = useState(0)
  const scrollRef = useRef(null)

  // Empezar a hacer scroll en la estantería también cierra el panel
  // plegado — el propio scroll del contenedor ya lo desplaza fuera de la
  // vista, así que dejarlo abierto no tendría sentido.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !openPanel) return
    function onScroll() { setOpenPanel(null) }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [openPanel])

  // Depende de "shelf === null" (no de scrollRef, que como ref no dispara
  // re-renders) — mientras la estantería está cargando, este componente
  // devuelve el <div>Cargando…</div> de más abajo, así que el contenedor con
  // scrollRef todavía no existe en el DOM y este efecto se queda sin nada
  // que observar. Con deps [] no se ha vuelto a ejecutar una vez montado el
  // contenedor real tras cargar, dejando columns fijo en el mínimo de
  // seguridad (3) para siempre. Al depender de esa transición, se vuelve a
  // intentar justo cuando el contenedor ya existe.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setScrollWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [shelf === null])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/shelf/personal?player_id=${player.id}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (!cancelled) setShelf(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setShelf([]) })
    return () => { cancelled = true }
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
      existingFolders={existingFolders} existingGenres={existingGenres} myPlayerId={player.id} />
  }

  const visible = shelf.filter(e => matchesFilters(e, filters) && matchesQuery(e, shelfQuery))
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
  const empty = shelf.length === 0
  const noneVisible = !empty && visible.length === 0
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
            La lupa vive fija a la izquierda del todo (ya no viaja de un
            lado a otro con layoutId: solo cambia de icono/acción en el
            sitio), seguida del grupo plegar-todo/filtros/orden — ese grupo
            es lo único que se aparta al abrir el buscador, deslizándose
            hacia la derecha (mismo sentido en el que crece el input, para
            que se sienta coherente) mientras se desvanece. "Añadir libro"
            vive aparte, fijo a la derecha del todo y ajeno al buscador. */}
        <div ref={toolsAreaRef}>
        <div style={{ marginBottom: isMobile ? 18 : 20, flexShrink: 0, height: 36, position: 'relative' }}>
          <button onClick={toggleSearch} className="hover:bg-accent"
            style={{
              position: 'absolute', left: 0, top: 0, height: 36, width: 36, borderRadius: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, zIndex: 1,
            }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={showShelfSearch ? 'x' : 'search'}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
                style={{ display: 'flex' }}>
                {showShelfSearch ? <IconX size={14} color={V3.sub} /> : <IconSearch color={V3.sub} />}
              </motion.span>
            </AnimatePresence>
          </button>

          <AnimatePresence initial={false}>
            {!showShelfSearch && (
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

          {/* Añadir libro — de momento sin funcionalidad. Fijo a la derecha
              del todo, ajeno al buscador (no se mueve ni se oculta al
              abrirlo). */}
          <button title="Añadir libro" className="hover:bg-accent"
            style={{
              position: 'absolute', right: 0, top: 0, height: 36, width: 36, borderRadius: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
            }}>
            <IconPlus color={V3.sub} />
          </button>

          <AnimatePresence initial={false}>
            {showShelfSearch && (
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
            {openPanel && (
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

        <div ref={scrollRef} className="luni3-vscroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: isMobile ? '0 0 20px' : '30px 0 40px' }}>
          {empty && <p style={{ color: V3.sub, fontSize: 13, textAlign: 'center', marginTop: 40 }}>Todavía no hay libros en la estantería.</p>}
          {noneVisible && <p style={{ color: V3.sub, fontSize: 13, textAlign: 'center', marginTop: 40 }}>Ningún libro coincide con los filtros.</p>}

          {reading.length > 0 && (
            <div style={{ marginBottom: isMobile ? 28 : 34 }}>
              <SectionLabel count={reading.length} tint={V3.accentBg} isMobile={isMobile}>Leyendo</SectionLabel>
              {viewMode === 'grid' ? (
                // Carrusel de tarjetas grandes con progreso — solo en vista
                // grid (mismo criterio que el resto de secciones, que también
                // cambian de forma con el toggle). Scroll horizontal propio y
                // contenido, nunca empuja el ancho del resto de la estantería.
                <div className="luni3-hscroll" style={{ display: 'flex', gap: isMobile ? 14 : 26, overflowX: 'auto' }}>
                  {reading.map(e => <ReadingCard key={e.id} e={e} isMobile={isMobile} onSelect={setSelected} />)}
                </div>
              ) : (
                <List entries={reading} isMobile={isMobile} onSelect={setSelected} />
              )}
            </div>
          )}

          <CollapsibleSection label="Leídos" entries={read} viewMode={viewMode} isMobile={isMobile} columns={columns}
            collapsed={collapsedRead} onToggle={() => setCollapsedRead(v => !v)} yearGroups={readYearGroups}
            collapsedYears={collapsedYears} onToggleYear={toggleYear} onSelect={setSelected} />

          <CollapsibleSection label="Por leer" entries={want} viewMode={viewMode} isMobile={isMobile} columns={columns}
            collapsed={collapsedWant} onToggle={() => setCollapsedWant(v => !v)} onSelect={setSelected} />

          <CollapsibleSection label="Dropeados" entries={dropped} viewMode={viewMode} isMobile={isMobile} columns={columns}
            collapsed={collapsedDropped} onToggle={() => setCollapsedDropped(v => !v)} onSelect={setSelected} />
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
