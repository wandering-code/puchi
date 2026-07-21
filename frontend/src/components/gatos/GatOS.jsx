import { useState, useCallback, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Window        from './Window'
import MenuBar, { MENU_BAR_H } from './MenuBar'
import Dock, { DOCK_RESERVED } from './Dock'
import MobileLauncher, { MOBILE_TAB_APPS, visibleTabApps, launcherApps } from './MobileLauncher'
import { useIsMobile } from '../../utils/responsive'
import { wallpaperCss } from '../../utils/wallpaper'
// Renombrado en el import: "Notification" a secas taparía la API nativa
// del navegador (window.Notification) en todo este módulo.
import MessageNotification from './Notification'
import CallNotification     from './CallNotification'
import GroupCallNotification from './GroupCallNotification'
import Diskordkito   from './apps/Diskordkito'
import Luniteca      from './apps/Luniteca'
import LunitecaV2    from './apps/LunitecaV2'
import SettingsApp   from './apps/SettingsApp'
import Pirestore     from './apps/Pirestore'
import AdminPanel    from './apps/AdminPanel'
import { APPS }          from './apps/config'

// Se ve un instante antes de que responda /shop/items la primera vez.
const FALLBACK_WALLPAPER_BG = 'radial-gradient(ellipse at 30% 20%, #1a1040 0%, #0a0a14 60%)'

let _nextId = 1

// ── WebRTC config ─────────────────────────────────────────────────────────────
// Vive aquí (no en Diskordkito) para que la señalización de llamadas funcione
// aunque la app de chat esté cerrada — igual que ya pasa con los mensajes.
// Fallback si el TURN no responde (falla el fetch, o no está configurado en
// el backend): solo STUN, válido entre dispositivos en la misma red pero no
// a través de NAT simétrico (frecuente en redes móviles).
const FALLBACK_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]
const CALL_SIGNAL_TYPES = new Set(['call_offer', 'call_answer', 'call_ice', 'call_reject', 'call_end', 'call_media'])
const CALL_RING_TIMEOUT = 30000

// Señalización de la llamada grupal de #club-general — sistema independiente
// del 1-to-1 de arriba (mesh: N RTCPeerConnection en vez de una sola).
const GROUP_CALL_SIGNAL_TYPES = new Set([
  'group_call_state', 'group_call_ring', 'group_call_peers',
  'group_call_offer', 'group_call_answer', 'group_call_ice', 'group_call_media',
])

