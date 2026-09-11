import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useChat } from '../../platform/chat'
import { useLlamadas } from '../../platform/llamadas'
import Avatar from '../../ui/Avatar'
import { LLEGADA, SALIDA } from '../../ui/curvas'
import { IconColgar, IconEncoger, IconMicro, IconMicroOff, IconVideoCamara, IconVideoCamaraOff } from '../../ui/icons'
import { Cronometro, Video } from './Llamada'
import { EN_LA_FILA, usarMiTamano } from './miTamano'

// La llamada del club.
//
// **Uno grande y los demás en una fila abajo**, no una rejilla de cajas
// iguales. Una rejilla reparte la atención a partes iguales entre gente que no
// está diciendo lo mismo; en una conversación de verdad siempre hay alguien
// hablando, y es a quien se mira.
//
// Quién ocupa el primer plano:
//
// 1. A quien toques. Manda siempre, y se queda hasta que toques a otro.
// 2. Si no has tocado a nadie, quien esté hablando — se mide el nivel de audio
//    (ver el motor) con un umbral y un margen entre cambios, para que una tos
//    no cambie el plano.
// 3. Y si no hay nada de eso, el primero que haya.
//
// **Tocarte a ti no te pone en primer plano**: solo hace tu cuadrito más
// grande, en su sitio de la fila. Verte a ti mismo es para comprobar que sales
// bien, no para protagonizar la llamada.

const ROJO_COLGAR = '#e0483f'

