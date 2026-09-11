import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import { enviarPorWS } from './live'

// Conversaciones, mensajes y quién está conectado.
//
// Vive **por encima de las pantallas**, no dentro de la de Diskordkito, por dos
// motivos que no son negociables:
//
// 1. Los avisos tienen que llegar estés donde estés. Si esto viviera dentro de
//    la pantalla del chat, cerrarla dejaría de enterarse de los mensajes — que
//    es justo cuando hace falta el aviso.
// 2. El número de conversaciones sin leer sale en el menú lateral, que tampoco
//    es parte de esa pantalla.
//
// Lo que NO hace: decidir qué se ve. Quién está mirando qué conversación lo
// dice la pantalla con `mirando()`, y esto solo lo usa para no avisar de un
// mensaje que ya tienes delante y para marcarlo leído.

const ChatContext = createContext(null)

// Lo que el club llama "el canal de todos". El backend lo crea al arrancar y
// mete ahí a cada miembro; aquí se reconoce por el nombre para poder pintarlo
// distinto y dejarlo siempre el primero.
export const CANAL_DEL_CLUB = 'club-general'

export function ChatProvider({ children }) {
  const { player } = useAuth()
  const miId = player?.id
  const puede = !!player?.club_member

  const [jugadores, setJugadores] = useState([])
  const [canales, setCanales] = useState([])
  const [mensajes, setMensajes] = useState({})   // { [canalId]: [...] }
  const [online, setOnline] = useState([])
  const [cargado, setCargado] = useState(false)

  // Qué conversación se está viendo de VERDAD ahora mismo. En un ref y no en
  // estado: lo lee el oyente del WebSocket, que se engancha una sola vez, y si
  // fuera estado tendría que reengancharse en cada cambio.
  const mirandoRef = useRef(null)
  const mirando = useCallback((canalId) => { mirandoRef.current = canalId }, [])

  // Los avisos los pinta quien quiera (App); aquí solo se dice qué ha pasado.
  const alLlegarMensaje = useRef(null)
  const alAvisarDe = useCallback(fn => { alLlegarMensaje.current = fn }, [])

  const cargarCanales = useCallback(async () => {
    const datos = await api('/channels').catch(() => null)
    // Se descartan las conversaciones huérfanas: un uno a uno cuyo
    // interlocutor ya no existe. Pasa de verdad — al borrar una cuenta, el
    // backend quita sus membresías pero el canal se queda con la otra
    // persona dentro—, y sin esto sale una fila con una estrella y "Alguien"
    // que no lleva a ninguna parte.
    if (datos) setCanales(datos.filter(c => c.type !== 'dm' || c.other_player))
    return datos
  }, [])

  const cargarJugadores = useCallback(async () => {
    const datos = await api('/players').catch(() => null)
    if (!datos) return
    setJugadores(datos)
    // Un mensaje guarda el nombre, color y avatar de quien lo escribió EN ESE
    // momento. Si alguien se cambia el nombre o la foto, los mensajes que ya
    // están en pantalla se quedarían con los datos viejos hasta recargar la
    // conversación: se repintan aquí con lo fresco.
    const porId = new Map(datos.map(p => [p.id, p]))
    setMensajes(prev => {
      let cambio = false
      const siguiente = {}
      for (const [canalId, lista] of Object.entries(prev)) {
        siguiente[canalId] = lista.map(m => {
          const p = porId.get(m.player_id)
          if (!p) return m
          if (m.player_name === p.name && m.player_color === p.color &&
              m.player_emoji === p.avatar_emoji && m.player_avatar_url === p.avatar_url) return m
          cambio = true
          return {
            ...m,
            player_name: p.name, player_color: p.color,
            player_emoji: p.avatar_emoji, player_avatar_url: p.avatar_url,
          }
        })
      }
      return cambio ? siguiente : prev
    })
  }, [])

  // Arranque. Quien no es del club no tiene canales (el backend le saca de
  // todos al quitarle el acceso), así que no se pide nada.
  useEffect(() => {
    if (!puede) { setCargado(true); return }
    let vigente = true
    Promise.all([cargarJugadores(), cargarCanales()]).finally(() => {
      if (vigente) setCargado(true)
    })
    return () => { vigente = false }
  }, [puede, cargarJugadores, cargarCanales])

  // ── Lo que llega por el socket ────────────────────────────────────────────
  useEffect(() => {
    if (!puede || !miId) return

    function alRecibir(ev) {
      const msg = ev.detail
      if (!msg) return

      if (msg.type === 'presence') {
        setOnline(msg.online || [])
        return
      }

      if (msg.type === 'message') {
        setMensajes(prev => {
          const lista = prev[msg.channel_id] ?? []
          // El servidor reparte a todos los miembros, incluido quien lo
          // escribió: sin esto, el que envía vería su mensaje dos veces.
          if (lista.some(m => m.id === msg.id)) return prev
          return { ...prev, [msg.channel_id]: [...lista, msg] }
        })

        const mio = msg.player_id === miId
        const delante = msg.channel_id === mirandoRef.current

        setCanales(prev => {
          // Primer mensaje de una conversación que todavía no conocíamos (la
          // acaba de abrir la otra persona): se recarga la lista entera para
          // tenerla con sus datos, en vez de inventar una entrada a medias.
          if (!prev.some(c => c.id === msg.channel_id)) { cargarCanales(); return prev }
          return prev.map(c => c.id === msg.channel_id
            ? { ...c, last_message_at: msg.created_at, ...(mio || delante ? { last_read_at: msg.created_at } : {}) }
            : c)
        })

        if (mio || delante) marcarLeido(msg.channel_id, msg.created_at)
        else alLlegarMensaje.current?.(msg)
        return
      }

      // El admin ha dado o quitado acceso al club, o alguien ha cambiado su
      // perfil: cambia quién sale en la lista y con qué cara.
      if (msg.type === 'luni_update' && msg.scope === 'players') {
        cargarJugadores()
        cargarCanales()
      }
    }

    window.addEventListener('puchi:ws', alRecibir)
    return () => window.removeEventListener('puchi:ws', alRecibir)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puede, miId, cargarJugadores, cargarCanales])

  // ── Acciones ──────────────────────────────────────────────────────────────
  const cargarMensajes = useCallback(async (canalId) => {
    const datos = await api(`/channels/${canalId}/messages`).catch(() => null)
    if (datos) setMensajes(prev => ({ ...prev, [canalId]: datos }))
  }, [])

  // Se marca leído en el servidor Y aquí: el servidor guarda la marca para la
  // próxima vez que se abra la app, y la copia local hace que el punto de "sin
  // leer" se apague al instante sin esperar a nada.
  const marcarLeido = useCallback((canalId, cuandoIso) => {
    const leidoEn = cuandoIso ?? new Date().toISOString()
    setCanales(prev => prev.map(c => {
      if (c.id !== canalId) return c
      if (c.last_read_at && new Date(c.last_read_at) >= new Date(leidoEn)) return c
      return { ...c, last_read_at: leidoEn }
    }))
    enviarPorWS({ type: 'mark_read', channel_id: canalId })
  }, [])

  const enviar = useCallback((canalId, texto) => {
    const contenido = texto.trim()
    if (!contenido || !canalId) return false
    return enviarPorWS({ type: 'message', channel_id: canalId, content: contenido })
  }, [])

  // Abre (o crea) la conversación con alguien y devuelve su id.
  const abrirDM = useCallback(async (otroId) => {
    const { id } = await api(`/channels/dm/${otroId}`, { method: 'POST' })
    await cargarCanales()
    cargarMensajes(id)
    return id
  }, [cargarCanales, cargarMensajes])

  // ── Derivados ─────────────────────────────────────────────────────────────
  const sinLeerDe = useCallback((canal) => {
    if (!canal?.last_message_at) return false
    if (!canal.last_read_at) return true
    return new Date(canal.last_message_at) > new Date(canal.last_read_at)
  }, [])

  const sinLeer = useMemo(
    () => canales.filter(c => sinLeerDe(c)).length,
    [canales, sinLeerDe],
  )

  // Del club y que no seas tú: quien no es miembro no sale ni como alguien a
  // quien escribir. El backend lo rechazaría igual (`require_club_member` en
  // el alta de conversación), esto es para no ofrecer lo que va a fallar.
  const otros = useMemo(
    () => jugadores.filter(p => p.id !== miId && p.club_member),
    [jugadores, miId],
  )

  const valor = useMemo(() => ({
    miId, puede, cargado,
    jugadores, otros, canales, online,
    mensajesDe: (id) => mensajes[id] ?? null,
    cargarMensajes, enviar, marcarLeido, abrirDM, mirando, alAvisarDe,
    sinLeer, sinLeerDe,
    estaOnline: (id) => online.includes(id),
  }), [
    miId, puede, cargado, jugadores, otros, canales, online, mensajes,
    cargarMensajes, enviar, marcarLeido, abrirDM, mirando, alAvisarDe, sinLeer, sinLeerDe,
  ])

  return <ChatContext.Provider value={valor}>{children}</ChatContext.Provider>
}

export function useChat() {
  return useContext(ChatContext)
}

// El nombre con el que se enseña una conversación: el de la otra persona si es
// un uno a uno, y "El club" para el canal de todos — `club-general` es el
// nombre técnico de la tabla, no algo que deba leer nadie.
export function nombreDeCanal(canal) {
  if (!canal) return ''
  if (canal.type === 'dm') return canal.other_player?.name || 'Alguien'
  if (canal.name === CANAL_DEL_CLUB) return 'El club'
  return canal.name
}

// Las conversaciones ordenadas como se miran: la del club siempre arriba (es
// la de todos, y la que más se usa), y debajo las personales por lo último que
// se dijo. Las que nunca han tenido mensaje van al final, por nombre.
export function ordenarCanales(canales) {
  const club = canales.filter(c => c.type !== 'dm')
  const dms = [...canales.filter(c => c.type === 'dm')].sort((a, b) => {
    if (a.last_message_at && b.last_message_at) return b.last_message_at.localeCompare(a.last_message_at)
    if (a.last_message_at) return -1
    if (b.last_message_at) return 1
    return nombreDeCanal(a).localeCompare(nombreDeCanal(b), 'es')
  })
  return [...club, ...dms]
}
