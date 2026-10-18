import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import HojaInferior from '../../luniteca/HojaInferior'
import Avatar from '../../../ui/Avatar'
import { IconCheck, IconPausa, IconPlay } from '../../../ui/icons'
import { Girando } from './Audiolibros'
import { duracion, reloj } from './formato'
export { ESTADOS_AB } from './formato'

// La generación de un audiolibro (fase 2, #64 de puchi): en qué va, si el
// sobremesa está encendido, por dónde empezar y escuchar lo ya hecho.

// Higgs tarda algo más que lo que dura el audio: medido en el sobremesa con
// el worker, 5,2 min para 3,4 de audio, anotación incluida. Solo para estimar.
const RTF = 1.5

// ─── El sobremesa ────────────────────────────────────────────────────────────

export function Sobremesa({ estado }) {
  if (!estado) return null
  const { online, higgs_ok: higgs, token_configured: clave } = estado
  const [color, texto] = !clave
    ? ['var(--color-danger)', 'Falta configurar la clave del sobremesa']
    : !online
      ? ['var(--color-ink-mute)', 'Sobremesa apagado: la cola espera a que se encienda']
      : !higgs
        ? ['#c58a2b', 'Sobremesa encendido, pero Higgs no responde']
        : ['var(--color-read)', 'Sobremesa encendido']
  return (
    <span className="inline-flex items-center gap-2 text-xs text-ink-dim">
      <span className="relative flex h-2 w-2">
        {online && higgs && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50" style={{ background: color }} />
        )}
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
      </span>
      {texto}
    </span>
  )
}

// ─── La tarjeta de generación ────────────────────────────────────────────────

