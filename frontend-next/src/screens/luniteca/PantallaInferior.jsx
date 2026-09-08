import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useArrastreParaCerrar } from '../../ui/arrastre'

// Una pantalla completa que sube desde abajo: la ficha de un libro y añadir
// libro. Es la hermana mayor de HojaInferior — misma llegada y mismo gesto para
// cerrar, pero ocupando casi todo el alto en vez de lo que mida su contenido.
//
// Se usa para lo que tiene mucho dentro o cambia de tamaño mientras se usa: una
// hoja que crece y encoge según lo que enseñe da un salto cada vez, y eso se
// nota (pasó con las pestañas de Buscar y A mano).
//
// NO lleva su propio AnimatePresence: quien la usa la monta dentro del suyo, y
// así la animación de salida funciona al desmontarla.

// Lo que se deja ver de la pantalla de debajo, arriba del todo. No llega al
// borde a propósito: esa franja recuerda que lo de abajo sigue ahí y que esto
// se cierra, igual que las hojas del propio iPhone. En un móvil con notch se
// usa el alto de la zona segura, que ya deja el hueco justo bajo la barra de
// estado.
const HUECO = 'max(2rem, env(safe-area-inset-top))'

export default function PantallaInferior({ onCerrar, cabecera, children }) {
  // El gesto de cerrar va solo en el asa. Si estuviera en todo el panel, Motion
  // le pondría touch-action al elemento que contiene el scroll y el contenido
  // no se podría desplazar con el dedo (ver ui/arrastre.js).
  const arrastre = useArrastreParaCerrar(onCerrar, { umbral: 110 })

  return createPortal(
    <>
      {/* La franja que queda a la vista, difuminada: lo de detrás se reconoce
          pero no compite con lo que hay delante. */}
      <motion.div
        className="fixed inset-0 z-50 bg-ink/25 backdrop-blur-[6px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={() => onCerrar()}
      />

      <motion.div
        data-panel="pantalla"
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[28px] border-t border-line bg-bg shadow-[0_-12px_40px_-12px_rgba(60,40,20,.35)]"
        style={{ y: arrastre.y, top: HUECO }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 420, damping: 40 }}
      >
        {/* El asa ya no necesita apartarse de la zona segura: el panel entero
            empieza por debajo de ella. */}
        <div {...arrastre.asa} className="flex shrink-0 cursor-grab justify-center pb-1 pt-2 active:cursor-grabbing">
          <span className="h-1 w-10 rounded-full bg-line" />
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {cabecera}
          {children}
        </div>
      </motion.div>
    </>,
    document.body,
  )
}
