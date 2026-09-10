import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../../platform/api'
import { useAuth } from '../../platform/auth'
import { useLiveUpdates } from '../../platform/live'
import { EditableRating, StarRating } from '../luniteca/piezas'
import Avatar, { NombreJugador } from '../../ui/Avatar'

// Lo que le pareció a cada uno. No hay secreto ni "revelar": cada puntuación
// se ve en cuanto se pone, y se puede cambiar siempre. (El modelo del backend
// venía de una idea tipo Kahoot —voto oculto hasta que el admin lo destapa— y
// conserva ese campo sin usar; aquí se registra siempre como revelada, igual
// que hace la Puchi actual.)
//
// Solo para los libros que el club ya ha terminado: puntuar a mitad de lectura
// no dice nada, y ver las notas de los demás mientras lo estás leyendo cambia
// lo que opinas antes de opinar.

export default function Puntuaciones({ entradaId, onCambiado }) {
  const { player } = useAuth()
  const [votos, setVotos] = useState(null)     // null = cargando

  const cargar = useCallback(() => {
    api(`/shelf/club/${entradaId}/votes`)
      .then(setVotos)
      .catch(() => setVotos([]))
  }, [entradaId])

  useEffect(() => { setVotos(null); cargar() }, [cargar])

  // Alguien puntuando desde otro dispositivo (o desde la Puchi actual) aparece
  // aquí sin recargar. Solo las de ESTE libro: el aviso trae el club_shelf_id.
  useLiveUpdates(['votes'], useCallback(msg => {
    if (msg.club_shelf_id === entradaId) cargar()
  }, [cargar, entradaId]))

  const mio = votos?.find(v => v.player?.id === player?.id)
  const otros = (votos || []).filter(v => v.player?.id !== player?.id)
  const media = votos?.length
    ? Math.round((votos.reduce((n, v) => n + v.rating, 0) / votos.length) * 10) / 10
    : null

  // Optimista: la nota se ve puesta en cuanto sueltas el dedo. Si el servidor
  // la rechaza se vuelve a lo que había, que es lo que hace el resto de la app
  // al puntuar.
  async function puntuar(rating) {
    const anteriores = votos
    setVotos(prev => {
      const resto = (prev || []).filter(v => v.player?.id !== player?.id)
      return [...resto, { player, rating, voted_at: new Date().toISOString() }]
    })
    try {
      await api(`/shelf/club/${entradaId}/vote`, { method: 'POST', body: { rating } })
      cargar()
      // La media del club sale en la tarjeta y en la portada de la
      // cuadrícula, así que la lista de fuera también tiene que enterarse.
      onCambiado?.()
    } catch {
      setVotos(anteriores)
    }
  }

  return (
    <section className="mb-8">
      <div className="mb-2.5 flex items-center gap-2">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-ink-mute">
          Puntuaciones{votos?.length ? ` · ${votos.length}` : ''}
        </h3>
        <span className="h-px flex-1 bg-line" />
        <AnimatePresence initial={false}>
          {media != null && (
            <motion.span
              key={media}
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold tabular-nums text-accent"
            >
              {media.toLocaleString('es')} de media
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="overflow-hidden rounded-xl2 border border-line bg-surface">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Tu puntuación</p>
            <p className="mt-0.5 text-xs text-ink-mute">
              {mio ? 'Mantén pulsado para cambiarla' : 'Mantén pulsado y arrastra'}
            </p>
          </div>
          <EditableRating rating={mio?.rating || 0} onChange={puntuar} size={22} />
        </div>

        {votos === null && (
          <div className="border-t border-line px-4 py-3">
            <div className="h-4 w-32 animate-pulse rounded bg-surface-2" />
          </div>
        )}

        <AnimatePresence initial={false}>
          {otros.map(v => (
            <motion.div
              key={v.player.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-t border-line"
            >
              <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar jugador={v.player} size={22} />
                  <NombreJugador jugador={v.player} className="text-sm" />
                </div>
                <StarRating rating={v.rating} size={13} className="shrink-0" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {votos?.length === 0 && (
        <p className="mt-2 px-1 text-xs text-ink-mute">
          Nadie lo ha puntuado todavía. Sé el primero.
        </p>
      )}
    </section>
  )
}
