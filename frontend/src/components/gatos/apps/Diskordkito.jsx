import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useIsMobile } from '../../../utils/responsive'
import PlayerAvatar from '../PlayerAvatar'

// Navegación lista/chat en móvil: la pantalla entrante desliza desde la
// dirección de avance, la saliente desliza hacia el lado contrario.
const mobileNavVariants = {
  enter:  (dir) => ({ x: dir > 0 ? '100%' : '-100%' }),
  center: { x: 0 },
  exit:   (dir) => ({ x: dir > 0 ? '-100%' : '100%' }),
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────
function IconPhone({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M3 2a1 1 0 0 1 1-1h2.5a1 1 0 0 1 1 1v2a1 1 0 0 1-.27.69L6 6.9a9.5 9.5 0 0 0 3.1 3.1l1.2-1.23A1 1 0 0 1 11 8.5h2a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1C6.27 13 3 9.73 3 4V2Z"
        fill={color} />
    </svg>
  )
}

function IconPhoneEnd({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M10 7c-4.42 0-8 1.79-8 4v1l2.5 2.5a1 1 0 0 0 1.41 0L7.5 13a1 1 0 0 0 0-1.41L6.6 10.7A11.6 11.6 0 0 1 10 10.2c1.15 0 2.24.17 3.4.5l-.9.89a1 1 0 0 0 0 1.41l1.59 1.5a1 1 0 0 0 1.41 0L18 12v-1c0-2.21-3.58-4-8-4Z"
        fill={color} opacity="0.85" />
      <line x1="3" y1="3" x2="17" y2="17" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function IconMic({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <rect x="6.5" y="1.5" width="5" height="8" rx="2.5" fill={color} />
      <path d="M3.5 9a5.5 5.5 0 0 0 11 0" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <line x1="9" y1="14.5" x2="9" y2="16.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6.5" y1="16.5" x2="11.5" y2="16.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconMicOff({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <rect x="6.5" y="1.5" width="5" height="8" rx="2.5" fill={color} opacity="0.35" />
      <path d="M3.5 9a5.5 5.5 0 0 0 11 0" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.35" />
      <line x1="9" y1="14.5" x2="9" y2="16.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6.5" y1="16.5" x2="11.5" y2="16.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="2" x2="16" y2="16" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function IconCamera({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <rect x="1" y="5" width="11" height="8" rx="2" fill={color} />
      <path d="M12 8l5-2.5v7L12 10V8Z" fill={color} />
    </svg>
  )
}

function IconCameraOff({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <rect x="1" y="5" width="11" height="8" rx="2" fill={color} opacity="0.35" />
      <path d="M12 8l5-2.5v7L12 10V8Z" fill={color} opacity="0.35" />
      <line x1="2" y1="2" x2="16" y2="16" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function IconSidebar({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="2" width="13" height="12" rx="2" stroke={color} strokeWidth="1.3" fill="none" />
      <line x1="6" y1="2.5" x2="6" y2="13.5" stroke={color} strokeWidth="1.3" />
      <rect x="2.6" y="4" width="2.3" height="8" rx="0.8" fill={color} opacity="0.6" />
    </svg>
  )
}

function IconChat({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path d="M2 3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6l-4 3V3Z" fill={color} />
    </svg>
  )
}

// ── CallAvatar ────────────────────────────────────────────────────────────────
function CallAvatar({ player, size = 72 }) {
  if (!player) return null
  const hasPhoto = !!player.avatar_url
  const hasEmoji = !!player.avatar_emoji
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      background: hasPhoto ? '#000' : hasEmoji ? player.color + '18' : player.color + '28',
      border: `2px solid ${player.color}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 0 0 6px ${player.color}14`,
    }}>
      {hasPhoto
        ? <PlayerAvatar url={player.avatar_url} size={size} style={{ borderRadius: 0 }} />
        : hasEmoji
        ? <span style={{ fontSize: Math.round(size * 0.52), lineHeight: 1 }}>{player.avatar_emoji}</span>
        : <span style={{ fontSize: Math.round(size * 0.42), fontWeight: 700, color: player.color }}>{player.name[0].toUpperCase()}</span>
      }
    </div>
  )
}

// ── Incoming call modal ───────────────────────────────────────────────────────
function IncomingCallModal({ peer, callType, onAccept, onReject }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{
        position: 'absolute', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
      }}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 8 }}
        transition={{ type: 'spring', damping: 22, stiffness: 320 }}
        style={{
        background: '#1e1f2e', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, padding: '36px 44px', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)', minWidth: 260,
      }}>
        <CallAvatar player={peer} size={72} />
        <div>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginBottom: 6, letterSpacing: 0.5 }}>
            {callType === 'video' ? 'Videollamada entrante' : 'Llamada de voz'}
          </p>
          <p style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>{peer.name}</p>
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
          <button onClick={onReject} title="Rechazar" style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#ed4245', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(237,66,69,0.5)', transition: 'transform .1s',
          }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <IconPhoneEnd size={24} color="white" />
          </button>
          <button onClick={onAccept} title="Aceptar" style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#23a55a', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(35,165,90,0.5)', transition: 'transform .1s',
          }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <IconPhone size={24} color="white" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Outgoing call overlay ─────────────────────────────────────────────────────
function CallingOverlay({ peer, callType, onCancel }) {
  const [dots, setDots] = useState('.')
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 600)
    return () => clearInterval(t)
  }, [])
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{
        position: 'absolute', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
      }}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 8 }}
        transition={{ type: 'spring', damping: 22, stiffness: 320 }}
        style={{
        background: '#1e1f2e', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, padding: '36px 44px', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)', minWidth: 260,
      }}>
        <CallAvatar player={peer} size={72} />
        <div>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginBottom: 6, letterSpacing: 0.5 }}>
            {callType === 'video' ? 'Videollamada' : 'Llamada de voz'}{dots}
          </p>
          <p style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>{peer.name}</p>
        </div>
        <button onClick={onCancel} title="Cancelar" style={{
          width: 56, height: 56, borderRadius: '50%', marginTop: 4,
          background: '#ed4245', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(237,66,69,0.5)', transition: 'transform .1s',
        }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <IconPhoneEnd size={24} color="white" />
        </button>
      </motion.div>
    </motion.div>
  )
}

