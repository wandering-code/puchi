import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../../../platform/api'
import { useCapa } from '../../../platform/capas'
import { usarPreferencia } from '../../../platform/preferencias'
import { useReproductor } from '../../../platform/reproductor'
import HojaInferior from '../../luniteca/HojaInferior'
import PantallaInferior from '../../luniteca/PantallaInferior'
import { IconCheck, IconChevron, IconList, IconPausa, IconPlay } from '../../../ui/icons'
import { Girando } from '../audiolibros/Audiolibros'
import { reloj } from '../audiolibros/formato'
import { Ecualizador } from '../escuchar/PantallaReproductor'
import { arreglar, caracterDe, casar, fraseEn, segundoDe, trocear } from './sincro'

// Leer el libro en la app (#78). Para quien tenga el libro en su estantería y
// el EPUB esté subido, tenga audio o no.
//
// Si el capítulo tiene mapa (#71), tocar una frase la pone a sonar y,
// mientras suena, la frase que se oye se resalta y el texto la sigue. Si
// mueves el texto con el dedo deja de seguirla, hasta que tocas otra frase o
// "Volver a lo que suena".
//
// El texto no se vuelve a pintar a cada avance del audio (son cientos de
// frases, cuatro veces por segundo): la frase que suena se marca tocando el
// atributo de su <span> directamente.

const LETRAS = [15.5, 17, 19]

// Lo último guardado en esta sesión, por libro. Quien abre el lector le pasa
// los datos que tenía (los de la ficha, por ejemplo), que pueden ser de antes
// de haber leído un rato.
const ultimas = new Map()

