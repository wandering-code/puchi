import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../../platform/api'
import { STATUS_COLOR, STATUS_LABEL } from './shelf'
import { Cover } from './piezas'
import { IconCheck } from '../../ui/icons'
import HojaInferior from './HojaInferior'

// Libros relacionados con el de la ficha (issue #7): la saga entera, en
// orden y con este libro señalado, y más libros del mismo autor. Sirven
// para añadirlos a tu estantería sin tener que buscarlos.
//
// Lo que no se puede permitir es que esto haga más lenta la ficha, así que:
// - No se pide nada hasta que la ficha ha terminado de abrirse (`lista`): ni
//   la petición ni las portadas compiten con el libro que vuela hasta ella.
// - Lo ya visto en la sesión se guarda aquí y se enseña al momento.
// - El backend guarda lo que calcula (RelatedCache), así que solo la primera
//   ficha de cada libro espera a las fuentes de fuera.
// - Mientras carga, cada sección reserva su hueco con portadas en blanco que
//   laten: quien no sabe que aquí salen sugerencias ve que algo viene, en vez
//   de encontrárselo de golpe. Si al final no hay nada (un libro sin saga),
//   el hueco se pliega suave. Lo ya recordado sale directo, sin ese paso.

const recordadas = new Map()   // book_id → respuesta de /related, durante la sesión

// Lo que tarda la ficha en abrirse del todo (ver LLEGADA en ui/curvas.js),
// con margen: hasta entonces no se pide ni se pinta nada.
const ESPERA_APERTURA_MS = 380

export function useRelacionados(libroId, lista) {
  const [datos, setDatos] = useState(() => recordadas.get(libroId) || null)
  const [fallo, setFallo] = useState(false)
  const [pedidoPara, setPedidoPara] = useState(libroId)
  // La ficha no se desmonta al cambiar de libro: sin esto, un instante se
  // verían los relacionados del libro anterior.
  if (pedidoPara !== libroId) {
    setPedidoPara(libroId)
    setDatos(recordadas.get(libroId) || null)
    setFallo(false)
  }

  // Aunque ya estén recordadas, tampoco se pintan en cuanto la ficha está
  // lista, sino un poco después: medido en WebKit, pintarlas en el mismo
  // fotograma en que aterriza el libro alargaba ese fotograma, que ya es el
  // más pesado de la apertura.
  const [aTiempo, setATiempo] = useState(false)
  useEffect(() => {
    setATiempo(false)
    if (!lista) return
    const espera = setTimeout(() => setATiempo(true), ESPERA_APERTURA_MS)
    return () => clearTimeout(espera)
  }, [libroId, lista])

  useEffect(() => {
    if (!lista || recordadas.has(libroId)) return
    let vigente = true
    const espera = setTimeout(() => {
      api(`/books/${libroId}/related`)
        .then(r => {
          recordadas.set(libroId, r)
          if (vigente) setDatos(r)
        })
        // Sin sugerencias la ficha sigue siendo la de siempre: ni mensaje de
        // error ni hueco, el reservado se pliega y ya.
        .catch(() => { if (vigente) setFallo(true) })
    }, ESPERA_APERTURA_MS)
    return () => { vigente = false; clearTimeout(espera) }
  }, [libroId, lista])

  // Al añadir uno, se marca en el sitio (y en lo recordado, para que siga
  // marcado al volver a abrir la ficha) sin volver a pedir nada.
  function marcarAnadido(sugerencia, entrada) {
    const marcar = s => (s === sugerencia
      ? { ...s, in_shelf: true, shelf_status: entrada?.status || 'want_to_read', book_id: entrada?.book?.id ?? s.book_id }
      : s)
    setDatos(prev => {
      if (!prev) return prev
      const nuevo = {
        series: prev.series.map(g => ({ ...g, books: g.books.map(marcar) })),
        same_author: prev.same_author.map(marcar),
      }
      recordadas.set(libroId, nuevo)
      return nuevo
    })
  }

  return {
    datos: aTiempo ? datos : null,
    cargando: aTiempo && !datos && !fallo,
    marcarAnadido,
  }
}

