import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { IconX } from '../../ui/icons'
import { cerrarCapa, useCapaHistorial } from '../../platform/capas'

// La hoja que sube desde abajo, una sola para toda la app: filtros, estado,
// fechas, carpeta… Todo lo que hay que elegir se pide igual, en el mismo sitio
// y con el mismo gesto para cerrarlo, en vez de unas cosas en un panel y otras
// en un diálogo en mitad de la pantalla.
//
// En portal a <body>: quien la abre vive dentro de contenedores con scroll y
// transform propios, y desde ahí un elemento fijo no puede taparlo todo.
export default function HojaInferior({ abierta, titulo, onCerrar, children, pie }) {
  // El gesto de volver (y Escape) la cierran, y solo a ella aunque haya otras
  // capas abiertas debajo — ver platform/capas.js.
  useCapaHistorial(abierta, onCerrar)

  return createPortal(
    <AnimatePresence>
      {abierta && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-ink/25"
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
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            // Se cierra tirando de ella hacia abajo, que es lo que se intenta
            // por instinto. Solo hacia abajo (top: 0), para que no se pueda
            // despegar del borde.
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              // Distancia O velocidad: un tirón corto y rápido también cierra.
              if (info.offset.y > 90 || info.velocity.y > 500) onCerrar()
            }}
          >
            {/* El asa: además de indicar que se puede arrastrar, es la zona por
                la que se agarra sin tocar ningún control. */}
            <div className="flex shrink-0 cursor-grab justify-center pb-1 pt-3 active:cursor-grabbing">
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

// Estado de una hoja, con el cierre que le corresponde: cerrar deshaciendo la
// entrada del historial que metió al abrirse (history.back dispara el popstate
// que baja el estado), salvo cuando es el propio gesto de volver quien la está
// cerrando. Sin esto, cada sitio que abre una hoja repetiría estas cuatro
// líneas y en alguno se colaría una entrada muerta que obliga a pulsar atrás
// dos veces.
export function useHoja() {
  const [abierta, setAbierta] = useState(false)
  const abrir = useCallback(() => setAbierta(true), [])
  const cerrar = useCallback(cerrarCapa(setAbierta), [])
  return { abierta, abrir, cerrar }
}
