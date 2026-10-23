import { useCallback, useEffect, useState } from 'react'
import Desplegable from '../../ui/Desplegable'
import { api } from '../../platform/api'
import { useCapa } from '../../platform/capas'
import HojaInferior from '../luniteca/HojaInferior'
import Avatar from '../../ui/Avatar'
import BotonPeligro from '../../ui/BotonPeligro'
import Interruptor from '../../ui/Interruptor'
import { IconCheck, IconChevron, IconPencil, IconPlus, IconRefresh } from '../../ui/icons'
import TextoNovedad from './TextoNovedad'

// Administración → Novedades (#72): avisos que el admin escribe y que a cada
// persona le salen hasta que los acepta. Aquí se crean, se ve quién los ha
// aceptado y se editan, relanzan o borran.

const PUBLICOS = [
  { id: 'todos', label: 'Todos' },
  { id: 'club', label: 'El club' },
  { id: 'personas', label: 'Elegir' },
]
const NOMBRE_PUBLICO = { todos: 'Todos', club: 'Solo el club', personas: 'Personas elegidas' }

export default function Novedades() {
  const [lista, setLista] = useState(null)
  const [error, setError] = useState(null)
  const [abierto, setAbierto] = useState(null) // id con el detalle desplegado
  const [editando, setEditando] = useState(null) // null | 'nuevo' | aviso
  const hoja = useCapa()

  const cargar = useCallback(() => {
    api('/announcements')
      .then(l => { setLista(l); setError(null) })
      .catch(e => { setLista([]); setError(e.message) })
  }, [])
  useEffect(() => { cargar() }, [cargar])

  function nuevo() { setEditando('nuevo'); hoja.abrir() }
  function editar(a) { setEditando(a); hoja.abrir() }

  return (
    <div className="mt-5">
      <button
        onClick={nuevo}
        className="flex w-full items-center gap-3 rounded-xl3 border border-dashed border-accent-line bg-accent-soft/40 p-3.5 text-left transition-transform duration-150 active:scale-[0.98]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
          <IconPlus className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-[15px] font-bold">Nuevo aviso</span>
          <span className="block text-xs text-ink-dim">Le saldrá a cada uno hasta que le dé a «Entendido»</span>
        </span>
      </button>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      {lista === null && <div className="mt-4 h-24 animate-pulse rounded-xl2 bg-surface-2" />}
      {lista?.length === 0 && !error && (
        <p className="mt-10 text-center text-sm text-ink-mute">Todavía no has mandado ningún aviso.</p>
      )}

      <div className="mt-4 space-y-2.5">
        {lista?.map(a => (
          <TarjetaAviso
            key={a.id}
            aviso={a}
            abierto={abierto === a.id}
            onAlternar={() => setAbierto(abierto === a.id ? null : a.id)}
            onEditar={() => editar(a)}
            onCambio={fresco => setLista(l => l.map(x => x.id === fresco.id ? fresco : x))}
            onBorrado={() => setLista(l => l.filter(x => x.id !== a.id))}
          />
        ))}
      </div>

      <HojaAviso
        abierta={hoja.abierta}
        aviso={editando === 'nuevo' ? null : editando}
        onCerrar={hoja.cerrar}
        onGuardado={fresco => {
          setLista(l => (l?.some(x => x.id === fresco.id) ? l.map(x => x.id === fresco.id ? fresco : x) : [fresco, ...(l || [])]))
          setAbierto(fresco.id)
          hoja.cerrar()
        }}
      />
    </div>
  )
}

