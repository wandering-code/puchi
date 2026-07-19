import { useState, useRef } from 'react'
import { APPS, isAppVisible } from './apps/config'
import { DOCK_ICONS } from './apps/DockIcons'

// Apps con contenido "de pestaña" en móvil — siempre montadas de fondo,
// se cambia entre ellas con solo opacidad (ver GatOS.jsx). Ajustes y Admin
// NO están aquí: siguen abriéndose como overlay a pantalla completa encima
// (mismo patrón que desktop), pero SÍ son seleccionables desde el abanico
// del lanzador (ver launcherApps más abajo) — es solo otra forma de llegar
// a "abrir esta app", `switchMobileApp` no distingue entre unas y otras.
export const MOBILE_TAB_APPS = ['diskordkito', 'luniteca2', 'pirestore']

// Igual que Dock — quien no es miembro del club solo ve Luniteca.
export function visibleTabApps(player) {
  return MOBILE_TAB_APPS.filter(id => isAppVisible(APPS[id], player))
}

// Qué apps ofrece el abanico del lanzador — TODAS las que el jugador puede
// ver (mismo criterio que el Dock de escritorio), no solo las 3 de pestaña.
// Para el admin eso incluye Ajustes y Admin; para el resto, todo menos Admin
// (y menos lo que exija ser miembro del club, si no lo es — aunque en ese
// caso ni se llega a mostrar el lanzador, ver GatOS.jsx: modo kiosco).
export function launcherApps(player) {
  const isAdmin = player?.name?.toLowerCase() === 'wander'
  return Object.values(APPS)
    .filter(app => !app.hidden && isAppVisible(app, player, isAdmin))
    .map(app => app.id)
}

// Ángulo (grados desde la vertical) y radio de cada pétalo del abanico — va
// de "arriba" hacia un lado (izquierda o derecha según en qué mitad de la
// pantalla esté la muesca, ver fanSide más abajo) para quedarse siempre
// dentro de la pantalla. Se genera según el número de apps: con más apps,
// más radio (para no amontonarlas) repartidas en el mismo cuarto de círculo
// (de "arriba" a "al lado"), nunca por debajo de la muesca.
function buildFan(n) {
  if (n <= 1) return []
  const minAngle = n <= 3 ? 10 : 8
  const maxAngle = n <= 3 ? 82 : 88
  const radius   = n <= 3 ? 118 : n === 4 ? 132 : 148
  return Array.from({ length: n }, (_, i) => ({
    angle: minAngle + (i * (maxAngle - minAngle)) / (n - 1),
    radius,
  }))
}

const NUB_SIZE = 72
const DEFAULT_POS = { right: 16, bottom: 24 }
const DRAG_THRESHOLD = 6

// side: -1 = abanico hacia la izquierda (comportamiento por defecto, muesca
// en la mitad derecha de la pantalla), 1 = hacia la derecha (muesca en la
// mitad izquierda) — así nunca se despliega hacia fuera de la pantalla.
function fanOffset(angleDeg, radius, side = -1) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: side * radius * Math.sin(rad), y: -radius * Math.cos(rad) }
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max)
}

function loadPos(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key))
    if (saved && typeof saved.right === 'number' && typeof saved.bottom === 'number') return saved
  } catch {}
  return DEFAULT_POS
}

