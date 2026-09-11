import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAvisos } from '../../platform/avisos'
import { CANAL_DEL_CLUB, useChat } from '../../platform/chat'
import Avatar from '../../ui/Avatar'

// El puente entre "ha llegado un mensaje" y "sale un aviso".
//
// Está aparte del motor del chat a propósito: el motor no sabe de pantallas ni
// de rutas, solo de datos. Quien decide que un mensaje merece un aviso, cómo se
// ve y a dónde lleva al tocarlo es esto, que sí vive dentro del router.
//
// No pinta nada por sí mismo. Se monta una vez, arriba, y ahí se queda.

export default function AvisosDeMensaje() {
  const { alAvisarDe, canales } = useChat()
  const { mostrar } = useAvisos()
  const navegar = useNavigate()
  const location = useLocation()

  useEffect(() => {
    alAvisarDe((msg) => {
      const canal = canales.find(c => c.id === msg.channel_id)
      const delClub = canal && canal.type !== 'dm'
      const quien = {
        id: msg.player_id, name: msg.player_name, color: msg.player_color,
        avatar_emoji: msg.player_emoji, avatar_url: msg.player_avatar_url,
      }

      mostrar({
        // Una clave por conversación: si alguien manda tres mensajes seguidos
        // no salen tres tarjetas, se actualiza la misma con lo último.
        clave: `mensaje-${msg.channel_id}`,
        color: msg.player_color,
        // En el canal de todos hace falta decir de dónde viene; en un uno a uno
        // el nombre de quien escribe ya lo dice todo.
        titulo: delClub ? `${msg.player_name} · en el club` : msg.player_name,
        texto: msg.content,
        icono: <Avatar jugador={quien} size={38} />,
        onTocar: () => {
          // Si ya se está en Diskordkito, tocar el aviso no tiene que
          // renavegar: la pantalla se queda como está y solo se abre esa
          // conversación. Se pide por la URL para que la pantalla la abra al
          // montarse o al verla cambiar.
          const destino = `/diskordkito?conversacion=${msg.channel_id}`
          navegar(destino, { replace: location.pathname === '/diskordkito' })
        },
      })
    })
    return () => alAvisarDe(null)
  }, [alAvisarDe, canales, mostrar, navegar, location.pathname])

  return null
}
