import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '../../platform/auth'
import { nombreDeCanal, useChat } from '../../platform/chat'
import { useCapa } from '../../platform/capas'
import { usarPantallaAncha } from '../../ui/ancho'
import Avatar from '../../ui/Avatar'
import { IconChat, IconClub } from '../../ui/icons'
import { PuntoConectado, hora } from './piezas'
import Conversacion from './Conversacion'

// Diskordkito, rehecho.
//
// **Una sola lista, no tres bloques.** La primera versión tenía una fila de
// caras arriba ("quién anda por aquí"), la tarjeta del club, y debajo las
// conversaciones — y la misma persona salía DOS veces, como cara y como fila.
// Con cinco personas, la lista de gente y la de conversaciones son la misma
// lista. Así que aquí hay una: el club arriba, y debajo una fila por persona,
// esté o no esté empezada la conversación.
//
// **Dos columnas donde hay sitio.** El resto de Puchi se usa desde el móvil,
// pero para hablar se entra desde la tablet o el ordenador: ahí la conversación
// no tapa la lista, se pone al lado. En el móvil sigue abriéndose encima, como
// la ficha de un libro.
//
// Nada de esto es el reparto de Discord: no hay columna de servidores, ni árbol
// de canales, ni fondo oscuro. Es la misma hoja de papel que el resto de Puchi,
// con una lista a un lado.

export default function Diskordkito() {
  const { player } = useAuth()
  const { cargado, canales, otros, estaOnline, sinLeerDe, abrirDM, mensajesDe } = useChat()
  const ancha = usarPantallaAncha()

  // En una columna, la conversación es una capa (entra en el historial, y el
  // gesto de volver la cierra). En dos, es solo cuál está elegida: no hay nada
  // que cerrar, siempre hay una a la vista.
  const capa = useCapa(null)
  const [elegida, setElegida] = useState(null)
  const abierta = ancha ? elegida : capa.abierta

  const abrir = useCallback((canalId) => {
    if (ancha) setElegida(canalId)
    else capa.abrir(canalId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ancha, capa.abrir])

  const [abriendo, setAbriendo] = useState(null)
  const [error, setError] = useState(null)

  const canalDelClub = useMemo(() => canales.find(c => c.type !== 'dm'), [canales])

  // Una fila por persona del club, con su conversación si ya existe. Ordenadas
  // por lo último que se dijo; las que nunca han hablado, al final por nombre.
  const gente = useMemo(() => {
    const canalDe = new Map(canales.filter(c => c.type === 'dm').map(c => [c.other_player?.id, c]))
    return otros
      .map(persona => ({ persona, canal: canalDe.get(persona.id) || null }))
      .sort((a, b) => {
        const ma = a.canal?.last_message_at, mb = b.canal?.last_message_at
        if (ma && mb) return mb.localeCompare(ma)
        if (ma) return -1
        if (mb) return 1
        return a.persona.name.localeCompare(b.persona.name, 'es')
      })
  }, [canales, otros])

  // Llegar con ?conversacion=ID abre esa: es lo que hace el aviso de un mensaje
  // al tocarlo. No es de una sola vez — ya estando aquí puede llegar otro aviso
  // de otra conversación. Se vacía el parámetro después.
  const [params, setParams] = useSearchParams()
  const pedida = params.get('conversacion')
  useEffect(() => {
    if (!pedida) return
    const id = Number(pedida)
    if (ancha) setElegida(id)
    else capa.reemplazar(id)
    setParams(p => { const q = new URLSearchParams(p); q.delete('conversacion'); return q }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedida, ancha])

  // Con dos columnas nunca se está mirando el vacío: al entrar se abre el canal
  // del club, que es el que más se usa.
  useEffect(() => {
    if (ancha && elegida == null && canalDelClub) setElegida(canalDelClub.id)
  }, [ancha, elegida, canalDelClub])

  const hablarCon = useCallback(async ({ persona, canal }) => {
    if (canal) { abrir(canal.id); return }
    setAbriendo(persona.id); setError(null)
    try {
      abrir(await abrirDM(persona.id))
    } catch (err) {
      // Lo normal: esa persona ha dejado de ser del club mientras esta pantalla
      // estaba abierta. Antes fallaba en silencio.
      setError(err.status === 404 || err.status === 403
        ? `${persona.name} ya no está en el club.`
        : (err.message || 'No se ha podido abrir la conversación'))
    } finally {
      setAbriendo(null)
    }
  }, [abrir, abrirDM])

  if (!player?.club_member) return <SinAcceso />
  if (!cargado) return <Cargando />

  const conectados = otros.filter(p => estaOnline(p.id)).length

  const lista = (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {canalDelClub && (
        <FilaDelClub
          canal={canalDelClub}
          activa={abierta === canalDelClub.id}
          sinLeer={sinLeerDe(canalDelClub)}
          ultimo={ultimoDe(mensajesDe(canalDelClub.id), canalDelClub)}
          onTocar={() => abrir(canalDelClub.id)}
        />
      )}

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-1 py-2 text-sm text-danger"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {gente.length === 0 ? (
        <p className="px-1 py-6 text-sm leading-relaxed text-ink-mute">
          Todavía no hay nadie más en el club.
        </p>
      ) : (
        <div className="mt-1">
          {gente.map(fila => (
            <FilaPersona
              key={fila.persona.id}
              {...fila}
              activa={!!fila.canal && abierta === fila.canal.id}
              conectada={estaOnline(fila.persona.id)}
              sinLeer={!!fila.canal && sinLeerDe(fila.canal)}
              ultimo={ultimoDe(mensajesDe(fila.canal?.id), fila.canal)}
              abriendo={abriendo === fila.persona.id}
              onTocar={() => hablarCon(fila)}
            />
          ))}
        </div>
      )}
    </div>
  )

  // ── Dos columnas ────────────────────────────────────────────────────────
  if (ancha) {
    return (
      <div className="flex h-full min-h-0 flex-col py-5">
        <header className="mb-3 shrink-0">
          <h2 className="font-display text-[1.6rem] font-bold leading-none tracking-[-0.02em]">Diskordkito</h2>
          <p className="mt-1 text-sm text-ink-dim">{textoConectados(conectados)}</p>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(240px,300px)_1fr] gap-4">
          <div className="flex min-h-0 flex-col">{lista}</div>
          {abierta != null
            ? <Conversacion key={abierta} canalId={abierta} suelta />
            : <PanelVacio />}
        </div>
      </div>
    )
  }

  // ── Una columna ─────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0 flex-col py-6">
      <header className="mb-4 shrink-0">
        <h2 className="font-display text-[1.75rem] font-bold tracking-[-0.02em]">Diskordkito</h2>
        <p className="mt-1 text-sm text-ink-dim">{textoConectados(conectados)}</p>
      </header>

      {lista}

      <AnimatePresence>
        {capa.abierta != null && (
          <Conversacion canalId={capa.abierta} abierta onCerrar={capa.cerrar} />
        )}
      </AnimatePresence>
    </div>
  )
}