// Las dos secciones van en sitios distintos de la ficha (la saga pegada a la
// sinopsis, el autor al final), pero comparten datos y hoja: por eso las
// monta un mismo componente y BookDetail le dice cuál pintar en cada hueco.
export function Relacionados({ libro, lista, parte, relacionados, onElegir }) {
  const { datos, cargando } = relacionados
  // "Más del autor" se monta un poco después que la saga: son unas 30-40
  // portadas, y montarlo todo en el mismo fotograma se notaba (medido en
  // WebKit). Por separado, ninguno de los dos pesa.
  const [autorAHora, setAutorAHora] = useState(false)
  // Depende de SI hay datos, no de cuáles: al añadir un libro los datos
  // cambian (se marca como tuyo) y la sección no debe plegarse y volver.
  const hayDatos = !!datos
  useEffect(() => {
    setAutorAHora(false)
    if (parte !== 'autor' || !hayDatos) return
    const espera = setTimeout(() => setAutorAHora(true), 300)
    return () => clearTimeout(espera)
  }, [parte, hayDatos, libro.id])
  const mostrar = lista && datos && (parte !== 'autor' || autorAHora)
  // El tomo que se está viendo, con la portada y el título de tu libro, no
  // los de la edición que haya encontrado la fuente.
  const sagas = mostrar
    ? datos.series
      .filter(g => g.books.length > 1)
      .map(g => ({
        ...g,
        books: g.books.map(b => (b.is_current ? { ...b, title: libro.title, cover_url: libro.cover_url || b.cover_url } : b)),
      }))
    : []
  const delAutor = mostrar ? datos.same_author : []
  // Mientras llegan (y, en el autor, durante su pequeño retraso) se reserva
  // el hueco. La primera saga usa la MISMA key que su reserva: así el hueco
  // no se pliega y se vuelve a abrir, solo cambia lo de dentro.
  const reservaSaga = parte === 'saga' && lista && cargando
  const reservaAutor = parte === 'autor' && lista && !!libro.author && (cargando || (!!datos && !autorAHora && datos.same_author.length > 0))

  return (
    <AnimatePresence initial={false}>
      {(parte !== 'saga' ? [] : reservaSaga ? [null] : sagas).map((g, i) => (
        <Desplegable key={`saga-${libro.id}-${i}`}>
          {g
            ? <Relevo key="contenido"><Saga grupo={g} onElegir={onElegir} /></Relevo>
            : <Relevo key="reserva"><ReservaSaga /></Relevo>}
        </Desplegable>
      ))}
      {(reservaAutor || (parte === 'autor' && delAutor.length > 0)) && (
        <Desplegable key={`autor-${libro.id}`}>
          <section className="mb-8">
            <h3 className="mb-3 text-[11px] uppercase tracking-[0.14em] text-ink-mute">
              Más de {libro.author}
            </h3>
            {reservaAutor ? (
              <Relevo key="reserva"><ReservaTira /></Relevo>
            ) : (
              <Relevo key="contenido">
                <Tira>
                  {delAutor.map((s, i) => (
                    <Sugerencia key={`${s.title}-${i}`} s={s} onElegir={onElegir} />
                  ))}
                </Tira>
              </Relevo>
            )}
          </section>
        </Desplegable>
      )}
    </AnimatePresence>
  )
}

// El cambio de la reserva a las portadas de verdad, en el mismo sitio: un
// fundido corto, sin que se mueva nada.
function Relevo({ children }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      {children}
    </motion.div>
  )
}

// Portadas en blanco que laten, con las mismas medidas que las de verdad
// (Sugerencia): al llegar los datos el hueco no crece ni encoge.
function ReservaTira({ conLinea = false }) {
  return (
    <div className="-mx-6 flex gap-3 overflow-hidden px-6 pb-1" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={`${ANCHO_PORTADA} shrink-0`}>
          <div className="aspect-[2/3] animate-pulse rounded-md bg-surface-2" />
          {conLinea ? <div className="my-2 h-3" /> : <div className="h-2.5" />}
          {conLinea && <div className="h-[15px] py-[3px]"><div className="h-full w-12 animate-pulse rounded bg-surface-2" /></div>}
          <div className="mt-0.5 h-[33px] space-y-[4.5px] pt-[2px]">
            <div className="h-3 w-full animate-pulse rounded bg-surface-2" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-surface-2" />
          </div>
          <div className="mt-0.5 h-[16px]" />
        </div>
      ))}
    </div>
  )
}

