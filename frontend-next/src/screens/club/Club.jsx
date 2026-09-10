import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../../platform/api'
import { esAdmin as esElAdmin, useAuth } from '../../platform/auth'
import { useLiveUpdates } from '../../platform/live'
import { usarPreferencia } from '../../platform/preferencias'
import { useCapa } from '../../platform/capas'
import { EMPTY_FILTERS, generosDeAutores, opcionesDeFiltro } from '../luniteca/shelf'
import { BotonPlegarAnos, Coleccion, Herramientas, Plegable } from '../luniteca/Luniteca'
import { CajaSeccion, TituloSeccion, huecoEntreSecciones, usarSeparacion } from '../luniteca/separacion'
import { Cover } from '../luniteca/piezas'
import { colorDePortada, precargarColores } from '../luniteca/colorPortada'
import { usarVuelo } from '../luniteca/usarVuelo'
import HojaFiltros from '../luniteca/HojaFiltros'
import AnadirLibro from '../luniteca/AnadirLibro'
import { useHoja } from '../luniteca/HojaInferior'
import Avatar, { NombreJugador } from '../../ui/Avatar'
import { IconMarcador } from '../../ui/icons'
import { agruparClub, comoEntrada, fechaCorta, textoSesiones } from './clubShelf'
import ClubBookDetail from './ClubBookDetail'
import ObjetivoDeLectura from './ObjetivoDeLectura'

// La estantería del club de lectura.
//
// La idea, y lo que hace que esto sean 250 líneas y no otra app entera: **el
// club es una estantería más**. Se ve y se maneja exactamente igual que la
// tuya o la de cualquiera —las mismas tres vistas, la misma barra de
// herramientas, el mismo vuelo del libro al abrirlo, la misma ficha— solo que
// los libros no son de nadie y su estado lo lleva el club: propuesto, lectura
// actual, leído. La traducción entre un estado del club y uno de estantería
// vive en clubShelf.js.
//
// Solo entran los miembros del club. El backend ya lo impone
// (`require_club_member` devuelve 403), esto es para que quien no lo sea vea
// una explicación en vez de un error.

