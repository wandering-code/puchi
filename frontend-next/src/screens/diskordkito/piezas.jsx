import { motion } from 'motion/react'
import Avatar from '../../ui/Avatar'

// Las piezas del chat. Lo que las hace no parecerse a Discord:
//
// Discord pinta cada mensaje como una FILA de un registro —avatar, nombre,
// hora, texto, todo alineado a la izquierda— porque está pensado para leer
// cientos de mensajes de gente que no conoces. Aquí sois cinco. Lo que se
// necesita no es un registro, es una conversación: burbujas, lo tuyo a un lado
// y lo de los demás al otro, agrupadas por persona y por rato. Se lee de un
// vistazo quién dice qué sin repetir el nombre catorce veces.

// Dos mensajes seguidos de la misma persona y en el mismo rato son un bloque:
// el nombre y la cara salen una vez, arriba del todo, y el resto son burbujas
// a secas. Cinco minutos es lo que separa "sigue hablando" de "ha vuelto".
const MISMO_RATO_MS = 5 * 60 * 1000

export function agruparMensajes(mensajes) {
  const bloques = []
  let dia = null

  for (const m of mensajes) {
    const fecha = new Date(m.created_at)
    const diaDeEste = fecha.toDateString()
    // Cambio de día: su propia marca, que si no una conversación de meses se
    // lee como si todo hubiera pasado esta tarde.
    if (diaDeEste !== dia) {
      dia = diaDeEste
      bloques.push({ tipo: 'dia', id: `dia-${diaDeEste}`, fecha })
    }

    const ultimo = bloques[bloques.length - 1]
    const sigue = ultimo?.tipo === 'bloque'
      && ultimo.autorId === m.player_id
      && fecha - new Date(ultimo.ultimaFecha) < MISMO_RATO_MS

    if (sigue) {
      ultimo.mensajes.push(m)
      ultimo.ultimaFecha = m.created_at
    } else {
      bloques.push({
        tipo: 'bloque',
        id: `b-${m.id}`,
        autorId: m.player_id,
        autor: {
          id: m.player_id, name: m.player_name, color: m.player_color,
          avatar_emoji: m.player_emoji, avatar_url: m.player_avatar_url,
        },
        mensajes: [m],
        ultimaFecha: m.created_at,
      })
    }
  }
  return bloques
}

export function SeparadorDeDia({ fecha }) {
  return (
    <div className="my-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-line" />
      <span className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-ink-mute">
        {etiquetaDeDia(fecha)}
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

function etiquetaDeDia(fecha) {
  const hoy = new Date()
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1)
  if (fecha.toDateString() === hoy.toDateString()) return 'Hoy'
  if (fecha.toDateString() === ayer.toDateString()) return 'Ayer'
  const esteAno = fecha.getFullYear() === hoy.getFullYear()
  return fecha.toLocaleDateString('es', {
    weekday: 'long', day: 'numeric', month: 'long',
    ...(esteAno ? {} : { year: 'numeric' }),
  })
}

export function hora(iso) {
  return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
}

// Un bloque de mensajes de la misma persona.
//
// `conNombre` solo en las conversaciones de varios: en un uno a uno solo
// podéis ser dos, y repetir el nombre de la otra persona en cada bloque es
// ruido puro.
export function BloqueDeMensajes({ bloque, mio, conNombre, nuevo = false }) {
  const { autor, mensajes } = bloque
  return (
    <div className={`mt-3 flex gap-2 ${mio ? 'flex-row-reverse' : ''}`}>
      {/* La cara solo en lo ajeno: en lo tuyo ya sabes quién eres, y ocupa un
          hueco que le viene mejor al texto. */}
      {!mio && <Avatar jugador={autor} size={28} className="mt-auto" />}

      <div className={`flex min-w-0 flex-col gap-1 ${mio ? 'items-end' : 'items-start'}`}>
        {conNombre && !mio && (
          <span className="px-1 text-[11px] font-semibold" style={{ color: autor.color || 'var(--color-ink-dim)' }}>
            {autor.name}
          </span>
        )}

        {mensajes.map((m, i) => (
          <Burbuja
            key={m.id}
            mensaje={m}
            mio={mio}
            primera={i === 0}
            ultima={i === mensajes.length - 1}
            nuevo={nuevo && i === mensajes.length - 1}
          />
        ))}
      </div>
    </div>
  )
}

// La burbuja. El redondeo cuenta de quién es: la esquina que mira a su dueño
// se queda pequeña en el medio del bloque, y así un bloque de cuatro mensajes
// se lee como una sola pieza en vez de como cuatro pastillas sueltas.
function Burbuja({ mensaje, mio, primera, ultima, nuevo }) {
  const esquinas = mio
    ? `rounded-2xl ${primera ? '' : 'rounded-tr-md'} ${ultima ? '' : 'rounded-br-md'}`
    : `rounded-2xl ${primera ? '' : 'rounded-tl-md'} ${ultima ? '' : 'rounded-bl-md'}`

  return (
    <motion.div
      // Solo el que acaba de llegar se anima. Sin esto, abrir una conversación
      // con doscientos mensajes los anima todos a la vez y entra a tirones.
      initial={nuevo ? { opacity: 0, y: 8, scale: 0.96 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className={`max-w-[78%] px-3.5 py-2 ${esquinas} ${
        mio
          ? 'bg-accent text-on-accent'
          : 'border border-line bg-surface text-ink'
      }`}
    >
      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{mensaje.content}</p>
      {/* La hora solo en el último del bloque: en cada burbuja es ruido, y sin
          ella no se sabe de cuándo es nada. */}
      {ultima && (
        <p className={`mt-0.5 text-right text-[10px] tabular-nums ${mio ? 'text-on-accent/60' : 'text-ink-mute'}`}>
          {hora(mensaje.created_at)}
        </p>
      )}
    </motion.div>
  )
}

// El punto verde de quien está conectado. Con borde del color del fondo para
// que se recorte contra la cara que hay debajo.
export function PuntoConectado({ className = '' }) {
  return (
    <span
      className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-bg bg-read ${className}`}
      aria-label="Conectado"
    />
  )
}
