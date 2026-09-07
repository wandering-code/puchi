import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '../../platform/auth'
import { api } from '../../platform/api'
import { useLiveUpdates } from '../../platform/live'
import { EMPTY_FILTERS, agruparEstanteria, opcionesDeFiltro, readingDatesLabel } from './shelf'
import { Cover, NotaBadge, PagesLabel, ProgressBar, StarRating } from './piezas'
import BookDetail from './BookDetail'
import {
  IconChevron, IconFilter, IconGrid, IconList, IconSearch, IconX,
} from '../../ui/icons'
import HojaFiltros from './HojaFiltros'
import { useHoja } from './HojaInferior'
import { useCapa } from '../../platform/capas'


export default function Luniteca() {
  const { player } = useAuth()
  const [shelf, setShelf] = useState(null)      // null = cargando
  const ficha = useCapa(null)            // la entrada abierta, o null
  const abierto = ficha.abierta
  const [error, setError] = useState(null)

  const [vista, setVista] = useState(() => localStorage.getItem('luni_vista') || 'grid')
  const [query, setQuery] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [sort, setSort] = useState({ field: '', dir: 'asc' })
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const hojaFiltros = useHoja()
  const [plegadas, setPlegadas] = useState({ want: false, read: false, dropped: true })
  const [anosPlegados, setAnosPlegados] = useState(() => new Set())

  const cargar = useCallback(async () => {
    try {
      const datos = await api(`/shelf/personal?player_id=${player.id}`)
      const lista = Array.isArray(datos) ? datos : []
      setShelf(lista)
      // Si la ficha abierta se ha borrado desde otro sitio, se cierra sola; si
      // ha cambiado, se resincroniza con la versión fresca.
      ficha.reemplazar(prev => prev ? (lista.find(x => x.id === prev.id) || null) : prev)
      setError(null)
    } catch (err) {
      setShelf([])
      setError(err.message || 'No se pudo cargar la estantería')
    }
  }, [player.id])

  useEffect(() => { cargar() }, [cargar])

  // Un cambio hecho desde otro dispositivo — o desde la Puchi actual, que
  // escribe en la misma base de datos — se ve aquí sin recargar.
  useLiveUpdates(['shelf', 'books'], cargar)

  // Optimista: la tarjeta y la ficha reflejan el cambio al instante (importa
  // sobre todo al puntuar arrastrando el dedo), y si el PATCH falla se
  // revierte — nunca se queda enseñando un dato que no llegó a guardarse.
  const actualizarEntrada = useCallback(async (id, patch) => {
    const anterior = shelf?.find(x => x.id === id)
    const aplicar = (lista) => lista.map(x => x.id === id ? { ...x, ...patch } : x)
    setShelf(prev => prev && aplicar(prev))
    ficha.reemplazar(prev => prev?.id === id ? { ...prev, ...patch } : prev)
    try {
      const fresca = await api(`/shelf/personal/${id}`, { method: 'PATCH', body: patch })
      setShelf(prev => prev && prev.map(x => x.id === id ? fresca : x))
      ficha.reemplazar(prev => prev?.id === id ? fresca : prev)
    } catch {
      if (!anterior) return
      setShelf(prev => prev && prev.map(x => x.id === id ? anterior : x))
      ficha.reemplazar(prev => prev?.id === id ? anterior : prev)
    }
  }, [shelf])

  // Mientras la ficha está abierta, la portada de su tarjeta en la estantería
  // NO puede llevar el layoutId compartido: con dos elementos que dicen ser el
  // mismo montados a la vez, Motion los reconcilia en cada render y la portada
  // de la ficha da un salto cada vez que se toca cualquier cosa (puntuar, por
  // ejemplo). Solo lo lleva mientras dura el viaje de ida o de vuelta.
  const [enTransicion, setEnTransicion] = useState(null)
  useEffect(() => {
    if (enTransicion == null) return
    const t = setTimeout(() => setEnTransicion(null), 420)
    return () => clearTimeout(t)
  }, [enTransicion])

  const abrirLibro = useCallback((entrada) => {
    setEnTransicion(entrada.id)
    ficha.abrir(entrada)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function cerrarFicha(opciones) {
    if (abierto) setEnTransicion(abierto.id)
    ficha.cerrar(opciones)
  }

  const grupos = useMemo(
    () => agruparEstanteria(shelf, { filters, query, sort }),
    [shelf, filters, query, sort],
  )
  const opciones = useMemo(() => opcionesDeFiltro(shelf), [shelf])

  function cambiarVista(modo) {
    localStorage.setItem('luni_vista', modo)
    setVista(modo)
  }

  // Todos estos van con useCallback porque se pasan a componentes memoizados
  // (las secciones y las tarjetas): si fueran flechas inline, serían una
  // referencia nueva en cada render de esta pantalla y el memo no serviría de
  // nada. Medido: sin esto, cambiar de vista bloqueaba 752 ms con 300 libros.
  const alternarAno = useCallback((year) => {
    setAnosPlegados(prev => {
      const siguiente = new Set(prev)
      siguiente.has(year) ? siguiente.delete(year) : siguiente.add(year)
      return siguiente
    })
  }, [])
  const alternarWant    = useCallback(() => setPlegadas(p => ({ ...p, want: !p.want })), [])
  const alternarRead    = useCallback(() => setPlegadas(p => ({ ...p, read: !p.read })), [])
  const alternarDropped = useCallback(() => setPlegadas(p => ({ ...p, dropped: !p.dropped })), [])
  // abrirLibro va con useCallback por lo mismo: la tarjeta memoizada lo llama
  // como onAbrir(entrada) desde dentro.

  if (shelf === null) return <Cargando />

  return (
    <div className="py-6">
      <header className="mb-4">
        <h2 className="font-display text-[1.75rem] font-bold tracking-[-0.02em]">Luniteca</h2>
        <p className="mt-1 text-sm text-ink-dim">
          {grupos.vacia
            ? 'Tu estantería está vacía'
            : `${shelf.length} ${shelf.length === 1 ? 'libro' : 'libros'} en tu estantería`}
        </p>
      </header>

      <Herramientas
        vista={vista} onVista={cambiarVista}
        query={query} onQuery={setQuery}
        buscando={buscando} onBuscando={setBuscando}
        onAbrirHoja={hojaFiltros.abrir}
        ordenActivo={!!sort.field}
        filtrosActivos={grupos.filtrosActivos}
      />

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      {grupos.vacia && !error && (
        <Aviso
          titulo="Todavía no hay nada aquí"
          texto="Los libros se añaden desde la Puchi actual mientras esta versión no tenga su propio buscador. Los que añadas ahí aparecen aquí solos."
        />
      )}

      {grupos.ningunoVisible && (
        <Aviso
          titulo="Ningún libro coincide"
          texto="Prueba a quitar algún filtro o a cambiar la búsqueda."
        />
      )}

      <div className="mt-5 space-y-7">
        {grupos.reading.length > 0 && (
          <section>
            <TituloSeccion label="Leyendo" cuenta={grupos.reading.length} />
            <div className="mt-3 space-y-2">
              {grupos.reading.map(e => (
                <TarjetaLeyendo key={e.id} entry={e} onAbrir={abrirLibro} activa={enTransicion === e.id} />
              ))}
            </div>
          </section>
        )}

        {grupos.readYearGroups.length > 0 && (
          <section>
            <TituloSeccion
              label="Leídos"
              cuenta={grupos.readYearGroups.reduce((n, g) => n + g.items.length, 0)}
              plegada={plegadas.read}
              onAlternar={alternarRead}
            />
            <Plegable abierta={!plegadas.read}>
              <div className="space-y-5 pt-3">
                {grupos.readYearGroups.map(({ year, items }) => (
                  <div key={year}>
                    <button
                      onClick={() => alternarAno(year)}
                      className="mb-2 flex w-full items-center gap-2 text-left"
                    >
                      <span className="font-display text-base font-semibold">
                        {year === 'sin-fecha' ? 'Sin fecha' : year}
                      </span>
                      <span className="text-xs text-ink-mute">{items.length}</span>
                      <span className="h-px flex-1 bg-line" />
                      <IconChevron
                        className={`h-4 w-4 shrink-0 text-ink-mute transition-transform duration-200 ${anosPlegados.has(year) ? '' : 'rotate-180'}`}
                      />
                    </button>
                    <Plegable abierta={!anosPlegados.has(year)}>
                      <Coleccion entries={items} vista={vista} onAbrir={abrirLibro} abiertaId={enTransicion} />
                    </Plegable>
                  </div>
                ))}
              </div>
            </Plegable>
          </section>
        )}

        <SeccionPlegable
          label="Por leer" entries={grupos.want} vista={vista}
          plegada={plegadas.want}
          onAlternar={alternarWant}
          onAbrir={abrirLibro}
          abiertaId={enTransicion}
        />

        <SeccionPlegable
          label="Dropeados" entries={grupos.dropped} vista={vista}
          plegada={plegadas.dropped}
          onAlternar={alternarDropped}
          onAbrir={abrirLibro}
          abiertaId={enTransicion}
        />
      </div>

      <HojaFiltros
        abierta={hojaFiltros.abierta}
        onCerrar={hojaFiltros.cerrar}
        sort={sort} onSort={setSort}
        filters={filters} onFilters={setFilters}
        opciones={opciones}
        visibles={grupos.visible.length}
      />

      <AnimatePresence>
        {abierto && (
          <BookDetail
            entry={abierto}
            carpetas={opciones.carpetas}
            onCerrar={cerrarFicha}
            onActualizar={patch => actualizarEntrada(abierto.id, patch)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function Cargando() {
  return (
    <div className="py-6">
      <div className="h-8 w-40 animate-pulse rounded-md bg-surface-2" />
      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {Array.from({ length: 9 }).map((_, i) => (
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

// ─── Barra de herramientas ─────────────────────────────────────────────────
function Herramientas({
  vista, onVista, query, onQuery, buscando, onBuscando,
  onAbrirHoja, ordenActivo, filtrosActivos,
}) {
  // Se queda pegada arriba al bajar por una estantería larga: con 300 libros,
  // volver arriba solo para filtrar es la diferencia entre usarlo y no usarlo.
  return (
    <div className="sticky top-0 z-20 -mx-5 border-b border-line bg-bg/85 px-5 py-2 backdrop-blur-xl">
      {/* Al buscar, el campo ocupa la fila entera y el resto de botones se
          van: antes la barra se desplegaba DEBAJO y empujaba la estantería,
          que es el mismo salto que ya se quitó de los filtros. La lupa se
          queda fija en su sitio y el campo crece a partir de ella.
          mode="popLayout": lo que sale deja de ocupar sitio en cuanto empieza
          a irse, así que lo que entra ocupa su hueco con un solo movimiento en
          vez de esperar a que termine la salida. */}
      <div className="flex items-center gap-1">
        <BotonHerramienta
          activo={buscando}
          onClick={() => { onBuscando(!buscando); if (buscando) onQuery('') }}
          etiqueta={buscando ? 'Cerrar búsqueda' : 'Buscar'}
        >
          <IconSearch className="h-[18px] w-[18px]" />
        </BotonHerramienta>

        <AnimatePresence initial={false} mode="popLayout">
          {buscando ? (
            <motion.div
              key="campo"
              layout
              className="flex min-w-0 flex-1 items-center gap-2 rounded-xl2 border border-line bg-surface px-3"
              // Crece desde la izquierda (originX 0), que es donde está la
              // lupa: así parece que el campo sale de ella y no que aparece
              // una caja nueva centrada.
              initial={{ opacity: 0, scaleX: 0.6 }}
              animate={{ opacity: 1, scaleX: 1 }}
              exit={{ opacity: 0, scaleX: 0.6 }}
              style={{ originX: 0 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            >
              <input
                autoFocus
                value={query}
                onChange={e => onQuery(e.target.value)}
                placeholder="Título o autor"
                className="h-10 w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-ink-mute"
              />
              <AnimatePresence>
                {query && (
                  <motion.button
                    onClick={() => onQuery('')}
                    aria-label="Limpiar"
                    className="shrink-0 p-1 text-ink-mute"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.15 }}
                  >
                    <IconX className="h-4 w-4" />
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="acciones"
              layout
              className="flex flex-1 items-center gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Un solo botón para filtrar y ordenar: los dos viven en la
                  misma hoja, así que dos botones que abren lo mismo solo
                  confunden. */}
              <BotonHerramienta
                activo={filtrosActivos || ordenActivo}
                onClick={onAbrirHoja}
                etiqueta="Filtrar y ordenar"
              >
                <IconFilter className="h-[18px] w-[18px]" />
                {(filtrosActivos || ordenActivo) && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
                )}
              </BotonHerramienta>

              <div className="flex-1" />

              {/* Píldora dentro de píldora: las dos redondeadas del todo, que
                  con radios distintos la selección se salía por las esquinas. */}
              <div className="flex items-center rounded-full border border-line p-1">
                {[['grid', IconGrid, 'Cuadrícula'], ['list', IconList, 'Lista']].map(([modo, Icono, etiqueta]) => (
                  <button
                    key={modo}
                    onClick={() => onVista(modo)}
                    aria-label={etiqueta}
                    aria-pressed={vista === modo}
                    className="relative flex h-8 w-10 items-center justify-center"
                  >
                    {vista === modo && (
                      <motion.span
                        layoutId="luni-vista"
                        className="absolute inset-0 rounded-full bg-accent-soft"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                    <Icono className={`relative h-[15px] w-[15px] ${vista === modo ? 'text-accent' : 'text-ink-mute'}`} />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function BotonHerramienta({ activo, onClick, etiqueta, children }) {
  return (
    <button
      onClick={onClick}
      aria-label={etiqueta}
      aria-pressed={activo}
      className={`relative flex h-10 w-10 items-center justify-center rounded-xl2 transition-colors ${
        activo ? 'bg-accent-soft text-accent' : 'text-ink-dim active:bg-surface-2'
      }`}
    >
      {children}
    </button>
  )
}

// Alto animado con `height: auto`, que motion sí sabe interpolar. Lo que entra
// y sale se anima; nada aparece de golpe.
function Plegable({ abierta, children }) {
  return (
    <AnimatePresence initial={false}>
      {abierta && (
        <motion.div
          className="overflow-hidden"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Secciones ─────────────────────────────────────────────────────────────
function TituloSeccion({ label, cuenta, plegada, onAlternar }) {
  const contenido = (
    <>
      <span className="font-display text-lg font-semibold tracking-[-0.01em]">{label}</span>
      <span className="text-xs text-ink-mute">{cuenta}</span>
      <span className="h-px flex-1 bg-line" />
      {onAlternar && (
        <IconChevron className={`h-4 w-4 shrink-0 text-ink-mute transition-transform duration-200 ${plegada ? '' : 'rotate-180'}`} />
      )}
    </>
  )
  if (!onAlternar) return <div className="flex items-center gap-2">{contenido}</div>
  return (
    <button onClick={onAlternar} className="flex w-full items-center gap-2 text-left">
      {contenido}
    </button>
  )
}

const SeccionPlegable = memo(function SeccionPlegable({ label, entries, vista, plegada, onAlternar, onAbrir, abiertaId }) {
  if (entries.length === 0) return null
  return (
    <section>
      <TituloSeccion label={label} cuenta={entries.length} plegada={plegada} onAlternar={onAlternar} />
      <Plegable abierta={!plegada}>
        <div className="pt-3">
          <Coleccion entries={entries} vista={vista} onAbrir={onAbrir} abiertaId={abiertaId} />
        </div>
      </Plegable>
    </section>
  )
})

const Coleccion = memo(function Coleccion({ entries, vista, onAbrir, abiertaId }) {
  if (vista === 'list') {
    return (
      <div className="divide-y divide-[color:var(--color-line)]">
        {entries.map(e => <FilaLibro key={e.id} entry={e} onAbrir={onAbrir} activa={abiertaId === e.id} />)}
      </div>
    )
  }
  // Columnas por ancho disponible en vez de por breakpoints fijos: el número
  // sale solo y las portadas se reparten lo que hay, sin recortarse — la
  // proporción 2/3 la sigue fijando Cover, aquí solo cambia cuánto miden.
  //
  // El mínimo es 68px y no un número redondo cualquiera: sale de medir los
  // anchos reales. Con 76px un iPhone SE (375) solo admitía TRES columnas y
  // las portadas se estiraban a 104px — enormes justo en la pantalla más
  // pequeña — mientras que un Pro Max sacaba cuatro de 89px. Con 68 salen
  // cuatro en el SE (75px), cuatro en un 14 (79px) y cinco en los Plus y Pro
  // Max (68px): todas las pantallas quedan entre 68 y 79px, que es lo que hace
  // que la app se vea igual en cualquier móvil en vez de depender de si el
  // ancho llega justo al siguiente salto de columna.
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(68px,1fr))] gap-3">
      {entries.map(e => <PortadaLibro key={e.id} entry={e} onAbrir={onAbrir} activa={abiertaId === e.id} />)}
    </div>
  )
})

// El botón es HTML normal y el "hundido" al tocar es una transición CSS, no
// whileTap: con 300 libros en pantalla, 300 componentes de motion cuestan
// medido 100 ms de bloqueo por cada tecla escrita en el buscador y ~280 ms del
// cambio de vista. Solo la portada que se está abriendo se convierte en un
// motion.div con layoutId, que es la única que necesita animar hasta la ficha
// — y `activa` es un booleano, así que las otras 299 no se re-renderizan al
// abrir una (el memo las compara: false seguía siendo false).
function PortadaAnimable({ entry, activa, className, children }) {
  if (!activa) return <div className={className}>{children}</div>
  return <motion.div layoutId={`portada-${entry.id}`} className={className}>{children}</motion.div>
}

const PortadaLibro = memo(function PortadaLibro({ entry, onAbrir, activa }) {
  return (
    /* Sin título debajo: la portada ya dice qué libro es, y quien quiera
       comprobarlo entra en la ficha. De paso, todas las celdas miden
       exactamente lo mismo — la portada — así que ninguna fila puede
       descuadrarse. El título va en aria-label, que si no el botón se queda
       sin nombre para un lector de pantalla. */
    <button
      onClick={() => onAbrir(entry)}
      aria-label={entry.book.title}
      className="transition-transform duration-150 active:scale-[0.96]"
    >
      <PortadaAnimable entry={entry} activa={activa} className="relative">
        <Cover url={entry.book.cover_url} title={entry.book.title} className="shadow-sm" />
        <NotaBadge rating={entry.rating} />
      </PortadaAnimable>
    </button>
  )
})

const FilaLibro = memo(function FilaLibro({ entry, onAbrir, activa }) {
  // Las fechas de lectura, cuando las hay: en la lista hay sitio para ellas y
  // es lo que se viene a mirar cuando se pasa a esta vista. Van en su propia
  // línea y no pegadas al autor, para que un autor largo no se las coma al
  // truncar. Mismo texto que en la ficha y en las tarjetas de "Leyendo"
  // ("inicio – fin", con "¿?" en el lado que falte), así que no hay dos
  // formas distintas de escribir lo mismo por la app.
  const fechas = readingDatesLabel(entry)
  return (
    <button
      onClick={() => onAbrir(entry)}
      className="flex w-full items-center gap-3 py-2.5 text-left transition-transform duration-150 active:scale-[0.99]"
    >
      <PortadaAnimable entry={entry} activa={activa} className="w-10 shrink-0">
        <Cover url={entry.book.cover_url} />
      </PortadaAnimable>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] leading-tight">{entry.book.title}</p>
        <p className="mt-0.5 truncate text-xs text-ink-mute">{entry.book.author || 'Sin autor'}</p>
        {fechas && <p className="mt-0.5 truncate text-[10px] leading-tight text-ink-mute/80">{fechas}</p>}
      </div>
      {/* La puntuación en estrellas, con las medias de verdad (el relleno se
          recorta al porcentaje, no se redondea al entero). Aquí sí caben y se
          leen; en la cuadrícula sigue siendo un número porque sobre una
          portada de 68px cinco estrellas no se distinguen.
          Sin punto de estado: cada sección de la lista es de un solo estado y
          su título ya lo dice. */}
      {entry.rating > 0 && <StarRating rating={entry.rating} size={11} className="shrink-0" />}
    </button>
  )
})

// Lo que se está leyendo va aparte y más grande: es lo que se viene a mirar.
const TarjetaLeyendo = memo(function TarjetaLeyendo({ entry, onAbrir, activa }) {
  const fechas = readingDatesLabel(entry)
  return (
    <button
      onClick={() => onAbrir(entry)}
      className="flex w-full items-stretch gap-3 rounded-xl2 border border-line bg-surface p-3 text-left transition-transform duration-150 active:scale-[0.985]"
    >
      <PortadaAnimable entry={entry} activa={activa} className="w-14 shrink-0">
        <Cover url={entry.book.cover_url} priority />
      </PortadaAnimable>
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold leading-tight">{entry.book.title}</p>
          <p className="mt-0.5 truncate text-xs text-ink-mute">{entry.book.author || 'Sin autor'}</p>
        </div>
        <div className="mt-2">
          <ProgressBar entry={entry} />
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-ink-mute">
            <span className="truncate">{fechas}</span>
            <span className="shrink-0"><PagesLabel entry={entry} /></span>
          </div>
        </div>
      </div>
    </button>
  )
})