export default function MobileLauncher({ activeAppId, onSelect, playerId, player }) {
  const posKey = `gatos_launcher_pos_${playerId}`
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(() => loadPos(posKey))
  const dragRef = useRef(null)
  const suppressClickRef = useRef(false)
  const fanApps = launcherApps(player)
  const fan = buildFan(fanApps.length)

  const ActiveIcon = DOCK_ICONS[activeAppId]
  const activeColor = APPS[activeAppId]?.color ?? '#ffffff'

  // Si la muesca está en la mitad izquierda de la pantalla, el abanico se
  // despliega hacia la derecha en vez de hacia la izquierda (y viceversa),
  // para no salirse nunca de la pantalla.
  const nubCenterX = window.innerWidth - pos.right - NUB_SIZE / 2
  const fanSide = nubCenterX < window.innerWidth / 2 ? 1 : -1

  function onPointerDown(e) {
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      startRight: pos.right, startBottom: pos.bottom,
      moved: false,
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function onPointerMove(e) {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      d.moved = true
      setOpen(false)
    }
    if (!d.moved) return
    setPos({
      right:  clamp(d.startRight  - dx, 4, window.innerWidth  - NUB_SIZE - 4),
      bottom: clamp(d.startBottom - dy, 4, window.innerHeight - NUB_SIZE - 4),
    })
  }

  function onPointerUp() {
    const d = dragRef.current
    dragRef.current = null
    if (d?.moved) {
      suppressClickRef.current = true
      setPos(p => {
        try { localStorage.setItem(posKey, JSON.stringify(p)) } catch {}
        return p
      })
    }
  }

  function handleNubClick() {
    if (suppressClickRef.current) { suppressClickRef.current = false; return }
    setOpen(v => !v)
  }

  return (
    <div style={{
      position: 'absolute', right: pos.right, bottom: pos.bottom,
      width: 168, height: 168, zIndex: 9999, pointerEvents: 'none',
    }}>
      {/* Fondo atenuado mientras el menú está abierto — toca fuera para cerrar */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(5,3,8,0.32)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.22s ease',
          zIndex: -1,
        }}
      />

      {fanApps.map((id, i) => {
        const Icon = DOCK_ICONS[id]
        const { x, y } = fanOffset(fan[i].angle, fan[i].radius, fanSide)
        return (
          <button
            key={id}
            title={APPS[id]?.title}
            onClick={() => { onSelect(id); setOpen(false) }}
            style={{
              position: 'absolute', right: 5, bottom: 5,
              width: 60, height: 60, padding: 0, border: 'none', background: 'none',
              cursor: 'pointer', borderRadius: 14, overflow: 'hidden',
              boxShadow: '0 10px 24px rgba(0,0,0,0.45)',
              opacity: open ? 1 : 0,
              pointerEvents: open ? 'auto' : 'none',
              transform: open ? `translate(${x}px, ${y}px) scale(1)` : 'translate(0, 0) scale(0.35)',
              transition: open
                ? `transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.05}s, opacity 0.2s ease ${i * 0.05}s`
                : 'transform 0.2s ease, opacity 0.15s ease',
            }}
          >
            {Icon ? <Icon size={60} /> : (
              <span style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, background: APPS[id]?.color }}>
                {APPS[id]?.icon}
              </span>
            )}
          </button>
        )
      })}

      {/* Muesca — siempre muestra el icono de la app activa. Se puede
          mantener pulsada y arrastrar a cualquier parte de la pantalla;
          la posición se recuerda por jugador. Un toque simple (sin
          arrastre) sigue abriendo/cerrando el abanico. */}
      <button
        onClick={handleNubClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label="Cambiar de app (mantén pulsado para mover)"
        style={{
          position: 'absolute', right: 0, bottom: 0,
          width: NUB_SIZE, height: NUB_SIZE, borderRadius: '50%',
          border: `1px solid ${open ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.14)'}`,
          background: open ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.09)',
          backdropFilter: 'blur(20px)',
          boxShadow: `0 8px 28px rgba(0,0,0,0.45), 0 0 20px 2px ${activeColor}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'grab', pointerEvents: 'auto', touchAction: 'none',
          transition: 'background 0.2s ease, border-color 0.2s ease',
        }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: 10, overflow: 'hidden',
          transform: open ? 'scale(0.88)' : 'scale(1)',
          transition: 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {ActiveIcon ? <ActiveIcon size={44} /> : (
            <span style={{ fontSize: 20 }}>{APPS[activeAppId]?.icon}</span>
          )}
        </div>
      </button>
    </div>
  )
}
