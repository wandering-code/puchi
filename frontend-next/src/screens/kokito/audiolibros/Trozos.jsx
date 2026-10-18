import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../../../platform/api'
import { IconChevron, IconRefresh } from '../../../ui/icons'
import { Girando } from './Audiolibros'
import { reloj } from './formato'

// Retocar un trozo suelto de un capítulo (fase 9, #71): para un fallo
// puntual de Higgs (una palabra robotizada, un ruido) sin regenerar el
// capítulo entero. Cada trozo es lo que se le pidió a Higgs de una vez; al
// rehacerlo se genera con otra semilla y, si hace falta, con otro texto
// (escribir la palabra de otra forma para que la diga bien). El sobremesa
// los coge antes que la cola y los encaja en el audio por los silencios.

const SUAVE = { duration: 0.22, ease: [0.22, 1, 0.36, 1] }

export default function Trozos({ ab, cap, tiempo, onIr, onHecho }) {
  const [abierto, setAbierto] = useState(false)
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [editando, setEditando] = useState(null) // i
  const lista = useRef(null)
  const generadoEn = useRef(cap.generated_at)
  // En una referencia: si `cargar` dependiera de onHecho y este cambiara en
  // cada render, se volverían a pedir los trozos sin parar.
  const alHecho = useRef(onHecho)
  alHecho.current = onHecho

  const cargar = useCallback(() => {
    api(`/audiobooks/${ab.id}/chapters/${cap.id}/pieces`)
      .then(d => {
        setDatos(d)
        setError(null)
        // Ha llegado audio nuevo: que la ficha lo recoja (y con él el
        // reproductor de arriba, que lleva la fecha en la URL).
        if (d.generated_at && generadoEn.current && d.generated_at !== generadoEn.current) alHecho.current()
        generadoEn.current = d.generated_at
      })
      .catch(e => setError(e.message))
  }, [ab.id, cap.id])

  useEffect(() => { if (abierto) cargar() }, [abierto, cargar])
  useEffect(() => { generadoEn.current = cap.generated_at }, [cap.generated_at])

  // Mientras haya retoques en marcha, se mira cada 5 s.
  const pendientes = datos?.pieces.filter(p => p.pending && !p.error).length || 0
  useEffect(() => {
    if (!abierto || !pendientes) return
    const id = setInterval(cargar, 5000)
    return () => clearInterval(id)
  }, [abierto, pendientes, cargar])

  const actual = tiempo == null ? null : datos?.pieces.find(p => tiempo >= p.start - 0.2 && tiempo < p.end + 0.2)

  async function rehacer(i, texto) {
    try {
      setDatos(await api(`/audiobooks/${ab.id}/chapters/${cap.id}/pieces/${i}/redo`, { method: 'POST', body: { text: texto } }))
      setEditando(null)
    } catch (e) {
      setError(e.message)
    }
  }
  async function anular(i) {
    try {
      setDatos(await api(`/audiobooks/${ab.id}/chapters/${cap.id}/pieces/${i}/redo`, { method: 'DELETE' }))
    } catch (e) {
      setError(e.message)
    }
  }
  function alQueSuena() {
    lista.current?.querySelector('[data-suena]')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  return (
    <div className="mt-4">
      <button
        onClick={() => setAbierto(v => !v)}
        className="flex w-full items-center gap-3 rounded-xl2 border border-line px-4 py-3 text-left active:bg-surface-2"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-dim">
          <IconRefresh className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Retocar un trozo</span>
          <span className="block text-xs text-ink-mute">
            {cap.retouches ? `${cap.retouches} en camino · ` : ''}Para un fallo suelto, sin regenerar el capítulo
          </span>
        </span>
        <IconChevron className={`h-4 w-4 shrink-0 text-ink-mute transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {abierto && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={SUAVE} className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-1 pb-2 pt-3">
              <p className="text-[12px] leading-snug text-ink-dim">
                Toca uno para oírlo. Al rehacerlo sale distinto; si una palabra suena mal, prueba a escribirla de otra forma.
              </p>
              {actual && (
                <button onClick={alQueSuena} className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-accent">
                  El que suena
                </button>
              )}
            </div>
            {error && <p className="mb-2 rounded-xl2 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
            {!datos && !error && <div className="h-24 animate-pulse rounded-xl2 bg-surface-2" />}
            {datos && (
              <div ref={lista} className="max-h-[55vh] overflow-y-auto overscroll-contain rounded-xl2 border border-line bg-surface">
                {datos.pieces.map(p => (
                  <Trozo
                    key={p.i}
                    p={p}
                    suena={actual?.i === p.i}
                    editando={editando === p.i}
                    onIr={() => onIr(p.start)}
                    onEditar={() => setEditando(editando === p.i ? null : p.i)}
                    onRehacer={texto => rehacer(p.i, texto)}
                    onAnular={() => anular(p.i)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Trozo({ p, suena, editando, onIr, onEditar, onRehacer, onAnular }) {
  const [texto, setTexto] = useState(p.pending_text || p.text)
  const [enviando, setEnviando] = useState(false)
  useEffect(() => { if (editando) setTexto(p.pending_text || p.text) }, [editando, p.pending_text, p.text])

  return (
    <div data-suena={suena || undefined} className={`border-t border-line/70 first:border-t-0 ${suena ? 'bg-accent-soft/50' : ''}`}>
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <button onClick={onIr} className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-2 text-[11px] tabular-nums text-ink-mute">
            {reloj(p.start)}
            {p.emotion && <span className="rounded-full bg-surface-2 px-1.5 py-px text-[10px]">{p.emotion}</span>}
            {p.redone > 0 && <span className="text-accent">rehecho{p.redone > 1 ? ` ×${p.redone}` : ''}</span>}
          </span>
          <span className={`mt-0.5 line-clamp-2 block text-[13px] leading-snug ${suena ? 'text-ink' : 'text-ink-dim'}`}>{p.text}</span>
        </button>
        {p.pending ? (
          p.error ? (
            <button onClick={onEditar} className="shrink-0 rounded-full bg-danger/10 px-2.5 py-1 text-[11px] font-semibold text-danger">Falló</button>
          ) : (
            <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[11px] text-accent">
              <Girando className="h-3 w-3" /> En cola
              <button onClick={onAnular} className="ml-1 text-ink-mute underline-offset-2 active:underline">Anular</button>
            </span>
          )
        ) : (
          <button onClick={onEditar} className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-dim active:bg-surface-2">
            Rehacer
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {editando && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={SUAVE} className="overflow-hidden">
            <div className="px-3 pb-3">
              {p.error && <p className="mb-2 text-[11px] text-danger">Falló: {p.error}</p>}
              <textarea
                value={texto}
                onChange={e => setTexto(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl2 border border-line bg-bg px-3 py-2 text-[13px] leading-snug text-ink outline-none focus:border-accent-line"
              />
              <div className="mt-2 flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  disabled={enviando || !texto.trim()}
                  onClick={async () => { setEnviando(true); await onRehacer(texto.trim() === p.text ? null : texto.trim()); setEnviando(false) }}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl2 bg-accent text-xs font-semibold text-on-accent disabled:opacity-60"
                >
                  {enviando && <Girando className="h-3.5 w-3.5" />}
                  {texto.trim() === p.text ? 'Rehacer igual (otra toma)' : 'Rehacer con este texto'}
                </motion.button>
                <button onClick={onEditar} className="h-9 rounded-xl2 border border-line px-3 text-xs text-ink-dim">Cancelar</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
