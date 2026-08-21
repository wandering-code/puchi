import { AnimatePresence, motion } from 'framer-motion'

function IconRefresh({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13.5 2.5v3.2h-3.2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function UpdateBanner({ show }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          onClick={() => window.location.reload()}
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', border: 'none', cursor: 'pointer',
            background: '#5865f2', color: 'white',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            padding: '10px 16px',
            paddingTop: 'calc(env(safe-area-inset-top) + 10px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
          }}
        >
          <IconRefresh size={14} color="white" />
          Hay una versión nueva de Puchi — toca para recargar
        </motion.button>
      )}
    </AnimatePresence>
  )
}
