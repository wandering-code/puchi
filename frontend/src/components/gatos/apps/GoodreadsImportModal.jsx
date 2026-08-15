import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useIsMobile } from '../../../utils/responsive'
import { C } from './lunitecaTheme'

// Igual que en BulkAddModal.jsx — un <input type="date"> nativo nunca se
// arregló en Safari de iOS (el recuadro se salía del borde derecho de la
// pantalla), así que las fechas se editan con tres <select> (día/mes/año)
// en vez del control nativo del navegador.
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
// Marcador genérico para libros sin portada (mismo trazo que IconShelf en
// LunitecaV2.jsx, para que el hueco no desentone con el resto de la app).
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
]
const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS)

const SHELF_STATUS = { 'read': 'read', 'currently-reading': 'reading', 'to-read': 'want_to_read' }

// Parser RFC4180 compacto — el export de Goodreads viene con comillas bien
// formadas (campos con comas, comillas dobles escapadas como "", saltos de
// línea dentro de un campo citado como en "My Review"), así que no hace
// falta ninguna librería para esto.
function parseCSV(text) {
  const rows = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field); field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

// El ISBN/ISBN13 de Goodreads viene escapado para que Excel no lo trate
// como número: ="8417956409" (o ="" si está vacío).
function cleanIsbn(v) {
  let s = (v || '').trim()
  if (s.startsWith('="')) s = s.slice(2)
  if (s.endsWith('"')) s = s.slice(0, -1)
  return s.trim()
}

// "2024/01/16" → "2024-01-16"
function convertDate(v) {
  const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec((v || '').trim())
  return m ? `${m[1]}-${m[2]}-${m[3]}` : ''
}

