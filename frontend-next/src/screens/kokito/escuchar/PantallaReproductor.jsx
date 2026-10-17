import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useReproductor } from '../../../platform/reproductor'
import { useCapa } from '../../../platform/capas'
import HojaInferior from '../../luniteca/HojaInferior'
import PantallaInferior from '../../luniteca/PantallaInferior'
import { Cover } from '../../luniteca/piezas'
import {
  IconAdelante30, IconAtras30, IconCheck, IconChevron, IconLuna, IconPausa, IconPistaAnterior, IconPistaSiguiente, IconPlay,
} from '../../../ui/icons'
import { Girando } from '../audiolibros/Audiolibros'
import { duracion, reloj } from '../audiolibros/formato'

// La pantalla del reproductor (fase 3, #65): sube desde abajo como el resto
// de la app. Cerrarla no para el audio: el <audio> es del reproductor global
// (platform/reproductor.jsx).

export default function PantallaReproductor() {
  const r = useReproductor()
  const hojaVelocidad = useCapa()
  const hojaDormir = useCapa()
  const abierta = !!r?.pantalla.abierta
  const libro = r?.libro

  // Mientras se generan más capítulos, que vayan apareciendo sin tener que
  // salir y volver a entrar.
  const generando = libro && libro.chapters_ready < libro.chapters_total
  useEffect(() => {
    if (!abierta || !generando) return
    const id = setInterval(() => r.refrescar(), 30000)
    return () => clearInterval(id)
  }, [abierta, generando, r])

  if (!r) return null
  const { cap, sonando, cargando, t, dur } = r
  const pct = dur ? Math.min(100, (t / dur) * 100) : 0

  return (
    <PantallaInferior
      abierta={abierta}
      onCerrar={r.pantalla.cerrar}
      nivel={55}
      cabecera={
        <div className="pointer-events-none sticky top-0 z-10 flex justify-between px-3">
          <motion.button
            onClick={r.pantalla.cerrar}
            aria-label="Cerrar el reproductor"
            whileTap={{ scale: 0.92 }}
            className="pointer-events-auto mt-1 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface/90 text-ink shadow-sm backdrop-blur"
          >
            <IconChevron className="h-5 w-5" />
          </motion.button>
        </div>
      }
    >
      {libro && (
        <div className="mx-auto w-full max-w-md px-6 pb-kb">
          <div className="flex flex-col items-center text-center">
            {/* La portada crece un poco al sonar y se recoge al pausar: se
                ve de lejos si está en marcha. */}
            <motion.div
              className="w-[210px]"
              animate={{ scale: sonando ? 1 : 0.92 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
            >
              <Cover url={libro.cover_url} title={libro.title} priority relieve realce={false} ajustar className="sombra-portada" />
            </motion.div>

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              {cap ? `Capítulo ${cap.number} de ${libro.chapters_total}` : 'Audiolibro'}
            </p>
            <h2 className="mt-1.5 font-display text-[1.45rem] font-bold leading-tight tracking-[-0.02em]">
              {cap?.title || libro.title}
            </h2>
            <p className="mt-1 text-sm text-ink-dim">{[libro.title, libro.author].filter(Boolean).join(' · ')}</p>
          </div>

          {cap ? (
            <>
              <div className="mt-7">
                <input
                  type="range" min="0" max={dur || 0} step="1" value={Math.min(t, dur || 0)}
                  onChange={e => r.buscar(Number(e.target.value))}
                  aria-label="Posición en el capítulo"
                  className="barra-audio w-full"
                  style={{ '--avance': `${pct}%` }}
                />
                <div className="mt-1 flex justify-between text-xs tabular-nums text-ink-mute">
                  <span>{reloj(t)}</span>
                  <span>−{reloj(Math.max(0, dur - t))}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-center gap-2.5">
                <Boton onClick={r.anterior} etiqueta="Capítulo anterior" pequeno><IconPistaAnterior className="h-6 w-6" /></Boton>
                <Boton onClick={() => r.saltar(-30)} etiqueta="Atrás 30 segundos"><IconAtras30 className="h-8 w-8" /></Boton>
                <motion.button
                  onClick={r.alternar}
                  aria-label={sonando ? 'Pausa' : 'Reproducir'}
                  whileTap={{ scale: 0.93 }}
                  className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-accent text-on-accent shadow-lg"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={cargando && !sonando ? 'cargando' : sonando ? 'pausa' : 'play'}
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      transition={{ duration: 0.14 }}
                    >
                      {cargando && !sonando ? <Girando className="h-7 w-7" />
                        : sonando ? <IconPausa className="h-8 w-8" />
                          : <IconPlay className="ml-1 h-8 w-8" />}
                    </motion.span>
                  </AnimatePresence>
                </motion.button>
                <Boton onClick={() => r.saltar(30)} etiqueta="Adelante 30 segundos"><IconAdelante30 className="h-8 w-8" /></Boton>
                <Boton onClick={r.siguiente} etiqueta="Capítulo siguiente" pequeno><IconPistaSiguiente className="h-6 w-6" /></Boton>
              </div>

              <div className="mt-5 flex justify-center gap-2">
                <Pastilla onClick={hojaVelocidad.abrir} activa={r.velocidad !== 1}>
                  {formatoVelocidad(r.velocidad)}
                </Pastilla>
                <Pastilla onClick={hojaDormir.abrir} activa={!!r.temporizador}>
                  <IconLuna className="h-3.5 w-3.5" />
                  <TextoDormir temporizador={r.temporizador} />
                </Pastilla>
              </div>
            </>
          ) : (
            <p className="mt-8 rounded-xl2 bg-accent-soft/60 px-4 py-3 text-center text-sm text-ink-dim">
              Todavía no hay ningún capítulo listo. Se están generando: vuelve en un rato.
            </p>
          )}

          <section className="mt-10">
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h3 className="font-display text-lg font-bold">Capítulos</h3>
              <span className="text-xs tabular-nums text-ink-mute">
                {libro.chapters_ready === libro.chapters_total
                  ? duracion(libro.audio_minutes)
                  : `${libro.chapters_ready} de ${libro.chapters_total} listos`}
              </span>
            </div>
            <div className="overflow-hidden rounded-xl2 border border-line bg-surface">
              {libro.chapters.map((c, i) => {
                const actual = c.id === cap?.id
                return (
                  <button
                    key={c.id}
                    onClick={() => !actual && r.elegir(c)}
                    disabled={!c.ready}
                    className={`flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors ${i ? 'border-t border-line/70' : ''} ${actual ? 'bg-accent-soft/60' : 'active:bg-surface-2'} disabled:active:bg-transparent`}
                  >
                    <span className="flex w-6 shrink-0 justify-end text-xs tabular-nums text-ink-mute">
                      {actual ? <Ecualizador activo={sonando} /> : c.number}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm ${actual ? 'font-semibold text-accent' : c.ready ? 'text-ink' : 'text-ink-mute'}`}>
                        {c.title}
                      </span>
                      <span className="block text-[11px] tabular-nums text-ink-mute">
                        {c.ready ? reloj(c.duration_s) : 'En camino: se está preparando'}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
            {generando && (
              <p className="mt-2 px-1 text-[11px] leading-relaxed text-ink-mute">
                Los que faltan aparecen aquí según estén listos.
              </p>
            )}
          </section>
        </div>
      )}

      <HojaVelocidad abierta={hojaVelocidad.abierta} onCerrar={hojaVelocidad.cerrar} />
      <HojaDormir abierta={hojaDormir.abierta} onCerrar={hojaDormir.cerrar} />
    </PantallaInferior>
  )
}

const VELOCIDADES = [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.5, 1.75, 2]
const formatoVelocidad = (v) => `${String(v).replace('.', ',')}×`

function Pastilla({ onClick, activa, children }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold tabular-nums transition-colors ${
        activa ? 'border-accent-line bg-accent-soft text-accent' : 'border-line text-ink-dim'
      }`}
    >
      {children}
    </motion.button>
  )
}

// "Dormir", o lo que le queda: los minutos se cuentan en vivo.
function TextoDormir({ temporizador }) {
  const [, tic] = useState(0)
  useEffect(() => {
    if (!temporizador?.fin) return
    const id = setInterval(() => tic(n => n + 1), 15000)
    return () => clearInterval(id)
  }, [temporizador])
  if (!temporizador) return 'Dormir'
  if (temporizador.capitulo) return 'Al acabar el capítulo'
  const min = Math.max(1, Math.ceil((temporizador.fin - Date.now()) / 60000))
  return `Quedan ${min} min`
}

function HojaVelocidad({ abierta, onCerrar }) {
  const r = useReproductor()
  return (
    <HojaInferior abierta={abierta} titulo="Velocidad" onCerrar={onCerrar}>
      <p className="mb-4 text-[13px] text-ink-dim">Se queda para la próxima vez, en cualquier dispositivo.</p>
      <div className="grid grid-cols-3 gap-2 pb-2">
        {VELOCIDADES.map(v => {
          const activa = r.velocidad === v
          return (
            <motion.button
              key={v}
              whileTap={{ scale: 0.95 }}
              onClick={() => { r.cambiarVelocidad(v); onCerrar() }}
              className={`h-12 rounded-xl2 border text-[15px] font-semibold tabular-nums transition-colors ${
                activa ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink'
              }`}
            >
              {formatoVelocidad(v)}
            </motion.button>
          )
        })}
      </div>
    </HojaInferior>
  )
}

const DORMIR = [
  { valor: 10, texto: '10 minutos' },
  { valor: 15, texto: '15 minutos' },
  { valor: 30, texto: '30 minutos' },
  { valor: 45, texto: '45 minutos' },
  { valor: 60, texto: '1 hora' },
  { valor: 'capitulo', texto: 'Al acabar el capítulo' },
]

function HojaDormir({ abierta, onCerrar }) {
  const r = useReproductor()
  const t = r.temporizador
  const elegido = !t ? null : t.capitulo ? 'capitulo' : 'minutos'
  return (
    <HojaInferior abierta={abierta} titulo="Para dormir" onCerrar={onCerrar}>
      <p className="mb-3 text-[13px] text-ink-dim">Se pone en pausa, y se guarda dónde ibas.</p>
      <div className="overflow-hidden rounded-xl2 border border-line bg-surface">
        {DORMIR.map((o, i) => {
          const activa = o.valor === 'capitulo' ? elegido === 'capitulo' : false
          return (
            <button
              key={o.valor}
              onClick={() => { r.dormir(o.valor); onCerrar() }}
              className={`flex w-full items-center justify-between px-4 py-3.5 text-left text-[15px] ${i ? 'border-t border-line/70' : ''} active:bg-surface-2`}
            >
              <span className={activa ? 'font-semibold text-accent' : 'text-ink'}>{o.texto}</span>
              {activa && <IconCheck className="h-4 w-4 text-accent" />}
            </button>
          )
        })}
      </div>
      {t && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => { r.dormir(null); onCerrar() }}
          className="mt-3 h-12 w-full rounded-xl2 border border-line text-sm font-semibold text-ink-dim active:bg-surface-2"
        >
          Quitar el temporizador
        </motion.button>
      )}
    </HojaInferior>
  )
}

function Boton({ onClick, etiqueta, pequeno = false, children }) {
  return (
    <motion.button
      onClick={onClick}
      aria-label={etiqueta}
      whileTap={{ scale: 0.88 }}
      className={`flex items-center justify-center rounded-full active:bg-surface-2 ${pequeno ? 'h-11 w-11 text-ink-dim' : 'h-14 w-14 text-ink'}`}
    >
      {children}
    </motion.button>
  )
}

// Tres barritas que bailan en el capítulo que suena; quietas en pausa.
export function Ecualizador({ activo }) {
  return (
    <span className="flex h-3.5 items-end gap-[2px]" aria-hidden>
      {[0.55, 1, 0.75].map((alto, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-accent"
          style={{ height: '100%', originY: 1 }}
          animate={activo ? { scaleY: [alto * 0.4, alto, alto * 0.5, alto * 0.9, alto * 0.4] } : { scaleY: 0.3 }}
          transition={activo ? { duration: 1.1 + i * 0.15, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
        />
      ))}
    </span>
  )
}
