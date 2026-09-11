import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { LLEGADA, SALIDA } from '../ui/curvas'

// Los avisos de toda Puchi: un mensaje nuevo mientras estás en la Luniteca,
// una llamada entrante mientras miras el club.
//
// Vive aquí arriba y no dentro de la pantalla que los provoca, porque el
// sentido de un aviso es justo que llegue **estés donde estés**. La pantalla
// de Diskordkito puede estar cerrada; el aviso tiene que salir igual.
//
// Dos clases, y se comportan distinto a propósito:
//
// - **De paso** (un mensaje): baja, se deja leer y se va sola. Tocarla lleva
//   al sitio. Se puede apartar arrastrando hacia arriba.
// - **Que espera** (una llamada entrante): no se va sola ni se puede apartar
//   sin contestar — una llamada perdida por un gesto sin querer es peor que
//   una tarjeta que insiste. Trae sus propios botones.
//
// Se apilan como mucho tres: a partir de ahí tapan la app en vez de avisar.

const AvisosContext = createContext(null)

const MAX_A_LA_VEZ = 3
const DURACION_MS = 5200

export function AvisosProvider({ children }) {
  const [avisos, setAvisos] = useState([])
  const contador = useRef(0)
  const relojes = useRef(new Map())

  const cerrar = useCallback((id) => {
    clearTimeout(relojes.current.get(id))
    relojes.current.delete(id)
    setAvisos(prev => prev.filter(a => a.id !== id))
  }, [])

  // `clave` sirve para reemplazar en vez de apilar: dos mensajes seguidos de
  // la misma conversación son un aviso que se actualiza, no dos tarjetas.
  const mostrar = useCallback((aviso) => {
    const id = aviso.clave || `aviso-${++contador.current}`
    setAvisos(prev => {
      const sinRepetir = prev.filter(a => a.id !== id)
      return [...sinRepetir, { ...aviso, id }].slice(-MAX_A_LA_VEZ)
    })
    clearTimeout(relojes.current.get(id))
    if (!aviso.espera) {
      relojes.current.set(id, setTimeout(() => cerrar(id), aviso.duracion ?? DURACION_MS))
    }
    return id
  }, [cerrar])

  useEffect(() => () => {
    for (const reloj of relojes.current.values()) clearTimeout(reloj)
  }, [])

  const valor = useMemo(() => ({ mostrar, cerrar }), [mostrar, cerrar])

  return (
    <AvisosContext.Provider value={valor}>
      {children}
      <Pila avisos={avisos} onCerrar={cerrar} />
    </AvisosContext.Provider>
  )
}

export function useAvisos() {
  return useContext(AvisosContext) || { mostrar: () => {}, cerrar: () => {} }
}

// En portal a <body> y por encima de todo (z-[70]): tiene que poder taparlo
// todo, incluida la ficha de un libro o una hoja abierta, que ya viven en z-50
// y z-60.
function Pila({ avisos, onCerrar }) {
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-center gap-2 px-3 pt-safe">
      <AnimatePresence initial={false}>
        {avisos.map(aviso => (
          <Tarjeta key={aviso.id} aviso={aviso} onCerrar={() => onCerrar(aviso.id)} />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  )
}

function Tarjeta({ aviso, onCerrar }) {
  const { titulo, texto, color, icono, acciones, onTocar, espera } = aviso

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.97, transition: SALIDA }}
      transition={LLEGADA}
      // Solo hacia arriba, que es de donde ha venido: un aviso de paso se
      // aparta con el mismo gesto con el que llegó. El que espera no se
      // arrastra — se contesta.
      drag={espera ? false : 'y'}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.5, bottom: 0 }}
      onDragEnd={(_, info) => { if (info.offset.y < -40 || info.velocity.y < -400) onCerrar() }}
      className="pointer-events-auto mt-2 w-full max-w-md overflow-hidden rounded-xl3 border border-line bg-surface/95 sombra-panel backdrop-blur-xl"
      style={{
        // Teñida del color de quien la manda: reconocer de quién es un aviso
        // sin leer el nombre es la mitad de para qué sirve.
        borderColor: color ? `color-mix(in srgb, ${color} 35%, var(--color-line))` : undefined,
      }}
    >
      <button
        onClick={onTocar ? () => { onTocar(); onCerrar() } : undefined}
        disabled={!onTocar}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left disabled:cursor-default"
      >
        {icono}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold" style={{ color: color || 'var(--color-ink)' }}>
            {titulo}
          </span>
          {texto && <span className="mt-0.5 block truncate text-[13px] text-ink-dim">{texto}</span>}
        </span>
      </button>

      {acciones && <div className="flex gap-2 border-t border-line px-3.5 py-2.5">{acciones}</div>}
    </motion.div>
  )
}
