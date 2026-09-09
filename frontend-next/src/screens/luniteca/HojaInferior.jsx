import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { IconX } from '../../ui/icons'
import { useCapa } from '../../platform/capas'
import { useArrastreParaCerrar } from '../../ui/arrastre'
import { LLEGADA, SALIDA } from '../../ui/curvas'

// La hoja que sube desde abajo, una sola para toda la app: filtros, estado,
// fechas, carpeta… Todo lo que hay que elegir se pide igual, en el mismo sitio
// y con el mismo gesto para cerrarlo, en vez de unas cosas en un panel y otras
// en un diálogo en mitad de la pantalla.
//
// En portal a <body>: quien la abre vive dentro de contenedores con scroll y
// transform propios, y desde ahí un elemento fijo no puede taparlo todo.
export default function HojaInferior({ abierta, titulo, onCerrar, children, pie }) {
  const arrastre = useArrastreParaCerrar(onCerrar, { umbral: 90 })
  // El armazón de la hoja (portal, velo y panel) se queda montado y solo se
  // mueve. Construirlo dentro del propio toque costaba, medido en WebKit,
  // 19ms de hilo principal por apertura, frente a los 4ms del menú lateral,
  // que ya no monta nada al abrirse. Y no es el contenido: quitarle la mitad
  // apenas ahorraba 2ms, el gasto está en levantar el armazón.
  //
  // Lo de dentro sí espera al primer uso: montarlo desde el principio saldría
  // más caro de lo que ahorra, porque una ficha de libro lleva cuatro hojas
  // colgando (estado, fechas, carpeta, lecturas) que casi nunca se abren.
  const usada = useRef(false)
  if (abierta) usada.current = true

  // Igual que la pantalla completa: al abrirse vuelve arriba y no se deja
  // desplazar hasta que ha terminado de subir. Como tampoco se desmonta, si no
  // se reposiciona reaparece por donde se quedó la vez anterior.
  const cuerpo = useRef(null)
  const [colocandose, setColocandose] = useState(false)
  useLayoutEffect(() => {
    if (!abierta) return
    if (cuerpo.current) cuerpo.current.scrollTop = 0
    setColocandose(true)
    // Red de seguridad, y no un adorno: si el panel ya está donde tiene que
    // estar, Motion no anima nada y no avisa de que haya terminado, así que
    // sin esto el gesto se quedaba cortado PARA SIEMPRE. Pasaba justo en la
    // primera ficha que se abría en cada sesión, que es la que se monta ya
    // colocada; las siguientes sí animan y se desbloqueaban solas.
    const suelta = setTimeout(() => setColocandose(false), 600)
    return () => clearTimeout(suelta)
  }, [abierta])

  // El gesto de volver y Escape los gestiona useCapa (platform/capas.js).
  return createPortal(
    <>
          <motion.div
            // Mismo velo difuminado que la pantalla completa (ver
            // PantallaInferior): lo de detrás se reconoce sin competir con lo
            // que hay delante.
            className="fixed inset-0 z-[60] bg-ink/25 backdrop-blur-[6px]"
            initial={false}
            animate={{ opacity: abierta ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ pointerEvents: abierta ? 'auto' : 'none' }}
            onClick={() => onCerrar()}
            aria-hidden
          />

          <motion.div
            role="dialog"
            aria-label={titulo}
            className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[85dvh] flex-col rounded-t-[28px] border-t border-line bg-surface pb-safe"
            inert={!abierta}
            style={{ y: arrastre.y, pointerEvents: abierta ? 'auto' : 'none', willChange: 'transform' }}
            initial={false}
            animate={{ y: abierta ? 0 : '100%' }}
            transition={abierta ? LLEGADA : SALIDA}
            onAnimationComplete={() => setColocandose(false)}
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

            <div
              ref={cuerpo}
              style={colocandose ? { touchAction: 'none' } : undefined}
              className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4"
            >
              {usada.current && children}
            </div>

            {pie && (
              <div className="flex shrink-0 gap-2 border-t border-line px-5 pb-2 pt-3">{pie}</div>
            )}
          </motion.div>
    </>,
    document.body,
  )
}

// La hoja usa el mecanismo de capas común, para que el gesto de volver cierre
// solo la de arriba cuando hay varias abiertas.
export const useHoja = useCapa
