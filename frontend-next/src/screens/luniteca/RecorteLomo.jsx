import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { IconX } from '../../ui/icons'
import { RATIO_FOTO_LOMO } from './Lomos'

// Recorta una foto a la proporción de un lomo (una franja alta y estrecha)
// antes de subirla: arrastrar para mover, pellizcar o girar la rueda para
// acercar. El recorte se hace en el navegador con un canvas, a una
// resolución fija de salida — así llega ya lista, y Lomos.jsx la planta tal
// cual en el hueco del libro (que mide justo esta proporción — ver
// RATIO_FOTO_LOMO en Lomos.jsx — así no hay que estirarla ni recortarla más).
//
// El área donde se arrastra la foto (el ESCENARIO) es más grande que lo que
// realmente se queda (la VENTANA, la franja recortada): así hay sitio de
// sobra para agarrar y mover con el dedo o el ratón sin ir a tientas en una
// tira de 80px, aunque lo que se suba al final sea igual de estrecho.
// Mismo truco que AvatarCropModal (frontend/), con ventana rectangular en
// vez de círculo, y bastante más margen alrededor porque aquí la ventana es
// mucho más estrecha que el escenario.
const ESCENARIO_ANCHO = 280
const ESCENARIO_ALTO = 420
const VENTANA_ALTO = 340
const VENTANA_ANCHO = Math.round(VENTANA_ALTO * RATIO_FOTO_LOMO)
const VENTANA_X = (ESCENARIO_ANCHO - VENTANA_ANCHO) / 2
const VENTANA_Y = (ESCENARIO_ALTO - VENTANA_ALTO) / 2
const ANCHO_SALIDA = 220
const ALTO_SALIDA = Math.round(ANCHO_SALIDA / RATIO_FOTO_LOMO)
const ZOOM_MIN = 1
const ZOOM_MAX = 4

