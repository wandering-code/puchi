import { useLayoutEffect, useRef, useState } from 'react'
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

export default function PantallaInferior({ abierta = true, onCerrar, cabecera, children, aparicion = 'subir', visible = true }) {
  // `aparicion`: 'subir' es la de siempre. 'fundido' es para cuando el libro ya
  // ha volado hasta aquí desde la estantería: la pantalla no puede subir
  // también, porque entonces la portada se movería mientras el libro aterriza
  // sobre ella.
  const subiendo = aparicion === 'subir'
  // Igual que HojaInferior y que el menú lateral: el armazón se queda montado
  // y solo se mueve. Quien la usa la mantiene montada con la última ficha que
  // se abrió, así que al abrir la siguiente no hay que levantar nada.
  const aVista = abierta && visible
  // Con 'fundido' la pantalla ya está en su sitio desde el primer fotograma
  // aunque no se vea: así se puede medir dónde cae su portada mientras el libro
  // todavía está volando hacia ella.
  // El gesto de cerrar va solo en el asa. Si estuviera en todo el panel, Motion
  // le pondría touch-action al elemento que contiene el scroll y el contenido
  // no se podría desplazar con el dedo (ver ui/arrastre.js).
  const arrastre = useArrastreParaCerrar(onCerrar, { umbral: 110 })
  const cuerpo = useRef(null)
  // Mientras la ficha se está colocando no se puede desplazar. Además llega
  // siempre por arriba: como ya no se desmonta al cerrarla, sin esto la
  // siguiente (o la misma otra vez) aparecía por donde se hubiera quedado.
  const [colocandose, setColocandose] = useState(false)
  useLayoutEffect(() => {
    if (!abierta) return
    if (cuerpo.current) cuerpo.current.scrollTop = 0
    setColocandose(true)
  }, [abierta])

  return createPortal(
    <>
      {/* La franja que queda a la vista, difuminada: lo de detrás se reconoce
          pero no compite con lo que hay delante. */}
      <motion.div
        className="fixed inset-0 z-50 bg-ink/25 backdrop-blur-[6px]"
        initial={false}
        animate={{ opacity: abierta ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        style={{ pointerEvents: abierta ? 'auto' : 'none' }}
        onClick={() => onCerrar()}
        aria-hidden
      />

      <motion.div
        data-panel="pantalla"
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[28px] border-t border-line bg-bg shadow-[0_-12px_40px_-12px_rgba(60,40,20,.35)]"
        style={{ y: arrastre.y, top: HUECO, pointerEvents: abierta ? 'auto' : 'none', willChange: 'transform' }}
        inert={!abierta}
        initial={false}
        // Las dos propiedades se animan SIEMPRE, cada una con su regla. Antes
        // se animaba solo una según el modo, y como el modo cambia al cerrarse
        // (el vuelo acaba y se vuelve a 'subir'), la ficha se aparcaba abajo
        // recuperando la opacidad, y la siguiente que llegaba con vuelo se veía
        // un fotograma abajo del todo antes de plantarse en su sitio.
        animate={{ y: abierta ? 0 : '100%', opacity: aVista ? 1 : 0 }}
        onAnimationComplete={() => setColocandose(false)}
        transition={{
          // Subiendo, el panel llega con su muelle. Con el libro volando no se
          // mueve: se planta donde toca de un fotograma para otro, todavía
          // transparente, y lo que se ve es el fundido. Al cerrarse así, se
          // espera a que el fundido acabe antes de aparcarlo abajo.
          y: subiendo
            ? { type: 'spring', stiffness: 420, damping: 40 }
            : { duration: 0, delay: abierta ? 0 : 0.34 },
          opacity: subiendo
            // Subiendo se ve entero todo el rato: aparece al abrir y se apaga
            // cuando ya ha salido de la pantalla.
            ? { duration: 0, delay: abierta ? 0 : 0.32 }
            // El fundido es largo y empieza algo después de arrancar el vuelo:
            // la ficha va apareciendo mientras el libro sube, en vez de salir
            // de golpe cuando aterriza.
            : { duration: 0.34, delay: aVista ? 0.14 : 0 },
        }}
      >
        {/* El asa ya no necesita apartarse de la zona segura: el panel entero
            empieza por debajo de ella. */}
        <div {...arrastre.asa} className="flex shrink-0 cursor-grab justify-center pb-1 pt-2 active:cursor-grabbing">
          <span className="h-1 w-10 rounded-full bg-line" />
        </div>

        <div
          ref={cuerpo}
          // Se corta el gesto, no el overflow: cambiarlo en un contenedor con
          // scroll puede saltar su posición (mismo motivo que en el vuelo).
          style={colocandose ? { touchAction: 'none' } : undefined}
          className="flex-1 overflow-y-auto overscroll-contain"
        >
          {cabecera}
          {children}
        </div>
      </motion.div>
    </>,
    document.body,
  )
}
