import { useEffect } from 'react'
import { motion } from 'framer-motion'
import PlayerAvatar from './PlayerAvatar'

const DURATION = 4000

export default function Notification({ msg, onClose, onOpenDiskordkito }) {
  useEffect(() => {
    const t = setTimeout(onClose, DURATION)
    return () => clearTimeout(t)
  }, [msg])

  return (
    <motion.div
      key={msg.id}
      initial={{ x: 360, opacity: 0, scale: 0.95 }}
      animate={{ x: 0,   opacity: 1, scale: 1    }}
      exit={{    x: 360, opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', damping: 22, stiffness: 320 }}
      onClick={() => { onOpenDiskordkito(); onClose() }}
      style={{
        position:     'absolute',
        top:          60,
        right:        16,
        zIndex:       99998,
        width:        320,
        background:   'rgba(18, 18, 28, 0.94)',
        backdropFilter: 'blur(24px)',
        border:       '1px solid rgba(255,255,255,0.10)',
        borderRadius: 14,
        padding:      '14px 16px 18px',
        cursor:       'pointer',
        boxShadow:    '0 8px 40px rgba(0,0,0,0.55)',
        overflow:     'hidden',
        userSelect:   'none',
      }}
    >
      {/* Cabecera: app */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:20, height:20, borderRadius:6, background:'#5865f2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>🐱</div>
          <span style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.4)' }}>Diskordkito</span>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onClose() }}
          style={{ background:'none', border:'none', color:'rgba(255,255,255,0.25)', cursor:'pointer', fontSize:14, lineHeight:1, padding:0 }}
        >×</button>
      </div>

      {/* Remitente */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
        <PlayerAvatar emoji={msg.player_emoji} url={msg.player_avatar_url} size={22} />
        <span style={{ fontSize:13, fontWeight:700, color:msg.player_color }}>{msg.player_name}</span>
      </div>

      {/* Mensaje */}
      <p style={{ fontSize:13, color:'rgba(255,255,255,0.7)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {msg.content}
      </p>

      {/* Barra de progreso */}
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: DURATION / 1000, ease: 'linear' }}
        style={{
          position:'absolute', bottom:0, left:0, right:0, height:3,
          background:'#5865f2', transformOrigin:'left',
          borderRadius:'0 0 14px 14px',
        }}
      />
    </motion.div>
  )
}
