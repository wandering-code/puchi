import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

const VIEWPORT = 260   // tamaño del recuadro de recorte en pantalla, en px
const OUTPUT   = 400   // resolución (cuadrada) de la imagen final subida

// Deja elegir cómo encuadrar la foto antes de subirla: arrastrar para mover,
// deslizador para hacer zoom. El resultado se recorta en el propio navegador
// (canvas) y se sube ya como imagen cuadrada — el círculo es solo una guía
// visual, PlayerAvatar ya recorta en círculo al mostrarla.
export default function AvatarCropModal({ file, onCancel, onConfirm }) {
  const [imgUrl,      setImgUrl]      = useState(null)
  const [imgSize,     setImgSize]     = useState(null) // {w,h} natural
  const [zoomFactor,  setZoomFactor]  = useState(1)
  const [pan,         setPan]         = useState({ x: 0, y: 0 }) // esquina sup-izq del <img> dentro del viewport
  const [saving,      setSaving]      = useState(false)
  const dragRef = useRef(null)
  const imgRef  = useRef(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImgUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const baseScale = imgSize ? Math.max(VIEWPORT / imgSize.w, VIEWPORT / imgSize.h) : 1
  const scale = baseScale * zoomFactor

  function clampPan(p, s) {
    if (!imgSize) return p
    const dispW = imgSize.w * s, dispH = imgSize.h * s
    return {
      x: Math.min(0, Math.max(VIEWPORT - dispW, p.x)),
      y: Math.min(0, Math.max(VIEWPORT - dispH, p.y)),
    }
  }

  function onImgLoad(e) {
    const w = e.target.naturalWidth, h = e.target.naturalHeight
    const bs = Math.max(VIEWPORT / w, VIEWPORT / h)
    setImgSize({ w, h })
    setZoomFactor(1)
    setPan({ x: (VIEWPORT - w * bs) / 2, y: (VIEWPORT - h * bs) / 2 })
  }

  function onPointerDown(e) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPan: pan }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function onPointerMove(e) {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY
    setPan(clampPan({ x: d.startPan.x + dx, y: d.startPan.y + dy }, scale))
  }
  function onPointerUp() { dragRef.current = null }

  function onZoomChange(v) {
    const newZoom = Number(v)
    const newScale = baseScale * newZoom
    // Mantiene fijo el punto de la imagen que hay en el centro del viewport al hacer zoom
    const cx = (VIEWPORT / 2 - pan.x) / scale
    const cy = (VIEWPORT / 2 - pan.y) / scale
    setZoomFactor(newZoom)
    setPan(clampPan({ x: VIEWPORT / 2 - cx * newScale, y: VIEWPORT / 2 - cy * newScale }, newScale))
  }

  function confirm() {
    if (!imgSize) return
    setSaving(true)
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT; canvas.height = OUTPUT
    const ctx = canvas.getContext('2d')
    const srcX = -pan.x / scale
    const srcY = -pan.y / scale
    const srcSize = VIEWPORT / scale
    ctx.drawImage(imgRef.current, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT, OUTPUT)
    canvas.toBlob(blob => {
      setSaving(false)
      if (blob) onConfirm(blob)
    }, 'image/jpeg', 0.92)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'absolute', inset: 0, zIndex: 100000,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 8 }}
        transition={{ type: 'spring', damping: 22, stiffness: 320 }}
        style={{
          background: '#1e1f2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20,
          padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        }}
      >
        <p style={{ color: 'white', fontSize: 14, fontWeight: 700 }}>Encuadra tu foto</p>

        <div
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          style={{
            width: VIEWPORT, height: VIEWPORT, position: 'relative', overflow: 'hidden',
            borderRadius: 12, background: '#000', cursor: 'grab', touchAction: 'none', userSelect: 'none',
          }}
        >
          {imgUrl && (
            <img ref={imgRef} src={imgUrl} alt="" onLoad={onImgLoad} draggable={false}
              style={{
                position: 'absolute', left: pan.x, top: pan.y,
                width:  imgSize ? imgSize.w * scale : 'auto',
                height: imgSize ? imgSize.h * scale : 'auto',
                pointerEvents: 'none', maxWidth: 'none',
              }} />
          )}
          {/* Guía circular: oscurece todo menos el círculo central, no afecta al recorte real */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.5)',
            pointerEvents: 'none',
          }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: VIEWPORT }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>🔍</span>
          <input type="range" min="1" max="3" step="0.01" value={zoomFactor}
            onChange={e => onZoomChange(e.target.value)}
            style={{ flex: 1, accentColor: '#5865f2' }} />
        </div>

        <div style={{ display: 'flex', gap: 10, width: VIEWPORT }}>
          <button onClick={onCancel} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '9px', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 13 }}>
            Cancelar
          </button>
          <button onClick={confirm} disabled={saving || !imgSize}
            style={{ flex: 1, background: '#5865f2', border: 'none', borderRadius: 8, padding: '9px', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: (saving || !imgSize) ? 0.6 : 1 }}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
