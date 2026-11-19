import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Marco from '../../ui/Marco'
import { IconChevron } from '../../ui/icons'
import { usarPreferencia } from '../../platform/preferencias'

// Cómo se ve cada bloque de la estantería (las secciones de cada estado y los
// años de «Leídos»). Antes eran seis formas cerradas; ahora se construye con
// cuatro piezas que se combinan, y se elige en Ajustes con vista previa:
// - caja: sin caja, tarjeta (opaca) o translúcida;
// - título: con línea, simple, franja de color o pequeño en mayúsculas;
// - pegado: si el título se queda arriba al bajar por su sección;
// - densidad: cuánto aire hay entre un bloque y el siguiente.
// Va con la CUENTA (platform/preferencias), como el resto.
//
// En el código, `variante` es esa forma (un objeto), no un nombre: la pasan
// tal cual la Luniteca, el club y las estanterías de los demás.

export const CAJAS = [
  { id: 'ninguna', nombre: 'Sin caja' },
  { id: 'tarjeta', nombre: 'Tarjeta' },
  { id: 'translucida', nombre: 'Translúcida' },
]
export const TITULOS = [
  { id: 'linea', nombre: 'Con línea' },
  { id: 'simple', nombre: 'Simple' },
  { id: 'franja', nombre: 'Franja' },
  { id: 'pequeno', nombre: 'Pequeño' },
]
export const DENSIDADES = [
  { id: 'compacta', nombre: 'Compacta' },
  { id: 'normal', nombre: 'Normal' },
  { id: 'amplia', nombre: 'Amplia' },
]

// Las seis formas de antes, traducidas a piezas: quien tenía una elegida la
// sigue viendo igual hasta que toque algo.
const DE_LAS_ANTIGUAS = {
  linea:   { caja: 'ninguna',     titulo: 'linea',   pegado: false, densidad: 'normal' },
  pegada:  { caja: 'ninguna',     titulo: 'simple',  pegado: true,  densidad: 'normal' },
  bloque:  { caja: 'translucida', titulo: 'simple',  pegado: false, densidad: 'normal' },
  mixto:   { caja: 'tarjeta',     titulo: 'simple',  pegado: true,  densidad: 'normal' },
  color:   { caja: 'tarjeta',     titulo: 'franja',  pegado: true,  densidad: 'normal' },
  minimal: { caja: 'ninguna',     titulo: 'pequeno', pegado: false, densidad: 'amplia' },
}

const de = (lista, v, porDefecto) => (lista.some(x => x.id === v) ? v : porDefecto)
function normalizar(f) {
  return {
    caja: de(CAJAS, f?.caja, 'ninguna'),
    titulo: de(TITULOS, f?.titulo, 'linea'),
    pegado: !!f?.pegado,
    densidad: de(DENSIDADES, f?.densidad, 'normal'),
  }
}

// La forma elegida y cómo cambiar una o varias de sus piezas. La forma es el
// mismo objeto mientras no cambie (useMemo): la reciben componentes
// memoizados (las secciones) y no deben repintarse por nada.
export function usarSeparacion() {
  const [antigua] = usarPreferencia('separacion', 'linea')
  const [guardada, poner] = usarPreferencia('bloque', null)
  const forma = useMemo(
    () => normalizar(guardada || DE_LAS_ANTIGUAS[antigua] || DE_LAS_ANTIGUAS.linea),
    [guardada, antigua],
  )
  const cambiar = useCallback(cambios => poner({ ...forma, ...cambios }), [forma, poner])
  return [forma, cambiar]
}

const conCaja = forma => forma.caja !== 'ninguna'

// Las secciones de la estantería propia, su orden y cuáles se ven. Las
// ocultas no se pintan (los libros siguen en la cuenta, solo no salen aquí).
export const SECCIONES_ESTANTERIA = [
  { id: 'reading', nombre: 'Leyendo' },
  { id: 'read', nombre: 'Leídos' },
  { id: 'want', nombre: 'Por leer' },
  { id: 'dropped', nombre: 'Dropeados' },
]
const IDS = SECCIONES_ESTANTERIA.map(x => x.id)

