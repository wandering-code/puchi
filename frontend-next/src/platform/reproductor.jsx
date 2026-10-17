import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import { useCapa } from './capas'
import { usarPreferencia } from './preferencias'

// El reproductor de audiolibros, uno para toda la app (fase 3, #65 de puchi).
//
// El <audio> vive aquí arriba y no en la pantalla del reproductor: así sigue
// sonando al cerrarla, al cambiar de sección o con la app en segundo plano
// (probado en el iPhone en la fase 0, #62). La pantalla y, en la fase 4, el
// mini reproductor de abajo solo enseñan y mandan sobre este.
//
// Por dónde va cada uno se guarda en el servidor (/listen/{id}/progress): al
// pausar, al cambiar de capítulo, al irse la app a segundo plano y cada 15 s
// mientras suena.
//
// Fase 4 (#66): la velocidad (va con la cuenta, como el resto de gustos), el
// temporizador para dormir y quitar el reproductor (`cerrar`), que es lo que
// hace desaparecer el mini reproductor de abajo.

const Ctx = createContext(null)
const CADA_CUANTO_GUARDAR = 15000

export function ReproductorProvider({ children }) {
  const audio = useRef(null)
  const [libro, setLibro] = useState(null)
  const [capId, setCapId] = useState(null)
  const [sonando, setSonando] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(0)
  const pantalla = useCapa()
  const [velocidad, ponerVelocidad] = usarPreferencia('audiolibro_velocidad', 1)
  // null | { fin: timestamp } | { capitulo: true }
  const [temporizador, setTemporizador] = useState(null)
  const temporizadorRef = useRef(null)
  temporizadorRef.current = temporizador
  const irA = useRef(null)          // segundo al que saltar en cuanto cargue
  const velocidadRef = useRef(1)
  const guardadoEn = useRef(0)
  const actual = useRef({ libro: null, capId: null })
  actual.current = { libro, capId }

  const cap = libro?.chapters.find(c => c.id === capId) || null

  const guardar = useCallback((forzar = false) => {
    const { libro: l, capId: c } = actual.current
    const a = audio.current
    if (!l || !c || !a || !Number.isFinite(a.currentTime)) return
    const ahora = Date.now()
    if (!forzar && ahora - guardadoEn.current < CADA_CUANTO_GUARDAR) return
    guardadoEn.current = ahora
    api(`/listen/${l.id}/progress`, { method: 'PUT', body: { chapter_id: c, position_s: a.currentTime } })
      .catch(() => {})
  }, [])

  // Carga un capítulo y, si se pide, lo arranca. Se llama DENTRO del toque
  // del usuario: iOS solo deja empezar a sonar si el play() va en el mismo
  // gesto, así que aquí no se espera a nada antes de llamarlo.
  const cargar = useCallback((l, c, posicion = 0, reproducir = true) => {
    const a = audio.current
    if (!a || !c?.ready) return
    const url = `/api/listen/${l.id}/chapters/${c.id}/audio?v=${encodeURIComponent(c.generated_at || '')}`
    if (actual.current.libro?.id !== l.id || actual.current.capId !== c.id || !a.src) {
      a.src = url
      irA.current = posicion > 1 ? posicion : null
      setT(posicion)
      setDur(c.duration_s || 0)
      setCargando(true)
    }
    setLibro(l)
    setCapId(c.id)
    a.playbackRate = velocidadRef.current
    if (reproducir) a.play().catch(() => setCargando(false))
  }, [])

  // Abre un audiolibro (datos de /listen) donde se dejó, o por el primer
  // capítulo que se pueda escuchar.
  const abrir = useCallback((l, { reproducir = true } = {}) => {
    const mismo = actual.current.libro?.id === l.id && actual.current.capId
    if (mismo) {
      setLibro(l)
      if (reproducir && audio.current?.paused) audio.current.play().catch(() => {})
    } else {
      const guardado = l.progress && l.chapters.find(c => c.id === l.progress.chapter_id && c.ready)
      const c = guardado || l.chapters.find(c => c.ready)
      if (c) cargar(l, c, guardado ? l.progress.position_s : 0, reproducir)
      else setLibro(l)
    }
    pantalla.abrir()
  }, [cargar, pantalla])

  const elegir = useCallback((c) => {
    if (!actual.current.libro || !c.ready) return
    guardar(true)
    cargar(actual.current.libro, c, 0, true)
  }, [cargar, guardar])

  const alternar = useCallback(() => {
    const a = audio.current
    if (!a?.src) return
    if (a.paused) a.play().catch(() => {})
    else a.pause()
  }, [])

  const saltar = useCallback((s) => {
    const a = audio.current
    if (!a?.src) return
    a.currentTime = Math.min(Math.max(0, a.currentTime + s), a.duration || Infinity)
  }, [])

  const buscar = useCallback((segundo) => {
    const a = audio.current
    if (a?.src) a.currentTime = segundo
  }, [])

  const cambiarVelocidad = useCallback((v) => {
    if (audio.current) audio.current.playbackRate = v
    ponerVelocidad(v)
  }, [ponerVelocidad])

  // Para dormir: a los N minutos, o al acabar el capítulo. Se pone en pausa,
  // no se quita: al despertar se sigue con un toque.
  const dormir = useCallback((minutos) => {
    if (minutos === 'capitulo') setTemporizador({ capitulo: true })
    else if (minutos) setTemporizador({ fin: Date.now() + minutos * 60000 })
    else setTemporizador(null)
  }, [])

  // Quitar el reproductor: para, guarda dónde iba y desaparece el de abajo.
  const cerrar = useCallback(() => {
    const a = audio.current
    guardar(true)
    if (a) { a.pause(); a.removeAttribute('src'); a.load() }
    setLibro(null); setCapId(null); setSonando(false); setCargando(false)
    setT(0); setDur(0); setTemporizador(null)
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = null
  }, [guardar])

  // Al acabar un capítulo, el siguiente que esté listo.
  const siguiente = useCallback(() => {
    const { libro: l, capId: c } = actual.current
    if (!l) return
    const i = l.chapters.findIndex(x => x.id === c)
    const sig = l.chapters.slice(i + 1).find(x => x.ready)
    guardar(true)
    if (sig) cargar(l, sig, 0, true)
  }, [cargar, guardar])

  const anterior = useCallback(() => {
    const { libro: l, capId: c } = actual.current
    if (!l) return
    // Como en cualquier reproductor: si ya ha avanzado, vuelve al principio
    // del capítulo; si está al principio, al capítulo de antes.
    if ((audio.current?.currentTime || 0) > 5) { buscar(0); return }
    const i = l.chapters.findIndex(x => x.id === c)
    const ant = [...l.chapters.slice(0, i)].reverse().find(x => x.ready)
    guardar(true)
    if (ant) cargar(l, ant, 0, true)
  }, [buscar, cargar, guardar])

  // Puesta al día de los capítulos (se van generando mientras se escucha)
  // sin tocar lo que suena.
  const refrescar = useCallback(async () => {
    const l = actual.current.libro
    if (!l) return
    try { setLibro(await api(`/listen/${l.id}`)) } catch { /* sigue con lo que había */ }
  }, [])

  // La velocidad guardada con la cuenta llega del servidor después de montar:
  // se aplica en cuanto está.
  useEffect(() => {
    velocidadRef.current = velocidad
    if (audio.current) audio.current.playbackRate = velocidad
  }, [velocidad])

  // Al irse a segundo plano o cerrar, se guarda dónde iba.
  useEffect(() => {
    const alOcultar = () => { if (document.visibilityState === 'hidden') guardar(true) }
    document.addEventListener('visibilitychange', alOcultar)
    window.addEventListener('pagehide', alOcultar)
    return () => {
      document.removeEventListener('visibilitychange', alOcultar)
      window.removeEventListener('pagehide', alOcultar)
    }
  }, [guardar])

  // Pantalla de bloqueo y centro de control.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !libro || !cap) return
    const portada = libro.cover_url
      ? [{ src: new URL(libro.cover_url, location.origin).href, sizes: '600x900', type: 'image/jpeg' }]
      : [{ src: `${import.meta.env.BASE_URL}icons/icon-512.png`, sizes: '512x512', type: 'image/png' }]
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: cap.title, artist: libro.author || '', album: libro.title, artwork: portada,
    })
  }, [libro, cap])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const acciones = {
      play: () => audio.current?.play(),
      pause: () => audio.current?.pause(),
      seekbackward: () => saltar(-30),
      seekforward: () => saltar(30),
      seekto: (d) => buscar(d.seekTime),
      previoustrack: anterior,
      nexttrack: siguiente,
    }
    for (const [k, f] of Object.entries(acciones)) {
      try { navigator.mediaSession.setActionHandler(k, f) } catch { /* no en este navegador */ }
    }
  }, [anterior, buscar, saltar, siguiente])

  const eventos = {
    onPlay: () => { setSonando(true); setCargando(false) },
    onPlaying: () => setCargando(false),
    onPause: () => { setSonando(false); guardar(true) },
    onWaiting: () => setCargando(true),
    onEnded: () => {
      setSonando(false)
      // "Al acabar el capítulo": se queda aquí en vez de pasar al siguiente.
      if (temporizadorRef.current?.capitulo) { setTemporizador(null); guardar(true); return }
      siguiente()
    },
    // Cambiar de src devuelve la velocidad a 1: se vuelve a poner.
    onLoadStart: (e) => { e.currentTarget.playbackRate = velocidadRef.current },
    onLoadedMetadata: (e) => {
      const a = e.currentTarget
      if (Number.isFinite(a.duration)) setDur(a.duration)
      if (irA.current != null) { a.currentTime = irA.current; irA.current = null }
    },
    onTimeUpdate: (e) => {
      const a = e.currentTarget
      setT(a.currentTime)
      guardar()
      // El temporizador se mira aquí y no con un setTimeout: con la app en
      // segundo plano iOS congela los temporizadores, pero el audio sigue
      // avisando de su avance.
      const fin = temporizadorRef.current?.fin
      if (fin && Date.now() >= fin) { setTemporizador(null); a.pause() }
      if ('mediaSession' in navigator && Number.isFinite(a.duration)) {
        try {
          navigator.mediaSession.setPositionState({ duration: a.duration, position: a.currentTime, playbackRate: a.playbackRate })
        } catch { /* iOS antiguo */ }
      }
    },
    onError: () => { setCargando(false); setSonando(false) },
  }

  const valor = useMemo(() => ({
    libro, cap, sonando, cargando, t, dur, pantalla, velocidad, temporizador,
    abrir, elegir, alternar, saltar, buscar, siguiente, anterior, refrescar,
    cambiarVelocidad, dormir, cerrar,
  }), [libro, cap, sonando, cargando, t, dur, pantalla, velocidad, temporizador, abrir, elegir, alternar,
    saltar, buscar, siguiente, anterior, refrescar, cambiarVelocidad, dormir, cerrar])

  return (
    <Ctx.Provider value={valor}>
      {/* playsInline: sin él iOS intenta abrirlo en su propio reproductor. */}
      <audio ref={audio} preload="metadata" playsInline {...eventos} />
      {children}
    </Ctx.Provider>
  )
}

// Fuera de /kokito no hay proveedor: devuelve null y quien lo use no enseña nada.
export function useReproductor() {
  return useContext(Ctx)
}