export default function Club() {
  const { player } = useAuth()
  const admin = esElAdmin(player)

  const [entradas, setEntradas] = useState(null)   // null = cargando
  const [error, setError] = useState(null)

  // La misma forma de mirar que tengas puesta en tu estantería: es tuya, no de
  // cada estantería (ver platform/preferencias).
  const [vista, setVista] = usarPreferencia('vista', 'grid')
  const [variante] = usarSeparacion()
  // Filtrar, ordenar y buscar aquí es cosa del momento: vive en la pantalla y
  // se deshace al salir, igual que en la estantería de otra persona.
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ field: '', dir: 'asc' })
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const hojaFiltros = useHoja()
  const hojaProponer = useHoja()
  const [plegadas, setPlegadas] = useState({ propuestos: false, leidos: false })
  const [anosPlegados, setAnosPlegados] = useState(() => new Set())

  const ficha = useCapa(null)
  const abierto = ficha.abierta
  // Igual que en la Luniteca: la ficha se queda montada con el último libro,
  // para no volver a levantarla en la siguiente apertura.
  const ultimaFicha = useRef(null)
  if (abierto) ultimaFicha.current = abierto
  const enFicha = abierto || ultimaFicha.current
  const { vuelo, abrirLibro, cerrarFicha, enVuelo, fueraId } = usarVuelo(ficha)

  const cargar = useCallback(async () => {
    try {
      const datos = await api('/shelf/club')
      const lista = (Array.isArray(datos) ? datos : []).map(comoEntrada)
      setEntradas(lista)
      // Si la ficha abierta ha cambiado (o la ha borrado el admin desde otro
      // sitio), se resincroniza o se cierra sola.
      ficha.reemplazar(prev => prev ? (lista.find(x => x.id === prev.id) || null) : prev)
      setError(null)
    } catch (err) {
      setEntradas([])
      setError(err.message || 'No se ha podido cargar la estantería del club')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Todo lo que cambia lo que se ve en esta lista: un libro propuesto o
  // activado ('club'), sus datos ('books'), una puntuación nueva —que mueve la
  // media que sale sobre la portada— y una sesión, que mueve su cuenta.
  useLiveUpdates(['club', 'books', 'votes', 'sessions'], cargar)

  const grupos = useMemo(
    () => agruparClub(entradas, { filters, query, sort }),
    [entradas, filters, query, sort],
  )
  const opciones = useMemo(() => opcionesDeFiltro(entradas), [entradas])
  const generosDeAutor = useMemo(() => generosDeAutores(entradas || []), [entradas])
  const filtrosActivos = Object.keys(EMPTY_FILTERS).some(k => filters[k] !== EMPTY_FILTERS[k])

  // Los colores de los lomos se van leyendo en cuanto se sabe qué libros hay,
  // aunque la vista sea otra, igual que en la Luniteca.
  useEffect(() => {
    if (!entradas?.length) return
    return precargarColores(entradas.map(e => e.book?.cover_url))
  }, [entradas])

  const alternar = clave => setPlegadas(p => ({ ...p, [clave]: !p[clave] }))
  const alternarAno = useCallback(year => setAnosPlegados(prev => {
    const s = new Set(prev)
    s.has(year) ? s.delete(year) : s.add(year)
    return s
  }), [])

  const propuesto = useCallback(() => { hojaProponer.cerrar(); cargar() }, [cargar, hojaProponer])

  if (!player?.club_member) return <SinAcceso />

  if (entradas === null) return <Cargando />

  return (
    <div className="py-6">
      <header className="mb-4">
        <h2 className="font-display text-[1.75rem] font-bold tracking-[-0.02em]">Club de lectura</h2>
        <p className="mt-1 text-sm text-ink-dim">
          {grupos.vacia
            ? 'Todavía no hay ningún libro en el club'
            : resumen(grupos)}
        </p>
      </header>

      {/* Las MISMAS herramientas que en tu estantería. Lo que aquí añade el
          botón no es un libro tuyo: es una propuesta para el club, y lo puede
          hacer cualquier miembro, no solo el admin. */}
      <Herramientas
        vista={vista}
        onVista={v => startTransition(() => setVista(v))}
        query={query}
        onQuery={setQuery}
        onAbrirHoja={hojaFiltros.abrir}
        onAnadir={hojaProponer.abrir}
        etiquetaAnadir="Proponer un libro"
        ordenActivo={!!sort.field}
        filtrosActivos={filtrosActivos}
      />

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      {grupos.vacia && !error && (
        <Aviso
          titulo="El club está por estrenar"
          texto="Toca el + de arriba para proponer el primer libro. Cualquiera del club puede proponer; el admin decide cuál se lee."
        />
      )}

      {grupos.ningunoVisible && (
        <Aviso titulo="Ningún libro coincide" texto="Prueba a quitar algún filtro o a cambiar la búsqueda." />
      )}

      <div className={`mt-5 ${huecoEntreSecciones(variante)}`}>
        {grupos.actual.length > 0 && (
          <CajaSeccion variante={variante}>
            <TituloSeccion variante={variante} label="Lectura actual" cuenta={grupos.actual.length} estado="reading" />
            <div className="mt-3 space-y-2">
              {grupos.actual.map(e => (
                <TarjetaLecturaActual
                  key={e.id}
                  entrada={e}
                  esAdmin={admin}
                  onAbrir={abrirLibro}
                  onCambiado={cargar}
                  fuera={e.id === fueraId}
                />
              ))}
            </div>
          </CajaSeccion>
        )}

        {grupos.propuestos.length > 0 && (
          <CajaSeccion variante={variante}>
            <TituloSeccion
              variante={variante}
              label="Propuestos"
              cuenta={grupos.propuestos.length}
              estado="want"
              plegada={plegadas.propuestos}
              onAlternar={() => alternar('propuestos')}
            />
            <Plegable abierta={!plegadas.propuestos}>
              <div className="pt-3">
                <Coleccion entries={grupos.propuestos} vista={vista} onAbrir={abrirLibro} fueraId={fueraId} generosDeAutor={generosDeAutor} />
              </div>
            </Plegable>
          </CajaSeccion>
        )}

        {grupos.leidosPorAno.length > 0 && (
          <CajaSeccion variante={variante}>
            <TituloSeccion
              variante={variante}
              label="Leídos"
              estado="read"
              cuenta={grupos.leidosPorAno.reduce((n, g) => n + g.items.length, 0)}
              plegada={plegadas.leidos}
              onAlternar={() => alternar('leidos')}
              accion={!plegadas.leidos && grupos.years.length > 1 && (
                <BotonPlegarAnos
                  todosPlegados={grupos.years.every(y => anosPlegados.has(y))}
                  onAlternar={() => setAnosPlegados(prev => (
                    grupos.years.every(y => prev.has(y)) ? new Set() : new Set(grupos.years)
                  ))}
                />
              )}
            />
            <Plegable abierta={!plegadas.leidos}>
              <div className="space-y-5 pt-3">
                {grupos.leidosPorAno.map(({ year, items }) => (
                  <div key={year}>
                    <TituloSeccion
                      variante={variante}
                      anidado
                      label={year === 'sin-fecha' ? 'Sin fecha' : year}
                      cuenta={items.length}
                      plegada={anosPlegados.has(year)}
                      onAlternar={() => alternarAno(year)}
                    />
                    <Plegable abierta={!anosPlegados.has(year)}>
                      <div className="pt-2">
                        <Coleccion entries={items} vista={vista} onAbrir={abrirLibro} fueraId={fueraId} generosDeAutor={generosDeAutor} />
                      </div>
                    </Plegable>
                  </div>
                ))}
              </div>
            </Plegable>
          </CajaSeccion>
        )}
      </div>

      <AnimatePresence>
        {hojaProponer.abierta && (
          <AnadirLibro destino="club" onCerrar={hojaProponer.cerrar} onAnadido={propuesto} />
        )}
      </AnimatePresence>

      <HojaFiltros
        abierta={hojaFiltros.abierta}
        onCerrar={hojaFiltros.cerrar}
        sort={sort} onSort={setSort}
        filters={filters} onFilters={setFilters}
        opciones={opciones}
        visibles={grupos.visible.length}
      />

      {enFicha && (
        <ClubBookDetail
          entrada={enFicha}
          abierta={!!abierto}
          esAdmin={admin}
          vuelo={vuelo}
          onCerrar={cerrarFicha}
          onCambiado={cargar}
          onEliminada={() => { cerrarFicha(); cargar() }}
        />
      )}

      {enVuelo}
    </div>
  )
}

// ─── La lectura actual ─────────────────────────────────────────────────────
// El único libro que el club está leyendo ahora mismo va aparte y más grande:
// es a lo que se entra a mirar. No lleva barra de progreso —el club no tiene
// una página por la que va, cada uno va por la suya— sino lo que sí es del
// club: hasta dónde hay que leer para la próxima quedada, desde cuándo, quién
// lo propuso y cuántas sesiones lleva.
//
// Lo de "hasta dónde" va DENTRO de la tarjeta y no solo en la ficha porque es
// justo lo que se viene a mirar entre quedada y quedada, y bajar a la ficha
// para leer un número es un toque de más en la única pregunta que se repite.
function TarjetaLecturaActual({ entrada, esAdmin, onAbrir, onCambiado, fuera = false }) {
  const club = entrada.club
  const libro = entrada.book
  // Se tiñe del color de su propia portada, igual que las tarjetas de
  // "Leyendo" de tu estantería: el libro que se está leyendo se siente como
  // ESE libro y no como una ficha más. Llega después (hay que descargar la
  // portada y mirarla), así que nace neutra y se tiñe con una transición.
  const [paleta, setPaleta] = useState(null)
  useEffect(() => {
    let vigente = true
    colorDePortada(libro.cover_url).then(p => { if (vigente && p) setPaleta(p) })
    return () => { vigente = false }
  }, [libro.cover_url])
  const tinte = paleta
    ? {
        backgroundColor: `color-mix(in srgb, ${paleta.color} var(--tinte-libro), var(--color-surface))`,
        borderColor: `color-mix(in srgb, ${paleta.color} var(--tinte-libro-borde), var(--color-line))`,
      }
    : undefined

  const desde = fechaCorta(club.activated_at)
  const sesiones = textoSesiones(club.session_count)

  // Sin nodo en onAbrir a propósito: el vuelo saca un LOMO de la balda y lo
  // pone de cara, y aquí lo que hay es una tarjeta ancha con la portada ya de
  // frente. La ficha sube como siempre, igual que al abrir desde la tarjeta de
  // "Leyendo" de tu estantería.
  return (
    <button
      onClick={() => onAbrir(entrada)}
      style={tinte}
      className={`flex w-full items-stretch gap-3 rounded-xl2 border border-line bg-surface p-3 text-left transition-[transform,background-color,border-color] duration-300 active:scale-[0.985] ${fuera ? 'invisible' : ''}`}
    >
      <div className="w-16 shrink-0">
        <Cover url={libro.cover_url} title={libro.title} priority />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
            <IconMarcador className="h-3 w-3" />
            Leyendo ahora
          </p>
          <p className="mt-1 truncate font-display text-base font-semibold leading-tight">{libro.title}</p>
          <p className="mt-0.5 truncate text-xs text-ink-mute">{libro.author || 'Sin autor'}</p>
        </div>
        {/* Las señas del libro, todas en la misma línea y del mismo tamaño. El
            objetivo va el primero y en color: es lo único de aquí que cambia
            cada dos semanas y lo que se viene a mirar. Si no hay ninguno
            puesto no se enseña nada — ver ObjetivoDeLectura.

            Los puntos de separación se intercalan solos entre lo que haya, en
            vez de ir escritos a mano delante de cada seña: escritos a mano,
            cualquier seña que faltara dejaba su punto suelto (o, como pasó con
            el objetivo, se olvidaba el suyo). */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-mute">
          {senasDelLibro({ club, libro, esAdmin, onCambiado, desde, sesiones })}
        </div>
      </div>
    </button>
  )
}

// Lo que se sabe del libro que está leyendo el club, en una fila: hasta qué
// página hay que leer, desde cuándo lo lleva el club, cuántas sesiones y quién
// lo propuso. Solo lo que exista, con un punto entre medias.
function senasDelLibro({ club, libro, esAdmin, onCambiado, desde, sesiones }) {
  const senas = [
    <ObjetivoDeLectura
      key="objetivo"
      club={club}
      libro={libro}
      esAdmin={esAdmin}
      onCambiado={onCambiado}
      variante="tarjeta"
    />,
    desde && <span key="desde">Desde el {desde}</span>,
    sesiones && <span key="sesiones">{sesiones}</span>,
    club.proposed_by && (
      <span key="quien" className="inline-flex items-center gap-1">
        <Avatar jugador={club.proposed_by} size={14} />
        <NombreJugador jugador={club.proposed_by} />
      </span>
    ),
  ].filter(Boolean)

  // El objetivo se quita solo cuando no hay ninguno puesto (devuelve null), y
  // eso no se puede saber desde aquí: se detecta mirando el dato, que es el
  // mismo que usa el componente para decidirlo.
  const visibles = club.next_page ? senas : senas.filter(x => x.key !== 'objetivo')

  return visibles.flatMap((seña, i) => (
    i === 0 ? [seña] : [<span key={`sep-${i}`} aria-hidden>·</span>, seña]
  ))
}

// ─── Estados de la pantalla ────────────────────────────────────────────────
function resumen(grupos) {
  const leidos = grupos.leidosPorAno.reduce((n, g) => n + g.items.length, 0)
  const partes = []
  if (leidos) partes.push(`${leidos} ${leidos === 1 ? 'libro leído' : 'libros leídos'}`)
  if (grupos.propuestos.length) partes.push(`${grupos.propuestos.length} propuesto${grupos.propuestos.length === 1 ? '' : 's'}`)
  return partes.join(' · ') || 'Sin libros que enseñar con estos filtros'
}

function Cargando() {
  return (
    <div className="py-6">
      <div className="h-8 w-52 animate-pulse rounded-md bg-surface-2" />
      <div className="mt-6 h-24 animate-pulse rounded-xl2 bg-surface-2" />
      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] animate-pulse rounded-md bg-surface-2" />
        ))}
      </div>
    </div>
  )
}

function Aviso({ titulo, texto }) {
  return (
    <div className="mt-5 rounded-xl2 border border-line bg-surface px-4 py-5">
      <p className="font-display text-lg font-semibold">{titulo}</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-dim">{texto}</p>
    </div>
  )
}

// Quien no es del club no debería ni ver la entrada en el menú, pero la URL se
// puede escribir a mano: aquí se explica en vez de enseñar el 403 pelado del
// servidor.
function SinAcceso() {
  return (
    <div className="py-8">
      <h2 className="font-display text-[1.75rem] font-bold tracking-[-0.02em]">Club de lectura</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-dim">
        Esta parte es solo para quien esté en el club de lectura. Si crees que deberías estar,
        pídeselo al admin: es él quien da el acceso.
      </p>
    </div>
  )
}
