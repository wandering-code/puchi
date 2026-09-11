import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useChat } from '../../platform/chat'
import { useLlamadas } from '../../platform/llamadas'
import Avatar from '../../ui/Avatar'
import { LLEGADA, SALIDA } from '../../ui/curvas'
import { IconClub, IconColgar, IconMicroOff } from '../../ui/icons'
import { Cronometro, Video } from './Llamada'

// La llamada encogida: una pastilla que te sigue por Puchi.
//
// Es la pieza que hace que una llamada no sea una cárcel. Con ella puedes
// mirar la Luniteca, consultar hasta qué página toca leer o buscar un libro
// mientras hablas — la llamada no se corta ni se queda atrás, se aparta.
//
// Abajo a la derecha y flotando por encima de todo, pero por debajo de los
// avisos (z-64 contra z-70): si entra un mensaje mientras hablas, el aviso
// manda.
//
// Tocarla devuelve el escenario. Colgar está en la propia pastilla porque, si
// no, terminar una llamada obligaría a volver a la pantalla entera solo para
// eso.

export default function PastillaLlamada() {
  const { estado, conQuien, tipo, suVideo, mudo, suCamaraApagada, encogida, agrandar, colgar, grupo } = useLlamadas()
  const { jugadores } = useChat() || {}

  // La misma pastilla para las dos clases de llamada: lo único que cambia es a
  // quién enseña y qué hace el botón rojo (colgar o salirse).
  const enGrupo = grupo.dentro
  const aLaVista = (estado === 'activa' || enGrupo) && encogida

  const quienSale = enGrupo
    ? (jugadores || []).find(p => p.id === grupo.quienHabla) || null
    : conQuien
  const streamQueSale = enGrupo ? grupo.streams[grupo.quienHabla] : suVideo
  const tipoDeLlamada = enGrupo ? grupo.tipo : tipo
  const camaraApagada = enGrupo ? grupo.camarasApagadas[grupo.quienHabla] : suCamaraApagada
  const estoyMudo = enGrupo ? grupo.mudo : mudo
  const salirse = enGrupo ? grupo.salir : colgar
  const hayImagen = tipoDeLlamada === 'video' && streamQueSale && !camaraApagada

  return createPortal(
    <AnimatePresence>
      {aLaVista && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.9, transition: SALIDA }}
          transition={LLEGADA}
          // Arrastrable: en un móvil estrecho, una pastilla fija abajo a la
          // derecha tapa justo el botón de añadir libro de la Luniteca.
          drag
          dragMomentum={false}
          dragElastic={0.1}
          className="fixed bottom-4 right-4 z-[64] flex items-center gap-2 rounded-full border border-line bg-surface/95 py-1.5 pl-1.5 pr-2 sombra-panel backdrop-blur-xl"
        >
          <button
            onClick={agrandar}
            aria-label={enGrupo ? 'Volver a la llamada del club' : `Volver a la llamada con ${conQuien?.name}`}
            className="flex items-center gap-2.5 pr-1"
          >
            <span className="relative">
              {hayImagen ? (
                <span className="block h-11 w-11 overflow-hidden rounded-full border border-line">
                  <Video stream={streamQueSale} className="h-full w-full object-cover" mudo />
                </span>
              ) : quienSale ? (
                <Avatar jugador={quienSale} size={44} />
              ) : (
                // En el club, mientras no hable nadie todavía: el icono del
                // club en vez de una cara al azar.
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <IconClub className="h-5 w-5" />
                </span>
              )}
              {/* El punto de "estás en directo": late, para que no parezca una
                  tarjeta muerta olvidada en la esquina. */}
              <motion.span
                className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-read"
                animate={{ opacity: [1, 0.45, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
            </span>

            <span className="min-w-0 text-left">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold">
                  {enGrupo ? `El club · ${grupo.ids.length}` : conQuien?.name}
                </span>
                {estoyMudo && <IconMicroOff className="h-3.5 w-3.5 shrink-0 text-ink-mute" />}
              </span>
              <span className="block text-[11px] text-ink-mute"><Cronometro /></span>
            </span>
          </button>

          <motion.button
            onClick={salirse}
            whileTap={{ scale: 0.9 }}
            aria-label={enGrupo ? 'Salir de la llamada' : 'Colgar'}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger text-white"
          >
            <IconColgar className="h-[18px] w-[18px]" />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
