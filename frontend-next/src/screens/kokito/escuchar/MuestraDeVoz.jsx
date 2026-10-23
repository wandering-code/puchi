import { useEffect, useRef, useState } from 'react'
import { useReproductor } from '../../../platform/reproductor'
import { IconPausa, IconPlay } from '../../../ui/icons'

// Un trocito de cómo suenan los audiolibros, para hacerse a la idea antes de
// pedir uno (pedido por el usuario el 2026-10-18). Es la voz femenina, la que
// puede usar todo el mundo, generada con la misma cadena que un capítulo
// (emociones automáticas incluidas) a partir de un texto escrito para esto,
// con diálogo, una pregunta y una exclamación. Comprobado con Whisper: dice
// exactamente lo que pone. Es la toma que eligió el usuario de oído entre
// cuatro (semillas 2000 + 100·i): cada semilla interpreta un poco distinto.
//
// Su propio <audio>, aparte del reproductor de la app: si estabas escuchando
// un audiolibro, se pausa para que no suenen los dos.

const URL_MUESTRA = `${import.meta.env.BASE_URL}muestras/voz-femenina.m4a`
const DURACION = 24.1

export default function MuestraDeVoz({ className = '' }) {
  const r = useReproductor()
  const audio = useRef(null)
  const [sonando, setSonando] = useState(false)
  const [t, setT] = useState(0)

  useEffect(() => () => { audio.current?.pause() }, [])

  function alternar() {
    if (!audio.current) {
      const a = new Audio(URL_MUESTRA)
      a.addEventListener('timeupdate', () => setT(a.currentTime))
      a.addEventListener('play', () => setSonando(true))
      a.addEventListener('pause', () => setSonando(false))
      a.addEventListener('ended', () => { setSonando(false); setT(0); a.currentTime = 0 })
      audio.current = a
    }
    const a = audio.current
    if (a.paused) {
      if (r?.sonando) r.alternar()
      a.play().catch(() => {})
    } else {
      a.pause()
    }
  }

  const pct = Math.min(100, (t / DURACION) * 100)
  return (
    <div className={`flex items-center gap-3 rounded-xl2 border border-accent-line bg-accent-soft/40 px-3 py-2.5 ${className}`}>
      <button
        onClick={alternar}
        aria-label={sonando ? 'Pausar la muestra' : 'Escuchar una muestra de la voz'}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-sm transition-transform duration-150 active:scale-90"
      >
        {sonando ? <IconPausa className="h-4 w-4" /> : <IconPlay className="ml-0.5 h-4 w-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-tight text-ink">Escucha cómo suena</p>
        <p className="text-[11px] text-ink-dim">Un fragmento con la voz de los audiolibros · 24 s</p>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface">
          <div className="h-full w-full rounded-full bg-accent transition-transform duration-200" style={{ transform: `translateX(${pct - 100}%)` }} />
        </div>
      </div>
    </div>
  )
}
