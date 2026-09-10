import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../platform/api'
import { useAuth } from '../../platform/auth'
import { EMPTY_FILTERS, agruparEstanteria, copiarAMiEstanteria, generosDeAutores, opcionesDeFiltro } from '../luniteca/shelf'
import { BotonPlegarAnos, Coleccion, Herramientas, Plegable, TarjetaLeyendo } from '../luniteca/Luniteca'
import BookDetail from '../luniteca/BookDetail'
import HojaFiltros from '../luniteca/HojaFiltros'
import { useHoja } from '../luniteca/HojaInferior'
import { useCapa } from '../../platform/capas'
import { usarVuelo } from '../luniteca/usarVuelo'
import { usarPreferencia } from '../../platform/preferencias'
import { CajaSeccion, TituloSeccion, huecoEntreSecciones, usarSeparacion } from '../luniteca/separacion'
import { IconArrowLeft } from '../../ui/icons'

// La estantería de otra persona, con sus números. Se llega desde Actividad, y
// es una pantalla propia (no un modal ni una hoja) para que el gesto de volver
// funcione y el enlace se pueda compartir.
//
// De consulta: aquí no se edita nada de nadie. Las notas privadas ni siquiera
// llegan, el backend las quita de las entradas que no son tuyas
// (`_shelf_entry_out`, hide_notes), así que esto no depende de esconderlas en
// la pantalla.
//
// Con ?libro=ID abre directamente el registro de ese libro: es lo que usa la
// actividad para llevarte a "lo que Lucía tiene de este libro".

