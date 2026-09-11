import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useLlamadas } from '../../platform/llamadas'
import Avatar from '../../ui/Avatar'
import { LLEGADA, SALIDA } from '../../ui/curvas'
import { IconColgar, IconEncoger, IconMicro, IconMicroOff, IconVideoCamara, IconVideoCamaraOff } from '../../ui/icons'

// El escenario de la llamada. A pantalla completa y por encima de todo.
//
// El rojo de colgar va fijo y no con `--color-danger`. El de la paleta cambia
// con el tema (terracota apagado en claro, salmón en oscuro) porque está hecho
// para leerse sobre papel; aquí el fondo es siempre negro y, sobre todo, es el
// único botón sin vuelta atrás de la pantalla: tiene que decir "rojo" sin
// depender de qué tema tenga puesto quien mira.
const ROJO_COLGAR = '#e0483f'

// Es **el único sitio de Puchi que va oscuro en los dos temas**, y es a
// propósito: una cara iluminada por una pantalla se ve mejor sobre negro, y el
// crema de la app le robaría luz a lo único que importa aquí. Es la misma
// excepción que hace un cine.
//
// Lo que no es: una ventana con barra de título y rejilla de cajas. El otro
// ocupa la pantalla entera, tú eres una tarjeta pequeña que se puede arrastrar,
// y los mandos flotan abajo y se apartan solos cuando no los tocas.
//
// Y no atrapa: el botón de encoger la deja en una pastilla y te devuelve la app
// entera, con la llamada en marcha.

