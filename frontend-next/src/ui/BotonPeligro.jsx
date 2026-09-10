import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

// Lo que no tiene vuelta atrás: borrar un libro de la estantería, borrar una
// sesión del club, borrar la cuenta de alguien.
//
// No pide mantener pulsado ni una pantalla aparte: solo mete medio segundo
// entre "eliminar" y que el botón de confirmar responda, para que un doble
// toque por error no baste. Es la misma guarda que ya usaban las dos Lunitecas
// de la Puchi actual, y estaba escrita a mano en cada sitio que la necesitaba.
const ARMADO_MS = 500

export default function BotonPeligro({
  etiqueta,
  pregunta,
  confirmar = 'Eliminar',
  onConfirmar,
  className = '',
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [armado, setArmado] = useState(false)
  const temporizador = useRef(null)

  useEffect(() => () => clearTimeout(temporizador.current), [])

  function pedirConfirmacion() {
    setConfirmando(true)
    setArmado(false)
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setArmado(true), ARMADO_MS)
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!confirmando ? (
        <motion.button
          key="pedir"
          onClick={pedirConfirmacion}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={`text-sm text-ink-mute ${className}`}
        >
          {etiqueta}
        </motion.button>
      ) : (
        <motion.div
          key="confirmar"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-3"
        >
          <span className="min-w-0 flex-1 text-sm text-ink-dim">{pregunta}</span>
          <button
            onClick={() => armado && onConfirmar()}
            disabled={!armado}
            className="shrink-0 rounded-xl2 bg-danger px-3.5 py-2 text-sm font-semibold text-on-accent transition-opacity disabled:opacity-50"
          >
            {confirmar}
          </button>
          <button onClick={() => setConfirmando(false)} className="shrink-0 text-sm text-ink-mute">
            No
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// La misma guarda, pero cuando lo que confirma es un icono dentro de una fila
// apretada (una sesión, una cuenta de la lista) y no hay sitio para una
// pregunta escrita: el botón se pone rojo y no responde hasta que está armado.
export function IconoPeligro({ etiqueta, onConfirmar, children }) {
  const [confirmando, setConfirmando] = useState(false)
  const [armado, setArmado] = useState(false)
  const temporizador = useRef(null)

  useEffect(() => () => clearTimeout(temporizador.current), [])

  // Al soltar el foco vuelve a su sitio: un botón que se quedó rojo de hace un
  // rato es justo el que se pulsa sin mirar.
  useEffect(() => {
    if (!confirmando) return
    const id = setTimeout(() => setConfirmando(false), 4000)
    return () => clearTimeout(id)
  }, [confirmando])

  function alPulsar() {
    if (!confirmando) {
      setConfirmando(true)
      setArmado(false)
      clearTimeout(temporizador.current)
      temporizador.current = setTimeout(() => setArmado(true), ARMADO_MS)
      return
    }
    if (armado) { setConfirmando(false); onConfirmar() }
  }

  return (
    <motion.button
      onClick={alPulsar}
      whileTap={{ scale: 0.9 }}
      aria-label={confirmando ? `Confirmar: ${etiqueta}` : etiqueta}
      title={confirmando ? '¿Seguro?' : etiqueta}
      animate={{ opacity: confirmando && !armado ? 0.45 : 1 }}
      transition={{ duration: 0.2 }}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
        confirmando ? 'border-danger bg-danger/10 text-danger' : 'border-line text-ink-mute'
      }`}
    >
      {children}
    </motion.button>
  )
}
