import { motion } from 'motion/react'
import { IconChevron } from '../../ui/icons'

// Cuatro formas de separar las secciones de la estantería (estados y años),
// para probarlas y quedarse con una. Se elige en Ajustes y se guarda en el
// navegador; cuando esté decidido, se deja la elegida y esto desaparece.
const CLAVE = 'luni_separacion'

export const SEPARACIONES = [
  {
    id: 'linea',
    nombre: 'Título con línea',
    detalle: 'La de ahora: el nombre, cuántos hay y una línea que llega hasta el borde.',
  },
  {
    id: 'pegada',
    nombre: 'Título que se queda arriba',
    detalle: 'Al bajar por una sección larga, su nombre se queda pegado bajo la barra hasta que empieza la siguiente.',
  },
  {
    id: 'bloque',
    nombre: 'Cada sección en su bloque',
    detalle: 'Los libros de cada estado van dentro de una tarjeta, separadas unas de otras.',
  },
  {
    id: 'minimal',
    nombre: 'Solo el nombre, con aire',
    detalle: 'Sin líneas ni recuadros: el nombre en pequeño y mucho espacio entre secciones.',
  },
]

export function leerSeparacion() {
  try {
    const v = localStorage.getItem(CLAVE)
    return SEPARACIONES.some(x => x.id === v) ? v : 'linea'
  } catch {
    return 'linea'
  }
}

export function guardarSeparacion(id) {
  try { localStorage.setItem(CLAVE, id) } catch { /* modo privado */ }
}

// Cuánto separa una sección de la anterior.
export function huecoEntreSecciones(variante) {
  if (variante === 'minimal') return 'space-y-12'
  if (variante === 'bloque') return 'space-y-4'
  return 'space-y-7'
}

// La caja que envuelve una sección entera: solo "bloque" tiene una.
export function CajaSeccion({ variante, children }) {
  if (variante !== 'bloque') return <section>{children}</section>
  return (
    <section className="rounded-xl3 border border-line bg-surface/60 p-4">{children}</section>
  )
}

// El título de una sección (o de un año dentro de "Leídos", más pequeño).
export function TituloSeccion({ variante, label, cuenta, plegada, onAlternar, anidado = false }) {
  const contenido = <Contenido variante={variante} label={label} cuenta={cuenta} plegada={plegada} hayChevron={!!onAlternar} anidado={anidado} />

  // "pegada" se queda bajo la barra de herramientas (que mide 56px) mientras
  // se recorre la sección. Necesita fondo propio: si no, los libros se le ven
  // por debajo al pasar.
  //
  // Solo la cabecera de la sección, nunca la del año: con las dos pegadas se
  // amontonaban una encima de otra al llegar la segunda, y se leía fatal
  // (visto en captura). El año pasa de largo con su contenido.
  const clasePegada = variante === 'pegada' && !anidado
    ? 'sticky top-14 z-[5] -mx-5 border-b border-line bg-bg px-5 py-2.5'
    : ''

  if (!onAlternar) return <div className={`flex items-center gap-2 ${clasePegada}`}>{contenido}</div>
  return (
    <button onClick={onAlternar} className={`flex w-full items-center gap-2 text-left ${clasePegada}`}>
      {contenido}
    </button>
  )
}

function Contenido({ variante, label, cuenta, plegada, hayChevron, anidado }) {
  const tamano = anidado
    ? 'font-display text-base font-semibold'
    : 'font-display text-lg font-bold tracking-[-0.01em]'

  if (variante === 'minimal') {
    return (
      <>
        <span className={anidado ? 'text-[13px] uppercase tracking-[0.16em] text-ink-dim' : 'text-[11px] uppercase tracking-[0.2em] text-ink-mute'}>
          {label}
        </span>
        <span className="text-[11px] text-ink-mute/70">{cuenta}</span>
        <span className="flex-1" />
        {hayChevron && (
          <IconChevron className={`h-4 w-4 shrink-0 text-ink-mute transition-transform duration-200 ${plegada ? '' : 'rotate-180'}`} />
        )}
      </>
    )
  }

  return (
    <>
      <span className={tamano}>{label}</span>
      <span className="text-xs text-ink-mute">{cuenta}</span>
      {/* La línea que llena el hueco solo la tiene la variante que la usa. */}
      {variante === 'linea' ? <span className="h-px flex-1 bg-line" /> : <span className="flex-1" />}
      {hayChevron && (
        <IconChevron className={`h-4 w-4 shrink-0 text-ink-mute transition-transform duration-200 ${plegada ? '' : 'rotate-180'}`} />
      )}
    </>
  )
}

// Selector para Ajustes.
export function SelectorSeparacion({ elegida, onElegir }) {
  return (
    <div className="flex flex-col divide-y divide-[color:var(--color-line)]">
      {SEPARACIONES.map(v => {
        const activa = elegida === v.id
        return (
          <button key={v.id} onClick={() => onElegir(v.id)} className="flex items-start gap-3 px-4 py-3 text-left">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${activa ? 'border-accent bg-accent' : 'border-line'}`}>
              {activa && (
                <motion.span
                  layoutId="separacion-elegida"
                  className="h-2 w-2 rounded-full bg-on-accent"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
            </span>
            <span className="min-w-0">
              <span className={`block text-sm font-semibold ${activa ? 'text-accent' : 'text-ink'}`}>{v.nombre}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-ink-mute">{v.detalle}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
