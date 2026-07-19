import { useState, useEffect } from 'react'

const STARS = [1, 2, 3, 4, 5]

export default function LibraryOverlay({ player, initialTab = 'personal', initialPlayerId = null, onClose }) {
  const [tab,        setTab]        = useState(initialTab)
  const [shelf,      setShelf]      = useState([])
  const [clubShelf,  setClubShelf]  = useState([])
  const [search,     setSearch]     = useState('')
  const [results,    setResults]    = useState([])
  const [searching,  setSearching]  = useState(false)
  const [selected,   setSelected]   = useState(null)
  const [viewPlayer, setViewPlayer] = useState(initialPlayerId ?? player.id)

  useEffect(() => { fetchPersonal(); fetchClub() }, [viewPlayer])

  async function fetchPersonal() {
    const r = await fetch(`/api/shelf/personal?player_id=${viewPlayer}`, { credentials: 'include' })
    if (r.ok) setShelf(await r.json())
  }

  async function fetchClub() {
    const r = await fetch('/api/shelf/club', { credentials: 'include' })
    if (r.ok) setClubShelf(await r.json())
  }

  async function doSearch() {
    if (!search.trim()) return
    setSearching(true)
    const r = await fetch(`/api/books/search?q=${encodeURIComponent(search)}`, { credentials: 'include' })
    setResults(r.ok ? await r.json() : [])
    setSearching(false)
  }

  async function addToShelf(book, target) {
    const url = target === 'club' ? '/api/shelf/club' : '/api/shelf/personal'
    await fetch(url, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(book),
    })
    fetchPersonal(); fetchClub()
    setResults([])
    setSearch('')
  }

  async function updateEntry(id, data) {
    await fetch(`/api/shelf/personal/${id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    fetchPersonal()
  }

  async function removeEntry(id, club = false) {
    await fetch(`/api/shelf/${club ? 'club' : 'personal'}/${id}`, {
      method: 'DELETE', credentials: 'include',
    })
    fetchPersonal(); fetchClub()
    setSelected(null)
  }

  const PLAYERS = [
    { id: 1, name: 'Lara',   color: '#e879f9' },
    { id: 2, name: 'Nadia',  color: '#34d399' },
    { id: 3, name: 'Wander', color: '#60a5fa' },
  ]

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex flex-col w-[900px] max-w-[96vw] h-[85vh] bg-[#1c1410] border-2 border-yellow-700 rounded-xl overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 bg-[#2d1f10] border-b border-yellow-800">
          <span className="font-pixel text-yellow-300 text-xs tracking-wider">Biblioteca del Club</span>
          <button onClick={onClose} className="font-pixel text-xs text-gray-400 hover:text-white">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-yellow-800">
          {[
            { key: 'personal', label: 'Mi estantería' },
            { key: 'club',     label: 'Club' },
            { key: 'search',   label: '+ Añadir libro' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`font-pixel text-[9px] px-5 py-3 transition-colors ${
                tab === t.key
                  ? 'text-yellow-300 border-b-2 border-yellow-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Personal shelf */}
          {tab === 'personal' && (
            <div className="flex flex-1 overflow-hidden">
              {/* Selector de jugadora */}
              <div className="flex flex-col gap-2 p-3 border-r border-yellow-900">
                {PLAYERS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setViewPlayer(p.id)}
                    className={`font-pixel text-[9px] px-3 py-2 rounded text-left transition-colors ${
                      viewPlayer === p.id ? 'bg-yellow-800 text-white' : 'text-gray-500 hover:text-gray-200'
                    }`}
                    style={{ color: viewPlayer === p.id ? p.color : undefined }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              {/* Lista libros */}
              <div className="flex flex-1 overflow-hidden">
                <div className="flex flex-col gap-2 p-4 overflow-y-auto w-72 border-r border-yellow-900">
                  {shelf.length === 0 && (
                    <p className="font-pixel text-[8px] text-gray-600 mt-4 text-center">Estantería vacía</p>
                  )}
                  {shelf.map(e => (
                    <button
                      key={e.id}
                      onClick={() => setSelected(e)}
                      className={`flex items-center gap-3 p-2 rounded text-left transition-colors ${
                        selected?.id === e.id ? 'bg-yellow-900/50' : 'hover:bg-white/5'
                      }`}
                    >
                      {e.book.cover_url
                        ? <img src={e.book.cover_url} alt="" className="w-8 h-12 object-cover rounded" />
                        : <div className="w-8 h-12 bg-yellow-900 rounded flex items-center justify-center text-xs">📖</div>
                      }
                      <div>
                        <p className="font-pixel text-[8px] text-white leading-relaxed">{e.book.title}</p>
                        <p className="font-pixel text-[7px] text-gray-500">{e.book.author}</p>
                        <div className="flex mt-1">
                          {STARS.map(s => (
                            <span key={s} className={`text-xs ${e.rating >= s ? 'text-yellow-400' : 'text-gray-700'}`}>★</span>
                          ))}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Detalle */}
                <div className="flex-1 p-5 overflow-y-auto">
                  {!selected && (
                    <p className="font-pixel text-[8px] text-gray-600 text-center mt-10">Selecciona un libro</p>
                  )}
                  {selected && (
                    <div className="flex flex-col gap-4">
                      <div className="flex gap-4">
                        {selected.book.cover_url
                          ? <img src={selected.book.cover_url} alt="" className="w-20 h-28 object-cover rounded" />
                          : <div className="w-20 h-28 bg-yellow-900 rounded flex items-center justify-center text-2xl">📖</div>
                        }
                        <div>
                          <p className="font-pixel text-xs text-white leading-relaxed">{selected.book.title}</p>
                          <p className="font-pixel text-[9px] text-gray-400 mt-1">{selected.book.author}</p>
                        </div>
                      </div>

                      {/* Progreso */}
                      <div>
                        <label className="font-pixel text-[8px] text-gray-400">Progreso</label>
                        <input
                          type="range" min="0" max="100"
                          value={Math.round((selected.progress || 0) * 100)}
                          onChange={e => {
                            const v = parseInt(e.target.value) / 100
                            setSelected(s => ({ ...s, progress: v }))
                            updateEntry(selected.id, { progress: v })
                          }}
                          disabled={viewPlayer !== player.id}
                          className="w-full mt-1"
                        />
                        <span className="font-pixel text-[8px] text-yellow-400">
                          {Math.round((selected.progress || 0) * 100)}%
                        </span>
                      </div>

                      {/* Puntuación */}
                      {viewPlayer === player.id && (
                        <div>
                          <label className="font-pixel text-[8px] text-gray-400">Puntuación</label>
                          <div className="flex gap-1 mt-1">
                            {STARS.map(s => (
                              <button
                                key={s}
                                onClick={() => { setSelected(x => ({ ...x, rating: s })); updateEntry(selected.id, { rating: s }) }}
                                className={`text-xl transition-colors ${selected.rating >= s ? 'text-yellow-400' : 'text-gray-700 hover:text-gray-400'}`}
                              >★</button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notas */}
                      {viewPlayer === player.id && (
                        <div>
                          <label className="font-pixel text-[8px] text-gray-400">Notas privadas</label>
                          <textarea
                            value={selected.notes || ''}
                            onChange={e => setSelected(s => ({ ...s, notes: e.target.value }))}
                            onBlur={e => updateEntry(selected.id, { notes: e.target.value })}
                            rows={3}
                            className="w-full mt-1 bg-black/40 border border-yellow-900 rounded p-2 font-pixel text-[8px] text-white resize-none focus:outline-none focus:border-yellow-600"
                          />
                        </div>
                      )}

                      {viewPlayer === player.id && (
                        <button
                          onClick={() => removeEntry(selected.id)}
                          className="font-pixel text-[8px] text-red-500 hover:text-red-300 text-left"
                        >
                          Eliminar de mi estantería
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Club shelf */}
          {tab === 'club' && (
            <div className="flex flex-1 overflow-hidden p-4 gap-4">
              <div className="flex flex-col gap-3 overflow-y-auto w-full">
                {clubShelf.length === 0 && (
                  <p className="font-pixel text-[8px] text-gray-600 text-center mt-10">Sin libros en el club todavía</p>
                )}
                {clubShelf.map(e => (
                  <div key={e.id} className="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
                    {e.book.cover_url
                      ? <img src={e.book.cover_url} alt="" className="w-10 h-14 object-cover rounded" />
                      : <div className="w-10 h-14 bg-yellow-900 rounded flex items-center justify-center text-sm">📖</div>
                    }
                    <div className="flex-1">
                      <p className="font-pixel text-[9px] text-white">{e.book.title}</p>
                      <p className="font-pixel text-[7px] text-gray-500">{e.book.author}</p>
                      {e.read_date && (
                        <p className="font-pixel text-[7px] text-yellow-700 mt-1">
                          Leído: {new Date(e.read_date).toLocaleDateString('es')}
                        </p>
                      )}
                    </div>
                    {e.avg_rating && (
                      <div className="text-center">
                        <p className="font-pixel text-xs text-yellow-400">{e.avg_rating} ★</p>
                        <p className="font-pixel text-[7px] text-gray-600">{e.vote_count} votos</p>
                      </div>
                    )}
                    <button
                      onClick={() => removeEntry(e.id, true)}
                      className="font-pixel text-[8px] text-red-800 hover:text-red-500"
                    >✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search / add */}
          {tab === 'search' && (
            <div className="flex flex-col flex-1 p-5 gap-4 overflow-y-auto">
              <div className="flex gap-2">
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doSearch()}
                  placeholder="Título, autor o ISBN..."
                  className="flex-1 bg-black/40 border border-yellow-800 rounded px-3 py-2 font-pixel text-[9px] text-white focus:outline-none focus:border-yellow-500"
                />
                <button
                  onClick={doSearch}
                  disabled={searching}
                  className="font-pixel text-[9px] bg-yellow-600 text-black px-4 py-2 rounded hover:bg-yellow-400 disabled:opacity-50"
                >
                  {searching ? '…' : 'Buscar'}
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {results.map((b, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
                    {b.cover_url
                      ? <img src={b.cover_url} alt="" className="w-10 h-14 object-cover rounded" />
                      : <div className="w-10 h-14 bg-yellow-900 rounded flex items-center justify-center text-sm">📖</div>
                    }
                    <div className="flex-1">
                      <p className="font-pixel text-[9px] text-white">{b.title}</p>
                      <p className="font-pixel text-[7px] text-gray-400">{b.author}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => addToShelf(b, 'personal')}
                        className="font-pixel text-[8px] bg-blue-900 text-blue-200 px-3 py-1 rounded hover:bg-blue-700"
                      >
                        Mi estantería
                      </button>
                      <button
                        onClick={() => addToShelf(b, 'club')}
                        className="font-pixel text-[8px] bg-yellow-900 text-yellow-200 px-3 py-1 rounded hover:bg-yellow-700"
                      >
                        Club
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
