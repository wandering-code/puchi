import { useCallback, useRef, useState } from 'react'
import PlayerAvatar from './PlayerAvatar'

// Ventanita flotante y arrastrable con la cámara de quien esté hablando —
// tanto en la llamada grupal de #club-general (cambia según nivel de audio)
// como en una llamada 1-to-1 (siempre el interlocutor) — para cuando la
// vista completa de la llamada no está en pantalla (se ha navegado a otra
// conversación dentro de Diskordkito, o a otra app entera). Mismo patrón de
// arrastre + persistencia en localStorage que MobileLauncher.jsx (posición
// como {left, bottom}, clamp a los límites de la pantalla, threshold para
// distinguir click de arrastre) — funciona igual con ratón que con dedo
// (Pointer Events). Por defecto abajo a la IZQUIERDA (a propósito: el
// lanzador flotante de móvil vive abajo a la derecha, para no empezar
// solapados los dos).
const SIZE = { w: 180, h: 128 }
const DEFAULT_POS = { left: 24, bottom: 24 }
const DRAG_THRESHOLD = 6

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max)
}

function loadPos(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key))
    if (saved && typeof saved.left === 'number' && typeof saved.bottom === 'number') return saved
  } catch {}
  return DEFAULT_POS
}

function PiPAvatarFallback({ player, size = 56 }) {
  if (!player) {
    return <span style={{ fontSize: 28, opacity: 0.4 }}>👥</span>
  }
  const hasPhoto = !!player.avatar_url
  const hasEmoji = !!player.avatar_emoji
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      background: hasPhoto ? '#000' : hasEmoji ? player.color + '18' : player.color + '28',
      border: `2px solid ${player.color}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {hasPhoto
        ? <PlayerAvatar url={player.avatar_url} size={size} style={{ borderRadius: 0 }} />
        : hasEmoji
        ? <span style={{ fontSize: Math.round(size * 0.5), lineHeight: 1 }}>{player.avatar_emoji}</span>
        : <span style={{ fontSize: Math.round(size * 0.4), fontWeight: 700, color: player.color }}>{player.name?.[0]?.toUpperCase()}</span>
      }
    </div>
  )
}

export default function CallPiP({ playerId, stream, cameraOff, speakerPlayer, participantCount, onRestore }) {
  const posKey = `gatos_call_pip_pos_${playerId}`
  const [pos, setPos] = useState(() => loadPos(posKey))
  const dragRef = useRef(null)
  const suppressClickRef = useRef(false)

  // Mismo fix de autoplay bloqueado que GroupTile (mesh negociando varias
  // conexiones a la vez) — con reintento en onloadedmetadata. Muteado: el
  // sonido de la llamada ya lo dan los <audio> ocultos y persistentes de
  // GatOS.jsx (GroupCallAudioSinks), no este <video> — así no se duplica ni
  // se pierde si esta ventanita cambia de participante o se desmonta.
  const videoRef = useCallback(el => {
    if (!el) return
    if (el.srcObject !== stream) el.srcObject = stream ?? null
    if (!stream) return
    const tryPlay = () => el.play().catch(() => {})
    tryPlay()
    el.onloadedmetadata = tryPlay
  }, [stream])

  function onPointerDown(e) {
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      startLeft: pos.left, startBottom: pos.bottom,
      moved: false,
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function onPointerMove(e) {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) d.moved = true
    if (!d.moved) return
    setPos({
      left:   clamp(d.startLeft   + dx, 8, window.innerWidth  - SIZE.w - 8),
      bottom: clamp(d.startBottom - dy, 8, window.innerHeight - SIZE.h - 8),
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

  function handleClick() {
    if (suppressClickRef.current) { suppressClickRef.current = false; return }
    onRestore?.()
  }

  const showVideo = stream && !cameraOff

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={handleClick}
      title="Volver a la llamada"
      style={{
        position: 'absolute', left: pos.left, bottom: pos.bottom,
        width: SIZE.w, height: SIZE.h, zIndex: 20000, borderRadius: 14,
        overflow: 'hidden', cursor: 'pointer', touchAction: 'none',
        background: '#14151f', border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: '0 10px 32px rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {showVideo ? (
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <PiPAvatarFallback player={speakerPlayer} />
      )}

      {/* Nombre de quien se ve + cuántos hay en la llamada */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '5px 9px', background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 600, color: 'white', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {speakerPlayer?.name ?? 'Llamada grupal'}
        </span>
        {participantCount > 0 && (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', flexShrink: 0 }}>
            👥 {participantCount}
          </span>
        )}
      </div>

      {/* Punto verde — recuerda que la llamada sigue activa aunque no se vea entera */}
      <span style={{
        position: 'absolute', top: 7, right: 7, width: 7, height: 7,
        borderRadius: '50%', background: '#23a55a', boxShadow: '0 0 0 2px rgba(0,0,0,0.4)',
      }} />
    </div>
  )
}
