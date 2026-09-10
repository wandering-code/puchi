import { memo, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '../../platform/auth'
import { api } from '../../platform/api'
import { useLiveUpdates } from '../../platform/live'
import { usarPreferencia } from '../../platform/preferencias'
import { EMPTY_FILTERS, agruparEstanteria, generosDeAutores, opcionesDeFiltro, readingDatesLabel } from './shelf'
import { Cover, NotaBadge, PagesLabel, ProgressBar, StarRating } from './piezas'
import BookDetail from './BookDetail'
import {
  IconChevron, IconFilter, IconGrid, IconList, IconLomos, IconPlegarTodo, IconPlus, IconSearch, IconX,
} from '../../ui/icons'
import HojaFiltros from './HojaFiltros'
import AnadirLibro from './AnadirLibro'
import Lomos from './Lomos'
import { precargarColores } from './colorPortada'
import { usarVuelo } from './usarVuelo'
import { CajaSeccion, TituloSeccion, huecoEntreSecciones, usarSeparacion } from './separacion'
import { LLEGADA } from '../../ui/curvas'
import { useHoja } from './HojaInferior'
import { useCapa } from '../../platform/capas'


export default function Luniteca() {
  const { player } = useAuth()
  const [shelf, setShelf] = useState(null)      // null = cargando
  const ficha = useCapa(null)            // la entrada abierta, o null
  const abierto = ficha.abierta
  // La última ficha que se ha abierto: sigue puesta mientras se cierra y
  // después, para no volver a construirla en la siguiente apertura.
  const ultimaFicha = useRef(null)
  if (abierto) ultimaFicha.current = abierto
  const enFicha = abierto || ultimaFicha.current
  const [error, setError] = useState(null)

  // La vista es de la cuenta, no del navegador: si eliges lomos, los ves aquí
  // y en la estantería de cualquiera, entres desde donde entres.
  const [vista, setVista] = usarPreferencia('vista', 'grid')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ field: '', dir: 'asc' })
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const hojaFiltros = useHoja()
  const hojaAnadir = useHoja()
  const [plegadas, setPlegadas] = useState({ want: false, read: false, dropped: true })
  const [anosPlegados, setAnosPlegados] = useState(() => new Set())
  // Cómo se separan las secciones: se está probando cuál gusta (ver separacion.jsx).
  const [separacion] = usarSeparacion()

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

  // La animación de abrir un libro desde la vista de lomos vive en su propio
  // hook, porque la comparten esta estantería y la de cualquiera (ver
  // luniteca/usarVuelo).
  const { vuelo, abrirLibro, abrirSinVuelo, cerrarFicha, enVuelo, fueraId } = usarVuelo(ficha)

  // ?libro=ID abre esa ficha al entrar: es como la actividad te trae a "tu
  // registro" de un libro.
  const [params, setParams] = useSearchParams()

  const libroAnadido = useCallback((entrada) => {
    setShelf(prev => (prev || []).some(x => x.id === entrada.id) ? prev : [...(prev || []), entrada])
  }, [])

  // Solo una vez: abrir la ficha mete una entrada en el historial, así que al
  // cerrarla se vuelve a la URL que traía el parámetro y se reabría sola.
  const libroPedido = params.get('libro')
  const yaAbierto = useRef(false)
  useEffect(() => {
    if (!libroPedido || !shelf || yaAbierto.current) return
    yaAbierto.current = true
    const entrada = shelf.find(e => String(e.book?.id) === libroPedido)
    if (entrada) abrirSinVuelo(entrada)
    setParams(p => { const q = new URLSearchParams(p); q.delete('libro'); return q }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libroPedido, shelf])

  const grupos = useMemo(
    () => agruparEstanteria(shelf, { filters, query, sort }),
    [shelf, filters, query, sort],
  )
  const opciones = useMemo(() => opcionesDeFiltro(shelf), [shelf])
  // Sobre la estantería ENTERA, no sobre lo que se ve: si se calculara por
  // sección, un autor con libros leídos y pendientes saldría con dos letras.
  const generosDeAutor = useMemo(() => generosDeAutores(shelf), [shelf])

  // Los colores de los lomos se van leyendo en cuanto se sabe qué libros hay,
  // aunque la vista sea otra: si se hace al aparecer cada lomo, se ve llegar
  // el color mientras bajas.
  useEffect(() => {
    if (!shelf?.length) return
    return precargarColores(shelf.map(e => e.book?.cover_url))
  }, [shelf])


  function cambiarVista(modo) {
    // En transición, y no a secas: dibujar la estantería de lomos con muchos
    // libros bloquea el hilo, y la pastilla del selector se quedaba sin
    // animar —saltaba de un botón al otro— justo al pasar a esa vista, no al
    // revés. Marcado como no urgente, React pinta antes el gesto y luego la
    // vista nueva.
    startTransition(() => setVista(modo))
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
                <TarjetaLeyendo key={e.id} entry={e} onAbrir={abrirLibro} fuera={e.id === fueraId} />
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
                        <Coleccion entries={items} vista={vista} onAbrir={abrirLibro} fueraId={fueraId} generosDeAutor={generosDeAutor} />
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
          fueraId={fueraId}
          generosDeAutor={generosDeAutor}
        />

        <SeccionPlegable
          variante={separacion}
          label="Dropeados" entries={grupos.dropped} vista={vista}
          plegada={plegadas.dropped}
          onAlternar={alternarDropped}
          onAbrir={abrirLibro}
          fueraId={fueraId}
          generosDeAutor={generosDeAutor}
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

      {/* La ficha no se desmonta al cerrarla, se queda con el último libro y
          se aparta: volver a abrir otra ya no tiene que levantar el armazón,
          que es lo que costaba un frame en cada toque (ver PantallaInferior). */}
      {enFicha && (
        <BookDetail
          entry={enFicha}
          abierta={!!abierto}
          carpetas={opciones.carpetas}
          generos={opciones.generos}
          onGuardarLibro={(borrador) => guardarLibro(enFicha, borrador)}
          onSubirPortada={(fichero) => subirPortada(enFicha.book.id, fichero)}
          onEliminar={() => eliminarEntrada(enFicha.id)}
          onCerrar={cerrarFicha}
          onActualizar={patch => actualizarEntrada(enFicha.id, patch)}
          vuelo={vuelo}
        />
      )}

      {enVuelo}
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
//
// La usan las DOS estanterías, la tuya y la de cualquiera desde su perfil: son
// las mismas herramientas y tienen que verse y comportarse igual. Lo único que
// cambia es que en la de otra persona no hay nada que añadir, así que sin
// `onAnadir` ese botón no se pinta.
export function Herramientas({
  vista, onVista, query, onQuery,
  onAbrirHoja, onAnadir, ordenActivo, filtrosActivos,
}) {
  // Que la búsqueda esté abierta es cosa SOLO de esta barra: si vive arriba,
  // abrirla vuelve a renderizar la estantería entera y el toque se comía 49ms
  // con doscientos libros, justo mientras el campo aparece. Lo que sí sube es
  // el texto, que ese sí filtra.
  const [buscando, setBuscando] = useState(false)
  const onBuscando = setBuscando

  // El campo vive montado, así que el foco hay que darlo a mano al abrirse.
  // Va dentro del mismo gesto que lo abre: en el móvil, un focus() que llega
  // más tarde puede no levantar el teclado.
  const campo = useRef(null)
  useEffect(() => {
    if (buscando) campo.current?.focus()
  }, [buscando])

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

        {/* El campo y los botones viven los DOS montados, uno encima del otro,
            y solo se encienden y se apagan. Antes se montaba el campo al pulsar
            la lupa y se desmontaban los botones, y eso es construir cosas en
            mitad del gesto: con el teclado subiendo a la vez, se veía a
            trompicones. Así no hay nada que construir, solo dos opacidades. */}
        <div className="relative flex min-w-0 flex-1 items-center gap-1">
          <motion.div
            className="flex items-center gap-1"
            initial={false}
            animate={{ opacity: buscando ? 0 : 1 }}
            transition={{ duration: 0.14, ease: [0.32, 0.72, 0, 1] }}
            style={{ pointerEvents: buscando ? 'none' : 'auto' }}
            inert={buscando}
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
                  usar sin volver a la Puchi actual. En la estantería de otra
                  persona no hay nada que añadir aquí. */}
              {onAnadir && (
                <BotonHerramienta principal onClick={onAnadir} etiqueta="Añadir libro">
                  <IconPlus className="h-[18px] w-[18px]" />
                </BotonHerramienta>
              )}
          </motion.div>

          {/* Crece desde la lupa, que es de donde sale, en vez de encenderse
              sin más. Lo que se anima es el ANCHO, con lo de dentro recortado:
              escalarlo (el primer intento) estiraba el texto del campo, que
              salía aplastado y se iba estirando hasta su sitio.
              Puede animarse a gusto porque aquí ya no se construye nada: el
              campo vive montado y solo se enciende y se apaga. */}
          <motion.div
            className="absolute inset-y-0 left-0 flex min-w-0 items-center gap-2 overflow-hidden rounded-xl2 border border-line bg-surface"
            initial={false}
            animate={{ width: buscando ? '100%' : 40, opacity: buscando ? 1 : 0 }}
            transition={{
              width: { duration: 0.24, ease: [0.32, 0.72, 0, 1] },
              // La opacidad va por delante al abrir y por detrás al cerrar, para
              // que no se vea la caja vacía ni al empezar ni al acabar.
              opacity: { duration: 0.14, delay: buscando ? 0 : 0.08 },
            }}
            style={{ pointerEvents: buscando ? 'auto' : 'none', paddingLeft: 12, paddingRight: 12 }}
            inert={!buscando}
          >
            <input
              ref={campo}
              value={query}
              onChange={e => onQuery(e.target.value)}
              placeholder="Título o autor"
              // Con nombre propio: ahora este campo vive siempre montado y
              // convive con el de "añadir libro", que lleva el mismo texto de
              // ayuda. Uno busca en TU estantería y el otro en el catálogo.
              aria-label="Buscar en tu estantería"
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

          <div className="flex-1" />

          {/* Píldora dentro de píldora: las dos redondeadas del todo, que con
              radios distintos la selección se salía por las esquinas. Se apaga
              al buscar, que entonces manda el campo. */}
          <motion.div
            className="flex shrink-0 items-center rounded-full border border-line p-1"
          initial={false}
          animate={{ opacity: buscando ? 0 : 1 }}
          transition={{ duration: 0.14, ease: [0.32, 0.72, 0, 1] }}
          style={{ pointerEvents: buscando ? 'none' : 'auto' }}
          inert={buscando}
        >
          {[['grid', IconGrid, 'Cuadrícula'], ['list', IconList, 'Lista'], ['lomos', IconLomos, 'Estantería']].map(([modo, Icono, etiqueta]) => (
            <button
              key={modo}
              onClick={() => onVista(modo)}
              aria-label={etiqueta}
              aria-pressed={vista === modo}
              className="relative flex h-8 w-9 items-center justify-center"
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
          </motion.div>
        </div>
      </div>
    </div>
  )
}

// Los tres botones de la barra llevan su propia superficie, teñida del color
// de la app. Sueltos sobre el fondo se veían planos, y encima descuadraban con
// el selector de vista de al lado, que sí tiene su píldora: un lado de la
// barra pesaba y el otro no.
//
// `principal` es para añadir un libro: va en color lleno porque es la única de
// las tres que HACE algo con la estantería. Buscar y filtrar solo cambian cómo
// se mira lo que ya hay.
//
// Y `activo` sube el tono en vez de estrenar color: antes marcaba el activo
// con este mismo fondo, así que ahora que lo llevan todos hay que subir un
// escalón para que se siga notando cuál está puesto.
function BotonHerramienta({ activo, principal, onClick, etiqueta, children }) {
  return (
    <button
      onClick={onClick}
      aria-label={etiqueta}
      aria-pressed={activo}
      className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
        principal
          ? 'bg-accent text-on-accent shadow-[0_1px_3px_rgba(60,40,20,.25)] active:bg-accent/90'
          : activo
            ? 'bg-accent/20 text-accent'
            : 'bg-accent/[0.08] text-accent active:bg-accent/20'
      }`}
    >
      {children}
    </button>
  )
}

// Alto animado con `height: auto`, que motion sí sabe interpolar. Lo que entra
// y sale se anima; nada aparece de golpe.
export function Plegable({ abierta, children }) {
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
export function BotonPlegarAnos({ todosPlegados, onAlternar }) {
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

const SeccionPlegable = memo(function SeccionPlegable({ variante, label, entries, vista, plegada, onAlternar, onAbrir, fueraId = null, generosDeAutor = null }) {
  if (entries.length === 0) return null
  return (
    <CajaSeccion variante={variante}>
      <TituloSeccion variante={variante} label={label} cuenta={entries.length} plegada={plegada} onAlternar={onAlternar} />
      <Plegable abierta={!plegada}>
        <div className="pt-3">
          <Coleccion entries={entries} vista={vista} onAbrir={onAbrir} fueraId={fueraId} generosDeAutor={generosDeAutor} />
        </div>
      </Plegable>
    </CajaSeccion>
  )
})

export const Coleccion = memo(function Coleccion({ entries, vista, onAbrir, fueraId = null, generosDeAutor = null }) {
  // Vista de estantería: los libros de canto. Es una vista aparte y aislada —
  // si no acaba de convencer se quita ella sola, sin tocar las otras dos.
  if (vista === 'lomos') return <Lomos entries={entries} onAbrir={onAbrir} fueraId={fueraId} generosDeAutor={generosDeAutor} />

  if (vista === 'list') {
    return (
      <div className="divide-y divide-[color:var(--color-line)]">
        {entries.map(e => <FilaLibro key={e.id} entry={e} onAbrir={onAbrir} fuera={e.id === fueraId} />)}
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
      {entries.map(e => <PortadaLibro key={e.id} entry={e} onAbrir={onAbrir} fuera={e.id === fueraId} />)}
    </div>
  )
})

// El botón es HTML normal y el "hundido" al tocar es una transición CSS, no
// whileTap: con 300 libros en pantalla, 300 componentes de motion cuestan
// medido 100 ms de bloqueo por cada tecla escrita en el buscador y ~280 ms del
// cambio de vista.
// `fuera`: este libro está ahora mismo abierto (o volando hacia la ficha), así
// que su sitio se queda vacío. Se deja el hueco, no se quita de la lista: lo
// que se ha sacado de la balda es ESTE libro, y al cerrarlo vuelve al mismo
// sitio. Si desapareciera del todo, los demás se moverían para taparlo.
const PortadaLibro = memo(function PortadaLibro({ entry, onAbrir, fuera = false }) {
  return (
    /* Sin título debajo: la portada ya dice qué libro es, y quien quiera
       comprobarlo entra en la ficha. De paso, todas las celdas miden
       exactamente lo mismo — la portada — así que ninguna fila puede
       descuadrarse. El título va en aria-label, que si no el botón se queda
       sin nombre para un lector de pantalla. */
    <button
      onClick={() => onAbrir(entry)}
      aria-label={entry.book.title}
      className={`transition-transform duration-150 active:scale-[0.96] ${fuera ? 'invisible' : ''}`}
    >
      <div className="relative">
        <Cover url={entry.book.cover_url} title={entry.book.title} className="shadow-sm" />
        <NotaBadge rating={entry.rating} />
      </div>
    </button>
  )
})

const FilaLibro = memo(function FilaLibro({ entry, onAbrir, fuera = false }) {
  // Las fechas de lectura, cuando las hay: en la lista hay sitio para ellas y
  // es lo que se viene a mirar cuando se pasa a esta vista. Van en su propia
  // línea y no pegadas al autor, para que un autor largo no se las coma al
  // truncar. Mismo texto que en la ficha y en las tarjetas de "Leyendo"
  // ("inicio – fin", o solo la que haya), así que no hay dos formas
  // distintas de escribir lo mismo por la app.
  const fechas = readingDatesLabel(entry)
  return (
    <button
      onClick={() => onAbrir(entry)}
      className={`flex w-full items-center gap-3 py-2.5 text-left transition-transform duration-150 active:scale-[0.99] ${fuera ? 'invisible' : ''}`}
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
// Se exporta porque la estantería de otra persona la usa igual: lo que alguien
// está leyendo se enseña siempre así, con su progreso y sus fechas, mande la
// vista que mande. Es la única sección que no contesta "qué libros tiene" sino
// "por dónde va", y ese dato no cabe en un lomo ni bajo una miniatura.
export const TarjetaLeyendo = memo(function TarjetaLeyendo({ entry, onAbrir, fuera = false }) {
  const fechas = readingDatesLabel(entry)
  // Páginas o porcentaje, a gusto de quien mira: un toque en la propia
  // etiqueta cambia de una a otra. Va con la cuenta, como la vista, porque es
  // la misma clase de gusto ("cómo prefiero mirar esto") y no tiene sentido
  // que el móvil y el ordenador respondan distinto. Al ser una sola
  // preferencia, cambian todas las tarjetas a la vez: si tocas una y solo se
  // enterase esa, la lista quedaría mezclada sin que se entienda por qué.
  const [porcentaje, setPorcentaje] = usarPreferencia('progresoEnPorcentaje', false)
  return (
    <button
      onClick={() => onAbrir(entry)}
      className={`flex w-full items-stretch gap-3 rounded-xl2 border border-line bg-surface p-3 text-left transition-transform duration-150 active:scale-[0.985] ${fuera ? 'invisible' : ''}`}
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
            {/* Un <span> y no un <button>: esto vive DENTRO del botón que abre
                el libro, y un botón dentro de otro no es HTML válido. El
                stopPropagation es lo que evita que el toque llegue a la
                tarjeta y abra la ficha. El margen negativo con relleno agranda
                la zona que responde al dedo sin mover nada de sitio. */}
            <span
              className="relative -m-2 shrink-0 cursor-pointer p-2 tabular-nums"
              onClick={e => { e.stopPropagation(); setPorcentaje(!porcentaje) }}
              title={porcentaje ? 'Ver las páginas' : 'Ver el porcentaje'}
            >
              {/* Las dos formas se cruzan en vez de saltar. popLayout saca de
                  la fila a la que se va, así que la que llega ya manda en el
                  ancho desde el primer fotograma y las fechas de al lado no
                  pegan un tirón mientras dura el cambio. */}
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={porcentaje ? 'porcentaje' : 'paginas'}
                  className="block"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
                >
                  <PagesLabel entry={entry} modo={porcentaje ? 'porcentaje' : 'paginas'} />
                </motion.span>
              </AnimatePresence>
            </span>
          </div>
        </div>
      </div>
    </button>
  )
})
