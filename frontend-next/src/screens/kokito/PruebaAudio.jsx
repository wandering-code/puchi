import { useCallback, useEffect, useRef, useState } from 'react'
import { IconAdelante30, IconAtras30, IconPausa, IconPlay } from '../../ui/icons'

// Fase 0 de los audiolibros: antes de construir el reproductor de verdad,
// comprobar en un iPhone real lo que no se puede comprobar desde el escritorio.
//   1. Que el audio sigue sonando con la app en segundo plano y la pantalla
//      bloqueada (la PWA instalada en iOS tiene sus rarezas aquí).
//   2. Que los controles de la pantalla de bloqueo funcionan (Media Session).
//   3. Que AAC a 64 kbps mono suena igual de bien que MP3 a 128 kbps.
// El registro de abajo mide cuánto tiempo estuvo la app fuera y cuánto avanzó
// el audio mientras: si avanzan lo mismo, siguió sonando.
//
// El audio es temporal y vive fuera de la app (nginx, /kokito-audio/), detrás
// de una ruta difícil de adivinar. Los audiolibros de verdad irán por el
// backend con enlaces firmados.

const RUTA = '/kokito-audio/345744110018a907'
const FUENTES = [
  { id: 'aac', etiqueta: 'AAC 64k mono', src: `${RUTA}/capitulo.m4a` },
  { id: 'mp3', etiqueta: 'MP3 128k', src: `${RUTA}/capitulo.mp3` },
]
const VELOCIDADES = [0.8, 1, 1.2, 1.5]
const CLAVE = 'kokito-prueba-audio'

const reloj = (s) => {
  if (!Number.isFinite(s)) return '–:–'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}
const hora = () => new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function leerGuardado() {
  try { return JSON.parse(localStorage.getItem(CLAVE)) || {} } catch { return {} }
}
function guardar(datos) {
  try { localStorage.setItem(CLAVE, JSON.stringify({ ...leerGuardado(), ...datos })) } catch { /* sin almacenamiento */ }
}

