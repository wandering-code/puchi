import { motion } from 'motion/react'

// Un interruptor de verdad y no un <input type="checkbox">: se toca con el
// pulgar, se ve encendido o apagado de un vistazo y se mueve al cambiar, que
// es lo que confirma que el cambio ha ido. La caja nativa mide 13px en el
// móvil y no se puede teñir con la paleta de la app.
export default function Interruptor({ puesto, onCambiar, etiqueta, nota = null, deshabilitado = false }) {
  return (
    <button
      role="switch"
      aria-checked={puesto}
      disabled={deshabilitado}
      onClick={() => onCambiar(!puesto)}
      className="flex w-full items-center gap-3 text-left disabled:opacity-50"
    >
      <span
        className="flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors"
        style={{ background: puesto ? 'var(--color-accent)' : 'var(--color-surface-2)' }}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 520, damping: 34 }}
          className="h-5 w-5 rounded-full bg-surface shadow-sm"
          style={{ marginLeft: puesto ? 'auto' : 0 }}
        />
      </span>
      <span className="min-w-0">
        <span className={`block text-sm ${puesto ? 'text-ink' : 'text-ink-dim'}`}>{etiqueta}</span>
        {nota && <span className="mt-0.5 block text-xs text-ink-mute">{nota}</span>}
      </span>
    </button>
  )
}
