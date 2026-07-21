import { useState, useEffect, useRef } from 'react'
import PlayerAvatar from './PlayerAvatar'
import { APPS, isAppVisible } from './apps/config'

export const MENU_BAR_H = 28

export default function MenuBar({ player, activeAppTitle, online, onOpenApp, onLogout, onExitPC, compact = false }) {
  const [time,      setTime]      = useState(getTime())
  const [menuOpen,  setMenuOpen]  = useState(false)
  const menuRef = useRef(null)
  const isAdmin = player.name?.toLowerCase() === 'wander'

  useEffect(() => {
    const t = setInterval(() => setTime(getTime()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    function onDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [menuOpen])

  return (
    <div
      className="absolute top-0 left-0 right-0 flex items-center justify-between px-3"
      style={{
        height: MENU_BAR_H,
        background: 'rgba(28,28,32,0.55)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        zIndex: 10000,
        fontSize: 13,
        color: 'rgba(255,255,255,0.85)',
      }}
    >
      {/* Menú GatOS */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, height: '100%' }} ref={menuRef}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          style={{
            background: menuOpen ? 'rgba(255,255,255,0.12)' : 'transparent',
            border: 'none', cursor: 'pointer', borderRadius: 5,
            padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 6,
            transition: 'background .15s', height: '100%',
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>🐾</span>
          <span style={{ fontFamily: '"Press Start 2P"', fontSize: 9, letterSpacing: 1 }}>GatOS</span>
        </button>

        {activeAppTitle && (
          <span style={{ fontWeight: 600, fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>{activeAppTitle}</span>
        )}

        {/* Menú desplegable */}
        {menuOpen && (
          <div style={{
            position: 'absolute', top: MENU_BAR_H + 4, left: 0,
            background: 'rgba(32,32,38,0.99)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10, overflow: 'hidden', minWidth: 200,
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(20px)',
          }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <PlayerAvatar emoji={player.avatar_emoji} url={player.avatar_url} size={18} />
              <div>
                <p style={{ fontWeight: 700, fontSize: 13, color: player.color }}>{player.name}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>En línea</p>
              </div>
            </div>
            {/* Solo Ajustes aquí — Admin se entra desde el botón flotante (móvil) / Dock (escritorio) */}
            {isAppVisible(APPS.settings, player, isAdmin) && (
              <MenuItem icon="⚙️" label="Ajustes" onClick={() => { onOpenApp('settings'); setMenuOpen(false) }} />
            )}
            {onExitPC && (
              <MenuItem icon="🏠" label="Volver a la habitación" onClick={() => { setMenuOpen(false); onExitPC() }} />
            )}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
            <MenuItem icon="🚪" label="Cerrar sesión" onClick={() => { setMenuOpen(false); onLogout() }} danger />
          </div>
        )}
      </div>

      {/* Estado + reloj */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <PlayerAvatar emoji={player.avatar_emoji} url={player.avatar_url} size={13} />
          <span style={{ color: player.color, fontWeight: 600 }}>{player.name}</span>
        </span>
        {!compact && online?.length > 1 && (
          <span
            title={`${online.length} jugador${online.length === 1 ? '' : 'es'} conectado${online.length === 1 ? '' : 's'} al club`}
            style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 5, cursor: 'default' }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
            {online.length}
          </span>
        )}
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{time}</span>
      </div>
    </div>
  )
}

function MenuItem({ icon, label, onClick, danger }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', background: hover ? (danger ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.07)') : 'transparent',
        border: 'none', cursor: 'pointer', padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
        transition: 'background .1s',
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 13, color: danger ? '#f87171' : 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{label}</span>
    </button>
  )
}

function getTime() {
  return new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}