export function usarOrdenDeSecciones() {
  const [guardado, poner] = usarPreferencia('secciones', null)
  const valor = useMemo(() => {
    // Lo guardado, sin ids desconocidos ni repetidos, y con las que falten al
    // final (por si algún día hay una sección nueva).
    const orden = [...new Set((guardado?.orden || []).filter(id => IDS.includes(id))), ...IDS]
      .filter((id, i, l) => l.indexOf(id) === i)
    const ocultas = (guardado?.ocultas || []).filter(id => IDS.includes(id))
    return { orden, ocultas, visibles: orden.filter(id => !ocultas.includes(id)) }
  }, [guardado])
  const cambiar = useCallback(cambios => poner({ orden: valor.orden, ocultas: valor.ocultas, ...cambios }), [valor, poner])
  return [valor, cambiar]
}

// Para el tinte de la franja de color cuando la sección no es de un estado
// (las del club o las de un perfil): el de la app.
const colorDe = (estado) => COLOR_DE_ESTADO[estado] || 'var(--color-accent)'
const mezcla = (color, pct, con = 'var(--color-surface)') => `color-mix(in srgb, ${color} ${pct}%, ${con})`

// Cada sección lleva el color de su estado. Los colores ya existían en la
// paleta (los usa el punto de estado de la ficha) pero en la estantería no se
// usaban: las cuatro secciones se veían exactamente iguales. Con esto se sabe
// en cuál estás sin leer el título, y de paso la pantalla deja de ser toda del
// mismo tono, que era lo que se notaba flojo.
//
// Cada uno puede cambiar el de cada sección en Ajustes: las variables
// --color-seccion-* salen de index.css según lo elegido (ver COLORES_SECCION
// en platform/tema.js). Por defecto, los de siempre.
export const COLOR_DE_ESTADO = {
  reading: 'var(--color-seccion-reading)',
  read:    'var(--color-seccion-read)',
  want:    'var(--color-seccion-want)',
  dropped: 'var(--color-seccion-dropped)',
}

// Cuánto separa una sección de la anterior.
export function huecoEntreSecciones(forma) {
  // Escritas enteras: Tailwind solo genera las clases que ve.
  const huecos = conCaja(forma)
    ? { compacta: 'space-y-3', normal: 'space-y-4', amplia: 'space-y-6' }
    : { compacta: 'space-y-5', normal: 'space-y-7', amplia: 'space-y-12' }
  return huecos[forma.densidad] || huecos.normal
}

// La caja que envuelve una sección entera.
// El marco de la tarjeta de la sección, para quien se pliega dentro de ella
// (Plegable, en Luniteca.jsx): así la tarjeta encoge y crece CON el telón, en
// vez de quedarse con su tamaño y cambiar de golpe al final. `extra`: lo que
// además encoge la tarjeta cuando se pliega la sección entera (la franja del
// título baja hasta el borde, ver .titulo-banda en index.css).
export const MarcoDeSeccion = createContext(null)

export function CajaSeccion({ variante: forma, estado = null, children }) {
  const marco = useRef(null)
  // Con franja, o con el título pegado dentro de la tarjeta, el título es una
  // banda que llega hasta los bordes de la tarjeta (titulo-banda).
  const conBanda = conCaja(forma) && (forma.titulo === 'franja' || forma.pegado)
  const valor = useMemo(() => ({ marco, extra: conBanda ? 16 : 0 }), [conBanda])
  if (!conCaja(forma)) return <section>{children}</section>
  // El fondo y el borde los pinta el Marco (tres piezas que encogen con
  // transform). La sección guarda el redondeo, que los títulos heredan.
  //
  // En "color", el borde va un poco del color de la sección: la tarjeta
  // entera se lee como suya, no solo la franja de arriba. En "mixto" el fondo
  // es opaco y no translúcido: su título se queda pegado por encima de los
  // libros de la propia sección, y con transparencia se verían pasar.
  const borde = forma.titulo === 'franja' ? mezcla(colorDe(estado), 28, 'var(--color-line)') : null
  const fondo = forma.caja === 'translucida' ? 'bg-surface/60' : 'bg-surface'
  return (
    <section data-caja-seccion className="relative isolate rounded-xl3 p-4">
      <Marco ref={marco} radio={28} fondo={fondo} borde={borde} />
      <MarcoDeSeccion.Provider value={valor}>{children}</MarcoDeSeccion.Provider>
    </section>
  )
}