// ── Active call view ──────────────────────────────────────────────────────────
function CallView({ peer, callType, localStream, remoteStream, isMuted, isCameraOff, remoteCameraOff,
                    onEnd, onToggleMute, onToggleCamera, showChat, onToggleChat, chatProps }) {
  const isMobile = useIsMobile()
  const [localExpanded, setLocalExpanded] = useState(false)
  const chatScrollRef = useRef(null)

  // Callback refs: se llaman al montar y cuando el stream cambia. El local va
  // silenciado (el autoplay de vídeo mudo casi siempre lo permite el
  // navegador), pero en la práctica en iOS Safari a veces también se queda
  // en negro pese a ir muted — mismo fix de .play() con reintento que el
  // remoto, no solo confiar en el autoplay.
  const localVideoRef  = useCallback(el => {
    if (!el) return
    if (el.srcObject !== localStream) el.srcObject = localStream ?? null
    if (!localStream) return
    const tryPlay = () => el.play().catch(() => {})
    tryPlay()
    el.onloadedmetadata = tryPlay
  }, [localStream])
  // El remoto no va silenciado, así que el navegador a veces bloquea su
  // autoplay (se queda en un fotograma negro) — mismo fix que en GroupTile:
  // forzar .play() con reintento cuando cargan los metadatos.
  const remoteVideoRef = useCallback(el => {
    if (!el) return
    if (el.srcObject !== remoteStream) el.srcObject = remoteStream ?? null
    if (!remoteStream) return
    const tryPlay = () => el.play().catch(() => {})
    tryPlay()
    el.onloadedmetadata = tryPlay
  }, [remoteStream])

  useEffect(() => {
    if (!showChat) return
    const el = chatScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chatProps?.messages?.length, showChat])

  const isVideo = callType === 'video'

  const ctrlBtn = (active, danger) => ({
    width: 46, height: 46, borderRadius: '50%', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'transform .1s, background .1s',
    background: danger ? '#ed4245' : active ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)',
    boxShadow: danger ? '0 4px 14px rgba(237,66,69,0.45)' : 'none',
  })

  // PiP size when expanded vs compact
  const pipW = localExpanded ? 240 : 124
  const pipH = localExpanded ? 180 : 94

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#080810', display: 'flex', zIndex: 10 }}>

      {/* ── Call area ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative' }}>
        {/* Vídeo remoto: montado siempre que haya stream (aunque no se muestre)
            para no cortar el audio cuando la cámara remota está apagada. */}
        {remoteStream && (
          <video ref={remoteVideoRef} autoPlay playsInline
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
              display: (isVideo && !remoteCameraOff) ? 'block' : 'none',
            }} />
        )}

        {/* Placeholder: llamada de voz, cámara remota apagada, o aún conectando */}
        {(!isVideo || remoteCameraOff || !remoteStream) && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, background: (remoteCameraOff && remoteStream) ? '#1a1b28' : undefined }}>
            {remoteCameraOff && remoteStream
              ? <IconCameraOff size={48} color="rgba(255,255,255,0.3)" />
              : <CallAvatar player={peer} size={96} />
            }
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
              {remoteStream ? peer?.name : 'Conectando…'}
            </p>
          </div>
        )}

        {/* Peer name */}
        <div style={{ position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', color: 'white', fontSize: 13, fontWeight: 600, padding: '5px 16px', borderRadius: 20 }}>
            {peer?.name}
          </span>
        </div>

        {/* Local video PiP — solo en videollamada */}
        {isVideo && (
          <div
            onClick={() => setLocalExpanded(e => !e)}
            style={{
              position: 'absolute', bottom: 76, right: 14,
              width: pipW, height: pipH, borderRadius: 10, overflow: 'hidden',
              border: `2px solid ${localExpanded ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)'}`,
              background: '#111', cursor: 'pointer',
              boxShadow: localExpanded ? '0 8px 32px rgba(0,0,0,0.8)' : '0 4px 16px rgba(0,0,0,0.6)',
              transition: 'width .25s ease, height .25s ease, box-shadow .2s',
              zIndex: 5,
            }}
          >
            {isCameraOff ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1b28' }}>
                <IconCameraOff size={26} color="rgba(255,255,255,0.25)" />
              </div>
            ) : (
              <video ref={localVideoRef} autoPlay playsInline muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            )}
          </div>
        )}

        {/* Controls */}
        <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button onClick={onToggleMute} style={ctrlBtn(isMuted, false)} title={isMuted ? 'Activar micrófono' : 'Silenciar'}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {isMuted ? <IconMicOff size={19} color="white" /> : <IconMic size={19} color="white" />}
          </button>
          <button onClick={onEnd} style={ctrlBtn(false, true)} title="Colgar"
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <IconPhoneEnd size={22} color="white" />
          </button>
          {isVideo && (
            <button onClick={onToggleCamera} style={ctrlBtn(isCameraOff, false)} title={isCameraOff ? 'Activar cámara' : 'Apagar cámara'}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {isCameraOff ? <IconCameraOff size={19} color="white" /> : <IconCamera size={19} color="white" />}
            </button>
          )}
          <button onClick={onToggleChat} style={ctrlBtn(showChat, false)} title="Chat"
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <IconChat size={18} color="white" />
          </button>
        </div>
      </div>

      {/* ── Chat panel ───────────────────────────────────────────────────── */}
      {/* En móvil ocupa toda la pantalla (no cabe un panel de 300px al lado
          del vídeo); en desktop sigue siendo un panel lateral fijo. */}
      {showChat && chatProps && (
        <div style={{
          position: isMobile ? 'absolute' : 'static',
          inset: isMobile ? 0 : undefined,
          zIndex: isMobile ? 20 : undefined,
          width: isMobile ? '100%' : 300,
          background: '#111827',
          borderLeft: isMobile ? 'none' : '1px solid rgba(255,255,255,0.08)',
          display: 'flex', flexDirection: 'column', flexShrink: 0,
        }}>
          <div style={{ padding: '10px 8px 10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {isMobile && (
              <button onClick={onToggleChat} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: '6px 8px 6px 0' }}>‹</button>
            )}
            <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>Chat con {peer?.name}</span>
          </div>
          <div ref={chatScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {chatProps.messages.map((m, i) => {
              const prev    = chatProps.messages[i - 1]
              const compact = prev?.player_id === m.player_id &&
                (new Date(m.created_at) - new Date(prev.created_at)) < 5 * 60 * 1000
              const isOwn = m.player_id === chatProps.player.id
              return <MessageRow key={m.id} msg={m} compact={compact} isOwn={isOwn} small />
            })}
          </div>
          <form onSubmit={chatProps.onSend} style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <input
              value={chatProps.input}
              onChange={chatProps.onInput}
              placeholder="Mensaje…"
              style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: 'white', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
            />
          </form>
        </div>
      )}
    </div>
  )
}

