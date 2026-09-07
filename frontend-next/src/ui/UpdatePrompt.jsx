import { AnimatePresence, motion } from 'motion/react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { IconRefresh } from './icons'

// Sustituye al parche de version.json de la Puchi actual: aquí es el propio
// service worker quien detecta que hay un build nuevo en el servidor, que es
// justo lo que iOS se saltaba cacheando el arranque de la app instalada.
// registerType 'prompt' (vite.config.js): no se actualiza a la brava en medio
// de lo que estés haciendo, se avisa y decides tú.
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center pt-safe"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        >
          <div className="pointer-events-auto m-3 flex items-center gap-3 rounded-xl2 border border-line bg-surface-2/95 px-4 py-3 shadow-lg backdrop-blur">
            <IconRefresh className="h-5 w-5 shrink-0 text-accent" />
            <span className="text-sm text-ink">Hay una versión nueva</span>
            <button
              onClick={() => updateServiceWorker(true)}
              className="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent active:scale-95 transition-transform"
            >
              Recargar
            </button>
            <button
              onClick={() => setNeedRefresh(false)}
              className="text-sm text-ink-mute px-1"
              aria-label="Ahora no"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