// El título de una sección (o de un año dentro de "Leídos", más pequeño).
// `desde`: a qué altura se queda pegado el título. En la estantería propia hay
// una barra de herramientas fija de 56px y se pega justo debajo; en la de otra
// persona no la hay, así que se pega arriba del todo. Las clases van completas
// y no compuestas porque Tailwind solo se queda con las que ve escritas.
export function TituloSeccion({ variante: forma, label, cuenta, plegada, onAlternar, anidado = false, accion = null, desde = 'top-14', estado = null }) {
  const contenido = <Contenido forma={forma} label={label} cuenta={cuenta} plegada={plegada} hayChevron={!!onAlternar} anidado={anidado} estado={estado} />

  // Los títulos que se quedan pegados bajo la barra de herramientas (56px)
  // mientras se recorre su sección. Siempre con fondo propio: si no, los libros
  // se les ven por debajo al pasar.
  //
  // Solo la cabecera de la sección, nunca la del año: con las dos pegadas se
  // amontonaban una encima de otra al llegar la segunda, y se leía fatal
  // (visto en captura). El año pasa de largo con su contenido.
  //
  // Con caja, el título se pega DENTRO de su tarjeta: se despega solo cuando
  // la tarjeta sale de la pantalla, así que siempre se sabe de qué sección son
  // los libros que se están mirando, sin que el título de una sección se quede
  // colgado sobre la siguiente. Se estira hasta los bordes de la tarjeta con
  // márgenes negativos, para que tape de lado a lado.
  const caja = conCaja(forma)
  const franja = forma.titulo === 'franja'
  const pegar = forma.pegado ? `sticky ${desde} z-[5]` : ''
  const clasePegada = anidado
    ? ''
    : caja
      // Dentro de su tarjeta: la franja, o el título pegado, se estiran hasta
      // los bordes con márgenes negativos (el ancho va explícito: con -mx-4 y
      // w-full se quedaba corto por la derecha y asomaban los libros).
      ? franja
        ? `${pegar} -mx-4 -mt-4 w-[calc(100%+2rem)] rounded-t-[inherit] px-4 py-3`
        : forma.pegado
          // Fondo siempre opaco: pegado pasan los libros por debajo, también
          // con la caja translúcida.
          ? `${pegar} -mx-4 -mt-4 w-[calc(100%+2rem)] rounded-t-[inherit] border-b border-line bg-surface px-4 pb-2.5 pt-4`
          : ''
      // Sin caja: de lado a lado de la pantalla.
      : franja
        ? `${forma.pegado ? 'deja-la-barra deja-la-barra-ancho' : ''} ${pegar} -mx-5 w-[calc(100%+2.5rem)] px-5 py-2.5`
        : forma.pegado
          ? `deja-la-barra deja-la-barra-ancho ${pegar} -mx-5 w-[calc(100%+2.5rem)] border-b border-line bg-bg px-5 py-2.5`
          : ''

  // El ancho lo pone clasePegada cuando existe (necesita contar sus márgenes
  // negativos). No se puede dejar también w-full: las dos son la misma
  // propiedad y gana la que Tailwind ponga después en su hoja, no la que vaya
  // después en esta cadena — con w-full puesto, el título pegado se quedaba
  // corto por la derecha y por ahí asomaban los libros de detrás.
  // `titulo-banda`: el que es una franja dentro de su tarjeta. Con la sección
  // plegada del todo baja hasta el borde de abajo y se redondea como ella
  // (index.css): sin eso quedaba una tira de tarjeta debajo y sus esquinas
  // rectas asomaban por fuera de las redondas.
  const banda = !anidado && caja && (franja || forma.pegado) ? 'titulo-banda' : ''
  const base = `flex items-center gap-2 text-left ${banda} ${clasePegada || 'w-full'}`
  // Las cifras de arriba (Luniteca) bajan hasta aquí: `data-seccion` es a
  // dónde, y el margen es para que no quede debajo de la barra pegada.
  const ancla = anidado || !estado ? {} : { 'data-seccion': estado, style: { scrollMarginTop: 64 } }
  // La franja de color: opaca (mezcla de dos colores opacos), porque al
  // quedarse pegada pasan los libros por debajo.
  if (franja && !anidado) {
    ancla.style = { ...(ancla.style || {}), background: mezcla(colorDe(estado), 13, caja ? 'var(--color-surface)' : 'var(--color-bg)') }
  }

  // Pegado, el título ya no está en lo alto de su tarjeta sino en mitad: si
  // conserva las esquinas redondeadas de la tarjeta, por debajo asoma lo de
  // dentro (con la franja de color se veían dos esquinitas blancas). Así que
  // mientras está pegado, sin redondeo arriba.
  const nodo = useRef(null)
  const pegado = usarPegado(nodo, !anidado && caja && forma.pegado)
  if (pegado) {
    ancla.style = { ...(ancla.style || {}), borderTopLeftRadius: 0, borderTopRightRadius: 0 }
  }

  // La acción va FUERA del botón del título, en la misma fila: un botón dentro
  // de otro botón no es HTML válido y el navegador lo deshace por su cuenta.
  if (!onAlternar) {
    return (
      <div ref={nodo} className={base} {...ancla}>
        {contenido}
        {accion}
      </div>
    )
  }
  return (
    <div ref={nodo} className={base} {...ancla}>
      <button onClick={onAlternar} className="flex flex-1 items-center gap-2 text-left">
        {contenido}
      </button>
      {accion}
    </div>
  )
}

