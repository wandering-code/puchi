import { motion } from 'framer-motion'
import PlayerAvatar from './PlayerAvatar'

// Aviso de "tienes una llamada activa en otro de tus dispositivos" — no es
// una llamada entrante (no suena, no tiene cuenta atrás), solo un aviso
// persistente con la opción de traérsela aquí. Aparece al conectar si ya
// había una llamada en marcha en otro sitio, y también justo después de
// mover una llamada A OTRO dispositivo (para poder traérsela de vuelta).
export default function CallElsewhereNotification({ peer, callType, onMoveHere, onDismiss }) {
  return (
    <motion.div
      initial={{ x: 360, opacity: 0, scale: 0.95 }}
      animate={{ x: 0,   opacity: 1, scale: 1    }}
      exit={{    x: 360, opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', damping: 22, stiffness: 320 }}
      style={{
        position:     'absolute',
        top:          60,
        right:        16,
        zIndex:       99998,
        width:        300,
        background:   'rgba(18, 18, 28, 0.94)',
        backdropFilter: 'blur(24px)',
        border:       '1px solid rgba(255,255,255,0.10)',
        borderRadius: 14,
        padding:      '14px 16px 16px',
        boxShadow:    '0 8px 40px rgba(0,0,0,0.55)',
        userSelect:   'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <div style={{ width: 20, height: 20, borderRadius: 6, background: '#5865f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🐱</div>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>
          Llamada activa en otro dispositivo
        </span>
        <button onClick={onDismiss} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}>×</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <PlayerAvatar emoji={peer.avatar_emoji} url={peer.avatar_url} size={28} />
        <div>
          <span style={{ fontSize: 15, fontWeight: 700, color: peer.color ?? 'white', display: 'block' }}>{peer.name}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{callType === 'video' ? 'Videollamada' : 'Llamada de voz'}</span>
        </div>
      </div>

      <button
        onClick={onMoveHere}
        style={{
          width: '100%', height: 38, borderRadius: 10, background: '#5865f2', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 13, fontWeight: 600, transition: 'filter .1s',
        }}
        onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
        onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
      >
        Mover aquí
      </button>
    </motion.div>
  )
}
