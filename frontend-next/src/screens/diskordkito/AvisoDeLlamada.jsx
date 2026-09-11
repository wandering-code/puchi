import { useEffect, useRef } from 'react'
import { useAvisos } from '../../platform/avisos'
import { useChat } from '../../platform/chat'
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
  const { estado, conQuien, tipo, enOtroSitio, aceptar, rechazar, traerAqui, grupo } = useLlamadas()
  const { jugadores, miId } = useChat() || {}
  const { mostrar, cerrar } = useAvisos()
  // Los ids de los avisos puestos, para poder quitarlos cuando toca.
  const puesto = useRef({ entrante: null, otroSitio: null, grupo: null })

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

  // ── Alguien ha abierto la llamada del club ────────────────────────────────
  // Suena a todo el club conectado, pero solo cuando la llamada ARRANCA de cero
  // (lo decide el backend): si no, cada persona que entra haría sonar el
  // teléfono de todos los demás otra vez.
  //
  // Ignorarla no cierra nada: la llamada sigue ahí y se puede entrar después
  // desde la conversación del club. Por eso, a diferencia de la de uno a uno,
  // esta sí se puede apartar.
  useEffect(() => {
    if (!grupo.entrante || grupo.dentro) {
      if (puesto.current.grupo) { cerrar(puesto.current.grupo); puesto.current.grupo = null }
      return
    }
    const quien = grupo.entrante.quien
    puesto.current.grupo = mostrar({
      clave: 'llamada-del-club',
      espera: true,
      color: quien?.color,
      titulo: `${quien?.name} ha abierto una llamada`,
      texto: 'En el club',
      icono: <Avatar jugador={quien} size={44} />,
      acciones: (
        <>
          <button
            onClick={() => { grupo.descartarEntrante(); cerrar('llamada-del-club') }}
            className="h-11 flex-1 rounded-xl2 border border-line text-sm text-ink-dim"
          >
            Ahora no
          </button>
          <button
            onClick={() => { grupo.entrar(grupo.entrante.tipo); cerrar('llamada-del-club') }}
            className="flex h-11 flex-[1.3] items-center justify-center gap-2 rounded-xl2 bg-read text-sm font-semibold text-white"
          >
            {grupo.entrante.tipo === 'video' ? <IconVideoCamara className="h-[18px] w-[18px]" /> : <IconTelefono className="h-[18px] w-[18px]" />}
            Entrar
          </button>
        </>
      ),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupo.entrante, grupo.dentro, mostrar, cerrar])

  // ── Alguien se ha unido a la llamada del club ─────────────────────────────
  // El backend solo hace sonar el timbre cuando la llamada ARRANCA de cero: si
  // sonara con cada persona que entra, una llamada de cinco daría cuatro
  // timbrazos a todo el mundo. Pero enterarse de quién va entrando sí interesa,
  // y eso se puede saber aquí sin tocar el servidor — la lista de quién está
  // dentro ya llega a todo el club, entre y salga quien sea.
  //
  // Se avisa distinto según dónde estés:
  //
  // - **Dentro de la llamada**: un aviso de paso, "Sofía se ha unido". No lleva
  //   botones: ya estás dentro, no hay nada que decidir.
  //
  // - **Fuera**: con un botón para entrar. Es el caso que faltaba de verdad —
  //   si no estabas cuando arrancó, hasta ahora no te enterabas de nada.
  const idsPrevios = useRef(null)
  useEffect(() => {
    const ahora = grupo.ids
    const antes = idsPrevios.current
    idsPrevios.current = ahora

    // La primera vez no se avisa de nadie: son los que ya estaban, no gente
    // que acabe de entrar.
    if (antes === null) return

    const nuevos = ahora.filter(id => !antes.includes(id) && id !== miId)
    if (!nuevos.length) return
    // Si la llamada acaba de arrancar, de eso ya avisa el timbre de arriba.
    if (!antes.length) return

    const quienes = nuevos.map(id => (jugadores || []).find(p => p.id === id)).filter(Boolean)
    if (!quienes.length) return

    const nombres = quienes.map(p => p.name)
    const titulo = nombres.length === 1
      ? `${nombres[0]} se ha unido`
      : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)} se han unido`

    mostrar({
      clave: 'alguien-entra-al-club',
      color: quienes[0].color,
      titulo,
      texto: grupo.dentro ? 'A la llamada del club' : `Llamada del club · ${ahora.length} dentro`,
      icono: <Avatar jugador={quienes[0]} size={38} />,
      // Fuera de la llamada, el aviso sirve para entrar. Dentro, solo informa.
      ...(grupo.dentro ? {} : { onTocar: () => grupo.entrar(grupo.tipo) }),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupo.ids, grupo.dentro, miId, jugadores, mostrar])

  return null
}