// Si un título "sticky" está pegado: en reposo está en lo alto de su tarjeta
// (a un pelo de su borde) y pegado se separa de él. Se mira al desplazar
// cualquier cosa (el scroll no burbujea, por eso en captura), una vez por
// fotograma como mucho.
function usarPegado(ref, activo) {
  const [pegado, setPegado] = useState(false)
  useEffect(() => {
    if (!activo) { setPegado(false); return }
    let pedido = 0
    const mirar = () => {
      pedido = 0
      const el = ref.current
      const caja = el?.parentElement
      if (!el || !caja) return
      setPegado(el.getBoundingClientRect().top - caja.getBoundingClientRect().top > 2)
    }
    const alMover = () => { if (!pedido) pedido = requestAnimationFrame(mirar) }
    mirar()
    document.addEventListener('scroll', alMover, { capture: true, passive: true })
    return () => {
      document.removeEventListener('scroll', alMover, { capture: true })
      if (pedido) cancelAnimationFrame(pedido)
    }
  }, [ref, activo])
  return pegado
}

function Contenido({ forma, label, cuenta, plegada, hayChevron, anidado, estado }) {
  const color = COLOR_DE_ESTADO[estado] || null
  // El punto va solo en la cabecera de la sección, no en la del año: dentro de
  // "Leídos" todos son leídos y repetirlo en cada año es ruido.
  const punto = color && !anidado
    ? <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
    : null
  // La línea que rellena toma un poco de ese color en vez de ser gris: es lo
  // que hace que la sección se lea como suya de un vistazo. Un poco, no del
  // todo — si fuera el color puro competiría con los propios libros.
  const linea = color
    ? { background: `color-mix(in srgb, ${color} 45%, var(--color-line))` }
    : undefined
  const tamano = anidado
    ? 'font-display text-base font-semibold'
    : 'font-display text-lg font-bold tracking-[-0.01em]'

  if (forma.titulo === 'franja') {
    const c = colorDe(estado)
    return (
      <>
        <span className={anidado ? 'font-display text-base font-semibold' : 'font-display text-lg font-bold tracking-[-0.01em]'}
          style={anidado ? undefined : { color: mezcla(c, 55, 'var(--color-ink)') }}>
          {label}
        </span>
        <span
          className="rounded-full px-2 py-px text-[11px] font-semibold tabular-nums"
          style={{ background: mezcla(c, anidado ? 12 : 22), color: mezcla(c, 75, 'var(--color-ink)') }}
        >
          {cuenta}
        </span>
        <span className="flex-1" />
        {hayChevron && (
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${anidado ? '' : 'bg-surface/70'}`}>
            <IconChevron className={`h-4 w-4 text-ink-mute transition-transform duration-200 ${plegada ? '' : 'rotate-180'}`} />
          </span>
        )}
      </>
    )
  }

  if (forma.titulo === 'pequeno') {
    return (
      <>
        {punto}
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
      {punto}
      <span className={tamano}>{label}</span>
      <span className="text-xs text-ink-mute">{cuenta}</span>
      {/* La línea que llena el hueco, solo con el título «con línea». */}
      {forma.titulo === 'linea'
        ? <span className="h-px flex-1 bg-line" style={linea} />
        : <span className="flex-1" />}
      {hayChevron && (
        <IconChevron className={`h-4 w-4 shrink-0 text-ink-mute transition-transform duration-200 ${plegada ? '' : 'rotate-180'}`} />
      )}
    </>
  )
}
