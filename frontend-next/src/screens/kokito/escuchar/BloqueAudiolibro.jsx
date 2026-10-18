import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../../../platform/api'
import { useCapa } from '../../../platform/capas'
import HojaInferior from '../../luniteca/HojaInferior'
import { useReproductor } from '../../../platform/reproductor'
import { IconAuriculares, IconCheck, IconEreader as IconLibroAbierto, IconLibroFisico, IconPausa, IconPlay, IconX } from '../../../ui/icons'
import { Girando } from '../audiolibros/Audiolibros'
import { duracion, reloj } from '../audiolibros/formato'
import { Ecualizador } from './PantallaReproductor'
import MuestraDeVoz from './MuestraDeVoz'

// En la ficha de un libro de tu estantería (/kokito):
// - si tiene audiolibro, para escucharlo (fase 3, #65);
// - si no, para pedirlo y ver cómo va la petición (fase 6, #68).

const SUAVE = { duration: 0.24, ease: [0.22, 1, 0.36, 1] }

export default function BloqueAudiolibro({ bookId, abierta }) {
  const r = useReproductor()
  const [datos, setDatos] = useState(null)
  const [peticion, setPeticion] = useState(null)

  // Cada vez que se abre la ficha: puede haber capítulos nuevos, se ha
  // seguido escuchando en otro dispositivo o el admin ha atendido la petición.
  useEffect(() => {
    if (!r || !abierta) return
    let vivo = true
    api(`/listen/book/${bookId}`).then(d => vivo && setDatos(d)).catch(() => vivo && setDatos(null))
    api(`/audiobook-requests/book/${bookId}`).then(d => vivo && setPeticion(d)).catch(() => vivo && setPeticion(null))
    return () => { vivo = false }
  }, [bookId, abierta, r])

  if (!r) return null
  // Con el EPUB subido llega aunque no haya nada generado (#78): entonces se
  // puede leer, pero lo del audio sigue siendo la petición.
  const hayAudio = datos && datos.id != null && !(datos.status === 'borrador' && !datos.chapters_ready)
  const hayPeticion = !hayAudio && peticion && (peticion.can_request || peticion.status)
  const hayTexto = datos && datos.id != null && datos.chapters_total > 0

  return (
    <>
      <AnimatePresence initial={false} mode="wait">
        {hayAudio && <Escuchar key="audio" r={r} datos={datos} pedido={peticion?.requested} leer={hayTexto} />}
        {hayPeticion && <Peticion key="peticion" bookId={bookId} peticion={peticion} onCambio={setPeticion} />}
      </AnimatePresence>
      {/* Sin audio que enseñar, el libro aparte, discreto a la derecha. */}
      {hayTexto && !hayAudio && (
        <div className="mt-2 flex w-full justify-end">
          <BotonLeer r={r} datos={datos} />
        </div>
      )}
    </>
  )
}

// Leer el libro en la app (#78): solo un icono, a petición del usuario, para
// no quitarle protagonismo al audiolibro.
function BotonLeer({ r, datos }) {
  const leido = datos.read && datos.chapters.find(c => c.id === datos.read.chapter_id)
  const etiqueta = leido ? `Seguir leyendo: «${leido.title}»` : 'Leer el libro aquí'
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={() => r.leer(datos)}
      aria-label={etiqueta}
      title={etiqueta}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent-line bg-surface text-accent"
    >
      <IconLibroFisico className="h-5 w-5" />
    </motion.button>
  )
}

