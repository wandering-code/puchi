import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../../../platform/api'
import { useReproductor } from '../../../platform/reproductor'
import { IconAuriculares, IconCheck, IconPausa, IconPlay, IconX } from '../../../ui/icons'
import { Girando } from '../audiolibros/Audiolibros'
import { duracion, reloj } from '../audiolibros/formato'
import { Ecualizador } from './PantallaReproductor'

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
  const hayAudio = datos && datos.id != null
  const hayPeticion = !hayAudio && peticion && (peticion.can_request || peticion.status)

  return (
    <AnimatePresence initial={false} mode="wait">
      {hayAudio && <Escuchar key="audio" r={r} datos={datos} pedido={peticion?.requested} />}
      {hayPeticion && <Peticion key="peticion" bookId={bookId} peticion={peticion} onCambio={setPeticion} />}
    </AnimatePresence>
  )
}

function Escuchar({ r, datos, pedido }) {
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

function Peticion({ bookId, peticion, onCambio }) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const { status, others } = peticion

  async function cambiar(metodo) {
    setEnviando(true)
    setError(null)
    try {
      onCambio(await api(`/audiobook-requests/book/${bookId}`, { method: metodo }))
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

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
            onClick={() => cambiar('POST')}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-3.5 text-xs font-semibold text-accent disabled:opacity-70"
          >
            {enviando && <Girando className="h-3.5 w-3.5" />}
            Pedir
          </motion.button>
        </div>
      </motion.div>
    )
  }

  const t = TEXTOS[status] || TEXTOS.pedido
  const rechazado = status === 'rechazado'
  const nota = error || (rechazado ? (peticion.reason || t.nota) : status === 'pedido' && others ? `Tú y ${others} más lo esperáis` : t.nota)

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
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[15px] font-bold leading-tight">{t.titulo}</span>
          <span className="mt-0.5 line-clamp-2 block text-xs text-ink-dim">{nota}</span>
        </span>
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
    </motion.div>
  )
}
