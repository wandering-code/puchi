import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { IconX } from '../../ui/icons'
import { useCapa } from '../../platform/capas'
import { useArrastreParaCerrar } from '../../ui/arrastre'

// La hoja que sube desde abajo, una sola para toda la app: filtros, estado,
// fechas, carpeta… Todo lo que hay que elegir se pide igual, en el mismo sitio
// y con el mismo gesto para cerrarlo, en vez de unas cosas en un panel y otras
// en un diálogo en mitad de la pantalla.
//
// En portal a <body>: quien la abre vive dentro de contenedores con scroll y
// transform propios, y desde ahí un elemento fijo no puede taparlo todo.
export default function HojaInferior({ abierta, titulo, onCerrar, children, pie }) {
  const arrastre = useArrastreParaCerrar(onCerrar, { umbral: 90 })

  // El gesto de volver y Escape los gestiona useCapa (platform/capas.js).
  return createPortal(
    <AnimatePresence>
      {abierta && (
        <>
          <motion.div
            // Mismo velo difuminado que la pantalla completa (ver
            // PantallaInferior): lo de detrás se reconoce sin competir con lo
            // que hay delante.
            className="fixed inset-0 z-[60] bg-ink/25 backdrop-blur-[6px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => onCerrar()}
          />

          <motion.div
            role="dialog"
            aria-label={titulo}
            className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[85dvh] flex-col rounded-t-[28px] border-t border-line bg-surface pb-safe"
            style={{ y: arrastre.y }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
          >
            {/* El asa: indica que se puede arrastrar y es, además, el único
                sitio desde el que se arrastra. El gesto NO puede vivir en el
                panel entero: Motion le pondría touch-action a un elemento que
                contiene el scroll y dejaría el contenido sin poder desplazarse
                con el dedo. */}
            <div
              {...arrastre.asa}
              className="flex shrink-0 cursor-grab justify-center pb-2 pt-3 active:cursor-grabbing"
            >
              <span className="h-1 w-10 rounded-full bg-line" />
            </div>

            <div className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-1">
              <h3 className="flex-1 font-display text-lg font-bold tracking-[-0.01em]">{titulo}</h3>
              <button
                onClick={() => onCerrar()}
                aria-label="Cerrar"
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-mute transition-colors active:bg-surface-2"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
              {children}
            </div>

            {pie && (
              <div className="flex shrink-0 gap-2 border-t border-line px-5 pb-2 pt-3">{pie}</div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

// La hoja usa el mecanismo de capas común, para que el gesto de volver cierre
// solo la de arriba cuando hay varias abiertas.
export const useHoja = useCapa
