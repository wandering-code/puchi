import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../../../platform/api'
import { useCapa } from '../../../platform/capas'
import { Cover } from '../../luniteca/piezas'
import HojaInferior from '../../luniteca/HojaInferior'
import Avatar from '../../../ui/Avatar'
import { IconChevron, IconEnlace, IconSubir, IconX } from '../../../ui/icons'
import { Etiqueta, Girando } from './Audiolibros'
import { ESTADOS_AB, haceCuanto, nombres } from './formato'
import { tf } from '../../../ui/transformar'
import Desplegable from '../../../ui/Desplegable'
import Lista from '../../../ui/Lista'

// La bandeja de peticiones del admin (fase 6, #68). Cada tarjeta es una
// novela, aunque la hayan pedido varias personas con libros distintos del
// catálogo (otra edición, otro título). Atenderla es darle un audiolibro:
// subir su EPUB o enlazarla con uno que ya exista. Desde ese momento la
// petición va tan avanzada como el audiolibro.

const ENTRA = { duration: 0.24, ease: [0.22, 1, 0.36, 1] }
const ATENDIDAS = new Set(['listo', 'rechazada'])

export default function Peticiones({ audiolibros, version, onAbrir, onSubido }) {
  const [grupos, setGrupos] = useState(null)
  const [error, setError] = useState(null)
  const [verAtendidas, setVerAtendidas] = useState(false)
  const [subiendo, setSubiendo] = useState(null) // key del grupo
  // Las hojas guardan el grupo con el que se abrieron. Con useCapa, como
  // todas: se cierran con "atrás" y con Escape.
  const enlazar = useCapa(null)
  const rechazar = useCapa(null)
  const entrada = useRef(null)
  const paraSubir = useRef(null)

  const cargar = useCallback(() => {
    api('/audiobook-requests').then(g => { setGrupos(g); setError(null) }).catch(e => setError(e.message))
  }, [])
  useEffect(() => { cargar() }, [cargar, version])

  function elegirEpub(g) {
    paraSubir.current = g
    entrada.current?.click()
  }

  async function subir(archivo) {
    const g = paraSubir.current
    if (!archivo || !g) return
    setSubiendo(g.key)
    setError(null)
    const datos = new FormData()
    datos.append('epub_file', archivo)
    datos.append('link_books', g.books.map(b => b.id).join(','))
    try {
      const nuevo = await api('/audiobooks', { method: 'POST', body: datos })
      onSubido(nuevo)
      cargar()
    } catch (e) {
      setError(e.message)
    } finally {
      setSubiendo(null)
      if (entrada.current) entrada.current.value = ''
    }
  }

  // Enlazar con uno que ya existe: todos los libros de la petición a la vez.
  async function enlazarCon(g, ab) {
    setError(null)
    try {
      for (const b of g.books) {
        await api(`/audiobooks/${ab.id}/books`, { method: 'POST', body: { book_id: b.id } })
      }
      cargar()
      return true
    } catch (e) {
      setError(e.message)
      cargar()
      return false
    }
  }

  async function rechazarCon(g, motivo) {
    setGrupos(await api('/audiobook-requests/reject', { method: 'POST', body: { book_ids: g.books.map(b => b.id), reason: motivo } }))
  }
  async function deshacerRechazo(g) {
    setGrupos(await api('/audiobook-requests/unreject', { method: 'POST', body: { book_ids: g.books.map(b => b.id) } }))
  }

  if (!grupos?.length) {
    return error ? <p className="mt-6 text-sm text-danger">{error}</p> : null
  }

  const abiertas = grupos.filter(g => !ATENDIDAS.has(g.state))
  const atendidas = grupos.filter(g => ATENDIDAS.has(g.state))
  const porAtender = grupos.filter(g => g.state === 'pendiente').length

  return (
    <section className="mt-8">
      <input
        ref={entrada}
        type="file"
        accept=".epub,application/epub+zip"
        className="hidden"
        onChange={e => subir(e.target.files?.[0])}
      />
      <div className="mb-3 flex items-baseline gap-2 px-1">
        <h3 className="font-display text-lg font-bold tracking-[-0.01em]">Peticiones</h3>
        {porAtender > 0 && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold tabular-nums text-on-accent">{porAtender}</span>
        )}
      </div>

      <Desplegable abierto={!!error}>
        <p className="mb-3 rounded-xl2 bg-danger/10 px-4 py-2.5 text-sm text-danger">
            {error}
          </p>
      </Desplegable>

      {abiertas.length === 0 && (
        <p className="rounded-xl2 border border-dashed border-line px-4 py-3 text-sm text-ink-dim">
          Nada por atender.
        </p>
      )}

      <Lista className="space-y-2.5">
        <AnimatePresence initial={false} mode="popLayout">
          {abiertas.map(g => (
            <motion.div key={g.key} initial={{ opacity: 0, transform: tf({ y: -8 }) }} animate={{ opacity: 1, transform: tf({ y: 0 }) }} exit={{ opacity: 0, transform: tf({ scale: 0.96 }) }} transition={ENTRA}>
              <Tarjeta
                g={g}
                subiendo={subiendo === g.key}
                onSubir={() => elegirEpub(g)}
                onEnlazar={() => enlazar.abrir(g)}
                onSugerencia={() => enlazarCon(g, g.suggestion)}
                onRechazar={() => rechazar.abrir(g)}
                onAbrir={() => g.audiobook && onAbrir(g.audiobook.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </Lista>

      {atendidas.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setVerAtendidas(v => !v)}
            className="flex w-full items-center justify-between rounded-xl2 px-1 py-2 text-[13px] text-ink-dim"
          >
            <span>Atendidas y rechazadas · {atendidas.length}</span>
            <IconChevron className={`h-4 w-4 transition-transform ${verAtendidas ? 'rotate-180' : ''}`} />
          </button>
          <Desplegable abierto={!!verAtendidas}>
            <div className="overflow-hidden">
                <div className="space-y-2 pt-1">
                  {atendidas.map(g => (
                    <Atendida key={g.key} g={g} onAbrir={() => g.audiobook && onAbrir(g.audiobook.id)} onDeshacer={() => deshacerRechazo(g)} />
                  ))}
                </div>
              </div>
          </Desplegable>
        </div>
      )}

      <HojaEnlazar
        g={enlazar.abierta}
        audiolibros={audiolibros}
        onCerrar={enlazar.cerrar}
        onElegir={async ab => { if (await enlazarCon(enlazar.abierta, ab)) enlazar.cerrar() }}
      />
      <HojaRechazar
        g={rechazar.abierta}
        onCerrar={rechazar.cerrar}
        onRechazar={async motivo => { await rechazarCon(rechazar.abierta, motivo); rechazar.cerrar() }}
      />
    </section>
  )
}

// Quién lo pidió: caras solapadas y nombres.
function Pidieron({ g }) {
  const gente = []
  const vistos = new Set()
  for (const r of g.requests) {
    if (!vistos.has(r.player.id) && !(g.state === 'pendiente' && r.rejected_at)) {
      vistos.add(r.player.id)
      gente.push(r.player)
    }
  }
  return (
    <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
      <span className="flex shrink-0 -space-x-1.5">
        {gente.slice(0, 4).map(p => (
          <span key={p.id} className="rounded-full ring-2 ring-surface"><Avatar jugador={p} size={18} /></span>
        ))}
      </span>
      <span className="truncate text-[11px] text-ink-mute">
        {nombres(gente.map(p => p.name))} · {haceCuanto(g.state === 'pendiente' ? g.first_at : g.last_at)}
      </span>
    </div>
  )
}

// Por dónde quiere empezar cada uno, si no es desde el principio.
function Deseos({ g }) {
  const lineas = []
  const vistos = new Set()
  for (const r of g.requests) {
    if (vistos.has(r.player.id) || r.rejected_at) continue
    vistos.add(r.player.id)
    if (r.start_chapter) lineas.push([r.player, `desde «${r.start_chapter}»`])
    else if (r.start_page) lineas.push([r.player, `desde la pág. ${r.start_page}${r.total_pages ? ` de ${r.total_pages}` : ''}`])
  }
  if (!lineas.length) return null
  return (
    <div className="mt-1.5 space-y-0.5">
      {lineas.map(([p, texto]) => (
        <p key={p.id} className="break-words text-[11px] leading-snug text-ink-dim">
          <span className="font-semibold" style={{ color: p.color || undefined }}>{p.name}</span>: {texto}
        </p>
      ))}
    </div>
  )
}

function Tarjeta({ g, subiendo, onSubir, onEnlazar, onSugerencia, onRechazar, onAbrir }) {
  const pendiente = g.state === 'pendiente'
  const [enlazando, setEnlazando] = useState(false)
  const otrosTitulos = g.books.filter(b => b.title !== g.title)

  const cuerpo = (
    <div className="flex items-start gap-3.5">
      <Cover url={g.cover_url} title={g.title} className="w-[52px] shrink-0" />
      <div className="min-w-0 flex-1 py-0.5">
        <p className="line-clamp-2 font-display font-bold leading-snug">{g.title}</p>
        {g.author && <p className="mt-0.5 truncate text-sm text-ink-dim">{g.author}</p>}
        {otrosTitulos.length > 0 && (
          <p className="mt-1 line-clamp-2 text-[11px] text-ink-mute">
            También como {otrosTitulos.map(b => `«${b.title}»`).join(', ')}
          </p>
        )}
        <Pidieron g={g} />
        <Deseos g={g} />
        {!pendiente && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Etiqueta aviso={g.state === 'error'}>
              {ESTADOS_AB[g.state] || g.state}
              {g.audiobook?.chapters_ready > 0 && ` · ${g.audiobook.chapters_ready}/${g.audiobook.chapters_included}`}
            </Etiqueta>
            <Etiqueta><IconEnlace className="h-3 w-3" />«{g.audiobook?.title}»</Etiqueta>
          </div>
        )}
      </div>
    </div>
  )

  if (!pendiente) {
    return (
      <motion.button
        onClick={onAbrir}
        data-pulsa="0.985"
        className="w-full rounded-xl2 border border-line bg-surface p-3 text-left shadow-[0_1px_0_rgb(var(--color-sombra)/0.04)]"
      >
        {cuerpo}
      </motion.button>
    )
  }

  return (
    <div className="rounded-xl2 border border-accent-line bg-surface p-3 shadow-[0_1px_0_rgb(var(--color-sombra)/0.04)]">
      {cuerpo}

      {g.suggestion && (
        <div className="mt-3 flex items-center gap-3 rounded-xl2 bg-accent-soft/60 px-3 py-2">
          <p className="min-w-0 flex-1 text-xs leading-snug text-ink-dim">
            Parece <span className="font-semibold text-ink">«{g.suggestion.title}»</span>, que ya existe
          </p>
          <motion.button
            data-pulsa="0.94"
            disabled={enlazando}
            onClick={async () => { setEnlazando(true); await onSugerencia(); setEnlazando(false) }}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 text-xs font-semibold text-on-accent shadow-sm disabled:opacity-70"
          >
            {enlazando ? <Girando className="h-3.5 w-3.5" /> : <IconEnlace className="h-3.5 w-3.5" />}
            Enlazar
          </motion.button>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <motion.button
          data-pulsa="0.97"
          disabled={subiendo}
          onClick={onSubir}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl2 border border-accent-line bg-accent-soft text-sm font-semibold text-accent disabled:cursor-wait disabled:opacity-80"
        >
          {subiendo ? <Girando className="h-4 w-4" /> : <IconSubir className="h-4 w-4" />}
          {subiendo ? 'Leyendo…' : 'Subir EPUB'}
        </motion.button>
        <motion.button
          data-pulsa="0.97"
          onClick={onEnlazar}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl2 border border-line px-3.5 text-sm font-medium text-ink active:bg-surface-2"
        >
          <IconEnlace className="h-4 w-4" />
          Enlazar
        </motion.button>
        <motion.button
          data-pulsa="0.97"
          onClick={onRechazar}
          aria-label="Rechazar"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl2 border border-line text-ink-mute active:bg-surface-2"
        >
          <IconX className="h-4 w-4" />
        </motion.button>
      </div>
    </div>
  )
}

function Atendida({ g, onAbrir, onDeshacer }) {
  const rechazada = g.state === 'rechazada'
  return (
    <div className="flex items-center gap-3 rounded-xl2 border border-line bg-surface p-2.5">
      <button onClick={rechazada ? undefined : onAbrir} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Cover url={g.cover_url} title={g.title} className="w-9 shrink-0" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold leading-tight">{g.title}</span>
          <span className="mt-0.5 block truncate text-[11px] text-ink-mute">
            {rechazada ? `Rechazada${g.reason ? ` · ${g.reason}` : ''}` : 'Ya se puede escuchar'}
            {' · '}{nombres([...new Set(g.requests.map(r => r.player.name))])}
          </span>
        </span>
      </button>
      {rechazada && (
        <button onClick={onDeshacer} className="shrink-0 rounded-full px-2.5 py-1.5 text-xs font-medium text-accent active:bg-accent-soft">
          Deshacer
        </button>
      )}
    </div>
  )
}

function HojaEnlazar({ g: actual, audiolibros, onCerrar, onElegir }) {
  const g = useUltimo(actual)
  const [enviando, setEnviando] = useState(null)
  return (
    <HojaInferior abierta={!!actual} titulo="Enlazar con un audiolibro" onCerrar={onCerrar}>
      <p className="mb-3 text-[13px] leading-relaxed text-ink-dim">
        {g && (g.books.length === 1
          ? 'El libro de esta petición se escuchará con el que elijas.'
          : `Los ${g.books.length} libros de esta petición se escucharán con el que elijas.`)}
      </p>
      {!audiolibros?.length && <p className="py-6 text-center text-sm text-ink-mute">Todavía no hay ningún audiolibro.</p>}
      <div className="space-y-2 pb-2">
        {(audiolibros || []).map(ab => (
          <button
            key={ab.id}
            disabled={!!enviando}
            onClick={async () => { setEnviando(ab.id); await onElegir(ab); setEnviando(null) }}
            className="flex w-full items-center gap-3 rounded-xl2 border border-line bg-surface p-2.5 text-left active:bg-surface-2 disabled:opacity-70"
          >
            <Cover url={ab.cover_url} title={ab.title} className="w-10 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold leading-tight">{ab.title}</span>
              <span className="mt-0.5 block truncate text-xs text-ink-dim">
                {[ab.author, ESTADOS_AB[ab.status]].filter(Boolean).join(' · ')}
              </span>
            </span>
            {enviando === ab.id ? <Girando className="h-4 w-4 text-accent" /> : <IconEnlace className="h-4 w-4 shrink-0 text-ink-mute" />}
          </button>
        ))}
      </div>
    </HojaInferior>
  )
}

function HojaRechazar({ g: actual, onCerrar, onRechazar }) {
  const g = useUltimo(actual)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  useEffect(() => { if (actual) setMotivo('') }, [actual])
  const gente = g ? [...new Set(g.requests.filter(r => !r.rejected_at).map(r => r.player.name))] : []
  return (
    <HojaInferior
      abierta={!!actual}
      titulo="Rechazar la petición"
      onCerrar={onCerrar}
      pie={
        <motion.button
          data-pulsa="0.98"
          disabled={enviando}
          onClick={async () => { setEnviando(true); await onRechazar(motivo); setEnviando(false) }}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl2 bg-danger text-sm font-semibold text-white disabled:opacity-70"
        >
          {enviando && <Girando className="h-4 w-4" />}
          Rechazar
        </motion.button>
      }
    >
      <p className="mb-4 text-[13px] leading-relaxed text-ink-dim">
        {gente.length ? `${nombres(gente)} verá${gente.length > 1 ? 'n' : ''} en la ficha del libro que no se va a preparar, con el motivo si lo pones.` : ''}
        {' '}Se puede deshacer.
      </p>
      <label className="block">
        <span className="mb-1.5 block px-1 text-[13px] text-ink-dim">Motivo (opcional)</span>
        <textarea
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Por ejemplo: no encuentro el EPUB en español"
          className="w-full resize-none rounded-xl2 border border-line bg-surface px-3.5 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-mute focus:border-accent-line"
        />
      </label>
    </HojaInferior>
  )
}

// Lo último con lo que se abrió una hoja: mientras baja al cerrarse, su
// contenido no se vacía de golpe.
function useUltimo(valor) {
  const [ultimo, setUltimo] = useState(valor)
  if (valor && valor !== ultimo) setUltimo(valor)
  return valor || ultimo
}
