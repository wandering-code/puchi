import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '../../platform/auth'
import { CANAL_DEL_CLUB, nombreDeCanal, ordenarCanales, useChat } from '../../platform/chat'
import { useCapa } from '../../platform/capas'
import Avatar from '../../ui/Avatar'
import { IconChat, IconClub } from '../../ui/icons'
import { PuntoConectado, hora } from './piezas'
import Conversacion from './Conversacion'

// Diskordkito, rehecho.
//
// El reparto de Discord —una columna de servidores, otra de canales, y el chat
// en lo que queda— está pensado para tener catorce sitios a la vista a la vez.
// Aquí sois cinco y se entra desde el móvil. Así que no hay barra lateral: esto
// es una pantalla de lista, como la Luniteca o la Actividad, y una conversación
// es algo que se abre encima y se cierra, como la ficha de un libro.
//
// Lo primero de la pantalla no son los canales: es **quién está conectado**.
// Discord esconde eso en una columna de la derecha que en el móvil no existe, y
// es justo el dato que decide si escribes o llamas. Aquí son caras grandes, y
// tocar una abre su conversación.

export default function Diskordkito() {
  const { player } = useAuth()
  const chat = useChat()
  const { cargado, canales, otros, estaOnline, sinLeerDe, abrirDM } = chat
  const conversacion = useCapa(null)   // el id del canal abierto, o null
  const [abriendo, setAbriendo] = useState(null)
  const [error, setError] = useState(null)

  // Llegar aquí con ?conversacion=ID abre esa conversación: es lo que hace el
  // aviso de un mensaje nuevo al tocarlo, desde donde sea que estuvieras.
  //
  // A diferencia del ?libro= de la Luniteca, esto NO es de una sola vez: ya
  // estando aquí puede llegar otro aviso de otra conversación, y tocarlo tiene
  // que llevar a esa. Se vacía el parámetro después para que cerrar y volver no
  // la reabra.
  const [params, setParams] = useSearchParams()
  const pedida = params.get('conversacion')
  useEffect(() => {
    if (!pedida) return
    conversacion.reemplazar(Number(pedida))
    setParams(p => { const q = new URLSearchParams(p); q.delete('conversacion'); return q }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedida])

  const ordenados = useMemo(() => ordenarCanales(canales), [canales])
  const canalDelClub = ordenados.find(c => c.type !== 'dm')
  const personales = ordenados.filter(c => c.type === 'dm')

  // Quién tiene ya conversación abierta, para no ofrecer dos caminos al mismo
  // sitio en la fila de caras.
  const conConversacion = useMemo(
    () => new Set(personales.map(c => c.other_player?.id)),
    [personales],
  )

  const escribirA = useCallback(async (otro) => {
    setAbriendo(otro.id); setError(null)
    try {
      conversacion.abrir(await abrirDM(otro.id))
    } catch (err) {
      // Lo normal: esa persona ha dejado de ser del club mientras esta pantalla
      // estaba abierta. Antes fallaba en silencio.
      setError(err.status === 404 || err.status === 403
        ? `${otro.name} ya no está en el club.`
        : (err.message || 'No se ha podido abrir la conversación'))
    } finally {
      setAbriendo(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirDM])

  if (!player?.club_member) return <SinAcceso />
  if (!cargado) return <Cargando />

  const conectados = otros.filter(p => estaOnline(p.id))
  const desconectados = otros.filter(p => !estaOnline(p.id))

  return (
    <div className="py-6">
      <header className="mb-5">
        <h2 className="font-display text-[1.75rem] font-bold tracking-[-0.02em]">Diskordkito</h2>
        <p className="mt-1 text-sm text-ink-dim">
          {conectados.length
            ? `${conectados.length} ${conectados.length === 1 ? 'persona conectada' : 'personas conectadas'} ahora mismo`
            : 'No hay nadie conectado ahora mismo'}
        </p>
      </header>

      {/* ── Quién anda por aquí ────────────────────────────────────────────
          Caras grandes y en fila, los conectados primero. Es lo primero que se
          mira al entrar y el atajo para escribir a alguien sin buscarlo en una
          lista. */}
      <section className="mb-6">
        <h3 className="mb-2.5 text-[11px] uppercase tracking-[0.14em] text-ink-mute">Quién anda por aquí</h3>
        {/* Se desplaza de lado y se sale por los bordes de la pantalla a
            propósito: así se ve que hay más gente a los lados sin meter una
            flecha ni recortar las caras contra un borde duro. */}
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
          {[...conectados, ...desconectados].map(p => (
            <BotonPersona
              key={p.id}
              persona={p}
              conectada={estaOnline(p.id)}
              yaHablais={conConversacion.has(p.id)}
              abriendo={abriendo === p.id}
              onTocar={() => escribirA(p)}
            />
          ))}
          {otros.length === 0 && (
            <p className="py-2 text-sm text-ink-mute">Todavía no hay nadie más en el club.</p>
          )}
        </div>
      </section>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 text-sm text-danger"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* ── El canal de todos ──────────────────────────────────────────────
          En su propia tarjeta ancha y con el color de la app: no es "un canal
          más de una lista", es donde habla el club entero. */}
      {canalDelClub && (
        <section className="mb-6">
          <TarjetaDelClub
            canal={canalDelClub}
            sinLeer={sinLeerDe(canalDelClub)}
            onTocar={() => conversacion.abrir(canalDelClub.id)}
          />
        </section>
      )}

      {/* ── Conversaciones ─────────────────────────────────────────────── */}
      <section>
        <h3 className="mb-1 text-[11px] uppercase tracking-[0.14em] text-ink-mute">Conversaciones</h3>
        {personales.length === 0 ? (
          <p className="py-6 text-sm leading-relaxed text-ink-mute">
            Ninguna todavía. Toca una cara de arriba para empezar.
          </p>
        ) : (
          <div className="divide-y divide-[color:var(--color-line)]">
            {personales.map(canal => (
              <FilaConversacion
                key={canal.id}
                canal={canal}
                conectada={estaOnline(canal.other_player?.id)}
                sinLeer={sinLeerDe(canal)}
                onTocar={() => conversacion.abrir(canal.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* La conversación se monta solo cuando hace falta y se desmonta al
          cerrarse: aquí no hay nada que "premontar" como en la ficha de un
          libro, porque no se abren cincuenta seguidas. */}
      <AnimatePresence>
        {conversacion.abierta != null && (
          <Conversacion
            canalId={conversacion.abierta}
            abierta
            onCerrar={conversacion.cerrar}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// Una cara de la fila de arriba. El aro dice si está conectada; el punto verde
// lo confirma sin depender solo del color, que en oscuro se lee peor.
function BotonPersona({ persona, conectada, yaHablais, abriendo, onTocar }) {
  return (
    <motion.button
      onClick={onTocar}
      whileTap={{ scale: 0.94 }}
      className="flex w-[68px] shrink-0 flex-col items-center gap-1.5"
      aria-label={`Escribir a ${persona.name}`}
    >
      <span
        className={`relative flex items-center justify-center rounded-full p-[3px] transition-opacity ${conectada ? '' : 'opacity-55'}`}
        style={{ background: conectada ? `color-mix(in srgb, ${persona.color || 'var(--color-accent)'} 60%, transparent)` : 'transparent' }}
      >
        <Avatar jugador={persona} size={52} />
        {conectada && <PuntoConectado />}
        {abriendo && (
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-accent"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </span>
      <span className={`w-full truncate text-center text-[11px] ${conectada ? 'text-ink' : 'text-ink-mute'}`}>
        {persona.name}
      </span>
      {/* Un punto pequeñito para quien ya tiene conversación: evita la duda de
          "¿esto crea una nueva o abre la que ya teníamos?". */}
      {yaHablais && <span className="-mt-1 h-1 w-1 rounded-full bg-ink-mute/50" aria-hidden />}
    </motion.button>
  )
}

function TarjetaDelClub({ canal, sinLeer, onTocar }) {
  return (
    <motion.button
      onClick={onTocar}
      whileTap={{ scale: 0.99 }}
      className="flex w-full items-center gap-3.5 rounded-xl3 border border-accent-line bg-accent-soft p-4 text-left"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl2 bg-accent text-on-accent">
        <IconClub className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-display text-lg font-bold leading-tight text-accent">El club</span>
          {sinLeer && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Sin leer" />}
        </span>
        <span className="mt-0.5 block text-[13px] text-accent/75">
          {canal.last_message_at ? `Última vez, ${cuando(canal.last_message_at)}` : 'Donde habla todo el club'}
        </span>
      </span>
    </motion.button>
  )
}

function FilaConversacion({ canal, conectada, sinLeer, onTocar }) {
  const otro = canal.other_player
  return (
    <button onClick={onTocar} className="flex w-full items-center gap-3 py-3 text-left transition-transform duration-150 active:scale-[0.99]">
      <span className="relative shrink-0">
        <Avatar jugador={otro} size={42} />
        {conectada && <PuntoConectado />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate ${sinLeer ? 'font-semibold text-ink' : 'text-ink'}`}>
          {nombreDeCanal(canal)}
        </span>
        <span className="mt-0.5 block truncate text-xs text-ink-mute">
          {canal.last_message_at ? cuando(canal.last_message_at) : 'Sin mensajes todavía'}
        </span>
      </span>
      {sinLeer && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-label="Sin leer" />}
    </button>
  )
}

// "a las 19:32" si es de hoy, "ayer", el día de la semana si es de esta semana,
// y la fecha si es más viejo. Lo que diría una persona, no una marca de tiempo.
function cuando(iso) {
  const fecha = new Date(iso)
  const ahora = new Date()
  if (fecha.toDateString() === ahora.toDateString()) return `a las ${hora(iso)}`
  const ayer = new Date(ahora); ayer.setDate(ahora.getDate() - 1)
  if (fecha.toDateString() === ayer.toDateString()) return 'ayer'
  if (ahora - fecha < 6 * 24 * 3600 * 1000) return fecha.toLocaleDateString('es', { weekday: 'long' })
  return fecha.toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

function Cargando() {
  return (
    <div className="py-6">
      <div className="h-8 w-48 animate-pulse rounded-md bg-surface-2" />
      <div className="mt-6 flex gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[52px] w-[52px] shrink-0 animate-pulse rounded-full bg-surface-2" />
        ))}
      </div>
      <div className="mt-6 h-20 animate-pulse rounded-xl3 bg-surface-2" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl2 bg-surface-2" />
        ))}
      </div>
    </div>
  )
}

function SinAcceso() {
  return (
    <div className="py-8">
      <h2 className="font-display text-[1.75rem] font-bold tracking-[-0.02em]">Diskordkito</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-dim">
        Hablar por aquí es cosa del club de lectura. Si crees que deberías estar, pídeselo al admin.
      </p>
    </div>
  )
}
