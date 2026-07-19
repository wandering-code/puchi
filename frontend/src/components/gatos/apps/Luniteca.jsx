import { useState, useEffect } from 'react'

const TABS = [
  { id: 'shelf',         label: 'Mi estantería', icon: '📚' },
  { id: 'club',          label: 'Club',           icon: '🏛️' },
  { id: 'search',        label: 'Buscar',         icon: '🔍' },
  { id: 'amigos',        label: 'Amigos',         icon: '👥' },
  { id: 'clasificacion', label: 'Clasificación',  icon: '🏆' },
]

const STARS = [1,2,3,4,5]

function RankingTable({ title, icon, rows, value, unit, currentId }) {
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div>
      <h3 style={{ fontSize: 13, color: '#fbbf24', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{icon}</span>{title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map((r, i) => (
          <div key={r.player.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8,
            background: r.player.id === currentId ? 'rgba(217,119,6,0.15)' : 'rgba(255,255,255,0.03)',
            border: r.player.id === currentId ? '1px solid rgba(217,119,6,0.3)' : '1px solid transparent',
          }}>
            <span style={{ width: 24, textAlign: 'center', fontSize: i < 3 ? 16 : 12, color: 'rgba(255,255,255,0.3)' }}>
              {i < 3 ? medals[i] : `${i + 1}`}
            </span>
            <span style={{ fontSize: 20 }}>{r.player.avatar_emoji}</span>
            <span style={{ flex: 1, fontSize: 13, color: r.player.id === currentId ? '#fbbf24' : 'rgba(255,255,255,0.8)', fontWeight: r.player.id === currentId ? 600 : 400 }}>
              {r.player.name}
            </span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontVariantNumeric: 'tabular-nums' }}>
              {value(r)} <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{unit}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const STATUS_OPTIONS = [
  { id: 'want_to_read', label: 'Por leer', color: '#6b7280' },
  { id: 'reading',      label: 'Leyendo',  color: '#3b82f6' },
  { id: 'read',         label: 'Leído',    color: '#22c55e' },
]

export default function Luniteca({ player }) {
  const [tab,              setTab]              = useState('shelf')
  const [shelf,            setShelf]            = useState([])
  const [clubShelf,        setClubShelf]        = useState([])
  const [search,           setSearch]           = useState('')
  const [results,          setResults]          = useState([])
  const [searching,        setSearching]        = useState(false)
  const [selected,         setSelected]         = useState(null)
  const [collapsedFolders, setCollapsedFolders] = useState(new Set())
  const [players,          setPlayers]          = useState([])
  const [selectedFriend,   setSelectedFriend]   = useState(null)
  const [friendShelf,      setFriendShelf]      = useState([])
  const [rankings,         setRankings]         = useState(null)
  const [editingBook,      setEditingBook]      = useState(false)
  const [bookDraft,        setBookDraft]        = useState({ title: '', author: '' })

  useEffect(() => {
    fetch(`/api/shelf/personal?player_id=${player.id}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : []).then(setShelf)
    fetch('/api/shelf/club', { credentials: 'include' })
      .then(r => r.ok ? r.json() : []).then(setClubShelf)
    fetch('/api/players', { credentials: 'include' })
      .then(r => r.ok ? r.json() : []).then(setPlayers)
  }, [])

  useEffect(() => {
    if (tab === 'clasificacion' && !rankings) {
      fetch('/api/shelf/rankings', { credentials: 'include' })
        .then(r => r.ok ? r.json() : []).then(setRankings)
    }
  }, [tab])

  function selectFriend(p) {
    setSelectedFriend(p)
    setFriendShelf([])
    fetch(`/api/shelf/personal?player_id=${p.id}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : []).then(setFriendShelf)
  }

  async function doSearch() {
    if (!search.trim()) return
    setSearching(true)
    const r = await fetch(`/api/books/search?q=${encodeURIComponent(search)}`, { credentials: 'include' })
    setResults(r.ok ? await r.json() : [])
    setSearching(false)
  }

  async function addBook(book, target) {
    await fetch(`/api/shelf/${target}`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...book, status: 'want_to_read' }),
    })
    // Refresh
    fetch(`/api/shelf/personal?player_id=${player.id}`, { credentials: 'include' }).then(r => r.json()).then(setShelf)
    fetch('/api/shelf/club', { credentials: 'include' }).then(r => r.json()).then(setClubShelf)
    setSearch(''); setResults([])
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

  async function updateEntry(id, data) {
    await fetch(`/api/shelf/personal/${id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    fetch(`/api/shelf/personal?player_id=${player.id}`, { credentials: 'include' }).then(r => r.json()).then(setShelf)
  }

  return (
    <div className="flex h-full" style={{ fontFamily: 'system-ui, sans-serif', background: '#111827' }}>

      {/* Sidebar */}
      <div style={{ width: 180, background: '#1a1208', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>📚</span>
          <span style={{ fontFamily: '"Press Start 2P"', fontSize: 7, color: '#d97706' }}>Luniteca</span>
        </div>
        <nav style={{ padding: '8px 0', flex: 1 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                width: '100%', background: tab === t.id ? 'rgba(217,119,6,0.15)' : 'transparent',
                border: 'none', cursor: 'pointer', padding: '10px 16px',
                display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                borderLeft: tab === t.id ? '3px solid #d97706' : '3px solid transparent',
              }}
            >
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <span style={{ fontSize: 12, color: tab === t.id ? '#fbbf24' : 'rgba(255,255,255,0.5)', fontWeight: tab === t.id ? 600 : 400 }}>
                {t.label}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

        {/* Mi estantería */}
        {tab === 'shelf' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

            {/* Lista de libros agrupada por carpetas */}
            <div style={{ width: 240, overflowY: 'auto', borderRight: '1px solid rgba(255,255,255,0.06)', padding: 8 }}>
              {shelf.length === 0 && <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, padding: 16, textAlign: 'center' }}>Tu estantería está vacía</p>}
              {shelf.filter(e => !e.folder).map(e => {
                const st = STATUS_OPTIONS.find(s => s.id === e.status)
                return (
                  <button key={e.id} onClick={() => { setSelected(e); setEditingBook(false) }} style={{ width: '100%', background: selected?.id === e.id ? 'rgba(217,119,6,0.15)' : 'transparent', border: 'none', cursor: 'pointer', padding: 10, borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left' }}>
                    {e.book.cover_url ? <img src={e.book.cover_url} alt="" style={{ width: 36, height: 52, objectFit: 'cover', borderRadius: 4 }} /> : <div style={{ width: 36, height: 52, background: '#d97706', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📖</div>}
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.book.title}</p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{e.book.author}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: st?.color || '#6b7280', flexShrink: 0 }} />
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{st?.label}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
              {[...new Set(shelf.filter(e => e.folder).map(e => e.folder))].sort().map(name => (
                <div key={name}>
                  <button
                    onClick={() => setCollapsedFolders(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })}
                    style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 10px 4px', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', display: 'inline-block', transform: collapsedFolders.has(name) ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▾</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>📁 {name}</span>
                  </button>
                  {!collapsedFolders.has(name) && shelf.filter(e => e.folder === name).map(e => {
                    const st = STATUS_OPTIONS.find(s => s.id === e.status)
                    return (
                      <button key={e.id} onClick={() => { setSelected(e); setEditingBook(false) }} style={{ width: '100%', background: selected?.id === e.id ? 'rgba(217,119,6,0.15)' : 'transparent', border: 'none', cursor: 'pointer', padding: 10, borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left' }}>
                        {e.book.cover_url ? <img src={e.book.cover_url} alt="" style={{ width: 36, height: 52, objectFit: 'cover', borderRadius: 4 }} /> : <div style={{ width: 36, height: 52, background: '#d97706', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📖</div>}
                        <div style={{ overflow: 'hidden', flex: 1 }}>
                          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.book.title}</p>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{e.book.author}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: st?.color || '#6b7280', flexShrink: 0 }} />
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{st?.label}</span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Detalle */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {!selected && <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13, textAlign: 'center', marginTop: 60 }}>Selecciona un libro</p>}
              {selected && (() => {
                const status = selected.status || 'want_to_read'
                const existingFolders = [...new Set(shelf.filter(e => e.folder).map(e => e.folder))].sort()

                const today = new Date().toISOString().slice(0, 10)

                const setStatus = val => {
                  const updates = { status: val }
                  if (val === 'reading' && !selected.started_at)  updates.started_at  = today
                  if (val === 'read') {
                    if (!selected.started_at)  updates.started_at  = today
                    if (!selected.finished_at) updates.finished_at = today
                  }
                  setSelected(s => ({ ...s, ...updates }))
                  updateEntry(selected.id, updates)
                }
                const setFolder = val => {
                  setSelected(s => ({ ...s, folder: val || null }))
                  updateEntry(selected.id, { folder: val || '' })
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Cabecera */}
                    <div style={{ display: 'flex', gap: 16 }}>
                      {selected.book.cover_url
                        ? <img src={selected.book.cover_url} alt="" style={{ width: 80, height: 116, objectFit: 'cover', borderRadius: 6 }} />
                        : <div style={{ width: 80, height: 116, background: '#d97706', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>📖</div>
                      }
                      <div style={{ flex: 1 }}>
                        {editingBook ? (
                          <>
                            <input
                              autoFocus
                              value={bookDraft.title}
                              onChange={e => setBookDraft(d => ({ ...d, title: e.target.value }))}
                              style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(217,119,6,0.5)', borderRadius: 5, padding: '4px 8px', color: 'white', fontSize: 14, fontWeight: 700, outline: 'none', marginBottom: 6 }}
                            />
                            <input
                              value={bookDraft.author}
                              onChange={e => setBookDraft(d => ({ ...d, author: e.target.value }))}
                              style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, padding: '4px 8px', color: 'rgba(255,255,255,0.6)', fontSize: 12, outline: 'none', marginBottom: 8 }}
                            />
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => { updateBook(selected.book.id, bookDraft); setEditingBook(false) }}
                                style={{ background: '#d97706', border: 'none', borderRadius: 5, padding: '4px 10px', color: 'white', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                              >Guardar</button>
                              <button
                                onClick={() => setEditingBook(false)}
                                style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 5, padding: '4px 10px', color: 'rgba(255,255,255,0.5)', fontSize: 11, cursor: 'pointer' }}
                              >Cancelar</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <h2 style={{ fontSize: 15, color: 'white', fontWeight: 700, lineHeight: 1.3 }}>{selected.book.title}</h2>
                            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{selected.book.author}</p>
                            <button
                              onClick={() => { setBookDraft({ title: selected.book.title, author: selected.book.author || '' }); setEditingBook(true) }}
                              style={{ marginTop: 8, background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: 11, cursor: 'pointer', padding: 0 }}
                            >✏️ Editar título / autor</button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Estado */}
                    <div>
                      <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 8 }}>Estado</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {STATUS_OPTIONS.map(opt => (
                          <button key={opt.id} onClick={() => setStatus(opt.id)}
                            style={{
                              border: 'none', borderRadius: 20, padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                              background: status === opt.id ? opt.color : 'rgba(255,255,255,0.07)',
                              color: status === opt.id ? 'white' : 'rgba(255,255,255,0.4)',
                              transition: 'all 0.15s',
                            }}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Carpeta */}
                    <div>
                      <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>Carpeta</label>
                      <input
                        list="folders-list"
                        value={selected.folder || ''}
                        onChange={e => setSelected(s => ({ ...s, folder: e.target.value || null }))}
                        onBlur={e => setFolder(e.target.value)}
                        placeholder="Sin carpeta"
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 10px', color: 'white', fontSize: 12, outline: 'none', width: '100%' }}
                      />
                      <datalist id="folders-list">
                        {existingFolders.map(f => <option key={f} value={f} />)}
                      </datalist>
                    </div>

                    {/* Fechas — inicio si leyendo o leído, fin solo si leído */}
                    {(status === 'reading' || status === 'read') && (
                      <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>Inicio de lectura</label>
                          <input
                            type="date"
                            value={selected.started_at ? selected.started_at.slice(0, 10) : ''}
                            onChange={e => setSelected(s => ({ ...s, started_at: e.target.value || null }))}
                            onBlur={e => updateEntry(selected.id, { started_at: e.target.value || null })}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 8px', color: 'white', fontSize: 12, outline: 'none', colorScheme: 'dark' }}
                          />
                        </div>
                        {status === 'read' && (
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>Fin de lectura</label>
                            <input
                              type="date"
                              value={selected.finished_at ? selected.finished_at.slice(0, 10) : ''}
                              onChange={e => setSelected(s => ({ ...s, finished_at: e.target.value || null }))}
                              onBlur={e => updateEntry(selected.id, { finished_at: e.target.value || null })}
                              style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 8px', color: 'white', fontSize: 12, outline: 'none', colorScheme: 'dark' }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Progreso — solo si leyendo o leído */}
                    {(status === 'reading' || status === 'read') && (
                      <div>
                        <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 8 }}>Progreso</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="number" min="0"
                            max={selected.custom_total_pages || selected.book.num_pages || undefined}
                            value={selected.current_page ?? ''}
                            placeholder="Pág. actual"
                            onChange={e => {
                              if (e.target.value === '') { setSelected(s => ({ ...s, current_page: null })); return }
                              const total = selected.custom_total_pages || selected.book.num_pages
                              const val = total ? Math.min(parseInt(e.target.value), total) : parseInt(e.target.value)
                              setSelected(s => ({ ...s, current_page: val }))
                            }}
                            onBlur={() => updateEntry(selected.id, { current_page: selected.current_page })}
                            style={{ width: 80, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 8px', color: 'white', fontSize: 13, outline: 'none', textAlign: 'center' }}
                          />
                          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>de</span>
                          <input
                            type="number" min="1"
                            value={selected.custom_total_pages ?? selected.book.num_pages ?? ''}
                            placeholder="Total págs."
                            onChange={e => {
                              const val = e.target.value === '' ? null : parseInt(e.target.value)
                              setSelected(s => ({ ...s, custom_total_pages: val }))
                            }}
                            onBlur={() => updateEntry(selected.id, { custom_total_pages: selected.custom_total_pages })}
                            style={{ width: 80, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '5px 8px', color: 'rgba(255,255,255,0.6)', fontSize: 13, outline: 'none', textAlign: 'center' }}
                          />
                          {(() => {
                            const total = selected.custom_total_pages || selected.book.num_pages
                            const pct = total && selected.current_page != null ? Math.round(selected.current_page / total * 100) : Math.round((selected.progress || 0) * 100)
                            return <span style={{ fontSize: 12, color: '#fbbf24', minWidth: 36 }}>{pct}%</span>
                          })()}
                        </div>
                        <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
                          {(() => {
                            const total = selected.custom_total_pages || selected.book.num_pages
                            const pct = total && selected.current_page != null ? Math.min(selected.current_page / total, 1) : (selected.progress || 0)
                            return <div style={{ height: '100%', borderRadius: 2, background: '#d97706', width: `${Math.round(pct * 100)}%`, transition: 'width 0.3s' }} />
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Rating y notas — solo si leído */}
                    {status === 'read' && (
                      <>
                        <div>
                          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>Puntuación</label>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {STARS.map(s => (
                              <button key={s} onClick={() => { setSelected(x => ({...x, rating: s})); updateEntry(selected.id, {rating: s}) }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: selected.rating >= s ? '#fbbf24' : '#374151' }}>★</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>Notas privadas</label>
                          <textarea
                            value={selected.notes || ''}
                            onChange={e => setSelected(s => ({...s, notes: e.target.value}))}
                            onBlur={e => updateEntry(selected.id, {notes: e.target.value})}
                            rows={3}
                            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '8px 10px', color: 'white', fontSize: 12, resize: 'none', outline: 'none' }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {/* Buscar */}
        {tab === 'search' && (
          <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doSearch()}
                placeholder="Título, autor, ISBN…"
                style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: 'white', fontSize: 13, outline: 'none' }}
              />
              <button onClick={doSearch} disabled={searching}
                style={{ background: '#d97706', border: 'none', borderRadius: 8, padding: '8px 16px', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
                {searching ? '…' : 'Buscar'}
              </button>
            </div>
            {results.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12, alignItems: 'center' }}>
                {b.cover_url ? <img src={b.cover_url} alt="" style={{ width: 40, height: 58, objectFit: 'cover', borderRadius: 4 }} /> : <div style={{ width: 40, height: 58, background: '#374151', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📖</div>}
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, color: 'white', fontWeight: 600 }}>{b.title}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{b.author}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button onClick={() => addBook(b, 'personal')} style={{ background: '#1d4ed8', border: 'none', borderRadius: 6, padding: '4px 10px', color: 'white', cursor: 'pointer', fontSize: 11 }}>+ Mi estantería</button>
                  <button onClick={() => addBook(b, 'club')} style={{ background: '#d97706', border: 'none', borderRadius: 6, padding: '4px 10px', color: 'white', cursor: 'pointer', fontSize: 11 }}>+ Club</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Club */}
        {tab === 'club' && (
          <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
            <h2 style={{ color: '#fbbf24', fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Estantería del club</h2>
            {clubShelf.length === 0 && <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Sin libros en el club todavía</p>}
            {clubShelf.map(e => (
              <div key={e.id} style={{ display: 'flex', gap: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 12, marginBottom: 10, alignItems: 'center' }}>
                {e.book.cover_url ? <img src={e.book.cover_url} alt="" style={{ width: 40, height: 58, objectFit: 'cover', borderRadius: 4 }} /> : <div style={{ width: 40, height: 58, background: '#374151', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📖</div>}
                <div>
                  <p style={{ fontSize: 13, color: 'white', fontWeight: 600 }}>{e.book.title}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{e.book.author}</p>
                  {e.avg_rating && <p style={{ fontSize: 11, color: '#fbbf24', marginTop: 4 }}>{'★'.repeat(Math.round(e.avg_rating))} {e.avg_rating}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Amigos */}
        {tab === 'amigos' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

            {/* Lista de jugadores */}
            <div style={{ width: 180, overflowY: 'auto', borderRight: '1px solid rgba(255,255,255,0.06)', padding: 8 }}>
              {players.filter(p => p.id !== player.id).map(p => (
                <button key={p.id} onClick={() => selectFriend(p)}
                  style={{ width: '100%', background: selectedFriend?.id === p.id ? 'rgba(217,119,6,0.15)' : 'transparent', border: 'none', cursor: 'pointer', padding: '10px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', borderLeft: selectedFriend?.id === p.id ? '3px solid #d97706' : '3px solid transparent' }}
                >
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{p.avatar_emoji}</span>
                  <span style={{ fontSize: 12, color: selectedFriend?.id === p.id ? '#fbbf24' : 'rgba(255,255,255,0.6)', fontWeight: selectedFriend?.id === p.id ? 600 : 400 }}>{p.name}</span>
                </button>
              ))}
            </div>

            {/* Estantería del amigo */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {!selectedFriend && (
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13, textAlign: 'center', margin: 'auto' }}>Selecciona a alguien para ver su estantería</p>
              )}
              {selectedFriend && (
                <>
                  {/* Lista */}
                  <div style={{ width: 240, overflowY: 'auto', borderRight: '1px solid rgba(255,255,255,0.06)', padding: 8 }}>
                    {friendShelf.length === 0 && <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, padding: 16, textAlign: 'center' }}>Estantería vacía</p>}
                    {friendShelf.map(e => {
                      const st = STATUS_OPTIONS.find(s => s.id === e.status)
                      return (
                        <div key={e.id} style={{ padding: 10, borderRadius: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
                          {e.book.cover_url ? <img src={e.book.cover_url} alt="" style={{ width: 36, height: 52, objectFit: 'cover', borderRadius: 4 }} /> : <div style={{ width: 36, height: 52, background: '#d97706', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📖</div>}
                          <div style={{ overflow: 'hidden', flex: 1 }}>
                            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.book.title}</p>
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{e.book.author}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: st?.color || '#6b7280', flexShrink: 0 }} />
                              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{st?.label}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Info del perfil */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                      <span style={{ fontSize: 40 }}>{selectedFriend.avatar_emoji}</span>
                      <div>
                        <h2 style={{ fontSize: 16, color: 'white', fontWeight: 700 }}>{selectedFriend.name}</h2>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                          {friendShelf.filter(e => e.status === 'read').length} leídos ·{' '}
                          {friendShelf.filter(e => e.status === 'reading').length} leyendo ·{' '}
                          {friendShelf.filter(e => e.status === 'want_to_read').length} por leer
                        </p>
                      </div>
                    </div>
                    {friendShelf.filter(e => e.status === 'reading').length > 0 && (
                      <div>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Leyendo ahora</p>
                        {friendShelf.filter(e => e.status === 'reading').map(e => {
                          const total = e.custom_total_pages || e.book.num_pages
                          const pct = total && e.current_page != null ? Math.round(e.current_page / total * 100) : Math.round((e.progress || 0) * 100)
                          return (
                            <div key={e.id} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
                              {e.book.cover_url ? <img src={e.book.cover_url} alt="" style={{ width: 44, height: 64, objectFit: 'cover', borderRadius: 4 }} /> : <div style={{ width: 44, height: 64, background: '#d97706', borderRadius: 4 }} />}
                              <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 13, color: 'white', fontWeight: 600 }}>{e.book.title}</p>
                                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{e.book.author}</p>
                                <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
                                  <div style={{ height: '100%', borderRadius: 2, background: '#3b82f6', width: `${pct}%` }} />
                                </div>
                                <p style={{ fontSize: 10, color: '#3b82f6', marginTop: 3 }}>{pct}%{total && e.current_page != null ? ` · pág. ${e.current_page} de ${total}` : ''}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Clasificación */}
        {tab === 'clasificacion' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {!rankings && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', marginTop: 40 }}>Cargando…</p>}
            {rankings && (
              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <RankingTable
                    title="Libros leídos"
                    icon="📖"
                    rows={[...rankings].sort((a, b) => b.books_read - a.books_read)}
                    value={r => r.books_read}
                    unit="libros"
                    currentId={player.id}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <RankingTable
                    title="Páginas leídas"
                    icon="📄"
                    rows={[...rankings].sort((a, b) => b.pages_read - a.pages_read)}
                    value={r => r.pages_read.toLocaleString('es-ES')}
                    unit="páginas"
                    currentId={player.id}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