// ── Group call view (grid adaptable a N participantes) ────────────────────────
// "bare": el único remoto ocupa toda la zona de vídeo (sin tarjeta ni bordes),
// igual que la llamada 1-to-1. Con 2+ remotos cada uno es una tarjeta con
// proporción fija (evita recuadros delgados y alargados en pantallas
// estrechas como el móvil, donde antes se estiraban para llenar todo el alto).
function GroupTile({ player: p, stream, isVideo, cameraOff, bare, onClick, fit = 'cover' }) {
  // Con varias conexiones negociándose casi a la vez (mesh), el navegador a
  // veces bloquea el autoplay de un vídeo remoto (no silenciado, a diferencia
  // del PiP propio) por llegar "demasiado lejos" del gesto de clic que inició
  // la llamada — se queda parado en un fotograma en negro. Forzar .play() (con
  // reintento cuando cargan los metadatos) lo recupera.
  const videoRef = useCallback(el => {
    if (!el) return
    if (el.srcObject !== stream) el.srcObject = stream ?? null
    if (!stream) return
    const tryPlay = () => el.play().catch(() => {})
    tryPlay()
    el.onloadedmetadata = tryPlay
  }, [stream])
  const showVideo = isVideo && stream && !cameraOff
  return (
    <div onClick={onClick} style={{
      position: 'relative', width: '100%', height: '100%',
      borderRadius: bare ? 0 : 12, overflow: 'hidden', background: bare ? 'transparent' : '#14151f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      {showVideo ? (
        <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: fit }} />
      ) : (
        cameraOff && stream
          ? <IconCameraOff size={bare ? 48 : 36} color="rgba(255,255,255,0.3)" />
          : <CallAvatar player={p} size={bare ? 96 : 56} />
      )}
      <span style={{
        position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
        color: 'white', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 14,
      }}>
        {p?.name ?? (stream ? 'Conectando…' : '…')}
      </span>
    </div>
  )
}

// Elige el número de columnas que mejor aprovecha el área disponible para N
// tarjetas de proporción fija (4:3) — evalúa cada reparto posible en filas×
// columnas y se queda con el que da la tarjeta más grande. Así en un
// contenedor estrecho y alto (móvil) tiende a apilar en 1 columna, y en uno
// ancho (escritorio) reparte en varias, sin breakpoints fijos por dispositivo.
function bestGridCols(n, w, h, aspect = 4 / 3) {
  if (n <= 0 || w <= 0 || h <= 0) return 1
  let bestCols = 1, bestArea = 0
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols)
    let cellW = w / cols
    let cellH = cellW / aspect
    if (cellH * rows > h) {
      cellH = h / rows
      cellW = cellH * aspect
    }
    const area = cellW * cellH
    if (area > bestArea) { bestArea = area; bestCols = cols }
  }
  return bestCols
}

