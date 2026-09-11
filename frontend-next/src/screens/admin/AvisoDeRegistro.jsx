import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAvisos } from '../../platform/avisos'
import { esAdmin, useAuth } from '../../platform/auth'
import { usePendientes } from '../../platform/pendientes'
import Avatar from '../../ui/Avatar'

// "Alguien quiere entrar en Puchi".
//
// Es de la clase "que espera": no se va sola. Una cuenta pendiente no es una
// novedad que se lee y se olvida — hay alguien al otro lado que no puede entrar
// hasta que alguien mire esto, y un aviso que se desvanece a los cinco segundos
// mientras estás en otra cosa es un aviso que no ha existido.
//
// Tocarla lleva a Administración, que es donde se resuelve.

export default function AvisoDeRegistro() {
  const { player } = useAuth()
  const { mostrar, cerrar } = useAvisos()
  const { recontar } = usePendientes()
  const navegar = useNavigate()
  const admin = esAdmin(player)

  useEffect(() => {
    if (!admin) return
    function alRecibir(ev) {
      const msg = ev.detail
      if (msg?.type !== 'cuenta_pendiente') return
      const quien = msg.player
      // Por si el aviso llega antes que el recuento: el número del menú tiene
      // que subir a la vez que sale la tarjeta, no al recargar.
      recontar()
      mostrar({
        // Una clave por persona: si se registran dos seguidos, salen las dos
        // tarjetas. No es como los mensajes de una misma conversación, donde
        // lo último sustituye a lo anterior — aquí cada una es alguien
        // distinto esperando.
        clave: `registro-${quien?.id}`,
        espera: true,
        color: quien?.color,
        titulo: `${quien?.name} quiere entrar`,
        texto: 'Cuenta nueva, pendiente de aprobación',
        icono: <Avatar jugador={quien} size={44} />,
        acciones: (
          <button
            onClick={() => { cerrar(`registro-${quien?.id}`); navegar('/admin') }}
            className="h-11 w-full rounded-xl2 bg-accent text-sm font-semibold text-on-accent"
          >
            Ver en Administración
          </button>
        ),
      })
    }
    window.addEventListener('puchi:ws', alRecibir)
    return () => window.removeEventListener('puchi:ws', alRecibir)
  }, [admin, mostrar, cerrar, navegar, recontar])

  return null
}
