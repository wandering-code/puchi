import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '../../platform/auth'
import { api } from '../../platform/api'
import { useLiveUpdates } from '../../platform/live'
import {
  EMPTY_FILTERS, MAX_PAGES_OPTIONS, SORT_FIELDS,
  agruparEstanteria, opcionesDeFiltro, readingDatesLabel,
} from './shelf'
import { Cover, PagesLabel, ProgressBar, StarRating, StatusDot } from './piezas'
import BookDetail from './BookDetail'
import {
  IconChevron, IconFilter, IconGrid, IconList, IconSearch, IconSort, IconX,
} from '../../ui/icons'

export default function Luniteca() {
  const { player } = useAuth()
  const [shelf, setShelf] = useState(null)      // null = cargando
  const [abierto, setAbierto] = useState(null)  // entrada abierta en la ficha
  const [error, setError] = useState(null)

  const [vista, setVista] = useState(() => localStorage.getItem('luni_vista') || 'grid')
  const [query, setQuery] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [sort, setSort] = useState({ field: '', dir: 'asc' })
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [panel, setPanel] = useState(null)      // null | 'filtros' | 'orden'
  const [plegadas, setPlegadas] = useState({ want: false, read: false, dropped: true })
  const [anosPlegados, setAnosPlegados] = useState(() => new Set())

  const cargar = useCallback(async () => {
    try {
      const datos = await api(`/shelf/personal?player_id=${player.id}`)
      const lista = Array.isArray(datos) ? datos : []
      setShelf(lista)
      // Si la ficha abierta se ha borrado desde otro sitio, se cierra sola; si
      // ha cambiado, se resincroniza con la versión fresca.
      setAbierto(prev => prev ? (lista.find(x => x.id === prev.id) || null) : prev)
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
    setAbierto(prev => prev?.id === id ? { ...prev, ...patch } : prev)
    try {
      const fresca = await api(`/shelf/personal/${id}`, { method: 'PATCH', body: patch })
      setShelf(prev => prev && prev.map(x => x.id === id ? fresca : x))
      setAbierto(prev => prev?.id === id ? fresca : prev)
    } catch {
      if (!anterior) return
      setShelf(prev => prev && prev.map(x => x.id === id ? anterior : x))
      setAbierto(prev => prev?.id === id ? anterior : prev)
    }
  }, [shelf])

  // La ficha mete una entrada en el historial, igual que el menú lateral: en
  // el móvil se cierra con el gesto de volver, que es lo que se intenta por
  // instinto antes de buscar la flecha.
  useEffect(() => {
    if (!abierto) return
    window.history.pushState({ ficha: true }, '')
    const alVolver = () => setAbierto(null)
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [abierto?.id])

  function cerrarFicha() {
    if (window.history.state?.ficha) window.history.back()
    else setAbierto(null)
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
  // setAbierto ya es estable (viene de useState), así que se pasa tal cual: la
  // tarjeta memoizada llama onAbrir(entry) desde dentro.

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
        panel={panel} onPanel={setPanel}
        sort={sort} onSort={setSort}
        filters={filters} onFilters={setFilters}
        opciones={opciones} filtrosActivos={grupos.filtrosActivos}
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
                <TarjetaLeyendo key={e.id} entry={e} onAbrir={setAbierto} activa={abierto?.id === e.id} />
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
                      <Coleccion entries={items} vista={vista} onAbrir={setAbierto} abiertaId={abierto?.id} />
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
          onAbrir={setAbierto}
          abiertaId={abierto?.id}
        />

        <SeccionPlegable
          label="Dropeados" entries={grupos.dropped} vista={vista}
          plegada={plegadas.dropped}
          onAlternar={alternarDropped}
          onAbrir={setAbierto}
          abiertaId={abierto?.id}
        />
      </div>

      <AnimatePresence>
        {abierto && (
          <BookDetail
            entry={abierto}
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
  panel, onPanel, sort, onSort, filters, onFilters, opciones, filtrosActivos,
}) {
  // Se queda pegada arriba al bajar por una estantería larga: con 300 libros,
  // volver arriba solo para filtrar es la diferencia entre usarlo y no usarlo.
  return (
    <div className="sticky top-0 z-10 -mx-5 border-b border-line bg-bg/85 px-5 py-2 backdrop-blur-xl">
      <div className="flex items-center gap-1">
        <BotonHerramienta
          activo={buscando}
          onClick={() => { onBuscando(!buscando); if (buscando) onQuery(''); onPanel(null) }}
          etiqueta="Buscar"
        >
          <IconSearch className="h-[18px] w-[18px]" />
        </BotonHerramienta>

        <BotonHerramienta
          activo={panel === 'filtros' || filtrosActivos}
          onClick={() => onPanel(panel === 'filtros' ? null : 'filtros')}
          etiqueta="Filtros"
        >
          <IconFilter className="h-[18px] w-[18px]" />
          {filtrosActivos && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />}
        </BotonHerramienta>

        <BotonHerramienta
          activo={panel === 'orden' || !!sort.field}
          onClick={() => onPanel(panel === 'orden' ? null : 'orden')}
          etiqueta="Ordenar"
        >
          <IconSort className="h-[18px] w-[18px]" />
        </BotonHerramienta>

        <div className="flex-1" />

        {/* Cuadrícula o lista, con la pastilla deslizándose entre las dos. */}
        {/* Píldora dentro de píldora: el recuadro era rounded-xl2 (20px) con la
            pastilla a 10px y 2px de separación, así que la curva de dentro no
            podía seguir a la de fuera y la selección se salía por las esquinas.
            Con las dos redondeadas del todo encaja a cualquier tamaño. */}
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
      </div>

      <Plegable abierta={buscando}>
        <div className="pt-2">
          <div className="flex items-center gap-2 rounded-xl2 border border-line bg-surface px-3">
            <IconSearch className="h-4 w-4 shrink-0 text-ink-mute" />
            <input
              autoFocus
              value={query}
              onChange={e => onQuery(e.target.value)}
              placeholder="Título o autor"
              className="h-11 w-full bg-transparent text-[15px] outline-none placeholder:text-ink-mute"
            />
            {query && (
              <button onClick={() => onQuery('')} aria-label="Limpiar" className="p-1 text-ink-mute">
                <IconX className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </Plegable>

      <Plegable abierta={panel === 'orden'}>
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {SORT_FIELDS.map(({ field, label }) => {
            const activo = sort.field === field
            return (
              <button
                key={field}
                onClick={() => onSort(activo
                  // Tocar el que ya está activo alterna el sentido, y al
                  // tercer toque lo quita: no hace falta un botón aparte.
                  ? (sort.dir === 'asc' ? { field, dir: 'desc' } : { field: '', dir: 'asc' })
                  : { field, dir: 'asc' })}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  activo ? 'border-accent-line bg-accent-soft text-accent' : 'border-line text-ink-dim'
                }`}
              >
                {label}
                {activo && (
                  <IconChevron className={`h-3.5 w-3.5 transition-transform ${sort.dir === 'asc' ? 'rotate-180' : ''}`} />
                )}
              </button>
            )
          })}
        </div>
      </Plegable>

      <Plegable abierta={panel === 'filtros'}>
        <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line pt-3">
          <Desplegable label="Género"  value={filters.genre}  onChange={v => onFilters({ ...filters, genre: v })}  options={opciones.generos} />
          <Desplegable label="Autor"   value={filters.author} onChange={v => onFilters({ ...filters, author: v })} options={opciones.autores} />
          <Desplegable label="Carpeta" value={filters.folder} onChange={v => onFilters({ ...filters, folder: v })} options={opciones.carpetas} />
          <Desplegable
            label="Máx. páginas" value={filters.maxPages}
            onChange={v => onFilters({ ...filters, maxPages: v })}
            options={MAX_PAGES_OPTIONS}
          />
          <Desplegable
            label="Nota mínima" value={filters.minRating}
            onChange={v => onFilters({ ...filters, minRating: v })}
            options={['1', '2', '3', '4', '5']}
          />
          {filtrosActivos && (
            <button
              onClick={() => onFilters(EMPTY_FILTERS)}
              className="self-end rounded-xl2 border border-line px-3 py-2.5 text-sm text-ink-dim"
            >
              Quitar filtros
            </button>
          )}
        </div>
      </Plegable>
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

// Un <select> nativo, no un desplegable propio: en el móvil el nativo abre la
// rueda del sistema, que se maneja con el pulgar mucho mejor que cualquier
// lista flotante hecha a mano.
function Desplegable({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="px-1 text-[11px] uppercase tracking-[0.12em] text-ink-mute">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`h-11 rounded-xl2 border bg-surface px-3 text-[15px] outline-none ${
          value ? 'border-accent-line text-accent' : 'border-line text-ink-dim'
        }`}
      >
        <option value="">Cualquiera</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
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
  // sale solo (unas cuatro en un móvil, más en tablet y escritorio) y las
  // portadas quedan más pequeñas sin recortarse — la proporción 2/3 la sigue
  // fijando Cover, aquí solo cambia cuánto miden.
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-3">
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
    <button
      onClick={() => onAbrir(entry)}
      className="text-left transition-transform duration-150 active:scale-[0.96]"
    >
      <PortadaAnimable entry={entry} activa={activa}>
        <Cover url={entry.book.cover_url} className="shadow-sm" />
      </PortadaAnimable>
      <p className="mt-1.5 line-clamp-2 text-[11px] leading-tight text-ink-dim">{entry.book.title}</p>
      {entry.rating > 0 && <StarRating rating={entry.rating} size={9} className="mt-1" />}
    </button>
  )
})

const FilaLibro = memo(function FilaLibro({ entry, onAbrir, activa }) {
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
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {entry.rating > 0 && <StarRating rating={entry.rating} size={10} />}
        <StatusDot status={entry.status} />
      </div>
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
