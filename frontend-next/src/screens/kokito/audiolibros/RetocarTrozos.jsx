import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../platform/api'
import { useReproductor } from '../../../platform/reproductor'
import PantallaInferior from '../../luniteca/PantallaInferior'
import Desplegable from '../../../ui/Desplegable'
import { IconChevron, IconPausa, IconPlay, IconRefresh, IconX } from '../../../ui/icons'
import { Girando } from './Audiolibros'
import { reloj } from './formato'
import { arreglar, casar } from '../lectura/sincro'

// Retocar trozos sueltos de un capítulo (#71), rediseñado a petición del
// usuario (2026-10-18): en vez de una lista pequeña, el capítulo entero en
// texto, como el lector. Cada trozo que se le pidió a Higgs es un tramo del
// texto; se toca, suena solo ese trozo, y abajo se manda rehacer (otra toma,
// o con el texto cambiado para que diga bien una palabra).
//
// Tiene su propio <audio>: escuchar aquí es revisar, no leer, así que no pasa
// por el reproductor de la app ni cuenta como escuchado. Si estaba sonando un
// audiolibro, se pausa.
//
// Los retoques van a la cola del sobremesa, que los hace incluso a mitad de un
// capítulo largo; mientras haya alguno pendiente se mira cada 5 s, y al llegar
// el audio nuevo se recarga solo.