function Escuchar({ r, datos, pedido, leer }) {
  const esteSuena = r.libro?.id === datos.id && r.cap
  const sonando = esteSuena && r.sonando
  const hayAlgo = datos.chapters_ready > 0
  const guardado = datos.progress && datos.chapters.find(c => c.id === datos.progress.chapter_id)

  let detalle
  if (esteSuena) {
    detalle = `${r.cap.title} · ${reloj(r.t)} de ${reloj(r.dur)}`
  } else if (guardado) {
    const pct = datos.progress.percent != null ? ` · ${Math.round(datos.progress.percent * 100)} % del libro` : ''
    detalle = `Vas por «${guardado.title}»${pct}`
  } else if (datos.start_chapter_id && hayAlgo) {
    const desde = datos.chapters.find(c => c.id === datos.start_chapter_id)
    const porque = datos.start_reason === 'lectura' ? 'donde vas leyendo' : 'como pediste'
    detalle = desde ? `Empezará por «${desde.title}», ${porque}` : `${datos.chapters_ready} de ${datos.chapters_total} capítulos listos`
  } else if (!hayAlgo) {
    detalle = datos.status === 'generando'
      ? 'Generando el primer capítulo…'
      : datos.status === 'en_cola' ? 'En cola: pronto empieza a generarse' : 'Se está preparando'
  } else if (datos.chapters_ready < datos.chapters_total) {
    detalle = `${datos.chapters_ready} de ${datos.chapters_total} capítulos listos · llegan más`
  } else {
    detalle = `${datos.chapters_total} capítulos · ${duracion(datos.audio_minutes)}`
  }

  // Dos gestos distintos, a petición del usuario:
  // - el bloque entero abre la vista del reproductor (sin arrancar nada que no
  //   estuviera sonando),
  // - el play solo pone a sonar, donde se dejó o desde el principio, y deja
  //   el mini de abajo: no saca de la ficha del libro.
  // En los dos casos manda lo último que ha llegado aquí, que incluye los
  // capítulos recién generados y la posición guardada en otro dispositivo.
  function abrirVista() {
    if (esteSuena) r.pantalla.abrir()
    else r.abrir(datos, { reproducir: false })
  }
  function play() {
    if (esteSuena) r.alternar()
    else r.abrir(datos, { reproducir: true, mostrar: false })
  }

  // Leyendo vas por delante de lo escuchado (#71): escuchar desde el capítulo
  // de tu página. Si este libro ya está cargado, basta con cambiar de
  // capítulo; si no, se abre empezando ahí.
  const lectura = datos.reading
  const capLectura = lectura && datos.chapters.find(c => c.id === lectura.chapter_id)
  function desdeLectura() {
    if (!capLectura?.ready) return
    if (r.libro?.id === datos.id) r.elegir(capLectura)
    else r.abrir({ ...datos, progress: { chapter_id: capLectura.id, position_s: 0 } }, { reproducir: true, mostrar: false })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={SUAVE}
      className="mt-6 w-full"
    >
      <div className="flex items-center gap-3 rounded-xl3 border border-accent-line bg-accent-soft/50 p-3 text-left">
        <button onClick={abrirVista} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-accent shadow-sm">
            {sonando ? <Ecualizador activo /> : <IconAuriculares className="h-5 w-5" />}
          </span>
          <span className="min-w-0">
            <span className="block font-display text-[15px] font-bold leading-tight">
              {sonando ? 'Sonando ahora' : !hayAlgo && pedido ? 'Tu audiolibro' : 'Audiolibro'}
            </span>
            <span className="mt-0.5 block truncate text-xs text-ink-dim">{detalle}</span>
          </span>
        </button>
        {leer && <BotonLeer r={r} datos={datos} />}
        {hayAlgo && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={play}
            aria-label={sonando ? 'Pausa' : guardado ? 'Seguir escuchando' : 'Escuchar'}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-sm"
          >
            {sonando ? <IconPausa className="h-5 w-5" /> : <IconPlay className="ml-0.5 h-5 w-5" />}
          </motion.button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {lectura?.ahead && capLectura && r.cap?.id !== capLectura.id && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={SUAVE}
            className="overflow-hidden"
          >
            <div className="mt-2 flex items-center gap-3 rounded-xl2 border border-line bg-surface px-3 py-2.5 text-left">
              <IconLibroAbierto className="h-4 w-4 shrink-0 text-ink-mute" />
              <span className="min-w-0 flex-1 text-xs leading-snug text-ink-dim">
                Leyendo vas por la pág. {lectura.page} de {lectura.of}
                <span className="block truncate text-ink-mute">«{capLectura.title}»</span>
              </span>
              {capLectura.ready ? (
                <button
                  onClick={desdeLectura}
                  className="shrink-0 rounded-full border border-accent-line bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent"
                >
                  Escuchar desde ahí
                </button>
              ) : (
                <span className="shrink-0 text-[11px] text-ink-mute">Aún no está listo</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Lo que se dice en cada momento de la petición.
const TEXTOS = {
  pedido:     { titulo: 'Audiolibro pedido', nota: 'Aquí verás cómo avanza' },
  preparando: { titulo: 'Tu audiolibro está en marcha', nota: 'Pronto entra en cola' },
  en_cola:    { titulo: 'Tu audiolibro está en cola', nota: 'Empezará a generarse pronto' },
  generando:  { titulo: 'Generando tu audiolibro', nota: 'Primer capítulo en camino' },
  rechazado:  { titulo: 'No se va a preparar', nota: 'De momento este libro se queda sin audio' },
}

// Las páginas en las que piensa quien pide. La página se guarda como
// current_page, en las del físico (ver shelf.js); quien lee en eReader la ve
// y la escribe en las de su eReader, con la misma regla de tres que la ficha.
function ladoDe(p) {
  const base = p.total_pages
  const er = p.ereader_total_pages
  const f = p.reading_format === 'ereader' && er && base && er !== base ? er / base : 1
  return {
    total: f === 1 ? base : er,
    donde: f === 1 ? '' : ' de tu eReader',
    aLado: n => (n == null ? n : Math.max(1, Math.round(n * f))),
    aBase: n => Math.max(1, Math.round(n / f)),
  }
}

// "Desde la pág. 120", "Desde «el tres»" o nada si es desde el principio.
function textoDeseo(p) {
  if (p.start_chapter) return `Desde «${p.start_chapter}»`
  if (p.start_page) return `Desde la pág. ${ladoDe(p).aLado(p.start_page)}`
  return null
}

function Peticion({ bookId, peticion, onCambio }) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const hoja = useCapa()
  const { status, others } = peticion

  async function cambiar(metodo, cuerpo) {
    setEnviando(true)
    setError(null)
    try {
      onCambio(await api(`/audiobook-requests/book/${bookId}`, { method: metodo, body: cuerpo }))
      return true
    } catch (e) {
      setError(e.message)
      return false
    } finally {
      setEnviando(false)
    }
  }

  const hojaDesde = (
    <HojaDesde
      peticion={peticion}
      abierta={hoja.abierta}
      onCerrar={hoja.cerrar}
      onGuardar={async deseo => {
        if (await cambiar(status ? 'PATCH' : 'POST', deseo)) hoja.cerrar()
      }}
    />
  )

  const esperan = others === 1 ? '1 persona más lo espera' : others > 1 ? `${others} personas más lo esperan` : null

  // Sin pedir: discreto, en línea discontinua, para no competir con lo
  // importante de la ficha. Una vez pedido toma el color del audiolibro.
  if (!status) {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SUAVE} className="mt-6 w-full">
        <div className="flex items-center gap-3 rounded-xl3 border border-dashed border-line p-3 text-left">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-dim">
            <IconAuriculares className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[15px] font-bold leading-tight">¿Lo quieres escuchar?</span>
            <span className="mt-0.5 line-clamp-2 block text-xs text-ink-dim">
              {error || esperan || 'Pídelo como audiolibro'}
            </span>
          </span>
          <motion.button
            whileTap={{ scale: 0.94 }}
            disabled={enviando}
            onClick={() => hoja.abrir()}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-3.5 text-xs font-semibold text-accent disabled:opacity-70"
          >
            {enviando && <Girando className="h-3.5 w-3.5" />}
            Pedir
          </motion.button>
        </div>
        {hojaDesde}
      </motion.div>
    )
  }

  const t = TEXTOS[status] || TEXTOS.pedido
  const rechazado = status === 'rechazado'
  const deseo = textoDeseo(peticion)
  const base = status === 'pedido' && others ? `Tú y ${others} más lo esperáis` : t.nota
  const nota = error || (rechazado ? (peticion.reason || t.nota) : deseo ? `${deseo} · ${base}` : base)

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SUAVE} className="mt-6 w-full">
      <div className={`flex items-center gap-3 rounded-xl3 border p-3 text-left ${
        rechazado ? 'border-line bg-surface-2/60' : 'border-accent-line bg-accent-soft/50'}`}
      >
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface shadow-sm ${
          rechazado ? 'text-ink-mute' : 'text-accent'}`}
        >
          {rechazado ? <IconX className="h-4 w-4" />
            : status === 'generando' ? <Girando className="h-5 w-5" />
              : status === 'pedido' ? <IconCheck className="h-5 w-5" /> : <IconAuriculares className="h-5 w-5" />}
        </span>
        <button
          disabled={rechazado}
          onClick={() => hoja.abrir()}
          className="min-w-0 flex-1 text-left"
          aria-label={rechazado ? undefined : `${t.titulo}. Cambiar por dónde empezar`}
        >
          <span className="block font-display text-[15px] font-bold leading-tight">{t.titulo}</span>
          <span className="mt-0.5 block break-words text-xs text-ink-dim">{nota}</span>
          {!rechazado && <span className="mt-1 block text-[11px] font-semibold text-accent">Cambiar</span>}
        </button>
        {status === 'pedido' && (
          <button
            disabled={enviando}
            onClick={() => cambiar('DELETE')}
            className="shrink-0 rounded-full px-2.5 py-1.5 text-xs font-medium text-ink-mute active:bg-surface-2 disabled:opacity-60"
          >
            {enviando ? <Girando className="h-3.5 w-3.5" /> : 'Anular'}
          </button>
        )}
      </div>
      {hojaDesde}
    </motion.div>
  )
}

// Por dónde quiere empezar. Todavía no hay EPUB, así que no hay capítulos que
// enseñarle: dice una página de su libro o escribe el capítulo como lo
// recuerde ("12", "el de la boda"). Si ya lo está leyendo, se le propone
// seguir por donde va.
const ENTRADA = 'h-12 w-full rounded-xl2 border border-line bg-surface px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-mute focus:border-accent-line'

function HojaDesde({ peticion, abierta, onCerrar, onGuardar }) {
  const [modo, setModo] = useState('principio')
  const [pagina, setPagina] = useState('')
  const [capitulo, setCapitulo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const yaPedido = !!peticion.status
  const lado = ladoDe(peticion)
  const total = lado.total
  const va = peticion.current_page > 0 ? lado.aLado(peticion.current_page) : null

  useEffect(() => {
    if (!abierta) return
    if (peticion.start_chapter) {
      setModo('capitulo'); setCapitulo(peticion.start_chapter); setPagina('')
    } else if (peticion.start_page) {
      setModo('pagina'); setPagina(String(lado.aLado(peticion.start_page))); setCapitulo('')
    } else if (!yaPedido && va > 0) {
      setModo('pagina'); setPagina(String(va)); setCapitulo('')
    } else {
      setModo('principio'); setPagina(''); setCapitulo('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta])

  const n = parseInt(pagina, 10)
  const paginaMala = modo === 'pagina' && (!n || n < 1 || (total && n > total))
  const vale = modo === 'principio' || (modo === 'pagina' && !paginaMala) || (modo === 'capitulo' && capitulo.trim())

  async function guardar() {
    setEnviando(true)
    await onGuardar(modo === 'pagina' ? { start_page: lado.aBase(n) } : modo === 'capitulo' ? { start_chapter: capitulo.trim() } : {})
    setEnviando(false)
  }

  const opciones = [
    { id: 'principio', titulo: 'Desde el principio' },
    { id: 'pagina', titulo: 'Desde una página', nota: va ? `Vas por la ${va}${total ? ` de ${total}` : ''}${lado.donde}` : total ? `Tu libro tiene ${total}${lado.donde ? ' en tu eReader' : ''}` : null },
    { id: 'capitulo', titulo: 'Desde un capítulo', nota: 'Escríbelo como lo recuerdes' },
  ]

  return (
    <HojaInferior
      abierta={abierta}
      titulo={yaPedido ? '¿Por dónde empezar?' : 'Pedir el audiolibro'}
      onCerrar={onCerrar}
      pie={
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={guardar}
          disabled={!vale || enviando}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl2 bg-accent text-sm font-semibold text-on-accent disabled:opacity-50"
        >
          {enviando && <Girando className="h-4 w-4" />}
          {yaPedido ? 'Guardar' : 'Pedir'}
        </motion.button>
      }
    >
      <p className="mb-3 text-[13px] leading-relaxed text-ink-dim">
        Se empezará a preparar por ahí, y la primera vez que le des a escuchar sonará desde ese capítulo.
      </p>
      {/* Para hacerse a la idea de cómo va a sonar antes de pedirlo. */}
      {!yaPedido && <MuestraDeVoz className="mb-3" />}
      <div className="overflow-hidden rounded-xl2 border border-line bg-surface">
        {opciones.map((o, i) => {
          const activa = modo === o.id
          return (
            <div key={o.id} className={`${i ? 'border-t border-line/70' : ''} ${activa ? 'bg-accent-soft/50' : ''} transition-colors`}>
              <button onClick={() => setModo(o.id)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${activa ? 'font-semibold' : ''} text-ink`}>{o.titulo}</span>
                  {o.nota && <span className="block text-[11px] text-ink-mute">{o.nota}</span>}
                </span>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${activa ? 'border-accent bg-accent' : 'border-line'}`}>
                  {activa && <span className="h-1.5 w-1.5 rounded-full bg-on-accent" />}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {activa && o.id !== 'principio' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={SUAVE}
                    className="overflow-hidden"
                  >
                    <div className="px-3.5 pb-3.5">
                      {o.id === 'pagina' ? (
                        <>
                          <input
                            value={pagina}
                            onChange={e => setPagina(e.target.value.replace(/\D/g, '').slice(0, 5))}
                            inputMode="numeric"
                            placeholder="Página"
                            aria-label="Página"
                            className={`${ENTRADA} tabular-nums`}
                          />
                          {paginaMala && pagina && (
                            <p className="mt-1.5 px-1 text-[11px] text-danger">
                              {total ? `Tiene que estar entre 1 y ${total}` : 'Pon una página'}
                            </p>
                          )}
                        </>
                      ) : (
                        <input
                          value={capitulo}
                          onChange={e => setCapitulo(e.target.value.slice(0, 120))}
                          placeholder="Por ejemplo: 12, o «La boda»"
                          aria-label="Capítulo"
                          className={ENTRADA}
                        />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </HojaInferior>
  )
}