export function Generacion({ ab, sobremesa, onGenerar, onPausar }) {
  const incluidos = ab.chapters.filter(c => c.included)
  const actual = incluidos.find(c => c.status === 'generando')
  const faltan = incluidos.filter(c => c.status !== 'listo')
  const minutosQueFaltan = Math.round(faltan.reduce((s, c) => s + c.minutes, 0) * RTF)
  const enMarcha = ab.status === 'en_cola' || ab.status === 'generando'
  const pct = incluidos.length ? ab.chapters_ready / incluidos.length : 0

  return (
    <section className="mt-6 overflow-hidden rounded-xl3 border border-line bg-surface">
      <div className="px-4 pb-4 pt-3.5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-[15px] font-bold">Generación</h3>
          <span className="text-xs tabular-nums text-ink-mute">
            {ab.chapters_ready} de {incluidos.length} capítulos
          </span>
        </div>

        {/* La barra de todo el libro: lo hecho, y encima lo que va del actual. */}
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={false}
            animate={{ width: `${Math.max(pct * 100, ab.chapters_ready ? 2 : 0)}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 24 }}
          />
        </div>

        <div className="mt-3">
          <Sobremesa estado={sobremesa} />
        </div>

        <AnimatePresence initial={false} mode="wait">
          {actual ? (
            <motion.div
              key={`actual-${actual.id}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-3.5 rounded-xl2 bg-accent-soft/60 px-3.5 py-3"
            >
              <div className="flex items-center gap-2.5">
                <Girando className="h-4 w-4 shrink-0 text-accent" />
                <p className="min-w-0 flex-1 truncate text-sm font-semibold">{actual.title}</p>
                <span className="text-xs tabular-nums text-accent">{Math.round(actual.progress * 100)} %</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface/70">
                <motion.div
                  className="h-full rounded-full bg-accent"
                  initial={false}
                  animate={{ width: `${actual.progress * 100}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 24 }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-ink-dim">
                {[actual.progress_note, quedaDelCapitulo(actual)].filter(Boolean).join(' · ')}
              </p>
            </motion.div>
          ) : ab.status === 'en_cola' ? (
            <motion.p key="espera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="mt-3 text-[13px] text-ink-dim">
              En cola. Empieza en cuanto el sobremesa pida trabajo.
            </motion.p>
          ) : null}
        </AnimatePresence>

        {ab.status === 'listo' ? (
          <p className="mt-3.5 flex items-center gap-2 text-sm font-semibold text-read">
            <IconCheck className="h-4 w-4" /> Todo generado · {duracion(ab.audio_minutes)} de audio
          </p>
        ) : (
          <div className="mt-4 flex items-center gap-3">
            {enMarcha ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onPausar}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl2 border border-line text-sm font-semibold text-ink-dim active:bg-surface-2"
              >
                <IconPausa className="h-4 w-4" /> Pausar
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onGenerar}
                disabled={!faltan.length}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl2 bg-accent text-sm font-semibold text-on-accent shadow-sm disabled:opacity-50"
              >
                <IconPlay className="h-4 w-4" />
                {ab.chapters_ready ? 'Seguir generando' : 'Generar'}
              </motion.button>
            )}
            {faltan.length > 0 && (
              <p className="w-[42%] text-[11px] leading-snug text-ink-mute">
                {faltan.length === 1 ? 'Falta 1 capítulo' : `Faltan ${faltan.length} capítulos`}: {duracion(minutosQueFaltan)} de sobremesa, aprox.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function quedaDelCapitulo(c) {
  if (!c.started_at || c.progress < 0.1) return null
  const pasado = (Date.now() - new Date(c.started_at).getTime()) / 60000
  const queda = Math.max(1, Math.round(pasado / c.progress - pasado))
  return `quedan unos ${queda} min`
}

// ─── Por qué capítulo empezar ────────────────────────────────────────────────

export function HojaEmpezar({ ab, abierta, onCerrar, onGenerar }) {
  const candidatos = ab.chapters.filter(c => c.included && c.status !== 'listo')
  const [elegido, setElegido] = useState(null)
  const [enviando, setEnviando] = useState(false)
  // Lo que pidieron los usuarios (#68), ya traducido a capítulo. Se propone
  // el que antes llega en el libro: así todos tienen pronto el suyo o uno
  // anterior.
  const deseos = (ab.start_wishes || []).filter(d => candidatos.some(c => c.id === d.chapter_id))
  const quienes = id => deseos.filter(d => d.chapter_id === id).map(d => d.player)
  useEffect(() => {
    if (!abierta) return
    const pos = id => candidatos.findIndex(c => c.id === id)
    const propuesto = [...deseos].sort((a, b) => pos(a.chapter_id) - pos(b.chapter_id))[0]
    setElegido(propuesto?.chapter_id ?? candidatos[0]?.id ?? null)
    // Si se propone uno de más abajo, se baja hasta él cuando la hoja ya ha
    // subido (antes, la hoja vuelve arriba al abrirse y lo deshace).
    if (propuesto) {
      const t = setTimeout(() => {
        document.querySelector('[data-cap-propuesto]')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }, 450)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta])
  const cap = candidatos.find(c => c.id === elegido)

  async function generar() {
    setEnviando(true)
    const hecho = await onGenerar(elegido)
    setEnviando(false)
    if (hecho) onCerrar()
  }

  return (
    <HojaInferior
      abierta={abierta}
      titulo="¿Por dónde empiezo?"
      onCerrar={onCerrar}
      pie={
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={generar}
          disabled={!cap || enviando}
          className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl2 bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-60"
        >
          {enviando && <Girando className="h-4 w-4" />}
          <span className="truncate">{cap ? `Empezar por «${cap.title}»` : 'Generar'}</span>
        </motion.button>
      }
    >
      <p className="mb-3 text-[13px] leading-relaxed text-ink-dim">
        Se genera desde el que elijas hasta el final, y después lo de antes. Así el primero que
        se pueda escuchar es el que hace falta.
      </p>
      {(ab.start_wishes || []).length > 0 && (
        <div className="mb-4 space-y-1.5">
          <p className="px-1 text-[11px] uppercase tracking-[0.1em] text-ink-mute">Lo que piden</p>
          {ab.start_wishes.map(d => {
            const vale = deseos.includes(d)
            const pedido = d.start_chapter ? `«${d.start_chapter}»` : `pág. ${d.start_page}${d.total_pages ? ` de ${d.total_pages}` : ''}`
            return (
              <button
                key={d.player.id}
                disabled={!vale}
                onClick={() => setElegido(d.chapter_id)}
                className={`flex w-full items-center gap-2.5 rounded-xl2 border px-3 py-2 text-left transition-colors ${
                  vale && elegido === d.chapter_id ? 'border-accent-line bg-accent-soft/60' : 'border-line bg-surface'} disabled:opacity-70`}
              >
                <Avatar jugador={d.player} size={24} />
                <span className="min-w-0 flex-1 text-xs leading-snug">
                  <span className="font-semibold text-ink">{d.player.name}</span>
                  <span className="text-ink-dim"> pidió {pedido}</span>
                  <span className="block break-words text-ink-mute">
                    {d.chapter_title
                      ? `${vale ? '→' : 'ya generado:'} «${d.chapter_title}»${d.how === 'pagina' ? ' (aprox.)' : d.how === 'orden' ? ' (contando capítulos)' : ''}`
                      : 'No se encuentra ese capítulo: elígelo a mano'}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
      <div className="overflow-hidden rounded-xl2 border border-line bg-surface">
        {candidatos.map((c, i) => {
          const activo = c.id === elegido
          return (
            <button
              key={c.id}
              data-cap-propuesto={quienes(c.id).length > 0 || undefined}
              onClick={() => setElegido(c.id)}
              className={`flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors ${i ? 'border-t border-line/70' : ''} ${activo ? 'bg-accent-soft/60' : 'active:bg-surface-2'}`}
            >
              <span className="w-6 shrink-0 text-right text-xs tabular-nums text-ink-mute">{c.position + 1}</span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm ${activo ? 'font-semibold text-ink' : 'text-ink'}`}>{c.title}</span>
                <span className="block text-[11px] text-ink-mute">{duracion(c.minutes)}{c.status === 'error' ? ' · falló la otra vez' : ''}</span>
              </span>
              {quienes(c.id).length > 0 && (
                <span className="flex shrink-0 -space-x-1.5">
                  {quienes(c.id).slice(0, 3).map(p => (
                    <span key={p.id} className="rounded-full ring-2 ring-surface"><Avatar jugador={p} size={18} /></span>
                  ))}
                </span>
              )}
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${activo ? 'border-accent bg-accent text-on-accent' : 'border-line'}`}
              >
                {activo && <span className="h-1.5 w-1.5 rounded-full bg-on-accent" />}
              </span>
            </button>
          )
        })}
      </div>
    </HojaInferior>
  )
}

// ─── Escuchar un capítulo (para el admin) ────────────────────────────────────

export function ReproductorCapitulo({ src, duracionS }) {
  const audio = useRef(null)
  const [sonando, setSonando] = useState(false)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(duracionS || 0)

  // Al cambiar de capítulo (o al cerrar la hoja), que no siga sonando el anterior.
  useEffect(() => () => audio.current?.pause(), [src])

  const alternar = () => {
    const a = audio.current
    if (a.paused) a.play().catch(() => {})
    else a.pause()
  }
  const pct = dur ? (t / dur) * 100 : 0

  return (
    <div className="flex items-center gap-3 rounded-xl2 border border-line bg-surface px-3 py-2.5">
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onPlay={() => setSonando(true)}
        onPause={() => setSonando(false)}
        onEnded={() => setSonando(false)}
        onTimeUpdate={e => setT(e.currentTarget.currentTime)}
        onLoadedMetadata={e => Number.isFinite(e.currentTarget.duration) && setDur(e.currentTarget.duration)}
      />
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={alternar}
        aria-label={sonando ? 'Pausa' : 'Escuchar'}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-sm"
      >
        {sonando ? <IconPausa className="h-4 w-4" /> : <IconPlay className="ml-0.5 h-4 w-4" />}
      </motion.button>
      <div className="min-w-0 flex-1">
        <input
          type="range" min="0" max={dur || 0} step="1" value={t}
          onChange={e => { audio.current.currentTime = Number(e.target.value) }}
          aria-label="Posición"
          className="w-full accent-[var(--color-accent)]"
          style={{ background: `linear-gradient(to right, var(--color-accent) ${pct}%, var(--color-surface-2) ${pct}%)` }}
        />
        <div className="mt-0.5 flex justify-between text-[11px] tabular-nums text-ink-mute">
          <span>{reloj(t)}</span><span>{reloj(dur)}</span>
        </div>
      </div>
    </div>
  )
}
