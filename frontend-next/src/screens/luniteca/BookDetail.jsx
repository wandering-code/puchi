import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { totalPages } from './shelf'
import { Cover, EditableRating, ProgressBar } from './piezas'
import { EditorCarpeta, EditorEstado, EditorFechas, EditorLecturas, Sinopsis } from './editores'
import { IconArrowLeft } from '../../ui/icons'

// Distribución tomada de la Luniteca nueva de la Puchi actual: portada grande
// centrada, título y autor debajo, la ficha técnica en una línea y los datos
// que se pueden cambiar como pastillas que abren su propio editor — en vez de
// una lista de bloques con encabezados, que era lo de antes y se parecía más a
// la Luniteca vieja. Lo que se toca es el dato en sí.
export default function BookDetail({ entry, carpetas, onCerrar, onActualizar }) {
  const libro = entry.book
  const paginas = totalPages(entry)

  // Puntuar algo que aún no has empezado no significa nada; en cuanto se ha
  // leído (o se ha dejado a medias) sí.
  const puedePuntuar = entry.status !== 'want_to_read'
  const llevaProgreso = ['reading', 'rereading', 'read'].includes(entry.status)
  const llevaLecturas = ['read', 'rereading'].includes(entry.status)

  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-bg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* El botón de volver flota sobre la portada en vez de ocupar una barra
          propia: así la portada empieza arriba del todo y la ficha se lee como
          una página, no como una pantalla con cabecera. */}
      <div className="pointer-events-none sticky top-0 z-10 flex justify-between px-3 pt-safe">
        <motion.button
          onClick={onCerrar}
          aria-label="Volver a la estantería"
          whileTap={{ scale: 0.92 }}
          className="pointer-events-auto mt-3 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface/90 text-ink shadow-sm backdrop-blur"
        >
          <IconArrowLeft className="h-5 w-5" />
        </motion.button>
      </div>

      <div className="mx-auto w-full max-w-md px-6 pb-kb">
        <div className="flex flex-col items-center text-center">
          <motion.div layoutId={`portada-${entry.id}`} className="w-[168px] shrink-0">
            <Cover
              url={libro.cover_url}
              title={libro.title}
              priority
              className="shadow-[0_6px_14px_rgba(60,40,20,0.18),0_18px_34px_-16px_rgba(60,40,20,0.4)]"
            />
          </motion.div>

          <h2 className="mt-5 font-display text-[1.6rem] font-bold leading-tight tracking-[-0.02em]">
            {libro.title}
          </h2>
          {libro.author && <p className="mt-1.5 text-[15px] text-ink-dim">{libro.author}</p>}

          {/* La ficha técnica del libro, que no se edita desde aquí: es del
              libro compartido, no de tu copia. */}
          {(libro.genre || libro.year || paginas) && (
            <p className="mt-3 text-xs text-ink-mute">
              {[libro.genre, libro.year, paginas && `${paginas} pág.`].filter(Boolean).join(' · ')}
            </p>
          )}

          {/* Y esto sí es tuyo: cada pastilla enseña su valor y se toca para
              cambiarlo. */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <EditorEstado entry={entry} onActualizar={onActualizar} />
            <EditorFechas entry={entry} onActualizar={onActualizar} />
            <EditorCarpeta entry={entry} carpetas={carpetas} onActualizar={onActualizar} />
            {llevaLecturas && <EditorLecturas entry={entry} onActualizar={onActualizar} />}
          </div>

          {puedePuntuar && (
            <div className="mt-5 flex flex-col items-center gap-1.5">
              <EditableRating rating={entry.rating} onChange={r => onActualizar({ rating: r })} size={26} />
              <span className="text-xs text-ink-mute">
                {entry.rating ? `Tu nota: ${entry.rating.toLocaleString('es')}` : 'Sin puntuar'}
              </span>
            </div>
          )}

          {llevaProgreso && (
            <div className="mt-6 w-full">
              <EditorProgreso entry={entry} onActualizar={onActualizar} />
            </div>
          )}
        </div>

        <div className="mt-9">
          <Apartado titulo="Sinopsis">
            <Sinopsis texto={libro.synopsis} />
          </Apartado>

          <Apartado titulo="Tus notas">
            <EditorNotas notes={entry.notes} onGuardar={notes => onActualizar({ notes })} />
          </Apartado>
        </div>
      </div>
    </motion.div>,
    document.body,
  )
}

