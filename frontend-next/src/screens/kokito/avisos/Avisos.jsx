import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useNotificaciones } from '../../../platform/notificaciones'
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
