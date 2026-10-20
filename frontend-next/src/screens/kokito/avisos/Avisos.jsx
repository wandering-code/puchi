import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useNotificaciones } from '../../../platform/notificaciones'
import { activarPush, desactivarPush, estadoPush } from '../../../platform/push'
import { api } from '../../../platform/api'
import { esAdmin, useAuth } from '../../../platform/auth'
import { usarPreferencia } from '../../../platform/preferencias'
import Interruptor from '../../../ui/Interruptor'
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

// Ajustes → Avisos (#69, parte 3): qué avisos quiere cada uno. Apagar uno
// es no recibirlo en ningún sitio, ni en la campana ni en el móvil (el
// backend no lo crea: avisos_audiolibros.quiere). Va con la cuenta.
const TIPOS = [
  { id: 'ab_ready', etiqueta: 'Ya puedes escuchar', nota: 'Cuando un audiolibro que pediste tiene listo tu capítulo' },
  { id: 'ab_new_chapter', etiqueta: 'Capítulo nuevo', nota: 'Solo si vas al día y estás esperando el siguiente' },
  { id: 'ab_complete', etiqueta: 'Audiolibro completo', nota: 'Cuando ya están todos los capítulos' },
  { id: 'ab_rejected', etiqueta: 'Petición rechazada', nota: 'Si un audiolibro que pediste no se va a preparar' },
]
const TIPOS_ADMIN = [
  { id: 'adm_request', etiqueta: 'Peticiones nuevas', nota: 'Cuando alguien pide un audiolibro' },
  { id: 'adm_request_cancelled', etiqueta: 'Peticiones anuladas', nota: 'Cuando alguien anula lo que había pedido' },
  { id: 'adm_ab_done', etiqueta: 'Audiolibro generado', nota: 'Cuando el sobremesa termina un libro entero' },
  { id: 'adm_ch_error', etiqueta: 'Capítulo que falla', nota: 'Cuando un capítulo falla todas las veces' },
]

export function AvisosEnAjustes() {
  const { player } = useAuth()
  const [elegidos, ponerElegidos] = usarPreferencia('avisos', {})
  const cambiar = (id, v) => ponerElegidos({ ...(elegidos || {}), [id]: v })
  const lista = (tipos) => tipos.map((t, i) => (
    <div key={t.id} className={`px-4 py-3 ${i ? 'border-t border-line/70' : ''}`}>
      <Interruptor
        puesto={elegidos?.[t.id] !== false}
        onCambiar={v => cambiar(t.id, v)}
        etiqueta={t.etiqueta}
        nota={t.nota}
      />
    </div>
  ))
  return (
    <div className="mt-6 overflow-hidden rounded-xl2 border border-line bg-surface">
      <p className="border-b border-line px-4 py-2 text-xs uppercase tracking-wider text-ink-mute">Avisos</p>
      {/* Sin push en este dispositivo el recuadro no sale, y sin esto
          quedaría su hueco. */}
      <div className="px-4 pt-3 empty:hidden">
        <EnEsteMovil abierta />
      </div>
      {lista(TIPOS)}
      {esAdmin(player) && (
        <>
          <p className="border-y border-line bg-surface-2/40 px-4 py-2 text-xs uppercase tracking-wider text-ink-mute">
            Como admin
          </p>
          {lista(TIPOS_ADMIN)}
        </>
      )}
    </div>
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

  const lleva = a => a.kind.startsWith('adm_') || (a.audiobook_id && a.kind !== 'ab_rejected')

  async function tocar(a) {
    if (!lleva(a)) return
    // Cerrar la hoja es un "atrás" del historial, y llega un momento
    // después: si se navega antes, ese "atrás" deshace la navegación.
    n.hoja.cerrar()
    await trasVolver()
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
          return (
            <button
              key={a.id}
              onClick={() => tocar(a)}
              disabled={!lleva(a)}
              className={`flex w-full items-start gap-3 rounded-xl2 border p-2.5 text-left transition-colors disabled:cursor-default ${
                nuevo ? 'border-accent-line bg-accent-soft/50' : 'border-line bg-surface'} ${lleva(a) ? 'active:bg-surface-2' : ''}`}
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

// Espera al "atrás" que provoca cerrar una capa (o 400 ms, por si no llega).
function trasVolver() {
  return new Promise(listo => {
    let hecho = false
    const fin = () => {
      if (hecho) return
      hecho = true
      window.removeEventListener('popstate', fin)
      listo()
    }
    window.addEventListener('popstate', fin)
    setTimeout(fin, 400)
  })
}