export default function Perfil() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { player } = useAuth()
  const [params, setParams] = useSearchParams()
  const [quien, setQuien] = useState(null)
  const [shelf, setShelf] = useState(null)
  const [numeros, setNumeros] = useState(null)
  const [error, setError] = useState(null)
  // La misma vista que tengas puesta en la tuya: es tu forma de mirar una
  // estantería, no algo de cada estantería. Y cambiarla aquí te la cambia
  // también en la tuya, por lo mismo.
  const [vista, setVista] = usarPreferencia('vista', 'grid')
  const [variante] = usarSeparacion()
  // Filtrar y ordenar aquí es cosa del momento: vive en la pantalla y se
  // deshace al salir, que lo que se busca en la estantería de otra persona no
  // tiene por qué seguir puesto cuando vuelvas a la tuya.
  const [sort, setSort] = useState({ field: '', dir: 'asc' })
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [query, setQuery] = useState('')
  const hojaFiltros = useHoja()
  const [plegadas, setPlegadas] = useState({ read: false, want: false, dropped: true })
  const [anosPlegados, setAnosPlegados] = useState(() => new Set())
  const alternar = clave => setPlegadas(p => ({ ...p, [clave]: !p[clave] }))
  const alternarAno = year => setAnosPlegados(prev => {
    const s = new Set(prev)
    s.has(year) ? s.delete(year) : s.add(year)
    return s
  })
  // Igual que en la propia: el género que manda es el del autor, mirando toda
  // su estantería, para que sus libros compartan letra.
  const generosDeAutor = useMemo(() => generosDeAutores(shelf || []), [shelf])
  const ficha = useCapa(null)
  const abierto = ficha.abierta
  // Igual que en la Luniteca: la ficha se queda montada con el último libro.
  const ultimaFicha = useRef(null)
  if (abierto) ultimaFicha.current = abierto
  const enFicha = abierto || ultimaFicha.current
  // El libro sale de la balda también aquí: con la vista de lomos puesta, que
  // en la estantería de otro se abrieran de golpe cantaba.
  const { vuelo, abrirLibro, abrirSinVuelo, cerrarFicha, enVuelo, fueraId } = usarVuelo(ficha)

  const idQuien = Number(id)
  const soyYo = player?.id === idQuien

  useEffect(() => {
    let vigente = true
    setShelf(null)
    Promise.all([
      api('/players'),
      api(`/shelf/personal?player_id=${idQuien}`),
      api('/shelf/rankings').catch(() => []),
    ])
      .then(([jugadores, entradas, rankings]) => {
        if (!vigente) return
        setQuien(jugadores.find(j => j.id === idQuien) || null)
        setShelf(entradas)
        setNumeros(rankings.find(r => r.player?.id === idQuien) || null)
      })
      .catch(e => { if (vigente) setError(e.message) })
    return () => { vigente = false }
  }, [idQuien])

  // ?libro=ID abre su registro de ese libro. Y lo abre CUANTO ANTES, sin
  // esperar a que llegue su estantería entera: se pide solo esa lectura
  // (/books/{id}/lecturas, una respuesta pequeña) y la ficha aparece con ella
  // mientras la estantería se carga por detrás. Viniendo de la actividad, lo
  // que se ha tocado es un libro concreto: esperar en blanco a que cargue una
  // estantería de trescientos para luego saltar a la ficha se siente como un
  // atropello.
  //
  // Se abre una sola vez, y por eso el ref: abrir la ficha mete una entrada en
  // el historial, así que al cerrarla se vuelve a la URL que traía el parámetro
  // y se reabría sola. Quitar el parámetro no basta: eso reemplaza la entrada
  // de ahora, no aquella a la que se vuelve.
  const libroPedido = params.get('libro')
  const yaAbierto = useRef(false)
  useEffect(() => {
    if (!libroPedido || yaAbierto.current) return
    yaAbierto.current = true
    // La respuesta no se descarta al desmontar, a diferencia de las demás
    // cargas: en desarrollo React monta el efecto dos veces y el ref hace que
    // solo pida una, así que cancelar esa única petición dejaba la ficha sin
    // abrir. Abrirla después de un desmontaje de mentira es lo correcto aquí.
    api(`/books/${libroPedido}/lecturas`)
      .then(lecturas => {
        const suya = lecturas.find(l => l.player_id === idQuien)
        if (suya) abrirSinVuelo(suya)
      })
      .catch(() => {})
    setParams(p => { const q = new URLSearchParams(p); q.delete('libro'); return q }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libroPedido, idQuien])

  const grupos = useMemo(
    () => (shelf ? agruparEstanteria(shelf, { filters, query, sort }) : null),
    [shelf, filters, query, sort],
  )
  // Los géneros, carpetas y autores que se ofrecen son los de SU estantería:
  // filtrar por algo que no tiene no lleva a ninguna parte.
  const opciones = useMemo(() => opcionesDeFiltro(shelf), [shelf])
  const filtrosActivos = Object.keys(EMPTY_FILTERS).some(k => filters[k] !== EMPTY_FILTERS[k])



  if (error) {
    return <div className="py-8"><p className="rounded-xl2 border border-line bg-surface px-4 py-3 text-sm text-danger">{error}</p></div>
  }

  return (
    <div className="py-6">
      {/* Volver a donde se venía (normalmente Actividad). Instalada como app no
          hay barra del navegador que deshaga nada, así que la pantalla tiene
          que traer su propia salida. */}
      <button
        onClick={() => navegar(-1)}
        aria-label="Volver"
        className="mb-3 -ml-2 flex h-10 w-10 items-center justify-center rounded-xl2 text-ink-dim transition-colors active:bg-surface-2"
      >
        <IconArrowLeft className="h-5 w-5" />
      </button>

      <header className="mb-5 flex items-center gap-3.5">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line text-2xl"
          style={{ background: quien?.color || 'var(--color-surface-2)' }}
        >
          {quien?.avatar_url
            ? <img src={quien.avatar_url} alt="" className="h-full w-full object-cover" />
            : <span>{quien?.avatar_emoji || '⭐'}</span>}
        </span>
        <div className="min-w-0">
          <h2 className="truncate font-display text-[1.6rem] font-bold leading-tight tracking-[-0.02em]">
            {quien?.name || '…'}{soyYo && <span className="ml-2 align-middle text-xs font-normal text-ink-mute">tú</span>}
          </h2>
          <p className="mt-0.5 text-sm text-ink-dim">
            {numeros
              ? <>{numeros.books_read} {numeros.books_read === 1 ? 'libro leído' : 'libros leídos'} · {numeros.pages_read.toLocaleString('es-ES')} páginas</>
              : 'Su estantería'}
          </p>
        </div>
      </header>

      {/* Las MISMAS herramientas que en tu estantería: buscar, filtrar y las
          tres vistas, en el mismo sitio y con la misma pinta. Sin el botón de
          añadir, que aquí no hay nada que añadir. */}
      <Herramientas
        vista={vista}
        onVista={v => startTransition(() => setVista(v))}
        query={query}
        onQuery={setQuery}
        onAbrirHoja={hojaFiltros.abrir}
        ordenActivo={!!sort.field}
        filtrosActivos={filtrosActivos}
      />

      {shelf === null && (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => <div key={i} className="aspect-[2/3] animate-pulse rounded-md bg-surface-2" />)}
        </div>
      )}

      {shelf?.length === 0 && (
        <p className="py-10 text-center text-sm text-ink-mute">{quien?.name || 'Esta persona'} no tiene libros todavía.</p>
      )}

      {grupos?.ningunoVisible && (
        <p className="py-10 text-center text-sm text-ink-mute">
          Ningún libro suyo coincide. Prueba a quitar algún filtro.
        </p>
      )}

      {grupos?.visible?.length > 0 && (
        <div className={`mt-5 ${huecoEntreSecciones(variante)}`}>
          {/* El `mt-5` es el mismo respiro bajo la barra de herramientas que en
              la tuya: sin él la primera sección salía pegada a ella.

              Y de ahí para abajo, misma forma que tu estantería: lo que
              estaba leyendo con su progreso, los leídos agrupados por año y
              plegables, y luego lo pendiente y lo dejado a medias. */}
          {grupos.reading.length > 0 && (
            <CajaSeccion variante={variante}>
              <TituloSeccion variante={variante} label="Leyendo" cuenta={grupos.reading.length} estado="reading" />
              <div className="mt-3 space-y-2">
                {grupos.reading.map(e => (
                  <TarjetaLeyendo key={e.id} entry={e} onAbrir={abrirLibro} fuera={e.id === fueraId} />
                ))}
              </div>
            </CajaSeccion>
          )}

          {grupos.readYearGroups.length > 0 && (
            <CajaSeccion variante={variante}>
              <TituloSeccion
                variante={variante}
                label="Leídos"
                estado="read"
                cuenta={grupos.readYearGroups.reduce((n, g) => n + g.items.length, 0)}
                plegada={plegadas.read}
                onAlternar={() => alternar('read')}
                // Igual que en la tuya: solo con la sección abierta y con más
                // de un año, que con uno su propio chevron ya hace lo mismo.
                accion={!plegadas.read && grupos.years.length > 1 && (
                  <BotonPlegarAnos
                    todosPlegados={grupos.years.every(y => anosPlegados.has(y))}
                    onAlternar={() => setAnosPlegados(prev => (
                      grupos.years.every(y => prev.has(y)) ? new Set() : new Set(grupos.years)
                    ))}
                  />
                )}
              />
              <Plegable abierta={!plegadas.read}>
                <div className="space-y-5 pt-3">
                  {grupos.readYearGroups.map(({ year, items }) => (
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

          {[['want', 'Por leer', grupos.want], ['dropped', 'Dropeados', grupos.dropped]].map(([clave, label, entries]) => (
            entries.length > 0 && (
              <CajaSeccion key={clave} variante={variante}>
                <TituloSeccion
                  variante={variante}
                  label={label}
                  cuenta={entries.length}
                  plegada={plegadas[clave]}
                  onAlternar={() => alternar(clave)}
                  // 'want' y 'dropped' son ya las claves del estado.
                  estado={clave}
                />
                <Plegable abierta={!plegadas[clave]}>
                  <div className="pt-3">
                    <Coleccion entries={entries} vista={vista} onAbrir={abrirLibro} fueraId={fueraId} generosDeAutor={generosDeAutor} />
                  </div>
                </Plegable>
              </CajaSeccion>
            )
          ))}
        </div>
      )}

      <HojaFiltros
        abierta={hojaFiltros.abierta}
        onCerrar={hojaFiltros.cerrar}
        sort={sort}
        onSort={setSort}
        filters={filters}
        onFilters={setFilters}
        opciones={opciones}
        visibles={grupos?.visible?.length || 0}
      />

      {enFicha && (
        <BookDetail
            entry={enFicha}
            abierta={!!abierto}
            carpetas={[]}
            generos={[]}
            onCerrar={cerrarFicha}
            vuelo={vuelo}
            soloLectura
            deQuien={quien}
            // Sin sacarte de su estantería: el botón dice ahí mismo si se ha
            // añadido o si ya lo tenías (ver BotonGuardarlo en BookDetail).
            onGuardarEnMiEstanteria={() => copiarAMiEstanteria(enFicha.book)}
        />
      )}

      {enVuelo}
    </div>
  )
}
