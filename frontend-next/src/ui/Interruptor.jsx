import { LLEGADA, enCss } from './curvas'

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
      {/* Todo transform y opacity, a la frecuencia de la pantalla: la bola se
          desliza (antes `layout` de Motion, en JavaScript, a 60 en Safari) y
          el color encendido es una capa encima que aparece con un fundido. */}
      <span className="relative flex h-6 w-10 shrink-0 items-center rounded-full bg-surface-2 p-0.5">
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-accent"
          style={{ opacity: puesto ? 1 : 0, transition: `opacity ${enCss(LLEGADA)}` }}
        />
        <span
          className="relative h-5 w-5 rounded-full bg-surface shadow-sm"
          style={{ transform: puesto ? 'translateX(16px)' : 'none', transition: `transform ${enCss(LLEGADA)}` }}
        />
      </span>
      <span className="min-w-0">
        <span className={`block text-sm ${puesto ? 'text-ink' : 'text-ink-dim'}`}>{etiqueta}</span>
        {nota && <span className="mt-0.5 block text-xs text-ink-mute">{nota}</span>}
      </span>
    </button>
  )
}