export default function RetocarTrozos({ ab, cap, abierta, onCerrar, onHecho }) {
  const r = useReproductor()
  const [texto, setTexto] = useState(null)
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  // Los trozos marcados (se pueden marcar varios y lanzarlos de una vez).
  const [sel, setSel] = useState(() => new Set())
  const [t, setT] = useState(0)
  const [sonando, setSonando] = useState(false)
  const audio = useRef(null)
  const hasta = useRef(null) // si suena solo un trozo, dónde parar
  const generadoEn = useRef(null)
  const alHecho = useRef(onHecho)
  alHecho.current = onHecho

  const cargar = useCallback(() => {
    if (!ab || !cap) return
    api(`/audiobooks/${ab.id}/chapters/${cap.id}/pieces`)
      .then(d => {
        setDatos(d)
        setError(null)
        if (d.generated_at && generadoEn.current && d.generated_at !== generadoEn.current) alHecho.current?.()
        generadoEn.current = d.generated_at
      })
      .catch(e => setError(e.message))
  }, [ab, cap])

  useEffect(() => {
    if (!abierta || !ab || !cap) return
    setSel(new Set())
    generadoEn.current = null
    cargar()
    api(`/audiobooks/${ab.id}/chapters/${cap.id}/text`).then(d => setTexto(d.text)).catch(e => setError(e.message))
    return () => { audio.current?.pause() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, ab?.id, cap?.id])

  const pendientes = datos?.pieces.filter(p => p.pending && !p.error).length || 0
  useEffect(() => {
    if (!abierta || !pendientes) return
    const id = setInterval(cargar, 5000)
    return () => clearInterval(id)
  }, [abierta, pendientes, cargar])

  const limpio = useMemo(() => arreglar(texto || ''), [texto])
  const rangos = useMemo(
    () => casar(limpio, (datos?.pieces || []).map(p => ({ text: p.text, start: p.start, end: p.end }))),
    [limpio, datos?.pieces],
  )
  const parrafos = useMemo(() => partir(limpio, rangos), [limpio, rangos])

  const unico = sel.size === 1 ? [...sel][0] : null
  const trozo = unico != null ? datos?.pieces[unico] : null
  const suena = sonando && datos ? datos.pieces.find(p => t >= p.start && t < p.end)?.i : null

  // Los ya rehechos, en orden, para ir de uno a otro (o oírlos todos
  // seguidos) sin buscarlos en el texto.
  const rehechos = useMemo(() => (datos?.pieces || []).filter(p => p.redone > 0 && !p.pending).map(p => p.i), [datos?.pieces])
  const ronda = useRef(null) // los que faltan por sonar en "Oír todos"
  const [enRonda, setEnRonda] = useState(false)
  const pararRonda = () => { ronda.current = null; setEnRonda(false) }

  // `oir`: si suena al llegar. Con las flechas no (pedido por el usuario):
  // solo se marca y se trae a la vista; para oírlo, «Oír» o tocarlo.
  function verTrozo(i, { oir = true } = {}) {
    const p = datos?.pieces[i]
    if (!p) return
    setSel(new Set([i]))
    if (oir) sonar(Math.max(0, p.start - 0.1), p.end)
    else { hasta.current = null; audio.current?.pause() }
    requestAnimationFrame(() => {
      document.querySelector(`[data-retoque] [data-i="${i}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }
  function irRehecho(paso) {
    if (!rehechos.length) return
    pararRonda()
    const desde = unico ?? (paso > 0 ? -1 : Infinity)
    const siguiente = paso > 0
      ? rehechos.find(i => i > desde) ?? rehechos[0]
      : [...rehechos].reverse().find(i => i < desde) ?? rehechos[rehechos.length - 1]
    verTrozo(siguiente, { oir: false })
  }
  function siguienteDeRonda() {
    const i = ronda.current?.shift()
    if (i == null) { pararRonda(); return }
    verTrozo(i)
  }
  function oirTodos() {
    if (enRonda) { pararRonda(); audio.current?.pause(); return }
    ronda.current = [...rehechos]
    setEnRonda(true)
    siguienteDeRonda()
  }

  const src = ab && cap && datos ? `/api/audiobooks/${ab.id}/chapters/${cap.id}/audio?v=${encodeURIComponent(datos.generated_at || '')}` : null

  function sonar(desde, hastaS = null) {
    const a = audio.current
    if (!a) return
    if (r?.sonando) r.alternar()
    hasta.current = hastaS
    a.currentTime = desde
    a.play().catch(() => {})
  }
  function alternar() {
    const a = audio.current
    if (!a) return
    pararRonda()
    if (!a.paused) { a.pause(); return }
    // Con un trozo marcado (por ejemplo, con las flechas), el play es para
    // oír ESE trozo, no para seguir por donde se quedó el audio.
    if (trozo) { sonar(Math.max(0, trozo.start - 0.1), trozo.end); return }
    hasta.current = null
    if (r?.sonando) r.alternar()
    a.play().catch(() => {})
  }

  // Tocar marca el trozo (y suena); tocarlo otra vez lo desmarca.
  const elegir = useCallback((i) => {
    pararRonda()
    if (sel.has(i)) {
      setSel(s => { const n = new Set(s); n.delete(i); return n })
      return
    }
    setSel(s => new Set(s).add(i))
    const p = datos?.pieces[i]
    if (p) sonar(Math.max(0, p.start - 0.1), p.end)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, sel])
  const elegirRef = useRef(elegir)
  elegirRef.current = elegir
  const alTocar = useCallback(i => elegirRef.current(i), [])

  async function rehacer(textoNuevo) {
    try {
      setDatos(await api(`/audiobooks/${ab.id}/chapters/${cap.id}/pieces/${unico}/redo`, { method: 'POST', body: { text: textoNuevo } }))
      setError(null)
    } catch (e) { setError(e.message) }
  }
  // Varios de una vez: otra toma de cada uno (los que ya estaban en cola se
  // dejan como estaban). Luego se desmarcan: quedan subrayados como "en cola".
  async function rehacerVarios() {
    try {
      let ultimo = null
      for (const i of [...sel].sort((a, b) => a - b)) {
        if (datos?.pieces[i]?.pending && !datos.pieces[i].error) continue
        ultimo = await api(`/audiobooks/${ab.id}/chapters/${cap.id}/pieces/${i}/redo`, { method: 'POST', body: { text: null } })
      }
      if (ultimo) setDatos(ultimo)
      setSel(new Set())
      setError(null)
    } catch (e) { setError(e.message) }
  }
  async function anular() {
    try {
      setDatos(await api(`/audiobooks/${ab.id}/chapters/${cap.id}/pieces/${unico}/redo`, { method: 'DELETE' }))
    } catch (e) { setError(e.message) }
  }

  const cerrar = () => { audio.current?.pause(); onCerrar() }

  return (
    <PantallaInferior
      abierta={abierta}
      onCerrar={cerrar}
      // Encima de la hoja del capítulo (HojaInferior, z 60), que es desde donde se abre.
      nivel={61}
      cabecera={
        <div className="sticky top-0 z-10 flex items-center gap-2 bg-bg/90 px-3 pb-2 backdrop-blur">
          <button
            onClick={cerrar}
            aria-label="Cerrar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink transition-transform duration-150 active:scale-90"
          >
            <IconChevron className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">Retocar trozos</p>
            <p className="truncate text-xs text-ink-mute">{cap?.title}</p>
          </div>
          <span className="w-10 shrink-0" />
        </div>
      }
      pie={datos ? (
        <Tarjeta
          trozo={trozo}
          varios={sel.size > 1 ? sel.size : 0}
          onRehacerVarios={rehacerVarios}
          sonando={sonando}
          t={t}
          dur={cap?.duration_s || 0}
          pendientes={pendientes}
          error={error}
          onAlternar={alternar}
          onEscucharTrozo={() => trozo && sonar(Math.max(0, trozo.start - 0.1), trozo.end)}
          onRehacer={rehacer}
          onAnular={anular}
          onSoltar={() => setSel(new Set())}
          rehechos={rehechos}
          posicion={unico != null ? rehechos.indexOf(unico) : -1}
          enRonda={enRonda}
          onAnterior={() => irRehecho(-1)}
          onSiguiente={() => irRehecho(1)}
          onOirTodos={oirTodos}
        />
      ) : null}
    >
      {src && (
        <audio
          ref={audio}
          src={src}
          preload="metadata"
          playsInline
          onPlay={() => setSonando(true)}
          onPause={() => setSonando(false)}
          onEnded={() => setSonando(false)}
          onTimeUpdate={e => {
            const a = e.currentTarget
            setT(a.currentTime)
            if (hasta.current != null && a.currentTime >= hasta.current) {
              a.pause()
              hasta.current = null
              // Oyendo todos los rehechos: el siguiente, tras una pausa corta.
              if (ronda.current) setTimeout(siguienteDeRonda, 350)
            }
          }}
        />
      )}
      <div className="mx-auto w-full max-w-[34rem] px-6 pb-10 pt-4">
        <p className="mb-5 rounded-xl2 bg-accent-soft/60 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-dim">
          Toca la parte que suena mal: se oye solo ese trozo y abajo puedes rehacerlo. Puedes marcar varios y rehacerlos de una vez; tocar otra vez desmarca.
          <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            <span className="underline decoration-[color:var(--color-read)] decoration-2 underline-offset-4">Rehecho</span>
            <span className="underline decoration-accent decoration-dotted decoration-2 underline-offset-4">En cola</span>
            <span className="underline decoration-danger decoration-2 underline-offset-4">Falló</span>
          </span>
        </p>
        {error && !datos && <p className="rounded-xl2 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</p>}
        {(!datos || texto == null) && !error && (
          <div className="space-y-3">
            {abierta && [100, 92, 97, 60, 0, 95, 88].map((w, n) => (
              <div key={n} className="h-4 animate-pulse rounded bg-surface-2" style={{ width: `${w}%`, opacity: w ? 1 : 0 }} />
            ))}
          </div>
        )}
        {datos && texto != null && (
          <Texto parrafos={parrafos} piezas={datos.pieces} sel={sel} suena={suena} onTocar={alTocar} />
        )}
      </div>
    </PantallaInferior>
  )
}

// El texto en párrafos, y cada párrafo en tramos: los que son de un trozo
// (con su índice) y los que no (títulos que no se leen, huecos).
function partir(texto, rangos) {
  const out = []
  const linea = /[^\n]+/g
  let m
  while ((m = linea.exec(texto))) {
    if (!m[0].trim()) continue
    const a = m.index
    const b = a + m[0].length
    const tramos = []
    let cursor = a
    for (const r of rangos) {
      if (r.hasta <= a || r.desde >= b) continue
      const ini = Math.max(r.desde, cursor)
      const fin = Math.min(r.hasta, b)
      if (ini > cursor) tramos.push({ texto: texto.slice(cursor, ini) })
      if (fin > ini) tramos.push({ texto: texto.slice(ini, fin), i: r.i })
      cursor = Math.max(cursor, fin)
    }
    if (cursor < b) tramos.push({ texto: texto.slice(cursor, b) })
    out.push(tramos)
  }
  return out
}

const Texto = memo(function Texto({ parrafos, piezas, sel, suena, onTocar }) {
  const alTocar = (e) => {
    const el = e.target.closest('[data-i]')
    if (el) onTocar(Number(el.dataset.i))
  }
  return (
    <div onClick={alTocar} data-retoque className="font-serif text-[17px] leading-[1.8] text-ink" lang="es">
      {parrafos.map((tramos, n) => (
        <p key={n} className="mb-[0.85em]">
          {tramos.map((tr, k) => {
            if (tr.i == null) return <span key={k}>{tr.texto}</span>
            const p = piezas[tr.i]
            const estado = sel.has(tr.i) ? 'sel' : suena === tr.i ? 'suena' : null
            return (
              <span
                key={k}
                data-i={tr.i}
                className={`cursor-pointer rounded-[4px] [box-decoration-break:clone] transition-colors duration-200 ${
                  estado === 'sel' ? 'bg-accent/25' : estado === 'suena' ? 'bg-accent-soft' : 'active:bg-accent/15'
                } ${p?.pending
                  ? (p.error ? 'underline decoration-danger decoration-2 underline-offset-4' : 'underline decoration-accent decoration-dotted decoration-2 underline-offset-4')
                  : p?.redone > 0 ? 'underline decoration-[color:var(--color-read)] decoration-2 underline-offset-4' : ''}`}
              >
                {tr.texto}
              </span>
            )
          })}
        </p>
      ))}
    </div>
  )
})

// Abajo: con un trozo elegido, lo que se puede hacer con él; si no, solo el
// play para escuchar el capítulo seguido.
function Tarjeta({ rehechos, posicion, enRonda, onAnterior, onSiguiente, onOirTodos, trozo, varios, onRehacerVarios, sonando, t, dur, pendientes, error, onAlternar, onEscucharTrozo, onRehacer, onAnular, onSoltar }) {
  const [editando, setEditando] = useState(false)
  const [nuevo, setNuevo] = useState('')
  const [enviando, setEnviando] = useState(false)
  useEffect(() => { setEditando(false); setNuevo(trozo?.pending_text || trozo?.text || '') }, [trozo?.i, trozo?.pending_text, trozo?.text])

  async function enviar(textoNuevo) {
    setEnviando(true)
    await onRehacer(textoNuevo)
    setEnviando(false)
    setEditando(false)
  }

  const pct = dur ? Math.min(100, (t / dur) * 100) : 0
  return (
    <div className="px-3 pt-1" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.6rem)' }}>
      <div
        className="mini-reproductor mx-auto w-full max-w-[34rem] overflow-hidden rounded-[22px] px-3 pb-3 pt-2.5"
        style={{ backgroundImage: 'linear-gradient(to bottom, color-mix(in srgb, var(--color-accent) 9%, transparent), transparent 70%)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onAlternar}
            aria-label={sonando ? 'Pausa' : 'Escuchar'}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-sm transition-transform duration-150 active:scale-90"
          >
            {sonando ? <IconPausa className="h-5 w-5" /> : <IconPlay className="ml-0.5 h-5 w-5" />}
          </button>
          <div className="min-w-0 flex-1">
            {varios ? (
              <>
                <p className="text-[13px] font-semibold leading-tight">{varios} trozos marcados</p>
                <p className="mt-0.5 text-[11px] text-ink-mute">Toca otro para añadirlo, o uno marcado para quitarlo</p>
              </>
            ) : trozo ? (
              <>
                <p className="line-clamp-2 text-[13px] leading-snug text-ink">«{trozo.text}»</p>
                <p className="mt-0.5 text-[11px] tabular-nums text-ink-mute">
                  {reloj(trozo.start)}
                  {trozo.emotion ? ` · ${trozo.emotion}` : ''}
                  {trozo.redone > 0 ? ` · rehecho${trozo.redone > 1 ? ` ×${trozo.redone}` : ''}` : ''}
                </p>
              </>
            ) : (
              <>
                <p className="text-[13px] font-semibold leading-tight">Toca un trozo del texto</p>
                <p className="mt-0.5 text-[11px] tabular-nums text-ink-mute">
                  {reloj(t)} de {reloj(dur)}{pendientes ? ` · ${pendientes} en cola` : ''}
                </p>
              </>
            )}
          </div>
          {(trozo || varios > 0) && (
            <button onClick={onSoltar} aria-label="Desmarcar todo" className="flex h-9 w-8 shrink-0 items-center justify-center rounded-full text-ink-mute active:bg-surface-2">
              <IconX className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%`, transition: 'width 0.25s linear' }} />
        </div>

        {/* Los rehechos, para oírlos sin buscarlos: anterior, siguiente o
            todos seguidos (cada uno se marca y se trae a la vista). */}
        <Desplegable abierto={rehechos.length > 0 && !varios && (!trozo || posicion >= 0)}>
          <div className="mt-2.5 flex items-center gap-2 rounded-xl2 bg-[color-mix(in_srgb,var(--color-read)_12%,transparent)] px-2 py-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--color-read)]" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">
              {posicion >= 0 ? `Rehecho ${posicion + 1} de ${rehechos.length}` : `${rehechos.length} ${rehechos.length === 1 ? 'rehecho' : 'rehechos'}`}
            </span>
            <button onClick={onAnterior} aria-label="Rehecho anterior" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-dim transition-transform duration-150 active:scale-90 active:bg-surface-2">
              <IconChevron className="h-4 w-4 rotate-90" />
            </button>
            <button onClick={onSiguiente} aria-label="Rehecho siguiente" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-dim transition-transform duration-150 active:scale-90 active:bg-surface-2">
              <IconChevron className="h-4 w-4 -rotate-90" />
            </button>
            <button
              onClick={onOirTodos}
              className={`inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition-colors ${enRonda ? 'bg-accent text-on-accent' : 'border border-line bg-surface text-ink-dim'}`}
            >
              {enRonda ? <IconPausa className="h-3 w-3" /> : <IconPlay className="h-3 w-3" />}
              {enRonda ? 'Parar' : 'Oír todos'}
            </button>
          </div>
        </Desplegable>

        <Desplegable abierto={varios > 0}>
          <div className="mt-2.5 border-t border-line/70 pt-2.5">
            {error && <p className="mb-2 text-[11px] text-danger">{error}</p>}
            <button
              onClick={async () => { setEnviando(true); await onRehacerVarios(); setEnviando(false) }}
              disabled={enviando}
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl2 bg-accent text-xs font-semibold text-on-accent transition-transform duration-150 active:scale-[0.98] disabled:opacity-60"
            >
              {enviando ? <Girando className="h-3.5 w-3.5" /> : <IconRefresh className="h-3.5 w-3.5" />}
              Rehacer los {varios} (otra toma de cada uno)
            </button>
          </div>
        </Desplegable>

        <Desplegable abierto={!!trozo}>
          <div className="mt-2.5 border-t border-line/70 pt-2.5">
            {error && <p className="mb-2 text-[11px] text-danger">{error}</p>}
            {trozo?.pending ? (
              trozo.error ? (
                <p className="mb-2 text-[11px] leading-snug text-danger">Falló al rehacerlo: {trozo.error}</p>
              ) : (
                <div className="flex items-center gap-2 rounded-xl2 bg-accent-soft/60 px-3 py-2 text-xs text-accent">
                  <Girando className="h-3.5 w-3.5" />
                  <span className="flex-1">En cola: el sobremesa lo hará en unos segundos</span>
                  <button onClick={onAnular} className="font-semibold text-ink-dim underline-offset-2 active:underline">Anular</button>
                </div>
              )
            ) : null}
            {(!trozo?.pending || trozo?.error) && (
              <div className="flex gap-2">
                <button
                  onClick={onEscucharTrozo}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl2 border border-line px-3 text-xs font-semibold text-ink-dim transition-transform duration-150 active:scale-95"
                >
                  <IconPlay className="h-3.5 w-3.5" /> Oír
                </button>
                <button
                  onClick={() => enviar(null)}
                  disabled={enviando}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl2 bg-accent text-xs font-semibold text-on-accent transition-transform duration-150 active:scale-[0.98] disabled:opacity-60"
                >
                  {enviando && !editando ? <Girando className="h-3.5 w-3.5" /> : <IconRefresh className="h-3.5 w-3.5" />}
                  Rehacer (otra toma)
                </button>
                <button
                  onClick={() => setEditando(v => !v)}
                  aria-expanded={editando}
                  className={`inline-flex h-10 items-center rounded-xl2 border px-3 text-xs font-semibold transition-colors ${editando ? 'border-accent-line bg-accent-soft text-accent' : 'border-line text-ink-dim'}`}
                >
                  Cambiar texto
                </button>
              </div>
            )}
            <Desplegable abierto={editando}>
              <div className="pt-2.5">
                <textarea
                  value={nuevo}
                  onChange={e => setNuevo(e.target.value)}
                  rows={3}
                  aria-label="Texto del trozo"
                  className="w-full resize-none rounded-xl2 border border-line bg-bg px-3 py-2 text-[13px] leading-snug text-ink outline-none focus:border-accent-line"
                />
                <p className="mt-1 px-1 text-[11px] text-ink-mute">Escribe una palabra de otra forma si no la dice bien (por ejemplo, separándola en sílabas).</p>
                <button
                  onClick={() => enviar(nuevo.trim() === trozo?.text ? null : nuevo.trim())}
                  disabled={enviando || !nuevo.trim()}
                  className="mt-2 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl2 bg-accent text-xs font-semibold text-on-accent transition-transform duration-150 active:scale-[0.98] disabled:opacity-60"
                >
                  {enviando && <Girando className="h-3.5 w-3.5" />}
                  Rehacer con este texto
                </button>
              </div>
            </Desplegable>
          </div>
        </Desplegable>
      </div>
    </div>
  )
}
