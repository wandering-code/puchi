import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../../platform/api'
import { useAuth } from '../../platform/auth'
import { useLiveUpdates } from '../../platform/live'
import { Cover, StarRating } from '../luniteca/piezas'

// Lo que va pasando en las estanterías de todos: quién añade, empieza o
// termina un libro.
//
// Es una sección propia y no una pestaña de Luniteca a propósito: Luniteca es
// TU estantería y esto es de todos. Comparten la ficha del libro, que es lo
// que las mantiene unidas sin mezclarlas.
//
// El backend ya decide qué se ve: /activity/feed devuelve la actividad de
// estantería a cualquiera y esconde lo del club (propuestas y votos) a quien
// no es socio. Aquí no hay que filtrar nada.

const POR_PAGINA = 50

// "vez" es femenino, así que los ordinales van en femenino. Solo hace falta
// distinguir la relectura: la primera vez no dice nada especial.
const ORDINALES = { 2: 'segunda', 3: 'tercera', 4: 'cuarta', 5: 'quinta', 6: 'sexta', 7: 'séptima', 8: 'octava', 9: 'novena', 10: 'décima' }

function frase({ event_type, book, times_read }) {
  const titulo = <em className="not-italic font-medium text-ink">«{book?.title || '?'}»</em>
  switch (event_type) {
    case 'added':    return <>añadió {titulo} a su estantería</>
    case 'started':  return <>empezó a leer {titulo}</>
    case 'finished': return <>terminó {titulo}{times_read >= 2 && <> por {ORDINALES[times_read] || `${times_read}ª`} vez</>}</>
    case 'proposed': return <>propuso {titulo} al club</>
    case 'voted':    return <>puntuó {titulo} del club</>
    default:         return <>{event_type}</>
  }
}

function haceCuanto(iso) {
  if (!iso) return ''
  const seg = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seg < 60) return 'ahora mismo'
  const min = Math.floor(seg / 60)
  if (min < 60) return `hace ${min} min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  const semanas = Math.floor(dias / 7)
  if (semanas < 5) return `hace ${semanas} ${semanas === 1 ? 'semana' : 'semanas'}`
  const meses = Math.floor(dias / 30)
  if (meses < 12) return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Actividad() {
  const { player } = useAuth()
  const [items, setItems] = useState(null)
  const [hayMas, setHayMas] = useState(false)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [error, setError] = useState(null)
  const [jugadores, setJugadores] = useState([])
  const [filtro, setFiltro] = useState(null)     // jugador por el que se filtra

  const cargar = useCallback(async (desde = 0, filtrarPor = filtro) => {
    const params = new URLSearchParams({ limit: String(POR_PAGINA), offset: String(desde) })
    if (filtrarPor) params.set('player_id', String(filtrarPor.id))
    const datos = await api(`/activity/feed?${params}`)
    setHayMas(datos.has_more)
    setItems(previos => (desde === 0 ? datos.items : [...(previos || []), ...datos.items]))
  }, [filtro])

  useEffect(() => {
    let vigente = true
    setItems(null)
    cargar(0).catch(e => { if (vigente) setError(e.message) })
    return () => { vigente = false }
  }, [cargar])

  useEffect(() => {
    api('/players').then(setJugadores).catch(() => {})
  }, [])

  // Lo que pasa en otro dispositivo aparece aquí sin recargar, igual que en la
  // estantería: cualquier cambio de estantería deja rastro en el feed.
  const refrescar = useCallback(() => { cargar(0).catch(() => {}) }, [cargar])
  useLiveUpdates(['shelf'], refrescar)

  const otros = jugadores.filter(j => j.id !== player?.id)

  return (
    <div className="py-6">
      <header className="mb-4">
        <h2 className="font-display text-[1.75rem] font-bold tracking-[-0.02em]">Actividad</h2>
        <p className="mt-2 text-sm text-ink-dim">
          {filtro ? `Solo lo de ${filtro.name}` : 'Lo que vais leyendo'}
        </p>
      </header>

      {/* Los demás, para filtrar por uno. Tú no estás: para lo tuyo ya está
          Luniteca. */}
      {otros.length > 0 && (
        <div className="-mx-5 mb-5 flex gap-3 overflow-x-auto px-5 pb-1">
          {otros.map(j => {
            const activo = filtro?.id === j.id
            return (
              <button
                key={j.id}
                onClick={() => setFiltro(activo ? null : { id: j.id, name: j.name })}
                className="flex w-14 shrink-0 flex-col items-center gap-1.5"
              >
                <span
                  className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 text-lg transition-colors"
                  style={{ borderColor: activo ? 'var(--color-accent)' : (j.color || 'var(--color-line)'), background: j.color || 'var(--color-surface-2)' }}
                >
                  {j.avatar_url
                    ? <img src={j.avatar_url} alt="" className="h-full w-full object-cover" />
                    : <span>{j.avatar_emoji || '⭐'}</span>}
                </span>
                <span className={`w-full truncate text-center text-[11px] ${activo ? 'text-accent' : 'text-ink-mute'}`}>{j.name}</span>
              </button>
            )
          })}
        </div>
      )}

      {error && <p className="rounded-xl2 border border-line bg-surface px-4 py-3 text-sm text-danger">{error}</p>}

      {items === null && !error && (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[70px] animate-pulse rounded-xl2 bg-surface-2" />
          ))}
        </div>
      )}

      {items?.length === 0 && (
        <p className="py-10 text-center text-sm text-ink-mute">
          {filtro ? `${filtro.name} no ha hecho nada por aquí todavía.` : 'Todavía no hay nada que contar.'}
        </p>
      )}

      <AnimatePresence initial={false}>
        <div className="space-y-2.5">
          {items?.map(item => {
            const tuyo = item.player?.id === player?.id
            return (
              <motion.article
                key={item.id}
                layout="position"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={`flex gap-3 rounded-xl2 border p-3 ${tuyo ? 'border-accent/30 bg-accent/5' : 'border-line bg-surface'}`}
              >
                <div className="w-9 shrink-0">
                  <Cover url={item.book?.cover_url} title={item.book?.title} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: item.player?.color || 'var(--color-ink-dim)' }}>
                    {item.player?.name || '?'}
                    {tuyo && <span className="rounded bg-surface-2 px-1.5 py-px text-[10px] font-normal text-ink-mute">tú</span>}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-snug text-ink-dim">{frase(item)}</p>
                  {item.rating > 0 && (item.event_type === 'finished' || item.event_type === 'voted') && (
                    <div className="mt-1"><StarRating rating={item.rating} /></div>
                  )}
                  <p className="mt-1 text-[11px] text-ink-mute">{haceCuanto(item.created_at)}</p>
                </div>
              </motion.article>
            )
          })}
        </div>
      </AnimatePresence>

      {hayMas && (
        <button
          onClick={async () => {
            setCargandoMas(true)
            await cargar(items?.length || 0).catch(() => {})
            setCargandoMas(false)
          }}
          disabled={cargandoMas}
          className="mx-auto mt-4 flex h-10 items-center rounded-xl2 border border-line bg-surface px-5 text-sm text-ink-dim disabled:opacity-50"
        >
          {cargandoMas ? 'Cargando…' : 'Ver más'}
        </button>
      )}
    </div>
  )
}