// La saga todavía no se sabe si existe, así que su título tampoco: una barra
// que late en su lugar, y la misma línea de tiempo en blanco.
function ReservaSaga() {
  return (
    <section className="mb-8" aria-label="Buscando la saga">
      <div className="mb-3 flex h-[16.5px] items-center">
        <div className="h-2.5 w-36 animate-pulse rounded bg-surface-2" />
      </div>
      <ReservaTira conLinea />
    </section>
  )
}

// Aparecer y desaparecer abriendo su hueco poco a poco, no de golpe: lo que
// hay debajo baja acompañando en vez de saltar.
function Desplegable({ children }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
    >
      {children}
    </motion.div>
  )
}

// Fila de portadas que se desliza de lado y llega hasta el borde de la
// pantalla (el margen negativo compensa el de la ficha), como la fila de
// personas de Actividad.
function Tira({ children, refTira }) {
  return (
    <div ref={refTira} className="tira-sin-barra -mx-6 flex snap-x snap-proximity gap-3 overflow-x-auto scroll-px-6 px-6 pb-1">
      {children}
    </div>
  )
}

const ANCHO_PORTADA = 'w-[88px]'

// ─── La saga ─────────────────────────────────────────────────────────────────
//
// Una línea de tiempo debajo de las portadas: los tomos anteriores, con el
// punto relleno; este, más grande y en el color de acento; los siguientes,
// solo con el contorno. Se lee de un vistazo qué va antes y qué después sin
// tener que mirar los números. Los que la fuente no numera (relatos,
// novelas del mismo mundo) van al final, aparte y fuera de la línea.
function Saga({ grupo, onElegir }) {
  const numerados = grupo.books.filter(b => b.position != null)
  const sueltos = grupo.books.filter(b => b.position == null)
  const iActual = numerados.findIndex(b => b.is_current)
  const actual = iActual >= 0 ? numerados[iActual] : null

  // Se abre con este libro a la vista, ya colocado: sin animación, porque lo
  // que se quiere es que esté ahí al aparecer, no ver cómo se desplaza.
  const tira = useRef(null)
  const marcado = useRef(null)
  useEffect(() => {
    const t = tira.current, m = marcado.current
    if (!t || !m) return
    t.scrollLeft = Math.max(0, m.offsetLeft - (t.clientWidth - m.offsetWidth) / 2)
  }, [])

  return (
    <section className="mb-8">
      <h3 className="mb-3 flex items-baseline justify-between gap-3 text-[11px] uppercase tracking-[0.14em] text-ink-mute">
        <span className="min-w-0 truncate">{grupo.label}</span>
        {actual && (
          <span className="shrink-0 normal-case tracking-normal">
            Libro {formatoTomo(actual.position)} de {numerados.length}
          </span>
        )}
      </h3>
      <Tira refTira={tira}>
        {numerados.map((b, i) => (
          <Sugerencia
            key={`${b.title}-${i}`}
            s={b}
            onElegir={onElegir}
            refNodo={b.is_current ? marcado : undefined}
            linea={{
              primero: i === 0,
              ultimo: i === numerados.length - 1,
              momento: iActual < 0 ? 'despues' : i < iActual ? 'antes' : i === iActual ? 'ahora' : 'despues',
              // El tramo de línea que sale hacia el siguiente va relleno
              // mientras no se haya pasado de este libro.
              tramoRelleno: iActual >= 0 && i < iActual,
            }}
            etiqueta={b.is_current ? 'Este libro' : `Libro ${formatoTomo(b.position)}`}
          />
        ))}
        {sueltos.length > 0 && numerados.length > 0 && (
          <div className="w-px shrink-0 self-stretch bg-line" aria-hidden />
        )}
        {sueltos.map((b, i) => (
          <Sugerencia key={`s-${b.title}-${i}`} s={b} onElegir={onElegir} etiqueta={b.is_current ? 'Este libro' : 'Extra'} />
        ))}
      </Tira>
    </section>
  )
}

function formatoTomo(n) {
  return Number.isInteger(n) ? n : String(n).replace('.', ',')
}

