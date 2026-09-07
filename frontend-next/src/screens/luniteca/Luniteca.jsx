import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '../../platform/auth'
import { api } from '../../platform/api'
import { useLiveUpdates } from '../../platform/live'
import { EMPTY_FILTERS, agruparEstanteria, opcionesDeFiltro, readingDatesLabel } from './shelf'
import { Cover, NotaBadge, PagesLabel, ProgressBar, StarRating } from './piezas'
import BookDetail from './BookDetail'
import {
  IconChevron, IconFilter, IconGrid, IconList, IconPlegarTodo, IconPlus, IconSearch, IconX,
} from '../../ui/icons'
import HojaFiltros from './HojaFiltros'
import AnadirLibro from './AnadirLibro'
import { CajaSeccion, TituloSeccion, huecoEntreSecciones, leerSeparacion } from './separacion'
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
  const hojaAnadir = useHoja()
  const [plegadas, setPlegadas] = useState({ want: false, read: false, dropped: true })
  const [anosPlegados, setAnosPlegados] = useState(() => new Set())
  // Cómo se separan las secciones: se está probando cuál gusta (ver separacion.jsx).
  const [separacion] = useState(leerSeparacion)

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

  // Los datos del LIBRO son compartidos con todo el club, a diferencia de los
  // de la entrada (estado, fechas, notas…). Mismo patrón optimista: se aplica
  // al momento y se revierte si el servidor dice que no.
  const actualizarLibro = useCallback(async (bookId, patch) => {
    const anterior = shelf?.find(x => x.book.id === bookId)?.book
    const aplicar = (lista, libro) => lista.map(x => x.book.id === bookId ? { ...x, book: libro(x) } : x)
    setShelf(prev => prev && aplicar(prev, x => ({ ...x.book, ...patch })))
    ficha.reemplazar(prev => prev?.book.id === bookId ? { ...prev, book: { ...prev.book, ...patch } } : prev)
    try {
      const fresco = await api(`/books/${bookId}`, { method: 'PATCH', body: patch })
      // La respuesta del libro no incluye la portada propia de cada jugador:
      // se reaplica, o elegir una portada dejaría de verse al guardar.
      const conPortadaPropia = (x) => ({ ...fresco, cover_url: x.own_cover_url || fresco.cover_url })
      setShelf(prev => prev && aplicar(prev, conPortadaPropia))
      ficha.reemplazar(prev => prev?.book.id === bookId ? { ...prev, book: conPortadaPropia(prev) } : prev)
    } catch {
      if (!anterior) return
      setShelf(prev => prev && aplicar(prev, () => anterior))
      ficha.reemplazar(prev => prev?.book.id === bookId ? { ...prev, book: anterior } : prev)
    }
  }, [shelf])

  // Guardar la edición: lo que ha cambiado del libro va al libro; la portada
  // va a TU entrada, porque cada jugador ve la que ha elegido.
  const guardarLibro = useCallback(async (entrada, borrador) => {
    const b = entrada.book
    const patch = {}
    if (borrador.title !== (b.title || '')) patch.title = borrador.title
    if (borrador.author !== (b.author || '')) patch.author = borrador.author
    if (borrador.genre !== (b.genre || '')) patch.genre = borrador.genre
    const anio = borrador.year === '' ? null : Number(borrador.year)
    const paginas = borrador.num_pages === '' ? null : Number(borrador.num_pages)
    if (anio !== (b.year ?? null)) patch.year = anio
    if (paginas !== (b.num_pages ?? null)) patch.num_pages = paginas
    if (borrador.synopsis !== (b.synopsis || '')) patch.synopsis = borrador.synopsis
    if (Object.keys(patch).length) await actualizarLibro(b.id, patch)
    if (borrador.cover_url !== (entrada.own_cover_url || '')) {
      await actualizarEntrada(entrada.id, { cover_url: borrador.cover_url })
    }
  }, [actualizarLibro, actualizarEntrada])

  // Sube una foto a la galería del libro (compartida, con atribución) y
  // devuelve su URL; quien la elige como portada es el formulario.
  const subirPortada = useCallback(async (bookId, fichero) => {
    const datos = new FormData()
    datos.append('file', fichero)
    const r = await api(`/books/${bookId}/cover`, { method: 'POST', body: datos })
    return r.url
  }, [])

  const eliminarEntrada = useCallback(async (id) => {
    const anterior = shelf
    cerrarFicha()
    setShelf(prev => prev && prev.filter(x => x.id !== id))
    try {
      await api(`/shelf/personal/${id}`, { method: 'DELETE' })
    } catch {
      setShelf(anterior)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shelf])

  const abrirLibro = useCallback((entrada) => ficha.abrir(entrada), [])

  const cerrarFicha = ficha.cerrar

  const libroAnadido = useCallback((entrada) => {
    setShelf(prev => (prev || []).some(x => x.id === entrada.id) ? prev : [...(prev || []), entrada])
  }, [])

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
  // Plegar o desplegar TODOS los años de golpe. Solo los años: los estados se
  // pliegan uno a uno, que son cuatro y cada uno se mira por su cuenta.
  const alternarTodosLosAnos = useCallback((anos) => {
    setAnosPlegados(prev => (anos.every(y => prev.has(y)) ? new Set() : new Set(anos)))
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
        onAnadir={hojaAnadir.abrir}
        ordenActivo={!!sort.field}
        filtrosActivos={grupos.filtrosActivos}
      />

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      {grupos.vacia && !error && (
        <Aviso
          titulo="Todavía no hay nada aquí"
          texto="Toca el + de arriba para buscar un libro y añadirlo. También aparecen aquí los que añadas desde la Puchi actual."
        />
      )}

      {grupos.ningunoVisible && (
        <Aviso
          titulo="Ningún libro coincide"
          texto="Prueba a quitar algún filtro o a cambiar la búsqueda."
        />
      )}

      <div className={`mt-5 ${huecoEntreSecciones(separacion)}`}>
        {grupos.reading.length > 0 && (
          <CajaSeccion variante={separacion}>
            <TituloSeccion variante={separacion} label="Leyendo" cuenta={grupos.reading.length} />
            <div className="mt-3 space-y-2">
              {grupos.reading.map(e => (
                <TarjetaLeyendo key={e.id} entry={e} onAbrir={abrirLibro} />
              ))}
            </div>
          </CajaSeccion>
        )}

        {grupos.readYearGroups.length > 0 && (
          <CajaSeccion variante={separacion}>
            <TituloSeccion
              variante={separacion}
              label="Leídos"
              cuenta={grupos.readYearGroups.reduce((n, g) => n + g.items.length, 0)}
              plegada={plegadas.read}
              onAlternar={alternarRead}
              // Solo tiene sentido con la sección abierta y con más de un año:
              // con uno, su propio chevron ya hace lo mismo.
              accion={!plegadas.read && grupos.years.length > 1 && (
                <BotonPlegarAnos
                  todosPlegados={grupos.years.every(y => anosPlegados.has(y))}
                  onAlternar={() => alternarTodosLosAnos(grupos.years)}
                />
              )}
            />
            <Plegable abierta={!plegadas.read}>
              <div className="space-y-5 pt-3">
                {grupos.readYearGroups.map(({ year, items }) => (
                  <div key={year}>
                    <TituloSeccion
                      variante={separacion}
                      anidado
                      label={year === 'sin-fecha' ? 'Sin fecha' : year}
                      cuenta={items.length}
                      plegada={anosPlegados.has(year)}
                      onAlternar={() => alternarAno(year)}
                    />
                    <Plegable abierta={!anosPlegados.has(year)}>
                      <div className="pt-2">
                        <Coleccion entries={items} vista={vista} onAbrir={abrirLibro} />
                      </div>
                    </Plegable>
                  </div>
                ))}
              </div>
            </Plegable>
          </CajaSeccion>
        )}

        <SeccionPlegable
          variante={separacion}
          label="Por leer" entries={grupos.want} vista={vista}
          plegada={plegadas.want}
          onAlternar={alternarWant}
          onAbrir={abrirLibro}
         
        />

        <SeccionPlegable
          variante={separacion}
          label="Dropeados" entries={grupos.dropped} vista={vista}
          plegada={plegadas.dropped}
          onAlternar={alternarDropped}
          onAbrir={abrirLibro}
         
        />
      </div>

      <AnimatePresence>
        {hojaAnadir.abierta && (
          <AnadirLibro onCerrar={hojaAnadir.cerrar} onAnadido={libroAnadido} />
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

      <AnimatePresence>
        {abierto && (
          <BookDetail
            entry={abierto}
            carpetas={opciones.carpetas}
            generos={opciones.generos}
            onGuardarLibro={(borrador) => guardarLibro(abierto, borrador)}
            onSubirPortada={(fichero) => subirPortada(abierto.book.id, fichero)}
            onEliminar={() => eliminarEntrada(abierto.id)}
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
  onAbrirHoja, onAnadir, ordenActivo, filtrosActivos,
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

              {/* Añadir libro: la acción que hace que esta versión se pueda
                  usar sin volver a la Puchi actual. */}
              <BotonHerramienta onClick={onAnadir} etiqueta="Añadir libro">
                <IconPlus className="h-[18px] w-[18px]" />
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
function BotonPlegarAnos({ todosPlegados, onAlternar }) {
  return (
    <motion.button
      onClick={onAlternar}
      whileTap={{ scale: 0.9 }}
      aria-label={todosPlegados ? 'Desplegar todos los años' : 'Plegar todos los años'}
      title={todosPlegados ? 'Desplegar todos los años' : 'Plegar todos los años'}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-mute transition-colors active:bg-surface-2"
    >
      <IconPlegarTodo expandir={todosPlegados} className="h-[18px] w-[18px]" />
    </motion.button>
  )
}

const SeccionPlegable = memo(function SeccionPlegable({ variante, label, entries, vista, plegada, onAlternar, onAbrir }) {
  if (entries.length === 0) return null
  return (
    <CajaSeccion variante={variante}>
      <TituloSeccion variante={variante} label={label} cuenta={entries.length} plegada={plegada} onAlternar={onAlternar} />
      <Plegable abierta={!plegada}>
        <div className="pt-3">
          <Coleccion entries={entries} vista={vista} onAbrir={onAbrir} />
        </div>
      </Plegable>
    </CajaSeccion>
  )
})

const Coleccion = memo(function Coleccion({ entries, vista, onAbrir }) {
  if (vista === 'list') {
    return (
      <div className="divide-y divide-[color:var(--color-line)]">
        {entries.map(e => <FilaLibro key={e.id} entry={e} onAbrir={onAbrir} />)}
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
      {entries.map(e => <PortadaLibro key={e.id} entry={e} onAbrir={onAbrir} />)}
    </div>
  )
})

// El botón es HTML normal y el "hundido" al tocar es una transición CSS, no
// whileTap: con 300 libros en pantalla, 300 componentes de motion cuestan
// medido 100 ms de bloqueo por cada tecla escrita en el buscador y ~280 ms del
// cambio de vista.
const PortadaLibro = memo(function PortadaLibro({ entry, onAbrir }) {
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
      <div className="relative">
        <Cover url={entry.book.cover_url} title={entry.book.title} className="shadow-sm" />
        <NotaBadge rating={entry.rating} />
      </div>
    </button>
  )
})

const FilaLibro = memo(function FilaLibro({ entry, onAbrir }) {
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
      <div className="w-10 shrink-0">
        <Cover url={entry.book.cover_url} />
      </div>
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
const TarjetaLeyendo = memo(function TarjetaLeyendo({ entry, onAbrir }) {
  const fechas = readingDatesLabel(entry)
  return (
    <button
      onClick={() => onAbrir(entry)}
      className="flex w-full items-stretch gap-3 rounded-xl2 border border-line bg-surface p-3 text-left transition-transform duration-150 active:scale-[0.985]"
    >
      <div className="w-14 shrink-0">
        <Cover url={entry.book.cover_url} priority />
      </div>
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
