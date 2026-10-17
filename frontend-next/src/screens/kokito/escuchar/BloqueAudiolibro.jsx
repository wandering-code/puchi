import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { api } from '../../../platform/api'
import { useReproductor } from '../../../platform/reproductor'
import { IconAuriculares, IconPausa, IconPlay } from '../../../ui/icons'
import { duracion, reloj } from '../audiolibros/formato'
import { Ecualizador } from './PantallaReproductor'

// En la ficha de un libro de tu estantería: si tiene audiolibro, para
// escucharlo (fase 3, #65). Sin audiolibro no ocupa nada.

export default function BloqueAudiolibro({ bookId, abierta }) {
  const r = useReproductor()
  const [datos, setDatos] = useState(null)

  // Cada vez que se abre la ficha: puede haber capítulos nuevos, o se ha
  // seguido escuchando en otro dispositivo.
  useEffect(() => {
    if (!r || !abierta) return
    let vivo = true
    api(`/listen/book/${bookId}`).then(d => vivo && setDatos(d)).catch(() => vivo && setDatos(null))
    return () => { vivo = false }
  }, [bookId, abierta, r])

  if (!r || !datos || datos.id == null) return null

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
    detalle = 'Se está preparando: todavía no hay ningún capítulo'
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
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="mt-6 w-full"
    >
      <div className="flex items-center gap-3 rounded-xl3 border border-accent-line bg-accent-soft/50 p-3 text-left">
        <button onClick={abrirVista} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-accent shadow-sm">
            {sonando ? <Ecualizador activo /> : <IconAuriculares className="h-5 w-5" />}
          </span>
          <span className="min-w-0">
            <span className="block font-display text-[15px] font-bold leading-tight">
              {sonando ? 'Sonando ahora' : 'Audiolibro'}
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