function PuntoDeLinea({ primero, ultimo, momento, tramoRelleno }) {
  const lleno = 'var(--color-ink-mute)'
  return (
    <div className="relative my-2 flex h-3 items-center justify-center" aria-hidden>
      {/* Medio tramo a cada lado del punto, más la mitad del hueco entre
          portadas (gap-3 = 12px): unidos, forman una línea continua. */}
      {!primero && (
        <span
          className="absolute left-[-6px] right-1/2 top-1/2 h-px -translate-y-1/2"
          style={{ background: momento === 'despues' ? 'var(--color-line)' : lleno }}
        />
      )}
      {!ultimo && (
        <span
          className="absolute left-1/2 right-[-6px] top-1/2 h-px -translate-y-1/2"
          style={{ background: tramoRelleno ? lleno : 'var(--color-line)' }}
        />
      )}
      {momento === 'ahora' ? (
        <span className="relative h-3 w-3 rounded-full bg-accent ring-4 ring-[color:var(--color-accent-soft)]" />
      ) : (
        <span
          className="relative h-[7px] w-[7px] rounded-full border"
          style={momento === 'antes'
            ? { background: lleno, borderColor: lleno }
            : { background: 'var(--color-bg)', borderColor: 'var(--color-ink-mute)' }}
        />
      )}
    </div>
  )
}

// ─── Cada libro sugerido ─────────────────────────────────────────────────────
//
// Lo que ya tienes se ve de un vistazo: la portada algo apagada, con una
// marca en la esquina del color de su estado (verde si lo has leído), y
// debajo lo dice con palabras. Así no hace falta abrirlo para saber que no
// hay que añadirlo otra vez — y la hoja, si se abre, tampoco deja hacerlo.
function Sugerencia({ s, onElegir, etiqueta, linea, refNodo }) {
  const tuyo = s.in_shelf && !s.is_current
  const actual = s.is_current
  return (
    <div ref={refNodo} className={`${ANCHO_PORTADA} shrink-0 snap-start`}>
      <motion.button
        onClick={() => !actual && onElegir(s)}
        disabled={actual}
        whileTap={actual ? undefined : { scale: 0.96 }}
        aria-label={actual ? `${s.title} (este libro)` : s.title}
        className="block w-full text-left"
      >
        <div
          className={`relative rounded-md ${actual ? 'ring-2 ring-accent ring-offset-2 ring-offset-[color:var(--color-bg)]' : ''}`}
        >
          <div style={{ opacity: tuyo ? 0.55 : 1 }} className="transition-opacity">
            <Cover url={s.cover_url} title={s.title} />
          </div>
          {tuyo && (
            <span
              className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[color:var(--color-bg)] text-on-accent"
              style={{ background: STATUS_COLOR[s.shelf_status] || 'var(--color-read)' }}
            >
              <IconCheck className="h-3.5 w-3.5" />
            </span>
          )}
        </div>

        {linea ? <PuntoDeLinea {...linea} /> : <div className="h-2.5" />}

        {/* Alto fijo en cada renglón (la etiqueta, dos de título y el de
            "Ya lo tienes" aunque vaya vacío): todas las portadas de la tira
            miden lo mismo y la reserva de mientras carga (ReservaTira) ocupa
            exactamente lo que ocuparán ellas. */}
        {etiqueta && (
          <span className={`block h-[15px] text-[10px] leading-[15px] uppercase tracking-[0.1em] ${actual ? 'font-semibold text-accent' : 'text-ink-mute'}`}>
            {etiqueta}
          </span>
        )}
        <span className="mt-0.5 block h-[33px]">
          <span className={`line-clamp-2 text-[12px] leading-[16.5px] ${tuyo ? 'text-ink-dim' : 'text-ink'}`}>
            {s.title}
          </span>
        </span>
        <span className="mt-0.5 block h-[16px] text-[11px] leading-[16px] text-ink-mute">
          {tuyo ? 'Ya lo tienes' : ''}
        </span>
      </motion.button>
    </div>
  )
}

