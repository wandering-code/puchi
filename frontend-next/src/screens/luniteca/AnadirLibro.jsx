import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../../platform/api'
import { STATUS_LABEL } from './shelf'
import { Cover } from './piezas'
import PantallaInferior from './PantallaInferior'
import { CamposFecha } from './editores'
import { IconCheck, IconPlus, IconSearch, IconX } from '../../ui/icons'

// Añadir un libro: buscándolo (en lo que ya tiene el club y en Open Library) o
// escribiéndolo a mano cuando la búsqueda no lo encuentra.
//
// `destino` dice dónde va. 'personal' es tu estantería, lo de siempre. 'club'
// es la estantería del club, donde un libro no se añade sino que se PROPONE:
// entra como propuesta y es el admin quien decide cuál se lee. Es la misma
// búsqueda, la misma alta a mano y la misma pantalla — solo cambia a qué
// endpoint se manda y cómo se llama la acción—, así que no hay dos altas de
// libro que mantener en paralelo.
//
// Falta el escáner de código de barras que tiene la Puchi actual; irá en su
// propia pasada, porque trae dependencia nueva y permisos de cámara.
export default function AnadirLibro({ onCerrar, onAnadido, destino = 'personal' }) {
  const alClub = destino === 'club'
  const [modo, setModo] = useState('buscar')

  return (
    <PantallaInferior
      onCerrar={onCerrar}
      cabecera={
        <div className="mx-auto w-full max-w-md px-6">
          <div className="flex items-center gap-3 py-3">
            <h2 className="flex-1 font-display text-xl font-bold tracking-[-0.01em]">
              {alClub ? 'Proponer al club' : 'Añadir libro'}
            </h2>
            <button
              onClick={onCerrar}
              aria-label="Cerrar"
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-mute transition-colors active:bg-surface-2"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-4 flex gap-2">
            {[['buscar', 'Buscar'], ['manual', 'A mano']].map(([id, texto]) => (
              <button
                key={id}
                onClick={() => setModo(id)}
                className={`relative flex-1 rounded-xl2 py-2.5 text-sm font-semibold transition-colors ${
                  modo === id ? 'text-accent' : 'text-ink-dim'
                }`}
              >
                {modo === id && (
                  <motion.span
                    layoutId="anadir-modo"
                    className="absolute inset-0 rounded-xl2 bg-accent-soft"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">{texto}</span>
              </button>
            ))}
          </div>
        </div>
      }
    >
      {/* A pantalla completa, el alto ya no cambia al pasar de una pestaña a
          otra: solo se cruzan los contenidos. Antes era una hoja que crecía y
          encogía según lo que hubiera dentro, y ese salto se notaba. */}
      <div className="mx-auto w-full max-w-md px-6 pb-kb">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={modo}
            initial={{ opacity: 0, x: modo === 'buscar' ? -16 : 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: modo === 'buscar' ? 16 : -16 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {modo === 'buscar'
              ? <Buscador onAnadido={onAnadido} alClub={alClub} />
              : <AltaManual onAnadido={onAnadido} onHecho={onCerrar} alClub={alClub} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </PantallaInferior>
  )
}

// ─── Buscar ────────────────────────────────────────────────────────────────
function Buscador({ onAnadido, alClub }) {
  const [consulta, setConsulta] = useState('')
  const [resultados, setResultados] = useState(null)   // null = sin buscar todavía
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState(null)

  async function buscar(ev) {
    ev?.preventDefault()
    const q = consulta.trim()
    // El servidor pide tres caracteres como mínimo; se avisa aquí en vez de
    // mandar una petición que ya se sabe que va a fallar.
    if (q.length < 3) { setError('Escribe al menos 3 letras'); return }
    setBuscando(true); setError(null)
    try {
      const datos = await api(`/books/search?q=${encodeURIComponent(q)}`)
      setResultados(datos)
      if (datos.length === 0) setError(`Sin resultados para "${q}"`)
    } catch (err) {
      setResultados(null)
      setError(err.message || 'No se ha podido buscar')
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div>
      <form onSubmit={buscar} className="flex gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl2 border border-line bg-bg px-3">
          <IconSearch className="h-4 w-4 shrink-0 text-ink-mute" />
          <input
            value={consulta}
            onChange={e => { setConsulta(e.target.value); setError(null) }}
            placeholder="Título o autor"
            // search: en el móvil el teclado enseña "buscar" en vez de "intro"
            enterKeyHint="search"
            className="h-12 w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:text-ink-mute"
          />
          {consulta && (
            <button type="button" onClick={() => { setConsulta(''); setResultados(null); setError(null) }} aria-label="Limpiar" className="p-1 text-ink-mute">
              <IconX className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={buscando}
          className="h-12 shrink-0 rounded-xl2 bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-60"
        >
          {buscando ? '…' : 'Buscar'}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {buscando && (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="h-[72px] w-12 animate-pulse rounded-md bg-surface-2" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 w-3/4 animate-pulse rounded bg-surface-2" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-surface-2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {resultados && !buscando && (
        <div className="mt-4 divide-y divide-[color:var(--color-line)]">
          {resultados.map((libro, i) => (
            <Resultado key={libro.book_id ?? libro.open_lib_key ?? i} libro={libro} onAnadido={onAnadido} alClub={alClub} />
          ))}
        </div>
      )}

      {resultados === null && !buscando && !error && (
        <p className="mt-4 text-sm leading-relaxed text-ink-mute">
          Busca por título o por autor. Salen primero los libros que ya tiene alguien del
          club, que vienen con su portada y sus datos puestos.
          {alClub && ' Lo que elijas entra como propuesta: el admin decide cuál se lee.'}
        </p>
      )}
    </div>
  )
}

function Resultado({ libro, onAnadido, alClub }) {
  // "Ya lo tienes" es de TU estantería: en el club no dice nada, porque lo que
  // importa ahí es si el libro ya está propuesto, y eso no lo trae la búsqueda
  // — lo contesta el servidor con un 409 al intentarlo.
  const [estado, setEstado] = useState(!alClub && libro.added_by_me ? 'hecho' : 'quieto')

  async function anadir() {
    setEstado('anadiendo')
    try {
      const entrada = alClub
        ? await api('/shelf/club', { method: 'POST', body: { ...libro } })
        : await api('/shelf/personal', { method: 'POST', body: { ...libro, status: 'want_to_read', origin: 'search' } })
      onAnadido(entrada)
      setEstado('hecho')
    } catch (err) {
      // 409 no es un fallo, es la respuesta: el libro ya estaba. Se queda
      // dicho en el sitio en vez de parpadear en rojo y volver a ofrecerse.
      if (err?.status === 409) { setEstado('ya'); return }
      setEstado('error')
      setTimeout(() => setEstado('quieto'), 2000)
    }
  }

  // Que otro lo tenga no impide añadirlo; solo tenerlo ya tú.
  const nota = libro.added_by_me
    ? 'ya lo tienes'
    : libro.added_by?.length
      ? `lo tiene ${libro.added_by.slice(0, 2).join(', ')}${libro.added_by.length > 2 ? ` y ${libro.added_by.length - 2} más` : ''}`
      : null

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-12 shrink-0">
        <Cover url={libro.cover_url} title={libro.title} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-tight">{libro.title}</p>
        <p className="mt-0.5 truncate text-xs text-ink-mute">{libro.author || 'Sin autor'}</p>
        {nota && <p className="mt-0.5 truncate text-[11px] text-ink-mute/80">{nota}</p>}
      </div>
      <BotonAnadir
        estado={estado}
        onAnadir={anadir}
        etiqueta={alClub ? 'Proponer al club' : 'Añadir a mi estantería'}
      />
    </div>
  )
}

function BotonAnadir({ estado, onAnadir, etiqueta }) {
  // Puesto ahora ('hecho') y puesto de antes ('ya') se ven distinto: el
  // primero es algo que acabas de hacer y se celebra en verde; el segundo solo
  // informa, y en verde parecería que ha pasado algo cuando no ha pasado nada.
  if (estado === 'hecho' || estado === 'ya') {
    return (
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 480, damping: 26 }}
        title={estado === 'ya' ? 'Ya estaba' : 'Hecho'}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          estado === 'ya' ? 'bg-surface-2 text-ink-mute' : 'bg-read/15 text-read'
        }`}
      >
        <IconCheck className="h-5 w-5" />
      </motion.span>
    )
  }
  return (
    <motion.button
      onClick={onAnadir}
      disabled={estado === 'anadiendo'}
      whileTap={{ scale: 0.92 }}
      aria-label={etiqueta}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors ${
        estado === 'error' ? 'border-danger text-danger' : 'border-accent-line text-accent'
      }`}
    >
      {estado === 'anadiendo'
        ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} className="flex"><IconPlus className="h-5 w-5" /></motion.span>
        : <IconPlus className="h-5 w-5" />}
    </motion.button>
  )
}

// ─── A mano ────────────────────────────────────────────────────────────────
// Para lo que la búsqueda no encuentra: ediciones raras, libros que no están en
// Open Library, o cosas que no son libros al uso.
function AltaManual({ onAnadido, onHecho, alClub }) {
  const [datos, setDatos] = useState({
    title: '', author: '', genre: '', year: '', num_pages: '',
    status: 'want_to_read', started_at: '', finished_at: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const primero = useRef(null)

  const set = (clave) => (ev) => setDatos(d => ({ ...d, [clave]: ev.target.value }))
  // Un libro propuesto al club no tiene estado ni fechas que elegir: entra
  // siempre como propuesta, y cuándo se empieza y se termina lo pone el admin
  // desde la ficha cuando toca. Así que en el club esas dos partes del
  // formulario no existen.
  const llevaInicio = !alClub && (datos.status === 'reading' || datos.status === 'read')
  const llevaFin = !alClub && datos.status === 'read'

  async function guardar(ev) {
    ev.preventDefault()
    if (!datos.title.trim()) { setError('El título es lo único imprescindible'); primero.current?.focus(); return }
    setGuardando(true); setError(null)
    const libro = {
      title: datos.title.trim(),
      author: datos.author.trim() || null,
      genre: datos.genre.trim() || null,
      year: datos.year ? Number(datos.year) : null,
      num_pages: datos.num_pages ? Number(datos.num_pages) : null,
    }
    try {
      if (alClub) {
        onAnadido(await api('/shelf/club', { method: 'POST', body: libro }))
        onHecho()
        return
      }
      const entrada = await api('/shelf/personal', {
        method: 'POST',
        body: { ...libro, status: datos.status, origin: 'search' },
      })
      // El alta no admite fechas (el servidor solo las usa para registrar
      // actividad), así que si se han puesto van en un segundo paso.
      const fechas = {}
      if (llevaInicio && datos.started_at) fechas.started_at = datos.started_at
      if (llevaFin && datos.finished_at) fechas.finished_at = datos.finished_at
      const conFechas = Object.keys(fechas).length
        ? await api(`/shelf/personal/${entrada.id}`, { method: 'PATCH', body: fechas })
        : entrada
      onAnadido(conFechas)
      onHecho()
    } catch (err) {
      setError(err.status === 409 && alClub
        ? 'Ese libro ya está en la estantería del club'
        : (err.message || 'No se ha podido añadir'))
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} className="pb-2">
      <Campo etiqueta="Título">
        <input ref={primero} value={datos.title} onChange={set('title')} className={ENTRADA} />
      </Campo>
      <Campo etiqueta="Autor">
        <input value={datos.author} onChange={set('author')} className={ENTRADA} />
      </Campo>
      <Campo etiqueta="Género">
        <input value={datos.genre} onChange={set('genre')} className={ENTRADA} />
      </Campo>
      <div className="flex gap-3">
        <Campo etiqueta="Año" className="flex-1">
          <input
            value={datos.year}
            onChange={ev => setDatos(d => ({ ...d, year: ev.target.value.replace(/\D/g, '').slice(0, 4) }))}
            inputMode="numeric" placeholder="—" className={ENTRADA}
          />
        </Campo>
        <Campo etiqueta="Páginas" className="flex-1">
          <input
            value={datos.num_pages}
            onChange={ev => setDatos(d => ({ ...d, num_pages: ev.target.value.replace(/\D/g, '').slice(0, 5) }))}
            inputMode="numeric" placeholder="—" className={ENTRADA}
          />
        </Campo>
      </div>

      {!alClub && (
      <Campo etiqueta="Cómo entra en tu estantería">
        <div className="flex flex-wrap gap-2">
          {['want_to_read', 'reading', 'read'].map(id => (
            <button
              key={id}
              type="button"
              onClick={() => setDatos(d => ({ ...d, status: id }))}
              className={`relative rounded-full border px-3.5 py-2 text-sm transition-colors ${
                datos.status === id ? 'border-accent-line text-accent' : 'border-line text-ink-dim'
              }`}
            >
              {datos.status === id && (
                <motion.span
                  layoutId="alta-estado"
                  className="absolute inset-0 rounded-full bg-accent-soft"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative">{STATUS_LABEL[id]}</span>
            </button>
          ))}
        </div>
      </Campo>
      )}

      {/* Las fechas que tienen sentido para el estado elegido, y solo esas:
          un libro por leer no tiene ninguna, uno que estás leyendo tiene
          cuándo lo empezaste, y uno leído tiene las dos. Se pueden dejar en
          blanco — se guarda lo que pongas. */}
      <Plegable abierta={llevaInicio}>
        <Campo etiqueta="Empezado">
          <CamposFecha value={datos.started_at} onChange={v => setDatos(d => ({ ...d, started_at: v }))} />
        </Campo>
      </Plegable>
      <Plegable abierta={llevaFin}>
        <Campo etiqueta="Terminado">
          <CamposFecha value={datos.finished_at} onChange={v => setDatos(d => ({ ...d, finished_at: v }))} />
        </Campo>
      </Plegable>

      <AnimatePresence>
        {error && (
          <motion.p
            className="mt-3 text-sm text-danger"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <motion.button
        type="submit"
        disabled={guardando}
        whileTap={{ scale: 0.98 }}
        className="mt-5 h-12 w-full rounded-xl2 bg-accent text-[15px] font-semibold text-on-accent disabled:opacity-60"
      >
        {guardando
          ? (alClub ? 'Proponiendo…' : 'Añadiendo…')
          : (alClub ? 'Proponer al club' : 'Añadir a mi estantería')}
      </motion.button>
    </form>
  )
}

// Alto animado con height:auto, que motion sí sabe interpolar: los campos de
// fecha entran y salen, no aparecen de golpe.
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

const ENTRADA = 'h-12 w-full rounded-xl2 border border-line bg-bg px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-mute focus:border-accent-line'

function Campo({ etiqueta, className = '', children }) {
  return (
    <label className={`mt-4 block ${className}`}>
      <span className="mb-1.5 block px-1 text-[13px] text-ink-dim">{etiqueta}</span>
      {children}
    </label>
  )
}
