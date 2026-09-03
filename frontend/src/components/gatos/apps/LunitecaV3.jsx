import { useState, useEffect, useRef } from 'react'
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
// Deliberadamente NO incluye todavía: buscador, filtros, orden, añadir
// libro, ni la ficha de detalle (se abre desde la portada) — se irán
// sumando en próximas pasadas en vez de dejar botones sin función.

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
  return new Date(iso).toLocaleDateString('es', { month: 'short', year: 'numeric' })
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

function ReadingCard({ e, isMobile }) {
  const w = isMobile ? 118 : 148
  const pct = progressPct(e)
  return (
    <div style={{ width: w, flexShrink: 0, minWidth: 0 }}>
      <div style={{ width: w, aspectRatio: '2/3', boxShadow: '0 1px 3px rgba(60,40,20,0.15), 0 6px 14px -8px rgba(60,40,20,0.28)', borderRadius: V3_RADIUS }}>
        <Cover url={e.book.cover_url} />
      </div>
      <Progress value={pct} className="mt-[9px] h-[3px]" />
      <div style={{ marginTop: 8, fontSize: isMobile ? 12.5 : 13, fontWeight: 600, color: V3.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.book.title}</div>
      <div style={{ fontSize: 11.5, color: V3.sub }}>{isMobile ? `${pct}%` : `${e.book.author || ''} · ${pct}%`}</div>
    </div>
  )
}

function GridCard({ e, isMobile }) {
  return (
    // Sin título/autor de momento (probando solo-portada) — título y
    // desplegable, ver historial. min-width:0 se queda por si vuelven: sin
    // eso, un texto nowrap fuerza la columna del grid a ensancharse hasta
    // caber el texto entero.
    <div style={{ minWidth: 0 }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '2/3', boxShadow: '0 1px 3px rgba(60,40,20,0.15), 0 5px 12px -8px rgba(60,40,20,0.28)', borderRadius: V3_RADIUS, cursor: 'pointer' }}>
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

function ListRow({ e, isMobile }) {
  const status = e.status
  const pct = progressPct(e)
  const showProgress = status === 'reading' || status === 'rereading'
  return (
    <div style={{
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
function Grid({ entries, isMobile, columns }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap: isMobile ? '10px 8px' : 14,
    }}>
      {entries.map(e => <GridCard key={e.id} e={e} isMobile={isMobile} />)}
    </div>
  )
}

function List({ entries, isMobile }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxWidth: isMobile ? 'none' : 820 }}>
      {entries.map(e => <ListRow key={e.id} e={e} isMobile={isMobile} />)}
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

function CollapsibleSection({ label, entries, viewMode, isMobile, columns, collapsed, onToggle, yearGroups, collapsedYears, onToggleYear }) {
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
                        {viewMode === 'grid' ? <Grid entries={items} isMobile={isMobile} columns={columns} /> : <List entries={items} isMobile={isMobile} />}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            }) : (
              viewMode === 'grid' ? <Grid entries={entries} isMobile={isMobile} columns={columns} /> : <List entries={entries} isMobile={isMobile} />
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

function ShelfTab({ player, isMobile, container }) {
  const [shelf, setShelf]       = useState(null) // null = cargando
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

  if (shelf === null) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: V3.sub, fontSize: 13 }}>Cargando…</div>
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
            El botón lupa/X usa layoutId: son dos <button> distintos (uno a
            la derecha, otro a la izquierda) que framer-motion anima como si
            fueran el mismo elemento moviéndose — la forma «oficial» de
            framer-motion de mover un elemento de un sitio a otro sin tocar
            el layout de nadie más. */}
        <div ref={toolsAreaRef}>
        <div style={{ marginBottom: isMobile ? 18 : 20, flexShrink: 0, height: 36, position: 'relative' }}>
          <AnimatePresence initial={false}>
            {!showShelfSearch && (
              <motion.div key="tools" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                transition={{ duration: SLIDE_S, ease: SLIDE_EASE }}
                style={{ position: 'absolute', left: 0, top: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
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

          {!showShelfSearch ? (
            <motion.button key="search-closed" layoutId="search-toggle" onClick={openSearch}
              transition={{ duration: SLIDE_S, ease: SLIDE_EASE }} className="hover:bg-accent"
              style={{
                position: 'absolute', right: 0, top: 0, height: 36, width: 36, borderRadius: V3_RADIUS,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
              }}>
              <IconSearch color={V3.sub} />
            </motion.button>
          ) : (
            <motion.button key="search-open" layoutId="search-toggle" onClick={() => { setShowShelfSearch(false); setShelfQuery('') }}
              transition={{ duration: SLIDE_S, ease: SLIDE_EASE }} className="hover:bg-accent"
              style={{
                position: 'absolute', left: 0, top: 0, height: 36, width: 36, borderRadius: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
              }}>
              <IconX size={14} color={V3.sub} />
            </motion.button>
          )}

          <AnimatePresence initial={false}>
            {showShelfSearch && (
              <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.18, delay: SLIDE_S } }} exit={{ opacity: 0, transition: { duration: 0.1 } }}
                style={{ position: 'absolute', left: 42, right: 0, top: 0, height: 36 }}>
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
                  {reading.map(e => <ReadingCard key={e.id} e={e} isMobile={isMobile} />)}
                </div>
              ) : (
                <List entries={reading} isMobile={isMobile} />
              )}
            </div>
          )}

          <CollapsibleSection label="Leídos" entries={read} viewMode={viewMode} isMobile={isMobile} columns={columns}
            collapsed={collapsedRead} onToggle={() => setCollapsedRead(v => !v)} yearGroups={readYearGroups}
            collapsedYears={collapsedYears} onToggleYear={toggleYear} />

          <CollapsibleSection label="Por leer" entries={want} viewMode={viewMode} isMobile={isMobile} columns={columns}
            collapsed={collapsedWant} onToggle={() => setCollapsedWant(v => !v)} />

          <CollapsibleSection label="Dropeados" entries={dropped} viewMode={viewMode} isMobile={isMobile} columns={columns}
            collapsed={collapsedDropped} onToggle={() => setCollapsedDropped(v => !v)} />
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
