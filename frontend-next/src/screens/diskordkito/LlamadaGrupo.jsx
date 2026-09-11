import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useChat } from '../../platform/chat'
import { useLlamadas } from '../../platform/llamadas'
import Avatar from '../../ui/Avatar'
import { LLEGADA, SALIDA } from '../../ui/curvas'
import { IconColgar, IconEncoger, IconMicro, IconMicroOff, IconVideoCamara, IconVideoCamaraOff } from '../../ui/icons'
import { Cronometro, Video } from './Llamada'

// La llamada del club, en dos modos:
//
// - **Repartida** (lo normal): todos ocupan la pantalla a partes iguales, en
//   una rejilla que se calcula con cuántos sois y qué forma tiene la pantalla.
//   Con dos, dos mitades; con cuatro, dos por dos. Nada de franjas negras
//   esperando a gente que no está.
// - **Primer plano** (al tocar a alguien): esa persona ocupa el hueco entero y
//   el resto se van a una fila pequeña. Tocarla otra vez vuelve a repartir.
//
// **Todos funcionan igual, tú incluido.** Hubo una versión en la que tocarte a
// ti solo te agrandaba el cuadro, para no "robarte el primer plano a ti mismo".
// Sonaba razonable y no lo era: obligaba a recordar que tu cuadro se maneja
// distinto al de los demás en la misma pantalla. Un toque pone a quien sea en
// primer plano —a ti también— y otro vuelve a repartir.
//
// La primera versión era siempre el segundo modo, y con dos personas dejaba
// media pantalla negra: un cuadrito diminuto arriba y una franja muerta abajo.
//
// Y nada flota sobre una barra: la cabecera y los mandos van ENCIMA del vídeo,
// sobre un degradado. Lo que se ve es la gente, no el marco.

const ROJO_COLGAR = '#e0483f'

// Cuántas columnas dejan los cuadros más grandes, probando todas. Es lo que
// hace que dos personas salgan en dos mitades en horizontal pero una encima de
// otra en un móvil en vertical: no depende solo de cuántos sois, sino de la
// forma del hueco.
function mejoresColumnas(n, ancho, alto, proporcion = 4 / 3) {
  let mejor = 1, mayorArea = 0
  for (let col = 1; col <= n; col++) {
    const filas = Math.ceil(n / col)
    const cajaAncho = ancho / col
    const cajaAlto = alto / filas
    // Lo que de verdad mide el vídeo dentro de su celda, respetando proporción.
    const real = Math.min(cajaAncho, cajaAlto * proporcion)
    const area = real * (real / proporcion)
    if (area > mayorArea) { mayorArea = area; mejor = col }
  }
  return mejor
}