function normKey(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

// Goodreads pega el nombre de la saga al título — "Brazales de duelo
// (Nacidos de la bruma, #6)" — pero en Luniteca los libros se guardan con
// el título limpio (los añadidos a mano o vía Open Library nunca llevan
// esa coletilla). Sin quitarla, ni el deduplicado ni futuras reimportaciones
// reconocen un libro de una saga que ya está en la estantería. Solo se
// recorta un paréntesis final que contenga "#<número>" — eso es específico
// del marcador de saga de Goodreads, no de subtítulos reales como
// "(Spanish Edition)".
function stripSeriesSuffix(title) {
  return (title || '').replace(/\s*\([^()]*#\d+[^()]*\)\s*$/, '').trim()
}

function parseGoodreadsCsv(text) {
  const table = parseCSV(text)
  if (table.length < 2) throw new Error('El archivo está vacío.')
  const header = table[0].map(h => h.trim())
  if (!header.includes('Title') || !header.includes('Exclusive Shelf')) {
    throw new Error('Este archivo no parece un export de Goodreads (goodreads.com/review/import).')
  }
  const idx = Object.fromEntries(header.map((h, i) => [h, i]))
  const get = (r, name) => (idx[name] != null ? (r[idx[name]] || '').trim() : '')

  return table.slice(1).filter(r => r.length > 1 || r[0]).map((r, i) => {
    const title  = stripSeriesSuffix(get(r, 'Title'))
    const author = get(r, 'Author')
    const isbn13 = cleanIsbn(get(r, 'ISBN13'))
    const isbn10 = cleanIsbn(get(r, 'ISBN'))
    const shelf  = get(r, 'Exclusive Shelf')
    const status = SHELF_STATUS[shelf] || 'want_to_read'
    const ratingRaw = parseFloat(get(r, 'My Rating'))
    const readCount = parseInt(get(r, 'Read Count'), 10)
    const year = parseInt(get(r, 'Original Publication Year') || get(r, 'Year Published'), 10)
    const numPages = parseInt(get(r, 'Number of Pages'), 10)
    const isbn = isbn13 || isbn10 || ''
    return {
      key: `gr-${i}`,
      title, author,
      isbn,
      status,
      shelfNote: (shelf && !SHELF_STATUS[shelf]) ? shelf : '',
      rating: Number.isFinite(ratingRaw) && ratingRaw > 0 ? ratingRaw : null,
      started_at: '', // Goodreads no exporta fecha de inicio de lectura, solo la de fin
      finished_at: convertDate(get(r, 'Date Read')),
      dateResetSeq: 0, // ver "No recuerdo la fecha exacta" — fuerza a CustomDateInput a resincronizar
      times_read: Number.isFinite(readCount) && readCount > 0 ? readCount : null,
      year: Number.isFinite(year) ? year : null,
      num_pages: Number.isFinite(numPages) ? numPages : null,
      // El CSV de Goodreads no trae portada — se busca aparte por ISBN
      // después de mostrar la vista previa (ver enrichCovers), para no
      // bloquear la lista con cientos de peticiones antes de poder tocarla.
      cover_url: null,
      coverStatus: isbn ? 'pending' : 'done', // pending | done | error
      coverSearchOpen: false, coverSearching: false, coverSearchResults: null,
    }
  }).filter(b => b.title)
}

export default function GoodreadsImportModal({ onClose, onImported, shelf }) {
  const isMobile = useIsMobile()
  const [step, setStep] = useState('upload') // upload | preview
  const [dragOver, setDragOver] = useState(false)
  const [parseErr, setParseErr] = useState('')
  const [rows, setRows] = useState([])
  const [included, setIncluded] = useState({}) // key -> bool
  const [expanded, setExpanded] = useState({}) // key -> bool — fila con el editor desplegado
  function toggleExpanded(key) {
    setExpanded(ex => ({ ...ex, [key]: !ex[key] }))
  }
  const [includeDates,   setIncludeDates]   = useState(true)
  const [includeRatings, setIncludeRatings] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState(null)
  const [coverProgress, setCoverProgress] = useState(null) // { done, total } | null = no hay nada pendiente
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

  // Un título en otro idioma (p.ej. "The Name of the Wind" vs "El nombre del
  // viento") no comparte ni una palabra con su traducción, así que no hay
  // forma fiable de detectarlo por texto — en vez de perseguir eso, se avisa
  // cuando el autor de una fila "nueva" ya tiene algo en la estantería, para
  // que sea la propia persona quien confirme de un vistazo si es la misma
  // obra en otra edición o de verdad un libro distinto.
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

  function handleFile(file) {
    if (!file) return
    setParseErr('')
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = parseGoodreadsCsv(String(reader.result))
        const withDup = parsed.map(r => {
          const duplicate = isDuplicate(r)
          return { ...r, duplicate, sameAuthorTitles: duplicate ? [] : sameAuthorTitles(r) }
        })
        // Los que no tienes ya en la estantería son los que hay que revisar
        // y confirmar — van primero. El resto (ya en tu estantería) al
        // final, para que no haya que bajar por la lista para llegar a lo
        // importante. Sort estable: dentro de cada grupo se respeta el
        // orden del CSV.
        withDup.sort((a, b) => (a.duplicate === b.duplicate) ? 0 : (a.duplicate ? 1 : -1))
        setRows(withDup)
        setIncluded(Object.fromEntries(withDup.map(r => [r.key, !r.duplicate])))
        setStep('preview')
        enrichCovers(withDup)
      } catch (e) {
        setParseErr(e.message || 'No se pudo leer el archivo.')
      }
    }
    reader.onerror = () => setParseErr('No se pudo leer el archivo.')
    reader.readAsText(file, 'utf-8')
  }

  function patchRow(key, patch) {
    setRows(rs => rs.map(r => r.key === key ? { ...r, ...patch } : r))
  }

  // Busca la portada de cada fila con ISBN contra Open Library, igual que ya
  // hace el escáner de código de barras de "Añadir varios" — el CSV de
  // Goodreads no trae ninguna imagen. Se lanza justo después de mostrar la
  // vista previa (no bloquea la pantalla) con varias peticiones en paralelo,
  // así que una librería de cientos de libros tarda unos segundos en
  // completarse del todo pero es usable desde el primer instante.
  async function enrichCovers(initialRows) {
    const targets = initialRows.filter(r => r.isbn)
    if (targets.length === 0) return
    setCoverProgress({ done: 0, total: targets.length })
    let cursor = 0
    const CONCURRENCY = 5
    async function worker() {
      while (cursor < targets.length) {
        const row = targets[cursor++]
        try {
          const r = await fetch(`/api/books/isbn/${encodeURIComponent(row.isbn)}`, { credentials: 'include' })
          if (r.ok) {
            const b = await r.json()
            patchRow(row.key, {
              cover_url: b.cover_url || null,
              num_pages: row.num_pages || b.num_pages || null,
              year: row.year || b.year || null,
              coverStatus: 'done',
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

  // Buscar/cambiar portada a mano — mismo endpoint y patrón que la lupa de
  // cada fila en "Añadir varios" (BulkAddModal): busca por título + autor y
  // deja elegir un resultado, que sustituye solo la portada de la fila.
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

  // Igual que en BulkAddModal: al marcar "Leído" se rellenan hoy como fecha
  // de inicio y fin si aún no había ninguna puesta.
  function changeRowStatus(key, newStatus) {
    const today = new Date().toISOString().slice(0, 10)
    setRows(rs => rs.map(r => r.key === key ? {
      ...r,
      status: newStatus,
      started_at:  newStatus === 'read' ? (r.started_at  || today) : r.started_at,
      finished_at: newStatus === 'read' ? (r.finished_at || today) : r.finished_at,
    } : r))
  }

  const newCount = rows.filter(r => included[r.key]).length
  const dupCount = rows.filter(r => r.duplicate).length
  const noIsbnCount = rows.filter(r => included[r.key] && !r.isbn).length

  async function processAll() {
    setProcessing(true)
    const books = rows.filter(r => included[r.key]).map(r => ({
      title: r.title,
      author: r.author || undefined,
      isbn: r.isbn || undefined,
      num_pages: r.num_pages || undefined,
      year: r.year || undefined,
      status: r.status,
      rating: includeRatings && r.rating ? r.rating : undefined,
      started_at:  includeDates && r.status === 'read' ? (r.started_at  || undefined) : undefined,
      finished_at: includeDates && r.status === 'read' ? (r.finished_at || undefined) : undefined,
      times_read: r.times_read || undefined,
      notes: r.notes || undefined,
      cover_url: r.cover_url || undefined,
    }))
    try {
      const resp = await fetch('/api/shelf/personal/bulk', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books, origin: 'goodreads' }),
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
          {step === 'preview' && !results && (
            <button onClick={() => setStep('upload')} title="Volver" style={{
              background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center',
            }}>
              <IconBack color={C.muted} />
            </button>
          )}
          <span style={{ fontSize: isMobile ? 15 : 13, color: C.text, fontWeight: 600, flex: 1 }}>
            Importar desde Goodreads
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
                Cómo descargar tu biblioteca de Goodreads
              </p>
              <ol style={{ margin: 0, paddingLeft: 18, listStyle: 'decimal', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  'Entra en Goodreads y abre tu perfil.',
                  <>Ve a <strong>Configuración de la cuenta</strong> → <strong>Importar y exportar</strong> (o directamente a <em>goodreads.com/review/import</em>).</>,
                  'Pulsa "Export Library" y espera a que se genere el archivo.',
                  'Descarga el .csv y súbelo aquí abajo.',
                ].map((step, i) => (
                  <li key={i} style={{ fontSize: isMobile ? 13 : 12, color: C.sub, lineHeight: 1.5 }}>{step}</li>
                ))}
              </ol>
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
                Arrastra aquí tu <strong>goodreads_library_export.csv</strong>, o toca para elegirlo
              </p>
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files?.[0])} />
            </div>

            {parseErr && <p style={{ fontSize: isMobile ? 13.5 : 12, color: '#ef4444', margin: 0 }}>{parseErr}</p>}
          </>)}

          {step === 'preview' && !results && (<>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: isMobile ? 13 : 12, color: C.sub, cursor: 'pointer' }}>
                <input type="checkbox" checked={includeDates} onChange={e => setIncludeDates(e.target.checked)} />
                Importar fechas de lectura
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: isMobile ? 13 : 12, color: C.sub, cursor: 'pointer' }}>
                <input type="checkbox" checked={includeRatings} onChange={e => setIncludeRatings(e.target.checked)} />
                Importar puntuaciones
              </label>
            </div>

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
                  Buscando portadas… {coverProgress.done}/{coverProgress.total}
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
                  {(row.duplicate || row.shelfNote || !row.isbn) && (
                    <p style={{ fontSize: isMobile ? 11.5 : 10.5, color: C.muted, margin: '0 0 0 26px' }}>
                      {row.duplicate && 'Ya está en tu estantería. '}
                      {row.shelfNote && `Estante de Goodreads: "${row.shelfNote}". `}
                      {!row.isbn && 'Sin ISBN — se guardará solo con el título y el autor.'}
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
                            <select value={row.status} onChange={e => changeRowStatus(row.key, e.target.value)}
                              style={{ ...inpStyle, cursor: 'pointer', colorScheme: 'dark', flex: '1 1 100px' }}>
                              {STATUS_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                            </select>
                            <input type="number" min="0" max="5" step="0.5" value={row.rating ?? ''}
                              onChange={e => patchRow(row.key, { rating: e.target.value ? parseFloat(e.target.value) : null })}
                              placeholder="Puntuación (0-5)" style={{ ...inpStyle, flex: '1 1 100px' }} />
                          </div>
                          {row.status === 'read' && (
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