function GroupCallView({ myId, participantIds, allPlayers, callType, localStream, remoteStreams,
                         isMuted, isCameraOff, remoteCameraOff, onEnd, onToggleMute, onToggleCamera,
                         showChat, onToggleChat, chatProps, sidebarCollapsed, onToggleSidebar }) {
  const isMobile = useIsMobile()
  const [localExpanded, setLocalExpanded] = useState(false)
  // Participante "en foco": ocupa la mayor parte del área, el resto (menos
  // yo, que sigo siendo el PiP aparte) pasa a una tira de miniaturas — nunca
  // desaparece nadie de la pantalla, solo cambia de tamaño.
  const [spotlightId, setSpotlightId] = useState(null)
  const chatScrollRef = useRef(null)
  const gridAreaRef = useRef(null)
  const [areaSize, setAreaSize] = useState({ w: 0, h: 0 })

  // Mismo fix de .play() con reintento que en CallView — el vídeo local, aunque
  // silenciado, a veces se queda en negro en iOS Safari si solo se confía en
  // el autoplay.
  const localVideoRef = useCallback(el => {
    if (!el) return
    if (el.srcObject !== localStream) el.srcObject = localStream ?? null
    if (!localStream) return
    const tryPlay = () => el.play().catch(() => {})
    tryPlay()
    el.onloadedmetadata = tryPlay
  }, [localStream])

  useEffect(() => {
    if (!showChat) return
    const el = chatScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chatProps?.messages?.length, showChat])

  const isVideo = callType === 'video'
  const remoteIds = participantIds.filter(id => id !== myId)
  const remoteIdsKey = remoteIds.join(',')

  // Si el participante en foco se va de la llamada, vuelve a la rejilla normal.
  useEffect(() => {
    if (spotlightId != null && !remoteIds.includes(spotlightId)) setSpotlightId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteIdsKey, spotlightId])

  // Mide el área real disponible (no solo isMobile) para que el reparto en
  // columnas se adapte también a ventanas de escritorio redimensionadas.
  useEffect(() => {
    const el = gridAreaRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setAreaSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cols = bestGridCols(remoteIds.length, areaSize.w, areaSize.h)
  const thumbIds = spotlightId != null ? remoteIds.filter(id => id !== spotlightId) : []

  const ctrlBtn = (active, danger) => ({
    width: 46, height: 46, borderRadius: '50%', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'transform .1s, background .1s',
    background: danger ? '#ed4245' : active ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)',
    boxShadow: danger ? '0 4px 14px rgba(237,66,69,0.45)' : 'none',
  })

  const pipW = localExpanded ? 240 : 124
  const pipH = localExpanded ? 180 : 94

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#080810', display: 'flex', zIndex: 10 }}>

      <div style={{ flex: 1, position: 'relative' }}>
        {/* La vista de llamada tapa toda la cabecera del chat (incluido el
            botón de ocultar el sidebar), así que necesita su propio control
            flotante para poder ganar espacio mientras la llamada está activa. */}
        {!isMobile && onToggleSidebar && (
          <button onClick={onToggleSidebar} title={sidebarCollapsed ? 'Mostrar canales' : 'Ocultar canales'} style={{
            position: 'absolute', top: 14, left: 14, zIndex: 20,
            width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .1s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          >
            <IconSidebar size={16} color="white" />
          </button>
        )}

        <div ref={gridAreaRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 76 }}>
          {remoteIds.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Esperando a que alguien más se una…</p>
            </div>
          )}

          {/* Un único remoto: ocupa toda la zona de vídeo, igual que en la 1-to-1 */}
          {remoteIds.length === 1 && (
            <GroupTile player={allPlayers.find(p => p.id === remoteIds[0])} stream={remoteStreams[remoteIds[0]]}
              isVideo={isVideo} cameraOff={remoteCameraOff[remoteIds[0]]} bare />
          )}

          {/* 2+ remotos, sin nadie en foco: rejilla — el número de columnas lo
              decide bestGridCols según el área real medida, no un breakpoint
              fijo, así que en un contenedor estrecho y alto (móvil) apila en
              1 columna y en uno ancho reparte en varias. Clic en cualquiera
              para ponerlo en foco. */}
          {remoteIds.length >= 2 && spotlightId == null && (
            <div style={{
              position: 'absolute', inset: 0, overflowY: 'auto',
              display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridAutoRows: 'min-content',
              gap: 10, padding: 12, alignContent: 'center', justifyContent: 'center',
            }}>
              {remoteIds.map(id => (
                <div key={id} style={{ aspectRatio: '4 / 3', width: '100%' }}>
                  <GroupTile player={allPlayers.find(p => p.id === id)} stream={remoteStreams[id]}
                    isVideo={isVideo} cameraOff={remoteCameraOff[id]} onClick={() => setSpotlightId(id)} />
                </div>
              ))}
            </div>
          )}

          {/* Alguien en foco: ocupa casi todo el área, el resto pasa a una
              tira de miniaturas debajo — nadie desaparece de la pantalla.
              Clic en la miniatura para poner el foco en ella; clic en la
              grande para volver a la rejilla. */}
          {remoteIds.length >= 2 && spotlightId != null && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                <GroupTile player={allPlayers.find(p => p.id === spotlightId)} stream={remoteStreams[spotlightId]}
                  isVideo={isVideo} cameraOff={remoteCameraOff[spotlightId]} bare fit="contain" onClick={() => setSpotlightId(null)} />
              </div>
              <div style={{ display: 'flex', gap: 8, padding: '8px 8px 0', overflowX: 'auto', flexShrink: 0 }}>
                {thumbIds.map(id => (
                  <div key={id} style={{ width: 110, aspectRatio: '4 / 3', flexShrink: 0 }}>
                    <GroupTile player={allPlayers.find(p => p.id === id)} stream={remoteStreams[id]}
                      isVideo={isVideo} cameraOff={remoteCameraOff[id]} onClick={() => setSpotlightId(id)} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Local video PiP — solo en videollamada */}
        {isVideo && (
          <div
            onClick={() => setLocalExpanded(e => !e)}
            style={{
              position: 'absolute', bottom: 76, right: 14,
              width: pipW, height: pipH, borderRadius: 10, overflow: 'hidden',
              border: `2px solid ${localExpanded ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)'}`,
              background: '#111', cursor: 'pointer',
              boxShadow: localExpanded ? '0 8px 32px rgba(0,0,0,0.8)' : '0 4px 16px rgba(0,0,0,0.6)',
              transition: 'width .25s ease, height .25s ease, box-shadow .2s',
              zIndex: 5,
            }}
          >
            {isCameraOff ? (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1b28' }}>
                <IconCameraOff size={26} color="rgba(255,255,255,0.25)" />
              </div>
            ) : (
              <video ref={localVideoRef} autoPlay playsInline muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            )}
          </div>
        )}

        {/* Controls */}
        <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button onClick={onToggleMute} style={ctrlBtn(isMuted, false)} title={isMuted ? 'Activar micrófono' : 'Silenciar'}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {isMuted ? <IconMicOff size={19} color="white" /> : <IconMic size={19} color="white" />}
          </button>
          <button onClick={onEnd} style={ctrlBtn(false, true)} title="Salir de la llamada"
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <IconPhoneEnd size={22} color="white" />
          </button>
          {isVideo && (
            <button onClick={onToggleCamera} style={ctrlBtn(isCameraOff, false)} title={isCameraOff ? 'Activar cámara' : 'Apagar cámara'}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {isCameraOff ? <IconCameraOff size={19} color="white" /> : <IconCamera size={19} color="white" />}
            </button>
          )}
          <button onClick={onToggleChat} style={ctrlBtn(showChat, false)} title="Chat"
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <IconChat size={18} color="white" />
          </button>
        </div>
      </div>

      {/* ── Chat panel ───────────────────────────────────────────────────── */}
      {showChat && chatProps && (
        <div style={{
          position: isMobile ? 'absolute' : 'static',
          inset: isMobile ? 0 : undefined,
          zIndex: isMobile ? 20 : undefined,
          width: isMobile ? '100%' : 300,
          background: '#111827',
          borderLeft: isMobile ? 'none' : '1px solid rgba(255,255,255,0.08)',
          display: 'flex', flexDirection: 'column', flexShrink: 0,
        }}>
          <div style={{ padding: '10px 8px 10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {isMobile && (
              <button onClick={onToggleChat} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: '6px 8px 6px 0' }}>‹</button>
            )}
            <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}># club-general</span>
          </div>
          <div ref={chatScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {chatProps.messages.map((m, i) => {
              const prev    = chatProps.messages[i - 1]
              const compact = prev?.player_id === m.player_id &&
                (new Date(m.created_at) - new Date(prev.created_at)) < 5 * 60 * 1000
              const isOwn = m.player_id === chatProps.player.id
              return <MessageRow key={m.id} msg={m} compact={compact} isOwn={isOwn} small />
            })}
          </div>
          <form onSubmit={chatProps.onSend} style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <input
              value={chatProps.input}
              onChange={chatProps.onInput}
              placeholder="Mensaje…"
              style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: 'white', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
            />
          </form>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Diskordkito({ player, wsRef, online = [], call, groupCall, onActiveChannelChange }) {
  // Estado de la llamada: vive en GatOS (siempre montado, para que la
  // notificación y la señalización funcionen aunque esta app esté cerrada).
  const {
    state: callState, peer: callPeer, type: callType,
    localStream, remoteStream, isMuted, isCameraOff, remoteCameraOff,
    start: startCall, accept: acceptCall, reject: rejectCall, end: endCall,
    toggleMute, toggleCamera,
    chatOpen: showChat, toggleChat,
  } = call

  const isMobile = useIsMobile()
  // En móvil se navega entre la lista de canales y el chat (patrón
  // WhatsApp/Telegram) en vez de verlos lado a lado como en desktop.
  // navDirection anima la transición: 1 = entrar al chat (desliza desde la
  // derecha), -1 = volver a la lista (desliza desde la izquierda).
  const [mobileView, setMobileView] = useState('channels') // 'channels' | 'chat'
  const [navDirection, setNavDirection] = useState(1)
  // Escritorio: ocultar el sidebar de canales/DMs para dejar más sitio a la
  // llamada (o al chat) — solo aplica al layout lado a lado, no a la
  // navegación de pestañas de móvil.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Chat state
  const [allPlayers, setAllPlayers] = useState([])
  const [channels,   setChannels]   = useState([])
  const [messages,   setMessages]   = useState({})
  const [activeChId, setActiveChId] = useState(null)
  const [input,      setInput]      = useState('')
  // Aviso breve cuando abrir un DM falla (p.ej. la otra persona ha dejado de
  // ser miembro del club) — antes fallaba en silencio, sin ninguna pista.
  const [dmError, setDmError] = useState(null)
  const scrollAreaRef = useRef(null)

  function goToChat() {
    setNavDirection(1)
    setMobileView('chat')
  }
  // Se refresca la lista de jugadores cada vez que se vuelve a la lista de
  // canales/DMs — si el admin le quita a alguien el acceso al club mientras
  // esta ventana ya estaba abierta, "allPlayers" (cargado solo una vez al
  // montar) se quedaba con esa persona todavía visible y pulsable, y el
  // intento de abrir el DM fallaba en silencio (403 del backend, sin ningún
  // aviso). Así se corrige solo, sin esperar a que se recargue la página.
  function goToChannels() {
    setNavDirection(-1)
    setMobileView('channels')
    refreshPlayers()
  }
  function refreshPlayers() {
    fetch('/api/players', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(players => { if (players) setAllPlayers(players) })
      .catch(() => {})
  }

  function selectChannel(chId) {
    setActiveChId(chId)
    loadMessages(chId)
    if (isMobile) goToChat()
  }

  const callChannelIdRef = useRef(null)
  // Canal DM anclado a la llamada — independiente del canal que esté abierto en el sidebar,
  // para que el chat de la llamada nunca hable con el interlocutor equivocado.
  const [callChannelId, setCallChannelId] = useState(null)

  // Ancla el canal DM de la llamada en curso al interlocutor de la llamada
  // (no al canal activo del sidebar), y funciona igual para llamada entrante
  // o saliente, incluso si esta app se abre después de que la llamada ya sonara.
  useEffect(() => {
    if (!callPeer) {
      callChannelIdRef.current = null
      setCallChannelId(null)
      return
    }
    let cancelled = false
    openDM(callPeer).then(id => {
      if (!cancelled) { callChannelIdRef.current = id; setCallChannelId(id) }
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callPeer?.id])

  // Informa a GatOS de qué canal (y, si es un DM, con qué jugador) está
  // desplegado ahora mismo — para decidir si mostrar la notificación de un
  // mensaje nuevo, o la de una llamada entrante de esa misma persona.
  // "visibleChannelId" es el canal cuyos mensajes se ven de verdad ahora
  // mismo: en llamada activa la vista normal queda tapada por CallView, así
  // que solo cuenta si el panel de chat de la llamada está desplegado.
  useEffect(() => {
    const ch = channels.find(c => c.id === activeChId)
    const peerId = ch?.type === 'dm' ? ch.other_player?.id ?? null : null
    const visibleChannelId =
      callState === 'active' ? (showChat ? callChannelId : null) :
      callState === 'idle'   ? activeChId :
      null // 'calling' / 'incoming': el overlay tapa toda la vista de mensajes
    onActiveChannelChange?.({ id: activeChId, peerId, visibleChannelId })
  }, [activeChId, channels, callState, showChat, callChannelId])
  useEffect(() => () => onActiveChannelChange?.(null), [])

  // ── Chat init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const [pRes, chRes] = await Promise.all([
        fetch('/api/players',  { credentials: 'include' }),
        fetch('/api/channels', { credentials: 'include' }),
      ])
      const players = pRes.ok  ? await pRes.json() : []
      const chs     = chRes.ok ? await chRes.json() : []
      setAllPlayers(players)
      setChannels(chs)
      const general = chs.find(c => c.name === 'club-general')
      if (general) { setActiveChId(general.id); loadMessages(general.id) }
    }
    init()
  }, [])

  // ── WS listener ───────────────────────────────────────────────────────────
  useEffect(() => {
    function onWs(e) {
      const msg = e.detail
      if (msg.type === 'message') {
        setMessages(prev => {
          const ch = prev[msg.channel_id] ?? []
          if (ch.some(m => m.id === msg.id)) return prev
          return { ...prev, [msg.channel_id]: [...ch, msg] }
        })
        setChannels(prev => {
          if (!prev.some(c => c.id === msg.channel_id)) {
            // Primer mensaje de un DM que aún no conocíamos (recién creado
            // por la otra persona) — recarga la lista para tenerlo con datos completos.
            fetch('/api/channels', { credentials: 'include' }).then(r => r.json()).then(setChannels)
            return prev
          }
          return prev.map(c => c.id === msg.channel_id ? { ...c, last_message_at: msg.created_at } : c)
        })
        // Nunca queda "sin leer" lo que acabas de escribir tú, ni lo que
        // llega mientras tienes esa conversación desplegada de verdad.
        const isMine    = msg.player_id === player.id
        const isVisible = msg.channel_id === readVisibleChannelIdRef.current
        if (isMine || isVisible) markChannelRead(msg.channel_id, msg.created_at)
      } else if (msg.type === 'player_joined') {
        setAllPlayers(prev => prev.some(p => p.id === msg.player.id) ? prev : [...prev, msg.player])
        fetch('/api/channels', { credentials: 'include' }).then(r => r.json()).then(setChannels)
      }
    }
    window.addEventListener('luni:ws', onWs)
    return () => window.removeEventListener('luni:ws', onWs)
  }, [])

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollAreaRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, activeChId])

  // ── Chat functions ────────────────────────────────────────────────────────
  async function loadMessages(channelId) {
    const r = await fetch(`/api/channels/${channelId}/messages`, { credentials: 'include' })
    if (r.ok) { const msgs = await r.json(); setMessages(prev => ({ ...prev, [channelId]: msgs })) }
  }

  async function openDM(otherPlayer) {
    const r = await fetch(`/api/channels/dm/${otherPlayer.id}`, { method: 'POST', credentials: 'include' })
    if (!r.ok) return null
    const { id } = await r.json()
    setChannels(prev => prev.find(c => c.id === id) ? prev : [
      ...prev, { id, name: `dm_${otherPlayer.id}`, type: 'dm', other_player: otherPlayer }
    ])
    setActiveChId(id)
    loadMessages(id)
    return id
  }

  function sendMessage(e) {
    e.preventDefault()
    const content = input.trim()
    if (!content || !activeChId || wsRef?.current?.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'message', channel_id: activeChId, content }))
    setInput('')
  }

  // Envía siempre al canal anclado de la llamada activa, nunca al canal que
  // esté abierto en el sidebar en ese momento (pueden ser distintos).
  function sendCallMessage(e) {
    e.preventDefault()
    const content = input.trim()
    const chId = callChannelIdRef.current
    if (!content || !chId || wsRef?.current?.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'message', channel_id: chId, content }))
    setInput('')
  }

  // La llamada grupal está siempre anclada al canal #club-general en sí (no
  // depende de qué canal tenga abierto el jugador en el sidebar).
  function sendGroupCallMessage(e) {
    e.preventDefault()
    const content = input.trim()
    if (!content || !generalChannelId || wsRef?.current?.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'message', channel_id: generalChannelId, content }))
    setInput('')
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeMsgs    = messages[activeChId] ?? []
  const activeChannel = channels.find(c => c.id === activeChId)
  const groupChannels = channels.filter(c => c.type === 'group')
  const dmChannels    = channels.filter(c => c.type === 'dm')
  // Quien no es miembro del club queda invisible aquí — ni como candidato de
  // DM ni, más abajo, en presencia/miembros de #club-general.
  const otherPlayers  = allPlayers.filter(p => p.id !== player.id && p.club_member)
  const generalChannelId = channels.find(c => c.name === 'club-general')?.id ?? null
  const isGeneralActive  = activeChannel?.name === 'club-general'
  const groupCallOthers  = groupCall.participantIds.filter(id => id !== player.id)

  // ── No leídos ─────────────────────────────────────────────────────────────
  // "last_message_at"/"last_read_at" viven en el canal (vienen de GET
  // /channels y se actualizan localmente al llegar mensajes o marcar leído).
  function isUnread(ch) {
    if (!ch?.last_message_at) return false
    if (!ch.last_read_at) return true
    return new Date(ch.last_message_at) > new Date(ch.last_read_at)
  }

  function markChannelRead(channelId, atIso) {
    const readAt = atIso ?? new Date().toISOString()
    setChannels(prev => prev.map(c => {
      if (c.id !== channelId) return c
      if (c.last_read_at && new Date(c.last_read_at) >= new Date(readAt)) return c
      return { ...c, last_read_at: readAt }
    }))
    if (wsRef?.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'mark_read', channel_id: channelId }))
    }
  }

  // Canal cuyos mensajes se están viendo de verdad ahora mismo (para marcarlo
  // leído) — mismo criterio que "visibleChannelId" de arriba, pero también
  // cuenta el chat de la llamada grupal cuando está desplegado.
  const readVisibleChannelId = groupCall.joined
    ? (groupCall.chatOpen ? generalChannelId : null)
    : callState === 'active' ? (showChat ? callChannelId : null)
    : callState === 'idle'   ? activeChId
    : null

  const readVisibleChannelIdRef = useRef(null)
  useEffect(() => { readVisibleChannelIdRef.current = readVisibleChannelId })

  useEffect(() => {
    if (readVisibleChannelId) markChannelRead(readVisibleChannelId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readVisibleChannelId])

  const isDM   = activeChannel?.type === 'dm'
  const dmPeer = isDM ? activeChannel.other_player : null

  function channelLabel(ch) {
    return ch.type === 'group' ? `# ${ch.name}` : (ch.other_player?.name ?? ch.name)
  }
  function isOnline(id) { return online.includes(id) }

  const headerBtn = { flexShrink: 0, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.65)', transition: 'background .1s, color .1s' }

  // Overlays de llamada — en desktop se anidan dentro del panel de mensajes
  // (igual que siempre); en móvil se pintan al nivel raíz para que se vean
  // aunque el jugador esté mirando la lista de canales, no el chat.
  const callOverlays = (
    <>
      <AnimatePresence>
        {callState === 'incoming' && callPeer && (
          <IncomingCallModal key="incoming-call" peer={callPeer} callType={callType} onAccept={acceptCall} onReject={rejectCall} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {callState === 'calling' && callPeer && (
          <CallingOverlay key="calling-call" peer={callPeer} callType={callType} onCancel={endCall} />
        )}
      </AnimatePresence>
      {callState === 'active' && callPeer && (
        <CallView
          peer={callPeer}
          callType={callType}
          localStream={localStream}
          remoteStream={remoteStream}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          remoteCameraOff={remoteCameraOff}
          onEnd={endCall}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          showChat={showChat}
          onToggleChat={toggleChat}
          chatProps={{ messages: messages[callChannelId] ?? [], input, onInput: e => setInput(e.target.value), onSend: sendCallMessage, player }}
        />
      )}
    </>
  )

  // Llamada grupal — siempre visible mientras estemos dentro, sea cual sea el
  // canal seleccionado en el sidebar (igual que los overlays del 1-to-1).
  const groupCallOverlays = groupCall.joined && (
    <GroupCallView
      myId={player.id}
      participantIds={groupCall.participantIds}
      allPlayers={allPlayers}
      callType={groupCall.callType}
      localStream={groupCall.localStream}
      remoteStreams={groupCall.remoteStreams}
      isMuted={groupCall.isMuted}
      isCameraOff={groupCall.isCameraOff}
      remoteCameraOff={groupCall.remoteCameraOff}
      onEnd={groupCall.leave}
      onToggleMute={groupCall.toggleMute}
      onToggleCamera={groupCall.toggleCamera}
      showChat={groupCall.chatOpen}
      onToggleChat={groupCall.toggleChat}
      chatProps={{ messages: messages[generalChannelId] ?? [], input, onInput: e => setInput(e.target.value), onSend: sendGroupCallMessage, player }}
      sidebarCollapsed={sidebarCollapsed}
      onToggleSidebar={() => setSidebarCollapsed(v => !v)}
    />
  )

  // ── Paneles (se reutilizan tal cual en desktop y en la animación móvil) ────
  const sidebarPanel = (
      <div style={{ width: isMobile ? '100%' : 220, background: '#1e1f2e', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto', paddingTop: 8 }}>
          <SectionHeader label="CANALES" />
          {groupChannels.map(ch => (
            <SidebarItem key={ch.id} label={channelLabel(ch)} icon="📢"
              active={activeChId === ch.id}
              onClick={() => selectChannel(ch.id)}
              liveCall={ch.name === 'club-general' && groupCall.participantIds.length > 0}
              unread={isUnread(ch)} />
          ))}

          <SectionHeader label="MENSAJES DIRECTOS" />
          {dmError && (
            <p style={{ margin: '2px 16px 6px', fontSize: 11, color: '#ed4245' }}>{dmError}</p>
          )}
          {otherPlayers.map(p => {
            const dm = dmChannels.find(c => c.other_player?.id === p.id)
            return (
              <SidebarItem key={p.id} label={p.name} icon={<PlayerAvatar emoji={p.avatar_emoji} url={p.avatar_url} size={16} />}
                color={p.color}
                status={isOnline(p.id) ? 'online' : 'offline'}
                active={dm && activeChId === dm.id}
                onClick={async () => {
                  // openDM es async (hace la petición al backend) — hay que
                  // esperar a que resuelva antes de navegar al chat en móvil,
                  // si no, goToChat() cambia de pantalla mientras activeChId
                  // todavía no se ha actualizado y el chat sale en blanco.
                  setDmError(null)
                  const id = await openDM(p)
                  if (id) {
                    if (isMobile) goToChat()
                  } else {
                    // Nunca en silencio — y se refresca la lista, por si el
                    // fallo es porque a esta persona le han quitado el acceso
                    // al club mientras la ventana ya estaba abierta.
                    setDmError(`No se pudo abrir la conversación con ${p.name}.`)
                    refreshPlayers()
                  }
                }}
                unread={isUnread(dm)} />
            )
          })}
        </div>

        <div style={{ padding: '10px 12px', background: '#16171f', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ position: 'relative' }}>
            <PlayerAvatar emoji={player.avatar_emoji} url={player.avatar_url} size={20} />
            <span style={{ position: 'absolute', bottom: -1, right: -2, width: 8, height: 8, borderRadius: '50%', background: '#23a55a', border: '2px solid #16171f' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, color: player.color, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>En línea</p>
          </div>
        </div>
      </div>
  )

  const messageAreaPanel = (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#111827', minWidth: 0, position: 'relative' }}>

        {/* Header */}
        <div style={{ padding: '0 14px', height: 48, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {isMobile && (
            <button onClick={goToChannels} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: '6px 8px 6px 0', flexShrink: 0 }}>‹</button>
          )}
          {!isMobile && (
            <button onClick={() => setSidebarCollapsed(v => !v)} title={sidebarCollapsed ? 'Mostrar canales' : 'Ocultar canales'} style={headerBtn}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = 'white' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)' }}
            >
              <IconSidebar size={15} color="currentColor" />
            </button>
          )}
          {activeChannel ? (
            <>
              <span style={{ fontSize: 16, flexShrink: 0 }}>
                {activeChannel.type === 'group'
                  ? '📢'
                  : activeChannel.other_player
                  ? <PlayerAvatar emoji={activeChannel.other_player.avatar_emoji} url={activeChannel.other_player.avatar_url} size={16} />
                  : '💬'}
              </span>
              <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontSize: 15, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {channelLabel(activeChannel)}
              </span>
              {isDM && dmPeer && (
                <span style={{ fontSize: 11, color: isOnline(dmPeer.id) ? '#23a55a' : 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                  ● {isOnline(dmPeer.id) ? 'En línea' : 'Desconectado'}
                </span>
              )}
              {/* Call buttons — audio + video, only in DMs when idle */}
              {isDM && dmPeer && callState === 'idle' && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 4 }}>
                  <button onClick={() => startCall(dmPeer, 'audio')} title="Llamada de voz" style={headerBtn}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = 'white' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)' }}
                  >
                    <IconPhone size={15} color="currentColor" />
                  </button>
                  <button onClick={() => startCall(dmPeer, 'video')} title="Videollamada" style={headerBtn}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = 'white' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)' }}
                  >
                    <IconCamera size={15} color="currentColor" />
                  </button>
                </div>
              )}
              {callState === 'active' && (
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, background: '#23a55a1a', border: '1px solid #23a55a33', borderRadius: 8, padding: '3px 10px' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#23a55a' }} />
                  <span style={{ fontSize: 11, color: '#23a55a', fontWeight: 600 }}>En llamada</span>
                </div>
              )}

              {/* Llamada grupal — solo en #club-general */}
              {isGeneralActive && !groupCall.joined && groupCallOthers.length === 0 && (
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 4 }}>
                  <button onClick={() => groupCall.join('audio')} title="Llamada de voz" style={headerBtn}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = 'white' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)' }}
                  >
                    <IconPhone size={15} color="currentColor" />
                  </button>
                  <button onClick={() => groupCall.join('video')} title="Videollamada" style={headerBtn}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = 'white' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)' }}
                  >
                    <IconCamera size={15} color="currentColor" />
                  </button>
                </div>
              )}
              {isGeneralActive && !groupCall.joined && groupCallOthers.length > 0 && (
                <button onClick={() => groupCall.join(groupCall.callType)} style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, background: '#23a55a', border: 'none',
                  borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: 'white', fontSize: 12, fontWeight: 600,
                }}
                  onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                  onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />
                  Unirse ({groupCallOthers.length})
                </button>
              )}
              {isGeneralActive && groupCall.joined && (
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, background: '#23a55a1a', border: '1px solid #23a55a33', borderRadius: 8, padding: '3px 10px' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#23a55a' }} />
                  <span style={{ fontSize: 11, color: '#23a55a', fontWeight: 600 }}>En llamada</span>
                </div>
              )}
            </>
          ) : (
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Selecciona un canal</span>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollAreaRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {activeMsgs.length === 0 && activeChId && (
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
              Sé el primero en escribir ✨
            </p>
          )}
          {activeMsgs.map((m, i) => {
            const prev    = activeMsgs[i - 1]
            const compact = prev?.player_id === m.player_id &&
              (new Date(m.created_at) - new Date(prev.created_at)) < 5 * 60 * 1000
            const isOwn = m.player_id === player.id
            return <MessageRow key={m.id} msg={m} compact={compact} isOwn={isOwn} />
          })}
        </div>

        {/* Input */}
        {activeChId && callState !== 'active' && (
          <form onSubmit={sendMessage} style={{ padding: '0 16px 16px', flexShrink: 0 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={activeChannel ? `Mensaje en ${channelLabel(activeChannel)}…` : ''}
              style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </form>
        )}

        {/* ── Call overlays (desktop) ───────────────────────────────────── */}
        {!isMobile && callOverlays}
        {!isMobile && groupCallOverlays}
      </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'system-ui, sans-serif', position: 'relative' }}>

      {isMobile ? (
        <AnimatePresence initial={false} custom={navDirection}>
          <motion.div
            key={mobileView}
            custom={navDirection}
            variants={mobileNavVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'tween', duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{ position: 'absolute', inset: 0, display: 'flex' }}
          >
            {mobileView === 'channels' ? sidebarPanel : messageAreaPanel}
          </motion.div>
        </AnimatePresence>
      ) : (
        <>
          <AnimatePresence initial={false}>
            {!sidebarCollapsed && (
              <motion.div
                key="sidebar"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 220, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'tween', duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                style={{ overflow: 'hidden', flexShrink: 0, display: 'flex' }}
              >
                {sidebarPanel}
              </motion.div>
            )}
          </AnimatePresence>
          {messageAreaPanel}
        </>
      )}

      {/* En móvil, los overlays de llamada van al nivel raíz — se ven aunque
          mobileView sea 'channels' (una llamada puede entrar en cualquier momento). */}
      {isMobile && callOverlays}
      {isMobile && groupCallOverlays}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionHeader({ label }) {
  return (
    <p style={{ padding: '12px 16px 4px', fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: 1 }}>
      {label}
    </p>
  )
}

function SidebarItem({ label, icon, active, onClick, color, status, liveCall, unread }) {
  const [hover, setHover] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ width: '100%', background: active ? 'rgba(255,255,255,0.08)' : hover ? 'rgba(255,255,255,0.04)' : 'transparent', border: 'none', cursor: 'pointer', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', transition: 'background .1s' }}>
      <span style={{ fontSize: 15, position: 'relative', flexShrink: 0 }}>
        {icon}
        {status && (
          <span style={{ position: 'absolute', bottom: -1, right: -2, width: 8, height: 8, borderRadius: '50%', background: status === 'online' ? '#23a55a' : '#80848e', border: '2px solid #1e1f2e' }} />
        )}
      </span>
      <span style={{
        fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        color: unread ? 'white' : active ? (color ?? 'rgba(255,255,255,0.9)') : 'rgba(255,255,255,0.45)',
        fontWeight: unread ? 700 : active ? 600 : 400,
      }}>
        {label}
      </span>
      {(liveCall || unread) && (
        <span style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
          {unread && <span title="Mensaje sin leer" style={{ width: 8, height: 8, borderRadius: '50%', background: '#5865f2' }} />}
          {liveCall && <span title="Llamada activa" style={{ width: 7, height: 7, borderRadius: '50%', background: '#23a55a', boxShadow: '0 0 0 3px #23a55a2a' }} />}
        </span>
      )}
    </button>
  )
}