export default function GatOS({ player: initialPlayer, onLogout, onProfileUpdate: _onProfileUpdate, onExitPC }) {
  const isMobile = useIsMobile()
  const [player,       setPlayer]       = useState(initialPlayer)
  const [windows,      setWindows]      = useState([])
  const [topZ,         setTopZ]         = useState(200)
  // Qué pestaña de móvil está activa — estado propio y directo, no derivado
  // de `windows` (buscar ahí "la única no minimizada" es ambiguo si por
  // cualquier motivo hay más de una marcada como no minimizada a la vez: el
  // panel que YA no está activo pasa a pointer-events:none, pero como sigue
  // ahí montado y con opacidad todavía visible durante la transición, o si
  // el cálculo se equivoca de cuál es "la" activa, los clics le atraviesan
  // sin más y le llegan al panel de debajo — se detectó así, arrastrando en
  // Diskordkito se seleccionaba contenido de Luniteca).
  const [mobileActiveTab, setMobileActiveTab] = useState(null)
  const [online,       setOnline]       = useState([])
  const [wallpapers,   setWallpapers]   = useState([]) // catálogo de Pirestore (tipo "wallpaper")
  const [notification, setNotification] = useState(null)
  const wsRef            = useRef(null)
  const windowsRef       = useRef(windows)
  const containerRef     = useRef(null)
  // Canal de Diskordkito que el jugador tiene abierto ahora mismo (o null si no
  // hay ninguno / la app está cerrada) — lo actualiza Diskordkito vía callback.
  const activeChannelRef = useRef(null)

  useEffect(() => { windowsRef.current = windows }, [windows])

  // ── Persistencia en localStorage ────────────────────────────────────────────
  const storageKey = `gatos_windows_${initialPlayer.id}`

  // Carga estado previo una sola vez al montar
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey))
      if (Array.isArray(saved) && saved.length > 0) {
        const loaded = saved.map(w => {
          const id = _nextId++
          const cfg = APPS[w.appId]
          return {
            ...w, id,
            // Conserva el zIndex guardado para restaurar el orden de planos exacto.
            // Defaults defensivos por si el save es de una versión anterior sin estos campos.
            zIndex:     w.zIndex     ?? 100 + id,
            size:       w.size       ?? { w: cfg?.width ?? 640, h: cfg?.height ?? 480 },
            maximized:  w.maximized  ?? false,
            preMaxPos:  w.preMaxPos  ?? null,
            preMaxSize: w.preMaxSize ?? null,
            minimized:  w.minimized  ?? false,
          }
        })
        const maxZ = Math.max(...loaded.map(w => w.zIndex), 200)
        setTopZ(maxZ + 1)
        setWindows(loaded)
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Guarda en localStorage cada vez que cambian las ventanas
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(windows))
    } catch {}
  }, [windows, storageKey])

  // Ref para openApp (necesario dentro del handler del WS sin crear dependencias)
  const openAppRef = useRef(null)

  // ── Pedir permiso de notificaciones nativas al entrar ───────────────────────
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Catálogo de fondos de pantalla (Pirestore) — se necesita aquí para pintar
  // el fondo ya elegido, aunque el selector viva en la app de la tienda.
  // Se vuelve a pedir cada vez que cambia el fondo equipado, no solo al
  // montar — si no, un fondo recién creado en Pirestore (que aún no estaba
  // en esta lista) nunca llegaría a pintarse tras equiparlo.
  useEffect(() => {
    fetch('/api/shop/items?type=wallpaper', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setWallpapers)
      .catch(() => setWallpapers([]))
  }, [player.customization?.wallpaper])

  // ── Llamadas (WebRTC) ────────────────────────────────────────────────────────
  // Vive a nivel de GatOS para que suene/aparezca la notificación aunque
  // Diskordkito esté cerrado o minimizado.
  const [callState,    setCallState]    = useState('idle') // idle | calling | incoming | active
  const [callPeer,     setCallPeer]     = useState(null)
  const [callType,     setCallType]     = useState('video') // 'audio' | 'video'
  const [localStream,  setLocalStream]  = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [isMuted,      setIsMuted]      = useState(false)
  const [isCameraOff,  setIsCameraOff]  = useState(false)
  // Cámara del interlocutor apagada — WebRTC no lo señala solo (el track
  // deshabilitado sigue llegando, solo que en negro), así que se avisa
  // explícitamente por el canal de señalización.
  const [remoteCameraOff, setRemoteCameraOff] = useState(false)
  // Se cierra el toast de llamada (sin colgar) al hacer clic para ir a la
  // conversación; se reinicia con cada llamada entrante nueva.
  const [callNotifDismissed, setCallNotifDismissed] = useState(false)
  // Panel de chat de texto dentro de la llamada activa — vive aquí (no en
  // Diskordkito) para poder desplegarlo desde el clic en la notificación de
  // un mensaje nuevo, incluso si Diskordkito ya está abierto.
  const [callChatOpen, setCallChatOpen] = useState(false)

  const pcRef             = useRef(null)
  const localStreamRef    = useRef(null)
  const pendingCandidates = useRef([])
  const offerSdpRef       = useRef(null)
  const callPeerRef       = useRef(null)
  const callTypeRef       = useRef('video')
  const ringTimeoutRef    = useRef(null)
  // Espejo de callState en un ref: el handler del WS (ws.onmessage) se fija
  // una sola vez al montar (useEffect con dep [player.token]) y no se
  // vuelve a crear, así que cualquier función que cuelgue de esa cadena de
  // closures (handleCallSignal y lo que llame) vería siempre el callState
  // de aquel primer render si lo leyera directamente — de ahí este ref,
  // igual que ya se hace con callPeerRef/callTypeRef para lo mismo.
  const callStateRef      = useRef('idle')
  useEffect(() => { callStateRef.current = callState }, [callState])
  // Credenciales TURN del backend (efímeras) — se piden de nuevo al empezar
  // cada llamada/unirse a la grupal; si el fetch falla o no hay TURN
  // configurado, se sigue intentando solo con STUN (llamadas en la misma red).
  const iceServersRef     = useRef(FALLBACK_ICE_SERVERS)
  // Cola de procesamiento en serie para los mensajes de señalización de
  // llamada: si dos mensajes WS (p. ej. call_answer y el primer call_ice que
  // le sigue) llegan casi a la vez, sin esto sus handlers async se podrían
  // solapar entre sí — un addIceCandidate podría ejecutarse mientras el
  // setRemoteDescription anterior aún no ha terminado de aplicarse. Encolar
  // cada mensaje tras la promesa del anterior garantiza que cada uno se
  // procesa entero (incluidos sus awaits internos) antes de empezar el
  // siguiente, venga en el orden que venga por la red.
  const signalQueueRef    = useRef(Promise.resolve())
  // 'disconnected' en WebRTC suele ser transitorio (blip de red, cambio de
  // wifi↔datos móviles) y se recupera solo en unos segundos — solo 'failed'
  // es un estado definitivo. Colgar al primer 'disconnected' cortaba
  // llamadas que se habrían recuperado solas.
  const disconnectTimeoutRef = useRef(null)
  // Si llega una oferta de llamada 1-to-1 mientras ya hay otra llamada en
  // marcha (1-to-1 activa/sonando, o grupal ya unida), aquí se guarda esa
  // llamada previa — se cuelga solo si el usuario acepta de verdad la
  // nueva (acceptCall); si en cambio la rechaza o se agota el timeout de
  // aviso, la anterior queda intacta y se restaura tal cual (rejectCall).
  const pendingHangupRef = useRef(null)

  function sendWs(data) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }

  async function refreshIceServers() {
    try {
      const r = await fetch('/api/turn-credentials', { credentials: 'include' })
      const servers = r.ok ? await r.json() : null
      if (Array.isArray(servers) && servers.length) iceServersRef.current = servers
    } catch {}
  }

  async function getMedia(withVideo) {
    const s = await getUserMediaWithFallback(withVideo)
    localStreamRef.current = s
    setLocalStream(s)
    // Si se pidió vídeo pero el stream resultante no trae pista de vídeo
    // (getUserMediaWithFallback cayó a solo-audio tras un error de cámara),
    // que el propio icono de "cámara apagada" lo refleje en vez de dejar un
    // <video> en negro sin explicación — y que quede constancia en consola
    // de qué pasó exactamente con la cámara, para poder diagnosticarlo desde
    // el inspector remoto de Safari en iOS.
    if (withVideo && s.getVideoTracks().length === 0) {
      console.warn('getMedia: sin pista de vídeo pese a haberla pedido (cámara no disponible o denegada)')
      setIsCameraOff(true)
    }
    return s
  }

  function createPC(targetId) {
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current })
    pcRef.current = pc
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) sendWs({ type: 'call_ice', target_id: targetId, candidate })
    }
    pc.ontrack = ({ streams }) => {
      if (streams[0]) setRemoteStream(streams[0])
    }
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState
      clearTimeout(disconnectTimeoutRef.current)
      if (s === 'failed' || s === 'closed') {
        cleanupCall()
      } else if (s === 'disconnected') {
        disconnectTimeoutRef.current = setTimeout(() => {
          if (pcRef.current === pc && pc.connectionState === 'disconnected') cleanupCall()
        }, 8000)
      }
    }
    return pc
  }

  function cleanupCall() {
    clearTimeout(ringTimeoutRef.current)
    clearTimeout(disconnectTimeoutRef.current)
    pcRef.current?.close()
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    localStreamRef.current = null
    pendingCandidates.current = []
    offerSdpRef.current = null
    setCallState('idle')
    setCallPeer(null)
    setLocalStream(null)
    setRemoteStream(null)
    setIsMuted(false)
    setIsCameraOff(false)
    setRemoteCameraOff(false)
    setCallChatOpen(false)
  }

  async function startCall(targetPlayer, type) {
    if (callState !== 'idle' || groupCallJoinedRef.current) return
    callPeerRef.current = targetPlayer
    callTypeRef.current = type
    setCallPeer(targetPlayer)
    setCallType(type)
    setCallState('calling')
    openAppRef.current?.('diskordkito')
    try {
      const [stream] = await Promise.all([getMedia(type === 'video'), refreshIceServers()])
      const pc = createPC(targetPlayer.id)
      stream.getTracks().forEach(t => pc.addTrack(t, stream))
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      sendWs({ type: 'call_offer', target_id: targetPlayer.id, sdp: pc.localDescription.sdp, callType: type })
    } catch (err) {
      console.error('startCall:', err)
      cleanupCall()
    }
  }

  async function acceptCall() {
    const peer = callPeerRef.current
    const type = callTypeRef.current
    const offerSdp = offerSdpRef.current
    if (!peer || !offerSdp) return
    clearTimeout(ringTimeoutRef.current)
    // Se acepta de verdad esta llamada nueva — si había otra en marcha, se
    // cuelga ahora (avisando al interlocutor si era 1-to-1).
    if (pendingHangupRef.current) {
      const prev = pendingHangupRef.current
      pendingHangupRef.current = null
      if (prev.type === '1to1') {
        if (prev.peer) sendWs({ type: 'call_end', target_id: prev.peer.id })
        cleanupCall()
      } else if (prev.type === 'group') {
        leaveGroupCall()
      }
    }
    setCallState('active')
    openAppRef.current?.('diskordkito')
    try {
      const [stream] = await Promise.all([getMedia(type === 'video'), refreshIceServers()])
      const pc = createPC(peer.id)
      stream.getTracks().forEach(t => pc.addTrack(t, stream))
      await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp })
      // splice(0) vacía el array en el mismo instante síncrono en que lo lee —
      // si se hiciera con un for..of y un "= []" al final, un candidato que
      // llegase de la señalización (mensaje WS aparte) mientras el for..of
      // todavía está en un await de uno anterior se perdería para siempre al
      // pisarlo el reset final, sin haberse aplicado nunca. Bug real
      // encontrado tras varias llamadas de prueba intermitentes (a veces
      // conectaba, a veces no) el 2026-07-21.
      for (const c of pendingCandidates.current.splice(0)) await pc.addIceCandidate(c)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      sendWs({ type: 'call_answer', target_id: peer.id, sdp: pc.localDescription.sdp })
    } catch (err) {
      console.error('acceptCall:', err)
      cleanupCall()
    }
  }

  // Llamada perdida (nunca llegó a estar 'active'): vibración si el navegador
  // la soporta (Android/Chrome — en iOS Safari no existe navigator.vibrate,
  // limitación de la plataforma, no hay forma de simularla) y notificación
  // nativa del sistema si la pestaña no tiene el foco (funciona en ambos).
  function notifyMissedCall(peer) {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200])
    if (!document.hasFocus() && Notification.permission === 'granted') {
      const n = new Notification(`Llamada perdida de ${peer?.name ?? 'alguien'}`, {
        body: 'Diskordkito',
        icon: '/favicon.ico',
        tag: 'diskordkito-call',
        silent: false,
      })
      n.onclick = () => {
        window.focus()
        openAppRef.current?.('diskordkito')
      }
    }
  }

  function rejectCall() {
    const peer = callPeerRef.current
    if (peer) sendWs({ type: 'call_reject', target_id: peer.id })
    notifyMissedCall(peer) // no contestamos a tiempo (o se rechazó a mano, pero entonces la app tenía foco y no se notifica igualmente)
    const prev = pendingHangupRef.current
    pendingHangupRef.current = null
    if (prev?.type === '1to1') {
      // Había otra llamada 1-to-1 en marcha de antes (su pc/stream nunca se
      // tocaron) — se restaura su estado visible tal cual estaba.
      callPeerRef.current = prev.peer
      callTypeRef.current = prev.callType
      setCallPeer(prev.peer)
      setCallType(prev.callType)
      setCallState(prev.callState)
    } else {
      cleanupCall()
    }
  }

  function endCall() {
    const peer = callPeerRef.current
    if (peer) sendWs({ type: 'call_end', target_id: peer.id })
    cleanupCall()
  }

  function toggleMute() {
    const track = localStreamRef.current?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setIsMuted(!track.enabled)
  }

  function toggleCamera() {
    const track = localStreamRef.current?.getVideoTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setIsCameraOff(!track.enabled)
    const peer = callPeerRef.current
    if (peer) sendWs({ type: 'call_media', target_id: peer.id, video: track.enabled })
  }

  async function getUserMediaWithFallback(withVideo) {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: withVideo })
    } catch (err) {
      console.warn('getUserMedia con vídeo falló, cayendo a solo-audio:', err?.name, err?.message)
      if (withVideo) return navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      throw new Error('No se pudo acceder al micrófono')
    }
  }

  // ── Llamada grupal (#club-general) ──────────────────────────────────────────
  // Mesh P2P: una RTCPeerConnection por cada otro participante, en vez de una
  // sola como en la llamada 1-to-1. El estado de "quién está dentro" vive en
  // el backend (en memoria) y llega vía group_call_state — este componente
  // solo reconcilia sus conexiones locales contra esa lista autorizada.
  const [groupCallActive,        setGroupCallActive]        = useState(false)
  const [groupCallParticipantIds, setGroupCallParticipantIds] = useState([])
  const [groupCallType,          setGroupCallType]          = useState('video')
  const [groupCallJoined,        setGroupCallJoined]        = useState(false)
  const [groupLocalStream,       setGroupLocalStream]       = useState(null)
  const [groupRemoteStreams,     setGroupRemoteStreams]     = useState({})   // { [playerId]: MediaStream }
  const [groupRemoteCameraOff,   setGroupRemoteCameraOff]   = useState({})   // { [playerId]: bool }
  const [groupIsMuted,           setGroupIsMuted]           = useState(false)
  const [groupIsCameraOff,       setGroupIsCameraOff]       = useState(false)
  const [groupCallChatOpen,      setGroupCallChatOpen]      = useState(false)
  // Aviso de llamada grupal entrante (toast) — puramente local: ignorarlo o
  // que expire a los 30s no afecta al estado del backend, solo deja de sonar
  // aquí; la llamada sigue existiendo y se puede entrar después.
  const [incomingGroupCall, setIncomingGroupCall] = useState(null) // { from_player, callType } | null

  const groupLocalStreamRef       = useRef(null)
  const groupPcsRef               = useRef({})   // { [playerId]: RTCPeerConnection }
  const groupPendingCandidatesRef = useRef({})   // { [playerId]: candidate[] }
  const groupCallJoinedRef        = useRef(false)
  const groupRingTimeoutRef       = useRef(null)
  // Margen antes de dar por perdido a un participante en 'disconnected' —
  // mismo motivo que disconnectTimeoutRef de la 1-to-1, pero uno por peerId.
  const groupDisconnectTimeoutsRef = useRef({})   // { [playerId]: timeoutId }

  async function getGroupMedia(withVideo) {
    const s = await getUserMediaWithFallback(withVideo)
    groupLocalStreamRef.current = s
    setGroupLocalStream(s)
    if (withVideo && s.getVideoTracks().length === 0) {
      console.warn('getGroupMedia: sin pista de vídeo pese a haberla pedido (cámara no disponible o denegada)')
      setGroupIsCameraOff(true)
    }
    return s
  }

  function createGroupPC(peerId) {
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current })
    groupPcsRef.current[peerId] = pc
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) sendWs({ type: 'group_call_ice', target_id: peerId, candidate })
    }
    pc.ontrack = ({ streams }) => {
      if (streams[0]) setGroupRemoteStreams(prev => ({ ...prev, [peerId]: streams[0] }))
    }
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState
      clearTimeout(groupDisconnectTimeoutsRef.current[peerId])
      if (s === 'failed' || s === 'closed') {
        closeGroupPeer(peerId)
      } else if (s === 'disconnected') {
        groupDisconnectTimeoutsRef.current[peerId] = setTimeout(() => {
          if (groupPcsRef.current[peerId] === pc && pc.connectionState === 'disconnected') closeGroupPeer(peerId)
        }, 8000)
      }
    }
    const stream = groupLocalStreamRef.current
    if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream))
    return pc
  }

  function closeGroupPeer(peerId) {
    clearTimeout(groupDisconnectTimeoutsRef.current[peerId])
    delete groupDisconnectTimeoutsRef.current[peerId]
    const pc = groupPcsRef.current[peerId]
    if (pc) { pc.close(); delete groupPcsRef.current[peerId] }
    delete groupPendingCandidatesRef.current[peerId]
    setGroupRemoteStreams(prev => {
      if (!(peerId in prev)) return prev
      const next = { ...prev }; delete next[peerId]; return next
    })
    setGroupRemoteCameraOff(prev => {
      if (!(peerId in prev)) return prev
      const next = { ...prev }; delete next[peerId]; return next
    })
  }

  async function joinGroupCall(type) {
    if (groupCallJoinedRef.current) return
    if (callState !== 'idle') {
      // Había una llamada 1-to-1 en marcha (activa, sonando, o llamando) —
      // se cuelga al unirse de verdad a la grupal.
      const peer = callPeerRef.current
      if (peer) sendWs({ type: callState === 'incoming' ? 'call_reject' : 'call_end', target_id: peer.id })
      cleanupCall()
    }
    clearTimeout(groupRingTimeoutRef.current)
    setIncomingGroupCall(null)
    openAppRef.current?.('diskordkito')
    try {
      await Promise.all([getGroupMedia(type === 'video'), refreshIceServers()])
      groupCallJoinedRef.current = true
      setGroupCallJoined(true)
      setGroupCallType(type)
      sendWs({ type: 'group_call_join', callType: type })
    } catch (err) {
      console.error('joinGroupCall:', err)
      leaveGroupCall()
    }
  }

  function leaveGroupCall() {
    sendWs({ type: 'group_call_leave' })
    Object.keys(groupPcsRef.current).forEach(pid => closeGroupPeer(Number(pid)))
    groupLocalStreamRef.current?.getTracks().forEach(t => t.stop())
    groupLocalStreamRef.current = null
    groupCallJoinedRef.current = false
    setGroupCallJoined(false)
    setGroupLocalStream(null)
    setGroupRemoteStreams({})
    setGroupRemoteCameraOff({})
    setGroupIsMuted(false)
    setGroupIsCameraOff(false)
    setGroupCallChatOpen(false)
  }

  function toggleGroupMute() {
    const track = groupLocalStreamRef.current?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setGroupIsMuted(!track.enabled)
  }

  function toggleGroupCamera() {
    const track = groupLocalStreamRef.current?.getVideoTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setGroupIsCameraOff(!track.enabled)
    sendWs({ type: 'group_call_media', video: track.enabled })
  }

  async function handleGroupCallSignal(msg) {
    switch (msg.type) {
      case 'group_call_state': {
        setGroupCallActive(msg.active)
        setGroupCallType(msg.callType ?? 'video')
        const ids = msg.participantIds ?? []
        setGroupCallParticipantIds(ids)
        if (groupCallJoinedRef.current && !ids.includes(player.id)) {
          groupCallJoinedRef.current = false
          setGroupCallJoined(false)
        }
        // Cierra el mesh con quien ya no está en la lista autorizada (salió o se desconectó)
        Object.keys(groupPcsRef.current).forEach(pid => {
          if (!ids.includes(Number(pid))) closeGroupPeer(Number(pid))
        })
        break
      }
      case 'group_call_ring':
        if (groupCallJoinedRef.current) break
        setIncomingGroupCall({ from_player: msg.from_player, callType: msg.callType ?? 'video' })
        clearTimeout(groupRingTimeoutRef.current)
        groupRingTimeoutRef.current = setTimeout(() => setIncomingGroupCall(null), CALL_RING_TIMEOUT)
        break
      case 'group_call_peers':
        setGroupCallType(msg.callType ?? 'video')
        for (const peerId of (msg.peerIds ?? [])) {
          try {
            const pc = createGroupPC(peerId)
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            sendWs({ type: 'group_call_offer', target_id: peerId, sdp: pc.localDescription.sdp })
          } catch (err) {
            console.error('group_call join offer:', err)
          }
        }
        break
      case 'group_call_offer': {
        const fromId = msg.from_player.id
        if (groupPcsRef.current[fromId]) closeGroupPeer(fromId) // auto-recuperación ante doble unión casi simultánea
        const pc = createGroupPC(fromId)
        await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp })
        // splice(0), no "leer + resetear a []" — ver comentario en acceptCall.
        const pending = (groupPendingCandidatesRef.current[fromId] ?? []).splice(0)
        for (const c of pending) await pc.addIceCandidate(c)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        sendWs({ type: 'group_call_answer', target_id: fromId, sdp: pc.localDescription.sdp })
        break
      }
      case 'group_call_answer': {
        const pc = groupPcsRef.current[msg.from_player.id]
        if (pc) await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp })
        break
      }
      case 'group_call_ice': {
        const fromId = msg.from_player.id
        const pc = groupPcsRef.current[fromId]
        if (pc?.remoteDescription) {
          await pc.addIceCandidate(msg.candidate)
        } else {
          groupPendingCandidatesRef.current[fromId] = [...(groupPendingCandidatesRef.current[fromId] ?? []), msg.candidate]
        }
        break
      }
      case 'group_call_media':
        setGroupRemoteCameraOff(prev => ({ ...prev, [msg.from_player.id]: msg.video === false }))
        break
    }
  }

  async function handleCallSignal(msg) {
    switch (msg.type) {
      case 'call_offer': {
        // ¿Había ya otra llamada en marcha (1-to-1 activa/llamando, o
        // grupal ya unida)? Se guarda para colgarla solo si esta nueva se
        // acepta de verdad (acceptCall) — si se rechaza, se restaura tal
        // cual (rejectCall).
        const busyState = callStateRef.current
        if ((busyState === 'active' || busyState === 'calling') && callPeerRef.current) {
          pendingHangupRef.current = { type: '1to1', peer: callPeerRef.current, callType: callTypeRef.current, callState: busyState }
        } else if (groupCallJoinedRef.current) {
          pendingHangupRef.current = { type: 'group' }
        } else {
          pendingHangupRef.current = null
        }
        offerSdpRef.current  = msg.sdp
        callPeerRef.current  = msg.from_player
        callTypeRef.current  = msg.callType ?? 'video'
        setCallPeer(msg.from_player)
        setCallType(msg.callType ?? 'video')
        setCallState('incoming')
        setCallNotifDismissed(false)
        clearTimeout(ringTimeoutRef.current)
        ringTimeoutRef.current = setTimeout(rejectCall, CALL_RING_TIMEOUT)
        break
      }
      case 'call_answer':
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription({ type: 'answer', sdp: msg.sdp })
          setCallState('active')
        }
        break
      case 'call_ice':
        if (pcRef.current?.remoteDescription) {
          await pcRef.current.addIceCandidate(msg.candidate)
        } else {
          pendingCandidates.current.push(msg.candidate)
        }
        break
      case 'call_media':
        setRemoteCameraOff(msg.video === false)
        break
      case 'call_reject':
      case 'call_end':
        // Si todavía no estaba 'active' (llamando sin respuesta, o entrante
        // sin contestar y el que llamaba se rindió antes), es una llamada
        // perdida — si ya estaba 'active' y de verdad se cuelga en plena
        // llamada, no se notifica (decisión explícita, solo perdidas).
        if (callStateRef.current !== 'active') notifyMissedCall(msg.from_player)
        cleanupCall()
        break
    }
  }

  // Ventana en primer plano ahora mismo, vía ref (para uso dentro del handler
  // del WS, que no se re-suscribe en cada render).
  function diskordInForegroundNow() {
    const visible = windowsRef.current.filter(w => !w.minimized)
    if (!visible.length) return false
    const top = visible.reduce((a, b) => (b.zIndex > a.zIndex ? b : a))
    return top.appId === 'diskordkito'
  }

  // ── Tono de llamada entrante ─────────────────────────────────────────────────
  // Sintetizado con Web Audio (sin fichero de audio de por medio): dos notas
  // suaves con fade in/out para que no "chasquee", repitiéndose mientras
  // suene la llamada. El AudioContext se crea/reactiva en el primer toque
  // del jugador en la app (los navegadores, sobre todo iOS Safari, no dejan
  // arrancar audio sin un gesto previo) y se reutiliza para toda la sesión.
  const audioCtxRef = useRef(null)
  useEffect(() => {
    function unlockAudio() {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx()
      else if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume().catch(() => {})
    }
    window.addEventListener('pointerdown', unlockAudio)
    return () => window.removeEventListener('pointerdown', unlockAudio)
  }, [])

  function playRingChime() {
    const ctx = audioCtxRef.current
    if (!ctx || ctx.state !== 'running') return
    const now = ctx.currentTime
    // Cuarta justa (D5-A5), suave y nada estridente.
    ;[587.33, 880].forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = now + i * 0.16
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.linearRampToValueAtTime(0.15, start + 0.06)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.55)
    })
  }

  // Suena mientras haya una llamada entrante mostrándose — 1-to-1 o grupal —
  // y se para sola en cuanto deja de haberla (aceptada, rechazada, o
  // expirado el aviso), sin necesidad de parar el intervalo a mano en cada
  // sitio donde eso puede pasar.
  const isRinging = callState === 'incoming' || (!!incomingGroupCall && !groupCallJoined)
  useEffect(() => {
    if (!isRinging) return
    playRingChime()
    const id = setInterval(playRingChime, 2200)
    return () => clearInterval(id)
  }, [isRinging])

  // ── WebSocket global ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!player.token) return
    const ws = new WebSocket(`/ws?token=${player.token}`)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)

        window.dispatchEvent(new CustomEvent('luni:ws', { detail: msg }))

        if (msg.type === 'presence') {
          setOnline(msg.online)
        }

        if (CALL_SIGNAL_TYPES.has(msg.type)) {
          signalQueueRef.current = signalQueueRef.current
            .then(() => handleCallSignal(msg))
            .catch(err => console.error('handleCallSignal:', err))
        }

        if (GROUP_CALL_SIGNAL_TYPES.has(msg.type)) {
          signalQueueRef.current = signalQueueRef.current
            .then(() => handleGroupCallSignal(msg))
            .catch(err => console.error('handleGroupCallSignal:', err))
        }

        if (msg.type === 'message' && msg.player_id !== player.id) {
          // "visibleChannelId" ya tiene en cuenta si, estando en llamada, el
          // panel de chat de la llamada está desplegado o no (ver Diskordkito).
          const chatOpenHere = diskordInForegroundNow() && activeChannelRef.current?.visibleChannelId === msg.channel_id

          // Notificación in-app: solo si el destinatario NO tiene esta conversación
          // desplegada ahora mismo (Diskordkito no está en primer plano, o lo está
          // pero mostrando otra cosa — otro canal, o el panel de chat de la llamada cerrado)
          if (!chatOpenHere) setNotification(msg)

          // Notificación nativa del sistema operativo (cuando la pestaña no tiene foco)
          if (!document.hasFocus() && Notification.permission === 'granted') {
            const n = new Notification(`${msg.player_name} · Diskordkito`, {
              body: msg.content,
              icon: '/favicon.ico',
              tag:  'diskordkito',   // reemplaza la anterior, sin acumulación
              silent: false,
            })
            n.onclick = () => {
              window.focus()
              openAppRef.current?.('diskordkito')
            }
          }
        }
      } catch {}
    }

    ws.onclose = () => { wsRef.current = null }

    return () => { ws.close(); wsRef.current = null }
  }, [player.token])

  // ── Perfil ──────────────────────────────────────────────────────────────────
  function onProfileUpdate(updated) {
    if (updated === null) { onLogout(); return }
    setPlayer(p => ({ ...p, ...updated }))
    _onProfileUpdate?.(updated)
  }

  // ── Gestión de ventanas ─────────────────────────────────────────────────────
  const openApp = useCallback((appId) => {
    // Cualquier apertura de una app "de pestaña" en móvil (venga de donde
    // venga: el lanzador, el menú, o aquí abajo desde una notificación de
    // llamada/mensaje) debe dejarla marcada como la pestaña activa — si no,
    // se queda viendo la pestaña anterior "por debajo" con los clics activos
    // aunque la de encima (la que el jugador cree que está usando) los tenga
    // desactivados por no ser "la activa". Centralizado aquí para que no
    // haga falta acordarse de llamar también a switchMobileApp en cada sitio
    // que abre una app directamente.
    if (isMobile && MOBILE_TAB_APPS.includes(appId)) setMobileActiveTab(appId)
    setWindows(prev => {
      const ex = prev.find(w => w.appId === appId)
      if (ex) {
        setTopZ(z => z + 1)
        return prev.map(w => w.id === ex.id ? { ...w, minimized: false, zIndex: topZ + 1 } : w)
      }

      const el = containerRef.current
      const cw = el ? el.clientWidth  : 800
      const ch = el ? el.clientHeight : 600
      const cfg = APPS[appId]

      // Limita el tamaño al contenedor (con margen)
      const ww = Math.min(cfg?.width  ?? 640, cw - 16)
      const wh = Math.min(cfg?.height ?? 480, ch - MENU_BAR_H - DOCK_RESERVED - 16)

      // Centra la ventana con un ligero stagger para la N-ésima
      const offset = (prev.length % 6) * 22
      const x = Math.max(8, Math.round((cw - ww) / 2) + offset)
      const y = Math.max(MENU_BAR_H + 8, Math.round((ch - MENU_BAR_H - DOCK_RESERVED - wh) / 2) + MENU_BAR_H + offset)

      const id = _nextId++
      setTopZ(z => z + 1)
      return [...prev, {
        id, appId,
        pos:  { x, y },
        size: { w: ww, h: wh },
        minimized: false, maximized: false,
        preMaxPos: null, preMaxSize: null,
        zIndex: topZ + 1,
      }]
    })
  }, [topZ, isMobile])

  // Mantiene el ref siempre actualizado para el handler del WS
  useEffect(() => { openAppRef.current = openApp }, [openApp])

  // ── Móvil: una sola pestaña visible a la vez ────────────────────────────────
  // Abre la app pedida y minimiza el resto (incluida Ajustes si estuviera
  // abierta) — así tocar una pestaña siempre vuelve a la vista de esa app.
  // Se recuerda la última pestaña visitada por jugador, entre sesiones.
  const mobileTabKey = `gatos_mobile_tab_${initialPlayer.id}`
  const switchMobileApp = useCallback((appId) => {
    openApp(appId)
    setWindows(prev => prev.map(w => w.appId === appId ? w : { ...w, minimized: true }))
    setMobileActiveTab(appId)
    try { localStorage.setItem(mobileTabKey, appId) } catch {}
  }, [openApp, mobileTabKey])

  // Si no hay ninguna pestaña activa al entrar en modo móvil (primera vez,
  // o todas minimizadas desde una sesión de escritorio), reabre la última
  // que se visitó (o la primera de la lista si no hay ninguna guardada).
  useEffect(() => {
    if (!isMobile) return
    const tabApps = visibleTabApps(player)
    const activeWindow = windowsRef.current.find(w => tabApps.includes(w.appId) && !w.minimized)
    if (activeWindow) {
      // Ya había una restaurada (p.ej. desde localStorage) — sincronizar el
      // estado directo con ella en vez de dejarlo a null.
      setMobileActiveTab(activeWindow.appId)
    } else {
      let lastTab = null
      try { lastTab = localStorage.getItem(mobileTabKey) } catch {}
      switchMobileApp(tabApps.includes(lastTab) ? lastTab : tabApps[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, player.club_member])

  const closeWindow    = useCallback((id) => setWindows(prev => prev.filter(w => w.id !== id)), [])
  const focusWindow    = useCallback((id) => { setTopZ(z => z + 1); setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: topZ + 1 } : w)) }, [topZ])
  const toggleMinimize = useCallback((id) => setWindows(prev => prev.map(w => w.id === id ? { ...w, minimized: !w.minimized } : w)), [])
  const moveWindow     = useCallback((id, pos)  => setWindows(prev => prev.map(w => w.id === id ? { ...w, pos }  : w)), [])
  const resizeWindow   = useCallback((id, size) => setWindows(prev => prev.map(w => w.id === id ? { ...w, size } : w)), [])

  // Clic en el icono del Dock: si está minimizada o detrás de otra, la trae al frente;
  // si ya está en primer plano, la minimiza (como el Dock real de macOS).
  const dockClick = useCallback((id) => {
    const visible = windowsRef.current.filter(w => !w.minimized)
    const topMost = visible.length ? visible.reduce((a, b) => (b.zIndex > a.zIndex ? b : a)) : null
    const win = windowsRef.current.find(w => w.id === id)
    if (!win) return

    if (win.minimized || topMost?.id !== id) {
      setTopZ(z => z + 1)
      setWindows(prev => prev.map(w => w.id === id ? { ...w, minimized: false, zIndex: topZ + 1 } : w))
    } else {
      setWindows(prev => prev.map(w => w.id === id ? { ...w, minimized: true } : w))
    }
  }, [topZ])

  const toggleMaximize = useCallback((id) => {
    const el = containerRef.current
    const cw = el ? el.clientWidth  : window.innerWidth
    const ch = el ? el.clientHeight : window.innerHeight
    setWindows(prev => prev.map(w => {
      if (w.id !== id) return w
      if (w.maximized) {
        return { ...w, maximized: false, pos: w.preMaxPos ?? w.pos, size: w.preMaxSize ?? w.size, preMaxPos: null, preMaxSize: null }
      }
      return { ...w, maximized: true, preMaxPos: w.pos, preMaxSize: w.size, pos: { x: 0, y: MENU_BAR_H }, size: { w: cw, h: ch - MENU_BAR_H } }
    }))
  }, [])

  // Las ventanas maximizadas guardan su tamaño en píxeles en el momento de maximizar;
  // si el navegador se redimensiona después, hay que volver a ajustarlas al contenedor.
  useEffect(() => {
    function handleResize() {
      const el = containerRef.current
      if (!el) return
      const cw = el.clientWidth
      const ch = el.clientHeight
      setWindows(prev => prev.map(w =>
        w.maximized ? { ...w, size: { w: cw, h: ch - MENU_BAR_H } } : w
      ))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const call = {
    state: callState, peer: callPeer, type: callType,
    localStream, remoteStream, isMuted, isCameraOff, remoteCameraOff,
    start: startCall, accept: acceptCall, reject: rejectCall, end: endCall,
    toggleMute, toggleCamera,
    chatOpen: callChatOpen,
    toggleChat: () => setCallChatOpen(v => !v),
    openChat:   () => setCallChatOpen(true),
  }

  const groupCall = {
    active: groupCallActive, joined: groupCallJoined,
    participantIds: groupCallParticipantIds, callType: groupCallType,
    localStream: groupLocalStream, remoteStreams: groupRemoteStreams, remoteCameraOff: groupRemoteCameraOff,
    isMuted: groupIsMuted, isCameraOff: groupIsCameraOff,
    join: joinGroupCall, leave: leaveGroupCall,
    toggleMute: toggleGroupMute, toggleCamera: toggleGroupCamera,
    chatOpen: groupCallChatOpen,
    toggleChat: () => setGroupCallChatOpen(v => !v),
  }

  function appContent(appId) {
    switch (appId) {
      case 'diskordkito': return <Diskordkito player={player} wsRef={wsRef} online={online} call={call} groupCall={groupCall}
                                    onActiveChannelChange={id => { activeChannelRef.current = id }} />
      case 'luniteca':    return <Luniteca    player={player} />
      case 'luniteca2':   return <LunitecaV2  player={player} />
case 'settings':    return <SettingsApp player={player} onProfileUpdate={onProfileUpdate} />
      case 'pirestore':   return <Pirestore   player={player} onProfileUpdate={onProfileUpdate} />
      case 'admin':       return <AdminPanel  player={player} />
      default:            return null
    }
  }

  const wallpaperId = player.customization?.wallpaper ?? 'default'
  const wallpaperBg = wallpaperCss(wallpapers.find(w => w.item_id === wallpaperId))
    ?? wallpaperCss(wallpapers[0])
    ?? FALLBACK_WALLPAPER_BG

  const visibleWindows = windows.filter(w => !w.minimized)
  const activeWindow = visibleWindows.length
    ? visibleWindows.reduce((a, b) => (b.zIndex > a.zIndex ? b : a))
    : null
  const activeAppTitle = activeWindow ? APPS[activeWindow.appId]?.title : null

  // Móvil: qué pestaña se ve, y si Ajustes está abierto encima como overlay.
  // Quien no es miembro del club solo tiene Luniteca como pestaña posible.
  const tabApps = visibleTabApps(player)
  const mobileActiveTabApp = (mobileActiveTab && tabApps.includes(mobileActiveTab))
    ? mobileActiveTab
    : tabApps[0]
  const mobileSettingsWindow = windows.find(w => w.appId === 'settings' && !w.minimized)
  const mobileAdminWindow    = windows.find(w => w.appId === 'admin'    && !w.minimized)

  // App realmente visible ahora mismo, sea cual sea el modo — usado para
  // decidir si la notificación de llamada entrante es redundante o no.
  const foregroundAppId = isMobile
    ? (mobileSettingsWindow ? 'settings' : mobileAdminWindow ? 'admin' : mobileActiveTabApp)
    : activeWindow?.appId

  // Modo "kiosco" — quien no es miembro del club solo tiene una app
  // (Luniteca), así que directamente no hay nada que gestionar: sin Dock,
  // sin ventanas movibles/redimensionables/cerrables, Luniteca ocupa toda la
  // pantalla desde el principio, fija. Igual en móvil y escritorio. El admin
  // nunca entra aquí aunque por lo que sea tuviera club_member a false.
  const isAdmin = player.name?.toLowerCase() === 'wander'
  const kiosk = !player.club_member && !isAdmin

  if (kiosk) {
    return (
      <div ref={containerRef} className="relative overflow-hidden select-none"
        style={{ width: '100%', height: '100%' }}>
        <AnimatePresence>
          <motion.div key={wallpaperBg}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            style={{ position: 'absolute', inset: 0, background: wallpaperBg, zIndex: 0 }} />
        </AnimatePresence>

        <MenuBar
          player={player}
          activeAppTitle={APPS.luniteca2?.title}
          online={online}
          onOpenApp={openApp}
          onLogout={onLogout}
          onExitPC={onExitPC}
          compact={isMobile}
        />

        <div style={{ position: 'absolute', top: MENU_BAR_H, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
          {appContent('luniteca2')}
        </div>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div ref={containerRef} className="relative overflow-hidden select-none"
        style={{ width: '100%', height: '100%' }}>

        {/* Fondo con crossfade — un <div> con "background" no anima bien entre
            dos gradientes/imágenes distintos (no es una propiedad interpolable),
            así que el cambio suave se hace superponiendo capas y fundiendo opacidad. */}
        <AnimatePresence>
          <motion.div key={wallpaperBg}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            style={{ position: 'absolute', inset: 0, background: wallpaperBg, zIndex: 0 }} />
        </AnimatePresence>

        <MenuBar
          player={player}
          activeAppTitle={APPS[foregroundAppId]?.title}
          online={online}
          onOpenApp={openApp}
          onLogout={onLogout}
          onExitPC={onExitPC}
          compact
        />

        {/* Contenido de las pestañas, a pantalla completa (el lanzador flota
            encima, no reserva espacio). Las tres apps se mantienen montadas a
            la vez (ocultas con CSS, no desmontadas) para no perder su estado
            — scroll, conversación abierta, etc. — cada vez que se cambia. */}
        <div style={{
          position: 'absolute', top: MENU_BAR_H, left: 0, right: 0, bottom: 0,
          overflow: 'hidden',
        }}>
          {tabApps.map(id => {
            const active = mobileActiveTabApp === id
            return (
              <motion.div
                key={id}
                initial={false}
                animate={{ opacity: active ? 1 : 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  pointerEvents: active ? 'auto' : 'none',
                }}
              >
                {appContent(id)}
              </motion.div>
            )
          })}
        </div>

        {/* Ajustes se abre como overlay a pantalla completa encima de la pestaña activa */}
        <AnimatePresence>
          {mobileSettingsWindow && (
            <motion.div
              key="mobile-settings"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              style={{
                position: 'absolute', top: MENU_BAR_H, left: 0, right: 0, bottom: 0,
                zIndex: 20000, background: '#111827', display: 'flex', flexDirection: 'column',
              }}
            >
              <div style={{
                height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                padding: '0 6px 0 2px', background: 'rgba(46,46,52,0.92)', backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
              }}>
                <button onClick={() => toggleMinimize(mobileSettingsWindow.id)} style={{
                  background: 'none', border: 'none', color: 'white', fontSize: 22, lineHeight: 1,
                  cursor: 'pointer', padding: '8px 10px', display: 'flex', alignItems: 'center',
                }}>‹</button>
                <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>Ajustes</span>
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {appContent('settings')}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Admin — mismo patrón que Ajustes, overlay a pantalla completa */}
        <AnimatePresence>
          {mobileAdminWindow && (
            <motion.div
              key="mobile-admin"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              style={{
                position: 'absolute', top: MENU_BAR_H, left: 0, right: 0, bottom: 0,
                zIndex: 20000, background: '#111827', display: 'flex', flexDirection: 'column',
              }}
            >
              <div style={{
                height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                padding: '0 6px 0 2px', background: 'rgba(46,46,52,0.92)', backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
              }}>
                <button onClick={() => toggleMinimize(mobileAdminWindow.id)} style={{
                  background: 'none', border: 'none', color: 'white', fontSize: 22, lineHeight: 1,
                  cursor: 'pointer', padding: '8px 10px', display: 'flex', alignItems: 'center',
                }}>‹</button>
                <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>Admin</span>
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {appContent('admin')}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notificación macOS */}
        <AnimatePresence mode="wait">
          {notification && (
            <MessageNotification
              key={notification.id}
              msg={notification}
              onClose={() => setNotification(null)}
              onOpenDiskordkito={() => {
                switchMobileApp('diskordkito')
                if (callState === 'active' && notification.player_id === callPeer?.id) {
                  setCallChatOpen(true)
                }
              }}
            />
          )}
        </AnimatePresence>

        {/* Notificación de llamada entrante */}
        <AnimatePresence>
          {callState === 'incoming' && callPeer && !callNotifDismissed &&
           !(foregroundAppId === 'diskordkito' && activeChannelRef.current?.peerId === callPeer.id) && (
            <CallNotification
              key={`call-${callPeer.id}`}
              peer={callPeer}
              callType={callType}
              onAccept={acceptCall}
              onReject={rejectCall}
              onOpen={() => { setCallNotifDismissed(true); switchMobileApp('diskordkito') }}
            />
          )}
        </AnimatePresence>

        {/* Aviso de llamada grupal entrante en #club-general */}
        <AnimatePresence>
          {incomingGroupCall && !groupCallJoined && (
            <GroupCallNotification
              key={`group-call-${incomingGroupCall.from_player.id}`}
              fromPlayer={incomingGroupCall.from_player}
              callType={incomingGroupCall.callType}
              onJoin={() => joinGroupCall(incomingGroupCall.callType)}
              onDismiss={() => setIncomingGroupCall(null)}
            />
          )}
        </AnimatePresence>

        {/* Sin nada que cambiar (solo Luniteca visible), el lanzador no
            aporta nada — se oculta en vez de mostrar un abanico de un icono.
            El abanico ofrece TODAS las apps visibles (como el Dock de
            escritorio), no solo las 3 de pestaña. */}
        {launcherApps(player).length > 1 && (
          <MobileLauncher activeAppId={mobileActiveTabApp} onSelect={switchMobileApp} playerId={player.id} player={player} />
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative overflow-hidden select-none"
      style={{ width:'100%', height:'100%' }}>

      {/* Fondo con crossfade — ver comentario en la rama móvil */}
      <AnimatePresence>
        <motion.div key={wallpaperBg}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          style={{ position: 'absolute', inset: 0, background: wallpaperBg, zIndex: 0 }} />
      </AnimatePresence>

      <MenuBar
        player={player}
        activeAppTitle={activeAppTitle}
        online={online}
        onOpenApp={openApp}
        onLogout={onLogout}
        onExitPC={onExitPC}
      />

      {/* Marca de agua */}
      <div style={{ position:'absolute', bottom:60, right:24, fontFamily:'"Press Start 2P"', fontSize:9, color:'rgba(255,255,255,0.04)', pointerEvents:'none' }}>
        GatOS v0.1
      </div>

      {/* Ventanas */}
      <AnimatePresence>
        {windows.filter(w => !w.minimized).map(win => (
          <Window key={win.id} win={win} appMeta={APPS[win.appId]}
            onClose={()        => closeWindow(win.id)}
            onFocus={()        => focusWindow(win.id)}
            onMinimize={()     => toggleMinimize(win.id)}
            onMove={(pos)      => moveWindow(win.id, pos)}
            onResize={(size)   => resizeWindow(win.id, size)}
            onMaximize={()     => toggleMaximize(win.id)}>
            {appContent(win.appId)}
          </Window>
        ))}
      </AnimatePresence>

      {/* Notificación macOS */}
      <AnimatePresence mode="wait">
        {notification && (
          <MessageNotification
            key={notification.id}
            msg={notification}
            onClose={() => setNotification(null)}
            onOpenDiskordkito={() => {
              openApp('diskordkito')
              // Si el mensaje es de la persona con la que estás en llamada,
              // abre también el panel de chat de la llamada (si no, el
              // mensaje quedaría fuera de vista tras la pantalla de vídeo).
              if (callState === 'active' && notification.player_id === callPeer?.id) {
                setCallChatOpen(true)
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Notificación de llamada entrante — igual que la de mensajes, funciona
          aunque Diskordkito esté cerrado o minimizado. Se omite si Diskordkito
          ya está en primer plano mostrando la conversación con quien llama
          (ahí ya se ve el aviso propio de la app, sería redundante). */}
      <AnimatePresence>
        {callState === 'incoming' && callPeer && !callNotifDismissed &&
         !(foregroundAppId === 'diskordkito' && activeChannelRef.current?.peerId === callPeer.id) && (
          <CallNotification
            key={`call-${callPeer.id}`}
            peer={callPeer}
            callType={callType}
            onAccept={acceptCall}
            onReject={rejectCall}
            onOpen={() => { setCallNotifDismissed(true); openApp('diskordkito') }}
          />
        )}
      </AnimatePresence>

      {/* Aviso de llamada grupal entrante en #club-general */}
      <AnimatePresence>
        {incomingGroupCall && !groupCallJoined && (
          <GroupCallNotification
            key={`group-call-${incomingGroupCall.from_player.id}`}
            fromPlayer={incomingGroupCall.from_player}
            callType={incomingGroupCall.callType}
            onJoin={() => joinGroupCall(incomingGroupCall.callType)}
            onDismiss={() => setIncomingGroupCall(null)}
          />
        )}
      </AnimatePresence>

      <Dock
        windows={windows}
        onOpenApp={openApp}
        onIconClick={dockClick}
        autoHide={windows.some(w => w.maximized)}
        player={player}
      />
    </div>
  )
}
