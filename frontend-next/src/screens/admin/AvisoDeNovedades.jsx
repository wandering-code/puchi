import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../../platform/api'
import { useAuth } from '../../platform/auth'
import { IconCampana } from '../../ui/icons'
import TextoNovedad from './TextoNovedad'

// Los avisos de novedades que escribe el admin (#72): le salen a cada uno
// hasta que le da a "Entendido", uno detrás de otro si hay varios. No se
// cierran tocando fuera ni con el gesto de volver: la gracia es que se lean.
//
// Se miran al entrar, al volver a la app y cuando el servidor avisa de uno
// nuevo (por el WebSocket, si la app está abierta en ese momento).

export default function AvisoDeNovedades() {
  const { player } = useAuth()
  const [lista, setLista] = useState([])
  const [vistos, setVistos] = useState(0) // cuántos se han aceptado en esta tanda, para el "2 de 3"

  const cargar = useCallback(() => {
    api('/announcements/pending')
      .then(l => setLista(l))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!player?.id) return
    cargar()
    const alVolver = () => { if (document.visibilityState === 'visible') cargar() }
    const alRecibir = (ev) => { if (ev.detail?.type === 'novedad') cargar() }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('puchi:ws', alRecibir)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('puchi:ws', alRecibir)
    }
  }, [player?.id, cargar])

  const actual = lista[0]
  useEffect(() => { if (!lista.length) setVistos(0) }, [lista.length])

  function aceptar() {
    if (!actual) return
    // Se quita ya; si el servidor no se entera, volverá a salir la próxima vez.
    setLista(l => l.slice(1))
    setVistos(n => n + 1)
    api(`/announcements/${actual.id}/accept`, { method: 'POST' }).catch(() => {})
  }

  const total = lista.length + vistos

  return createPortal(
    <AnimatePresence>
      {actual && (
        <motion.div
          key="novedades"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-velo px-5 backdrop-blur-[6px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          role="dialog"
          aria-modal="true"
          aria-label="Novedades"
        >
          <AnimatePresence mode="wait" initial>
            <motion.div
              key={actual.id}
              className="w-full max-w-sm overflow-hidden rounded-xl3 border border-line bg-surface shadow-xl"
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="bg-[color-mix(in_srgb,var(--color-accent)_11%,var(--color-surface))] px-6 pb-4 pt-5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                    <IconCampana className="h-3.5 w-3.5" />
                    Novedades
                  </span>
                  {total > 1 && (
                    <span className="text-[11px] tabular-nums text-ink-mute">{vistos + 1} de {total}</span>
                  )}
                </div>
                <h2 className="mt-2 font-display text-[1.35rem] font-bold leading-tight tracking-[-0.01em]">{actual.title}</h2>
              </div>
              {actual.body && (
                <div className="max-h-[50vh] overflow-y-auto px-6 pt-4 text-[15px] leading-relaxed text-ink-dim">
                  <TextoNovedad texto={actual.body} />
                </div>
              )}
              <div className="px-6 pb-6 pt-5">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={aceptar}
                  className="h-12 w-full rounded-xl2 bg-accent text-[15px] font-semibold text-on-accent shadow-sm"
                >
                  {lista.length > 1 ? 'Entendido, siguiente' : 'Entendido'}
                </motion.button>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
