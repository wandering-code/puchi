import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../platform/api'
import { useAuth } from '../../platform/auth'
import { useLiveUpdates } from '../../platform/live'
import { Cover, StarRating } from '../luniteca/piezas'
import HojaInferior, { useHoja } from '../luniteca/HojaInferior'
import BookDetail from '../luniteca/BookDetail'
import { copiarAMiEstanteria } from '../luniteca/shelf'
import { IconBooks, IconFilter } from '../../ui/icons'

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
  const navegar = useNavigate()
  const [items, setItems] = useState(null)
  const [hayMas, setHayMas] = useState(false)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [error, setError] = useState(null)
  const [jugadores, setJugadores] = useState([])
  const [filtro, setFiltro] = useState(null)     // jugador por el que se filtra
  // Tocar la cara de alguien no hace una sola cosa: pregunta. Filtrar y entrar
  // en su estantería son igual de esperables desde ahí, y adivinar cuál quiere
  // el dedo acaba en la equivocada.
  const menu = useHoja(null)
  const setMenu = menu.abrir
  const quienEnMenu = menu.abierta
  // La ficha del libro de otra persona, abierta desde aquí mismo.
  const ficha = useHoja(null)
  const abierto = ficha.abierta
  // Igual que en la estantería: la ficha se queda montada con lo último que se
  // abrió, para no volver a construirla en la siguiente (ver PantallaInferior).
  const ultimaFicha = useRef(null)
  if (abierto) ultimaFicha.current = abierto
  const enFicha = abierto || ultimaFicha.current
  const [abriendo, setAbriendo] = useState(null)

  // El registro de ese libro: lo que esa persona tiene puesto (su puntuación,
  // sus fechas), no el libro en abstracto. Vale igual para el tuyo: tocar una
  // entrada lleva al libro y a nada más, sea de quien sea. Si el registro ya
  // no existe, se cae a la estantería, que es de donde salía la información.
  async function abrirElLibro(item, tuyo) {
    if (!item.book?.id || !item.player?.id) return
    const aDondeSiFalla = tuyo ? `/luniteca?libro=${item.book.id}` : `/quien/${item.player.id}?libro=${item.book.id}`
    setAbriendo(item.id)
    try {
      const lecturas = await api(`/books/${item.book.id}/lecturas`)
      const suya = lecturas.find(l => (l.player?.id ?? l.player_id) === item.player.id)
      if (suya) ficha.abrir({ entrada: suya, quien: tuyo ? null : item.player, tuyo })
      else navegar(aDondeSiFalla)
    } catch {
      navegar(aDondeSiFalla)
    } finally {
      setAbriendo(null)
    }
  }


  const cargar = useCallback(async (desde = 0, filtrarPor = filtro) => {
    const params = new URLSearchParams({ limit: String(POR_PAGINA), offset: String(desde) })
    if (filtrarPor) params.set('player_id', String(filtrarPor.id))
    const datos = await api(`/activity/feed?${params}`)
    setHayMas(datos.has_more)
    setItems(previos => (desde === 0 ? datos.items : [...(previos || []), ...datos.items]))
  }, [filtro])

  // Cambiar algo de tu propio registro sin salir de aquí. Mismo patrón que en
  // la estantería: se aplica al momento y se revierte si el servidor dice que
  // no, que para un cambio de estado o media estrella no se espera.
  const actualizarMiEntrada = useCallback(async (id, patch) => {
    let anterior = null
    ficha.reemplazar(prev => {
      if (prev?.entrada?.id !== id) return prev
      anterior = prev.entrada
      return { ...prev, entrada: { ...prev.entrada, ...patch } }
    })
    try {
      const fresca = await api(`/shelf/personal/${id}`, { method: 'PATCH', body: patch })
      ficha.reemplazar(prev => (prev?.entrada?.id === id ? { ...prev, entrada: fresca } : prev))
      // La actividad puede haber cambiado con esto (terminar un libro deja
      // rastro), así que se recarga por detrás.
      cargar(0).catch(() => {})
    } catch {
      if (anterior) ficha.reemplazar(prev => (prev?.entrada?.id === id ? { ...prev, entrada: anterior } : prev))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargar])

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
        {filtro && <p className="mt-2 text-sm text-ink-dim">Solo lo de {filtro.name}</p>}
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
                onClick={() => setMenu(j)}
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
              <motion.button
                key={item.id}
                layout="position"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => abrirElLibro(item, tuyo)}
                className={`flex w-full gap-3 rounded-xl2 border p-3 text-left transition-[transform,opacity] active:scale-[0.99] ${abriendo === item.id ? 'opacity-60' : ''} ${tuyo ? 'border-accent/30 bg-accent/5' : 'border-line bg-surface'}`}
              >
                {/* La entrada entera lleva al libro, se toque donde se toque.
                    Si es tuya, a tu registro en tu estantería; si es de otra
                    persona, a SU registro y nada más: se abre aquí encima sin
                    llevarte a su estantería, que es un sitio al que se va
                    queriendo (por su cara, arriba), no de rebote. */}
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
              </motion.button>
            )
          })}
        </div>
      </AnimatePresence>

      {enFicha && (
        <BookDetail
          entry={enFicha.entrada}
          abierta={!!abierto}
          carpetas={[]}
          generos={[]}
          soloLectura={!enFicha.tuyo}
          deQuien={enFicha.quien}
          onActualizar={enFicha.tuyo ? (patch => actualizarMiEntrada(enFicha.entrada.id, patch)) : undefined}
          onCerrar={ficha.cerrar}
          onGuardarEnMiEstanteria={enFicha.tuyo ? undefined : async () => {
            await copiarAMiEstanteria(enFicha.entrada.book)
            // Se cierra SIN tocar el historial y luego se navega: un cierre
            // normal pide un history.back() que llegaría después del pushState
            // del router y desharía la navegación (el mismo caso del menú
            // lateral, ver Shell.jsx).
            ficha.reemplazar(null)
            navegar('/luniteca')
          }}
        />
      )}

      <HojaInferior
        abierta={!!quienEnMenu}
        titulo={quienEnMenu?.name || ''}
        onCerrar={menu.cerrar}
      >
        <div className="flex flex-col divide-y divide-[color:var(--color-line)]">
          <button
            onClick={() => {
              setFiltro(filtro?.id === quienEnMenu.id ? null : { id: quienEnMenu.id, name: quienEnMenu.name })
              menu.cerrar()
            }}
            className="flex items-center gap-3 px-1 py-3.5 text-left"
          >
            <IconFilter className="h-5 w-5 shrink-0 text-ink-mute" />
            <span className="text-[15px]">
              {filtro?.id === quienEnMenu?.id ? 'Quitar el filtro' : `Ver solo lo de ${quienEnMenu?.name}`}
            </span>
          </button>
          <button
            // Se cierra SIN tocar el historial: el router hace su pushState en
            // este mismo clic y el history.back() de un cierre normal llegaría
            // después, deshaciendo la navegación (el mismo caso que ya tenía el
            // menú lateral, ver Shell.jsx).
            onClick={() => { menu.reemplazar(null); navegar(`/quien/${quienEnMenu.id}`) }}
            className="flex items-center gap-3 px-1 py-3.5 text-left"
          >
            <IconBooks className="h-5 w-5 shrink-0 text-ink-mute" />
            <span className="text-[15px]">Ver su estantería</span>
          </button>
        </div>
      </HojaInferior>

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