function Apartado({ titulo, children }) {
  return (
    <section className="mb-8">
      <h3 className="mb-2.5 text-[11px] uppercase tracking-[0.14em] text-ink-mute">{titulo}</h3>
      {children}
    </section>
  )
}

// Página actual con barra arrastrable. El PATCH no se manda en cada píxel del
// arrastre — solo al soltar — para no disparar cien peticiones por gesto; lo
// que se ve mientras tanto es estado local.
function EditorProgreso({ entry, onActualizar }) {
  const total = totalPages(entry)
  const [arrastrando, setArrastrando] = useState(null)
  const pagina = arrastrando ?? entry.current_page ?? Math.round((entry.progress || 0) * (total || 0))

  if (!total) {
    return (
      <p className="text-center text-xs text-ink-mute">
        Sin número de páginas no se puede llevar la cuenta de por dónde vas.
      </p>
    )
  }

  function confirmar(valor) {
    setArrastrando(null)
    if (valor !== entry.current_page) onActualizar({ current_page: valor })
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="font-display text-lg font-bold">{Math.round((pagina / total) * 100)}%</p>
        <p className="text-xs text-ink-mute">{pagina} / {total} pág.</p>
      </div>

      <ProgressBar entry={{ ...entry, current_page: pagina }} className="mt-2" />

      <input
        type="range"
        min={0}
        max={total}
        value={pagina}
        onChange={e => setArrastrando(Number(e.target.value))}
        onPointerUp={e => confirmar(Number(e.currentTarget.value))}
        onKeyUp={e => confirmar(Number(e.currentTarget.value))}
        aria-label="Página actual"
        className="mt-2 h-10 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-9px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow"
      />

      <div className="flex gap-2">
        {[-10, -1, 1, 10].map(paso => (
          <button
            key={paso}
            onClick={() => confirmar(Math.min(Math.max(pagina + paso, 0), total))}
            className="h-9 flex-1 rounded-xl2 border border-line text-sm text-ink-dim transition-colors active:bg-surface-2"
          >
            {paso > 0 ? `+${paso}` : paso}
          </button>
        ))}
      </div>
    </div>
  )
}

// Se guarda al salir del campo, no en cada tecla: escribir una nota larga son
// cientos de pulsaciones y no hace falta un PATCH por cada una.
function EditorNotas({ notes, onGuardar }) {
  const [texto, setTexto] = useState(notes || '')
  const [guardado, setGuardado] = useState(false)
  const guardadoPrevio = useRef(notes || '')

  // Si la nota cambia desde otro dispositivo mientras esta ficha está abierta,
  // se adopta — salvo que se esté escribiendo aquí algo distinto sin guardar.
  useEffect(() => {
    if (texto === guardadoPrevio.current) {
      setTexto(notes || '')
      guardadoPrevio.current = notes || ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes])

  function alSalir() {
    if (texto === guardadoPrevio.current) return
    guardadoPrevio.current = texto
    onGuardar(texto)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 1800)
  }

  return (
    <div>
      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        onBlur={alSalir}
        rows={4}
        placeholder="Lo que te haya parecido, citas, por dónde ibas…"
        className="w-full resize-none rounded-xl2 border border-line bg-surface p-3 text-[15px] leading-relaxed outline-none transition-colors placeholder:text-ink-mute focus:border-accent-line"
      />
      <AnimatePresence>
        {guardado && (
          <motion.p
            className="mt-1 text-xs text-read"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            Guardado
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