function MessageRow({ msg, compact, isOwn, small }) {
  const time = new Date(msg.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  const fs = small ? 11 : 13

  if (compact) {
    return (
      <div style={{ paddingLeft: small ? 32 : 46, paddingTop: 2, paddingBottom: 2, paddingRight: 8, borderRadius: 6 }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <p style={{ color: isOwn ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.9)', fontSize: fs, lineHeight: 1.5 }}>
          {msg.content}
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: small ? 6 : 10, alignItems: 'flex-start', paddingTop: small ? 6 : 10, paddingBottom: 2, paddingRight: 8, borderRadius: 6, borderLeft: '2px solid transparent' }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
        if (!isOwn) e.currentTarget.style.borderLeftColor = msg.player_color + '66'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderLeftColor = 'transparent'
      }}
    >
      <PlayerAvatar emoji={msg.player_emoji} url={msg.player_avatar_url} size={small ? 16 : 22} style={{ marginTop: 1 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
          <span style={{ fontWeight: 700, color: msg.player_color, fontSize: fs }}>{msg.player_name}</span>
          <span style={{ fontSize: small ? 9 : 10, color: 'rgba(255,255,255,0.2)' }}>{time}</span>
        </div>
        <p style={{ color: isOwn ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.92)', fontSize: fs, lineHeight: 1.5 }}>
          {msg.content}
        </p>
      </div>
    </div>
  )
}
