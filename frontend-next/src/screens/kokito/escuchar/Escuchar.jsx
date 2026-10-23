import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../../../platform/api'
import { useReproductor } from '../../../platform/reproductor'
import { Cover } from '../../luniteca/piezas'
import { IconAuriculares, IconCheck, IconPausa, IconPlay, IconPlus } from '../../../ui/icons'
import { Girando } from '../audiolibros/Audiolibros'
import { capitulos, duracion } from '../audiolibros/formato'
import { tf } from '../../../ui/transformar'
import Lista from '../../../ui/Lista'

// Escuchar (#74): todos los audiolibros que ya se pueden escuchar, estén o
// no en tu estantería. Los avisos solo le llegan a quien pidió cada uno
// (#69); el resto los descubre aquí. Para escuchar hay que tener el libro
// (#60), así que los que no tienes se añaden con un toque.

const ENTRA = { duration: 0.24, ease: [0.22, 1, 0.36, 1] }

export default function Escuchar() {
  const r = useReproductor()
  const [lista, setLista] = useState(null)
  const [error, setError] = useState(null)

  const cargar = useCallback(() => {
    api('/listen/catalog').then(l => { setLista(l); setError(null) }).catch(e => { setLista([]); setError(e.message) })
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const mios = (lista || []).filter(a => a.mine)
  const otros = (lista || []).filter(a => !a.mine)

  return (
    <div className="mx-auto max-w-2xl py-6">
      <header className="mb-5">
        <h2 className="font-display text-[1.75rem] font-bold tracking-[-0.02em]">Escuchar</h2>
        <p className="mt-1 text-sm text-ink-dim">Los audiolibros que ya se pueden escuchar.</p>
      </header>

      {error && <p className="mb-4 rounded-xl2 bg-danger/10 px-4 py-2.5 text-sm text-danger">{error}</p>}

      {lista === null && (
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[104px] animate-pulse rounded-xl2 bg-surface-2" />)}
        </div>
      )}

      {lista?.length === 0 && !error && (
        <div className="mt-14 flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-ink-mute">
            <IconAuriculares className="h-8 w-8" />
          </span>
          <p className="mt-4 font-display text-lg font-bold">Todavía no hay ninguno</p>
          <p className="mt-1 max-w-xs text-sm text-ink-dim">
            Pide el que quieras desde la ficha de un libro de tu estantería.
          </p>
        </div>
      )}

      {mios.length > 0 && (
        <Grupo titulo="En tu estantería">
          {mios.map(a => <Tarjeta key={a.id} a={a} r={r} onCambio={cargar} />)}
        </Grupo>
      )}
      {otros.length > 0 && (
        <Grupo titulo={mios.length ? 'Más para escuchar' : 'Para escuchar'}
          nota="Añádelo a tu estantería y podrás escucharlo.">
          {otros.map(a => <Tarjeta key={a.id} a={a} r={r} onCambio={cargar} />)}
        </Grupo>
      )}
    </div>
  )
}

function Grupo({ titulo, nota, children }) {
  return (
    <section className="mb-7">
      <h3 className="px-1 font-display text-lg font-bold tracking-[-0.01em]">{titulo}</h3>
      {nota && <p className="mt-0.5 px-1 text-[13px] text-ink-dim">{nota}</p>}
      <Lista className="mt-3 space-y-2.5">
        <AnimatePresence initial={false} mode="popLayout">{children}</AnimatePresence>
      </Lista>
    </section>
  )
}

function Tarjeta({ a, r, onCambio }) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState(null)
  const esteSuena = r?.libro?.id === a.id && r.cap
  const sonando = esteSuena && r.sonando
  // Los datos para escuchar, pedidos ya al aparecer la tarjeta: en iPhone
  // el audio solo arranca si el play va en el mismo toque, sin esperar a la
  // red entre medias.
  const [listo, setListo] = useState(null)
  useEffect(() => {
    if (!a.mine) return
    let vivo = true
    api(`/listen/${a.id}`).then(d => { if (vivo) setListo(d) }).catch(() => {})
    return () => { vivo = false }
  }, [a.id, a.mine])

  const estado = a.complete
    ? `${capitulos(a.chapters_total)} · ${duracion(a.audio_minutes)}`
    : `${a.chapters_ready} de ${a.chapters_total} capítulos · llegan más`

  async function datos() {
    return listo || api(`/listen/${a.id}`)
  }
  // Como en la ficha del libro: la tarjeta abre el reproductor; el play solo
  // pone a sonar y deja el mini de abajo.
  async function abrirVista() {
    if (!r || !a.mine) return
    if (esteSuena) { r.pantalla.abrir(); return }
    r.abrir(await datos(), { reproducir: false })
  }
  function play() {
    if (esteSuena) { r.alternar(); return }
    if (listo) { r.abrir(listo, { reproducir: true, mostrar: false }); return }
    // Aún no habían llegado (muy raro): se piden y se intenta igual.
    api(`/listen/${a.id}`).then(d => r.abrir(d, { reproducir: true, mostrar: false })).catch(() => {})
  }
  async function anadir() {
    setOcupado(true)
    setError(null)
    try {
      await api('/shelf/personal', {
        method: 'POST',
        body: { book_id: a.add_book_id, title: a.title, status: 'want_to_read', origin: 'audiobook' },
      })
      onCambio()
    } catch (e) {
      setError(e.message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, transform: tf({ y: 6 }) }} animate={{ opacity: 1, transform: tf({ y: 0 }) }} exit={{ opacity: 0, transform: tf({ scale: 0.97 }) }} transition={ENTRA}>
      <div className={`flex items-center gap-3.5 rounded-xl2 border p-3 ${
        sonando ? 'border-accent-line bg-accent-soft/40' : 'border-line bg-surface'} shadow-[0_1px_0_rgb(var(--color-sombra)/0.04)]`}
      >
        <button onClick={abrirVista} disabled={!a.mine} className="flex min-w-0 flex-1 items-center gap-3.5 text-left disabled:cursor-default">
          <Cover url={a.cover_url} title={a.title} className="w-[56px] shrink-0" />
          <span className="min-w-0 flex-1 py-0.5">
            <span className="line-clamp-2 block font-display font-bold leading-snug">{a.title}</span>
            {a.author && <span className="mt-0.5 block truncate text-sm text-ink-dim">{a.author}</span>}
            <span className="mt-1 block text-xs text-ink-mute">{error || estado}</span>
            {a.mine && a.percent != null && (
              <span className="mt-1.5 flex items-center gap-2">
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(2, a.percent * 100)}%` }} />
                </span>
                <span className="text-[11px] tabular-nums text-ink-mute">{Math.round(a.percent * 100)} %</span>
              </span>
            )}
          </span>
        </button>
        {a.mine ? (
          <motion.button
            whileTap={{ transform: tf({ scale: 0.9 }) }}
            onClick={play}
            aria-label={sonando ? 'Pausa' : 'Escuchar'}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-sm"
          >
            {sonando ? <IconPausa className="h-5 w-5" /> : <IconPlay className="ml-0.5 h-5 w-5" />}
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ transform: tf({ scale: 0.94 }) }}
            disabled={ocupado}
            onClick={anadir}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-3 text-xs font-semibold text-accent disabled:opacity-70"
          >
            {ocupado ? <Girando className="h-3.5 w-3.5" /> : <IconPlus className="h-3.5 w-3.5" />}
            Añadir
          </motion.button>
        )}
      </div>
      {a.mine && a.mine.status === 'want_to_read' && a.percent == null && (
        <p className="mt-1 flex items-center gap-1 px-1 text-[11px] text-ink-mute">
          <IconCheck className="h-3 w-3" /> En tu estantería, por leer: al escucharlo pasa a «Leyendo».
        </p>
      )}
    </motion.div>
  )
}