export default function PantallaLectura() {
  const r = useReproductor()
  const hojaCapitulos = useCapa()
  const [letra, ponerLetra] = usarPreferencia('lectura_letra', 1)
  const abierta = !!r?.lector.abierta
  const base = r?.lectura?.libro
  // Si este libro es el que tiene el reproductor, sus datos son los más frescos.
  const libro = base && r.libro?.id === base.id ? r.libro : base

  const [capId, setCapId] = useState(null)
  const [textos, setTextos] = useState({})
  const [error, setError] = useState(null)
  const [seguir, setSeguir] = useState(true)
  const cuerpo = useRef(null)
  const caja = useRef(null)
  const irAParrafo = useRef(null)

  // Al abrir: el capítulo que se pidió; si no, lo que suena de este libro, por
  // dónde ibas leyendo o el primero.
  const vez = r?.lectura?.vez
  useEffect(() => {
    if (!abierta || !base) return
    const suena = r.libro?.id === base.id && r.cap ? r.cap.id : null
    const leida = ultimas.get(base.id) || base.read
    const leido = leida?.chapter_id
    const inicial = r.lectura.capId || (r.sonando && suena) || leido || suena || base.chapters[0]?.id
    setCapId(inicial)
    setSeguir(true)
    setError(null)
    // Por donde ibas leyendo, salvo que se abra para seguir lo que suena: desde
    // el reproductor (que pide su capítulo) o con este libro sonando.
    const aLoQueSuena = (r.lectura.capId && r.lectura.capId === suena) || (r.sonando && suena === inicial)
    irAParrafo.current = inicial === leido && !aLoQueSuena ? { cap: inicial, para: leida.para } : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, vez])

  const cap = libro?.chapters.find(c => c.id === capId) || null
  const datos = cap ? textos[cap.id] : null
  // Si el capítulo se ha regenerado desde que se pidió su texto, el mapa ya no vale.
  const viejo = datos && cap?.generated_at && datos.generated_at !== cap.generated_at

  useEffect(() => {
    if (!abierta || !libro || !cap || (datos && !viejo)) return
    let vivo = true
    api(`/listen/${libro.id}/chapters/${cap.id}/text`)
      .then(d => { if (vivo) setTextos(t => ({ ...t, [cap.id]: d })) })
      .catch(e => { if (vivo) setError(e.message) })
    return () => { vivo = false }
  }, [abierta, libro, cap, datos, viejo])

  const texto = useMemo(() => arreglar(datos?.text), [datos?.text])
  const { parrafos, frases } = useMemo(() => trocear(texto), [texto])
  const sincro = useMemo(() => casar(texto, datos?.pieces), [texto, datos?.pieces])
  const conAudio = !!(cap?.ready && sincro.length)

  const esteSuena = !!(libro && r.libro?.id === libro.id && r.cap?.id === cap?.id)
  const actual = esteSuena && conAudio ? fraseEn(frases, caracterDe(sincro, r.t)) : null

  // El audio ha pasado al capítulo siguiente: el texto va con él.
  useEffect(() => {
    if (!abierta || !seguir || !libro || r.libro?.id !== libro.id || !r.cap || !r.sonando) return
    if (r.cap.id !== capId) setCapId(r.cap.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.cap?.id])

  // Al cambiar de capítulo, arriba (o al párrafo guardado, en cuanto haya texto).
  useLayoutEffect(() => {
    if (cuerpo.current) cuerpo.current.scrollTop = 0
  }, [capId])
  // Sin dependencias a propósito: el texto puede estar ya pedido (reabrir el
  // mismo capítulo) o llegar más tarde, y en los dos casos hay que esperar a
  // que esté pintado el capítulo que toca. Mirarlo es solo una comparación.
  useEffect(() => {
    let id
    const intentar = () => {
      const ir = irAParrafo.current
      if (!ir || ir.cap !== capId || !datos || !caja.current || !cuerpo.current) return
      // Mientras la pantalla sube, su scroll está congelado (ui/quieto.js) y al
      // soltarlo vuelve a donde estaba: se espera a que termine.
      if (cuerpo.current.style.overflowY === 'hidden') { id = setTimeout(intentar, 120); return }
      irAParrafo.current = null
      const p = caja.current.querySelector(`[data-p="${ir.para}"]`)
      if (p) cuerpo.current.scrollTop += p.getBoundingClientRect().top - cuerpo.current.getBoundingClientRect().top - 70
    }
    intentar()
    return () => clearTimeout(id)
  })

  // La frase que suena, marcada y a la vista.
  const marcada = useRef(null)
  useEffect(() => {
    const nodo = actual && caja.current?.querySelector(`[data-f="${actual.i}"]`)
    if (marcada.current && marcada.current !== nodo) marcada.current.removeAttribute('data-suena')
    marcada.current = nodo || null
    if (!nodo) return
    nodo.setAttribute('data-suena', '')
    if (!seguir || !cuerpo.current) return
    let id
    const centrar = () => {
      const el = cuerpo.current
      if (!el) return
      // Pantalla subiendo: su scroll se repone al acabar (ver arriba).
      if (el.style.overflowY === 'hidden') { id = setTimeout(centrar, 120); return }
      const vista = el.getBoundingClientRect()
      const f = nodo.getBoundingClientRect()
      if (f.top < vista.top + vista.height * 0.2 || f.bottom > vista.top + vista.height * 0.72) {
        nodo.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }
    centrar()
    return () => clearTimeout(id)
  }, [actual, seguir, parrafos, abierta])

  // Mover el texto con el dedo es querer leer por otro sitio: se deja de seguir.
  useEffect(() => {
    const el = cuerpo.current
    if (!el || !abierta) return
    const soltar = () => setSeguir(false)
    el.addEventListener('touchmove', soltar, { passive: true })
    el.addEventListener('wheel', soltar, { passive: true })
    return () => { el.removeEventListener('touchmove', soltar); el.removeEventListener('wheel', soltar) }
  }, [abierta])

  // Por dónde vas: el primer párrafo a la vista, cada poco y al cerrar.
  const guardar = useCallback(() => {
    if (!libro || !cap || !caja.current || !cuerpo.current || !parrafos.length) return
    const arriba = cuerpo.current.getBoundingClientRect().top + 80
    const ps = caja.current.querySelectorAll('[data-p]')
    let para = 0
    for (const p of ps) { if (p.getBoundingClientRect().bottom > arriba) { para = Number(p.dataset.p); break } }
    ultimas.set(libro.id, { chapter_id: cap.id, para })
    api(`/listen/${libro.id}/reading`, { method: 'PUT', body: { chapter_id: cap.id, para } }).catch(() => {})
  }, [libro, cap, parrafos])
  useEffect(() => {
    const el = cuerpo.current
    if (!el || !abierta) return
    // Al pararse: así se guarda también lo último antes de cerrar con el
    // gesto de atrás, que no pasa por `cerrar`.
    let id
    const alMover = () => { clearTimeout(id); id = setTimeout(() => guardar(true), 1200) }
    el.addEventListener('scroll', alMover, { passive: true })
    return () => { clearTimeout(id); el.removeEventListener('scroll', alMover) }
  }, [abierta, guardar])

  const cerrar = () => { guardar(true); r.lector.cerrar() }

  const tocar = useCallback((i) => {
    const f = frases[i]
    if (!f || !conAudio) return
    const s = segundoDe(sincro, f.desde)
    if (s == null) return
    // Un pelín antes: el reparto por caracteres es aproximado, y mejor oír el
    // final de la frase de antes que perderse la primera sílaba.
    r.ponerEn(libro, cap, Math.max(0, s - 0.3))
    setSeguir(true)
    const nodo = caja.current?.querySelector(`[data-f="${i}"]`)
    if (nodo) {
      nodo.setAttribute('data-tocada', '')
      setTimeout(() => nodo.removeAttribute('data-tocada'), 450)
    }
  }, [frases, conAudio, sincro, r, libro, cap])
  // Al texto se le pasa siempre la misma función: si cambiara (y cambia con
  // cada avance del audio, porque depende de `r`), se volvería a pintar entero.
  const tocarRef = useRef(tocar)
  tocarRef.current = tocar
  const alTocar = useCallback(i => tocarRef.current(i), [])

  // El play de abajo: si este capítulo ya suena, pausa y sigue; si no, empieza
  // por la primera frase a la vista.
  function play() {
    if (esteSuena) { r.alternar(); setSeguir(true); return }
    let desde = 0
    if (conAudio && cuerpo.current && caja.current) {
      const arriba = cuerpo.current.getBoundingClientRect().top + 70
      const nodo = [...caja.current.querySelectorAll('[data-f]')].find(n => n.getBoundingClientRect().bottom > arriba)
      const s = nodo ? segundoDe(sincro, frases[Number(nodo.dataset.f)]?.desde) : null
      desde = s ? Math.max(0, s - 0.3) : 0
    }
    r.ponerEn(libro, cap, desde)
    setSeguir(true)
  }

  if (!r) return null
  const i = libro && cap ? libro.chapters.findIndex(c => c.id === cap.id) : -1
  const sig = i >= 0 ? libro.chapters[i + 1] : null
  // El texto suele empezar por el título del capítulo: entonces ese párrafo
  // hace de título (y también se puede tocar, que es lo primero que suena).
  // También si solo trae una parte ("3" en «Capítulo 3»).
  const primero = parrafos[0] ? limpio(parrafos[0].frases.map(f => f.texto).join(' ')) : ''
  const tituloEnTexto = !!(cap && primero && primero.length <= 40 && ` ${limpio(cap.title)} `.includes(` ${primero} `))

  return (
    <PantallaInferior
      abierta={abierta}
      onCerrar={cerrar}
      nivel={56}
      refCuerpo={cuerpo}
      cabecera={
        <div className="sticky top-0 z-10 flex items-center gap-2 bg-bg/90 px-3 pb-2 backdrop-blur">
          <motion.button
            onClick={cerrar}
            aria-label="Cerrar la lectura"
            whileTap={{ scale: 0.92 }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink"
          >
            <IconChevron className="h-5 w-5" />
          </motion.button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">{libro?.title}</p>
            <p className="truncate text-xs text-ink-mute">{cap ? `Capítulo ${i + 1} de ${libro.chapters.length}` : ''}</p>
          </div>
          <motion.button
            onClick={() => ponerLetra((letra + 1) % LETRAS.length)}
            aria-label="Tamaño de la letra"
            whileTap={{ scale: 0.92 }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface font-serif text-ink"
          >
            <span className="text-[13px]">A</span><span className="text-[17px]">a</span>
          </motion.button>
          <motion.button
            onClick={hojaCapitulos.abrir}
            aria-label="Capítulos"
            whileTap={{ scale: 0.92 }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink"
          >
            <IconList className="h-[18px] w-[18px]" />
          </motion.button>
        </div>
      }
      pie={cap && datos ? (
        <Pie
          r={r}
          listo={cap.ready}
          esteSuena={esteSuena}
          conAudio={conAudio}
          seguir={seguir}
          onPlay={play}
          onVolver={() => setSeguir(true)}
        />
      ) : null}
    >
      <div className="mx-auto w-full max-w-[34rem] px-6 pb-16 pt-6">
        {cap && !tituloEnTexto && (
          <h2 className="mb-6 font-display text-[1.6rem] font-bold leading-tight tracking-[-0.02em]">{cap.title}</h2>
        )}
        {error && !datos && <p className="rounded-xl2 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{error}</p>}
        {!datos && !error && (
          <div className="space-y-3">
            {[100, 92, 97, 60, 0, 95, 88, 99, 70].map((w, n) => (
              <div key={n} className="h-4 animate-pulse rounded bg-surface-2" style={{ width: `${w}%`, opacity: w ? 1 : 0 }} />
            ))}
          </div>
        )}
        {datos && (
          <div ref={caja}>
            <Texto
              parrafos={parrafos}
              tam={LETRAS[letra] || LETRAS[1]}
              titulo={tituloEnTexto ? cap.title : null}
              tocable={conAudio}
              onTocar={alTocar}
            />
          </div>
        )}
        {datos && sig && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => { guardar(true); setCapId(sig.id); setSeguir(false) }}
            className="mt-12 flex w-full items-center gap-3 rounded-xl2 border border-line bg-surface px-4 py-3.5 text-left active:bg-surface-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute">Siguiente capítulo</span>
              <span className="block truncate text-[15px] font-semibold">{sig.title}</span>
            </span>
            <IconChevron className="h-4 w-4 -rotate-90 text-ink-mute" />
          </motion.button>
        )}
      </div>

      <HojaCapitulos
        abierta={hojaCapitulos.abierta}
        onCerrar={hojaCapitulos.cerrar}
        libro={libro}
        capId={capId}
        suenaId={libro && r.libro?.id === libro.id ? r.cap?.id : null}
        sonando={r.sonando}
        onElegir={id => { guardar(true); setCapId(id); setSeguir(false); hojaCapitulos.cerrar() }}
      />
    </PantallaInferior>
  )
}

const limpio = s => (s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

// El texto, pintado una vez por capítulo y tamaño de letra.
const Texto = memo(function Texto({ parrafos, tam, titulo: tituloCap, tocable, onTocar }) {
  // Un solo manejador para todas las frases.
  const alTocar = (e) => {
    const f = e.target.closest('[data-f]')
    if (f) onTocar(Number(f.dataset.f))
  }
  return (
    <div
      onClick={tocable ? alTocar : undefined}
      className="font-serif text-ink"
      style={{ fontSize: `${tam}px`, lineHeight: 1.75 }}
    >
      {parrafos.map(p => {
        // El párrafo del título se enseña con el título tal cual (en el EPUB
        // suele venir en mayúsculas), pero sigue siendo una frase que se toca.
        const titulo = tituloCap && p.i === 0
        const Etiqueta = titulo ? 'h2' : 'p'
        return (
          <Etiqueta
            key={p.i}
            data-p={p.i}
            className={titulo
              ? 'mb-6 font-display text-[1.6rem] font-bold leading-tight tracking-[-0.02em]'
              : 'mb-[0.85em] [hyphens:auto]'}
            lang="es"
          >
            {titulo ? (
              <span data-f={p.frases[0].i} className={`rounded-[4px] transition-colors duration-300 data-[suena]:bg-accent-soft data-[tocada]:bg-accent/25 ${tocable ? 'cursor-pointer' : ''}`}>
                {tituloCap}
              </span>
            ) : p.frases.map(f => (
              <span
                key={f.i}
                data-f={f.i}
                className={`rounded-[4px] [box-decoration-break:clone] transition-colors duration-300 data-[suena]:bg-accent-soft data-[tocada]:bg-accent/25 ${tocable ? 'cursor-pointer' : ''}`}
              >
                {f.texto}{' '}
              </span>
            ))}
          </Etiqueta>
        )
      })}
    </div>
  )
})

function Pie({ r, listo, esteSuena, conAudio, seguir, onPlay, onVolver }) {
  const sonando = esteSuena && r.sonando
  const cargando = esteSuena && r.cargando && !r.sonando
  const pct = esteSuena && r.dur ? Math.min(100, (r.t / r.dur) * 100) : 0
  return (
    <div className="border-t border-line bg-bg/95 px-4 pt-2.5 backdrop-blur" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.6rem)' }}>
      <div className="mx-auto flex w-full max-w-[34rem] items-center gap-3">
        {!listo ? (
          <p className="min-h-11 flex-1 py-2 text-xs leading-snug text-ink-mute">Este capítulo todavía no tiene audio.</p>
        ) : (<>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={onPlay}
          aria-label={sonando ? 'Pausa' : 'Escuchar desde aquí'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-sm"
        >
          {cargando ? <Girando className="h-5 w-5" /> : sonando ? <IconPausa className="h-5 w-5" /> : <IconPlay className="ml-0.5 h-5 w-5" />}
        </motion.button>
        <div className="min-w-0 flex-1">
          {esteSuena ? (
            <>
              <div className="flex items-center justify-between text-[11px] tabular-nums text-ink-mute">
                <span className="flex items-center gap-1.5">{sonando && <Ecualizador activo />}{reloj(r.t)}</span>
                <span>−{reloj(Math.max(0, r.dur - r.t))}</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
            </>
          ) : (
            <p className="text-xs leading-snug text-ink-dim">
              {conAudio
                ? 'Escuchar desde lo que tienes a la vista, o toca una frase'
                : 'Escuchar este capítulo. Es de antes de poder tocar una frase para que suene.'}
            </p>
          )}
        </div>
        </>)}
        <AnimatePresence initial={false}>
          {esteSuena && conAudio && !seguir && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={onVolver}
              className="shrink-0 rounded-full border border-accent-line bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent"
            >
              Ir a lo que suena
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function HojaCapitulos({ abierta, onCerrar, libro, capId, suenaId, sonando, onElegir }) {
  const lista = useRef(null)
  useEffect(() => {
    if (!abierta) return
    const id = setTimeout(() => lista.current?.querySelector('[data-actual]')?.scrollIntoView({ block: 'center' }), 60)
    return () => clearTimeout(id)
  }, [abierta])
  return (
    <HojaInferior abierta={abierta} titulo="Capítulos" onCerrar={onCerrar}>
      <div ref={lista} className="max-h-[60vh] overflow-y-auto overflow-hidden rounded-xl2 border border-line bg-surface">
        {libro?.chapters.map((c, n) => {
          const actual = c.id === capId
          return (
            <button
              key={c.id}
              data-actual={actual || undefined}
              onClick={() => onElegir(c.id)}
              className={`flex w-full items-center gap-3 px-3.5 py-3 text-left ${n ? 'border-t border-line/70' : ''} ${actual ? 'bg-accent-soft/60' : 'active:bg-surface-2'}`}
            >
              <span className="flex w-6 shrink-0 justify-end text-xs tabular-nums text-ink-mute">
                {c.id === suenaId ? <Ecualizador activo={sonando} /> : n + 1}
              </span>
              <span className={`min-w-0 flex-1 truncate text-sm ${actual ? 'font-semibold text-accent' : 'text-ink'}`}>{c.title}</span>
              {c.synced ? (
                <IconCheck className="h-3.5 w-3.5 shrink-0 text-ink-mute" aria-label="Se puede seguir con el audio" />
              ) : null}
            </button>
          )
        })}
      </div>
      <p className="mt-2 px-1 pb-2 text-[11px] leading-relaxed text-ink-mute">
        Con ✓, los capítulos en los que se puede tocar una frase para que suene.
      </p>
    </HojaInferior>
  )
}
