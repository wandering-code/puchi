import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react'
import { useReproductor } from '../../../platform/reproductor'
import { Cover } from '../../luniteca/piezas'
import { IconPausa, IconPlay, IconX } from '../../../ui/icons'
import { Girando } from '../audiolibros/Audiolibros'

// El reproductor pequeño de abajo (fase 4, #66 de puchi): está en cualquier
// pantalla mientras haya algo puesto, también en pausa, hasta que se quita
// (la ✕ o deslizándolo hacia abajo). Tocarlo abre el reproductor entero.
//
// Ocupa sitio de verdad: pone --mini con su alto, y pb-kb / pb-escritura
// (index.css) lo suman, para que no tape el final de ninguna pantalla ni el
// campo de escribir del chat.

const ALTO = 76 // la tarjeta (64) y su margen

export default function MiniReproductor() {
  const r = useReproductor()
  const teclado = useTecladoAbierto()
  const hay = !!(r?.libro && r?.cap)
  const visible = hay && !r.pantalla.abierta && !teclado

  useEffect(() => {
    document.documentElement.style.setProperty('--mini', hay && !teclado ? `${ALTO}px` : '0px')
    return () => document.documentElement.style.setProperty('--mini', '0px')
  }, [hay, teclado])

  const y = useMotionValue(0)
  const opacidad = useTransform(y, [0, 90], [1, 0.3])

  if (!r) return null
  const { libro, cap, sonando, cargando, t, dur } = r
  const pct = dur ? Math.min(100, (t / dur) * 100) : 0

  // En portal a <body>, como las fichas: dentro del contenedor de la app su
  // z-index no se mide con el de ellas, y se quedaba debajo de la ficha del
  // libro justo cuando se le da al play desde ahí.
  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          key="mini"
          // z-[52]: por encima de las fichas (PantallaInferior, 50), para que
          // al dar al play en la ficha de un libro se vea aparecer aquí; por
          // debajo del reproductor entero (55) y de las hojas (60).
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[52] px-2.5"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        >
          <motion.div
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.9 }}
            onDragEnd={(_, info) => { if (info.offset.y > 50 || info.velocity.y > 500) r.cerrar() }}
            style={{ y, opacity: opacidad }}
            className="mini-reproductor pointer-events-auto relative mx-auto flex h-16 max-w-md items-center gap-3 overflow-hidden rounded-[20px] pl-2 pr-1.5"
          >
            <button
              onClick={r.pantalla.abrir}
              aria-label="Abrir el reproductor"
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <Cover url={libro.cover_url} title={libro.title} className="w-[34px] shrink-0" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold leading-tight">{cap.title}</span>
                <span className="mt-0.5 block truncate text-xs text-ink-dim">{libro.title}</span>
              </span>
            </button>

            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={r.alternar}
              aria-label={sonando ? 'Pausa' : 'Reproducir'}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent"
            >
              {cargando && !sonando ? <Girando className="h-5 w-5" />
                : sonando ? <IconPausa className="h-5 w-5" /> : <IconPlay className="ml-0.5 h-5 w-5" />}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={r.cerrar}
              aria-label="Quitar el reproductor"
              className="flex h-9 w-8 shrink-0 items-center justify-center rounded-full text-ink-mute"
            >
              <IconX className="h-4 w-4" />
            </motion.button>

            {/* Lo que va del capítulo, como una línea en el borde de abajo. */}
            <span className="pointer-events-none absolute inset-x-3 bottom-0 h-[2px] overflow-hidden rounded-full bg-surface-2">
              <span className="block h-full bg-accent transition-[width] duration-500 ease-linear" style={{ width: `${pct}%` }} />
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

// Con el teclado fuera, el mini se aparta: no hay sitio para los dos y lo que
// se escribe es lo que importa en ese momento. --kb lo pone platform/viewport.js.
function useTecladoAbierto() {
  const [abierto, setAbierto] = useState(false)
  useEffect(() => {
    const mirar = () => {
      const kb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kb')) || 0
      setAbierto(kb > 80)
    }
    // Un poco después del resize: viewport.js también escucha ese evento y
    // tiene que haber puesto ya el --kb nuevo.
    const tarde = () => setTimeout(mirar, 80)
    mirar()
    window.visualViewport?.addEventListener('resize', tarde)
    window.addEventListener('resize', tarde)
    return () => {
      window.visualViewport?.removeEventListener('resize', tarde)
      window.removeEventListener('resize', tarde)
    }
  }, [])
  return abierto
}