export default function LlamadaGrupo() {
  const { grupo, encogida, encoger } = useLlamadas()
  const { jugadores, miId } = useChat() || {}
  const {
    dentro, ids, tipo, miVideo, streams, camarasApagadas,
    mudo, sinCamara, quienHabla, salir, alternarMudo, alternarCamara,
  } = grupo

  // A quién he puesto yo en primer plano. Null = que decida quien hable.
  const [elegido, setElegido] = useState(null)
  const [miTamano, agrandarme] = usarMiTamano()

  const porId = useMemo(
    () => new Map((jugadores || []).map(p => [p.id, p])),
    [jugadores],
  )
  const otros = useMemo(() => ids.filter(id => id !== miId), [ids, miId])

  // Si a quien tenía puesto se va de la llamada, no dejar el plano congelado.
  useEffect(() => {
    if (elegido != null && !otros.includes(elegido)) setElegido(null)
  }, [otros, elegido])

  const enPrimerPlano = elegido ?? (otros.includes(quienHabla) ? quienHabla : otros[0]) ?? null
  const aLaVista = dentro && !encogida
  const conVideo = tipo === 'video'

  return createPortal(
    <AnimatePresence>
      {aLaVista && (
        <motion.div
          className="fixed inset-0 z-[65] flex flex-col bg-[#0d0b09] text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: SALIDA }}
          transition={LLEGADA}
        >
          {/* ── Cabecera ─────────────────────────────────────────────── */}
          <div className="relative z-10 flex items-start gap-3 px-4 pt-safe">
            <div className="min-w-0 flex-1 pt-3">
              <p className="truncate font-display text-xl font-bold leading-tight">El club</p>
              <p className="mt-0.5 text-[13px] text-white/60">
                {ids.length} {ids.length === 1 ? 'dentro' : 'dentro'} · <Cronometro />
              </p>
            </div>
            <motion.button
              onClick={encoger}
              whileTap={{ scale: 0.9 }}
              aria-label="Seguir en Puchi con la llamada en marcha"
              className="mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur"
            >
              <IconEncoger className="h-5 w-5" />
            </motion.button>
          </div>

          {/* ── Primer plano ─────────────────────────────────────────── */}
          <div className="relative min-h-0 flex-1">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={enPrimerPlano ?? 'nadie'}
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 flex items-center justify-center overflow-hidden"
              >
                {enPrimerPlano != null ? (
                  <Grande
                    persona={porId.get(enPrimerPlano)}
                    stream={streams[enPrimerPlano]}
                    conVideo={conVideo}
                    camaraApagada={camarasApagadas[enPrimerPlano]}
                    hablando={quienHabla === enPrimerPlano}
                  />
                ) : (
                  <p className="px-8 text-center text-white/50">
                    Estás dentro. Cuando entre alguien más, lo verás aquí.
                  </p>
                )}
              </motion.div>
            </AnimatePresence>

            {/* El audio de TODOS, siempre, aunque solo se vea a uno: si el
                <video> del que no está en primer plano no estuviera montado,
                dejarías de oír a quien no estás mirando. */}
            <div className="hidden">
              {otros.filter(id => id !== enPrimerPlano).map(id => (
                streams[id] ? <Video key={id} stream={streams[id]} /> : null
              ))}
            </div>
          </div>

          {/* ── La fila ──────────────────────────────────────────────── */}
          <div className="relative z-10 shrink-0 overflow-x-auto px-4 pb-2">
            <div className="flex items-end gap-2">
              {otros.map(id => (
                <Cuadrito
                  key={id}
                  persona={porId.get(id)}
                  stream={streams[id]}
                  conVideo={conVideo}
                  camaraApagada={camarasApagadas[id]}
                  enPrimerPlano={id === enPrimerPlano}
                  hablando={quienHabla === id}
                  onTocar={() => setElegido(id)}
                />
              ))}

              {/* El tuyo, al final y con otro comportamiento: tocarlo te
                  agranda, no te pone en primer plano. */}
              <Cuadrito
                mio
                persona={porId.get(miId)}
                stream={miVideo}
                conVideo={conVideo}
                camaraApagada={sinCamara}
                mudo={mudo}
                escala={EN_LA_FILA[miTamano]}
                onTocar={agrandarme}
              />
            </div>
          </div>

          {/* ── Mandos ───────────────────────────────────────────────── */}
          <div className="relative z-10 flex shrink-0 justify-center px-4 pb-safe">
            <div className="mb-5 flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-3 py-3 backdrop-blur-xl">
              <Mando activo={!mudo} onClick={alternarMudo} etiqueta={mudo ? 'Activar micrófono' : 'Silenciar micrófono'}>
                {mudo ? <IconMicroOff className="h-6 w-6" /> : <IconMicro className="h-6 w-6" />}
              </Mando>
              {conVideo && (
                <Mando activo={!sinCamara} onClick={alternarCamara} etiqueta={sinCamara ? 'Encender cámara' : 'Apagar cámara'}>
                  {sinCamara ? <IconVideoCamaraOff className="h-6 w-6" /> : <IconVideoCamara className="h-6 w-6" />}
                </Mando>
              )}
              <motion.button
                onClick={salir}
                whileTap={{ scale: 0.9 }}
                aria-label="Salir de la llamada"
                style={{ background: ROJO_COLGAR }}
                className="ml-1 flex h-14 w-14 items-center justify-center rounded-full text-white"
              >
                <IconColgar className="h-6 w-6" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function Grande({ persona, stream, conVideo, camaraApagada, hablando }) {
  const hayImagen = conVideo && stream && !camaraApagada
  return (
    <>
      {hayImagen
        ? <Video stream={stream} className="h-full w-full object-cover" />
        : (
          <div className="flex flex-col items-center gap-4">
            <Avatar jugador={persona} size={132} className="border-white/15" />
            {stream && <Video stream={stream} oculto />}
          </div>
        )}

      {/* Quién es, abajo a la izquierda. Sobre el vídeo hace falta: con tres
          personas en la fila no siempre se sabe a quién estás mirando. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end gap-2 bg-gradient-to-t from-black/60 to-transparent px-5 pb-4 pt-16">
        <span className="font-display text-lg font-semibold">{persona?.name}</span>
        {hablando && <OndaHablando />}
      </div>
    </>
  )
}

// Un cuadrito de la fila. El de los demás se toca para ponerlos en primer
// plano; el tuyo, para agrandarse.
function Cuadrito({ persona, stream, conVideo, camaraApagada, enPrimerPlano, hablando, mio = false, mudo = false, escala = 1, onTocar }) {
  const hayImagen = conVideo && stream && !camaraApagada
  return (
    <motion.button
      onClick={onTocar}
      layout
      animate={{ width: 76 * escala, height: 100 * escala }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      whileTap={{ scale: 0.94 }}
      aria-label={mio ? 'Cambiar el tamaño de tu imagen' : `Poner a ${persona?.name} en primer plano`}
      title={mio ? 'Tu tamaño' : `Ver a ${persona?.name} en grande`}
      className={`relative shrink-0 overflow-hidden rounded-xl2 border bg-black/40 ${
        enPrimerPlano ? 'border-white/70' : hablando ? 'border-read' : 'border-white/15'
      }`}
    >
      {hayImagen
        ? <Video stream={stream} className={`h-full w-full object-cover ${mio ? 'scale-x-[-1]' : ''}`} mudo={mio} />
        : (
          <span className="flex h-full w-full items-center justify-center">
            <Avatar jugador={persona} size={Math.round(38 * escala)} className="border-white/15" />
          </span>
        )}

      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-1 pt-4">
        <span className="truncate text-[10px] font-medium text-white">{mio ? 'Tú' : persona?.name}</span>
        {mudo && <IconMicroOff className="h-3 w-3 shrink-0 text-white/70" />}
      </span>
    </motion.button>
  )
}

// Tres rayitas que suben y bajan: quién está hablando, sin poner un icono de
// micrófono que se confunde con el botón de silenciar.
function OndaHablando() {
  return (
    <span className="mb-1.5 flex items-end gap-[3px]" aria-label="Hablando">
      {[0, 0.15, 0.3].map(retraso => (
        <motion.span
          key={retraso}
          className="w-[3px] rounded-full bg-read"
          animate={{ height: [5, 13, 5] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: retraso, ease: 'easeInOut' }}
        />
      ))}
    </span>
  )
}

function Mando({ activo, onClick, etiqueta, children }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      aria-label={etiqueta}
      aria-pressed={!activo}
      className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
        activo ? 'bg-white/15 text-white' : 'bg-white text-[#0d0b09]'
      }`}
    >
      {children}
    </motion.button>
  )
}
