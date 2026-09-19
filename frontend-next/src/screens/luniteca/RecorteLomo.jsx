import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { IconX } from '../../ui/icons'

// Recorta una foto a una proporción de lomo (una franja alta y estrecha)
// antes de subirla: arrastrar para mover, deslizador para acercar. El
// recorte se hace en el navegador con un canvas, a una resolución fija de
// salida — así llega ya lista, sin depender de que quien la mire recorte
// nada por su cuenta.
//
// La proporción es FIJA y no la del hueco exacto de ESTE libro (ancho/alto
// de medidas() en Lomos.jsx): esas medidas varían de un libro a otro solo
// por decoración (grosor según páginas, alto según un hash) — recortar a esa
// medida exacta daba fotos demasiado cortas/anchas según a qué libro le
// tocara. Lomos.jsx pinta la foto con `background-size: cover`, así que
// sobra con acercarse a una proporción realista de lomo; el hueco de cada
// libro la recorta un poco más si hace falta, igual que una portada.
//
// Distinto de AvatarCropModal (frontend/): esa es cuadrada con guía circular;
// aquí el visor ES ya el recorte — no hace falta una guía aparte dentro.
const VIEWPORT_ALTO = 380
const RATIO = 46 / 190          // ancho:alto de referencia — una franja alta
const ANCHO_SALIDA = 220
const ALTO_SALIDA = Math.round(ANCHO_SALIDA / RATIO)

export default function RecorteLomo({ file, onCancelar, onConfirmar }) {
  const viewportAncho = Math.round(VIEWPORT_ALTO * RATIO)
  const [imgUrl,     setImgUrl]     = useState(null)
  const [imgSize,    setImgSize]    = useState(null) // {w,h} natural
  const [zoomFactor, setZoomFactor] = useState(1)
  const [pan,        setPan]        = useState({ x: 0, y: 0 }) // esquina sup-izq del <img> dentro del visor
  const [guardando,  setGuardando]  = useState(false)
  const dragRef = useRef(null)
  const imgRef  = useRef(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImgUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const baseScale = imgSize ? Math.max(viewportAncho / imgSize.w, VIEWPORT_ALTO / imgSize.h) : 1
  const scale = baseScale * zoomFactor

  function clampPan(p, s) {
    if (!imgSize) return p
    const dispW = imgSize.w * s, dispH = imgSize.h * s
    return {
      x: Math.min(0, Math.max(viewportAncho - dispW, p.x)),
      y: Math.min(0, Math.max(VIEWPORT_ALTO - dispH, p.y)),
    }
  }

  function onImgLoad(e) {
    const w = e.target.naturalWidth, h = e.target.naturalHeight
    const bs = Math.max(viewportAncho / w, VIEWPORT_ALTO / h)
    setImgSize({ w, h })
    setZoomFactor(1)
    setPan({ x: (viewportAncho - w * bs) / 2, y: (VIEWPORT_ALTO - h * bs) / 2 })
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
    // Mantiene fijo el punto de la imagen que hay en el centro del visor.
    const cx = (viewportAncho / 2 - pan.x) / scale
    const cy = (VIEWPORT_ALTO / 2 - pan.y) / scale
    setZoomFactor(newZoom)
    setPan(clampPan({ x: viewportAncho / 2 - cx * newScale, y: VIEWPORT_ALTO / 2 - cy * newScale }, newScale))
  }

  function confirmar() {
    if (!imgSize) return
    setGuardando(true)
    const canvas = document.createElement('canvas')
    canvas.width = ANCHO_SALIDA
    canvas.height = ALTO_SALIDA
    const ctx = canvas.getContext('2d')
    const srcX = -pan.x / scale
    const srcY = -pan.y / scale
    const srcW = viewportAncho / scale
    const srcH = VIEWPORT_ALTO / scale
    ctx.drawImage(imgRef.current, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(blob => {
      setGuardando(false)
      if (blob) onConfirmar(blob)
    }, 'image/jpeg', 0.9)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-velo backdrop-blur-[6px]"
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.94, opacity: 0, y: 8 }}
        transition={{ type: 'spring', damping: 24, stiffness: 340 }}
        className="flex max-w-[92vw] flex-col items-center gap-4 rounded-2xl border border-line bg-surface p-6 shadow-xl"
      >
        <div className="flex w-full items-center gap-3">
          <p className="flex-1 text-sm font-semibold">Encuadra el lomo</p>
          <button onClick={onCancelar} aria-label="Cancelar" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-mute active:bg-surface-2">
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          style={{ width: viewportAncho, height: VIEWPORT_ALTO, touchAction: 'none' }}
          className="relative cursor-grab select-none overflow-hidden rounded-lg bg-black active:cursor-grabbing"
        >
          {imgUrl && (
            <img
              ref={imgRef} src={imgUrl} alt="" onLoad={onImgLoad} draggable={false}
              style={{
                position: 'absolute', left: pan.x, top: pan.y,
                width:  imgSize ? imgSize.w * scale : 'auto',
                height: imgSize ? imgSize.h * scale : 'auto',
                maxWidth: 'none', pointerEvents: 'none',
              }}
            />
          )}
        </div>

        <div className="flex w-full items-center gap-2.5" style={{ width: Math.max(viewportAncho, 220) }}>
          <span className="shrink-0 text-xs text-ink-mute">🔍</span>
          <input
            type="range" min="1" max="3" step="0.01" value={zoomFactor}
            onChange={e => onZoomChange(e.target.value)}
            className="flex-1 accent-accent"
          />
        </div>

        <div className="flex w-full gap-2.5" style={{ width: Math.max(viewportAncho, 220) }}>
          <button onClick={onCancelar} className="h-11 flex-1 rounded-xl2 border border-line text-sm text-ink-dim">
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={guardando || !imgSize}
            className="h-11 flex-1 rounded-xl2 bg-accent text-sm font-semibold text-on-accent disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : 'Usar esta foto'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
