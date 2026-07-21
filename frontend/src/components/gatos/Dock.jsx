import { useState } from 'react'
import { APPS, isAppVisible } from './apps/config'
import { DOCK_ICONS } from './apps/DockIcons'

export const DOCK_RESERVED = 96

export default function Dock({ windows, onOpenApp, onIconClick, autoHide, player }) {
  const [hovered, setHovered] = useState(false)
  const isAdmin = player?.name?.toLowerCase() === 'wander'

  const hidden = autoHide && !hovered

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        // Cuando está oculto, solo 4px en el borde inferior activan el dock
        height: hidden ? 4 : DOCK_RESERVED,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        paddingBottom: 14,
        zIndex: 9999,
        pointerEvents: 'auto',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
        background: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 20,
        boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
        transform: hidden ? 'translateY(calc(100% + 20px))' : 'translateY(0)',
        transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'transform',
      }}>
        {/* Ajustes no va en el Dock — único sitio: el menú GatOS (ver MenuBar.jsx) */}
        {Object.values(APPS).filter(app => !app.hidden && app.id !== 'settings' && isAppVisible(app, player, isAdmin)).map(app => {
          const win     = windows.find(w => w.appId === app.id)
          const running = !!win
          const Icon    = DOCK_ICONS[app.id]
          return (
            <button
              key={app.id}
              onClick={() => running ? onIconClick(win.id) : onOpenApp(app.id)}
              title={app.title}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                width: 48, padding: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: 44, height: 44, borderRadius: 10,
                  overflow: 'hidden',
                  boxShadow: `0 4px 14px ${app.color}55`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'transform 0.15s ease',
                  background: Icon ? 'none' : app.color,
                  fontSize: 22,
                }}
                onMouseEnter={ev => { ev.currentTarget.style.transform = 'translateY(-8px)' }}
                onMouseLeave={ev => { ev.currentTarget.style.transform = 'translateY(0)' }}
              >
                {Icon ? <Icon size={44} /> : app.icon}
              </div>
              <span style={{
                width: 4, height: 4, borderRadius: '50%',
                background: running ? 'rgba(255,255,255,0.8)' : 'transparent',
                marginTop: 4, display: 'inline-block',
              }} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