export default function LlamadaGrupo() {
  const { grupo, encogida, encoger } = useLlamadas()
  const { jugadores, miId } = useChat() || {}
  const {
    dentro, ids, tipo, miVideo, streams, camarasApagadas,
    mudo, sinCamara, quienHabla, salir, alternarMudo, alternarCamara,
  } = grupo

  // A quién he puesto en primer plano tocándole. Null = repartido.
  const [enPrimerPlano, setEnPrimerPlano] = useState(null)

  const porId = useMemo(() => new Map((jugadores || []).map(p => [p.id, p])), [jugadores])
  const otros = useMemo(() => ids.filter(id => id !== miId), [ids, miId])

  // Si a quien tenía en primer plano se va de la llamada, se vuelve a repartir.
  useEffect(() => {
    if (enPrimerPlano != null && !ids.includes(enPrimerPlano)) setEnPrimerPlano(null)
  }, [ids, enPrimerPlano])

  // Lo que hace falta de cada uno para pintarlo, sin repetir el "¿soy yo?" en
  // cada sitio: tu imagen viene de tu propia cámara y no del mesh, va espejada
  // y sin sonido (oírte a ti mismo con retardo es insoportable).
  const datosDe = (id) => ({
    persona: porId.get(id),
    stream: id === miId ? miVideo : streams[id],
    camaraApagada: id === miId ? sinCamara : camarasApagadas[id],
    mio: id === miId,
    mudo: id === miId ? mudo : false,
    hablando: quienHabla === id,
  })

  const aLaVista = dentro && !encogida
  const conVideo = tipo === 'video'

  return createPortal(
    <AnimatePresence>
      {aLaVista && (
        <motion.div
          className="fixed inset-0 z-[65] bg-[#0d0b09] text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: SALIDA }}
          transition={LLEGADA}
        >
          {enPrimerPlano != null ? (
            <ConPrimerPlano
              id={enPrimerPlano}
              ids={ids}
              datosDe={datosDe}
              conVideo={conVideo}
              onElegir={setEnPrimerPlano}
              onVolverARepartir={() => setEnPrimerPlano(null)}
            />
          ) : (
            <Repartida
              ids={ids}
              datosDe={datosDe}
              conVideo={conVideo}
              onElegir={setEnPrimerPlano}
            />
          )}

          {/* El audio de TODOS, siempre. Si el <video> de quien no se ve
              estuviera desmontado, dejarías de oír a quien no estás mirando. */}
          <div className="hidden">
            {otros.map(id => (streams[id] ? <Video key={id} stream={streams[id]} /> : null))}
          </div>

          {/* Encima del vídeo, no en una barra: lo que se ve es la gente. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-3 bg-gradient-to-b from-black/60 to-transparent px-4 pb-10 pt-safe">
            <div className="min-w-0 flex-1 pt-2">
              <p className="truncate font-display text-lg font-bold leading-tight">El club</p>
              <p className="mt-0.5 text-xs text-white/60">
                {ids.length} {ids.length === 1 ? 'dentro' : 'dentro'} · <Cronometro />
              </p>
            </div>
            <motion.button
              onClick={encoger}
              whileTap={{ scale: 0.9 }}
              aria-label="Seguir en Puchi con la llamada en marcha"
              className="pointer-events-auto mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur"
            >
              <IconEncoger className="h-5 w-5" />
            </motion.button>
          </div>

          <Mandos
            conVideo={conVideo}
            mudo={mudo}
            sinCamara={sinCamara}
            onMudo={alternarMudo}
            onCamara={alternarCamara}
            onSalir={salir}
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

// ── Repartida ───────────────────────────────────────────────────────────────
// Todos iguales, llenando la pantalla y centrados. Las columnas se calculan con
// el hueco real, medido: no vale hacerlo por número de personas a secas, porque
// dos en un móvil vertical quieren una columna y dos en un portátil quieren dos.
function Repartida({ ids, datosDe, conVideo, onElegir }) {
  const [caja, medir] = usarMedida()
  const columnas = caja.ancho > 0 ? mejoresColumnas(ids.length, caja.ancho, caja.alto) : 1

  return (
    <div ref={medir} className="absolute inset-0 p-2">
      <div
        className="grid h-full w-full place-content-center gap-2"
        style={{
          gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))`,
          gridAutoRows: 'minmax(0, 1fr)',
          // Centrado de verdad: sin esto, una última fila incompleta se pega a
          // la izquierda y la rejilla se ve descuadrada.
          justifyItems: 'center',
        }}
      >
        {ids.map(id => (
          <Cuadro key={id} {...datosDe(id)} conVideo={conVideo} onTocar={() => onElegir(id)} lleno />
        ))}
      </div>
    </div>
  )
}

// ── Con alguien en primer plano ─────────────────────────────────────────────
function ConPrimerPlano({ id, ids, datosDe, conVideo, onElegir, onVolverARepartir }) {
  const resto = ids.filter(o => o !== id)
  return (
    <div className="absolute inset-0 flex flex-col">
      <button
        onClick={onVolverARepartir}
        aria-label="Volver a ver a todos"
        title="Volver a ver a todos"
        className="relative min-h-0 flex-1"
      >
        <Cuadro {...datosDe(id)} conVideo={conVideo} grande lleno />
      </button>

      {/* La fila, flotando sobre el vídeo y por encima de los mandos. Sin barra
          propia: antes ocupaba su franja y, con poca gente, era un desierto. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 overflow-x-auto px-3">
        <div className="pointer-events-auto flex items-end justify-center gap-2">
          {resto.map(o => (
            <Cuadro key={o} {...datosDe(o)} conVideo={conVideo} onTocar={() => onElegir(o)} ancho={78} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Un cuadro ───────────────────────────────────────────────────────────────
// `lleno` es para los de la rejilla y el de primer plano: ocupan lo que les
// den. Los de la fila llevan un ancho fijo.
function Cuadro({
  persona, stream, conVideo, camaraApagada, hablando, mio = false, mudo = false,
  ancho = null, lleno = false, grande = false, onTocar,
}) {
  const hayImagen = conVideo && stream && !camaraApagada
  const Etiqueta = onTocar ? motion.button : motion.div

  return (
    <Etiqueta
      {...(onTocar ? { onClick: onTocar, whileTap: { scale: 0.97 } } : {})}
      layout
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      aria-label={onTocar ? `Poner a ${mio ? 'ti' : persona?.name} en primer plano` : undefined}
      style={ancho ? { width: ancho, height: ancho / 0.75 } : undefined}
      className={`relative overflow-hidden bg-black/40 ${
        lleno ? 'h-full w-full' : 'shrink-0'
      } ${grande ? '' : 'rounded-xl2 border'} ${
        grande ? '' : hablando ? 'border-read' : 'border-white/15'
      }`}
    >
      {hayImagen
        ? <Video stream={stream} className={`h-full w-full object-cover ${mio ? 'scale-x-[-1]' : ''}`} mudo={mio} />
        : (
          <span className="flex h-full w-full items-center justify-center">
            <Avatar jugador={persona} size={grande ? 120 : 40} className="border-white/15" />
          </span>
        )}

      <span className={`pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent ${
        grande ? 'px-5 pb-4 pt-14' : 'px-2 pb-1.5 pt-6'
      }`}>
        <span className={`truncate font-medium text-white ${grande ? 'font-display text-lg' : 'text-[11px]'}`}>
          {mio ? 'Tú' : persona?.name}
        </span>
        {mudo && <IconMicroOff className={`shrink-0 text-white/70 ${grande ? 'h-4 w-4' : 'h-3 w-3'}`} />}
        {hablando && <OndaHablando />}
      </span>
    </Etiqueta>
  )
}

function OndaHablando() {
  return (
    <span className="flex items-end gap-[2px]" aria-label="Hablando">
      {[0, 0.15, 0.3].map(retraso => (
        <motion.span
          key={retraso}
          className="w-[2.5px] rounded-full bg-read"
          animate={{ height: [4, 11, 4] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: retraso, ease: 'easeInOut' }}
        />
      ))}
    </span>
  )
}

function Mandos({ conVideo, mudo, sinCamara, onMudo, onCamara, onSalir }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-black/60 to-transparent px-4 pt-14 pb-safe">
      <div className="pointer-events-auto mb-4 flex items-center gap-3 rounded-full border border-white/10 bg-black/40 px-3 py-2.5 backdrop-blur-xl">
        <Mando activo={!mudo} onClick={onMudo} etiqueta={mudo ? 'Activar micrófono' : 'Silenciar micrófono'}>
          {mudo ? <IconMicroOff className="h-5 w-5" /> : <IconMicro className="h-5 w-5" />}
        </Mando>
        {conVideo && (
          <Mando activo={!sinCamara} onClick={onCamara} etiqueta={sinCamara ? 'Encender cámara' : 'Apagar cámara'}>
            {sinCamara ? <IconVideoCamaraOff className="h-5 w-5" /> : <IconVideoCamara className="h-5 w-5" />}
          </Mando>
        )}
        <motion.button
          onClick={onSalir}
          whileTap={{ scale: 0.9 }}
          aria-label="Salir de la llamada"
          style={{ background: ROJO_COLGAR }}
          className="ml-1 flex h-12 w-12 items-center justify-center rounded-full text-white"
        >
          <IconColgar className="h-5 w-5" />
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
      className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
        activo ? 'bg-white/15 text-white' : 'bg-white text-[#0d0b09]'
      }`}
    >
      {children}
    </motion.button>
  )
}

// Mide el hueco disponible y se entera cuando cambia (girar el móvil, cambiar
// el tamaño de la ventana): las columnas dependen de la forma, no solo de
// cuánta gente hay.
//
// El nodo va en ESTADO y no en un ref, y el efecto depende de él. Con un ref,
// el efecto no tiene de qué depender: o se queda sin lista de dependencias y
// corre en cada render —llamando a setCaja, que provoca otro render, que vuelve
// a correrlo: bucle infinito, y React lo corta con "Maximum update depth
// exceeded"— o se queda con lista vacía y nunca ve el nodo. Con estado, el
// efecto corre exactamente una vez por nodo.
//
// Y la medida solo se guarda si ha cambiado de verdad: el ResizeObserver avisa
// también de cambios de menos de un píxel, y cada aviso sería otro render.
function usarMedida() {
  const [caja, setCaja] = useState({ ancho: 0, alto: 0 })
  const [nodo, setNodo] = useState(null)

  useLayoutEffect(() => {
    if (!nodo) return
    const actualizar = () => {
      const r = nodo.getBoundingClientRect()
      setCaja(previa => (
        Math.abs(previa.ancho - r.width) < 1 && Math.abs(previa.alto - r.height) < 1
          ? previa
          : { ancho: r.width, alto: r.height }
      ))
    }
    actualizar()
    const observador = new ResizeObserver(actualizar)
    observador.observe(nodo)
    return () => observador.disconnect()
  }, [nodo])

  return [caja, setNodo]
}
