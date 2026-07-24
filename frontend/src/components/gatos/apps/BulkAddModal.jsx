import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { C } from './lunitecaTheme'
import BarcodeScannerModal from './BarcodeScannerModal'

let _rowId = 1
function newRow(title = '') {
  return {
    key: _rowId++,
    title, author: '', status: 'want_to_read',
    started_at: '', finished_at: '',  // solo se piden/usan si status es "read"
    matched: null,        // { open_lib_key, cover_url, isbn, num_pages, year, genre } una vez encontrado
    searching: false,
    searchResults: null,  // null = no buscado · [] = sin resultados · [...] = candidatos
  }
}

function IconSearch({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <circle cx="6" cy="6" r="4.2" stroke={color} strokeWidth="1.4" />
      <line x1="9.2" y1="9.2" x2="12.5" y2="12.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
function IconTrash({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M2.5 3.5h7M4.5 3.5V2.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M4.8 3.5l.3 6.5a1 1 0 0 0 1 1h.8a1 1 0 0 0 1-1l.3-6.5"
        stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconPlus({ size = 12, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M6 1.5v9M1.5 6h9" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
function IconCamera({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M1.5 4.5a1 1 0 0 1 1-1h1.3l.6-1h5.2l.6 1h1.3a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-6z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="7" cy="7.5" r="2" stroke={color} strokeWidth="1.2" />
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

const STATUS_OPTIONS = [
  ['want_to_read', 'Por leer'],
  ['reading',      'Leyendo'],
  ['read',         'Leído'],
]

export default function BulkAddModal({ onClose, onImported }) {
  const [rows, setRows] = useState([newRow()])
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState(null) // null | [{index, ok, title, error}]
  const [formErr, setFormErr] = useState('')
  // Solo una fila puede tener el desplegable de resultados abierto a la vez.
  const [openSearchKey, setOpenSearchKey] = useState(null)
  const [showScanner,   setShowScanner]   = useState(false)
  const [scanFeedback,  setScanFeedback]  = useState('')
  const [scanCount,     setScanCount]     = useState(0)

  // Un código de barras es un ISBN exacto — lookup dedicado (no la búsqueda
  // de texto libre que usa la lupa de cada fila) para no fallar cuando el
  // ISBN solo no basta como consulta de texto. Cada escaneo bueno añade una
  // fila ya encontrada (o reutiliza la primera si sigue en blanco, para no
  // dejar una fila vacía delante de la primera escaneada), lista para
  // retocar estado/fechas antes de "Procesar todo" — la cámara se queda
  // abierta para seguir escaneando el siguiente.
  async function handleScan(isbn) {
    // Volver a leer el mismo código (típico si la cámara lo reconoce dos
    // veces seguidas, o si simplemente ya se escaneó antes) no debe meterlo
    // dos veces en la lista.
    if (rows.some(r => r.matched?.isbn === isbn)) {
      setScanFeedback(`Ya está en la lista: ${rows.find(r => r.matched?.isbn === isbn).title}`)
      return
    }
    setScanFeedback(`Buscando ${isbn}…`)
    try {
      const r = await fetch(`/api/books/isbn/${encodeURIComponent(isbn)}`, { credentials: 'include' })
      if (!r.ok) { setScanFeedback(`ISBN ${isbn} no encontrado`); return }
      const book = await r.json()
      setRows(rs => {
        // Puede haberse escaneado otra vez mientras la petición estaba en
        // vuelo — comprobarlo también aquí, contra el estado más reciente.
        if (rs.some(r2 => r2.matched?.isbn === isbn)) return rs
        const blank = rs.length === 1 && !rs[0].title.trim() && !rs[0].matched
        const row = { ...newRow(book.title), author: book.author || '', matched: book }
        return blank ? [row] : [...rs, row]
      })
      setScanCount(c => c + 1)
      setScanFeedback(`Añadido: ${book.title}`)
    } catch {
      setScanFeedback('Error al buscar el ISBN — comprueba la conexión.')
    }
  }

  function patchRow(key, patch) {
    setRows(rs => rs.map(r => r.key === key ? { ...r, ...patch } : r))
  }
  function addRow() {
    setRows(rs => [...rs, newRow()])
  }
  function removeRow(key) {
    setRows(rs => rs.length > 1 ? rs.filter(r => r.key !== key) : [newRow()])
  }

  // Pegar una lista de títulos (uno por línea) en cualquier campo de título
  // reparte las líneas en filas nuevas, en vez de meterlas todas en una.
  function onTitlePaste(key, e) {
    const text = e.clipboardData.getData('text')
    if (!text.includes('\n')) return
    e.preventDefault()
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    setRows(rs => {
      const idx = rs.findIndex(r => r.key === key)
      if (idx === -1) return rs
      const updated = { ...rs[idx], title: lines[0] }
      const newRows = lines.slice(1).map(l => newRow(l))
      return [...rs.slice(0, idx), updated, ...newRows, ...rs.slice(idx + 1)]
    })
  }

  async function searchRow(key) {
    const row = rows.find(r => r.key === key)
    if (!row) return
    const q = [row.title, row.author].filter(Boolean).join(' ').trim()
    setOpenSearchKey(key) // abrir esta cierra cualquier otro desplegable abierto
    if (q.length < 3) { patchRow(key, { searchResults: [] }); return }
    patchRow(key, { searching: true, searchResults: null })
    try {
      const r = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`, { credentials: 'include' })
      const data = r.ok ? await r.json() : []
      patchRow(key, { searching: false, searchResults: data })
    } catch {
      patchRow(key, { searching: false, searchResults: [] })
    }
  }

  // Elegir un resultado solo rellena los datos que faltan (autor) y guarda los
  // metadatos (portada/género/páginas/año/isbn) — el título de la búsqueda NO
  // sustituye al que ya hubiera escrito, para poder buscar por el título
  // original y quedarte con el tuyo (p.ej. en otro idioma) sin perder el resto.
  function pickMatch(key, book) {
    setRows(rs => rs.map(r => r.key === key ? {
      ...r,
      author: r.author.trim() || book.author || '',
      matched: book,
      searchResults: null,
    } : r))
    setOpenSearchKey(null)
  }

  function clearMatch(key) {
    patchRow(key, { matched: null })
  }

  async function processAll() {
    setFormErr(''); setResults(null)
    const books = rows
      .filter(r => r.title.trim())
      .map(r => ({
        title: r.title.trim(),
        author: r.author.trim() || r.matched?.author || undefined,
        status: r.status,
        genre: r.matched?.genre,
        year: r.matched?.year,
        num_pages: r.matched?.num_pages,
        cover_url: r.matched?.cover_url,
        isbn: r.matched?.isbn,
        started_at: r.status === 'read' ? (r.started_at || undefined) : undefined,
        finished_at: r.status === 'read' ? (r.finished_at || undefined) : undefined,
      }))
    if (books.length === 0) {
      setFormErr('Añade al menos un título.')
      return
    }
    setProcessing(true)
    try {
      const r = await fetch('/api/shelf/personal/bulk', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books }),
      })
      if (!r.ok) { setFormErr('Error al procesar — inténtalo de nuevo.'); return }
      const data = await r.json()
      setResults(data.results)
      // Vaciar la lista tras procesar — si no, un segundo "Procesar todo"
      // (por error, o al reabrir el modal sin fijarse) volvería a mandar los
      // mismos libros otra vez, duplicándolos en la estantería.
      setRows([newRow()])
      setScanCount(0)
      onImported?.()
    } finally {
      setProcessing(false)
    }
  }

  const okCount   = results?.filter(r => r.ok).length ?? 0
  const failCount = results ? results.length - okCount : 0

  const inpStyle = {
    background: C.surfaceHi, border: `1px solid ${C.border}`,
    borderRadius: 7, padding: '6px 8px', color: C.text, fontSize: 12,
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', width: '100%',
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      style={{
        position: 'absolute', inset: 0, zIndex: 100,
        background: 'rgba(15,10,6,0.75)', backdropFilter: 'blur(4px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start',
        padding: '44px 16px 16px',
      }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.15 } }}
        transition={{ type: 'spring', damping: 24, stiffness: 320 }}
        style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 16, width: '100%', maxWidth: 880,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '100%', overflow: 'hidden',
        }}>
        {/* Cabecera — fija */}
        <div style={{
          padding: '13px 16px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>Añadir varios libros</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>

        {/* Contenido — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 12, color: C.sub, margin: 0 }}>
            Escribe el título de cada libro (o pega una lista con uno por línea — se reparte solo en filas).
            Pulsa <IconSearch size={11} color={C.sub} /> para buscarlo en Open Library y rellenar autor, portada, género y páginas automáticamente; si no lo encuentra, se guarda igual solo con lo que hayas escrito.
          </p>

          {rows.map((row, i) => (
            <div key={row.key} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  value={row.title}
                  onChange={e => patchRow(row.key, { title: e.target.value })}
                  onPaste={e => onTitlePaste(row.key, e)}
                  onKeyDown={e => e.key === 'Enter' && searchRow(row.key)}
                  placeholder="Título"
                  style={{ ...inpStyle, flex: '2 1 140px' }}
                />
                <input
                  value={row.author}
                  onChange={e => patchRow(row.key, { author: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && searchRow(row.key)}
                  placeholder="Autor (opcional)"
                  style={{ ...inpStyle, flex: '1 1 100px' }}
                />
                <select value={row.status} onChange={e => patchRow(row.key, { status: e.target.value })}
                  style={{ ...inpStyle, flex: '0 0 92px', cursor: 'pointer', colorScheme: 'dark' }}>
                  {STATUS_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>

                {row.status === 'read' && (
                  <>
                    <input type="date" title="Fecha de inicio" value={row.started_at}
                      onChange={e => patchRow(row.key, { started_at: e.target.value })}
                      style={{ ...inpStyle, flex: '0 0 132px', colorScheme: 'dark' }} />
                    <input type="date" title="Fecha de fin" value={row.finished_at}
                      onChange={e => patchRow(row.key, { finished_at: e.target.value })}
                      style={{ ...inpStyle, flex: '0 0 132px', colorScheme: 'dark' }} />
                  </>
                )}

                <button onClick={() => searchRow(row.key)} title="Buscar en Open Library" disabled={!row.title.trim() || row.searching}
                  style={{
                    width: 28, height: 28, flexShrink: 0, borderRadius: 7, border: 'none',
                    background: C.surfaceHi, color: C.sub, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: (!row.title.trim() || row.searching) ? 0.4 : 1,
                  }}>
                  <IconSearch color={C.sub} />
                </button>
                <button onClick={() => removeRow(row.key)} title="Quitar fila"
                  style={{
                    width: 28, height: 28, flexShrink: 0, borderRadius: 7, border: 'none',
                    background: 'transparent', color: C.muted, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  <IconTrash color={C.muted} />
                </button>
              </div>

              {row.matched && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                  <span style={{ color: C.read }}><IconCheck color={C.read} /></span>
                  <span style={{ fontSize: 10.5, color: C.sub }}>
                    Encontrado{row.matched.year ? ` (${row.matched.year})` : ''} — portada, género y páginas rellenos
                  </span>
                  <button onClick={() => clearMatch(row.key)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 10, textDecoration: 'underline', padding: 0 }}>
                    quitar
                  </button>
                </div>
              )}

              {row.searching && (
                <p style={{ fontSize: 10.5, color: C.sub, margin: '3px 0 0' }}>Buscando…</p>
              )}

              {openSearchKey === row.key && row.searchResults && (
                <div style={{
                  marginTop: 4, background: C.surfaceHi, border: `1px solid ${C.border}`,
                  borderRadius: 8, overflow: 'hidden', maxHeight: 180, overflowY: 'auto',
                }}>
                  {row.searchResults.length === 0 && (
                    <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: C.muted }}>Sin resultados — se guardará solo con el título.</span>
                      <button onClick={() => setOpenSearchKey(null)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 14 }}>×</button>
                    </div>
                  )}
                  {row.searchResults.map((b, bi) => (
                    <button key={bi} onClick={() => pickMatch(row.key, b)} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                      background: 'transparent', border: 'none', borderBottom: bi < row.searchResults.length - 1 ? `1px solid ${C.border}` : 'none',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = C.accentBg}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 22, height: 32, borderRadius: 3, flexShrink: 0, overflow: 'hidden', background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {b.cover_url ? <img src={b.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 11 }}>📖</span>}
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
          ))}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addRow} style={{
              alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: `1px dashed ${C.border}`, borderRadius: 8,
              padding: '6px 12px', color: C.sub, cursor: 'pointer', fontSize: 12,
            }}>
              <IconPlus color={C.sub} /> Añadir fila
            </button>
            <button onClick={() => { setScanFeedback(''); setShowScanner(true) }} style={{
              alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: `1px dashed ${C.border}`, borderRadius: 8,
              padding: '6px 12px', color: C.sub, cursor: 'pointer', fontSize: 12,
            }}>
              <IconCamera color={C.sub} /> Escanear código de barras
            </button>
          </div>

          {formErr && <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{formErr}</p>}

          {results && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: 0 }}>
                {okCount} añadido{okCount === 1 ? '' : 's'}{failCount > 0 && `, ${failCount} con error`}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
                {results.map(r => (
                  <div key={r.index} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11.5 }}>
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

        {/* Acciones — fijas */}
        <div style={{ padding: 16, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{
            background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8,
            padding: '8px 16px', color: C.sub, cursor: 'pointer', fontSize: 13,
          }}>
            {results ? 'Cerrar' : 'Cancelar'}
          </button>
          <button onClick={processAll} disabled={processing} style={{
            background: C.accent, border: 'none', borderRadius: 8,
            padding: '8px 16px', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: 13,
            opacity: processing ? 0.6 : 1,
          }}>
            {processing ? 'Procesando…' : 'Procesar todo'}
          </button>
        </div>
      </motion.div>
      <AnimatePresence>
        {showScanner && (
          <BarcodeScannerModal
            continuous
            scanCount={scanCount}
            feedback={scanFeedback}
            onDetect={handleScan}
            onClose={() => setShowScanner(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
