import { motion } from 'motion/react'
import { IconChevron } from '../../ui/icons'
import { usarPreferencia } from '../../platform/preferencias'

// Cuatro formas de separar las secciones de la estantería (estados y años),
// para probarlas y quedarse con una. Se elige en Ajustes y se guarda en la
// CUENTA (ver platform/preferencias), así que acompaña a quien entra esté en
// el móvil o en el ordenador; cuando esté decidido, se deja la elegida y esto
// desaparece.

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
    id: 'mixto',
    nombre: 'Bloque con el título pegado',
    detalle: 'Las dos cosas: cada sección en su tarjeta, y su nombre se queda arriba mientras recorres esa tarjeta.',
  },
  {
    id: 'minimal',
    nombre: 'Solo el nombre, con aire',
    detalle: 'Sin líneas ni recuadros: el nombre en pequeño y mucho espacio entre secciones.',
  },
]

// Devuelve la elegida y cómo cambiarla, igual que useState.
export function usarSeparacion() {
  const [valor, poner] = usarPreferencia('separacion', 'linea')
  return [SEPARACIONES.some(x => x.id === valor) ? valor : 'linea', poner]
}

const CON_BLOQUE = ['bloque', 'mixto']

// Cuánto separa una sección de la anterior.
export function huecoEntreSecciones(variante) {
  if (variante === 'minimal') return 'space-y-12'
  if (CON_BLOQUE.includes(variante)) return 'space-y-4'
  return 'space-y-7'
}

// La caja que envuelve una sección entera.
export function CajaSeccion({ variante, children }) {
  if (!CON_BLOQUE.includes(variante)) return <section>{children}</section>
  // El fondo de la tarjeta es opaco y no translúcido en la variante mixta: su
  // título se queda pegado por encima de los libros de la propia sección, y
  // con transparencia se verían pasar por debajo del texto.
  const fondo = variante === 'mixto' ? 'bg-surface' : 'bg-surface/60'
  return (
    <section className={`rounded-xl3 border border-line p-4 ${fondo}`}>{children}</section>
  )
}

// El título de una sección (o de un año dentro de "Leídos", más pequeño).
// `desde`: a qué altura se queda pegado el título. En la estantería propia hay
// una barra de herramientas fija de 56px y se pega justo debajo; en la de otra
// persona no la hay, así que se pega arriba del todo. Las clases van completas
// y no compuestas porque Tailwind solo se queda con las que ve escritas.
export function TituloSeccion({ variante, label, cuenta, plegada, onAlternar, anidado = false, accion = null, desde = 'top-14' }) {
  const contenido = <Contenido variante={variante} label={label} cuenta={cuenta} plegada={plegada} hayChevron={!!onAlternar} anidado={anidado} />

  // Los títulos que se quedan pegados bajo la barra de herramientas (56px)
  // mientras se recorre su sección. Siempre con fondo propio: si no, los libros
  // se les ven por debajo al pasar.
  //
  // Solo la cabecera de la sección, nunca la del año: con las dos pegadas se
  // amontonaban una encima de otra al llegar la segunda, y se leía fatal
  // (visto en captura). El año pasa de largo con su contenido.
  //
  // En "mixto" el título se pega DENTRO de su tarjeta: se despega solo cuando
  // la tarjeta sale de la pantalla, así que siempre se sabe de qué sección son
  // los libros que se están mirando, sin que el título de una sección se quede
  // colgado sobre la siguiente. Se estira hasta los bordes de la tarjeta con
  // márgenes negativos, para que tape de lado a lado.
  const clasePegada = anidado
    ? ''
    : variante === 'pegada'
      ? `sticky ${desde} z-[5] -mx-5 w-[calc(100%+2.5rem)] border-b border-line bg-bg px-5 py-2.5`
      : variante === 'mixto'
        // El ancho va explícito: con -mx-4 y w-full el elemento se queda corto
        // por la derecha (w-full mide el padre, sin contar los márgenes
        // negativos) y por ahí asomaban los libros y el título del año que
        // pasaban por detrás.
        ? `sticky ${desde} z-[5] -mx-4 -mt-4 w-[calc(100%+2rem)] rounded-t-[inherit] border-b border-line bg-surface px-4 pb-2.5 pt-4`
        : ''

  // El ancho lo pone clasePegada cuando existe (necesita contar sus márgenes
  // negativos). No se puede dejar también w-full: las dos son la misma
  // propiedad y gana la que Tailwind ponga después en su hoja, no la que vaya
  // después en esta cadena — con w-full puesto, el título pegado se quedaba
  // corto por la derecha y por ahí asomaban los libros de detrás.
  const base = `flex items-center gap-2 text-left ${clasePegada || 'w-full'}`

  // La acción va FUERA del botón del título, en la misma fila: un botón dentro
  // de otro botón no es HTML válido y el navegador lo deshace por su cuenta.
  if (!onAlternar) {
    return (
      <div className={base}>
        {contenido}
        {accion}
      </div>
    )
  }
  return (
    <div className={base}>
      <button onClick={onAlternar} className="flex flex-1 items-center gap-2 text-left">
        {contenido}
      </button>
      {accion}
    </div>
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
