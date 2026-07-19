import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { DOCK_ICONS } from './apps/DockIcons'

const MIN_W = 280
const MIN_H = 180
const E = 6
const C = 14

const HANDLES = [
  { dir: 'n',  s: { top: 0,    left: C,    right: C,   height: E,  cursor: 'ns-resize'  } },
  { dir: 's',  s: { bottom: 0, left: C,    right: C,   height: E,  cursor: 'ns-resize'  } },
  { dir: 'e',  s: { right: 0,  top: C,     bottom: C,  width: E,   cursor: 'ew-resize'  } },
  { dir: 'w',  s: { left: 0,   top: C,     bottom: C,  width: E,   cursor: 'ew-resize'  } },
  { dir: 'ne', s: { top: 0,    right: 0,   width: C,   height: C,  cursor: 'ne-resize'  } },
  { dir: 'nw', s: { top: 0,    left: 0,    width: C,   height: C,  cursor: 'nw-resize'  } },
  { dir: 'se', s: { bottom: 0, right: 0,   width: C,   height: C,  cursor: 'se-resize'  } },
  { dir: 'sw', s: { bottom: 0, left: 0,    width: C,   height: C,  cursor: 'sw-resize'  } },
]

export default function Window({ win, appMeta, children, onClose, onFocus, onMinimize, onMove, onResize, onMaximize }) {
  const [localPos,   setLocalPos]   = useState(win.pos)
  const [localSize,  setLocalSize]  = useState(win.size)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => { setLocalPos(p  => win.pos.x  !== p.x  || win.pos.y  !== p.y  ? win.pos  : p)  }, [win.pos.x,  win.pos.y])
  useEffect(() => { setLocalSize(s => win.size.w !== s.w  || win.size.h !== s.h  ? win.size : s) }, [win.size.w, win.size.h])

  const { id, icon, title } = appMeta
  const DockIcon = DOCK_ICONS[id]
  const maximized = win.maximized

  const pos  = maximized ? win.pos  : localPos
  const size = maximized ? win.size : localSize

  // ── Drag ──────────────────────────────────────────────────────────────────────
  const startDrag = useCallback((e) => {
    if (e.button !== 0 || maximized) return
    e.preventDefault()
    onFocus()
    setIsDragging(true)
    const ox = e.clientX - localPos.x
    const oy = e.clientY - localPos.y
    let cur = { ...localPos }

    const onMM = (e) => {
      cur = { x: Math.max(0, e.clientX - ox), y: Math.max(0, e.clientY - oy) }
      setLocalPos(cur)
    }
    const onMU = () => {
      setIsDragging(false)
      onMove(cur)
      document.removeEventListener('mousemove', onMM)
      document.removeEventListener('mouseup',   onMU)
    }
    document.addEventListener('mousemove', onMM)
    document.addEventListener('mouseup',   onMU)
  }, [localPos, onFocus, onMove, maximized])

  // ── Resize ────────────────────────────────────────────────────────────────────
  const startResize = useCallback((e, dir) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    onFocus()
    setIsDragging(true)
    const sx = e.clientX, sy = e.clientY
    const sp = { ...localPos }, ss = { ...localSize }
    let cp = { ...sp }, cs = { ...ss }

    const onMM = (e) => {
      const dx = e.clientX - sx, dy = e.clientY - sy
      cp = { ...sp }; cs = { ...ss }
      if (dir.includes('e')) cs.w = Math.max(MIN_W, ss.w + dx)
      if (dir.includes('s')) cs.h = Math.max(MIN_H, ss.h + dy)
      if (dir.includes('w')) { cs.w = Math.max(MIN_W, ss.w - dx); cp.x = sp.x + ss.w - cs.w }
      if (dir.includes('n')) { cs.h = Math.max(MIN_H, ss.h - dy); cp.y = sp.y + ss.h - cs.h }
      setLocalPos(cp)
      setLocalSize(cs)
    }
    const onMU = () => {
      setIsDragging(false)
      onMove(cp); onResize(cs)
      document.removeEventListener('mousemove', onMM)
      document.removeEventListener('mouseup',   onMU)
    }
    document.addEventListener('mousemove', onMM)
    document.addEventListener('mouseup',   onMU)
  }, [localPos, localSize, onFocus, onMove, onResize])

  // Durante drag/resize: transición instantánea para no crear lag.
  // En reposo: animación suave para maximizar/restaurar.
  const transition = isDragging
    ? { duration: 0 }
    : { duration: 0.25, ease: [0.4, 0, 0.2, 1], opacity: { duration: 0.15 }, scale: { duration: 0.15 } }

  return (
    <motion.div
      initial={{ scale: 0.94, opacity: 0, left: pos.x, top: pos.y, width: size.w, height: size.h, borderRadius: maximized ? 0 : 12 }}
      animate={{ scale: 1,    opacity: 1, left: pos.x, top: pos.y, width: size.w, height: size.h, borderRadius: maximized ? 0 : 12 }}
      exit={{    scale: 0.94, opacity: 0, y: 8 }}
      transition={transition}
      onMouseDown={onFocus}
      style={{
        position: 'absolute',
        zIndex: win.zIndex,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transformOrigin: '50% 0%',
        boxShadow: maximized ? 'none' : '0 24px 64px rgba(0,0,0,0.6), 0 2px 0 rgba(255,255,255,0.06)',
        border:    maximized ? 'none' : '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* ── Barra de título ───────────────────────────────────────────────── */}
      <div
        onMouseDown={startDrag}
        style={{
          position: 'relative',
          background: 'rgba(46,46,52,0.92)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          padding: '0 12px', height: 38, flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 8,
          cursor: maximized ? 'default' : 'grab', userSelect: 'none',
        }}
      >
        <button onMouseDown={e => e.stopPropagation()} onClick={onClose}
          style={dot('#ff5f57')} title="Cerrar" />
        <button onMouseDown={e => e.stopPropagation()} onClick={onMinimize}
          style={dot('#ffbd2e')} title="Minimizar" />
        <button onMouseDown={e => e.stopPropagation()} onClick={onMaximize}
          style={dot('#28c840')} title={maximized ? 'Restaurar' : 'Maximizar'} />

        {/* App icon — right side */}
        <div style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          pointerEvents: 'none', display: 'flex', alignItems: 'center',
        }}>
          {DockIcon
            ? <div style={{ width: 22, height: 22, borderRadius: 5, overflow: 'hidden', opacity: 0.8 }}><DockIcon size={22} /></div>
            : <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
          }
        </div>
      </div>

      {/* ── Contenido ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', background: '#111827' }}>
        {children}
      </div>

      {/* ── Handles de redimensionado ──────────────────────────────────────── */}
      {!maximized && HANDLES.map(h => (
        <div
          key={h.dir}
          onMouseDown={e => startResize(e, h.dir)}
          style={{ position: 'absolute', ...h.s, zIndex: 20 }}
        />
      ))}
    </motion.div>
  )
}

const dot = (bg) => ({
  width: 12, height: 12, borderRadius: '50%',
  background: bg, border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
})
