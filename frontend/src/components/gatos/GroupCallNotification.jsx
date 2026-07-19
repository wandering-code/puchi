import { useEffect } from 'react'
import { motion } from 'framer-motion'
import PlayerAvatar from './PlayerAvatar'

const RING_DURATION = 30000 // ms antes de dejar de sonar (la llamada sigue existiendo, se puede entrar después)

export default function GroupCallNotification({ fromPlayer, callType, onJoin, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, RING_DURATION)
    return () => clearTimeout(t)
  }, [fromPlayer?.id])

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
        zIndex:       99999,
        width:        300,
        background:   'rgba(18, 18, 28, 0.94)',
        backdropFilter: 'blur(24px)',
        border:       '1px solid rgba(255,255,255,0.10)',
        borderRadius: 14,
        padding:      '14px 16px 18px',
        boxShadow:    '0 8px 40px rgba(0,0,0,0.55)',
        overflow:     'hidden',
        userSelect:   'none',
      }}
    >
      {/* Cabecera: app + canal */}
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
        <div style={{ width:20, height:20, borderRadius:6, background:'#5865f2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>📢</div>
        <span style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.4)' }}>
          {callType === 'video' ? 'Videollamada' : 'Llamada de voz'} en #club-general
        </span>
      </div>

      {/* Quién la ha iniciado */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <PlayerAvatar emoji={fromPlayer.avatar_emoji} url={fromPlayer.avatar_url} size={28} />
        <span style={{ fontSize:14, color:'rgba(255,255,255,0.8)' }}>
          <span style={{ fontWeight:700, color: fromPlayer.color ?? 'white' }}>{fromPlayer.name}</span> ha iniciado una llamada
        </span>
      </div>

      {/* Acciones */}
      <div style={{ display:'flex', gap:10 }}>
        <button
          onClick={onDismiss}
          style={{
            flex: 1, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, transition: 'filter .1s',
          }}
          onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.2)'}
          onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
        >
          Ignorar
        </button>
        <button
          onClick={onJoin}
          style={{
            flex: 1, height: 38, borderRadius: 10, background: '#23a55a', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 13, fontWeight: 600, transition: 'filter .1s',
          }}
          onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
          onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
        >
          Unirse
        </button>
      </div>

      {/* Barra de progreso: tiempo restante antes de dejar de sonar */}
      <motion.div
        key={fromPlayer.id}
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: RING_DURATION / 1000, ease: 'linear' }}
        style={{
          position:'absolute', bottom:0, left:0, right:0, height:3,
          background:'#5865f2', transformOrigin:'left',
          borderRadius:'0 0 14px 14px',
        }}
      />
    </motion.div>
  )
}