function textoConectados(n) {
  if (!n) return 'No hay nadie conectado ahora mismo'
  return `${n} ${n === 1 ? 'persona conectada' : 'personas conectadas'} ahora mismo`
}

// Lo último que se dijo, para la fila. Solo si esa conversación ya está
// cargada en memoria: no se piden los mensajes de todas solo para poder
// enseñar una línea — con `last_message_at` basta para decir CUÁNDO, y el qué
// aparece en cuanto se ha abierto una vez.
function ultimoDe(mensajes, canal) {
  if (!canal) return null
  const ultimo = mensajes?.[mensajes.length - 1]
  if (ultimo) return { texto: ultimo.content, cuando: cuando(ultimo.created_at) }
  if (canal.last_message_at) return { texto: null, cuando: cuando(canal.last_message_at) }
  return null
}

const FILA = 'flex w-full items-center gap-3 rounded-xl2 px-2 py-2.5 text-left transition-colors'

function FilaDelClub({ canal, activa, sinLeer, ultimo, onTocar }) {
  return (
    <button
      onClick={onTocar}
      className={`${FILA} ${activa ? 'bg-accent-soft' : 'active:bg-surface-2'}`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
        <IconClub className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-display font-bold ${activa ? 'text-accent' : 'text-ink'}`}>
          El club
        </span>
        <span className="mt-0.5 block truncate text-xs text-ink-mute">
          {ultimo?.texto || (ultimo ? `Última vez, ${ultimo.cuando}` : 'Donde habla todo el club')}
        </span>
      </span>
      {sinLeer && <Punto />}
    </button>
  )
}

// Una persona del club. Tenga conversación empezada o no: con cinco personas,
// "la gente" y "las conversaciones" son la misma lista, y tenerlas separadas
// hacía que la misma cara saliera dos veces en la misma pantalla.
function FilaPersona({ persona, canal, activa, conectada, sinLeer, ultimo, abriendo, onTocar }) {
  return (
    <button
      onClick={onTocar}
      className={`${FILA} ${activa ? 'bg-accent-soft' : 'active:bg-surface-2'} ${abriendo ? 'opacity-60' : ''}`}
    >
      <span className="relative shrink-0">
        <Avatar jugador={persona} size={44} />
        {conectada && <PuntoConectado />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate ${sinLeer ? 'font-semibold' : ''} ${activa ? 'text-accent' : 'text-ink'}`}>
          {persona.name}
        </span>
        <span className="mt-0.5 block truncate text-xs text-ink-mute">
          {ultimo?.texto
            || (ultimo ? `Última vez, ${ultimo.cuando}` : (conectada ? 'Conectada · sin mensajes' : 'Sin mensajes todavía'))}
        </span>
      </span>
      {sinLeer && <Punto />}
    </button>
  )
}

function Punto() {
  return <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-label="Sin leer" />
}

// Solo con dos columnas, y solo el instante que tarda en elegirse la primera.
function PanelVacio() {
  return (
    <div className="flex min-h-0 items-center justify-center rounded-xl3 border border-dashed border-line">
      <div className="px-8 text-center">
        <IconChat className="mx-auto h-8 w-8 text-ink-mute/50" />
        <p className="mt-3 text-sm text-ink-mute">Elige con quién hablar.</p>
      </div>
    </div>
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
      <div className="mt-6 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl2 bg-surface-2" />
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
