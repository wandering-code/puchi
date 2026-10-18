import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useNotificaciones } from '../../../platform/notificaciones'
import { activarPush, desactivarPush, estadoPush } from '../../../platform/push'
import { api } from '../../../platform/api'
import { Girando } from '../audiolibros/Audiolibros'
import HojaInferior from '../../luniteca/HojaInferior'
import { Cover } from '../../luniteca/piezas'
import { IconCampana } from '../../../ui/icons'
import { haceCuanto } from '../audiolibros/formato'

// La campana de la barra de arriba y la hoja con los avisos (fase 7, #69).

export function Campana() {
  const n = useNotificaciones()
  if (!n) return null
  return (
    <button
      onClick={() => n.hoja.abrir()}
      aria-label={n.sinLeer ? `Avisos, ${n.sinLeer} sin ver` : 'Avisos'}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl2 text-ink transition-colors active:bg-surface-2"
    >
      <IconCampana className="h-[22px] w-[22px]" />
      <AnimatePresence>
        {n.sinLeer > 0 && (
          <motion.span
            key="numero"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 520, damping: 26 }}
            className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold tabular-nums text-on-accent ring-2 ring-bg"
          >
            {n.sinLeer > 9 ? '9+' : n.sinLeer}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}

// Recibir los avisos con la app cerrada (push). Lo que se enseña depende de
// si este dispositivo puede, de si ya dio permiso y, en iPhone, de si la app
// está añadida a la pantalla de inicio.
function EnEsteMovil({ abierta }) {
  const [estado, setEstado] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [nota, setNota] = useState(null)
  useEffect(() => {
    if (!abierta) return
    setNota(null)
    estadoPush().then(setEstado).catch(() => setEstado('sin-soporte'))
  }, [abierta])

  async function hacer(fn) {
    setOcupado(true)
    setNota(null)
    try {
      await fn()
    } catch (e) {
      setNota(e.message || 'No se ha podido')
    } finally {
      setOcupado(false)
    }
  }

  if (!estado || estado === 'sin-soporte') return null

  const caja = 'mb-4 rounded-xl2 border px-3.5 py-3'
  if (estado === 'instalar') {
    return (
      <div className={`${caja} border-line bg-surface-2/60`}>
        <p className="text-sm font-semibold">Avisos con la app cerrada</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-dim">
          En el iPhone solo llegan si Kokito está en la pantalla de inicio: en Safari, botón Compartir →
          «Añadir a pantalla de inicio», y ábrelo desde ese icono.
        </p>
      </div>
    )
  }
  if (estado === 'bloqueado') {
    return (
      <div className={`${caja} border-line bg-surface-2/60`}>
        <p className="text-sm font-semibold">Avisos bloqueados en este dispositivo</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-dim">
          Dijiste que no al permiso. Para cambiarlo: Ajustes del móvil → Notificaciones → Kokito.
        </p>
      </div>
    )
  }
  if (estado === 'activo') {
    return (
      <div className={`${caja} flex items-center gap-3 border-line bg-surface`}>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Avisos en este dispositivo</span>
          <span className="block text-xs text-ink-dim">{nota || 'Te llegan aunque la app esté cerrada'}</span>
        </span>
        <button
          disabled={ocupado}
          onClick={() => hacer(async () => { await api('/push/test', { method: 'POST' }); setNota('Enviado: debería llegarte ahora') })}
          className="shrink-0 rounded-full px-2.5 py-1.5 text-xs font-semibold text-accent active:bg-accent-soft disabled:opacity-60"
        >
          Probar
        </button>
        <button
          disabled={ocupado}
          onClick={() => hacer(async () => setEstado(await desactivarPush()))}
          className="shrink-0 rounded-full px-2.5 py-1.5 text-xs font-medium text-ink-mute active:bg-surface-2 disabled:opacity-60"
        >
          Quitar
        </button>
      </div>
    )
  }
  return (
    <div className={`${caja} border-accent-line bg-accent-soft/50`}>
      <p className="text-sm font-semibold">Recibe los avisos aunque Kokito esté cerrado</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-dim">
        {nota || 'Te llegará una notificación al móvil cuando tu audiolibro se pueda escuchar.'}
      </p>
      <motion.button
        whileTap={{ scale: 0.97 }}
        disabled={ocupado}
        onClick={() => hacer(async () => setEstado(await activarPush()))}
        className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl2 bg-accent px-4 text-sm font-semibold text-on-accent shadow-sm disabled:opacity-70"
      >
        {ocupado ? <Girando className="h-4 w-4" /> : <IconCampana className="h-4 w-4" />}
        Activar en este dispositivo
      </motion.button>
    </div>
  )
}

export function HojaAvisos() {
  const n = useNotificaciones()
  const abierta = !!n?.hoja.abierta
  // Lo que estaba sin ver al abrir se queda resaltado mientras la hoja está
  // abierta, aunque ya se haya marcado como visto en el servidor.
  const nuevos = useRef(new Set())
  useEffect(() => {
    if (!abierta || !n) return
    nuevos.current = new Set((n.lista || []).filter(a => !a.read).map(a => a.id))
    n.recargar()
    const t = setTimeout(() => n.marcarLeidos(), 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta])
  if (!n) return null

  async function tocar(a) {
    if (!a.audiobook_id || a.kind === 'ab_rejected') return
    n.hoja.cerrar()
    await n.abrirAviso(a)
  }

  return (
    <HojaInferior abierta={abierta} titulo="Avisos" onCerrar={n.hoja.cerrar}>
      <EnEsteMovil abierta={abierta} />
      {n.lista?.length === 0 && (
        <div className="flex flex-col items-center py-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-ink-mute">
            <IconCampana className="h-7 w-7" />
          </span>
          <p className="mt-3 font-display text-base font-bold">Nada por aquí</p>
          <p className="mt-1 max-w-[16rem] text-[13px] text-ink-dim">
            Cuando un audiolibro que hayas pedido se pueda escuchar, te avisaremos aquí.
          </p>
        </div>
      )}
      <div className="space-y-2 pb-2">
        {(n.lista || []).map(a => {
          const nuevo = nuevos.current.has(a.id)
          const lleva = a.audiobook_id && a.kind !== 'ab_rejected'
          return (
            <button
              key={a.id}
              onClick={() => tocar(a)}
              disabled={!lleva}
              className={`flex w-full items-start gap-3 rounded-xl2 border p-2.5 text-left transition-colors disabled:cursor-default ${
                nuevo ? 'border-accent-line bg-accent-soft/50' : 'border-line bg-surface'} ${lleva ? 'active:bg-surface-2' : ''}`}
            >
              <Cover url={a.cover_url} title={a.title} className="w-10 shrink-0" />
              <span className="min-w-0 flex-1 py-0.5">
                <span className="block break-words text-sm font-semibold leading-snug">{a.title}</span>
                {a.body && <span className="mt-0.5 block break-words text-xs text-ink-dim">{a.body}</span>}
                <span className="mt-1 block text-[11px] text-ink-mute">{haceCuanto(a.created_at)}</span>
              </span>
              {nuevo && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Nuevo" />}
            </button>
          )
        })}
      </div>
    </HojaInferior>
  )
}
