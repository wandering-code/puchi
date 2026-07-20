import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useIsMobile } from '../../../utils/responsive'
import { C } from './lunitecaTheme'
import BulkAddModal from './BulkAddModal'

// Cierra un popover al tocar/clicar fuera de él — el onMouseLeave que ya
// tenían no dispara nunca en táctil (no hay hover), así que sin esto en
// móvil el popover se quedaba abierto hasta volver a tocar el botón.
function useOutsideClose(active, onClose) {
  const ref = useRef(null)
  useEffect(() => {
    if (!active) return
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [active, onClose])
  return ref
}

// ─── Design tokens ────────────────────────────────────────────────────────────
// Paleta alineada con Diskordkito (fondo azul-grisáceo oscuro, acento
// "blurple" de Discord). Vive en lunitecaTheme.js para compartirla con los
// modales de esta app sin crear una importación circular.

const STATUSES = [
  { id: 'want_to_read', label: 'Por leer', color: C.want    },
  { id: 'reading',      label: 'Leyendo',  color: C.reading },
  { id: 'read',         label: 'Leído',    color: C.read    },
]

const NAV = [
  { id: 'shelf',  label: 'Mi estantería' },
  { id: 'club',   label: 'Club'          },
  { id: 'amigos', label: 'Amigos'        },
]

const STARS = [1, 2, 3, 4, 5]

const fmtShortDate = (iso) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })

// Texto de atribución para un resultado de búsqueda ya presente en la
// biblioteca — prioriza avisar que el propio jugador ya lo tiene sobre
// listar a los demás que también lo tengan.
function addedByLabel(book) {
  if (book.added_by_me) return 'ya lo tienes'
  const others = book.added_by || []
  if (!others.length) return 'ya en la biblioteca'
  if (others.length === 1) return `añadido por ${others[0]}`
  if (others.length === 2) return `añadido por ${others[0]} y ${others[1]}`
  return `añadido por ${others[0]} y ${others.length - 1} más`
}
const EMPTY_FILTERS = { status: 'all', author: '', folder: '', maxPages: '', genre: '' }
const EMPTY_CLUB_FILTERS = { author: '', genre: '', proposedBy: '' }

// Animación de borrado — un libro se va encogiendo hacia su propio centro,
// cada vez más deprisa, hasta desaparecer del todo (en vez de un mount/unmount
// de golpe). Se usa en cualquier vista (lista o Netflix, estantería o Club).
const BOOK_DELETE_EXIT = { scale: 0, opacity: 0 }
const BOOK_DELETE_TRANSITION = { duration: 0.35, ease: 'easeIn' }

// Lista canónica de géneros literarios — mismos valores que el backend
const GENRE_OPTIONS = [
  'Fantasía', 'Ciencia ficción', 'Misterio', 'Thriller', 'Romance',
  'Ficción histórica', 'Terror', 'Aventura', 'Literatura infantil',
  'Juvenil', 'Ficción literaria', 'Novela gráfica', 'Biografía',
  'Memorias', 'Autoayuda', 'No ficción', 'Poesía', 'Drama',
  'Distopía', 'Realismo mágico', 'Crimen', 'Western', 'Clásico', 'Ficción',
]

// ─── Iconos SVG ───────────────────────────────────────────────────────────────
function IconFilter({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M2 3h10l-4 5v3.5l-2-1V8L2 3z" fill={color} />
    </svg>
  )
}
function IconEdit({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block' }}>
      <path d="M11.5 2.5a1.5 1.5 0 0 1 2.12 2.12L5 13.24l-3 .76.76-3L11.5 2.5z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconTrash({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block' }}>
      <path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9h5L11 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconCheck({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block' }}>
      <path d="M3 8l4 4 6-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconX({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block' }}>
      <path d="M4 4l8 8M12 4l-8 8" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}
function IconBack({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block' }}>
      <path d="M10 3L5 8l5 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconPlus({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block' }}>
      <path d="M8 3v10M3 8h10" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  )
}
function IconShelf({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M8 13V4C6.5 3 5 2.7 3 3v9c2-.3 3.5 0 5 1z" stroke={color} strokeWidth="1.35" strokeLinejoin="round"/>
      <path d="M8 13V4c1.5-1 3-1.3 5-1v9c-2-.3-3.5 0-5 1z" stroke={color} strokeWidth="1.35" strokeLinejoin="round"/>
    </svg>
  )
}
function IconClub({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M4.5 2h7v11.5l-3.5-2-3.5 2z" stroke={color} strokeWidth="1.35" strokeLinejoin="round"/>
    </svg>
  )
}
function IconAmigos({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <circle cx="6" cy="5.5" r="2" stroke={color} strokeWidth="1.35"/>
      <path d="M1.5 13.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke={color} strokeWidth="1.35" strokeLinecap="round"/>
      <circle cx="12" cy="5.5" r="1.5" stroke={color} strokeWidth="1.35"/>
      <path d="M12 9.5c1.8.2 2.8 1.3 2.8 3" stroke={color} strokeWidth="1.35" strokeLinecap="round"/>
    </svg>
  )
}

const NAV_ICONS = { shelf: IconShelf, club: IconClub, amigos: IconAmigos }

function PlayerBadge({ player, size = 16 }) {
  if (!player) return null
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: player.color + '28',
      border: `1px solid ${player.color}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.5), fontWeight: 700, color: player.color,
    }}>
      {player.name[0].toUpperCase()}
    </div>
  )
}

function IconSort({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block' }}>
      <path d="M3 4h10M5 8h6M7 12h2" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
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
function IconBookmark({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M4 2.5h8v11l-4-2.6-4 2.6v-11z" stroke={color} strokeWidth="1.35" strokeLinejoin="round"/>
    </svg>
  )
}
function IconCircle({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <circle cx="8" cy="8" r="5.25" stroke={color} strokeWidth="1.35"/>
    </svg>
  )
}
function IconChevronDown({ size = 10, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M4 6l4 4 4-4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
// Chevrons hacia dentro (colapsar) o hacia fuera (expandir) — botón "colapsar/expandir todo".
function IconCollapseAll({ size = 14, color = 'currentColor', expand = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block' }}>
      {expand
        ? <path d="M4 6l4-3 4 3M4 10l4 3 4-3" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        : <path d="M4 3l4 3 4-3M4 13l4-3 4 3" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      }
    </svg>
  )
}
function IconImport({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M7 1v7M4.2 5.5L7 8.3l2.8-2.8" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.5 9.5v2A1.5 1.5 0 0 0 3 13h8a1.5 1.5 0 0 0 1.5-1.5v-2" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

// ─── Search overlay ───────────────────────────────────────────────────────────
function SearchResult({ book, onAdd }) {
  const [added,   setAdded]   = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState({
    title:     book.title     || '',
    author:    book.author    || '',
    num_pages: book.num_pages ?? '',
  })

  async function handleAdd() {
    await onAdd({ ...book, ...draft, num_pages: draft.num_pages ? parseInt(draft.num_pages) : book.num_pages })
    setAdded(true); setEditing(false)
  }

  const inp = (extra = {}) => ({
    style: {
      width: '100%', background: C.surfaceHi, border: `1px solid ${C.border}`,
      borderRadius: 7, padding: '5px 8px', color: C.text, fontSize: 12,
      outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', ...extra,
    }
  })

  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
        <Cover url={book.cover_url} w={34} h={50} radius={4} />
        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
          <p style={{ fontSize: 12, color: C.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{draft.title || book.title}</p>
          <p style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>
            {draft.author || book.author}
            {book.year ? <span style={{ color: C.muted }}> · {book.year}</span> : null}
            {book.already_added && (
              <span style={{ color: C.accent }}> · {addedByLabel(book)}</span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          {!added && (
            <button onClick={() => setEditing(e => !e)} title="Editar datos antes de añadir" style={{
              background: editing ? C.accentBg : 'transparent',
              border: `1px solid ${editing ? C.accentBd : C.border}`,
              borderRadius: 7, padding: '4px 8px', color: editing ? C.accent : C.muted,
              fontSize: 11, cursor: 'pointer', transition: 'all 0.15s',
            }}>✏️</button>
          )}
          <button onClick={handleAdd} disabled={added} style={{
            background: added ? 'transparent' : C.accentBg,
            border: `1px solid ${added ? C.muted : C.accentBd}`,
            borderRadius: 7, padding: '4px 10px', color: added ? C.muted : C.accent,
            fontSize: 11, fontWeight: 600, cursor: added ? 'default' : 'pointer', transition: 'all 0.15s',
          }}>{added ? '✓ Añadido' : 'Añadir'}</button>
        </div>
      </div>
      {editing && !added && (
        <div style={{ padding: '0 14px 12px 60px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input value={draft.title}     onChange={ev => setDraft(d => ({ ...d, title:     ev.target.value }))} placeholder="Título"   {...inp()} />
          <input value={draft.author}    onChange={ev => setDraft(d => ({ ...d, author:    ev.target.value }))} placeholder="Autor"    {...inp()} />
          <input value={draft.num_pages} onChange={ev => setDraft(d => ({ ...d, num_pages: ev.target.value }))} placeholder="Páginas" type="number" min="1" {...inp()} />
          <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>Edita los datos antes de añadir.</p>
        </div>
      )}
    </div>
  )
}

function SearchOverlay({ onClose, onAdd, hint }) {
  const [q,       setQ]       = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  async function search() {
    if (!q.trim()) return
    setLoading(true); setError(null); setResults([])
    try {
      const r = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`, { credentials: 'include' })
      if (r.status === 401 || r.status === 403) { setError('Sesión caducada — recarga la página.'); setLoading(false); return }
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        setError(body.detail || `Error ${r.status}`); setLoading(false); return
      }
      const data = await r.json()
      setResults(data)
      if (data.length === 0) setError(`Sin resultados para "${q}"`)
    } catch { setError('No se pudo contactar con el servidor.') }
    setLoading(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      style={{
        position: 'absolute', inset: 0, zIndex: 100,
        background: 'rgba(15,10,6,0.82)', backdropFilter: 'blur(6px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start',
        padding: '48px 16px 16px',
      }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.15 } }}
        transition={{ type: 'spring', damping: 24, stiffness: 320 }}
        style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 16, width: '100%', maxWidth: 460,
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', maxHeight: '100%', overflow: 'hidden',
      }}>
        {hint && (
          <div style={{
            padding: '7px 14px', background: C.accentBg,
            borderBottom: `1px solid ${C.accentBd}`,
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          }}>
            <span style={{ fontSize: 12 }}>📋</span>
            <span style={{ fontSize: 11, color: C.accent, fontWeight: 500 }}>{hint}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <span style={{ fontSize: 14, opacity: 0.35 }}>🔍</span>
          <input autoFocus value={q}
            onChange={ev => setQ(ev.target.value)}
            onKeyDown={ev => ev.key === 'Enter' && search()}
            placeholder="Título, autor, ISBN…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, fontSize: 13 }}
          />
          {loading
            ? <span style={{ fontSize: 12, color: C.muted }}>Buscando…</span>
            : <button onClick={search} disabled={q.trim().length > 0 && q.trim().length < 3} style={{
                background: C.accent, border: 'none', borderRadius: 8, padding: '5px 12px',
                color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                opacity: (q.trim().length > 0 && q.trim().length < 3) ? 0.4 : 1,
              }}>Buscar</button>
          }
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 0 0 2px', flexShrink: 0 }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {!loading && !error && results.length === 0 && (
            <p style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: '24px 16px' }}>Escribe un título, autor o ISBN y pulsa Buscar</p>
          )}
          {!loading && error && (
            <p style={{ color: C.muted, fontSize: 12, textAlign: 'center', padding: '24px 16px' }}>{error}</p>
          )}
          {results.map((b, i) => <SearchResult key={i} book={b} onAdd={onAdd} />)}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Cover picker ─────────────────────────────────────────────────────────────
