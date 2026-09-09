import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../platform/api'
import { useAuth } from '../../platform/auth'
import { EMPTY_FILTERS, agruparEstanteria, copiarAMiEstanteria, generosDeAutores } from '../luniteca/shelf'
import { Coleccion, TarjetaLeyendo } from '../luniteca/Luniteca'
import BookDetail from '../luniteca/BookDetail'
import { useCapa } from '../../platform/capas'
import { usarVuelo } from '../luniteca/usarVuelo'
import { usarPreferencia } from '../../platform/preferencias'
import { CajaSeccion, TituloSeccion, huecoEntreSecciones, usarSeparacion } from '../luniteca/separacion'
import { IconArrowLeft, IconGrid, IconList, IconLomos } from '../../ui/icons'

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

const VISTAS = [
  { id: 'grid',  Icon: IconGrid,  label: 'Cuadrícula' },
  { id: 'list',  Icon: IconList,  label: 'Lista' },
  { id: 'lomos', Icon: IconLomos, label: 'Estantería' },
]

// Las secciones van sin plegar y sin filtros: en la estantería de otro se
// entra a mirar, no a organizar.
function Seccion({ variante, label, entries, vista, onAbrir, fueraId, generosDeAutor }) {
  if (!entries?.length) return null
  // El mismo encabezado que en la tuya, con la variante que tengas elegida en
  // Ajustes: mirar la estantería de otro tiene que sentirse como mirar la
  // propia, no como otra aplicación.
  return (
    <CajaSeccion variante={variante}>
      {/* Aquí no hay barra de herramientas encima, así que el título que se
          queda arriba se pega al borde, no a 56px como en la propia. */}
      <TituloSeccion variante={variante} label={label} cuenta={entries.length} desde="top-0" />
      <Coleccion entries={entries} vista={vista} onAbrir={onAbrir} fueraId={fueraId} generosDeAutor={generosDeAutor} />
    </CajaSeccion>
  )
}

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
    () => (shelf ? agruparEstanteria(shelf, { filters: EMPTY_FILTERS, query: '', sort: { field: '', dir: 'asc' } }) : null),
    [shelf],
  )



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

      {/* Las mismas tres vistas que en la tuya, sin filtros ni orden: esto es
          para asomarse, no para trabajar. */}
      <div className="mb-4 flex justify-end">
        <div className="flex rounded-full border border-line p-1">
          {VISTAS.map(({ id: v, Icon, label }) => (
            <button
              key={v}
              // En transición: cambiar a lomos con muchos libros bloquea el
              // hilo y se come la animación del propio botón (ver Luniteca).
              onClick={() => startTransition(() => setVista(v))}
              aria-label={label}
              aria-pressed={vista === v}
              className={`flex h-9 w-11 items-center justify-center rounded-full transition-colors ${vista === v ? 'bg-accent/10 text-accent' : 'text-ink-mute'}`}
            >
              <Icon className="h-5 w-5" />
            </button>
          ))}
        </div>
      </div>

      {shelf === null && (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => <div key={i} className="aspect-[2/3] animate-pulse rounded-md bg-surface-2" />)}
        </div>
      )}

      {shelf?.length === 0 && (
        <p className="py-10 text-center text-sm text-ink-mute">{quien?.name || 'Esta persona'} no tiene libros todavía.</p>
      )}

      {grupos?.visible?.length > 0 && (
        <div className={huecoEntreSecciones(variante)}>
          {/* Leyendo no hace caso a la vista, aquí tampoco: se ve con su
              progreso y sus fechas, igual que en la tuya. */}
          {grupos.reading.length > 0 && (
            <CajaSeccion variante={variante}>
              <TituloSeccion variante={variante} label="Leyendo" cuenta={grupos.reading.length} desde="top-0" />
              <div className="mt-3 space-y-2">
                {grupos.reading.map(e => (
                  <TarjetaLeyendo key={e.id} entry={e} onAbrir={abrirLibro} fuera={e.id === fueraId} />
                ))}
              </div>
            </CajaSeccion>
          )}
          {grupos.readYearGroups.map(({ year, items }) => (
            <Seccion
              key={year}
              variante={variante}
              label={year === 'sin-fecha' ? 'Leídos, sin fecha' : `Leídos en ${year}`}
              entries={items}
              vista={vista}
              onAbrir={abrirLibro}
              fueraId={fueraId}
              generosDeAutor={generosDeAutor}
            />
          ))}
          <Seccion variante={variante} label="Por leer" entries={grupos.want} vista={vista} onAbrir={abrirLibro} fueraId={fueraId} generosDeAutor={generosDeAutor} />
          <Seccion variante={variante} label="Dropeados" entries={grupos.dropped} vista={vista} onAbrir={abrirLibro} fueraId={fueraId} generosDeAutor={generosDeAutor} />
        </div>
      )}

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
