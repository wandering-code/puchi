import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import { enviarPorWS } from './live'

// El motor de las llamadas. **Portado de GatOS.jsx de la Puchi actual**, y a
// propósito: son ~400 líneas ganadas a pulso contra llamadas reales —sonar en
// todos tus dispositivos, dejar de sonar cuando lo coges en uno, mover una
// llamada de un cacharro a otro, sobrevivir a un cambio de wifi a datos— y
// reinventarlas sería repetir todos esos errores. Lo que se rehace es la cara,
// no esto. Las dos Puchis hablan por la MISMA señalización, así que además
// tienen que entenderse entre ellas mientras convivan.
//
// Vive por encima de las pantallas (envuelve al Shell) por lo mismo que el
// chat: una llamada tiene que sonar estés donde estés, y seguir sonando
// aunque la pantalla de Diskordkito esté cerrada. Y por eso mismo puedes
// navegar por Puchi con la llamada en marcha: no es una pantalla, es una capa.
//
// Lo que NO hace: pintar. Aquí no hay ni un <div>. Quién enseña la llamada, la
// tarjeta de entrante o la pastilla, es cosa de las pantallas.

const LlamadasContext = createContext(null)

// Si el backend no tiene TURN configurado o falla el fetch, al menos STUN: las
// llamadas dentro de la misma red siguen funcionando.
const ICE_DE_RESERVA = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

const SENALES = new Set([
  'call_offer', 'call_answer', 'call_ice', 'call_reject', 'call_end', 'call_media',
  'call_handled_elsewhere', 'call_active_elsewhere', 'call_taken_over', 'call_move_here_ack',
])

// La llamada del club es un mesh: una conexión con CADA otro participante, no
// una sola. Quién está dentro lo lleva el backend en memoria y llega por
// group_call_state; aquí solo se reconcilian las conexiones locales contra esa
// lista, que es la que manda.
const SENALES_GRUPO = new Set([
  'group_call_state', 'group_call_ring', 'group_call_peers',
  'group_call_offer', 'group_call_answer', 'group_call_ice', 'group_call_media',
])

// Cuánto suena antes de darla por perdida.
const TIMBRE_MS = 30000
// 'disconnected' en WebRTC suele ser pasajero (un blip de red, pasar de wifi a
// datos) y se recupera solo. Solo 'failed' es definitivo. Colgar al primer
// 'disconnected' cortaba llamadas que se habrían arreglado solas.
const MARGEN_DESCONEXION_MS = 8000