export default function PruebaAudio() {
  const audio = useRef(null)
  const [fuente, setFuente] = useState(() => leerGuardado().fuente || 'aac')
  const [sonando, setSonando] = useState(false)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(NaN)
  const [vel, setVel] = useState(1)
  const [registro, setRegistro] = useState([])
  const salida = useRef(null) // { cuando, posicion } al irse a segundo plano

  const anotar = useCallback((texto) => {
    setRegistro(r => [`${hora()}  ${texto}`, ...r].slice(0, 60))
  }, [])

  const src = FUENTES.find(f => f.id === fuente).src

  // Retomar donde se dejó, por fuente.
  useEffect(() => {
    const a = audio.current
    const pos = leerGuardado()[`pos_${fuente}`]
    const alCargar = () => { if (pos) a.currentTime = pos }
    a.addEventListener('loadedmetadata', alCargar, { once: true })
    return () => a.removeEventListener('loadedmetadata', alCargar)
  }, [fuente])

  // Eventos del <audio>: estado y registro.
  useEffect(() => {
    const a = audio.current
    const ev = {
      play: () => { setSonando(true); anotar('▶ reproduce') },
      pause: () => { setSonando(false); anotar(`⏸ pausa en ${reloj(a.currentTime)}`) },
      ended: () => { setSonando(false); anotar('fin del capítulo') },
      waiting: () => anotar('esperando datos…'),
      stalled: () => anotar('la descarga se ha parado'),
      error: () => anotar(`error ${a.error?.code ?? ''}: no se puede reproducir`),
      loadedmetadata: () => setDur(a.duration),
      timeupdate: () => {
        setT(a.currentTime)
        guardar({ [`pos_${fuente}`]: a.currentTime })
        if ('mediaSession' in navigator && Number.isFinite(a.duration)) {
          try {
            navigator.mediaSession.setPositionState({ duration: a.duration, position: a.currentTime, playbackRate: a.playbackRate })
          } catch { /* iOS antiguo */ }
        }
      },
    }
    for (const [k, f] of Object.entries(ev)) a.addEventListener(k, f)
    return () => { for (const [k, f] of Object.entries(ev)) a.removeEventListener(k, f) }
  }, [anotar, fuente])

  // Lo que mide la prueba: segundo plano frente a avance del audio.
  useEffect(() => {
    const alCambiar = () => {
      const a = audio.current
      if (document.visibilityState === 'hidden') {
        salida.current = { cuando: Date.now(), posicion: a.currentTime, sonaba: !a.paused }
        anotar(`app en segundo plano (${a.paused ? 'en pausa' : 'sonando'})`)
      } else if (salida.current) {
        const fuera = (Date.now() - salida.current.cuando) / 1000
        const avance = a.currentTime - salida.current.posicion
        anotar(`vuelta tras ${reloj(fuera)} fuera; el audio avanzó ${reloj(Math.max(0, avance))}` +
          (salida.current.sonaba ? (avance >= fuera * a.playbackRate * 0.9 ? ' ✔ siguió sonando' : ' ✘ se cortó') : ''))
        salida.current = null
      }
    }
    document.addEventListener('visibilitychange', alCambiar)
    return () => document.removeEventListener('visibilitychange', alCambiar)
  }, [anotar])

  // Controles de la pantalla de bloqueo y del centro de control.
  useEffect(() => {
    if (!('mediaSession' in navigator)) { anotar('este navegador no tiene Media Session'); return }
    const a = audio.current
    const base = import.meta.env.BASE_URL
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: '5. Instrucciones sangrientas',
      artist: 'Joe Abercrombie',
      album: 'La mejor venganza',
      artwork: [{ src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' }],
    })
    const acciones = {
      play: () => { anotar('pantalla de bloqueo: play'); a.play() },
      pause: () => { anotar('pantalla de bloqueo: pausa'); a.pause() },
      seekbackward: () => { anotar('pantalla de bloqueo: −30 s'); a.currentTime = Math.max(0, a.currentTime - 30) },
      seekforward: () => { anotar('pantalla de bloqueo: +30 s'); a.currentTime = Math.min(a.duration || Infinity, a.currentTime + 30) },
      seekto: (d) => { anotar(`pantalla de bloqueo: ir a ${reloj(d.seekTime)}`); a.currentTime = d.seekTime },
    }
    for (const [k, f] of Object.entries(acciones)) {
      try { navigator.mediaSession.setActionHandler(k, f) } catch { anotar(`sin acción "${k}"`) }
    }
    return () => {
      for (const k of Object.keys(acciones)) {
        try { navigator.mediaSession.setActionHandler(k, null) } catch { /* nada */ }
      }
    }
  }, [anotar])

  const alternar = () => {
    const a = audio.current
    if (a.paused) a.play().catch(e => anotar(`no arranca: ${e.name}`))
    else a.pause()
  }
  const saltar = (s) => {
    const a = audio.current
    a.currentTime = Math.min(Math.max(0, a.currentTime + s), a.duration || Infinity)
  }
  const cambiarVelocidad = (v) => {
    setVel(v)
    audio.current.playbackRate = v
  }
  const cambiarFuente = (id) => {
    if (id === fuente) return
    audio.current.pause()
    setFuente(id)
    guardar({ fuente: id })
    anotar(`fuente: ${FUENTES.find(f => f.id === id).etiqueta}`)
  }

  const pct = Number.isFinite(dur) && dur > 0 ? (t / dur) * 100 : 0

  return (
    <div className="mx-auto max-w-md py-8">
      <h2 className="font-display text-[1.75rem] font-bold tracking-[-0.02em]">Escuchar</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-dim">
        Prueba del reproductor. Dale a reproducir, bloquea el móvil o cambia de app unos minutos
        y vuelve: abajo queda apuntado si siguió sonando.
      </p>

      <section className="mt-6 rounded-xl3 border border-line bg-surface p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-mute">La mejor venganza · Joe Abercrombie</p>
        <p className="mt-1 font-display text-lg font-bold">5. Instrucciones sangrientas</p>

        <audio ref={audio} src={src} preload="metadata" playsInline />

        <input
          type="range" min="0" max={Number.isFinite(dur) ? dur : 0} step="1" value={t}
          onChange={(e) => { audio.current.currentTime = Number(e.target.value) }}
          aria-label="Posición"
          className="mt-5 w-full accent-[var(--color-accent)]"
          style={{ background: `linear-gradient(to right, var(--color-accent) ${pct}%, var(--color-surface-2) ${pct}%)` }}
        />
        <div className="mt-1 flex justify-between text-xs tabular-nums text-ink-dim">
          <span>{reloj(t)}</span><span>−{reloj(dur - t)}</span>
        </div>

        <div className="mt-4 flex items-center justify-center gap-6">
          <button onClick={() => saltar(-30)} aria-label="Atrás 30 segundos"
            className="flex h-12 w-12 items-center justify-center rounded-full text-ink active:bg-surface-2">
            <IconAtras30 width={28} height={28} />
          </button>
          <button onClick={alternar} aria-label={sonando ? 'Pausa' : 'Reproducir'}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-on-accent shadow-md active:scale-95 transition-transform">
            {sonando ? <IconPausa width={28} height={28} /> : <IconPlay width={28} height={28} />}
          </button>
          <button onClick={() => saltar(30)} aria-label="Adelante 30 segundos"
            className="flex h-12 w-12 items-center justify-center rounded-full text-ink active:bg-surface-2">
            <IconAdelante30 width={28} height={28} />
          </button>
        </div>

        <div className="mt-5 flex justify-center gap-2">
          {VELOCIDADES.map(v => (
            <button key={v} onClick={() => cambiarVelocidad(v)}
              className={`rounded-full px-3 py-1.5 text-sm tabular-nums ${vel === v ? 'bg-accent-soft text-accent font-semibold' : 'text-ink-dim active:bg-surface-2'}`}>
              {String(v).replace('.', ',')}×
            </button>
          ))}
        </div>

        <div className="mt-4 flex justify-center gap-2 border-t border-line pt-4">
          {FUENTES.map(f => (
            <button key={f.id} onClick={() => cambiarFuente(f.id)}
              className={`rounded-full px-3 py-1.5 text-sm ${fuente === f.id ? 'bg-surface-2 font-semibold text-ink' : 'text-ink-dim active:bg-surface-2'}`}>
              {f.etiqueta}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-semibold text-ink-dim">Registro</h3>
        <pre className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl2 border border-line bg-surface p-3 text-xs leading-relaxed text-ink-dim">
          {registro.length ? registro.join('\n') : 'Aún no ha pasado nada.'}
        </pre>
      </section>
    </div>
  )
}