function CoverPicker({ book, currentUrl, onSelectUrl, onSelectFile, onClose }) {
  const [covers,      setCovers]      = useState([])
  const [userUploads, setUserUploads] = useState([])
  const [loading,     setLoading]     = useState(true)
  const [broken,      setBroken]      = useState(new Set())

  // Buscar por título — para libros cuyo título guardado (p.ej. una traducción)
  // no existe como tal en Open Library y por eso no aparece ninguna portada
  // arriba; aquí se puede reintentar con otro título (el original, en inglés)
  // sin tener que subir la imagen a mano.
  const [query,         setQuery]         = useState(book.title || '')
  const [searching,     setSearching]     = useState(false)
  const [searchResults, setSearchResults] = useState(null) // null | [] sin resultados | [...]

  useEffect(() => {
    fetch(`/api/books/${book.id}/covers`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { covers: [], user_uploads: [] })
      .then(data => { setCovers(data.covers); setUserUploads(data.user_uploads || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [book.id])

  async function runSearch() {
    const q = query.trim()
    if (q.length < 3) return
    setSearching(true); setSearchResults(null)
    try {
      const r = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`, { credentials: 'include' })
      setSearchResults(r.ok ? await r.json() : [])
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const visible = covers.filter(u => !broken.has(u))

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      style={{
      position: 'absolute', inset: 0, zIndex: 200,
      background: 'rgba(10,6,2,0.75)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.15 } }}
        transition={{ type: 'spring', damping: 24, stiffness: 320 }}
        style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 16, width: '100%', maxWidth: 400,
        maxHeight: '100%', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)', overflow: 'hidden',
      }}>
        {/* Cabecera */}
        <div style={{
          padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Cambiar portada</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {/* Portadas de Open Library */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>

          {/* Buscar por título */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.7, fontWeight: 600, marginBottom: 8 }}>Buscar por título</p>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={query}
                onChange={ev => setQuery(ev.target.value)}
                onKeyDown={ev => ev.key === 'Enter' && runSearch()}
                placeholder="Título — prueba el original si es una traducción"
                style={{
                  flex: 1, minWidth: 0, background: C.surfaceHi, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '7px 10px', color: C.text, fontSize: 12,
                  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                }}
              />
              <button onClick={runSearch} disabled={query.trim().length < 3 || searching} title="Buscar" style={{
                width: 32, height: 32, flexShrink: 0, borderRadius: 8, border: 'none',
                background: C.surfaceHi, color: C.sub, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: (query.trim().length < 3 || searching) ? 0.4 : 1,
              }}>
                <IconSearch color={C.sub} />
              </button>
            </div>

            {searching && <p style={{ fontSize: 11, color: C.muted, margin: '8px 0 0' }}>Buscando…</p>}

            {searchResults && (
              <div style={{
                marginTop: 8, background: C.surfaceHi, border: `1px solid ${C.border}`,
                borderRadius: 8, overflow: 'hidden', maxHeight: 200, overflowY: 'auto',
              }}>
                {searchResults.length === 0 && (
                  <p style={{ padding: '10px', fontSize: 11, color: C.muted, margin: 0 }}>Sin resultados para «{query.trim()}».</p>
                )}
                {searchResults.map((b, i) => (
                  <button key={i}
                    onClick={() => { onSelectUrl(b.cover_url); onClose() }}
                    disabled={!b.cover_url}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                      background: 'transparent', border: 'none',
                      borderBottom: i < searchResults.length - 1 ? `1px solid ${C.border}` : 'none',
                      cursor: b.cover_url ? 'pointer' : 'default', textAlign: 'left',
                      opacity: b.cover_url ? 1 : 0.45,
                    }}
                    onMouseEnter={ev => { if (b.cover_url) ev.currentTarget.style.background = C.accentBg }}
                    onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ width: 24, height: 34, borderRadius: 4, flexShrink: 0, overflow: 'hidden', background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {b.cover_url
                        ? <img src={b.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: 12 }}>📖</span>}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 11.5, color: C.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{b.title}</p>
                      <p style={{ fontSize: 10, color: C.sub, margin: 0 }}>{b.author}{b.year ? ` · ${b.year}` : ''}{!b.cover_url ? ' · sin portada' : ''}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {!loading && userUploads.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.7, fontWeight: 600, marginBottom: 10 }}>Subidas por el club ({userUploads.length})</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {userUploads.map((u, i) => (
                  <button key={i} onClick={() => { onSelectUrl(u.url); onClose() }} title={u.uploaded_by ? `Subida por ${u.uploaded_by}` : undefined} style={{
                    position: 'relative',
                    border: u.url === currentUrl ? `2px solid ${C.accent}` : '2px solid transparent',
                    borderRadius: 7, padding: 0, cursor: 'pointer', background: C.surfaceHi,
                    overflow: 'hidden', aspectRatio: '2/3', display: 'block', transition: 'border-color 0.15s',
                  }}
                    onMouseEnter={ev => { if (u.url !== currentUrl) ev.currentTarget.style.borderColor = C.accentBd }}
                    onMouseLeave={ev => { if (u.url !== currentUrl) ev.currentTarget.style.borderColor = 'transparent' }}
                  >
                    <img src={u.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {u.uploaded_by && (
                      <span style={{
                        position: 'absolute', left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.65)', color: 'white',
                        fontSize: 9, padding: '2px 4px', textAlign: 'center',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{u.uploaded_by}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && <p style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: 24 }}>Buscando portadas…</p>}
          {!loading && visible.length === 0 && userUploads.length === 0 && (
            <p style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: 16, fontStyle: 'italic' }}>No se encontraron portadas para este libro — prueba a buscar por título arriba.</p>
          )}
          {!loading && visible.length > 0 && (
            <>
              <p style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.7, fontWeight: 600, marginBottom: 10 }}>Open Library ({visible.length})</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {visible.map((url, i) => (
                  <button key={i} onClick={() => { onSelectUrl(url); onClose() }} style={{
                    border: url === currentUrl ? `2px solid ${C.accent}` : '2px solid transparent',
                    borderRadius: 7, padding: 0, cursor: 'pointer', background: C.surfaceHi,
                    overflow: 'hidden', aspectRatio: '2/3', display: 'block', transition: 'border-color 0.15s',
                  }}
                    onMouseEnter={ev => { if (url !== currentUrl) ev.currentTarget.style.borderColor = C.accentBd }}
                    onMouseLeave={ev => { if (url !== currentUrl) ev.currentTarget.style.borderColor = 'transparent' }}
                  >
                    <img src={url} alt="" onError={() => setBroken(b => new Set([...b, url]))}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Subir archivo */}
        <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: C.surfaceHi, border: `1px solid ${C.border}`,
            borderRadius: 9, padding: '9px 14px', cursor: 'pointer',
            fontSize: 12, color: C.sub, transition: 'border-color 0.15s',
          }}
            onMouseEnter={ev => ev.currentTarget.style.borderColor = C.muted}
            onMouseLeave={ev => ev.currentTarget.style.borderColor = C.border}
          >
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={ev => {
                const file = ev.target.files?.[0]
                if (!file) return
                onSelectFile(file)
                onClose()
              }}
            />
            <IconPlus size={13} color={C.sub} />
            Subir imagen desde archivo
          </label>
        </div>
      </motion.div>
    </motion.div>
  )
}


// ─── Filter modal ─────────────────────────────────────────────────────────────
function FilterModal({ filters, onApply, onClose, shelf }) {
  const [draft, setDraft] = useState({ ...filters })

  const authors = [...new Set(shelf.map(e => e.book.author).filter(Boolean))].sort()
  const folders = [...new Set(shelf.map(e => e.folder).filter(Boolean))].sort()
  const genres  = [...new Set(shelf.map(e => e.book.genre).filter(Boolean))].sort()

  const selStyle = {
    width: '100%', background: C.surfaceHi, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: '7px 10px', color: C.text, fontSize: 12,
    outline: 'none', cursor: 'pointer', colorScheme: 'dark',
  }
  const inpStyle = {
    width: '100%', background: C.surfaceHi, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: '7px 10px', color: C.text, fontSize: 12,
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  }
  const sectionLabel = (text) => (
    <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600, display: 'block', marginBottom: 8 }}>{text}</span>
  )

  const hasChanges = Object.keys(EMPTY_FILTERS).some(k => draft[k] !== EMPTY_FILTERS[k])

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
        borderRadius: 16, width: '100%', maxWidth: 380,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '100%', overflow: 'hidden',
      }}>
        {/* Cabecera — fija */}
        <div style={{
          padding: '13px 16px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>Filtrar</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>

        {/* Campos — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Estado */}
          <div>
            {sectionLabel('Estado')}
            <div style={{ display: 'flex', gap: 6 }}>
              {[{ id: 'all', label: 'Todos' }, ...STATUSES].map(opt => (
                <button key={opt.id} onClick={() => setDraft(d => ({ ...d, status: opt.id }))} style={{
                  flex: 1, border: 'none', borderRadius: 20, padding: '6px 0',
                  cursor: 'pointer', fontSize: 10, fontWeight: 600, transition: 'all 0.15s',
                  background: draft.status === opt.id ? (opt.color || C.accent) : C.surfaceHi,
                  color: draft.status === opt.id ? 'white' : C.muted,
                }}>{opt.label}</button>
              ))}
            </div>
          </div>

          {/* Autor */}
          <div>
            {sectionLabel('Autor')}
            <select value={draft.author} onChange={ev => setDraft(d => ({ ...d, author: ev.target.value }))} style={selStyle}>
              <option value="">Todos los autores</option>
              {authors.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Carpeta */}
          <div>
            {sectionLabel('Carpeta')}
            <select value={draft.folder} onChange={ev => setDraft(d => ({ ...d, folder: ev.target.value }))} style={selStyle}>
              <option value="">Todas las carpetas</option>
              {folders.length === 0
                ? <option disabled>Sin carpetas definidas</option>
                : folders.map(f => <option key={f} value={f}>{f}</option>)
              }
            </select>
          </div>

          {/* Máx. páginas */}
          <div>
            {sectionLabel('Máximo de páginas')}
            <input type="number" min="1" value={draft.maxPages}
              onChange={ev => setDraft(d => ({ ...d, maxPages: ev.target.value }))}
              placeholder="Sin límite" style={inpStyle} />
          </div>

          {/* Género */}
          <div>
            {sectionLabel('Género')}
            <select value={draft.genre} onChange={ev => setDraft(d => ({ ...d, genre: ev.target.value }))} style={selStyle}>
              <option value="">Todos los géneros</option>
              {GENRE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        {/* Pie — fijo */}
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, flexShrink: 0 }}>
          {hasChanges && (
            <button onClick={() => { onApply(EMPTY_FILTERS); onClose() }} style={{
              flex: 1, background: 'none', border: `1px solid ${C.border}`,
              borderRadius: 9, padding: '8px 0', color: C.muted, fontSize: 11, cursor: 'pointer',
            }}>Limpiar</button>
          )}
          <button onClick={() => { onApply(draft); onClose() }} style={{
            flex: 2, background: C.accent, border: 'none',
            borderRadius: 9, padding: '8px 0', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>Aplicar</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Filtros del club ─────────────────────────────────────────────────────────
function ClubFilterModal({ filters, onApply, onClose, items }) {
  const [draft, setDraft] = useState({ ...filters })

  const authors = [...new Set(items.map(e => e.book.author).filter(Boolean))].sort()
  const genres  = [...new Set(items.map(e => e.book.genre).filter(Boolean))].sort()
  const proposers = [...new Map(
    items.filter(e => e.proposed_by).map(e => [e.proposed_by.id, e.proposed_by])
  ).values()].sort((a, b) => a.name.localeCompare(b.name))

  const selStyle = {
    width: '100%', background: C.surfaceHi, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: '7px 10px', color: C.text, fontSize: 12,
    outline: 'none', cursor: 'pointer', colorScheme: 'dark',
  }
  const sectionLabel = (text) => (
    <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600, display: 'block', marginBottom: 8 }}>{text}</span>
  )

  const hasChanges = Object.keys(EMPTY_CLUB_FILTERS).some(k => draft[k] !== EMPTY_CLUB_FILTERS[k])

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
        borderRadius: 16, width: '100%', maxWidth: 380,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '100%', overflow: 'hidden',
      }}>
        <div style={{
          padding: '13px 16px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>Filtrar</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            {sectionLabel('Autor')}
            <select value={draft.author} onChange={ev => setDraft(d => ({ ...d, author: ev.target.value }))} style={selStyle}>
              <option value="">Todos los autores</option>
              {authors.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div>
            {sectionLabel('Género')}
            <select value={draft.genre} onChange={ev => setDraft(d => ({ ...d, genre: ev.target.value }))} style={selStyle}>
              <option value="">Todos los géneros</option>
              {GENRE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div>
            {sectionLabel('Propuesto por')}
            <select value={draft.proposedBy} onChange={ev => setDraft(d => ({ ...d, proposedBy: ev.target.value }))} style={selStyle}>
              <option value="">Cualquiera</option>
              {proposers.length === 0
                ? <option disabled>Sin propuestas aún</option>
                : proposers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
              }
            </select>
          </div>
        </div>

        <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, flexShrink: 0 }}>
          {hasChanges && (
            <button onClick={() => { onApply(EMPTY_CLUB_FILTERS); onClose() }} style={{
              flex: 1, background: 'none', border: `1px solid ${C.border}`,
              borderRadius: 9, padding: '8px 0', color: C.muted, fontSize: 11, cursor: 'pointer',
            }}>Limpiar</button>
          )}
          <button onClick={() => { onApply(draft); onClose() }} style={{
            flex: 2, background: C.accent, border: 'none',
            borderRadius: 9, padding: '8px 0', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>Aplicar</button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Portada genérica ─────────────────────────────────────────────────────────
function Cover({ url, w, h, radius = 6 }) {
  // El marcador de posición va siempre detrás, no solo cuando no hay url —
  // así, mientras la imagen real todavía está bajando (o si falla del todo,
  // vía onError), el hueco nunca se ve vacío/transparente.
  const [broken, setBroken] = useState(false)
  useEffect(() => { setBroken(false) }, [url])
  const showImg = !!url && !broken
  const emojiSize = typeof w === 'number' ? Math.round(w * 0.28) : 28
  return (
    <div style={{
      width: w, height: h, borderRadius: radius, flexShrink: 0, position: 'relative', overflow: 'hidden',
      background: C.surfaceHi, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {!showImg && <span style={{ fontSize: emojiSize }}>📖</span>}
      {showImg && (
        <img src={url} alt="" onError={() => setBroken(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
    </div>
  )
}

// Portada del hero del detalle — a diferencia de Cover (que rellena una caja
// de tamaño fijo y recorta), aquí el ancho es automático según la altura
// disponible: la imagen se ve entera, sin recortes ni márgenes vacíos.
function HeroCover({ url, width = 150 }) {
  const [broken, setBroken] = useState(false)
  // Ancho fijo, alto automático según la proporción real de la imagen — la
  // dirección inversa (alto fijo/ancho automático) es ambigua dentro de un
  // flex con stretch: el navegador puede calcular el ancho contra una altura
  // provisional (antes de que el stretch se resuelva del todo) y recortar el
  // sobrante. Con el ancho como valor fijo no hay ninguna cuenta ambigua en
  // ningún navegador: el alto se deriva siempre de un ancho ya conocido.
  // Se parte de 2:3 (proporción habitual de portada) y se corrige en cuanto
  // la imagen carga y conocemos su proporción real.
  const [ratio, setRatio] = useState(2 / 3)
  useEffect(() => { setBroken(false); setRatio(2 / 3) }, [url])
  const showImg = !!url && !broken
  if (!showImg) {
    return (
      <div style={{
        width, aspectRatio: '2 / 3', borderRadius: 8, background: C.surfaceHi,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, flexShrink: 0,
      }}>📖</div>
    )
  }
  return (
    <img src={url} alt=""
      onError={() => setBroken(true)}
      onLoad={ev => setRatio(ev.currentTarget.naturalWidth / ev.currentTarget.naturalHeight)}
      style={{ width, height: 'auto', aspectRatio: ratio, display: 'block', borderRadius: 8, flexShrink: 0 }}
    />
  )
}

// Sinopsis del hero de detalle — se queda siempre recortada a 5 líneas ahí
// (nunca crece, para no descuadrar la cabecera con textos muy largos); "Ver
// más" abre un popover flotante justo encima, con fondo un pelín más claro
// que el resto (C.surfaceHi), en vez de crecer en el propio flujo de la página.
function SynopsisBox({ synopsis, loading, expanded, onToggle }) {
  const boxRef = useOutsideClose(expanded, () => onToggle(false))
  const sectionLabel = (
    <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>Sinopsis</span>
  )
  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <div>
        <div style={{ marginBottom: 7 }}>{sectionLabel}</div>
        {loading && <p style={{ fontSize: 12, color: C.muted }}>Cargando sinopsis…</p>}
        {!loading && !synopsis && <p style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>Sin sinopsis disponible.</p>}
        {!loading && synopsis && (
          <>
            <p style={{
              fontSize: 12, color: C.sub, lineHeight: 1.75, margin: 0, textAlign: 'justify',
              display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden', WebkitLineClamp: 5,
            }}>{synopsis}</p>
            {synopsis.length > 300 && (
              <button onClick={() => onToggle(!expanded)}
                style={{ background: 'none', border: 'none', color: C.accent, fontSize: 11, cursor: 'pointer', padding: '4px 0 0', fontWeight: 600 }}>
                {expanded ? 'Ver menos' : 'Ver más'}
              </button>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {expanded && synopsis && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
              background: C.surfaceHi, border: `1px solid ${C.border}`, borderRadius: 12,
              padding: 14, boxShadow: '0 14px 36px rgba(0,0,0,0.5)',
              maxHeight: 320, overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              {sectionLabel}
              <button onClick={() => onToggle(false)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <p style={{ fontSize: 12, color: C.sub, lineHeight: 1.75, textAlign: 'justify', margin: 0 }}>{synopsis}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Detalle completo ─────────────────────────────────────────────────────────
function BookDetailFull({ entry, shelf, onBack, onUpdateEntry, onUpdateBook, onDelete }) {
  const isMobile = useIsMobile()
  const [editing,          setEditing]          = useState(false)
  const [draft,            setDraft]            = useState({})
  const [confirmDelete,    setConfirmDelete]    = useState(false)
  const [showCoverPicker,  setShowCoverPicker]  = useState(false)
  const [synopsis,         setSynopsis]         = useState(entry.book.synopsis || '')
  const [synopsisExpanded, setSynopsisExpanded] = useState(false)
  const [loadingSynopsis,  setLoadingSynopsis]  = useState(false)

  const status     = entry.status || 'want_to_read'
  const statusInfo = STATUSES.find(s => s.id === status)
  const today      = new Date().toISOString().slice(0, 10)
  const folders    = [...new Set(shelf.filter(e => e.folder).map(e => e.folder))].sort()
  const genres     = [...new Set(shelf.map(e => e.book.genre).filter(Boolean))].sort()
  const total      = entry.custom_total_pages || entry.book.num_pages
  const pct        = total && entry.current_page != null
    ? Math.min(Math.round(entry.current_page / total * 100), 100)
    : Math.round((entry.progress || 0) * 100)

  // El estado activo en modo edición (para condicionales de páginas/fechas)
  const effectiveStatus = editing ? (draft.status || status) : status
  const showProgressSection = effectiveStatus === 'reading' || effectiveStatus === 'read'

  // Carga sinopsis desde Open Library si no está guardada
  useEffect(() => {
    if (!synopsis && entry.book.open_lib_key) {
      setLoadingSynopsis(true)
      fetch(`/api/books/synopsis/${encodeURIComponent(entry.book.open_lib_key)}`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.synopsis) {
            setSynopsis(data.synopsis)
            onUpdateBook(entry.book.id, { synopsis: data.synopsis })
          }
        })
        .finally(() => setLoadingSynopsis(false))
    }
  }, [])

  function startEdit() {
    const genreValue = entry.book.genre && GENRE_OPTIONS.includes(entry.book.genre)
      ? entry.book.genre : ''
    setDraft({
      title:        entry.book.title,
      author:       entry.book.author || '',
      status:       entry.status      || 'want_to_read',
      genre:        genreValue,
      coverFile:    null,
      coverPreview: null,
      coverUrl:     null,
    })
    setEditing(true)
  }

  // Compartida por el guardado del formulario de edición y por el desplegable
  // rápido de estado (fuera de edición) — misma regla: al pasar a "leyendo" o
  // "leído" se rellenan las fechas que falten con la de hoy, sin pisar las
  // que el jugador ya hubiera puesto a mano.
  function statusUpdates(newStatus) {
    const updates = { status: newStatus }
    if (newStatus === 'reading' && !entry.started_at) updates.started_at = today
    if (newStatus === 'read') {
      if (!entry.started_at)  updates.started_at  = today
      if (!entry.finished_at) updates.finished_at = today
      // Al marcarlo leído, la página actual pasa a ser el total (si se
      // conoce) — da por hecho que se ha llegado hasta el final.
      if (total) updates.current_page = total
    } else {
      // Cualquier otro cambio de estado reinicia el progreso a 0.
      updates.current_page = 0
    }
    return updates
  }

  function changeStatus(newStatus) {
    if (newStatus === status) return
    onUpdateEntry(entry.id, statusUpdates(newStatus))
  }

  async function saveEdit() {
    // La portada es una elección personal de esta copia (PersonalShelf.cover_url),
    // no un dato del libro compartido — así, elegir/subir una portada distinta
    // no se la cambia a nadie más que ya tenga este libro en su estantería.
    let newCoverUrl = draft.coverUrl
    if (draft.coverFile) {
      const fd = new FormData()
      fd.append('file', draft.coverFile)
      const r = await fetch(`/api/books/${entry.book.id}/cover`, {
        method: 'POST', credentials: 'include', body: fd,
      })
      if (r.ok) newCoverUrl = (await r.json()).url
    }
    if (newCoverUrl && newCoverUrl !== entry.own_cover_url) {
      await onUpdateEntry(entry.id, { cover_url: newCoverUrl })
    }

    const bookChanged = draft.title    !== entry.book.title
      || draft.author   !== (entry.book.author   || '')
      || draft.genre    !== (entry.book.genre    || '')
    if (bookChanged) {
      await onUpdateBook(entry.book.id, {
        title: draft.title, author: draft.author, genre: draft.genre,
      })
    }
    if (draft.status !== status) {
      await onUpdateEntry(entry.id, statusUpdates(draft.status))
    }
    setEditing(false)
  }

  const label = (text) => (
    <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600, display: 'block', marginBottom: 7 }}>{text}</span>
  )
  const fieldStyle = {
    width: '100%', background: C.surfaceHi, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: '7px 10px', color: C.text, fontSize: 12,
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  }
  const selStyle = { ...fieldStyle, cursor: 'pointer', colorScheme: 'dark' }

  // Mientras se edita: sección aparte debajo del hero (el formulario no tiene
  // hueco libre junto a la portada), con clamp+toggle propios.
  const synopsisBlock = (
    <div>
      {label('Sinopsis')}
      {loadingSynopsis && <p style={{ fontSize: 12, color: C.muted }}>Cargando sinopsis…</p>}
      {!loadingSynopsis && !synopsis && <p style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>Sin sinopsis disponible.</p>}
      {!loadingSynopsis && synopsis && (
        <>
          <p style={{
            fontSize: 12, color: C.sub, lineHeight: 1.75, margin: 0,
            textAlign: 'justify',
            display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden',
            WebkitLineClamp: synopsisExpanded ? 'none' : 5,
          }}>{synopsis}</p>
          {synopsis.length > 300 && (
            <button onClick={() => setSynopsisExpanded(e => !e)}
              style={{ background: 'none', border: 'none', color: C.accent, fontSize: 11, cursor: 'pointer', padding: '4px 0 0', fontWeight: 600 }}>
              {synopsisExpanded ? 'Ver menos' : 'Ver más'}
            </button>
          )}
        </>
      )}
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <AnimatePresence>
        {showCoverPicker && (
          <CoverPicker
            book={entry.book}
            currentUrl={draft.coverUrl || entry.book.cover_url}
            onSelectUrl={url => setDraft(d => ({ ...d, coverUrl: url, coverFile: null, coverPreview: null }))}
            onSelectFile={file => setDraft(d => ({ ...d, coverFile: file, coverPreview: URL.createObjectURL(file), coverUrl: null }))}
            onClose={() => setShowCoverPicker(false)}
          />
        )}
      </AnimatePresence>
      {/* Nav */}
      <div style={{
        padding: '11px 16px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <button onClick={onBack} title="Volver a la estantería" style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', borderRadius: 7, transition: 'color 0.15s' }}
          onMouseEnter={ev => ev.currentTarget.style.color = C.text}
          onMouseLeave={ev => ev.currentTarget.style.color = C.sub}>
          <IconBack size={16} color="currentColor" />
        </button>
        <div style={{ display: 'flex', gap: 4 }}>
          {editing ? (<>
            <button onClick={saveEdit} title="Guardar cambios" style={{
              background: C.accent, border: 'none', borderRadius: 8,
              width: 30, height: 28, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconCheck size={14} color="white" />
            </button>
            <button onClick={() => setEditing(false)} title="Cancelar" style={{
              background: C.surfaceHi, border: 'none', borderRadius: 8,
              width: 30, height: 28, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconX size={13} color={C.sub} />
            </button>
          </>) : (<>
            <button onClick={startEdit} title="Editar libro" style={{
              background: 'none', border: `1px solid ${C.border}`, borderRadius: 8,
              width: 30, height: 28, cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
              onMouseEnter={ev => { ev.currentTarget.style.background = C.surfaceHi; ev.currentTarget.style.borderColor = C.muted }}
              onMouseLeave={ev => { ev.currentTarget.style.background = 'none'; ev.currentTarget.style.borderColor = C.border }}
            >
              <IconEdit size={13} color={C.sub} />
            </button>
            {confirmDelete ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 11, color: 'rgba(239,68,68,0.8)', whiteSpace: 'nowrap' }}>¿Eliminar?</span>
                <button onClick={onDelete} title="Confirmar eliminación" style={{
                  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                  borderRadius: 8, width: 30, height: 28, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <IconCheck size={13} color="#ef4444" />
                </button>
                <button onClick={() => setConfirmDelete(false)} title="Cancelar" style={{
                  background: C.surfaceHi, border: 'none', borderRadius: 8,
                  width: 30, height: 28, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <IconX size={12} color={C.muted} />
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} title="Eliminar libro" style={{
                background: 'none', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8,
                width: 30, height: 28, cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
                onMouseEnter={ev => { ev.currentTarget.style.background = 'rgba(239,68,68,0.08)'; ev.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)' }}
                onMouseLeave={ev => { ev.currentTarget.style.background = 'none'; ev.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)' }}
              >
                <IconTrash size={13} color="rgba(239,68,68,0.6)" />
              </button>
            )}
          </>)}
        </div>
      </div>

      {/* Contenido scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Hero */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          {/* Columna de la portada — ancho fijo, alto automático según su
              proporción real (ver HeroCover) para que se vea siempre entera,
              sin recortes ni márgenes vacíos alrededor. Debajo va la carpeta
              (siempre editable, no depende de "editing"), para no dejar
              hueco vacío bajo la portada cuando es más baja que el texto. */}
          <div style={{ flexShrink: 0, width: 150, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', display: 'flex' }}>
              <HeroCover url={editing ? (draft.coverPreview || draft.coverUrl || entry.book.cover_url) : entry.book.cover_url} />
              {editing && (
                <button title="Cambiar portada" onClick={() => setShowCoverPicker(true)} style={{
                  position: 'absolute', inset: 0, border: 'none',
                  background: 'rgba(0,0,0,0.45)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0, transition: 'opacity 0.15s',
                }}
                  onMouseEnter={ev => ev.currentTarget.style.opacity = 1}
                  onMouseLeave={ev => ev.currentTarget.style.opacity = 0}
                >
                  <IconEdit size={22} color="white" />
                </button>
              )}
            </div>
            {editing && (draft.coverFile || draft.coverUrl) && (
              <span style={{ fontSize: 9, color: C.accent, textAlign: 'center', lineHeight: 1.3 }}>
                Nueva portada seleccionada
              </span>
            )}
            <div>
              {label('Carpeta')}
              <input type="text" defaultValue={entry.folder || ''}
                onBlur={ev => onUpdateEntry(entry.id, { folder: ev.target.value || '' })}
                placeholder="Sin carpeta" style={fieldStyle} />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input autoFocus value={draft.title} onChange={ev => setDraft(d => ({ ...d, title: ev.target.value }))}
                  style={{ ...fieldStyle, fontSize: 14, fontWeight: 700, border: `1px solid ${C.accentBd}` }} />
                <input value={draft.author} onChange={ev => setDraft(d => ({ ...d, author: ev.target.value }))}
                  placeholder="Autor" style={{ ...fieldStyle, color: C.sub }} />
                <div>
                  {label('Estado')}
                  <div style={{ display: 'flex', gap: 5 }}>
                    {STATUSES.map(opt => (
                      <button key={opt.id} onClick={() => setDraft(d => ({ ...d, status: opt.id }))} style={{
                        flex: 1, border: 'none', borderRadius: 20, padding: '5px 0',
                        cursor: 'pointer', fontSize: 10, fontWeight: 600, transition: 'all 0.15s',
                        background: draft.status === opt.id ? opt.color : C.surfaceHi,
                        color: draft.status === opt.id ? 'white' : C.muted,
                      }}>{opt.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  {label('Género')}
                  <select value={draft.genre} onChange={ev => setDraft(d => ({ ...d, genre: ev.target.value }))} style={selStyle}>
                    <option value="">Sin género</option>
                    {GENRE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: 17, color: C.text, fontWeight: 700, lineHeight: 1.3, margin: '0 0 4px' }}>{entry.book.title}</h2>
                {entry.book.author && <p style={{ fontSize: 12, color: C.sub, margin: '0 0 3px' }}>{entry.book.author}</p>}
                {entry.book.year   && <p style={{ fontSize: 11, color: C.muted, margin: '0 0 14px' }}>{entry.book.year}</p>}
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <select value={status} onChange={ev => changeStatus(ev.target.value)} title="Cambiar estado" style={{
                    appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                    background: `${statusInfo?.color}22`, border: 'none', borderRadius: 20,
                    padding: '4px 24px 4px 20px', fontSize: 11, fontWeight: 600, color: statusInfo?.color,
                    cursor: 'pointer', outline: 'none', colorScheme: 'dark', fontFamily: 'inherit',
                  }}>
                    {STATUSES.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                  </select>
                  <span style={{ position: 'absolute', left: 11, width: 5, height: 5, borderRadius: '50%', background: statusInfo?.color, pointerEvents: 'none' }} />
                  <span style={{ position: 'absolute', right: 8, display: 'flex', pointerEvents: 'none' }}>
                    <IconChevronDown size={9} color={statusInfo?.color} />
                  </span>
                </div>
                {entry.book.genre && (
                  <p style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>{entry.book.genre}</p>
                )}
                <div style={{ marginTop: 12 }}>
                  <SynopsisBox synopsis={synopsis} loading={loadingSynopsis} expanded={synopsisExpanded} onToggle={setSynopsisExpanded} />
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ height: 1, background: C.border }} />

        {editing && (
          <>
            {synopsisBlock}
            <div style={{ height: 1, background: C.border }} />
          </>
        )}

        {/* Páginas / Fechas / Puntuación y notas — aparecen y desaparecen según
            el estado (p.ej. al cambiarlo desde el desplegable de arriba, sin
            entrar a editar). Se animan siempre con height+opacity en vez de
            aparecer/desaparecer de golpe — patrón a repetir en toda Puchi
            para cualquier bloque condicionado por un desplegable/estado. */}
        <AnimatePresence initial={false}>
          {showProgressSection && (
            <motion.div key="paginas" layout
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              <div>
                {label('Páginas')}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="number" min="0" max={total || undefined}
                    defaultValue={entry.current_page ?? ''}
                    placeholder="Actual"
                    onBlur={ev => onUpdateEntry(entry.id, { current_page: ev.target.value === '' ? null : parseInt(ev.target.value) })}
                    style={{ ...fieldStyle, width: 72, textAlign: 'center' }} />
                  <span style={{ color: C.muted, fontSize: 13 }}>/</span>
                  <input type="number" min="1"
                    defaultValue={entry.custom_total_pages ?? entry.book.num_pages ?? ''}
                    placeholder="Total"
                    onBlur={ev => onUpdateEntry(entry.id, { custom_total_pages: ev.target.value === '' ? null : parseInt(ev.target.value) })}
                    style={{ ...fieldStyle, width: 72, textAlign: 'center', color: C.sub }} />
                  {total > 0 && <span style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>{pct}%</span>}
                </div>
                {total > 0 && (
                  <div style={{ marginTop: 8, height: 3, borderRadius: 2, background: C.surfaceHi }}>
                    <div style={{ height: '100%', borderRadius: 2, background: C.accent, width: `${pct}%`, transition: 'width 0.3s' }} />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {showProgressSection && (
            <motion.div key="fechas" layout
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                <div>
                  {label('Inicio de lectura')}
                  <input type="date" defaultValue={entry.started_at ? entry.started_at.slice(0, 10) : ''}
                    onBlur={ev => onUpdateEntry(entry.id, { started_at: ev.target.value || null })}
                    style={{ ...fieldStyle, colorScheme: 'dark' }} />
                </div>
                <AnimatePresence initial={false}>
                  {effectiveStatus === 'read' && (
                    <motion.div key="fin-lectura"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                    >
                      {label('Fin de lectura')}
                      <input type="date" defaultValue={entry.finished_at ? entry.finished_at.slice(0, 10) : ''}
                        onBlur={ev => onUpdateEntry(entry.id, { finished_at: ev.target.value || null })}
                        style={{ ...fieldStyle, colorScheme: 'dark' }} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {effectiveStatus === 'read' && (
            <motion.div key="puntuacion-notas" layout
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                <div>
                  {label('Puntuación')}
                  <div style={{ display: 'flex', gap: 2 }}>
                    {STARS.map(s => (
                      <button key={s} onClick={() => onUpdateEntry(entry.id, { rating: s })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 26, color: (entry.rating || 0) >= s ? '#f0b429' : C.surfaceHi, padding: '0 2px', lineHeight: 1 }}>★</button>
                    ))}
                  </div>
                </div>
                <div>
                  {label('Notas privadas')}
                  <textarea defaultValue={entry.notes || ''}
                    onBlur={ev => onUpdateEntry(entry.id, { notes: ev.target.value })}
                    rows={4} placeholder="Tus impresiones sobre el libro…"
                    style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.6 }} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Vista lista — filas sueltas (sin envoltorio de scroll, se componen dentro
// de PersonalShelfSections; Club ya no usa esta vista, tiene ClubBookCard) ────
function ListRows({ books, onSelect, renderActions, isHighlighted = () => false }) {
  return (
    <AnimatePresence>
      {books.map(e => {
        const st          = STATUSES.find(s => s.id === e.status)
        const total       = e.custom_total_pages || e.book.num_pages
        const pct         = total && e.current_page != null ? Math.min(Math.round(e.current_page / total * 100), 100) : Math.round((e.progress || 0) * 100)
        const highlighted = isHighlighted(e)
        return (
          <motion.div key={e.id} layout exit={BOOK_DELETE_EXIT} transition={BOOK_DELETE_TRANSITION} style={{
            width: '100%', display: 'flex', alignItems: 'center',
            borderRadius: 10, marginBottom: 2, transition: 'background 0.1s',
            background: highlighted ? C.accentBg : 'transparent',
            border: `1px solid ${highlighted ? C.accentBd : 'transparent'}`,
          }}
            onMouseEnter={ev => { ev.currentTarget.style.background = highlighted ? C.accentBg : C.surfaceHi }}
            onMouseLeave={ev => { ev.currentTarget.style.background = highlighted ? C.accentBg : 'transparent' }}
          >
            <button onClick={() => onSelect(e)} style={{
              flex: 1, minWidth: 0, background: 'transparent', border: 'none',
              cursor: 'pointer', padding: 10,
              display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left', outline: 'none',
            }}>
              <Cover url={e.book.cover_url} w={38} h={55} radius={5} />
              <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                <p style={{ fontSize: 13, color: C.text, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.book.title}</p>
                <p style={{ fontSize: 11, color: C.sub, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.book.author}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: st?.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: C.muted }}>{st?.label}</span>
                  {e.status === 'reading' && total && e.current_page != null && <span style={{ fontSize: 10, color: C.accent, marginLeft: 2, fontWeight: 600 }}>{pct}%</span>}
                  {e.status === 'read' && e.rating > 0 && <span style={{ fontSize: 9, color: '#f0b429', marginLeft: 2 }}>{'★'.repeat(e.rating)}</span>}
                </div>
                {e.status === 'reading' && total && e.current_page != null && (
                  <div style={{ marginTop: 5, height: 2, borderRadius: 1, background: C.surfaceHi }}>
                    <div style={{ height: '100%', borderRadius: 1, background: C.accent, width: `${pct}%` }} />
                  </div>
                )}
                {e.status === 'reading' && e.started_at && (
                  <p style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>Empezado el {fmtShortDate(e.started_at)}</p>
                )}
                {e.status === 'read' && (e.started_at || e.finished_at) && (
                  <p style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                    {e.started_at ? fmtShortDate(e.started_at) : '?'} – {e.finished_at ? fmtShortDate(e.finished_at) : '?'}
                  </p>
                )}
              </div>
            </button>
            {highlighted && <span style={{ marginRight: 10, flexShrink: 0, display: 'flex' }}><IconBookmark size={12} color={C.accent} /></span>}
            {renderActions && (
              <div onClick={ev => ev.stopPropagation()} style={{ display: 'flex', gap: 6, paddingRight: 10, flexShrink: 0 }}>
                {renderActions(e)}
              </div>
            )}
          </motion.div>
        )
      })}
    </AnimatePresence>
  )
}

// ─── Vista grid (Netflix) — tarjetas sueltas, solo portada + título ───────────
function GridItems({ books, onSelect, isHighlighted = () => false, renderActions }) {
  const [expandedId, setExpandedId] = useState(null)
  const isMobile = useIsMobile()

  // En móvil, número de columnas fijo en vez de "auto-fill" — con auto-fill
  // cada llamada a GridItems (una por sección/año) es su propia rejilla
  // independiente, y basta una pequeña diferencia de ancho disponible entre
  // una y otra (p.ej. el padding extra de la franja de cada año dentro de
  // Leídos) para que el número de columnas calculado no coincida, y las
  // portadas salgan de tamaños distintos entre secciones. Con un número fijo
  // el tamaño es siempre el mismo, sin importar el padding de cada bloque.
  const columns = isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fill, minmax(120px, 1fr))'

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: columns,
      gap: 16, alignContent: 'start',
    }}>
      <AnimatePresence>
      {books.map(e => {
        const highlighted = isHighlighted(e)
        const expanded = renderActions && expandedId === e.id
        return (
          <motion.div key={e.id} layout exit={BOOK_DELETE_EXIT} transition={BOOK_DELETE_TRANSITION}
            onClick={() => renderActions ? setExpandedId(id => id === e.id ? null : e.id) : onSelect(e)}
            style={{ cursor: 'pointer' }}
            onMouseEnter={ev => {
              const cover = ev.currentTarget.querySelector('.card-cover')
              cover.style.transform = 'scale(1.04)'
              cover.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)'
            }}
            onMouseLeave={ev => {
              const cover = ev.currentTarget.querySelector('.card-cover')
              cover.style.transform = 'scale(1)'
              // Restaura el anillo de "leyendo" si lo tenía — si no, al pasar el
              // ratón se perdía para siempre hasta el siguiente render.
              cover.style.boxShadow = highlighted ? `0 0 0 2px ${C.accent}, 0 2px 8px rgba(0,0,0,0.3)` : '0 2px 8px rgba(0,0,0,0.3)'
            }}
          >
            <div className="card-cover" style={{
              width: '100%', aspectRatio: '2/3', borderRadius: 8,
              overflow: 'hidden', background: C.surfaceHi, position: 'relative',
              boxShadow: highlighted ? `0 0 0 2px ${C.accent}, 0 2px 8px rgba(0,0,0,0.3)` : '0 2px 8px rgba(0,0,0,0.3)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}>
              <Cover url={e.book.cover_url} w="100%" h="100%" radius={0} />
              {highlighted && (
                <span style={{
                  position: 'absolute', top: 5, right: 5,
                  background: C.accent, borderRadius: '50%',
                  width: 19, height: 19, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                }}><IconBookmark size={10} color="white" /></span>
              )}

              {/* Panel de acciones — se despliega hacia arriba desde abajo, sobre la
                  propia portada (no debajo), mismo contenido que en la vista lista */}
              {renderActions && (
                <div
                  onClick={ev => ev.stopPropagation()}
                  style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0,
                    height: expanded ? 46 : 0, opacity: expanded ? 1 : 0,
                    overflow: 'hidden', cursor: 'default',
                    background: 'rgba(15,10,6,0.92)', backdropFilter: 'blur(3px)',
                    borderTop: expanded ? `1px solid ${C.border}` : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'height 0.22s ease, opacity 0.18s ease',
                  }}
                >
                  {renderActions(e)}
                </div>
              )}
            </div>
          </motion.div>
        )
      })}
      </AnimatePresence>
    </div>
  )
}

// Envoltorio con scroll propio — usado por el Club, que no tiene secciones.
function GridView({ books, onSelect, isHighlighted, renderActions }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      <GridItems books={books} onSelect={onSelect} isHighlighted={isHighlighted} renderActions={renderActions} />
    </div>
  )
}

// ─── Estantería personal agrupada en secciones ────────────────────────────────
// Leyendo (fijado arriba, estilo "pin" igual que la lectura activa del Club)
// → Leídos (colapsable, agrupado por año de fin — desc, sin fecha al final)
// → Por leer (sin clasificar). El orden dentro de cada grupo sigue el "sort"
// elegido por el usuario; sin ninguno, los leídos se ordenan por fecha de fin
// descendente dentro de su año.
function ShelfGroupHeader({ icon: Icon, label, count, collapsible, collapsed, onToggle }) {
  return (
    <button
      onClick={collapsible ? onToggle : undefined}
      style={{
        width: '100%', background: 'none', border: 'none',
        borderBottom: `1px solid ${C.border}`,
        cursor: collapsible ? 'pointer' : 'default',
        padding: '8px 2px 9px', margin: '2px 0 8px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}
    >
      <span style={{
        display: 'inline-flex', flexShrink: 0, visibility: collapsible ? 'visible' : 'hidden',
        transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s',
      }}>
        <IconChevronDown size={10} color={C.muted} />
      </span>
      <Icon size={14} color={C.sub} />
      <span style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 12, color: C.muted }}>{count}</span>
    </button>
  )
}

function ShelfYearHeader({ label, count, collapsed, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: '100%', background: C.surfaceHi, border: 'none',
        borderLeft: `3px solid ${C.accent}`, borderRadius: 8, cursor: 'pointer',
        padding: '8px 10px', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 7,
      }}
    >
      <span style={{
        display: 'inline-flex', flexShrink: 0,
        transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s',
      }}>
        <IconChevronDown size={10} color={C.sub} />
      </span>
      <span style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 11, color: C.muted }}>{count}</span>
    </button>
  )
}

function PersonalShelfSections({ entries, viewMode, sort, onSelect, renderActions, collapsedReading, onToggleReadingCollapsed, collapsedRead, onToggleReadCollapsed, collapsedWant, onToggleWantCollapsed, collapsedYears, onToggleYear }) {

  const reading = entries.filter(e => e.status === 'reading')
  const read    = entries.filter(e => e.status === 'read')
  const want    = entries.filter(e => e.status === 'want_to_read')

  const yearGroups = {}
  for (const e of read) {
    const year = e.finished_at ? e.finished_at.slice(0, 4) : 'sin-fecha'
    ;(yearGroups[year] ||= []).push(e)
  }
  const years = Object.keys(yearGroups).filter(y => y !== 'sin-fecha').sort((a, b) => b.localeCompare(a))
  if (yearGroups['sin-fecha']) years.push('sin-fecha')

  // Sin orden explícito elegido: dentro de cada año, más reciente primero.
  if (!sort.field) {
    for (const y of years) {
      yearGroups[y] = [...yearGroups[y]].sort((a, b) => (b.finished_at || '').localeCompare(a.finished_at || ''))
    }
  }

  const Items = viewMode === 'grid' ? GridItems : ListRows

  if (reading.length === 0 && read.length === 0 && want.length === 0) {
    return <p style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 48 }}>Ningún libro coincide con los filtros</p>
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: viewMode === 'grid' ? '2px 16px 16px' : '2px 10px 10px' }}>
      {reading.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <ShelfGroupHeader icon={IconBookmark} label="Leyendo ahora" count={reading.length}
            collapsible collapsed={collapsedReading} onToggle={onToggleReadingCollapsed} />
          <AnimatePresence initial={false}>
            {!collapsedReading && (
              <motion.div key="reading-items" layout
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
                <Items books={reading} onSelect={onSelect} renderActions={renderActions} isHighlighted={() => true} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {read.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <ShelfGroupHeader icon={IconCheck} label="Leídos" count={read.length}
            collapsible collapsed={collapsedRead} onToggle={onToggleReadCollapsed} />
          <AnimatePresence initial={false}>
            {!collapsedRead && (
              <motion.div key="read-years" layout
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
                {years.map(y => (
                  <div key={y} style={{ marginBottom: 10 }}>
                    <ShelfYearHeader
                      label={y === 'sin-fecha' ? 'Sin fecha' : y}
                      count={yearGroups[y].length}
                      collapsed={collapsedYears.has(y)}
                      onToggle={() => onToggleYear(y)}
                    />
                    <AnimatePresence initial={false}>
                      {!collapsedYears.has(y) && (
                        <motion.div key="year-items" layout
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeInOut' }}
                        >
                          <div style={{ padding: viewMode === 'grid' ? '10px 6px' : '10px 4px' }}>
                            <Items books={yearGroups[y]} onSelect={onSelect} renderActions={renderActions} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {want.length > 0 && (
        <div>
          <ShelfGroupHeader icon={IconCircle} label="Por leer" count={want.length}
            collapsible collapsed={collapsedWant} onToggle={onToggleWantCollapsed} />
          <AnimatePresence initial={false}>
            {!collapsedWant && (
              <motion.div key="want-items" layout
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
              >
                <Items books={want} onSelect={onSelect} renderActions={renderActions} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// ─── Acciones admin del club en vista Netflix (mismos botones que en lista) ───
function ClubGridActions({ entry, onChoose, onEdit, onDelete }) {
  const [confirmDel, setConfirmDel] = useState(false)
  const isActive = entry.status === 'active'
  const btnStyle = {
    background: 'transparent', border: `1px solid ${C.border}`,
    borderRadius: 6, width: 32, height: 32, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  }

  return (
    <>
      {onChoose && (
        <button onClick={onChoose} title={isActive ? 'Desanclar' : 'Marcar como lectura actual'} style={{
          ...btnStyle,
          background: isActive ? C.accentBg : 'transparent',
          border: isActive ? `1px solid ${C.accentBd}` : `1px solid ${C.border}`,
          color: isActive ? C.accent : C.muted, fontSize: 12,
        }}>📌</button>
      )}
      <button onClick={onEdit} title="Editar" style={btnStyle}>
        <IconEdit size={12} color={C.muted} />
      </button>
      {!confirmDel
        ? <button onClick={() => setConfirmDel(true)} title="Eliminar" style={btnStyle}>
            <IconTrash size={12} color={C.muted} />
          </button>
        : <button onClick={() => { setConfirmDel(false); onDelete() }} title="Confirmar borrado" style={{
            ...btnStyle, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
            color: '#f87171', fontSize: 11,
          }}>✕</button>
      }
    </>
  )
}

// ─── Acciones rápidas de Mi estantería (lista y grid) ─────────────────────────
function ShelfGridActions({ onOpenDetail, onDelete }) {
  const [confirmDel, setConfirmDel] = useState(false)
  const btnStyle = {
    background: 'transparent', border: `1px solid ${C.border}`,
    borderRadius: 6, width: 32, height: 32, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  }

  return (
    <>
      {onOpenDetail && (
        <button onClick={onOpenDetail} title="Ver ficha" style={btnStyle}>
          <IconEdit size={12} color={C.muted} />
        </button>
      )}
      {!confirmDel
        ? <button onClick={() => setConfirmDel(true)} title="Eliminar" style={btnStyle}>
            <IconTrash size={12} color={C.muted} />
          </button>
        : <button onClick={() => { setConfirmDel(false); onDelete() }} title="Confirmar borrado" style={{
            ...btnStyle, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
            color: '#f87171', fontSize: 11,
          }}>✕</button>
      }
    </>
  )
}

// ─── Club tab ────────────────────────────────────────────────────────────────
const CLUB_SECTIONS = [
  { id: 'proposed', label: 'Propuestos' },
  { id: 'history',  label: 'Leídos'     },
]

function ClubBookCard({ entry, isAdmin, onDelete, onEdit, onChoose, onDetail }) {
  const book      = entry.book
  const by        = entry.proposed_by
  const isActive  = entry.status === 'active'
  const [confirmDel, setConfirmDel] = useState(false)

  return (
    <div
      onClick={onDetail || undefined}
      style={{
        display: 'flex', flexDirection: 'column', gap: 0,
        background: C.surface,
        border: isActive ? `1px solid ${C.accentBd}` : `1px solid ${C.border}`,
        borderRadius: 10, overflow: 'hidden',
        cursor: onDetail ? 'pointer' : 'default',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={onDetail ? e => e.currentTarget.style.borderColor = C.muted : undefined}
      onMouseLeave={onDetail ? e => e.currentTarget.style.borderColor = C.border : undefined}
    >
      {isActive && (
        <div style={{
          padding: '3px 12px', fontSize: 10, fontWeight: 700,
          background: C.accentBg, color: C.accent, letterSpacing: 0.5,
        }}>📌 Lectura actual</div>
      )}
      <div style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
        {/* Portada full-height */}
        <div style={{ width: 58, flexShrink: 0, alignSelf: 'stretch' }}>
          <Cover url={book.cover_url} w="100%" h="100%" radius={0} />
        </div>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0, padding: '9px 10px' }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</p>
          {book.author && <p style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{book.author}{book.year ? ` · ${book.year}` : ''}</p>}
          {by && (
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <PlayerBadge player={by} size={14} />
              <span style={{ color: by.color }}>{by.name}</span>
            </div>
          )}
          {entry.status === 'finished' && (
            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {(entry.activated_at || entry.read_date) && (
                <p style={{ fontSize: 10, color: C.muted, display: 'flex', gap: 8 }}>
                  {entry.activated_at && <span>{new Date(entry.activated_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                  {entry.activated_at && entry.read_date && <span style={{ color: C.border }}>→</span>}
                  {entry.read_date    && <span>{new Date(entry.read_date).toLocaleDateString('es',    { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                </p>
              )}
              {entry.session_count > 0 && (
                <p style={{ fontSize: 10, color: C.muted }}>{entry.session_count} sesión{entry.session_count !== 1 ? 'es' : ''}</p>
              )}
            </div>
          )}
          {entry.avg_rating != null && (
            <p style={{ fontSize: 10, color: '#f0b429', marginTop: 2 }}>
              {'★'.repeat(Math.round(entry.avg_rating))}{'☆'.repeat(5 - Math.round(entry.avg_rating))} {entry.avg_rating.toFixed(1)}
            </p>
          )}
          {entry.club_notes && (
            <p style={{ fontSize: 11, color: C.sub, marginTop: 4, fontStyle: 'italic' }}>{entry.club_notes}</p>
          )}
        </div>
        {/* Botones admin — fila horizontal, alineados arriba */}
        {isAdmin && (
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'row', gap: 4, padding: '9px 10px 9px 0', alignSelf: 'flex-start', flexShrink: 0 }}>
            {onChoose && (
              <button
                onClick={onChoose}
                title={isActive ? 'Desanclar' : 'Marcar como lectura actual'}
                style={{
                  background: isActive ? C.accentBg : 'transparent',
                  border: isActive ? `1px solid ${C.accentBd}` : `1px solid ${C.border}`,
                  borderRadius: 6, width: 26, height: 26, color: isActive ? C.accent : C.muted,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                }}>📌</button>
            )}
            {onEdit && (
              <button onClick={onEdit} title="Editar" style={{
                background: 'transparent', border: `1px solid ${C.border}`,
                borderRadius: 6, width: 26, height: 26,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><IconEdit size={12} color={C.muted} /></button>
            )}
            {!confirmDel
              ? <button onClick={() => setConfirmDel(true)} title="Eliminar" style={{
                  background: 'transparent', border: `1px solid ${C.border}`,
                  borderRadius: 6, width: 26, height: 26,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><IconTrash size={12} color={C.muted} /></button>
              : <button onClick={() => { setConfirmDel(false); onDelete() }} title="Confirmar borrado" style={{
                  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                  borderRadius: 6, width: 26, height: 26, color: '#f87171',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                }}>✕</button>
            }
          </div>
        )}
      </div>
    </div>
  )
}

const CLUB_STATUS_LABELS = {
  proposed: 'Propuesto',
  active:   'Lectura actual',
  finished: 'Leído',
}

function ClubBookEditForm({ entry, onSave, onCancel }) {
  const isMobile = useIsMobile()
  const book = entry.book
  const [title,        setTitle]       = useState(book.title        ?? '')
  const [author,       setAuthor]      = useState(book.author       ?? '')
  const [genre,        setGenre]       = useState(book.genre        ?? '')
  const [synopsis,     setSynopsis]    = useState(book.synopsis     ?? '')
  const [status,       setStatus]      = useState(entry.status      ?? 'proposed')
  const [activatedAt,  setStarted]     = useState(entry.activated_at ? entry.activated_at.slice(0, 10) : '')
  const [readDate,     setFinished]    = useState(entry.read_date   ? entry.read_date.slice(0, 10)   : '')
  const [proposedBy,   setProposedBy]  = useState(entry.proposed_by?.id ?? '')
  const [players,      setPlayers]     = useState([])
  const [coverUrl,     setCoverUrl]    = useState(null)
  const [coverFile,    setCoverFile]   = useState(null)
  const [coverPreview, setCoverPreview]= useState(null)
  const [showPicker,   setShowPicker]  = useState(false)
  const [saving,       setSaving]      = useState(false)

  useEffect(() => {
    fetch('/api/players', { credentials: 'include' })
      .then(r => r.json()).then(setPlayers).catch(() => {})
  }, [])

  const displayCover = coverPreview || coverUrl || book.cover_url
  const showDates    = status === 'finished' || status === 'active'

  async function save() {
    setSaving(true)
    // El libro del club tiene una única copia compartida — la portada que
    // elige el admin aquí sí se aplica para todos (a diferencia de la
    // estantería personal, donde cada uno elige la suya).
    let effectiveCoverUrl = coverUrl
    if (coverFile) {
      const fd = new FormData()
      fd.append('file', coverFile)
      const r = await fetch(`/api/books/${book.id}/cover`, {
        method: 'POST', credentials: 'include', body: fd,
      })
      if (r.ok) effectiveCoverUrl = (await r.json()).url
    }
    await fetch(`/api/books/${book.id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:    title    || null,
        author:   author   || null,
        genre:    genre    || null,
        synopsis: synopsis || null,
        ...(effectiveCoverUrl ? { cover_url: effectiveCoverUrl } : {}),
      }),
    })
    const clubPatch = {
      activated_at: showDates ? (activatedAt || null) : null,
      read_date:    status === 'finished' ? (readDate || null) : null,
      ...(proposedBy ? { proposed_by: Number(proposedBy) } : {}),
    }
    await fetch(`/api/shelf/club/${entry.id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clubPatch),
    })
    if (status !== entry.status) {
      await fetch(`/api/shelf/club/${entry.id}/status`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
    }
    setSaving(false)
    onSave()
  }

  const inp = {
    style: {
      background: C.bg, border: `1px solid ${C.border}`,
      borderRadius: 7, padding: '6px 9px', color: C.text, fontSize: 12,
      outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', width: '100%',
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <AnimatePresence>
        {showPicker && (
          <CoverPicker
            book={book}
            currentUrl={displayCover}
            onSelectUrl={url => { setCoverUrl(url); setCoverFile(null); setCoverPreview(null); setShowPicker(false) }}
            onSelectFile={file => { setCoverFile(file); setCoverPreview(URL.createObjectURL(file)); setCoverUrl(null); setShowPicker(false) }}
            onClose={() => setShowPicker(false)}
          />
        )}
      </AnimatePresence>
      <div style={{
        background: C.surface, border: `1px solid ${C.accentBd}`,
        borderRadius: 10, padding: '13px 14px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {/* Portada + título/autor */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ width: 52, height: 76, borderRadius: 5, overflow: 'hidden', border: `1px solid ${C.border}` }}>
              <Cover url={displayCover} w="100%" h="100%" radius={0} />
            </div>
            <button onClick={() => setShowPicker(true)} style={{
              background: 'transparent', border: `1px solid ${C.border}`,
              borderRadius: 5, padding: '3px 0', color: C.muted, fontSize: 10,
              cursor: 'pointer', width: 52, textAlign: 'center',
            }}>Portada</button>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              <p style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>Título</p>
              <input value={title} onChange={e => setTitle(e.target.value)} {...inp} />
            </div>
            <div>
              <p style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>Autor</p>
              <input value={author} onChange={e => setAuthor(e.target.value)} {...inp} />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 6 }}>
          <div>
            <p style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>Género</p>
            <select value={genre} onChange={e => setGenre(e.target.value)} style={{ ...inp.style }}>
              <option value="">Sin género</option>
              {GENRE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <p style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>Estado</p>
            <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inp.style }}>
              {Object.entries(CLUB_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <p style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>Propuesto por</p>
          <select value={proposedBy} onChange={e => setProposedBy(e.target.value)} style={{ ...inp.style }}>
            <option value="">Sin asignar</option>
            {players.map(p => (
              <option key={p.id} value={p.id}>{p.avatar_emoji} {p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <p style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>Sinopsis</p>
          <textarea value={synopsis} onChange={e => setSynopsis(e.target.value)} rows={3}
            style={{ ...inp.style, resize: 'vertical', lineHeight: 1.5 }} />
        </div>

        {showDates && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 6 }}>
            <div>
              <p style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>Inicio lectura</p>
              <input type="date" value={activatedAt} onChange={e => setStarted(e.target.value)} {...inp} />
            </div>
            {status === 'finished' && (
              <div>
                <p style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>Fin lectura</p>
                <input type="date" value={readDate} onChange={e => setFinished(e.target.value)} {...inp} />
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            background: 'transparent', border: `1px solid ${C.border}`,
            borderRadius: 7, padding: '5px 12px', color: C.sub, fontSize: 12, cursor: 'pointer',
          }}>Cancelar</button>
          <button onClick={save} disabled={saving} style={{
            background: C.accentBg, border: `1px solid ${C.accentBd}`,
            borderRadius: 7, padding: '5px 14px', color: C.accent, fontSize: 12,
            fontWeight: 600, cursor: 'pointer',
          }}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

function SessionCard({ session, isAdmin, onDelete, onEdit }) {
  const [confirmDel, setConfirmDel] = useState(false)
  const dateStr = session.date
    ? new Date(session.date + 'T12:00').toLocaleDateString('es', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '—'
  const timeRange = [session.start_time, session.end_time].filter(Boolean).join(' – ')

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: '10px 13px',
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: 0, textTransform: 'capitalize' }}>{dateStr}</p>
          {timeRange && <span style={{ fontSize: 11, color: C.muted }}>{timeRange}</span>}
        </div>
        {session.book && (
          <p style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>📖 {session.book.title}</p>
        )}
        {session.part_to_discuss && (
          <p style={{ fontSize: 11, color: C.accent, marginTop: 3, fontWeight: 500 }}>Parte: {session.part_to_discuss}</p>
        )}
        {session.notes && (
          <p style={{ fontSize: 11, color: C.sub, marginTop: 4, fontStyle: 'italic', lineHeight: 1.5 }}>{session.notes}</p>
        )}
      </div>
      {isAdmin && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={onEdit} title="Editar" style={{
            background: 'transparent', border: `1px solid ${C.border}`,
            borderRadius: 6, width: 26, height: 26, color: C.muted,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><IconEdit size={12} color={C.muted} /></button>
          {!confirmDel
            ? <button onClick={() => setConfirmDel(true)} title="Eliminar" style={{
                background: 'transparent', border: `1px solid ${C.border}`,
                borderRadius: 6, width: 26, height: 26, color: C.muted,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><IconTrash size={12} color={C.muted} /></button>
            : <button onClick={() => { setConfirmDel(false); onDelete() }} title="Confirmar borrado" style={{
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: 6, width: 26, height: 26, color: '#f87171',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
              }}>✕</button>
          }
        </div>
      )}
    </div>
  )
}

function SessionForm({ allBooks, fixedClubShelfId, initial, onSave, onCancel }) {
  const isMobile = useIsMobile()
  const [date,           setDate]    = useState(initial?.date           ?? '')
  const [start_time,     setStart]   = useState(initial?.start_time     ?? '')
  const [end_time,       setEnd]     = useState(initial?.end_time       ?? '')
  const [club_shelf_id,  setShelfId] = useState(initial?.club_shelf_id  ?? fixedClubShelfId ?? '')
  const [part_to_discuss,setPart]    = useState(initial?.part_to_discuss ?? '')
  const [notes,          setNotes]   = useState(initial?.notes          ?? '')
  const [saving,         setSaving]  = useState(false)

  async function save() {
    if (!date) return
    setSaving(true)
    await onSave({
      date,
      start_time:      start_time      || null,
      end_time:        end_time        || null,
      club_shelf_id:   club_shelf_id   || null,
      part_to_discuss: part_to_discuss || null,
      notes:           notes           || null,
    })
    setSaving(false)
  }

  const inp = {
    style: {
      background: C.bg, border: `1px solid ${C.border}`,
      borderRadius: 7, padding: '6px 9px', color: C.text, fontSize: 12,
      outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', width: '100%',
    }
  }

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.accentBd}`,
      borderRadius: 10, padding: '13px 14px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 6 }}>
        <div>
          <p style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>Día</p>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} {...inp} />
        </div>
        <div>
          <p style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>Hora inicio</p>
          <input type="time" value={start_time} onChange={e => setStart(e.target.value)} {...inp} />
        </div>
        <div>
          <p style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>Hora fin</p>
          <input type="time" value={end_time} onChange={e => setEnd(e.target.value)} {...inp} />
        </div>
      </div>
      {!fixedClubShelfId && (
        <div>
          <p style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>Libro</p>
          <select value={club_shelf_id} onChange={e => setShelfId(e.target.value)} style={{ ...inp.style }}>
            <option value="">Sin libro asociado</option>
            {(allBooks || []).map(b => <option key={b.id} value={b.id}>{b.book.title}</option>)}
          </select>
        </div>
      )}
      <div>
        <p style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>Parte a comentar</p>
        <input value={part_to_discuss} onChange={e => setPart(e.target.value)} placeholder="Ej: Capítulos 1–5, Parte II…" {...inp} />
      </div>
      <div>
        <p style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>Notas</p>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas adicionales…" rows={2}
          style={{ ...inp.style, resize: 'vertical', lineHeight: 1.5 }} />
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{
          background: 'transparent', border: `1px solid ${C.border}`,
          borderRadius: 7, padding: '5px 12px', color: C.sub, fontSize: 12, cursor: 'pointer',
        }}>Cancelar</button>
        <button onClick={save} disabled={!date || saving} style={{
          background: C.accentBg, border: `1px solid ${C.accentBd}`,
          borderRadius: 7, padding: '5px 14px', color: C.accent, fontSize: 12,
          fontWeight: 600, cursor: date ? 'pointer' : 'default', opacity: date ? 1 : 0.5,
        }}>Guardar</button>
      </div>
    </div>
  )
}

function ClubBookDetail({ entry, isAdmin, onBack, onEntryUpdated }) {
  const book = entry.book
  const by   = entry.proposed_by
  const [sessions,     setSessions]     = useState([])
  const [loadingSess,  setLoadingSess]  = useState(true)
  const [addingSession,setAddingSession]= useState(false)
  const [editSession,  setEditSession]  = useState(null)

  function loadSessions() {
    setLoadingSess(true)
    fetch(`/api/sessions?club_shelf_id=${entry.id}`, { credentials: 'include' })
      .then(r => r.json()).then(setSessions).finally(() => setLoadingSess(false))
  }

  useEffect(() => { loadSessions() }, [entry.id])

  // Sincronización en vivo: sesiones creadas/editadas/borradas por el admin
  // (viendo esta misma ficha desde otro dispositivo) refrescan sin recargar.
  useEffect(() => {
    function onWs(ev) {
      const msg = ev.detail
      if (msg.type === 'luni_update' && msg.scope === 'sessions' && msg.club_shelf_id === entry.id) {
        loadSessions()
      }
    }
    window.addEventListener('luni:ws', onWs)
    return () => window.removeEventListener('luni:ws', onWs)
  }, [entry.id])

  async function saveSession(data) {
    const url    = editSession ? `/api/sessions/${editSession.id}` : '/api/sessions'
    const method = editSession ? 'PATCH' : 'POST'
    await fetch(url, {
      method, credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    setEditSession(null)
    setAddingSession(false)
    loadSessions()
    onEntryUpdated?.()
  }

  async function deleteSession(id) {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE', credentials: 'include' })
    loadSessions()
    onEntryUpdated?.()
  }

  const fmt = iso => iso
    ? new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Nav */}
      <div style={{
        padding: '8px 12px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', color: C.sub, cursor: 'pointer',
          padding: 4, display: 'flex', alignItems: 'center', borderRadius: 7,
          transition: 'color 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.color = C.text}
          onMouseLeave={e => e.currentTarget.style.color = C.sub}
        >
          <IconBack size={16} color="currentColor" />
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</span>
        {isAdmin && (
          <button onClick={() => { setAddingSession(true); setEditSession(null) }} style={{
            background: C.accent, border: 'none', borderRadius: 8,
            width: 28, height: 24, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IconPlus size={12} color="white" />
          </button>
        )}
      </div>

      {/* Contenido scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 20px' }}>

        {/* Info del libro */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
          {/* Portada */}
          <div style={{ width: 80, flexShrink: 0, borderRadius: 7, overflow: 'hidden', border: `1px solid ${C.border}`, aspectRatio: '2/3' }}>
            <Cover url={book.cover_url} w="100%" h="100%" radius={0} />
          </div>
          {/* Meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.text, lineHeight: 1.3, marginBottom: 3 }}>{book.title}</p>
            {book.author && <p style={{ fontSize: 12, color: C.sub }}>{book.author}{book.year ? ` · ${book.year}` : ''}</p>}
            {book.genre  && <p style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{book.genre}</p>}
            {(entry.activated_at || entry.read_date) && (
              <p style={{ fontSize: 11, color: C.muted, marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {entry.activated_at && <span>{fmt(entry.activated_at)}</span>}
                {entry.activated_at && entry.read_date && <span style={{ color: C.border }}>→</span>}
                {entry.read_date    && <span>{fmt(entry.read_date)}</span>}
              </p>
            )}
            {by && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                <PlayerBadge player={by} size={16} />
                <span style={{ color: by.color }}>{by.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Sinopsis */}
        {book.synopsis && (
          <p style={{
            fontSize: 12, color: C.sub, lineHeight: 1.6, marginBottom: 16,
            padding: '10px 12px', background: C.surface,
            borderRadius: 8, border: `1px solid ${C.border}`,
          }}>{book.synopsis}</p>
        )}

        {/* Notas del club */}
        {entry.club_notes && (
          <p style={{ fontSize: 12, color: C.sub, fontStyle: 'italic', marginBottom: 16 }}>{entry.club_notes}</p>
        )}

        {/* Sesiones */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Sesiones {sessions.length > 0 && `· ${sessions.length}`}
          </p>
        </div>

        {isAdmin && (addingSession || editSession) && (
          <div style={{ marginBottom: 10 }}>
            <SessionForm
              fixedClubShelfId={entry.id}
              initial={editSession}
              onSave={saveSession}
              onCancel={() => { setAddingSession(false); setEditSession(null) }}
            />
          </div>
        )}

        {loadingSess && <p style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: 20 }}>Cargando…</p>}

        {!loadingSess && sessions.length === 0 && !addingSession && (
          <p style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: 20, fontStyle: 'italic' }}>
            Aún no hay sesiones registradas para este libro.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sessions.map(s => (
            <SessionCard
              key={s.id} session={s} isAdmin={isAdmin}
              onEdit={() => { setEditSession(s); setAddingSession(false) }}
              onDelete={() => deleteSession(s.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ClubTab({ player }) {
  const isAdmin = player?.name?.toLowerCase() === 'wander'
  const [section,      setSection]     = useState('proposed')
  const [proposed,     setProposed]    = useState([])
  const [history,      setHistory]     = useState([])
  const [loading,      setLoading]     = useState(false)
  const [showSearch,   setShowSearch]  = useState(false)
  const [addType,      setAddType]     = useState('proposed')
  const [editEntry,    setEditEntry]   = useState(null)
  const [detailEntry,  setDetailEntry] = useState(null)
  const [showAddMenu,  setShowAddMenu] = useState(false)

  const vmKey = `luni_club_viewmode_${player.id}`
  const [viewMode, setViewMode] = useState(() => localStorage.getItem(vmKey) || 'list')
  // Cambio de vista elegido por el usuario — se recuerda entre sesiones.
  function changeViewMode(mode) {
    localStorage.setItem(vmKey, mode)
    setViewMode(mode)
  }
  // Vista que había antes de forzar "lista" para editar desde la cuadrícula
  // (el formulario de edición solo se muestra en vista lista). Al terminar
  // (guardar o cancelar) se restaura sin tocar la preferencia guardada.
  const [viewModeBeforeEdit, setViewModeBeforeEdit] = useState(null)
  function startEdit(entry) {
    setEditEntry(entry)
    if (viewMode !== 'list') {
      setViewModeBeforeEdit(viewMode)
      setViewMode('list')
    }
  }
  function closeEdit() {
    setEditEntry(null)
    if (viewModeBeforeEdit !== null) {
      setViewMode(viewModeBeforeEdit)
      setViewModeBeforeEdit(null)
    }
  }
  const [filters,     setFilters]     = useState(EMPTY_CLUB_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [sort,        setSort]        = useState({ field: '', dir: 'asc' })
  const [showSort,    setShowSort]    = useState(false)
  const sortMenuRef = useOutsideClose(showSort, () => setShowSort(false))
  const addMenuRef  = useOutsideClose(showAddMenu, () => setShowAddMenu(false))

  // Años del historial ("Leídos") colapsados/expandidos — igual que en Mi
  // estantería, persistido en localStorage para recordarlo entre sesiones.
  const clubYearsCollapsedKey = `luni_club_years_collapsed_${player.id}`
  const [collapsedClubYears, setCollapsedClubYears] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(clubYearsCollapsedKey)) || []) }
    catch { return new Set() }
  })
  function persistClubYears(next) {
    localStorage.setItem(clubYearsCollapsedKey, JSON.stringify([...next]))
    return next
  }
  function toggleClubYear(y) {
    setCollapsedClubYears(prev => {
      const next = new Set(prev)
      next.has(y) ? next.delete(y) : next.add(y)
      return persistClubYears(next)
    })
  }

  function loadSection(sec) {
    setLoading(true)
    if (sec === 'proposed') {
      Promise.all([
        fetch('/api/shelf/club?status=active',   { credentials: 'include' }).then(r => r.json()),
        fetch('/api/shelf/club?status=proposed', { credentials: 'include' }).then(r => r.json()),
      ]).then(([active, prop]) => {
        setProposed([...active, ...prop])
      }).finally(() => setLoading(false))
    } else {
      fetch('/api/shelf/club?status=finished', { credentials: 'include' })
        .then(r => r.json()).then(setHistory)
        .finally(() => setLoading(false))
    }
  }

  function refreshHistory() {
    fetch('/api/shelf/club?status=finished', { credentials: 'include' })
      .then(r => r.json()).then(setHistory).catch(() => {})
  }

  useEffect(() => { loadSection(section) }, [section])
  useEffect(() => { refreshHistory() }, [])

  // Sincronización en vivo: libros propuestos/activados/finalizados o
  // borrados por cualquiera (o cambios de perfil) refrescan la lista sola.
  useEffect(() => {
    function onWs(ev) {
      const msg = ev.detail
      if (msg.type === 'luni_update' && (msg.scope === 'club' || msg.scope === 'players')) {
        loadSection(section)
        refreshHistory()
      }
    }
    window.addEventListener('luni:ws', onWs)
    return () => window.removeEventListener('luni:ws', onWs)
  }, [section])

  function openAdd(type) {
    setShowAddMenu(false)
    setAddType(type)
    setShowSearch(true)
  }

  async function addBook(book) {
    await fetch('/api/shelf/club', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...book, initial_status: addType }),
    })
    setShowSearch(false)
    loadSection(addType === 'finished' ? 'history' : 'proposed')
    if (addType === 'finished') refreshHistory()
  }

  async function deleteBook(id) {
    await fetch(`/api/shelf/club/${id}`, { method: 'DELETE', credentials: 'include' })
    loadSection(section)
  }

  async function chooseBook(id, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'proposed' : 'active'
    await fetch(`/api/shelf/club/${id}/status`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    loadSection('proposed')
  }

  const items = section === 'proposed' ? proposed : history

  const filtered = items.filter(e => {
    if (filters.author && e.book.author !== filters.author) return false
    if (filters.genre && e.book.genre !== filters.genre) return false
    if (filters.proposedBy && String(e.proposed_by?.id ?? '') !== filters.proposedBy) return false
    return true
  })

  const sorted = sort.field ? [...filtered].sort((a, b) => {
    let va, vb
    if (sort.field === 'title')      { va = a.book.title?.toLowerCase()        || ''; vb = b.book.title?.toLowerCase()        || '' }
    if (sort.field === 'author')     { va = a.book.author?.toLowerCase()       || ''; vb = b.book.author?.toLowerCase()       || '' }
    if (sort.field === 'genre')      { va = a.book.genre?.toLowerCase()        || ''; vb = b.book.genre?.toLowerCase()        || '' }
    if (sort.field === 'proposedBy') { va = a.proposed_by?.name?.toLowerCase() || ''; vb = b.proposed_by?.name?.toLowerCase() || '' }
    if (sort.field === 'date')       { va = a.read_date || a.activated_at     || ''; vb = b.read_date || b.activated_at     || '' }
    if (va < vb) return sort.dir === 'asc' ? -1 : 1
    if (va > vb) return sort.dir === 'asc' ?  1 : -1
    return 0
  }) : filtered

  const activeFiltersCount = Object.keys(EMPTY_CLUB_FILTERS).filter(k => filters[k] !== EMPTY_CLUB_FILTERS[k]).length

  // Historial ("Leídos") agrupado por año de lectura — igual que Leídos en Mi
  // estantería. "Propuestos" no se agrupa (no tiene fecha de fin relevante).
  const historyYearGroups = {}
  if (section === 'history') {
    for (const e of sorted) {
      const year = e.read_date ? e.read_date.slice(0, 4) : 'sin-fecha'
      ;(historyYearGroups[year] ||= []).push(e)
    }
  }
  const historyYears = Object.keys(historyYearGroups).filter(y => y !== 'sin-fecha').sort((a, b) => b.localeCompare(a))
  if (historyYearGroups['sin-fecha']) historyYears.push('sin-fecha')

  const anyClubYearExpanded = historyYears.some(y => !collapsedClubYears.has(y))
  function toggleAllClubCollapsed() {
    setCollapsedClubYears(persistClubYears(anyClubYearExpanded ? new Set(historyYears) : new Set()))
  }

  function toggleSort(field) {
    setSort(s => s.field === field
      ? s.dir === 'asc' ? { field, dir: 'desc' } : { field: '', dir: 'asc' }
      : { field, dir: 'asc' }
    )
    setShowSort(false)
  }

  const isEmpty = !loading && sorted.length === 0 && !editEntry

  // Filas/tarjetas de una lista de entradas — usado tanto para "Propuestos"
  // (lista plana) como para cada bloque de año dentro de "Leídos".
  function renderClubEntries(list) {
    if (viewMode === 'grid') {
      return <GridItems books={list} onSelect={setDetailEntry} />
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <AnimatePresence>
        {list.map(entry => (
          <motion.div key={entry.id} layout exit={BOOK_DELETE_EXIT} transition={BOOK_DELETE_TRANSITION}>
            {editEntry?.id === entry.id
              ? <ClubBookEditForm
                  entry={editEntry}
                  onSave={() => {
                    closeEdit()
                    loadSection('proposed')
                    refreshHistory()
                  }}
                  onCancel={closeEdit}
                />
              : <ClubBookCard
                  entry={entry} isAdmin={isAdmin}
                  onDelete={() => deleteBook(entry.id)}
                  onChoose={section === 'proposed' ? () => chooseBook(entry.id, entry.status) : null}
                  onEdit={() => startEdit(entry)}
                  onDetail={section === 'history' ? () => setDetailEntry(entry) : null}
                />
            }
          </motion.div>
        ))}
        </AnimatePresence>
      </div>
    )
  }

  if (detailEntry) {
    return (
      <motion.div key="detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}
        style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <ClubBookDetail
          entry={detailEntry}
          isAdmin={isAdmin}
          onBack={() => { setDetailEntry(null); loadSection('history') }}
          onEntryUpdated={refreshHistory}
        />
      </motion.div>
    )
  }

  return (
    <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Cabecera */}
      <div style={{ padding: '8px 12px 0', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: C.text, fontWeight: 600, flex: 1 }}>Club</span>

          {/* Botón colapsar/expandir todo — solo en "Leídos", que es lo único agrupado por año */}
          {section === 'history' && historyYears.length > 0 && (
            <button onClick={toggleAllClubCollapsed} title={anyClubYearExpanded ? 'Colapsar todo' : 'Expandir todo'} style={{
              background: C.surfaceHi, border: '1px solid transparent',
              borderRadius: 8, width: 32, height: 28, color: C.muted,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s', flexShrink: 0,
            }}>
              <IconCollapseAll color={C.muted} expand={!anyClubYearExpanded} />
            </button>
          )}

          {/* Botón filtros — solo icono */}
          <button onClick={() => setShowFilters(true)} title="Filtros" style={{
            position: 'relative',
            background: activeFiltersCount > 0 ? C.accentBg : C.surfaceHi,
            border: `1px solid ${activeFiltersCount > 0 ? C.accentBd : 'transparent'}`,
            borderRadius: 8, width: 28, height: 24,
            color: activeFiltersCount > 0 ? C.accent : C.muted,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s', flexShrink: 0,
          }}>
            <IconFilter size={12} color={activeFiltersCount > 0 ? C.accent : C.muted} />
            {activeFiltersCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                background: C.accent, color: 'white', borderRadius: '50%',
                width: 13, height: 13, fontSize: 8, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              }}>{activeFiltersCount}</span>
            )}
          </button>

          {/* Botón ordenación */}
          <div ref={sortMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setShowSort(v => !v)} title="Ordenar" style={{
              background: sort.field ? C.accentBg : C.surfaceHi,
              border: `1px solid ${sort.field ? C.accentBd : 'transparent'}`,
              borderRadius: 8, width: 28, height: 24,
              color: sort.field ? C.accent : C.muted,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}>
              <IconSort size={12} color={sort.field ? C.accent : C.muted} />
            </button>
            {showSort && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 10, overflow: 'hidden', minWidth: 160,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 50,
              }}>
                {[
                  { field: 'title',      label: 'Título'         },
                  { field: 'author',     label: 'Autor'          },
                  { field: 'genre',      label: 'Género'         },
                  { field: 'proposedBy', label: 'Propuesto por'  },
                  ...(section === 'history' ? [{ field: 'date', label: 'Fecha' }] : []),
                ].map(({ field, label }) => {
                  const active = sort.field === field
                  const arrow  = active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''
                  return (
                    <button key={field} onClick={() => toggleSort(field)} style={{
                      width: '100%', background: active ? C.accentBg : 'transparent',
                      border: 'none', padding: '9px 14px', textAlign: 'left',
                      color: active ? C.accent : C.sub, fontSize: 12, cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      transition: 'background 0.1s',
                    }}
                      onMouseEnter={ev => { if (!active) ev.currentTarget.style.background = C.surfaceHi }}
                      onMouseLeave={ev => { if (!active) ev.currentTarget.style.background = 'transparent' }}
                    >
                      <span>{label}</span>
                      {active && <span style={{ fontSize: 11, opacity: 0.8 }}>{arrow}</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Toggle lista/grid */}
          <div style={{ display: 'flex', gap: 2, background: C.surfaceHi, borderRadius: 8, padding: 3, flexShrink: 0 }}>
            {[['list', '☰'], ['grid', '⊞']].map(([mode, icon]) => (
              <button key={mode} onClick={() => changeViewMode(mode)} style={{
                background: viewMode === mode ? C.surface : 'transparent',
                border: 'none', borderRadius: 6, width: 26, height: 22,
                cursor: 'pointer', fontSize: 13,
                color: viewMode === mode ? C.text : C.muted,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}>{icon}</button>
            ))}
          </div>

          {isAdmin ? (
            <div ref={addMenuRef} style={{ position: 'relative' }}>
              <button onClick={() => setShowAddMenu(v => !v)} style={{
                background: C.accent, border: 'none', borderRadius: 8,
                width: 28, height: 24, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconPlus size={12} color="white" />
              </button>
              {showAddMenu && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 10, overflow: 'hidden', minWidth: 180,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.45)', zIndex: 50,
                }}>
                  {[
                    { type: 'proposed', label: 'Proponer libro',     icon: '📋' },
                    { type: 'finished', label: 'Añadir libro leído', icon: '📖' },
                  ].map(({ type, label, icon }) => (
                    <button key={type} onClick={() => openAdd(type)} style={{
                      width: '100%', background: 'transparent', border: 'none',
                      padding: '9px 13px', textAlign: 'left', cursor: 'pointer',
                      color: C.sub, fontSize: 12,
                      display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.1s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = C.surfaceHi}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: 14 }}>{icon}</span>{label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => openAdd('proposed')} title="Proponer libro" style={{
              background: C.accent, border: 'none', borderRadius: 8,
              width: 28, height: 24, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconPlus size={12} color="white" />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {CLUB_SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)} style={{
              background: section === s.id ? C.accentBg : 'transparent',
              border: `1px solid ${section === s.id ? C.accentBd : 'transparent'}`,
              borderRadius: '7px 7px 0 0', padding: '5px 11px', cursor: 'pointer',
              color: section === s.id ? C.accent : C.sub, fontSize: 12,
              fontWeight: section === s.id ? 600 : 400, transition: 'all 0.15s',
            }}>{s.label}</button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <p style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 40 }}>Cargando…</p>}

        {isEmpty && (
          <p style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 40 }}>
            {items.length === 0
              ? (section === 'proposed' ? 'No hay libros propuestos aún' : 'El club no tiene libros leídos aún')
              : 'Ningún libro coincide con los filtros'}
          </p>
        )}

        {!loading && sorted.length > 0 && (
          <motion.div key={viewMode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
            {section === 'history' ? (
              <div style={{ padding: viewMode === 'grid' ? '2px 16px 16px' : '2px 10px 10px' }}>
                {historyYears.map(y => (
                  <div key={y} style={{ marginBottom: 10 }}>
                    <ShelfYearHeader
                      label={y === 'sin-fecha' ? 'Sin fecha' : y}
                      count={historyYearGroups[y].length}
                      collapsed={collapsedClubYears.has(y)}
                      onToggle={() => toggleClubYear(y)}
                    />
                    <AnimatePresence initial={false}>
                      {!collapsedClubYears.has(y) && (
                        <motion.div key="club-year-items" layout
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeInOut' }}
                        >
                          <div style={{ padding: viewMode === 'grid' ? '10px 6px' : '10px 4px' }}>
                            {renderClubEntries(historyYearGroups[y])}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            ) : (
              viewMode === 'grid'
                ? (
                  <GridView books={sorted} onSelect={() => {}}
                    isHighlighted={e => e.status === 'active'}
                    renderActions={isAdmin ? (entry) => (
                      <ClubGridActions
                        entry={entry}
                        onChoose={() => chooseBook(entry.id, entry.status)}
                        onEdit={() => startEdit(entry)}
                        onDelete={() => deleteBook(entry.id)}
                      />
                    ) : undefined}
                  />
                )
                : (
                  <div style={{ padding: '10px 12px' }}>{renderClubEntries(sorted)}</div>
                )
            )}
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showSearch && (
          <SearchOverlay
            onClose={() => setShowSearch(false)}
            onAdd={addBook}
            hint={addType === 'finished' ? 'Añadiendo libro al historial del club' : 'Proponiendo libro al club de lectura'}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFilters && (
          <ClubFilterModal
            filters={filters}
            onApply={setFilters}
            onClose={() => setShowFilters(false)}
            items={items}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Amigos tab ───────────────────────────────────────────────────────────────
function timeAgo(isoString) {
  if (!isoString) return ''
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60)   return 'ahora mismo'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  const days = Math.floor(diff / 86400)
  if (days === 1)  return 'ayer'
  if (days < 7)   return `hace ${days} días`
  if (days < 30)  return `hace ${Math.floor(days / 7)} semanas`
  if (days < 365) return `hace ${Math.floor(days / 30)} meses`
  return `hace ${Math.floor(days / 365)} años`
}

function renderStars(rating) {
  if (!rating) return null
  const full  = Math.floor(rating)
  const half  = rating % 1 >= 0.5
  return (
    <span style={{ color: '#f0b429', fontSize: 11, letterSpacing: 1 }}>
      {'★'.repeat(full)}{half ? '½' : ''}{'☆'.repeat(5 - full - (half ? 1 : 0))}
    </span>
  )
}

const EVENT_TEXT = {
  added:    (name, title) => <><strong style={{ color: C.text }}>{name}</strong> añadió <em>«{title}»</em> a su estantería</>,
  started:  (name, title) => <><strong style={{ color: C.text }}>{name}</strong> empezó a leer <em>«{title}»</em></>,
  finished: (name, title) => <><strong style={{ color: C.text }}>{name}</strong> terminó <em>«{title}»</em></>,
  proposed: (name, title) => <><strong style={{ color: C.text }}>{name}</strong> propuso <em>«{title}»</em> al club</>,
}

const PAGE = 50

function AmigosTab({ player }) {
  const [feed,     setFeed]     = useState([])
  const [hasMore,  setHasMore]  = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  function fetchPage(offset, append) {
    const setter = append ? setLoadingMore : setLoading
    setter(true)
    fetch(`/api/activity/feed?limit=${PAGE}&offset=${offset}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const items = data.items || []
        setFeed(prev => append ? [...prev, ...items] : items)
        setHasMore(data.has_more || false)
      })
      .finally(() => setter(false))
  }

  useEffect(() => { fetchPage(0, false) }, [])

  // Sincronización en vivo: actividad de lectura o de perfil de cualquier
  // jugador (otra pestaña/dispositivo) refresca este feed sin recargar.
  useEffect(() => {
    function onWs(ev) {
      const msg = ev.detail
      if (msg.type === 'luni_update' && (msg.scope === 'activity' || msg.scope === 'players')) {
        fetchPage(0, false)
      }
    }
    window.addEventListener('luni:ws', onWs)
    return () => window.removeEventListener('luni:ws', onWs)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Cabecera */}
      <div style={{
        padding: '11px 16px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, color: C.text, fontWeight: 600, flex: 1 }}>Actividad de amigos</span>
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {loading && (
          <p style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 40 }}>Cargando…</p>
        )}
        {!loading && feed.length === 0 && (
          <p style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 40 }}>
            Aún no hay actividad. ¡Añade libros a tu estantería!
          </p>
        )}
        {feed.map(item => {
          const isMe  = item.player?.id === player?.id
          const name  = item.player?.name  || '?'
          const color = item.player?.color || C.sub
          const title = item.book?.title           || '?'
          const cover = item.book?.cover_url
          const textFn = EVENT_TEXT[item.event_type]
          return (
            <div key={item.id} style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
              background: isMe ? C.accentBg : C.surface,
              border: `1px solid ${isMe ? C.accentBd : C.border}`,
              borderRadius: 10, padding: '9px 11px',
            }}>
              {/* Cover miniatura */}
              <div style={{ width: 36, height: 52, flexShrink: 0 }}>
                <Cover url={cover} w="100%" h="100%" radius={4} />
              </div>

              {/* Texto */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <span style={{ fontSize: 12, color, fontWeight: 700, letterSpacing: 0.2 }}>{name}</span>
                  {isMe && <span style={{ fontSize: 9, color: C.muted, background: C.surfaceHi, borderRadius: 4, padding: '1px 5px' }}>tú</span>}
                </div>
                <p style={{ fontSize: 12, color: C.sub, lineHeight: 1.4, margin: 0 }}>
                  {textFn ? textFn(name, title) : item.event_type}
                </p>
                {item.event_type === 'finished' && item.rating && (
                  <div style={{ marginTop: 4 }}>{renderStars(item.rating)}</div>
                )}
                <p style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{timeAgo(item.created_at)}</p>
              </div>
            </div>
          )
        })}

        {/* Cargar más */}
        {hasMore && (
          <button
            onClick={() => fetchPage(feed.length, true)}
            disabled={loadingMore}
            style={{
              margin: '6px auto 10px', padding: '7px 18px',
              background: C.surfaceHi, border: `1px solid ${C.border}`,
              borderRadius: 8, color: C.sub, fontSize: 12, cursor: loadingMore ? 'default' : 'pointer',
              opacity: loadingMore ? 0.5 : 1, transition: 'opacity 0.15s',
            }}
          >
            {loadingMore ? 'Cargando…' : 'Cargar más'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

// Swipe horizontal entre secciones en móvil (en vez de barra inferior, que
// además chocaba con el lanzador flotante). Solo decide "es un swipe" si el
// gesto es claramente más horizontal que vertical, para no interferir con
// el scroll normal de las listas. navIds: lista de pestañas realmente
// disponibles (ya filtrada por permisos) — el swipe nunca debe poder saltar
// a una pestaña que no existe para este jugador.
function useSwipeNav(isMobile, nav, goToNav, navIds) {
  const touchRef = useRef({ x: 0, y: 0, tracking: false, decided: null })

  function onTouchStart(e) {
    if (!isMobile) return
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY, tracking: true, decided: null }
  }
  function onTouchMove(e) {
    if (!isMobile || !touchRef.current.tracking || touchRef.current.decided) return
    const t = e.touches[0]
    const dx = t.clientX - touchRef.current.x
    const dy = t.clientY - touchRef.current.y
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      touchRef.current.decided = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
    }
  }
  function onTouchEnd(e) {
    if (!isMobile || !touchRef.current.tracking) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchRef.current.x
    touchRef.current.tracking = false
    if (touchRef.current.decided !== 'horizontal' || Math.abs(dx) < 60) return
    const idx = navIds.indexOf(nav)
    if (dx < 0 && idx < navIds.length - 1) goToNav(navIds[idx + 1])
    else if (dx > 0 && idx > 0) goToNav(navIds[idx - 1])
  }

  return { onTouchStart, onTouchMove, onTouchEnd }
}

export default function LunitecaV2({ player }) {
  const isMobile = useIsMobile()
  const [nav,         setNav]         = useState('shelf')
  function goToNav(id) {
    setNav(id)
    setSelected(null)
  }
  // La pestaña Club directamente no existe para quien no es miembro del club
  // (permiso gestionado desde la app Admin) — no se muestra deshabilitada,
  // desaparece del todo, para que ni sepa que existe esa parte de Luniteca.
  const visibleNav = NAV.filter(item => item.id !== 'club' || player.club_member)
  const navIds = visibleNav.map(n => n.id)
  const swipeHandlers = useSwipeNav(isMobile, nav, goToNav, navIds)
  // Estantería/Club/Amigos se quedan siempre montados (ver más abajo, en el
  // render) — esto solo decide su posición/opacidad, nunca si existen en el
  // árbol, para no perder las portadas ya cargadas al cambiar de sección.
  function tabAnimate(id) {
    if (!isMobile) return { opacity: nav === id ? 1 : 0 }
    const offset = navIds.indexOf(id) - navIds.indexOf(nav)
    return { x: offset === 0 ? '0%' : offset > 0 ? '100%' : '-100%', opacity: nav === id ? 1 : 0 }
  }
  const [shelf,       setShelf]       = useState([])
  const [filters,     setFilters]     = useState(EMPTY_FILTERS)
  const vmKey = `luni_viewmode_${player.id}`
  const [viewMode, setViewMode] = useState(() => localStorage.getItem(vmKey) || 'list')

  function changeViewMode(mode) {
    localStorage.setItem(vmKey, mode)
    setViewMode(mode)
  }
  const readCollapsedKey = `luni_shelf_read_collapsed_${player.id}`
  const [collapsedRead, setCollapsedRead] = useState(() => localStorage.getItem(readCollapsedKey) === '1')
  function toggleReadCollapsed() {
    setCollapsedRead(v => {
      const next = !v
      localStorage.setItem(readCollapsedKey, next ? '1' : '0')
      return next
    })
  }
  const wantCollapsedKey = `luni_shelf_want_collapsed_${player.id}`
  const [collapsedWant, setCollapsedWant] = useState(() => localStorage.getItem(wantCollapsedKey) === '1')
  function toggleWantCollapsed() {
    setCollapsedWant(v => {
      const next = !v
      localStorage.setItem(wantCollapsedKey, next ? '1' : '0')
      return next
    })
  }
  const readingCollapsedKey = `luni_shelf_reading_collapsed_${player.id}`
  const [collapsedReading, setCollapsedReading] = useState(() => localStorage.getItem(readingCollapsedKey) === '1')
  function toggleReadingCollapsed() {
    setCollapsedReading(v => {
      const next = !v
      localStorage.setItem(readingCollapsedKey, next ? '1' : '0')
      return next
    })
  }
  // Años dentro de "Leídos" colapsados/expandidos individualmente — vive aquí
  // (no dentro de PersonalShelfSections) para que el botón "colapsar/expandir
  // todo" de la barra superior pueda controlarlos también. Persistido en
  // localStorage igual que collapsedReading/Read/Want, para recordar entre
  // sesiones qué años tenía colapsados el jugador.
  const yearsCollapsedKey = `luni_shelf_years_collapsed_${player.id}`
  const [collapsedYears, setCollapsedYears] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(yearsCollapsedKey)) || []) }
    catch { return new Set() }
  })
  function persistCollapsedYears(next) {
    localStorage.setItem(yearsCollapsedKey, JSON.stringify([...next]))
    return next
  }
  function toggleYear(y) {
    setCollapsedYears(prev => {
      const next = new Set(prev)
      next.has(y) ? next.delete(y) : next.add(y)
      return persistCollapsedYears(next)
    })
  }
  const [selected,    setSelected]    = useState(null)
  const [showSearch,  setShowSearch]  = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showSort,    setShowSort]    = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [sort,        setSort]        = useState({ field: '', dir: 'asc' })
  const sortMenuRef = useOutsideClose(showSort, () => setShowSort(false))

  useEffect(() => { loadShelf() }, [player.id])

  function loadShelf() {
    fetch(`/api/shelf/personal?player_id=${player.id}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : []).then(setShelf)
  }

  async function addBook(book) {
    await fetch('/api/shelf/personal', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...book, status: 'want_to_read' }),
    })
    loadShelf()
  }

  async function updateEntry(id, data) {
    await fetch(`/api/shelf/personal/${id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    // cover_url vive en la portada efectiva embebida en `book` (ver
    // _shelf_entry_out) además de en `own_cover_url` — hay que reflejarlo ahí.
    const merge = e => {
      const next = { ...e, ...data }
      if (data.cover_url) next.book = { ...e.book, cover_url: data.cover_url }
      return next
    }
    setShelf(s => s.map(e => e.id === id ? merge(e) : e))
    setSelected(s => s?.id === id ? merge(s) : s)
  }

  async function updateBook(bookId, data) {
    const r = await fetch(`/api/books/${bookId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!r.ok) return
    const updated = await r.json()
    setShelf(s => s.map(e => e.book.id === bookId ? { ...e, book: updated } : e))
    setSelected(s => s ? { ...s, book: updated } : s)
  }

  async function deleteEntry(id) {
    await fetch(`/api/shelf/personal/${id}`, { method: 'DELETE', credentials: 'include' })
    setShelf(s => s.filter(e => e.id !== id))
    setSelected(null)
  }

  const filtered = shelf.filter(e => {
    if (filters.status !== 'all' && e.status !== filters.status) return false
    if (filters.author && e.book.author !== filters.author) return false
    if (filters.folder && (e.folder || '') !== filters.folder) return false
    if (filters.maxPages) {
      const pages = e.custom_total_pages || e.book.num_pages
      if (pages && pages > parseInt(filters.maxPages)) return false
    }
    if (filters.genre && e.book.genre !== filters.genre) return false
    return true
  })

  const STATUS_ORDER = { want_to_read: 0, reading: 1, read: 2 }
  const sorted = sort.field ? [...filtered].sort((a, b) => {
    let va, vb
    if (sort.field === 'title')  { va = a.book.title?.toLowerCase()  || ''; vb = b.book.title?.toLowerCase()  || '' }
    if (sort.field === 'author') { va = a.book.author?.toLowerCase() || ''; vb = b.book.author?.toLowerCase() || '' }
    if (sort.field === 'status') { va = STATUS_ORDER[a.status] ?? 9;  vb = STATUS_ORDER[b.status] ?? 9 }
    if (sort.field === 'genre')  { va = a.book.genre?.toLowerCase()  || ''; vb = b.book.genre?.toLowerCase()  || '' }
    // Fecha de lectura terminada — libros sin terminar (por leer/leyendo) quedan
    // al principio en ascendente y al final en descendente, sin mezclarse entre sí.
    if (sort.field === 'date')   { va = a.finished_at || ''; vb = b.finished_at || '' }
    if (va < vb) return sort.dir === 'asc' ? -1 : 1
    if (va > vb) return sort.dir === 'asc' ?  1 : -1
    return 0
  }) : filtered

  // "Colapsar/expandir todo": solo afecta a los bloques de año dentro de
  // Leídos — Leyendo ahora/Leídos/Por leer no cuentan ni se tocan.
  const readEntriesForYears = sorted.filter(e => e.status === 'read')
  const currentReadYears = [...new Set(readEntriesForYears.map(e => e.finished_at ? e.finished_at.slice(0, 4) : 'sin-fecha'))]
  const anyBlockExpanded = currentReadYears.some(y => !collapsedYears.has(y))
  function toggleAllCollapsed() {
    setCollapsedYears(persistCollapsedYears(anyBlockExpanded ? new Set(currentReadYears) : new Set()))
  }

  const activeFiltersCount = Object.keys(EMPTY_FILTERS).filter(k => filters[k] !== EMPTY_FILTERS[k]).length

  function toggleSort(field) {
    setSort(s => s.field === field
      ? s.dir === 'asc' ? { field, dir: 'desc' } : { field: '', dir: 'asc' }
      : { field, dir: 'asc' }
    )
    setShowSort(false)
  }

  return (
    <div style={{
      display: 'flex', height: '100%',
      flexDirection: isMobile ? 'column' : 'row',
      background: C.bg, fontFamily: 'system-ui, -apple-system, sans-serif',
      position: 'relative', overflow: 'hidden',
    }}>

      {/* Rail — solo desktop. En móvil se navega con swipe horizontal (ver
          más abajo) y un indicador de puntos en vez de barra. */}
      {!isMobile && (
      <div style={{
        width: 52, flexShrink: 0, background: C.surface,
        borderRight: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 12, gap: 4,
      }}>
        {visibleNav.map(item => {
          const Icon    = NAV_ICONS[item.id]
          const active  = nav === item.id
          const iconColor = active ? C.accent : 'rgba(255,255,255,0.38)'
          return (
            <button key={item.id} title={item.label}
              onClick={() => { setNav(item.id); setSelected(null) }}
              style={{
                width: 36, height: 36, border: 'none', borderRadius: 10,
                cursor: 'pointer',
                background: active ? C.accentBg : 'transparent',
                outline: active ? `1.5px solid ${C.accentBd}` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <Icon size={18} color={iconColor} />
            </button>
          )
        })}
      </div>
      )}

      {/* Indicador de puntos — solo móvil, encima del contenido */}
      {isMobile && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '8px 0 2px', flexShrink: 0 }}>
          {visibleNav.map(item => (
            <button key={item.id} onClick={() => goToNav(item.id)} aria-label={item.label}
              style={{
                width: nav === item.id ? 18 : 6, height: 6, borderRadius: 4,
                border: 'none', padding: 0, cursor: 'pointer',
                background: nav === item.id ? C.accent : 'rgba(255,255,255,0.18)',
                transition: 'width 0.2s ease, background 0.2s ease',
              }}
            />
          ))}
        </div>
      )}

      {/* Contenido — Estantería/Club/Amigos se quedan siempre montados (solo
          se ocultan con transform/opacidad, igual que hace GatOS con sus
          apps) para no perder las portadas ya cargadas ni el scroll al
          cambiar de sección. En móvil el swipe desliza según la posición
          relativa a la sección activa; en desktop es un cambio instantáneo. */}
      <div
        onTouchStart={swipeHandlers.onTouchStart}
        onTouchMove={swipeHandlers.onTouchMove}
        onTouchEnd={swipeHandlers.onTouchEnd}
        style={{ position: 'relative', flex: 1, overflow: 'hidden' }}
      >
        <motion.div initial={false} animate={tabAnimate('shelf')}
          transition={isMobile ? { type: 'tween', duration: 0.22, ease: [0.4, 0, 0.2, 1] } : { duration: 0 }}
          style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', pointerEvents: nav === 'shelf' ? undefined : 'none' }}>

        <AnimatePresence mode="wait" initial={false}>
          {selected ? (
            <motion.div key="detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <BookDetailFull
                key={selected.id}
                entry={selected}
                shelf={shelf}
                onBack={() => setSelected(null)}
                onUpdateEntry={updateEntry}
                onUpdateBook={updateBook}
                onDelete={() => deleteEntry(selected.id)}
              />
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Barra superior */}
            <div style={{
              padding: '11px 16px', borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
            }}>
              <span style={{ fontSize: 13, color: C.text, fontWeight: 600, flex: 1 }}>Mi estantería</span>

              {/* Botón colapsar/expandir todo */}
              <button onClick={toggleAllCollapsed} title={anyBlockExpanded ? 'Colapsar todo' : 'Expandir todo'} style={{
                background: C.surfaceHi, border: '1px solid transparent',
                borderRadius: 8, width: 32, height: 28, color: C.muted,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s', flexShrink: 0,
              }}>
                <IconCollapseAll color={C.muted} expand={!anyBlockExpanded} />
              </button>

              {/* Botón filtros — solo icono */}
              <button onClick={() => setShowFilters(true)} title="Filtros" style={{
                position: 'relative',
                background: activeFiltersCount > 0 ? C.accentBg : C.surfaceHi,
                border: `1px solid ${activeFiltersCount > 0 ? C.accentBd : 'transparent'}`,
                borderRadius: 8, width: 32, height: 28,
                color: activeFiltersCount > 0 ? C.accent : C.muted,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s', flexShrink: 0,
              }}>
                <IconFilter color={activeFiltersCount > 0 ? C.accent : C.muted} />
                {activeFiltersCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4,
                    background: C.accent, color: 'white', borderRadius: '50%',
                    width: 14, height: 14, fontSize: 8, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1,
                  }}>{activeFiltersCount}</span>
                )}
              </button>

              {/* Botón ordenación */}
              <div ref={sortMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
                <button onClick={() => setShowSort(v => !v)} title="Ordenar" style={{
                  position: 'relative',
                  background: sort.field ? C.accentBg : C.surfaceHi,
                  border: `1px solid ${sort.field ? C.accentBd : 'transparent'}`,
                  borderRadius: 8, width: 32, height: 28,
                  color: sort.field ? C.accent : C.muted,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  <IconSort color={sort.field ? C.accent : C.muted} />
                </button>
                {showSort && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderRadius: 10, overflow: 'hidden', minWidth: 160,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 50,
                  }}>
                    {[
                      { field: 'title',  label: 'Título'  },
                      { field: 'author', label: 'Autor'   },
                      { field: 'status', label: 'Estado'  },
                      { field: 'genre',  label: 'Género'  },
                      { field: 'date',   label: 'Fecha de lectura' },
                    ].map(({ field, label }) => {
                      const active = sort.field === field
                      const arrow  = active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''
                      return (
                        <button key={field} onClick={() => toggleSort(field)} style={{
                          width: '100%', background: active ? C.accentBg : 'transparent',
                          border: 'none', padding: '9px 14px', textAlign: 'left',
                          color: active ? C.accent : C.sub, fontSize: 12, cursor: 'pointer',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          transition: 'background 0.1s',
                        }}
                          onMouseEnter={ev => { if (!active) ev.currentTarget.style.background = C.surfaceHi }}
                          onMouseLeave={ev => { if (!active) ev.currentTarget.style.background = 'transparent' }}
                        >
                          <span>{label}</span>
                          {active && <span style={{ fontSize: 11, opacity: 0.8 }}>{arrow}</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Toggle lista/grid */}
              <div style={{ display: 'flex', gap: 2, background: C.surfaceHi, borderRadius: 8, padding: 3 }}>
                {[['list', '☰'], ['grid', '⊞']].map(([mode, icon]) => (
                  <button key={mode} onClick={() => changeViewMode(mode)} style={{
                    background: viewMode === mode ? C.surface : 'transparent',
                    border: 'none', borderRadius: 6, width: 28, height: 24,
                    cursor: 'pointer', fontSize: 14,
                    color: viewMode === mode ? C.text : C.muted,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>{icon}</button>
                ))}
              </div>

              <button onClick={() => setShowBulkImport(true)} title="Añadir varios libros de golpe" style={{
                background: C.surfaceHi, border: 'none', borderRadius: 8,
                width: 32, height: 28, cursor: 'pointer', color: C.muted,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <IconImport size={13} color={C.muted} />
              </button>

              <button onClick={() => setShowSearch(true)} title="Añadir libro" style={{
                background: C.accent, border: 'none', borderRadius: 8,
                width: 32, height: 28, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <IconPlus size={13} color="white" />
              </button>
            </div>

            {sorted.length === 0 && (
              <p style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 48 }}>
                {shelf.length === 0 ? 'Tu estantería está vacía' : 'Ningún libro coincide con los filtros'}
              </p>
            )}
            {sorted.length > 0 && (
              <motion.div key={viewMode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <PersonalShelfSections
                  entries={sorted}
                  viewMode={viewMode}
                  sort={sort}
                  onSelect={setSelected}
                  collapsedReading={collapsedReading}
                  onToggleReadingCollapsed={toggleReadingCollapsed}
                  collapsedRead={collapsedRead}
                  onToggleReadCollapsed={toggleReadCollapsed}
                  collapsedWant={collapsedWant}
                  onToggleWantCollapsed={toggleWantCollapsed}
                  collapsedYears={collapsedYears}
                  onToggleYear={toggleYear}
                  renderActions={isMobile ? (entry) => (
                    <ShelfGridActions
                      onOpenDetail={viewMode === 'grid' ? () => setSelected(entry) : undefined}
                      onDelete={() => deleteEntry(entry.id)}
                    />
                  ) : undefined}
                />
              </motion.div>
            )}
            </motion.div>
          )}
        </AnimatePresence>
        </motion.div>

        {/* Ni se monta si no es miembro del club — no solo se oculta la
            pestaña, tampoco se le hace ninguna petición de datos del club. */}
        {player.club_member && (
          <motion.div initial={false} animate={tabAnimate('club')}
            transition={isMobile ? { type: 'tween', duration: 0.22, ease: [0.4, 0, 0.2, 1] } : { duration: 0 }}
            style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: nav === 'club' ? undefined : 'none' }}>
            <ClubTab player={player} />
          </motion.div>
        )}

        <motion.div initial={false} animate={tabAnimate('amigos')}
          transition={isMobile ? { type: 'tween', duration: 0.22, ease: [0.4, 0, 0.2, 1] } : { duration: 0 }}
          style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: nav === 'amigos' ? undefined : 'none' }}>
          <AmigosTab player={player} />
        </motion.div>
      </div>

      <AnimatePresence>
        {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} onAdd={addBook} />}
      </AnimatePresence>
      <AnimatePresence>
        {showFilters && <FilterModal filters={filters} onApply={setFilters} onClose={() => setShowFilters(false)} shelf={shelf} />}
      </AnimatePresence>
      <AnimatePresence>
        {showBulkImport && <BulkAddModal onClose={() => setShowBulkImport(false)} onImported={loadShelf} />}
      </AnimatePresence>
    </div>
  )
}