// ─── La hoja de un libro sugerido ────────────────────────────────────────────
//
// Un toque abre lo justo para decidir (portada, datos, sinopsis) y el botón de
// añadir. Nada de mantener pulsado para añadir, como en la Puchi anterior: es
// un gesto que no se descubre solo.
// `hoja` es un useHoja(null): su valor abierto es la propia sugerencia.
export function HojaSugerencia({ hoja, onAnadido, onAbrirLibro }) {
  const s = hoja.abierta
  // La hoja no se desmonta al cerrarse: se queda con la última sugerencia
  // para que el contenido no desaparezca mientras baja.
  const ultima = useRef(null)
  if (s) ultima.current = s
  const v = s || ultima.current

  return (
    <HojaInferior
      abierta={!!hoja.abierta}
      titulo={v?.title || ''}
      onCerrar={hoja.cerrar}
      pie={v && <PieSugerencia key={`${v.title}-${v.open_lib_key}-${v.book_id}`} s={v} onAnadido={onAnadido} onAbrirLibro={onAbrirLibro} onCerrar={hoja.cerrar} />}
    >
      {v && (
        <div className="pb-2">
          <div className="flex gap-4">
            <div className="w-[96px] shrink-0">
              <Cover url={v.cover_url} title={v.title} />
            </div>
            <div className="min-w-0 flex-1 pt-1">
              {v.author && <p className="text-[15px] text-ink-dim">{v.author}</p>}
              {(v.year || v.num_pages || v.genre) && (
                <p className="mt-1.5 text-xs text-ink-mute">
                  {[v.genre, v.year, v.num_pages && `${v.num_pages} pág.`].filter(Boolean).join(' · ')}
                </p>
              )}
              {v.in_shelf && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-ink-dim">
                  <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[v.shelf_status] || 'var(--color-read)' }} />
                  En tu estantería{STATUS_LABEL[v.shelf_status] ? ` · ${STATUS_LABEL[v.shelf_status]}` : ''}
                </p>
              )}
            </div>
          </div>
          {v.synopsis ? (
            <p className="mt-5 whitespace-pre-line text-[15px] leading-[1.7] text-ink-dim">{textoPlano(v.synopsis)}</p>
          ) : (
            <p className="mt-5 text-sm text-ink-mute">Sin sinopsis.</p>
          )}
        </div>
      )}
    </HojaInferior>
  )
}

// Las sinopsis de Google Books vienen a veces con etiquetas HTML sueltas.
function textoPlano(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function PieSugerencia({ s, onAnadido, onAbrirLibro, onCerrar }) {
  const [estado, setEstado] = useState('nada')   // nada | guardando | hecho | ya | error

  // Ya lo tienes: no hay nada que añadir. Si quien abre la ficha sabe llevarte
  // a la tuya (tu estantería), se ofrece; si no, la hoja solo informa.
  if (s.in_shelf && estado === 'nada') {
    return onAbrirLibro && s.book_id ? (
      <button
        onClick={() => { onCerrar(); onAbrirLibro(s.book_id) }}
        className="flex h-12 w-full items-center justify-center rounded-xl2 border border-line bg-surface text-[15px] font-semibold text-ink transition-transform active:scale-[0.99]"
      >
        Ver su ficha
      </button>
    ) : (
      <p className="flex h-12 w-full items-center justify-center gap-2 text-[15px] text-ink-dim">
        <IconCheck className="h-[18px] w-[18px] text-read" />
        Ya está en tu estantería
      </p>
    )
  }

  const texto = {
    nada: 'Añadir a mi estantería',
    guardando: 'Añadiendo…',
    hecho: 'Añadido a tu estantería',
    ya: 'Ya estaba en tu estantería',
    error: 'No se ha podido añadir. Reintentar',
  }[estado]
  const puesto = estado === 'hecho' || estado === 'ya'

  return (
    <button
      disabled={estado === 'guardando' || puesto}
      onClick={async () => {
        setEstado('guardando')
        try {
          const entrada = await api('/shelf/personal', {
            method: 'POST',
            body: {
              book_id: s.book_id,
              open_lib_key: s.open_lib_key,
              title: s.title,
              author: s.author,
              cover_url: s.cover_url,
              isbn: s.isbn,
              num_pages: s.num_pages,
              genre: s.genre,
              year: s.year,
              synopsis: s.synopsis ? textoPlano(s.synopsis) : null,
              status: 'want_to_read',
              // Para distinguir en los datos lo añadido desde aquí.
              origin: 'related',
            },
          })
          setEstado('hecho')
          onAnadido(s, entrada)
        } catch (e) {
          if (e?.status === 409) {
            setEstado('ya')
            onAnadido(s, null)
          } else {
            setEstado('error')
          }
        }
      }}
      className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl2 text-[15px] font-semibold transition-[transform,background-color,color] active:scale-[0.99] ${
        puesto
          ? 'border border-line bg-surface text-ink-dim'
          : estado === 'error'
            ? 'bg-surface-2 text-ink'
            : 'bg-accent text-on-accent'
      }`}
    >
      {puesto && <IconCheck className="h-[18px] w-[18px] text-accent" />}
      {texto}
    </button>
  )
}