export default function RecorteLomo({ file, onCancelar, onConfirmar }) {
  const [imgUrl,     setImgUrl]     = useState(null)
  const [imgSize,    setImgSize]    = useState(null) // {w,h} natural
  const [zoomFactor, setZoomFactor] = useState(1)
  const [pan,        setPan]        = useState({ x: 0, y: 0 }) // esquina sup-izq del <img>, relativa al escenario
  const [guardando,  setGuardando]  = useState(false)
  const escenarioRef = useRef(null)
  const dragRef = useRef(null)   // arrastre con un dedo o el ratón
  const pinchRef = useRef(null)  // pellizco con dos dedos
  const imgRef  = useRef(null)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImgUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // A zoom 1, la foto cubre justo la VENTANA (puede sobrar por el escenario o
  // no, da igual: lo único que no puede pasar es que quede hueco DENTRO de lo
  // que se va a quedar).
  const baseScale = imgSize ? Math.max(VENTANA_ANCHO / imgSize.w, VENTANA_ALTO / imgSize.h) : 1
  const scale = baseScale * zoomFactor

  // El único límite que importa es que la ventana quede siempre cubierta —
  // el escenario es solo sitio de sobra para agarrar, puede quedar corto o
  // largo por los lados sin que pase nada.
  function clampPan(p, s) {
    if (!imgSize) return p
    const dispW = imgSize.w * s, dispH = imgSize.h * s
    return {
      x: Math.min(VENTANA_X, Math.max(VENTANA_X + VENTANA_ANCHO - dispW, p.x)),
      y: Math.min(VENTANA_Y, Math.max(VENTANA_Y + VENTANA_ALTO - dispH, p.y)),
    }
  }

  function onImgLoad(e) {
    const w = e.target.naturalWidth, h = e.target.naturalHeight
    const bs = Math.max(VENTANA_ANCHO / w, VENTANA_ALTO / h)
    setImgSize({ w, h })
    setZoomFactor(1)
    setPan({ x: VENTANA_X + (VENTANA_ANCHO - w * bs) / 2, y: VENTANA_Y + (VENTANA_ALTO - h * bs) / 2 })
  }

  function cambiarZoom(nuevoZoom, centro) {
    // Mantiene fijo el punto de la imagen que hay bajo `centro` (coordenadas
    // del escenario) al hacer zoom — si no, cada pellizco o giro de rueda
    // desplaza la imagen de sitio y es imposible afinar el encuadre.
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nuevoZoom))
    const nuevaScale = baseScale * z
    setZoomFactor(z)
    setPan(p => {
      const cx = (centro.x - p.x) / scale
      const cy = (centro.y - p.y) / scale
      return clampPan({ x: centro.x - cx * nuevaScale, y: centro.y - cy * nuevaScale }, nuevaScale)
    })
  }

  function puntoEnEscenario(clientX, clientY) {
    const r = escenarioRef.current.getBoundingClientRect()
    return { x: clientX - r.left, y: clientY - r.top }
  }

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (pinchRef.current) {
      // Ya había un dedo abajo: esto es el segundo, empieza el pellizco.
      pinchRef.current.otro = { id: e.pointerId, x: e.clientX, y: e.clientY }
      dragRef.current = null
    } else if (dragRef.current) {
      // No debería pasar con punteros normales, pero por si acaso.
      pinchRef.current = { uno: dragRef.current.puntero, otro: { id: e.pointerId, x: e.clientX, y: e.clientY }, zoomInicial: zoomFactor, panInicial: pan }
      dragRef.current = null
    } else {
      dragRef.current = { puntero: { id: e.pointerId, x: e.clientX, y: e.clientY }, startPan: pan }
    }
  }

  function onPointerMove(e) {
    if (pinchRef.current) {
      const p = pinchRef.current
      const otro = p.uno.id === e.pointerId ? p.otro : (p.otro?.id === e.pointerId ? p.uno : null)
      if (!otro) return
      const mio = { id: e.pointerId, x: e.clientX, y: e.clientY }
      if (p.uno.id === e.pointerId) p.uno = mio; else p.otro = mio
      if (!p.distInicial) {
        p.distInicial = Math.hypot(p.uno.x - p.otro.x, p.uno.y - p.otro.y)
        p.zoomInicial = zoomFactor
        p.panInicial = pan
        return
      }
      const dist = Math.hypot(p.uno.x - p.otro.x, p.uno.y - p.otro.y)
      const medio = puntoEnEscenario((p.uno.x + p.otro.x) / 2, (p.uno.y + p.otro.y) / 2)
      cambiarZoom(p.zoomInicial * (dist / p.distInicial), medio)
      return
    }
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.puntero.x, dy = e.clientY - d.puntero.y
    setPan(clampPan({ x: d.startPan.x + dx, y: d.startPan.y + dy }, scale))
  }

  function onPointerUp(e) {
    if (pinchRef.current) {
      const p = pinchRef.current
      const quedaOtro = p.uno.id === e.pointerId ? p.otro : (p.otro?.id === e.pointerId ? p.uno : null)
      pinchRef.current = null
      // Queda un dedo puesto: que siga como arrastre normal desde donde está.
      if (quedaOtro) dragRef.current = { puntero: quedaOtro, startPan: pan }
      return
    }
    dragRef.current = null
  }

  // React registra los listeners de rueda como pasivos: un onWheel normal no
  // puede impedir que la página se desplace por debajo mientras se hace zoom
  // aquí encima. Hace falta uno nativo, con `passive: false`, para eso — pero
  // añadido una sola vez (no en cada render, que reengancharlo iría dejando
  // el gesto a medias si el dedo o el ratón está encima al re-renderizar),
  // así que la lógica de verdad vive en un ref que se mantiene al día solo.
  const alZoomearRef = useRef(() => {})
  alZoomearRef.current = (e) => {
    cambiarZoom(zoomFactor * (e.deltaY < 0 ? 1.08 : 1 / 1.08), puntoEnEscenario(e.clientX, e.clientY))
  }
  useEffect(() => {
    const el = escenarioRef.current
    const handler = (e) => { e.preventDefault(); alZoomearRef.current(e) }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  function confirmar() {
    if (!imgSize) return
    setGuardando(true)
    const canvas = document.createElement('canvas')
    canvas.width = ANCHO_SALIDA
    canvas.height = ALTO_SALIDA
    const ctx = canvas.getContext('2d')
    const srcX = (VENTANA_X - pan.x) / scale
    const srcY = (VENTANA_Y - pan.y) / scale
    const srcW = VENTANA_ANCHO / scale
    const srcH = VENTANA_ALTO / scale
    ctx.drawImage(imgRef.current, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(blob => {
      setGuardando(false)
      if (blob) onConfirmar(blob)
    }, 'image/jpeg', 0.92)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      // Sin onClick aquí a propósito: se cierra con la X o "Cancelar", nunca
      // tocando fuera sin querer — perder el encuadre a mitad de ajustarlo
      // (o la foto entera) por un toque de más es peor que un botón de más.
      className="fixed inset-0 z-[80] flex items-center justify-center bg-velo p-4 backdrop-blur-[6px]"
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 8 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.94, opacity: 0, y: 8 }}
        transition={{ type: 'spring', damping: 24, stiffness: 340 }}
        onClick={e => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-sm flex-col items-center gap-4 overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-xl"
      >
        <div className="flex w-full items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold">Encuadra el lomo</p>
            <p className="text-xs text-ink-mute">Arrastra para mover · pellizca o usa la rueda para acercar</p>
          </div>
          <button onClick={onCancelar} aria-label="Cancelar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-mute transition-colors active:bg-surface-2">
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div
          ref={escenarioRef}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          style={{ width: ESCENARIO_ANCHO, height: ESCENARIO_ALTO, touchAction: 'none' }}
          className="relative mx-auto cursor-grab select-none overflow-hidden rounded-xl bg-black active:cursor-grabbing"
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
          {/* La ventana (lo que de verdad se sube) se ve nítida; el resto del
              escenario —solo ahí para tener más sitio donde agarrar— queda
              oscurecido, para que no haya duda de qué se va a quedar. */}
          <div
            style={{
              position: 'absolute', left: VENTANA_X, top: VENTANA_Y, width: VENTANA_ANCHO, height: VENTANA_ALTO,
              boxShadow: '0 0 0 9999px rgba(0,0,0,.6)',
              border: '1px solid rgba(255,255,255,.7)',
              pointerEvents: 'none',
            }}
          />
        </div>

        <div className="flex w-full items-center gap-2.5">
          <span className="shrink-0 text-xs text-ink-mute">🔍</span>
          <input
            type="range" min={ZOOM_MIN} max={ZOOM_MAX} step="0.01" value={zoomFactor}
            onChange={e => cambiarZoom(Number(e.target.value), { x: VENTANA_X + VENTANA_ANCHO / 2, y: VENTANA_Y + VENTANA_ALTO / 2 })}
            className="flex-1 accent-accent"
          />
        </div>

        <div className="flex w-full gap-2.5">
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