function hace(iso) {
  const d = new Date(iso)
  const min = Math.round((Date.now() - d) / 60000)
  if (min < 1) return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  if (min < 60 * 24) return `hace ${Math.round(min / 60)} h`
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function TarjetaAviso({ aviso: a, abierto, onAlternar, onEditar, onCambio, onBorrado }) {
  const [gente, setGente] = useState(null)
  const [relanzando, setRelanzando] = useState(false)
  const [conPush, setConPush] = useState(false)
  const [error, setError] = useState(null)
  const pct = a.total ? (a.accepted / a.total) * 100 : 0

  useEffect(() => {
    if (!abierto) return
    api(`/announcements/${a.id}`).then(d => setGente(d.people)).catch(e => setError(e.message))
  }, [abierto, a.id, a.launched_at, a.accepted])

  async function relanzar() {
    try {
      const fresco = await api(`/announcements/${a.id}/relaunch`, { method: 'POST', body: { push: conPush } })
      setGente(fresco.people)
      onCambio(fresco)
      setRelanzando(false)
    } catch (e) { setError(e.message) }
  }
  async function borrar() {
    try {
      await api(`/announcements/${a.id}`, { method: 'DELETE' })
      onBorrado()
    } catch (e) { setError(e.message) }
  }

  return (
    <div className="overflow-hidden rounded-xl3 border border-line bg-surface">
      <button onClick={onAlternar} className="flex w-full items-start gap-3 p-3.5 text-left">
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[15px] font-bold leading-snug">{a.title}</span>
          <span className="mt-0.5 block text-[11px] text-ink-mute">
            {NOMBRE_PUBLICO[a.audience]} · {hace(a.launched_at)}
          </span>
          <span className="mt-2.5 flex items-center gap-2.5">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <span className="block h-full w-full rounded-full bg-accent transition-transform duration-500" style={{ transform: `translateX(${pct - 100}%)` }} />
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-ink-dim">
              {a.total ? `${a.accepted} de ${a.total} lo han visto` : 'No va a nadie'}
            </span>
          </span>
        </span>
        <IconChevron className={`mt-1 h-4 w-4 shrink-0 text-ink-mute transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      <Desplegable abierto={abierto}>
            <div className="border-t border-line px-3.5 pb-3.5 pt-3">
              {a.body && <TextoNovedad texto={a.body} className="text-[13px] leading-relaxed text-ink-dim" />}
              {error && <p className="mt-2 text-xs text-danger">{error}</p>}

              <p className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute">Quién lo ha visto</p>
              {!gente ? (
                <div className={`h-12 rounded-xl2 bg-surface-2 ${abierto ? 'animate-pulse' : ''}`} />
              ) : gente.length === 0 ? (
                <p className="text-xs text-ink-mute">No va dirigido a nadie ahora mismo.</p>
              ) : (
                <div className="divide-y divide-[color:var(--color-line)] rounded-xl2 border border-line">
                  {[...gente].sort((x, y) => (!!y.accepted_at) - (!!x.accepted_at)).map(p => (
                    <div key={p.id} className="flex items-center gap-2.5 px-3 py-2">
                      <Avatar jugador={p} size={26} />
                      <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                      {p.accepted_at ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--color-read)]">
                          <IconCheck className="h-3.5 w-3.5" /> {hace(p.accepted_at)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-ink-mute">Sin ver</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <Desplegable abierto={relanzando}>
                    <div className="mt-3 rounded-xl2 bg-accent-soft/50 p-3">
                      <p className="text-xs leading-relaxed text-ink-dim">
                        Vuelve a salirle a todos, también a quien ya lo había visto.
                      </p>
                      <div className="mt-2">
                        <Interruptor puesto={conPush} onCambiar={setConPush} etiqueta="Mandar también al móvil" />
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button onClick={relanzar} className="h-9 flex-1 rounded-xl2 bg-accent text-xs font-semibold text-on-accent">Relanzar</button>
                        <button onClick={() => setRelanzando(false)} className="h-9 rounded-xl2 border border-line px-3 text-xs text-ink-dim">Cancelar</button>
                      </div>
                    </div>
              </Desplegable>

              <div className="mt-3 flex items-center gap-2">
                <button onClick={onEditar} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-ink-dim active:bg-surface-2">
                  <IconPencil className="h-3.5 w-3.5" /> Editar
                </button>
                {!relanzando && (
                  <button onClick={() => setRelanzando(true)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-ink-dim active:bg-surface-2">
                    <IconRefresh className="h-3.5 w-3.5" /> Relanzar
                  </button>
                )}
                <span className="flex-1" />
                <BotonPeligro etiqueta="Borrar" pregunta="¿Borrar este aviso?" confirmar="Borrar" onConfirmar={borrar} />
              </div>
            </div>
      </Desplegable>
    </div>
  )
}

const ENTRADA = 'w-full rounded-xl2 border border-line bg-surface px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-mute focus:border-accent-line'

function HojaAviso({ abierta, aviso, onCerrar, onGuardado }) {
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [publico, setPublico] = useState('todos')
  const [elegidos, setElegidos] = useState([])
  const [conPush, setConPush] = useState(true)
  const [cuentas, setCuentas] = useState(null)
  const [verPrevia, setVerPrevia] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!abierta) return
    setTitulo(aviso?.title || '')
    setTexto(aviso?.body || '')
    setPublico(aviso?.audience || 'todos')
    setElegidos(aviso?.player_ids || [])
    setConPush(!aviso)
    setVerPrevia(false)
    setError(null)
    if (!cuentas) {
      api('/admin/players')
        .then(l => setCuentas(l.filter(p => p.status === 'approved' && p.name.toLowerCase() !== 'wander')))
        .catch(() => setCuentas([]))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, aviso?.id])

  const vale = titulo.trim() && (publico !== 'personas' || elegidos.length > 0)

  async function guardar() {
    setEnviando(true)
    setError(null)
    try {
      const cuerpo = { title: titulo, body: texto, audience: publico, player_ids: publico === 'personas' ? elegidos : null }
      const fresco = aviso
        ? await api(`/announcements/${aviso.id}`, { method: 'PATCH', body: cuerpo })
        : await api('/announcements', { method: 'POST', body: { ...cuerpo, push: conPush } })
      onGuardado(fresco)
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  const alternar = id => setElegidos(l => (l.includes(id) ? l.filter(x => x !== id) : [...l, id]))
  const cuantosClub = cuentas?.filter(p => p.club_member).length

  return (
    <HojaInferior
      abierta={abierta}
      titulo={aviso ? 'Editar aviso' : 'Nuevo aviso'}
      onCerrar={onCerrar}
      pie={
        <button
          onClick={guardar}
          disabled={!vale || enviando}
          className="flex h-12 flex-1 items-center justify-center rounded-xl2 bg-accent text-sm font-semibold text-on-accent disabled:opacity-50"
        >
          {aviso ? 'Guardar' : 'Publicar'}
        </button>
      }
    >
      <div className="space-y-4 pb-2">
        <input value={titulo} onChange={e => setTitulo(e.target.value.slice(0, 120))} placeholder="Título" aria-label="Título" className={`${ENTRADA} h-12`} />

        <div>
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-[11px] text-ink-mute">Línea en blanco: párrafo · «- »: lista · **negrita**</span>
            <button onClick={() => setVerPrevia(v => !v)} className="text-[11px] font-semibold text-accent">
              {verPrevia ? 'Escribir' : 'Ver cómo queda'}
            </button>
          </div>
          {verPrevia ? (
            <div className="min-h-[9rem] rounded-xl2 border border-line bg-bg px-3.5 py-3 text-[15px] leading-relaxed text-ink-dim">
              <p className="mb-2 font-display text-lg font-bold text-ink">{titulo || 'Sin título'}</p>
              <TextoNovedad texto={texto} />
            </div>
          ) : (
            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              rows={6}
              placeholder="Qué hay de nuevo…"
              aria-label="Texto"
              className={`${ENTRADA} resize-none py-3 leading-relaxed`}
            />
          )}
        </div>

        <div>
          <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-mute">A quién</p>
          <div className="flex rounded-full border border-line bg-surface p-1">
            {PUBLICOS.map(o => (
              <button
                key={o.id}
                onClick={() => setPublico(o.id)}
                className={`h-9 flex-1 rounded-full text-[13px] font-semibold transition-colors ${publico === o.id ? 'bg-accent/20 text-accent' : 'text-ink-dim'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-ink-mute">
            {publico === 'todos' && (cuentas ? `Las ${cuentas.length} cuentas aprobadas` : 'Todas las cuentas aprobadas')}
            {publico === 'club' && (cuentas ? `Los ${cuantosClub} del club` : 'Los del club')}
            {publico === 'personas' && `${elegidos.length} elegidas`}
          </p>
          <Desplegable abierto={publico === 'personas'}>
                <div className="mt-2 max-h-64 divide-y divide-[color:var(--color-line)] overflow-y-auto rounded-xl2 border border-line bg-surface">
                  {(cuentas || []).map(p => {
                    const si = elegidos.includes(p.id)
                    return (
                      <button key={p.id} onClick={() => alternar(p.id)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left">
                        <Avatar jugador={p} size={28} />
                        <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                        {p.club_member && <span className="text-[10px] text-ink-mute">club</span>}
                        <span className={`flex h-5 w-5 items-center justify-center rounded-md border-[1.5px] ${si ? 'border-accent bg-accent text-on-accent' : 'border-line'}`}>
                          {si && <IconCheck className="h-3 w-3" />}
                        </span>
                      </button>
                    )
                  })}
                </div>
          </Desplegable>
        </div>

        {!aviso && (
          <div className="rounded-xl2 border border-line bg-surface px-3.5 py-3">
            <Interruptor
              puesto={conPush}
              onCambiar={setConPush}
              etiqueta="Mandar también al móvil"
              nota="Como notificación, a quien las tenga activadas. Al abrir la app le sale igual."
            />
          </div>
        )}
        {aviso && (
          <p className="px-1 text-[11px] leading-relaxed text-ink-mute">
            Guardar no se lo vuelve a sacar a quien ya lo vio; para eso, «Relanzar».
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </HojaInferior>
  )
}
