import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useIsMobile } from '../../../utils/responsive'
import { C } from './lunitecaTheme'

// Igual que en BulkAddModal.jsx/GoodreadsImportModal.jsx — un <input
// type="date"> nativo nunca se arregló en Safari de iOS, así que las fechas
// se editan con tres <select> (día/mes/año) en vez del control nativo.
const inpStyleBase = {
  background: C.surfaceHi, border: `1px solid ${C.border}`,
  borderRadius: 9, padding: '11px 12px', color: C.text, fontSize: 15,
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', width: '100%', minWidth: 0,
}
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
function daysInMonth(month, year) {
  return new Date(year, month + 1, 0).getDate()
}
function CustomDateInput({ value, onChange, style }) {
  const initial = value ? value.split('-') : ['', '', '']
  const [year,  setYear]  = useState(initial[0] || '')
  const [month, setMonth] = useState(initial[1] ? String(parseInt(initial[1], 10) - 1) : '')
  const [day,   setDay]   = useState(initial[2] ? String(parseInt(initial[2], 10)) : '')

  const maxDay = (month !== '' && year) ? daysInMonth(parseInt(month), parseInt(year)) : 31
  const days   = Array.from({ length: maxDay }, (_, i) => i + 1)
  const thisYear = new Date().getFullYear()
  const years  = Array.from({ length: 90 }, (_, i) => thisYear - i)

  function commit(nextDay, nextMonth, nextYear) {
    if (nextDay === '' || nextMonth === '' || nextYear === '') { onChange(''); return }
    const clampedDay = Math.min(parseInt(nextDay), daysInMonth(parseInt(nextMonth), parseInt(nextYear)))
    onChange(`${nextYear}-${String(parseInt(nextMonth) + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`)
  }

  const selStyle = { ...inpStyleBase, cursor: 'pointer', colorScheme: 'dark' }

  return (
    <div style={{ display: 'flex', gap: 6, ...style }}>
      <select value={day} onChange={e => { setDay(e.target.value); commit(e.target.value, month, year) }} style={{ ...selStyle, flex: '0.8' }}>
        <option value="">Día</option>
        {days.map(dd => <option key={dd} value={dd}>{dd}</option>)}
      </select>
      <select value={month} onChange={e => { setMonth(e.target.value); commit(day, e.target.value, year) }} style={{ ...selStyle, flex: 1.5 }}>
        <option value="">Mes</option>
        {MONTHS.map((label, i) => <option key={i} value={i}>{label}</option>)}
      </select>
      <select value={year} onChange={e => { setYear(e.target.value); commit(day, month, e.target.value) }} style={{ ...selStyle, flex: 1 }}>
        <option value="">Año</option>
        {years.map(yy => <option key={yy} value={yy}>{yy}</option>)}
      </select>
    </div>
  )
}
function IconCalendarOff({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <rect x="2" y="3.2" width="12" height="10.8" rx="2" stroke={color} strokeWidth="1.3" />
      <path d="M2 6.4h12" stroke={color} strokeWidth="1.3" />
      <path d="M5.2 1.6v2.4M10.8 1.6v2.4" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M6 9.2l4 4M10 9.2l-4 4" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
function IconCheck({ size = 12, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M2 6.2l2.6 2.6L10 3" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconX({ size = 12, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
function IconEdit({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M11.5 2.5a1.5 1.5 0 0 1 2.12 2.12L5 13.24l-3 .76.76-3L11.5 2.5z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconBack({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block' }}>
      <path d="M10 3L5 8l5 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconUpload({ size = 22, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
      <path d="M12 15.5V4M7.5 8.5L12 4l4.5 4.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
function IconDownload({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M12 4v11.5M7.5 11l4.5 4.5 4.5-4.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
function IconSearch({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <circle cx="6" cy="6" r="4.2" stroke={color} strokeWidth="1.4" />
      <line x1="9.2" y1="9.2" x2="12.5" y2="12.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
function IconSpinner({ size = 13, color = 'currentColor' }) {
  return (
    <motion.svg width={size} height={size} viewBox="0 0 16 16" style={{ display: 'block', flexShrink: 0 }}
      animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}>
      <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeDasharray="26 40" fill="none" />
    </motion.svg>
  )
}
function IconBookPlaceholder({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block' }}>
      <path d="M8 13V4C6.5 3 5 2.7 3 3v9c2-.3 3.5 0 5 1z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M8 13V4c1.5-1 3-1.3 5-1v9c-2-.3-3.5 0-5 1z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}

const STATUS_OPTIONS = [
  ['want_to_read', 'Por leer'],
  ['reading',      'Leyendo'],
  ['read',         'Leído'],
  ['dropped',      'Dropeado'],
]
const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS)

// Campos del sistema a los que se puede mapear una columna del archivo.
// Solo el título es obligatorio — el resto se puede dejar sin mapear y se
// completa (o no) a mano en la vista previa, fila por fila.
// `templateHeader` es el texto exacto que lleva esa columna en la plantilla
// descargable (ver downloadTemplate) — siempre una de las propias aliases,
// para que al volver a subirla el mapeo se adivine solo sin ambigüedad.
const TARGET_FIELDS = [
  { key: 'title',       label: 'Título',              required: true,  templateHeader: 'Título',           aliases: ['titulo', 'nombre', 'title', 'name', 'libro', 'book'] },
  { key: 'author',      label: 'Autor',                                templateHeader: 'Autor',            aliases: ['autor', 'autora', 'author', 'autores', 'writer'] },
  { key: 'isbn',        label: 'ISBN',                                 templateHeader: 'ISBN',             aliases: ['isbn', 'isbn13', 'isbn10', 'isbn-13', 'isbn-10'] },
  { key: 'year',        label: 'Año',                                  templateHeader: 'Año',              aliases: ['ano', 'anio', 'year', 'publicacion', 'ano de publicacion'] },
  { key: 'num_pages',   label: 'Nº de páginas',                        templateHeader: 'Páginas',          aliases: ['paginas', 'pages', 'num paginas', 'numero de paginas', 'n paginas'] },
  { key: 'genre',       label: 'Género',                                templateHeader: 'Género',           aliases: ['genero', 'genre', 'categoria'] },
  { key: 'status',      label: 'Estado',                                templateHeader: 'Estado',           aliases: ['estado', 'status', 'estanteria', 'shelf'] },
  { key: 'rating',      label: 'Puntuación (0-5)',                     templateHeader: 'Puntuación',       aliases: ['puntuacion', 'rating', 'valoracion', 'nota', 'calificacion', 'estrellas', 'stars'] },
  { key: 'started_at',  label: 'Fecha de inicio',                      templateHeader: 'Fecha de inicio',  aliases: ['fecha inicio', 'fecha de inicio', 'inicio', 'start date', 'started', 'comenzado', 'fecha de comienzo'] },
  { key: 'finished_at', label: 'Fecha de fin',                         templateHeader: 'Fecha de fin',     aliases: ['fecha fin', 'fecha de fin', 'fin', 'end date', 'finished', 'terminado', 'date read', 'fecha de lectura', 'fecha lectura'] },
  { key: 'times_read',  label: 'Veces leído',                          templateHeader: 'Veces leído',      aliases: ['veces leido', 'read count', 'relecturas', 'numero de lecturas', 'n de lecturas'] },
  { key: 'folder',      label: 'Carpeta',                              templateHeader: 'Carpeta',          aliases: ['carpeta', 'folder', 'coleccion'] },
  { key: 'notes',       label: 'Notas',                                templateHeader: 'Notas',            aliases: ['notas', 'notes', 'comentarios', 'comentario', 'resena'] },
  { key: 'synopsis',    label: 'Sinopsis',                             templateHeader: 'Sinopsis',         aliases: ['sinopsis', 'synopsis', 'resumen', 'descripcion', 'argumento', 'summary'] },
]

function normHeader(s) {
  return (s ?? '').toString().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

// Adivina el mapeo inicial por el nombre de cada columna, para no obligar a
// mapear las 14 casillas a mano cuando el archivo ya usa nombres obvios
// ("Título", "Autor"...). Siempre editable después — esto es solo un punto
// de partida, nunca una decisión definitiva.
function guessMapping(headers) {
  const used = new Set()
  const mapping = {}
  headers.forEach((h, i) => {
    const n = normHeader(h)
    if (!n) return
    for (const f of TARGET_FIELDS) {
      if (used.has(f.key)) continue
      if (f.aliases.some(a => n === a || n.includes(a))) {
        mapping[i] = f.key
        used.add(f.key)
        break
      }
    }
  })
  return mapping
}

function toStr(v) {
  if (v == null) return ''
  if (v instanceof Date) return toIsoDate(v)
  return String(v).trim()
}
function toNum(v) {
  if (v == null || v === '' || v instanceof Date) return null
  const n = parseFloat(String(v).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
function toInt(v) {
  const n = toNum(v)
  return n == null ? null : Math.round(n)
}
// Acepta fechas ya interpretadas por SheetJS (cellDates:true) y las formas
// de texto más comunes en hojas de cálculo hechas a mano.
//
// OJO: cuando la celda de origen es una fecha real de Excel (no texto),
// sheet_to_json ya deja el Date ajustado a la hora local del navegador al
// convertir el número de serie — leerlo con getUTCFullYear/... resta el
// desfase horario otra vez y adelanta la fecha un día en cualquier huso por
// delante de UTC (p. ej. España). Hay que usar los métodos locales.
function toIsoDate(v) {
  if (v == null || v === '') return ''
  if (v instanceof Date && !isNaN(v)) {
    const y = v.getFullYear(), m = String(v.getMonth() + 1).padStart(2, '0'), d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(v).trim()
  let m
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  if ((m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})/.exec(s))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  if ((m = /^(\d{1,2})-(\d{1,2})-(\d{4})/.exec(s))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return ''
}

// want_to_read se comprueba antes que read para que negaciones como "no
// leído"/"sin leer" no caigan en "read" solo por contener la palabra.
const STATUS_ALIASES = {
  want_to_read: ['por leer', 'pendiente', 'pendientes', 'to read', 'want to read', 'no leido', 'sin leer', 'wishlist', 'tbr'],
  dropped:      ['dropeado', 'abandonado', 'dropped', 'dnf'],
  reading:      ['leyendo', 'reading', 'en curso', 'actual', 'en progreso', 'currently reading'],
  read:         ['leido', 'read', 'terminado', 'finalizado', 'completado', 'done'],
}
function mapStatusValue(raw) {
  const n = normHeader(toStr(raw))
  if (!n) return 'want_to_read'
  for (const [key, aliases] of Object.entries(STATUS_ALIASES)) {
    if (aliases.includes(n)) return key
  }
  for (const [key, aliases] of Object.entries(STATUS_ALIASES)) {
    if (aliases.some(a => n.includes(a))) return key
  }
  return 'want_to_read'
}

// Misma lista canónica que usa el resto de la app (`GENRE_OPTIONS` en
// LunitecaV2.jsx) — el género no es texto libre en ningún otro sitio de
// Puchi (el formulario de edición lo fuerza con un <select>, y una fila ya
// guardada con un valor fuera de esta lista se muestra en blanco), así que
// el editor de esta importación usa el mismo desplegable en vez de un
// campo de texto suelto.
const GENRE_OPTIONS = [
  'Fantasía', 'Ciencia ficción', 'Misterio', 'Thriller', 'Romance',
  'Ficción histórica', 'Terror', 'Aventura', 'Literatura infantil',
  'Juvenil', 'Ficción literaria', 'Novela gráfica', 'Biografía',
  'Memorias', 'Autoayuda', 'No ficción', 'Poesía', 'Drama',
  'Distopía', 'Realismo mágico', 'Crimen', 'Western', 'Clásico', 'Ficción',
]
// 'Ficción' (genérico) va el último a propósito: en la pasada de coincidencia
// parcial de mapGenreValue, si fuera antes que "Ciencia ficción"/"Ficción
// histórica"/etc. se comería esas coincidencias más específicas por
// contener la misma palabra.
const GENRE_ALIASES = {
  'Fantasía':            ['fantasia', 'fantasy'],
  'Ciencia ficción':     ['ciencia ficcion', 'scifi', 'sci fi', 'sci-fi', 'science fiction'],
  'Misterio':            ['misterio', 'mystery'],
  'Thriller':            ['thriller', 'suspense'],
  'Romance':             ['romance', 'romantica', 'romantico'],
  'Ficción histórica':   ['ficcion historica', 'historical fiction', 'novela historica'],
  'Terror':              ['terror', 'horror'],
  'Aventura':            ['aventura', 'adventure'],
  'Literatura infantil': ['literatura infantil', 'infantil', 'children', 'childrens', 'kids'],
  'Juvenil':             ['juvenil', 'ya', 'young adult'],
  'Ficción literaria':   ['ficcion literaria', 'literary fiction'],
  'Novela gráfica':      ['novela grafica', 'comic', 'comics', 'graphic novel'],
  'Biografía':           ['biografia', 'biography'],
  'Memorias':            ['memorias', 'memoir', 'memoirs'],
  'Autoayuda':           ['autoayuda', 'self help', 'self-help'],
  'No ficción':          ['no ficcion', 'nonfiction', 'non fiction'],
  'Poesía':              ['poesia', 'poetry'],
  'Drama':               ['drama'],
  'Distopía':            ['distopia', 'dystopia', 'dystopian'],
  'Realismo mágico':     ['realismo magico', 'magical realism'],
  'Crimen':              ['crimen', 'crime'],
  'Western':             ['western', 'oeste'],
  'Clásico':             ['clasico', 'classic', 'classics'],
  'Ficción':             ['ficcion', 'fiction'],
}
// Aviso corto bajo la columna cuando se mapea a Estado o Género — los dos
// campos que en el resto de Puchi son un desplegable cerrado, no texto
// libre, así que conviene avisar de qué se reconoce antes de subir.
const MAPPING_HINTS = {
  status: 'Se reconoce texto como "Leído", "Leyendo", "Por leer"/"Pendiente" o "Dropeado" (y variantes parecidas) — lo que no encaje se deja en "Por leer", editable fila a fila en el paso siguiente.',
  genre:  `Se ajusta a nuestra lista de géneros (${GENRE_OPTIONS.slice(0, 4).join(', ')}...) — lo que no encaje se deja sin género, editable fila a fila en el paso siguiente.`,
}
function mapGenreValue(raw) {
  const n = normHeader(toStr(raw))
  if (!n) return ''
  for (const [canon, aliases] of Object.entries(GENRE_ALIASES)) {
    if (n === normHeader(canon) || aliases.includes(n)) return canon
  }
  for (const [canon, aliases] of Object.entries(GENRE_ALIASES)) {
    if (aliases.some(a => n.includes(a))) return canon
  }
  return ''
}

function normKey(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

// La librería de parseo (SheetJS) pesa bastante y solo hace falta en este
// modal, así que se carga bajo demanda (import dinámico) en vez de ir en el
// bundle principal — la mayoría de sesiones en Puchi son móviles y no pasan
// por aquí nunca.
function parseSheetToTable(XLSX, wb, sheetName) {
  return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true, defval: '' })
}

// A partir de las filas ya mapeadas, construye la lista de libros con la
// misma forma que usa el resto de la vista previa/edición.
function buildRowsFromExcel(rawRows, mapping) {
  const colFor = field => {
    const entry = Object.entries(mapping).find(([, f]) => f === field)
    return entry ? parseInt(entry[0], 10) : null
  }
  const col = Object.fromEntries(TARGET_FIELDS.map(f => [f.key, colFor(f.key)]))
  return rawRows.map((r, i) => {
    const title = col.title != null ? toStr(r[col.title]) : ''
    if (!title) return null
    const rating = col.rating != null ? toNum(r[col.rating]) : null
    const isbn = col.isbn != null ? toStr(r[col.isbn]).replace(/[\s-]/g, '') : ''
    return {
      key: `xl-${i}`,
      title,
      author: col.author != null ? toStr(r[col.author]) : '',
      isbn,
      status: col.status != null ? mapStatusValue(r[col.status]) : 'want_to_read',
      rating: rating != null ? Math.min(Math.max(rating, 0), 5) : null,
      started_at: col.started_at != null ? toIsoDate(r[col.started_at]) : '',
      finished_at: col.finished_at != null ? toIsoDate(r[col.finished_at]) : '',
      dateResetSeq: 0,
      times_read: col.times_read != null ? toInt(r[col.times_read]) : null,
      year: col.year != null ? toInt(r[col.year]) : null,
      num_pages: col.num_pages != null ? toInt(r[col.num_pages]) : null,
      genre: col.genre != null ? mapGenreValue(r[col.genre]) : '',
      folder: col.folder != null ? toStr(r[col.folder]) : '',
      notes: col.notes != null ? toStr(r[col.notes]) : '',
      synopsis: col.synopsis != null ? toStr(r[col.synopsis]) : '',
      cover_url: null,
      coverStatus: 'pending', // pending | done | error — ver enrichRows
      coverSource: null, // 'isbn' | 'search' | null — de dónde salió lo completado
      coverSearchOpen: false, coverSearching: false, coverSearchResults: null,
    }
  }).filter(Boolean)
}

export default function ExcelImportModal({ onClose, onImported, shelf }) {
  const isMobile = useIsMobile()
  const [step, setStep] = useState('upload') // upload | mapping | preview
  const [dragOver, setDragOver] = useState(false)
  const [parseErr, setParseErr] = useState('')

  const [workbook, setWorkbook] = useState(null)
  const [sheetName, setSheetName] = useState('')
  const [columns, setColumns] = useState([])
  const [rawRows, setRawRows] = useState([])
  const [mapping, setMapping] = useState({}) // colIndex -> targetFieldKey

  const [rows, setRows] = useState([])
  const [included, setIncluded] = useState({}) // key -> bool
  const [expanded, setExpanded] = useState({}) // key -> bool — fila con el editor desplegado
  function toggleExpanded(key) {
    setExpanded(ex => ({ ...ex, [key]: !ex[key] }))
  }
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState(null)
  const [coverProgress, setCoverProgress] = useState(null) // { done, total } | null
  const fileInputRef = useRef(null)

  const existingIsbns = new Set(
    (shelf || []).map(e => (e.book?.isbn || '').trim()).filter(Boolean)
  )
  const existingTitleAuthor = new Set(
    (shelf || []).map(e => `${normKey(e.book?.title)}|${normKey(e.book?.author)}`)
  )
  function isDuplicate(row) {
    if (row.isbn && existingIsbns.has(row.isbn)) return true
    return existingTitleAuthor.has(`${normKey(row.title)}|${normKey(row.author)}`)
  }
  const titlesByAuthor = new Map()
  for (const e of (shelf || [])) {
    const key = normKey(e.book?.author)
    if (!key) continue
    if (!titlesByAuthor.has(key)) titlesByAuthor.set(key, [])
    titlesByAuthor.get(key).push(e.book?.title)
  }
  function sameAuthorTitles(row) {
    return titlesByAuthor.get(normKey(row.author)) || []
  }

  async function loadSheet(wb, name) {
    const XLSX = await import('xlsx')
    const table = parseSheetToTable(XLSX, wb, name)
    const dataRows = table.slice(1).filter(r => r.some(c => String(c ?? '').trim() !== ''))
    if (dataRows.length === 0) {
      setParseErr('Esta hoja está vacía.')
      return
    }
    const header = (table[0] || []).map((h, i) => String(h ?? '').trim() || `Columna ${i + 1}`)
    setSheetName(name)
    setColumns(header)
    setRawRows(dataRows)
    setMapping(guessMapping(header))
    setParseErr('')
    setStep('mapping')
  }

  async function handleFile(file) {
    if (!file) return
    setParseErr('')
    try {
      const [XLSX, buf] = await Promise.all([import('xlsx'), file.arrayBuffer()])
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true })
      if (!wb.SheetNames.length) throw new Error('El archivo no tiene ninguna hoja.')
      setWorkbook(wb)
      await loadSheet(wb, wb.SheetNames[0])
    } catch (e) {
      setParseErr(e.message || 'No se pudo leer el archivo. Asegúrate de que es un Excel (.xlsx/.xls) o un .csv válido.')
    }
  }

  // Plantilla en blanco con los nombres de columna que el mapeo reconoce
  // solo (ver templateHeader en TARGET_FIELDS) — al volver a subirla no hace
  // falta tocar nada en el paso de mapeo.
  async function downloadTemplate() {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([TARGET_FIELDS.map(f => f.templateHeader)])
    ws['!cols'] = TARGET_FIELDS.map(() => ({ wch: 20 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Mi biblioteca')
    XLSX.writeFile(wb, 'plantilla-libros.xlsx')
  }

  function setColumnMapping(colIdx, field) {
    setMapping(m => {
      const next = { ...m }
      if (!field) delete next[colIdx]
      else next[colIdx] = field
      return next
    })
  }

  function sampleFor(colIdx) {
    for (const r of rawRows) {
      const v = r[colIdx]
      if (v !== '' && v != null) return v instanceof Date ? toIsoDate(v) : String(v)
    }
    return ''
  }

  const titleMapped = Object.values(mapping).includes('title')

  function confirmMapping() {
    if (!titleMapped) return
    const built = buildRowsFromExcel(rawRows, mapping)
    const withDup = built.map(r => {
      const duplicate = isDuplicate(r)
      return { ...r, duplicate, sameAuthorTitles: duplicate ? [] : sameAuthorTitles(r) }
    })
    withDup.sort((a, b) => (a.duplicate === b.duplicate) ? 0 : (a.duplicate ? 1 : -1))
    setRows(withDup)
    setIncluded(Object.fromEntries(withDup.map(r => [r.key, !r.duplicate])))
    setStep('preview')
    enrichRows(withDup)
  }

  function patchRow(key, patch) {
    setRows(rs => rs.map(r => r.key === key ? { ...r, ...patch } : r))
  }

  // Completa cada fila contra Open Library sin pisar nada que ya venga del
  // Excel — mismo criterio que el importador de Goodreads (solo rellena lo
  // que esté vacío). Con ISBN es un lookup exacto; sin ISBN (muy habitual en
  // una hoja de cálculo personal, a diferencia del export de Goodreads que
  // casi siempre lo trae) se cae a una búsqueda por título + autor, igual
  // que "Cambiar portada" pero automática y tomando el primer resultado —
  // por eso esas filas se marcan aparte (coverSource:'search') y se avisa
  // en la propia fila para que se revise que la edición es la correcta.
  async function enrichRows(initialRows) {
    const targets = initialRows.filter(r => r.title)
    if (targets.length === 0) return
    setCoverProgress({ done: 0, total: targets.length })
    let cursor = 0
    const CONCURRENCY = 5
    async function worker() {
      while (cursor < targets.length) {
        const row = targets[cursor++]
        let b = null, source = null
        try {
          if (row.isbn) {
            const r = await fetch(`/api/books/isbn/${encodeURIComponent(row.isbn)}`, { credentials: 'include' })
            if (r.ok) { b = await r.json(); source = 'isbn' }
          }
          if (!b) {
            const q = [row.title, row.author].filter(Boolean).join(' ').trim()
            if (q.length >= 3) {
              const r = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`, { credentials: 'include' })
              if (r.ok) {
                const results = await r.json()
                if (results.length > 0) { b = results[0]; source = 'search' }
              }
            }
          }
          if (b) {
            patchRow(row.key, {
              cover_url: row.cover_url || b.cover_url || null,
              num_pages: row.num_pages || b.num_pages || null,
              year: row.year || b.year || null,
              genre: row.genre || mapGenreValue(b.genre) || '',
              coverStatus: 'done',
              coverSource: source,
            })
          } else {
            patchRow(row.key, { coverStatus: 'error' })
          }
        } catch {
          patchRow(row.key, { coverStatus: 'error' })
        }
        setCoverProgress(p => p && { ...p, done: p.done + 1 })
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  }

  async function searchCover(key) {
    const row = rows.find(r => r.key === key)
    if (!row) return
    const q = [row.title, row.author].filter(Boolean).join(' ').trim()
    if (q.length < 3) return
    patchRow(key, { coverSearchOpen: true, coverSearching: true, coverSearchResults: null })
    try {
      const r = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`, { credentials: 'include' })
      const data = r.ok ? await r.json() : []
      patchRow(key, { coverSearching: false, coverSearchResults: data })
    } catch {
      patchRow(key, { coverSearching: false, coverSearchResults: [] })
    }
  }
  function pickCover(key, book) {
    patchRow(key, { cover_url: book.cover_url || null, coverStatus: 'done', coverSearchOpen: false, coverSearchResults: null })
  }

  // A diferencia de la primera versión de "Añadir varios", aquí el cambio de
  // estado NO autorrellena la fecha de hoy — un libro que viene de una hoja
  // de cálculo personal puede llevar años terminado, e inventar una fecha es
  // peor que dejarla vacía (mismo motivo que "No recuerdo la fecha exacta").
  function changeRowStatus(key, newStatus) {
    patchRow(key, { status: newStatus })
  }

  const newCount = rows.filter(r => included[r.key]).length
  const dupCount = rows.filter(r => r.duplicate).length
  const noIsbnCount = rows.filter(r => included[r.key] && !r.isbn).length
  const showDates = st => st === 'read' || st === 'dropped'

  async function processAll() {
    setProcessing(true)
    const books = rows.filter(r => included[r.key]).map(r => ({
      title: r.title,
      author: r.author || undefined,
      isbn: r.isbn || undefined,
      num_pages: r.num_pages || undefined,
      year: r.year || undefined,
      genre: r.genre || undefined,
      folder: r.folder || undefined,
      status: r.status,
      rating: r.rating || undefined,
      started_at:  showDates(r.status) ? (r.started_at  || undefined) : undefined,
      finished_at: showDates(r.status) ? (r.finished_at || undefined) : undefined,
      times_read: r.times_read || undefined,
      notes: r.notes || undefined,
      synopsis: r.synopsis || undefined,
      cover_url: r.cover_url || undefined,
    }))
    try {
      const resp = await fetch('/api/shelf/personal/bulk', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books, origin: 'excel' }),
      })
      if (!resp.ok) { setParseErr('Error al importar — inténtalo de nuevo.'); return }
      const data = await resp.json()
      setResults(data.results)
      onImported?.()
    } finally {
      setProcessing(false)
    }
  }

  const okCount   = results?.filter(r => r.ok).length ?? 0
  const failCount = results ? results.length - okCount : 0

  const inpStyle = {
    background: C.surfaceHi, border: `1px solid ${C.border}`,
    borderRadius: 7, padding: isMobile ? '9px 10px' : '6px 8px', color: C.text,
    fontSize: isMobile ? 13 : 12, outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', minWidth: 0,
  }

  function goBack() {
    if (step === 'preview') setStep('mapping')
    else if (step === 'mapping') setStep('upload')
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      style={{
        position: 'absolute', inset: 0, zIndex: 100,
        background: 'rgba(15,10,6,0.75)', backdropFilter: 'blur(4px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start',
        padding: isMobile ? '32px 8px 8px' : '44px 16px 16px',
      }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.15 } }}
        transition={{ type: 'spring', damping: 24, stiffness: 320 }}
        style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 16, width: '100%', maxWidth: 720,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '100%', overflow: 'hidden',
        }}>
        {/* Cabecera */}
        <div style={{
          padding: isMobile ? '14px 16px' : '13px 16px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        }}>
          {(step === 'mapping' || step === 'preview') && !results && (
            <button onClick={goBack} title="Volver" style={{
              background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center',
            }}>
              <IconBack color={C.muted} />
            </button>
          )}
          <span style={{ fontSize: isMobile ? 15 : 13, color: C.text, fontWeight: 600, flex: 1 }}>
            Importar desde Excel
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: C.muted, cursor: 'pointer',
            fontSize: isMobile ? 22 : 18, lineHeight: 1, padding: isMobile ? '6px 8px' : '0 2px',
          }}>×</button>
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '14px' : 16, display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 12 }}>

          {step === 'upload' && (<>
            <div style={{
              background: C.surfaceHi, border: `1px solid ${C.border}`, borderRadius: 12,
              padding: isMobile ? 14 : 12, display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <p style={{ fontSize: isMobile ? 13.5 : 12, color: C.text, fontWeight: 600, margin: 0 }}>
                Cómo funciona
              </p>
              <ol style={{ margin: 0, paddingLeft: 18, listStyle: 'decimal', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  'Sube tu Excel (o .csv) tal cual lo tengas, con las columnas que quieras y en el orden que quieras.',
                  'Te preguntamos qué columna es el título, cuál el autor, etc. Solo el título es obligatorio — el resto lo puedes dejar sin mapear.',
                  'Revisa la lista antes de importar: puedes editar, quitar filas o corregir cualquier dato fila por fila.',
                ].map((s, i) => (
                  <li key={i} style={{ fontSize: isMobile ? 13 : 12, color: C.sub, lineHeight: 1.5 }}>{s}</li>
                ))}
              </ol>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              background: C.surfaceHi, border: `1px solid ${C.border}`, borderRadius: 12,
              padding: isMobile ? '12px 14px' : '10px 12px',
            }}>
              <p style={{ fontSize: isMobile ? 12.5 : 11.5, color: C.sub, margin: 0, flex: '1 1 200px' }}>
                ¿Empiezas de cero? Descarga una plantilla en blanco con los nombres de columna que reconocemos — al subirla luego, el mapeo se hace solo.
              </p>
              <button onClick={downloadTemplate} style={{
                display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
                padding: isMobile ? '9px 12px' : '6px 10px', color: C.text, cursor: 'pointer',
                fontSize: isMobile ? 12.5 : 11.5, fontWeight: 600,
              }}>
                <IconDownload size={12} color={C.text} />
                Descargar plantilla
              </button>
            </div>

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]) }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `1.5px dashed ${dragOver ? C.accent : C.border}`,
                background: dragOver ? C.accentBg : 'transparent',
                borderRadius: 12, padding: isMobile ? '28px 14px' : '32px 16px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
              <IconUpload size={isMobile ? 24 : 22} color={dragOver ? C.accent : C.muted} />
              <p style={{ fontSize: isMobile ? 13.5 : 12.5, color: C.sub, margin: 0, textAlign: 'center' }}>
                Arrastra aquí tu Excel (.xlsx, .xls o .csv), o toca para elegirlo
              </p>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0])} />
            </div>

            {parseErr && <p style={{ fontSize: isMobile ? 13.5 : 12, color: '#ef4444', margin: 0 }}>{parseErr}</p>}
          </>)}

          {step === 'mapping' && (<>
            {workbook && workbook.SheetNames.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: isMobile ? 13 : 12, color: C.sub }}>Hoja:</span>
                <select value={sheetName} onChange={e => loadSheet(workbook, e.target.value)}
                  style={{ ...inpStyle, cursor: 'pointer', colorScheme: 'dark' }}>
                  {workbook.SheetNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}

            <p style={{ fontSize: isMobile ? 12.5 : 11.5, color: C.muted, margin: 0 }}>
              {columns.length} columnas detectadas, {rawRows.length} filas. Elige a qué dato corresponde cada columna — el título es obligatorio, el resto es opcional.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {columns.map((colName, i) => {
                const usedElsewhere = new Set(Object.entries(mapping).filter(([ci]) => parseInt(ci, 10) !== i).map(([, f]) => f))
                const sample = sampleFor(i)
                const hint = MAPPING_HINTS[mapping[i]]
                return (
                  <div key={i} style={{
                    border: `1px solid ${C.border}`, borderRadius: 10,
                    padding: isMobile ? 10 : 8, display: 'flex', flexDirection: 'column', gap: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: isMobile ? 13.5 : 12.5, color: C.text, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {colName}
                        </p>
                        {sample && (
                          <p style={{ fontSize: isMobile ? 11.5 : 10.5, color: C.muted, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Ej.: {sample}
                          </p>
                        )}
                      </div>
                      <select value={mapping[i] || ''} onChange={e => setColumnMapping(i, e.target.value)}
                        style={{ ...inpStyle, cursor: 'pointer', colorScheme: 'dark', flex: '0 0 auto', minWidth: isMobile ? 140 : 170 }}>
                        <option value="">No importar</option>
                        {TARGET_FIELDS.map(f => (
                          <option key={f.key} value={f.key} disabled={usedElsewhere.has(f.key)}>
                            {f.label}{f.required ? ' *' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    {hint && (
                      <p style={{ fontSize: isMobile ? 11.5 : 10.5, color: C.muted, margin: 0 }}>{hint}</p>
                    )}
                  </div>
                )
              })}
            </div>

            {!titleMapped && (
              <p style={{ fontSize: isMobile ? 13 : 12, color: C.accent, margin: 0 }}>
                Selecciona qué columna es el <strong>Título</strong> para continuar.
              </p>
            )}
            {parseErr && <p style={{ fontSize: isMobile ? 13.5 : 12, color: '#ef4444', margin: 0 }}>{parseErr}</p>}
          </>)}

          {step === 'preview' && !results && (<>
            <button onClick={() => setStep('mapping')} style={{
              alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: 'none', padding: 0,
              color: C.accent, cursor: 'pointer', fontSize: isMobile ? 13 : 12, fontWeight: 600,
            }}>
              <IconBack size={11} color={C.accent} /> Volver a mapear columnas
            </button>

            <p style={{ fontSize: isMobile ? 12.5 : 11.5, color: C.muted, margin: 0 }}>
              {rows.length} libros en el archivo · {dupCount} ya en tu estantería (omitidos por defecto) · {noIsbnCount} sin ISBN entre los seleccionados
            </p>

            {coverProgress && coverProgress.done < coverProgress.total && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: C.accentBg, border: `1px solid ${C.accentBd}`, borderRadius: 9,
                padding: isMobile ? '9px 12px' : '7px 10px',
              }}>
                <IconSpinner size={13} color={C.accent} />
                <span style={{ fontSize: isMobile ? 12.5 : 11.5, color: C.accent }}>
                  Completando portadas y datos… {coverProgress.done}/{coverProgress.total}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map(row => (
                <div key={row.key} style={{
                  border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: isMobile ? 10 : 8, display: 'flex', flexDirection: 'column', gap: 6,
                  opacity: included[row.key] ? 1 : 0.5,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <input type="checkbox" checked={!!included[row.key]}
                      onChange={e => setIncluded(inc => ({ ...inc, [row.key]: e.target.checked }))}
                      style={{ marginTop: 3, flexShrink: 0 }} />
                    <div style={{
                      width: 30, height: 44, borderRadius: 4, flexShrink: 0, overflow: 'hidden',
                      background: C.surfaceHi, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {row.cover_url
                        ? <img src={row.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : row.coverStatus === 'pending'
                          ? <IconSpinner size={13} color={C.muted} />
                          : <IconBookPlaceholder size={14} color={C.muted} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: isMobile ? 13.5 : 12.5, color: C.text, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.title}
                      </p>
                      <p style={{ fontSize: isMobile ? 12 : 11, color: C.sub, margin: 0 }}>
                        {STATUS_LABEL[row.status]}{row.author ? ` · ${row.author}` : ''}{row.year ? ` · ${row.year}` : ''}{row.num_pages ? ` · ${row.num_pages} pág.` : ''}{row.rating ? ` · ★ ${row.rating}` : ''}
                      </p>
                    </div>
                    <button onClick={() => toggleExpanded(row.key)} title="Editar libro" style={{
                      background: expanded[row.key] ? C.accentBg : 'transparent',
                      border: 'none', borderRadius: 7, width: 28, height: 28, flexShrink: 0,
                      color: expanded[row.key] ? C.accent : C.muted, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <IconEdit size={13} color={expanded[row.key] ? C.accent : C.muted} />
                    </button>
                  </div>
                  {(row.duplicate || !row.isbn) && (
                    <p style={{ fontSize: isMobile ? 11.5 : 10.5, color: row.coverSource === 'search' ? C.accent : C.muted, margin: '0 0 0 26px' }}>
                      {row.duplicate && 'Ya está en tu estantería. '}
                      {!row.isbn && row.coverStatus === 'pending' && 'Sin ISBN — buscando coincidencia por título y autor…'}
                      {!row.isbn && row.coverStatus !== 'pending' && row.coverSource === 'search' && 'Sin ISBN — portada y algún dato que faltaba sugeridos por búsqueda de título/autor; revisa que sea la edición correcta.'}
                      {!row.isbn && row.coverStatus !== 'pending' && row.coverSource !== 'search' && 'Sin ISBN — no se encontró ninguna coincidencia; se guardará solo con lo que hayas rellenado.'}
                    </p>
                  )}
                  {row.sameAuthorTitles?.length > 0 && (
                    <p style={{ fontSize: isMobile ? 11.5 : 10.5, color: C.accent, margin: '0 0 0 26px' }}>
                      Ya tienes de {row.author}: «{row.sameAuthorTitles.slice(0, 2).join('», «')}»
                      {row.sameAuthorTitles.length > 2 && ` y ${row.sameAuthorTitles.length - 2} más`}
                      {' '}— revisa si es la misma obra en otra edición.
                    </p>
                  )}
                  <AnimatePresence initial={false}>
                    {expanded[row.key] && (
                      <motion.div key="edit" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18, ease: 'easeInOut' }} style={{ overflow: 'hidden' }}>
                        <div style={{
                          display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 26,
                          paddingTop: 8, marginTop: 2, borderTop: `1px solid ${C.border}`,
                        }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <div style={{
                              width: 46, height: 66, borderRadius: 5, flexShrink: 0, overflow: 'hidden',
                              background: C.surfaceHi, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {row.cover_url
                                ? <img src={row.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : row.coverStatus === 'pending'
                                  ? <IconSpinner size={16} color={C.muted} />
                                  : <IconBookPlaceholder size={18} color={C.muted} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                              <button onClick={() => searchCover(row.key)} disabled={row.coverSearching} style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                background: C.surfaceHi, border: 'none', borderRadius: 8,
                                padding: isMobile ? '9px 12px' : '6px 10px', color: C.sub, cursor: 'pointer',
                                fontSize: isMobile ? 12.5 : 11.5, fontWeight: 600,
                                opacity: row.coverSearching ? 0.6 : 1,
                              }}>
                                {row.coverSearching ? <IconSpinner size={11} color={C.sub} /> : <IconSearch size={11} color={C.sub} />}
                                Cambiar portada
                              </button>
                              {row.coverSearchOpen && row.coverSearchResults && (
                                <div style={{
                                  marginTop: 6, background: C.surfaceHi, border: `1px solid ${C.border}`,
                                  borderRadius: 8, overflow: 'hidden', maxHeight: 200, overflowY: 'auto',
                                }}>
                                  {row.coverSearchResults.length === 0 && (
                                    <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <span style={{ fontSize: 11.5, color: C.muted }}>Sin resultados.</span>
                                      <button onClick={() => patchRow(row.key, { coverSearchOpen: false })} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 14 }}>×</button>
                                    </div>
                                  )}
                                  {row.coverSearchResults.map((b, bi) => (
                                    <button key={bi} onClick={() => pickCover(row.key, b)} style={{
                                      width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                                      background: 'transparent', border: 'none',
                                      borderBottom: bi < row.coverSearchResults.length - 1 ? `1px solid ${C.border}` : 'none',
                                      cursor: 'pointer', textAlign: 'left',
                                    }}
                                      onMouseEnter={e => e.currentTarget.style.background = C.accentBg}
                                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                      <div style={{ width: 22, height: 32, borderRadius: 4, flexShrink: 0, overflow: 'hidden', background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {b.cover_url ? <img src={b.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IconBookPlaceholder size={12} color={C.muted} />}
                                      </div>
                                      <div style={{ minWidth: 0 }}>
                                        <p style={{ fontSize: 11.5, color: C.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{b.title}</p>
                                        <p style={{ fontSize: 10, color: C.sub, margin: 0 }}>{b.author}{b.year ? ` · ${b.year}` : ''}</p>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <input value={row.title} onChange={e => patchRow(row.key, { title: e.target.value })}
                              placeholder="Título" style={{ ...inpStyle, flex: '2 1 140px' }} />
                            <input value={row.author} onChange={e => patchRow(row.key, { author: e.target.value })}
                              placeholder="Autor" style={{ ...inpStyle, flex: '1 1 100px' }} />
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <input type="number" value={row.year ?? ''} onChange={e => patchRow(row.key, { year: e.target.value ? parseInt(e.target.value, 10) : null })}
                              placeholder="Año" style={{ ...inpStyle, flex: '1 1 70px' }} />
                            <input type="number" min="1" value={row.num_pages ?? ''} onChange={e => patchRow(row.key, { num_pages: e.target.value ? parseInt(e.target.value, 10) : null })}
                              placeholder="Páginas" style={{ ...inpStyle, flex: '1 1 70px' }} />
                            <input value={row.isbn} onChange={e => patchRow(row.key, { isbn: e.target.value.trim() })}
                              placeholder="ISBN" style={{ ...inpStyle, flex: '1.4 1 120px' }} />
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <select value={row.genre} onChange={e => patchRow(row.key, { genre: e.target.value })}
                              style={{ ...inpStyle, cursor: 'pointer', colorScheme: 'dark', flex: '1 1 100px' }}>
                              <option value="">Sin género</option>
                              {GENRE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                            <input value={row.folder} onChange={e => patchRow(row.key, { folder: e.target.value })}
                              placeholder="Carpeta" style={{ ...inpStyle, flex: '1 1 100px' }} />
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <select value={row.status} onChange={e => changeRowStatus(row.key, e.target.value)}
                              style={{ ...inpStyle, cursor: 'pointer', colorScheme: 'dark', flex: '1 1 100px' }}>
                              {STATUS_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                            </select>
                            <input type="number" min="0" max="5" step="0.5" value={row.rating ?? ''}
                              onChange={e => patchRow(row.key, { rating: e.target.value ? parseFloat(e.target.value) : null })}
                              placeholder="Puntuación (0-5)" style={{ ...inpStyle, flex: '1 1 100px' }} />
                            <input type="number" min="0" value={row.times_read ?? ''}
                              onChange={e => patchRow(row.key, { times_read: e.target.value ? parseInt(e.target.value, 10) : null })}
                              placeholder="Veces leído" style={{ ...inpStyle, flex: '1 1 90px' }} />
                          </div>
                          {showDates(row.status) && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div>
                                <p style={{ fontSize: 11, color: C.muted, margin: '0 0 4px' }}>Fecha de inicio</p>
                                <CustomDateInput key={`start-${row.dateResetSeq}`} value={row.started_at}
                                  onChange={v => patchRow(row.key, { started_at: v })} />
                              </div>
                              <div>
                                <p style={{ fontSize: 11, color: C.muted, margin: '0 0 4px' }}>Fecha de fin</p>
                                <CustomDateInput key={`end-${row.dateResetSeq}`} value={row.finished_at}
                                  onChange={v => patchRow(row.key, { finished_at: v })} />
                              </div>
                              {(row.started_at || row.finished_at) && (
                                <button onClick={() => patchRow(row.key, { started_at: '', finished_at: '', dateResetSeq: row.dateResetSeq + 1 })}
                                  style={{
                                    alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6,
                                    background: C.surfaceHi, border: `1px solid ${C.border}`, borderRadius: 8,
                                    padding: isMobile ? '9px 12px' : '6px 10px', color: C.muted, fontSize: isMobile ? 12.5 : 11.5, fontWeight: 600, cursor: 'pointer',
                                  }}>
                                  <IconCalendarOff size={13} color={C.muted} />
                                  No recuerdo la fecha exacta
                                </button>
                              )}
                            </div>
                          )}
                          <textarea value={row.synopsis || ''} onChange={e => patchRow(row.key, { synopsis: e.target.value })}
                            placeholder="Sinopsis" rows={2} style={{ ...inpStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                          <textarea value={row.notes || ''} onChange={e => patchRow(row.key, { notes: e.target.value })}
                            placeholder="Notas" rows={2} style={{ ...inpStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                          <button onClick={() => toggleExpanded(row.key)} style={{
                            alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6,
                            background: C.surfaceHi, border: 'none', borderRadius: 8,
                            padding: isMobile ? '9px 12px' : '6px 10px', color: C.sub, cursor: 'pointer',
                            fontSize: isMobile ? 12.5 : 11.5, fontWeight: 600,
                          }}>
                            <IconCheck size={11} color={C.sub} /> Listo
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            {parseErr && <p style={{ fontSize: isMobile ? 13.5 : 12, color: '#ef4444', margin: 0 }}>{parseErr}</p>}
          </>)}

          {results && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 6 }}>
              <p style={{ fontSize: isMobile ? 13.5 : 12, fontWeight: 600, color: C.text, margin: 0 }}>
                {okCount} importado{okCount === 1 ? '' : 's'}{failCount > 0 && `, ${failCount} con error`}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 6 : 4, maxHeight: 220, overflowY: 'auto' }}>
                {results.map(r => (
                  <div key={r.index} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: isMobile ? 13 : 11.5 }}>
                    {r.ok
                      ? <span style={{ color: C.read, flexShrink: 0, marginTop: 2 }}><IconCheck color={C.read} /></span>
                      : <span style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }}><IconX color="#ef4444" /></span>}
                    <span style={{ color: r.ok ? C.text : '#ef4444' }}>
                      {r.title}{!r.ok && r.error && <span style={{ color: C.sub }}> — {r.error}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div style={{ padding: isMobile ? 14 : 16, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{
            background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 9,
            padding: isMobile ? '11px 18px' : '8px 16px', color: C.sub, cursor: 'pointer', fontSize: isMobile ? 14 : 13,
            flex: isMobile ? 1 : undefined,
          }}>
            {results ? 'Cerrar' : 'Cancelar'}
          </button>
          {step === 'mapping' && (
            <button onClick={confirmMapping} disabled={!titleMapped} style={{
              background: C.accent, border: 'none', borderRadius: 9,
              padding: isMobile ? '11px 18px' : '8px 16px', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: isMobile ? 14 : 13,
              opacity: titleMapped ? 1 : 0.6, flex: isMobile ? 1 : undefined,
            }}>
              Continuar
            </button>
          )}
          {step === 'preview' && !results && (
            <button onClick={processAll} disabled={processing || newCount === 0} style={{
              background: C.accent, border: 'none', borderRadius: 9,
              padding: isMobile ? '11px 18px' : '8px 16px', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: isMobile ? 14 : 13,
              opacity: (processing || newCount === 0) ? 0.6 : 1, flex: isMobile ? 1 : undefined,
            }}>
              {processing ? 'Importando…' : `Importar ${newCount} libro${newCount === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