export function LlamadasProvider({ children }) {
  const { player } = useAuth()
  const miId = player?.id

  // idle | llamando | entrante | activa
  const [estado, setEstado] = useState('idle')
  const [conQuien, setConQuien] = useState(null)
  const [tipo, setTipo] = useState('video')       // 'audio' | 'video'
  const [miVideo, setMiVideo] = useState(null)    // MediaStream propio
  const [suVideo, setSuVideo] = useState(null)    // MediaStream del otro
  const [mudo, setMudo] = useState(false)
  const [sinCamara, setSinCamara] = useState(false)
  // La cámara del otro apagada. WebRTC no lo señala solo (la pista sigue
  // llegando, solo que en negro), así que se avisa por la señalización.
  const [suCamaraApagada, setSuCamaraApagada] = useState(false)
  // Una llamada mía activa en OTRO de mis dispositivos, para poder traérmela.
  const [enOtroSitio, setEnOtroSitio] = useState(null)
  // Se ha salido del escenario a mirar otra cosa: la llamada sigue, encogida.
  const [encogida, setEncogida] = useState(false)

  // ── La llamada del club ───────────────────────────────────────────────────
  const [grupoActiva, setGrupoActiva] = useState(false)
  const [grupoIds, setGrupoIds] = useState([])
  const [grupoTipo, setGrupoTipo] = useState('video')
  const [dentro, setDentro] = useState(false)
  const [miVideoGrupo, setMiVideoGrupo] = useState(null)
  const [streamsGrupo, setStreamsGrupo] = useState({})        // { [id]: MediaStream }
  const [camarasApagadas, setCamarasApagadas] = useState({})  // { [id]: bool }
  const [mudoGrupo, setMudoGrupo] = useState(false)
  const [sinCamaraGrupo, setSinCamaraGrupo] = useState(false)
  const [entranteGrupo, setEntranteGrupo] = useState(null)
  // Quién está hablando: se mide el nivel de audio de cada uno. Sirve para
  // poner a esa persona en primer plano sola, sin tener que ir tocando.
  const [quienHabla, setQuienHabla] = useState(null)

  const miStreamGrupo = useRef(null)
  const pcsGrupo = useRef({})                 // { [id]: RTCPeerConnection }
  const pendientesGrupo = useRef({})          // { [id]: candidate[] }
  const dentroRef = useRef(false)
  const timbreGrupo = useRef(null)
  const margenesGrupo = useRef({})
  const audioCtx = useRef(null)
  const analizadores = useRef({})

  const pc = useRef(null)
  const miStream = useRef(null)
  const candidatosPendientes = useRef([])
  const ofertaSdp = useRef(null)
  const quienRef = useRef(null)
  // El dispositivo CONCRETO del otro. Se aprende del primer mensaje suyo
  // (from_device) y a partir de ahí se manda en cada respuesta para que el
  // backend deje de sonar en el resto de sus cacharros y enrute solo a ese.
  const suDispositivo = useRef(null)
  const tipoRef = useRef('video')
  const estadoRef = useRef('idle')
  useEffect(() => { estadoRef.current = estado }, [estado])
  const timbre = useRef(null)
  const margenDesconexion = useRef(null)
  const iceRef = useRef(ICE_DE_RESERVA)
  // Cola en serie para la señalización: si dos mensajes llegan casi a la vez
  // (un call_answer y el call_ice que le sigue), sus manejadores async se
  // solaparían — un addIceCandidate podría correr mientras el
  // setRemoteDescription anterior todavía no ha terminado. Encolando cada uno
  // tras la promesa del anterior, cada mensaje se procesa entero antes de
  // empezar el siguiente, llegue en el orden que llegue.
  const cola = useRef(Promise.resolve())
  // Si llega una llamada mientras ya hay otra en marcha, la anterior se guarda
  // aquí: solo se cuelga si la nueva se acepta DE VERDAD. Si se rechaza o se
  // agota el timbre, la de antes queda intacta y se restaura.
  const colgarSiAcepto = useRef(null)

  // ── Trastos ───────────────────────────────────────────────────────────────
  const pedirIce = useCallback(async () => {
    const servidores = await api('/turn-credentials').catch(() => null)
    if (Array.isArray(servidores) && servidores.length) iceRef.current = servidores
  }, [])

  const pedirMedios = useCallback(async (conVideo) => {
    let s
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: true, video: conVideo })
    } catch (err) {
      console.warn('getUserMedia con vídeo falló, se cae a solo audio:', err?.name, err?.message)
      if (!conVideo) throw new Error('No se pudo acceder al micrófono')
      s = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    }
    miStream.current = s
    setMiVideo(s)
    // Se pidió vídeo y no hay pista: que el icono de cámara apagada lo diga,
    // en vez de dejar un cuadro negro sin explicación.
    if (conVideo && s.getVideoTracks().length === 0) {
      console.warn('sin pista de vídeo pese a pedirla (cámara no disponible o denegada)')
      setSinCamara(true)
    }
    return s
  }, [])

  const limpiar = useCallback(() => {
    clearTimeout(timbre.current)
    clearTimeout(margenDesconexion.current)
    pc.current?.close()
    pc.current = null
    miStream.current?.getTracks().forEach(t => t.stop())
    miStream.current = null
    candidatosPendientes.current = []
    ofertaSdp.current = null
    suDispositivo.current = null
    quienRef.current = null
    setEstado('idle'); setConQuien(null)
    setMiVideo(null); setSuVideo(null)
    setMudo(false); setSinCamara(false); setSuCamaraApagada(false)
    setEncogida(false)
  }, [])

  const crearPC = useCallback((destinoId) => {
    const conexion = new RTCPeerConnection({ iceServers: iceRef.current })
    pc.current = conexion
    conexion.onicecandidate = ({ candidate }) => {
      if (candidate) {
        enviarPorWS({ type: 'call_ice', target_id: destinoId, candidate, target_device: suDispositivo.current || undefined })
      }
    }
    conexion.ontrack = ({ streams }) => { if (streams[0]) setSuVideo(streams[0]) }
    conexion.onconnectionstatechange = () => {
      const s = conexion.connectionState
      clearTimeout(margenDesconexion.current)
      if (s === 'failed' || s === 'closed') limpiar()
      else if (s === 'disconnected') {
        margenDesconexion.current = setTimeout(() => {
          if (pc.current === conexion && conexion.connectionState === 'disconnected') limpiar()
        }, MARGEN_DESCONEXION_MS)
      }
    }
    return conexion
  }, [limpiar])

  // ── Lo que se hace ────────────────────────────────────────────────────────
  const llamar = useCallback(async (aQuien, comoQue = 'video') => {
    if (estadoRef.current !== 'idle') return
    quienRef.current = aQuien
    tipoRef.current = comoQue
    setConQuien(aQuien); setTipo(comoQue); setEstado('llamando'); setEncogida(false)
    try {
      const [stream] = await Promise.all([pedirMedios(comoQue === 'video'), pedirIce()])
      const conexion = crearPC(aQuien.id)
      stream.getTracks().forEach(t => conexion.addTrack(t, stream))
      const oferta = await conexion.createOffer()
      await conexion.setLocalDescription(oferta)
      enviarPorWS({ type: 'call_offer', target_id: aQuien.id, sdp: conexion.localDescription.sdp, callType: comoQue })
    } catch (err) {
      console.error('llamar:', err)
      limpiar()
    }
  }, [pedirMedios, pedirIce, crearPC, limpiar])

  const rechazar = useCallback(() => {
    const quien = quienRef.current
    if (quien) {
      enviarPorWS({ type: 'call_reject', target_id: quien.id, target_device: suDispositivo.current || undefined })
    }
    const previa = colgarSiAcepto.current
    colgarSiAcepto.current = null
    if (previa?.tipo === '1a1') {
      // Había otra llamada en marcha de antes: su conexión y su micro nunca se
      // tocaron, así que se restaura tal cual estaba.
      quienRef.current = previa.quien
      suDispositivo.current = previa.dispositivo ?? null
      tipoRef.current = previa.como
      setConQuien(previa.quien); setTipo(previa.como); setEstado(previa.estado)
    } else {
      limpiar()
    }
  }, [limpiar])

  const aceptar = useCallback(async () => {
    const quien = quienRef.current
    const como = tipoRef.current
    const oferta = ofertaSdp.current
    if (!quien || !oferta) return
    clearTimeout(timbre.current)
    // Se acepta de verdad: si había otra llamada, AHORA se cuelga.
    const previa = colgarSiAcepto.current
    colgarSiAcepto.current = null
    if (previa?.tipo === '1a1') {
      if (previa.quien) {
        enviarPorWS({ type: 'call_end', target_id: previa.quien.id, target_device: previa.dispositivo || undefined })
      }
      pc.current?.close()
      miStream.current?.getTracks().forEach(t => t.stop())
    }
    setEstado('activa'); setEncogida(false)
    try {
      const [stream] = await Promise.all([pedirMedios(como === 'video'), pedirIce()])
      const conexion = crearPC(quien.id)
      stream.getTracks().forEach(t => conexion.addTrack(t, stream))
      await conexion.setRemoteDescription({ type: 'offer', sdp: oferta })
      // splice(0) vacía la lista en el mismo instante en que la lee. Con un
      // for..of y un "= []" al final, un candidato que llegara mientras se
      // espera a uno anterior se perdería para siempre al pisarlo el reset.
      // Fallo real de la Puchi actual: llamadas que a veces conectaban y a
      // veces no.
      for (const c of candidatosPendientes.current.splice(0)) await conexion.addIceCandidate(c)
      const respuesta = await conexion.createAnswer()
      await conexion.setLocalDescription(respuesta)
      enviarPorWS({
        type: 'call_answer', target_id: quien.id, sdp: conexion.localDescription.sdp,
        target_device: suDispositivo.current || undefined, callType: como,
      })
    } catch (err) {
      console.error('aceptar:', err)
      limpiar()
    }
  }, [pedirMedios, pedirIce, crearPC, limpiar])

  const colgar = useCallback(() => {
    const quien = quienRef.current
    if (quien) {
      enviarPorWS({ type: 'call_end', target_id: quien.id, target_device: suDispositivo.current || undefined })
    }
    limpiar()
  }, [limpiar])

  const alternarMudo = useCallback(() => {
    const pista = miStream.current?.getAudioTracks()[0]
    if (!pista) return
    pista.enabled = !pista.enabled
    setMudo(!pista.enabled)
  }, [])

  const alternarCamara = useCallback(() => {
    const pista = miStream.current?.getVideoTracks()[0]
    if (!pista) return
    pista.enabled = !pista.enabled
    setSinCamara(!pista.enabled)
    const quien = quienRef.current
    if (quien) {
      enviarPorWS({ type: 'call_media', target_id: quien.id, video: pista.enabled, target_device: suDispositivo.current || undefined })
    }
  }, [])

  // Traerse aquí la llamada que se tiene en otro dispositivo. No es un
  // traspaso de WebRTC (eso no existe): el dispositivo viejo cuelga sin avisar
  // al interlocutor y este manda una oferta nueva marcada "resume", que del
  // otro lado se acepta sola sin sonar como llamada entrante.
  const traerAqui = useCallback(() => {
    enviarPorWS({ type: 'call_move_here' })
  }, [])

  const ofertaDeMudanza = useCallback(async (quien, dispositivo, como) => {
    quienRef.current = quien
    suDispositivo.current = dispositivo || null
    tipoRef.current = como
    setConQuien(quien); setTipo(como); setEstado('activa'); setEnOtroSitio(null); setEncogida(false)
    try {
      const [stream] = await Promise.all([pedirMedios(como === 'video'), pedirIce()])
      const conexion = crearPC(quien.id)
      stream.getTracks().forEach(t => conexion.addTrack(t, stream))
      const oferta = await conexion.createOffer()
      await conexion.setLocalDescription(oferta)
      enviarPorWS({
        type: 'call_offer', target_id: quien.id, target_device: dispositivo || undefined,
        sdp: conexion.localDescription.sdp, callType: como, resume: true,
      })
    } catch (err) {
      console.error('ofertaDeMudanza:', err)
      limpiar()
    }
  }, [pedirMedios, pedirIce, crearPC, limpiar])

  // ── La llamada del club: entrar, salir y el mesh ──────────────────────────
  const cerrarDelGrupo = useCallback((peerId) => {
    clearTimeout(margenesGrupo.current[peerId])
    delete margenesGrupo.current[peerId]
    const conexion = pcsGrupo.current[peerId]
    if (conexion) { conexion.close(); delete pcsGrupo.current[peerId] }
    delete pendientesGrupo.current[peerId]
    setStreamsGrupo(prev => {
      if (!(peerId in prev)) return prev
      const siguiente = { ...prev }; delete siguiente[peerId]; return siguiente
    })
    setCamarasApagadas(prev => {
      if (!(peerId in prev)) return prev
      const siguiente = { ...prev }; delete siguiente[peerId]; return siguiente
    })
  }, [])

  const crearPCGrupo = useCallback((peerId) => {
    const conexion = new RTCPeerConnection({ iceServers: iceRef.current })
    pcsGrupo.current[peerId] = conexion
    conexion.onicecandidate = ({ candidate }) => {
      if (candidate) enviarPorWS({ type: 'group_call_ice', target_id: peerId, candidate })
    }
    conexion.ontrack = ({ streams }) => {
      if (streams[0]) setStreamsGrupo(prev => ({ ...prev, [peerId]: streams[0] }))
    }
    conexion.onconnectionstatechange = () => {
      const e = conexion.connectionState
      clearTimeout(margenesGrupo.current[peerId])
      if (e === 'failed' || e === 'closed') cerrarDelGrupo(peerId)
      else if (e === 'disconnected') {
        margenesGrupo.current[peerId] = setTimeout(() => {
          if (pcsGrupo.current[peerId] === conexion && conexion.connectionState === 'disconnected') cerrarDelGrupo(peerId)
        }, MARGEN_DESCONEXION_MS)
      }
    }
    const stream = miStreamGrupo.current
    if (stream) stream.getTracks().forEach(t => conexion.addTrack(t, stream))
    return conexion
  }, [cerrarDelGrupo])

  const salirDelGrupo = useCallback(() => {
    enviarPorWS({ type: 'group_call_leave' })
    Object.keys(pcsGrupo.current).forEach(id => cerrarDelGrupo(Number(id)))
    miStreamGrupo.current?.getTracks().forEach(t => t.stop())
    miStreamGrupo.current = null
    dentroRef.current = false
    setDentro(false); setMiVideoGrupo(null); setStreamsGrupo({}); setCamarasApagadas({})
    setMudoGrupo(false); setSinCamaraGrupo(false); setQuienHabla(null)
    audioCtx.current?.close().catch(() => {})
    audioCtx.current = null
    analizadores.current = {}
  }, [cerrarDelGrupo])

  const entrarAlGrupo = useCallback(async (como = 'video') => {
    if (dentroRef.current) return
    // Si había una llamada de uno a uno, se cuelga al entrar de verdad aquí.
    if (estadoRef.current !== 'idle') {
      const quien = quienRef.current
      if (quien) {
        enviarPorWS({
          type: estadoRef.current === 'entrante' ? 'call_reject' : 'call_end',
          target_id: quien.id, target_device: suDispositivo.current || undefined,
        })
      }
      limpiar()
    }
    clearTimeout(timbreGrupo.current)
    setEntranteGrupo(null)
    try {
      let s
      try {
        s = await navigator.mediaDevices.getUserMedia({ audio: true, video: como === 'video' })
      } catch {
        s = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      }
      miStreamGrupo.current = s
      setMiVideoGrupo(s)
      if (como === 'video' && s.getVideoTracks().length === 0) setSinCamaraGrupo(true)
      await pedirIce()
      dentroRef.current = true
      setDentro(true); setGrupoTipo(como); setEncogida(false)
      enviarPorWS({ type: 'group_call_join', callType: como })
    } catch (err) {
      console.error('entrarAlGrupo:', err)
      salirDelGrupo()
    }
  }, [pedirIce, limpiar, salirDelGrupo])

  const alternarMudoGrupo = useCallback(() => {
    const pista = miStreamGrupo.current?.getAudioTracks()[0]
    if (!pista) return
    pista.enabled = !pista.enabled
    setMudoGrupo(!pista.enabled)
  }, [])

  const alternarCamaraGrupo = useCallback(() => {
    const pista = miStreamGrupo.current?.getVideoTracks()[0]
    if (!pista) return
    pista.enabled = !pista.enabled
    setSinCamaraGrupo(!pista.enabled)
    enviarPorWS({ type: 'group_call_media', video: pista.enabled })
  }, [])

  const atenderGrupo = useCallback(async (msg) => {
    switch (msg.type) {
      case 'group_call_state': {
        setGrupoActiva(msg.active)
        setGrupoTipo(msg.callType ?? 'video')
        const ids = msg.participantIds ?? []
        setGrupoIds(ids)
        if (dentroRef.current && !ids.includes(miId)) { dentroRef.current = false; setDentro(false) }
        // Cerrar el mesh con quien ya no está en la lista que manda el servidor.
        Object.keys(pcsGrupo.current).forEach(id => {
          if (!ids.includes(Number(id))) cerrarDelGrupo(Number(id))
        })
        break
      }
      case 'group_call_ring':
        if (dentroRef.current) break
        setEntranteGrupo({ quien: msg.from_player, tipo: msg.callType ?? 'video' })
        clearTimeout(timbreGrupo.current)
        timbreGrupo.current = setTimeout(() => setEntranteGrupo(null), TIMBRE_MS)
        break
      case 'group_call_peers':
        setGrupoTipo(msg.callType ?? 'video')
        for (const peerId of (msg.peerIds ?? [])) {
          try {
            const conexion = crearPCGrupo(peerId)
            const oferta = await conexion.createOffer()
            await conexion.setLocalDescription(oferta)
            enviarPorWS({ type: 'group_call_offer', target_id: peerId, sdp: conexion.localDescription.sdp })
          } catch (err) { console.error('oferta al entrar al grupo:', err) }
        }
        break
      case 'group_call_offer': {
        const deId = msg.from_player.id
        // Dos que entran casi a la vez pueden ofrecerse el uno al otro: se
        // tira la conexión vieja y se rehace, en vez de quedarse a medias.
        if (pcsGrupo.current[deId]) cerrarDelGrupo(deId)
        const conexion = crearPCGrupo(deId)
        await conexion.setRemoteDescription({ type: 'offer', sdp: msg.sdp })
        for (const c of (pendientesGrupo.current[deId] ?? []).splice(0)) await conexion.addIceCandidate(c)
        const respuesta = await conexion.createAnswer()
        await conexion.setLocalDescription(respuesta)
        enviarPorWS({ type: 'group_call_answer', target_id: deId, sdp: conexion.localDescription.sdp })
        break
      }
      case 'group_call_answer': {
        const conexion = pcsGrupo.current[msg.from_player.id]
        if (conexion) await conexion.setRemoteDescription({ type: 'answer', sdp: msg.sdp })
        break
      }
      case 'group_call_ice': {
        const deId = msg.from_player.id
        const conexion = pcsGrupo.current[deId]
        if (conexion?.remoteDescription) await conexion.addIceCandidate(msg.candidate)
        else pendientesGrupo.current[deId] = [...(pendientesGrupo.current[deId] ?? []), msg.candidate]
        break
      }
      case 'group_call_media':
        setCamarasApagadas(prev => ({ ...prev, [msg.from_player.id]: msg.video === false }))
        break
    }
  }, [miId, crearPCGrupo, cerrarDelGrupo])

  // Quién habla. Un analizador por stream, y cada 200ms se mira quién suena
  // más fuerte. Con un umbral y un margen entre cambios: sin ellos, una tos o
  // un ruido de fondo cambiarían el primer plano a cada rato.
  useEffect(() => {
    const ids = Object.keys(streamsGrupo)
    for (const id of ids) {
      if (analizadores.current[id]) continue
      const stream = streamsGrupo[id]
      if (!stream.getAudioTracks().length) continue
      try {
        audioCtx.current ||= new (window.AudioContext || window.webkitAudioContext)()
        const fuente = audioCtx.current.createMediaStreamSource(stream)
        const analizador = audioCtx.current.createAnalyser()
        analizador.fftSize = 512
        fuente.connect(analizador)
        analizadores.current[id] = { analizador, datos: new Uint8Array(analizador.fftSize), fuente }
      } catch (err) { console.warn('analizador de audio para', id, err) }
    }
    for (const id of Object.keys(analizadores.current)) {
      if (!ids.includes(id)) {
        try { analizadores.current[id].fuente.disconnect() } catch { /* ya desconectado */ }
        delete analizadores.current[id]
      }
    }
  }, [streamsGrupo])

  useEffect(() => {
    if (!dentro) return
    const MARGEN = 1200, UMBRAL = 16
    let ultimoCambio = 0, actual = null
    const id = setInterval(() => {
      let masAlto = null, nivelMax = 0
      for (const [pid, e] of Object.entries(analizadores.current)) {
        e.analizador.getByteTimeDomainData(e.datos)
        let suma = 0
        for (let i = 0; i < e.datos.length; i++) { const v = e.datos[i] - 128; suma += v * v }
        const rms = Math.sqrt(suma / e.datos.length)
        if (rms > nivelMax) { nivelMax = rms; masAlto = Number(pid) }
      }
      const ahora = Date.now()
      if (masAlto !== null && nivelMax > UMBRAL && masAlto !== actual && ahora - ultimoCambio > MARGEN) {
        actual = masAlto; ultimoCambio = ahora
        setQuienHabla(masAlto)
      }
    }, 200)
    return () => clearInterval(id)
  }, [dentro])

  // Si quien estaba en primer plano se va, no dejarlo congelado.
  useEffect(() => {
    if (quienHabla != null && !(quienHabla in streamsGrupo)) setQuienHabla(null)
  }, [streamsGrupo, quienHabla])

  // ── Lo que llega ──────────────────────────────────────────────────────────
  const atender = useCallback(async (msg) => {
    switch (msg.type) {
      case 'call_offer': {
        // "Resume": el interlocutor con el que YA estoy hablando acaba de mover
        // la llamada a otro de sus dispositivos. No es una llamada nueva: no
        // debe sonar ni pedir aceptar. Se cierra la conexión vieja y se acepta
        // esta en silencio, reaprovechando el micro y la cámara ya encendidos.
        if (msg.resume && estadoRef.current === 'activa' && quienRef.current?.id === msg.from_player?.id) {
          pc.current?.close()
          suDispositivo.current = msg.from_device ?? null
          try {
            const stream = miStream.current ?? await pedirMedios(tipoRef.current === 'video')
            const conexion = crearPC(msg.from_player.id)
            stream.getTracks().forEach(t => conexion.addTrack(t, stream))
            await conexion.setRemoteDescription({ type: 'offer', sdp: msg.sdp })
            for (const c of candidatosPendientes.current.splice(0)) await conexion.addIceCandidate(c)
            const respuesta = await conexion.createAnswer()
            await conexion.setLocalDescription(respuesta)
            enviarPorWS({
              type: 'call_answer', target_id: msg.from_player.id, sdp: conexion.localDescription.sdp,
              target_device: suDispositivo.current || undefined, callType: tipoRef.current,
            })
          } catch (err) {
            console.error('call_offer resume:', err)
            limpiar()
          }
          break
        }

        // ¿Había ya otra llamada? Se guarda para colgarla solo si esta se
        // acepta de verdad.
        const ocupado = estadoRef.current
        colgarSiAcepto.current = (ocupado === 'activa' || ocupado === 'llamando') && quienRef.current
          ? { tipo: '1a1', quien: quienRef.current, dispositivo: suDispositivo.current, como: tipoRef.current, estado: ocupado }
          : null

        ofertaSdp.current = msg.sdp
        quienRef.current = msg.from_player
        suDispositivo.current = msg.from_device ?? null
        tipoRef.current = msg.callType ?? 'video'
        setConQuien(msg.from_player)
        setTipo(msg.callType ?? 'video')
        setEstado('entrante')
        clearTimeout(timbre.current)
        timbre.current = setTimeout(() => rechazar(), TIMBRE_MS)
        break
      }

      case 'call_answer':
        if (pc.current) {
          // Quien llama no sabía qué dispositivo del otro iba a contestar (el
          // aviso sonó en todos). A partir de aquí ya se sabe, y lo que venga
          // después va dirigido solo a ese.
          suDispositivo.current = msg.from_device ?? null
          await pc.current.setRemoteDescription({ type: 'answer', sdp: msg.sdp })
          setEstado('activa')
        }
        break

      case 'call_ice':
        if (pc.current?.remoteDescription) await pc.current.addIceCandidate(msg.candidate)
        else candidatosPendientes.current.push(msg.candidate)
        break

      case 'call_media':
        setSuCamaraApagada(msg.video === false)
        break

      case 'call_reject':
      case 'call_end':
        limpiar()
        break

      case 'call_handled_elsewhere':
        // Se ha cogido (o rechazado) desde otro de mis dispositivos: dejar de
        // sonar aquí, en silencio. Si este ya la había contestado él mismo, no
        // tocar nada — sería el eco de haber contestado aquí.
        if (estadoRef.current === 'entrante') limpiar()
        break

      case 'call_active_elsewhere':
        setEnOtroSitio(msg.active ? { quien: msg.peer, tipo: msg.callType } : null)
        break

      case 'call_taken_over':
        // Mi llamada se ha ido a otro de mis dispositivos: colgar aquí en
        // silencio, sin avisar al interlocutor — la llamada sigue, por allí.
        limpiar()
        break

      case 'call_move_here_ack':
        ofertaDeMudanza(msg.peer, msg.peerDevice, msg.callType)
        break
    }
  }, [pedirMedios, crearPC, limpiar, rechazar, ofertaDeMudanza])

  useEffect(() => {
    if (!miId) return
    function alRecibir(ev) {
      const msg = ev.detail
      if (!msg) return
      const quienAtiende = SENALES.has(msg.type) ? atender : (SENALES_GRUPO.has(msg.type) ? atenderGrupo : null)
      if (!quienAtiende) return
      // En serie: ver el comentario de `cola`.
      cola.current = cola.current.then(() => quienAtiende(msg)).catch(err => console.error('señal de llamada:', err))
    }
    window.addEventListener('puchi:ws', alRecibir)
    return () => window.removeEventListener('puchi:ws', alRecibir)
  }, [miId, atender, atenderGrupo])

  // Al cerrar la pestaña con una llamada en marcha, avisar al otro en vez de
  // dejarle mirando una pantalla congelada hasta que salte el timeout.
  useEffect(() => {
    function alIrse() {
      if (estadoRef.current === 'activa' && quienRef.current) {
        enviarPorWS({ type: 'call_end', target_id: quienRef.current.id, target_device: suDispositivo.current || undefined })
      }
    }
    window.addEventListener('pagehide', alIrse)
    return () => window.removeEventListener('pagehide', alIrse)
  }, [])

  const valor = useMemo(() => ({
    estado, conQuien, tipo, miVideo, suVideo,
    mudo, sinCamara, suCamaraApagada, enOtroSitio, encogida,
    // Una sola llamada a la vez: o la de uno a uno, o la del club.
    hayLlamada: estado !== 'idle' || dentro,
    llamar, aceptar, rechazar, colgar, alternarMudo, alternarCamara, traerAqui,
    encoger: () => setEncogida(true),
    agrandar: () => setEncogida(false),

    grupo: {
      activa: grupoActiva, ids: grupoIds, tipo: grupoTipo, dentro,
      miVideo: miVideoGrupo, streams: streamsGrupo, camarasApagadas,
      mudo: mudoGrupo, sinCamara: sinCamaraGrupo,
      entrante: entranteGrupo, quienHabla,
      entrar: entrarAlGrupo, salir: salirDelGrupo,
      alternarMudo: alternarMudoGrupo, alternarCamara: alternarCamaraGrupo,
      descartarEntrante: () => setEntranteGrupo(null),
    },
  }), [
    estado, conQuien, tipo, miVideo, suVideo, mudo, sinCamara, suCamaraApagada,
    enOtroSitio, encogida, llamar, aceptar, rechazar, colgar, alternarMudo,
    alternarCamara, traerAqui,
    grupoActiva, grupoIds, grupoTipo, dentro, miVideoGrupo, streamsGrupo,
    camarasApagadas, mudoGrupo, sinCamaraGrupo, entranteGrupo, quienHabla,
    entrarAlGrupo, salirDelGrupo, alternarMudoGrupo, alternarCamaraGrupo,
  ])

  return <LlamadasContext.Provider value={valor}>{children}</LlamadasContext.Provider>
}

export function useLlamadas() {
  return useContext(LlamadasContext)
}