export default function Llamada() {
  const {
    estado, conQuien, tipo, miVideo, suVideo,
    mudo, sinCamara, suCamaraApagada, encogida,
    aceptar, rechazar, colgar, alternarMudo, alternarCamara, encoger,
  } = useLlamadas()

  // Suena en la tarjeta de aviso, no aquí: el escenario solo aparece cuando ya
  // estás en la llamada o la estás haciendo tú.
  const aLaVista = (estado === 'llamando' || estado === 'activa') && !encogida
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
          <Escena
            estado={estado}
            conQuien={conQuien}
            conVideo={conVideo}
            suVideo={suVideo}
            suCamaraApagada={suCamaraApagada}
          />

          <Cabecera conQuien={conQuien} estado={estado} onEncoger={encoger} />

          {/* Tu propia imagen, arrastrable. Pequeña y en una esquina: lo que se
              mira es al otro; verte a ti es solo para saber que sales. */}
          {conVideo && miVideo && !sinCamara && <MiCaja stream={miVideo} />}

          <Mandos
            conVideo={conVideo}
            mudo={mudo}
            sinCamara={sinCamara}
            onMudo={alternarMudo}
            onCamara={alternarCamara}
            onColgar={colgar}
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function Escena({ estado, conQuien, conVideo, suVideo, suCamaraApagada }) {
  const hayImagen = conVideo && suVideo && !suCamaraApagada

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      {hayImagen ? (
        <Video stream={suVideo} className="h-full w-full object-cover" />
      ) : (
        <div className="flex flex-col items-center">
          {/* El aro que respira mientras suena: da la sensación de que algo
              está pasando sin meter una ruedecita de "cargando", que en una
              llamada se lee como que va mal. */}
          <motion.div
            className="relative"
            animate={estado === 'llamando' ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={{ duration: 2, repeat: estado === 'llamando' ? Infinity : 0, ease: 'easeInOut' }}
          >
            {estado === 'llamando' && (
              <motion.span
                className="absolute -inset-4 rounded-full border border-white/25"
                animate={{ scale: [1, 1.25], opacity: [0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
            <Avatar jugador={conQuien} size={132} className="border-white/15" />
          </motion.div>

          {/* El audio sigue haciendo falta aunque no se pinte imagen. */}
          {suVideo && <Video stream={suVideo} oculto />}
        </div>
      )}

      {/* Un velo por arriba y por abajo: sin él, el nombre en blanco sobre una
          cara clara no se lee. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/55 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/65 to-transparent" />
    </div>
  )
}

function Cabecera({ conQuien, estado, onEncoger }) {
  return (
    <div className="relative z-10 flex items-start gap-3 px-4 pt-safe">
      <div className="min-w-0 flex-1 pt-3">
        <p className="truncate font-display text-xl font-bold leading-tight">{conQuien?.name}</p>
        <p className="mt-0.5 text-[13px] text-white/60">
          {estado === 'llamando' ? 'Llamando…' : <Cronometro />}
        </p>
      </div>

      {/* Encoger, no cerrar: la llamada sigue y te devuelve Puchi entera. */}
      <motion.button
        onClick={onEncoger}
        whileTap={{ scale: 0.9 }}
        aria-label="Seguir en Puchi con la llamada en marcha"
        className="mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur"
      >
        <IconEncoger className="h-5 w-5" />
      </motion.button>
    </div>
  )
}

// Cuánto lleva la llamada. Arranca al montarse, que es cuando pasa a activa.
export function Cronometro() {
  const [segundos, setSegundos] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setSegundos(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const m = String(Math.floor(segundos / 60)).padStart(2, '0')
  const s = String(segundos % 60).padStart(2, '0')
  return <span className="tabular-nums">{m}:{s}</span>
}

// Tu cámara, en una tarjeta que se puede mover a cualquier esquina: en el móvil
// siempre acaba tapando justo lo que quieres ver.
function MiCaja({ stream }) {
  const limites = useRef(null)
  return (
    <>
      <div ref={limites} className="pointer-events-none absolute inset-0 p-3 pt-safe" />
      <motion.div
        drag
        dragConstraints={limites}
        dragElastic={0.12}
        dragMomentum={false}
        className="absolute right-4 top-24 z-10 h-36 w-24 cursor-grab overflow-hidden rounded-xl2 border border-white/15 bg-black/40 shadow-lg active:cursor-grabbing"
      >
        {/* Espejada, como cualquier cámara frontal: si no, levantas la mano
            derecha y se mueve la izquierda. */}
        <Video stream={stream} className="h-full w-full scale-x-[-1] object-cover" mudo />
      </motion.div>
    </>
  )
}

function Mandos({ conVideo, mudo, sinCamara, onMudo, onCamara, onColgar }) {
  return (
    <div className="relative z-10 mt-auto flex justify-center px-4 pb-safe">
      <div className="mb-5 flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-3 py-3 backdrop-blur-xl">
        <Mando activo={!mudo} onClick={onMudo} etiqueta={mudo ? 'Activar micrófono' : 'Silenciar micrófono'}>
          {mudo ? <IconMicroOff className="h-6 w-6" /> : <IconMicro className="h-6 w-6" />}
        </Mando>

        {conVideo && (
          <Mando activo={!sinCamara} onClick={onCamara} etiqueta={sinCamara ? 'Encender cámara' : 'Apagar cámara'}>
            {sinCamara ? <IconVideoCamaraOff className="h-6 w-6" /> : <IconVideoCamara className="h-6 w-6" />}
          </Mando>
        )}

        {/* Colgar va en rojo y separado: es el único de los tres que no tiene
            vuelta atrás. */}
        <motion.button
          onClick={onColgar}
          whileTap={{ scale: 0.9 }}
          aria-label="Colgar"
          style={{ background: ROJO_COLGAR }}
          className="ml-1 flex h-14 w-14 items-center justify-center rounded-full text-white"
        >
          <IconColgar className="h-6 w-6" />
        </motion.button>
      </div>
    </div>
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

// Un <video> al que se le enchufa un MediaStream. Va en su propio componente
// porque srcObject no es un atributo: hay que ponerlo desde JS en cuanto el
// nodo existe, y volver a hacerlo si cambia el stream.
export function Video({ stream, className = '', mudo = false, oculto = false }) {
  const nodo = useRef(null)
  useEffect(() => {
    if (nodo.current && stream) nodo.current.srcObject = stream
  }, [stream])
  return (
    <video
      ref={nodo}
      autoPlay
      playsInline
      muted={mudo}
      className={oculto ? 'hidden' : className}
    />
  )
}
