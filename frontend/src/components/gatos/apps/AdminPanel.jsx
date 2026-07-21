import { useState, useEffect } from 'react'
import PlayerAvatar from '../PlayerAvatar'
import { useIsMobile } from '../../../utils/responsive'

const C = {
  bg: '#111827', card: '#1e1f2e', border: 'rgba(255,255,255,0.06)',
  text: 'rgba(255,255,255,0.9)', sub: 'rgba(255,255,255,0.45)', muted: 'rgba(255,255,255,0.3)',
  accent: '#5865f2', danger: '#ed4245', ok: '#23a55a',
}

const TABS = [
  { id: 'pending', label: 'Pendientes' },
  { id: 'players', label: 'Jugadores' },
]

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminPanel({ player }) {
  const isMobile = useIsMobile()
  const [tab,     setTab]     = useState('pending')
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  // Marca "también miembro del club" al aprobar — por fila, key = player.id
  const [clubOnApprove, setClubOnApprove] = useState({})

  function load() {
    setLoading(true)
    fetch('/api/admin/players', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setPlayers)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function updatePlayer(id, body) {
    const r = await fetch(`/api/admin/players/${id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) return
    const updated = await r.json()
    setPlayers(ps => ps.map(p => p.id === id ? updated : p))
  }

  function approve(id) {
    updatePlayer(id, { status: 'approved', club_member: !!clubOnApprove[id] })
  }
  function reject(id) {
    updatePlayer(id, { status: 'rejected' })
  }
  function toggleClubMember(id, value) {
    updatePlayer(id, { club_member: value })
  }

  const pending  = players.filter(p => p.status === 'pending')
  const approved = players.filter(p => p.status === 'approved')

  // En escritorio, avatar+nombre y checkbox+botones son dos grupos en la
  // misma fila (el primero se estira, el segundo queda a la derecha). En
  // móvil no caben los cinco elementos en una sola línea sin que el nombre
  // se estruje o el checkbox se parta en dos líneas — misma pareja de
  // grupos, pero apilados verticalmente (flexDirection cambia, la
  // estructura interna no).
  const rowStyle = {
    display: 'flex', flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 10 : 12,
    background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
    padding: isMobile ? 12 : '12px 14px',
  }
  const infoGroupStyle = {
    display: 'flex', alignItems: 'center', gap: 12, minWidth: 0,
    flex: isMobile ? 'none' : 1,
  }
  const actionsGroupStyle = {
    display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 12,
    justifyContent: isMobile ? 'space-between' : 'flex-end', flexShrink: 0,
  }
  const btnBase = {
    border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
    padding: isMobile ? '6px 10px' : '7px 14px', fontSize: isMobile ? 11.5 : 12.5,
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: 'system-ui, sans-serif' }}>
      {/* Cabecera */}
      <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Admin</h2>
        <p style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>Aprobación de cuentas y acceso al club</p>
        <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: tab === t.id ? C.accent : 'rgba(255,255,255,0.06)',
              color: tab === t.id ? 'white' : C.sub,
              border: 'none', borderRadius: 20, padding: '6px 14px',
              fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {t.label}
              {t.id === 'pending' && pending.length > 0 && (
                <span style={{
                  background: tab === t.id ? 'rgba(255,255,255,0.25)' : C.accent,
                  color: 'white', borderRadius: 10, fontSize: 10, fontWeight: 700,
                  padding: '1px 6px', lineHeight: 1.4,
                }}>{pending.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && <p style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 30 }}>Cargando…</p>}

        {!loading && tab === 'pending' && pending.length === 0 && (
          <p style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 30 }}>No hay cuentas pendientes de aprobación.</p>
        )}
        {!loading && tab === 'pending' && pending.map(p => (
          <div key={p.id} style={rowStyle}>
            <div style={infoGroupStyle}>
              <PlayerAvatar emoji={p.avatar_emoji} url={p.avatar_url} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: p.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</p>
                <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Solicitado el {fmtDate(p.created_at)}</p>
              </div>
            </div>
            <div style={actionsGroupStyle}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: C.sub, cursor: 'pointer', flexShrink: 0 }}>
                <input type="checkbox"
                  checked={!!clubOnApprove[p.id]}
                  onChange={ev => setClubOnApprove(m => ({ ...m, [p.id]: ev.target.checked }))}
                />
                Miembro del club
              </label>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => approve(p.id)} style={{ ...btnBase, background: C.ok, color: 'white' }}>Aprobar</button>
                <button onClick={() => reject(p.id)} style={{ ...btnBase, background: 'rgba(237,66,69,0.12)', color: C.danger }}>Rechazar</button>
              </div>
            </div>
          </div>
        ))}

        {!loading && tab === 'players' && approved.length === 0 && (
          <p style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 30 }}>Todavía no hay jugadores aprobados.</p>
        )}
        {!loading && tab === 'players' && approved.map(p => {
          const isSelf = p.id === player.id
          return (
            <div key={p.id} style={rowStyle}>
              <div style={infoGroupStyle}>
                <PlayerAvatar emoji={p.avatar_emoji} url={p.avatar_url} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: p.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</p>
                  <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Se unió el {fmtDate(p.created_at)}</p>
                </div>
              </div>
              <label title={isSelf ? 'No puedes quitarte el acceso a ti mismo' : ''} style={{
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.sub,
                cursor: isSelf ? 'default' : 'pointer', opacity: isSelf ? 0.5 : 1, flexShrink: 0,
                alignSelf: isMobile ? 'flex-end' : 'center',
              }}>
                Miembro del club
                <input type="checkbox" disabled={isSelf}
                  checked={p.club_member}
                  onChange={ev => toggleClubMember(p.id, ev.target.checked)}
                />
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}
