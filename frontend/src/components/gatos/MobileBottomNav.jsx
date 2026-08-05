import { APPS } from './apps/config'
import { DOCK_ICONS } from './apps/DockIcons'
import { launcherApps } from './MobileLauncher'

// PRUEBA (2026-08-05): alternativa al lanzador flotante en abanico — menú
// inferior fijo con todas las apps visibles (mismo criterio de permisos que
// el lanzador, ver launcherApps en MobileLauncher.jsx), estilo barra inferior
// de Kokito (NavBar.jsx) pero con el lenguaje visual glassy de GatOS (mismo
// blur/bordes que Dock.jsx). Si no convence, revertir es solo volver a
// renderizar <MobileLauncher /> en vez de este componente en GatOS.jsx.
export const MOBILE_BOTTOM_NAV_H = 64

export default function MobileBottomNav({ activeAppId, onSelect, player }) {
  const apps = launcherApps(player)

  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      // El padding del safe-area se SUMA a la altura de contenido (no se
      // resta de ella, como pasaba con height fijo + box-sizing:border-box
      // global) — si no, en modo standalone (añadido a pantalla de inicio,
      // sin barra de Safari) el home indicator se comía parte del alto de
      // los 64px y los iconos quedaban aplastados. En Safari normal
      // env(safe-area-inset-bottom) vale 0, así que ahí no se nota.
      height: `calc(${MOBILE_BOTTOM_NAV_H}px + env(safe-area-inset-bottom))`,
      paddingBottom: 'env(safe-area-inset-bottom)',
      display: 'flex', alignItems: 'stretch', justifyContent: 'space-around',
      background: 'rgba(20,18,28,0.55)',
      backdropFilter: 'blur(24px)',
      borderTop: '1px solid rgba(255,255,255,0.12)',
      zIndex: 9999,
    }}>
      {apps.map(id => {
        const app = APPS[id]
        const Icon = DOCK_ICONS[id]
        const active = activeAppId === id
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            aria-label={app.title}
            style={{
              flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 5, padding: 0,
            }}
          >
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: active ? 1 : 0.55,
              boxShadow: active ? `0 3px 10px ${app.color}66` : 'none',
              transform: active ? 'scale(1.06)' : 'scale(1)',
              transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease, opacity 0.18s ease',
            }}>
              {Icon ? <Icon size={38} /> : (
                <span style={{ fontSize: 20 }}>{app.icon}</span>
              )}
            </div>
            <span style={{
              width: 4, height: 4, borderRadius: '50%',
              background: active ? '#ffffff' : 'transparent',
            }} />
          </button>
        )
      })}
    </div>
  )
}
