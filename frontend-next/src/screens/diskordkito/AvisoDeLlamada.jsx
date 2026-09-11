import { useEffect, useRef } from 'react'
import { useAvisos } from '../../platform/avisos'
import { useLlamadas } from '../../platform/llamadas'
import Avatar from '../../ui/Avatar'
import { IconColgar, IconTelefono, IconVideoCamara } from '../../ui/icons'

// La llamada entrante, y el aviso de que tienes una en otro dispositivo.
//
// Usa la misma capa de avisos que los mensajes, pero de la clase "que espera":
// no se va sola ni se aparta arrastrando. Una llamada perdida por un gesto sin
// querer es peor que una tarjeta que insiste — y quien llama sabe si le has
// colgado o si no lo has visto.
//
// No es un modal gris a pantalla completa. Baja como un aviso más, teñida del
// color de quien llama, y deja ver lo que estabas haciendo. Si la coges, el
// escenario ya viene detrás.

export default function AvisoDeLlamada() {
  const { estado, conQuien, tipo, enOtroSitio, aceptar, rechazar, traerAqui } = useLlamadas()
  const { mostrar, cerrar } = useAvisos()
  // Los ids de los avisos puestos, para poder quitarlos cuando toca.
  const puesto = useRef({ entrante: null, otroSitio: null })

  // ── Llamada entrante ──────────────────────────────────────────────────────
  useEffect(() => {
    if (estado !== 'entrante' || !conQuien) {
      if (puesto.current.entrante) { cerrar(puesto.current.entrante); puesto.current.entrante = null }
      return
    }
    puesto.current.entrante = mostrar({
      clave: 'llamada-entrante',
      espera: true,
      color: conQuien.color,
      titulo: conQuien.name,
      texto: tipo === 'video' ? 'Te llama con vídeo' : 'Te llama',
      icono: (
        <span className="relative">
          <Avatar jugador={conQuien} size={44} />
          {/* Un aro que late: un aviso que solo estuviera ahí quieto se
              confunde con el de un mensaje. */}
          <span className="absolute -inset-1 animate-ping rounded-full border border-accent/50" />
        </span>
      ),
      acciones: (
        <>
          <button
            onClick={() => { rechazar(); cerrar('llamada-entrante') }}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl2 border border-line text-sm font-semibold text-danger"
          >
            <IconColgar className="h-[18px] w-[18px]" />
            Ahora no
          </button>
          <button
            onClick={() => { aceptar(); cerrar('llamada-entrante') }}
            className="flex h-11 flex-[1.3] items-center justify-center gap-2 rounded-xl2 bg-read text-sm font-semibold text-white"
          >
            {tipo === 'video' ? <IconVideoCamara className="h-[18px] w-[18px]" /> : <IconTelefono className="h-[18px] w-[18px]" />}
            Contestar
          </button>
        </>
      ),
    })
  }, [estado, conQuien, tipo, mostrar, cerrar, aceptar, rechazar])

  // ── La misma llamada, en otro de tus cacharros ────────────────────────────
  // Sale al conectar si ya la tenías puesta en el móvil y abres el portátil.
  // "Traerla aquí" no traspasa la conexión (eso no existe en WebRTC): el
  // dispositivo viejo cuelga sin avisar al otro, y este monta la llamada de
  // nuevo sin que al interlocutor le suene nada.
  useEffect(() => {
    if (!enOtroSitio) {
      if (puesto.current.otroSitio) { cerrar(puesto.current.otroSitio); puesto.current.otroSitio = null }
      return
    }
    puesto.current.otroSitio = mostrar({
      clave: 'llamada-en-otro-sitio',
      espera: true,
      color: enOtroSitio.quien?.color,
      titulo: `Estás hablando con ${enOtroSitio.quien?.name}`,
      texto: 'En otro de tus dispositivos',
      icono: <Avatar jugador={enOtroSitio.quien} size={38} />,
      acciones: (
        <button
          onClick={() => { traerAqui(); cerrar('llamada-en-otro-sitio') }}
          className="h-10 w-full rounded-xl2 bg-accent text-sm font-semibold text-on-accent"
        >
          Seguirla aquí
        </button>
      ),
    })
  }, [enOtroSitio, mostrar, cerrar, traerAqui])

  return null
}
