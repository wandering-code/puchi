import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { statusPatch, totalPages } from './shelf'
import { Cover, EditableRating, MANTENER_MS, ProgressBar } from './piezas'
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

  // La ficha sube desde abajo, como los filtros y los editores: en esta app
  // todo lo que se abre encima de algo llega por el mismo sitio.
  //
  // Se cierra tirando hacia abajo, pero la ficha también scrollea, así que el
  // arrastre solo se escucha con el contenido arriba del todo — que es como se
  // comportan las hojas nativas. Si no, bajar por la sinopsis la cerraría en
  // vez de dejar leerla.
  const [arriba, setArriba] = useState(true)

  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain rounded-t-[28px] border-t border-line bg-bg"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 420, damping: 40 }}
      onScroll={(ev) => setArriba(ev.currentTarget.scrollTop <= 0)}
      drag="y"
      dragListener={arriba}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.4 }}
      dragMomentum={false}
      onDragEnd={(_, info) => { if (info.offset.y > 110 || info.velocity.y > 550) onCerrar() }}
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
          <div className="w-[168px] shrink-0">
            <Cover
              url={libro.cover_url}
              title={libro.title}
              priority
              className="shadow-[0_6px_14px_rgba(60,40,20,0.18),0_18px_34px_-16px_rgba(60,40,20,0.4)]"
            />
          </div>

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

          {/* Sin número debajo: la nota ya se lee en las propias estrellas. */}
          {puedePuntuar && (
            <div className="mt-5">
              <EditableRating rating={entry.rating} onChange={r => onActualizar({ rating: r })} size={26} />
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

// Mismo gesto que la puntuación: mantener pulsado, arrastrar, soltar guarda.
//
// El arrastre va por DESPLAZAMIENTO (3px por página) y no por la posición
// absoluta del dedo sobre la barra: así la precisión no depende de lo ancha
// que quepa la barra en el móvil, se puede seguir afinando más allá de su
// borde, y si un gesto no basta, soltar y volver a mantener sigue ajustando
// desde donde se quedó en vez de reiniciar.
const PX_POR_PAGINA = 3
const ZOOM_PROGRESO = 1.3

function EditorProgreso({ entry, onActualizar }) {
  const total = totalPages(entry)
  const [editando, setEditando] = useState(false)
  const [previa, setPrevia] = useState(null)
  const barra = useRef(null)
  const temporizador = useRef(null)
  const arrastrando = useRef(false)
  const xInicial = useRef(0)
  const paginaInicial = useRef(0)

  // Un libro marcado como leído no siempre tiene página guardada (puede
  // haberse marcado por otra vía): para la barra, se da por hecho el total.
  const paginaBase = entry.current_page ?? (entry.status === 'read' ? total : 0)
  const pagina = editando ? previa : paginaBase

  function terminar(guardar) {
    clearTimeout(temporizador.current)
    if (!arrastrando.current) return
    arrastrando.current = false
    setEditando(false)
    if (guardar && previa != null && previa !== paginaBase) {
      if (previa >= total && entry.status !== 'read') {
        // Llegar al final arrastrando es, en la práctica, decir "lo he
        // terminado": se aplican las mismas reglas que al cambiar el estado a
        // mano (fecha de fin, suma una lectura).
        onActualizar(statusPatch('read', entry))
      } else if (previa < total && entry.status === 'read') {
        // Y al revés, bajar del final en uno ya leído lo devuelve a "leyendo"
        // — nunca a "releyendo", que eso es una decisión que se toma a mano.
        onActualizar({ ...statusPatch('reading', entry), current_page: previa })
      } else {
        onActualizar({ current_page: previa })
      }
    }
    setPrevia(null)
  }

  if (!total) {
    return (
      <p className="text-center text-xs text-ink-mute">
        Sin número de páginas no se puede llevar la cuenta de por dónde vas.
      </p>
    )
  }

  return (
    <motion.div
      ref={barra}
      onPointerDown={(ev) => {
        temporizador.current = setTimeout(() => {
          arrastrando.current = true
          setEditando(true)
          xInicial.current = ev.clientX
          paginaInicial.current = paginaBase
          setPrevia(paginaBase)
          try { barra.current.setPointerCapture(ev.pointerId) } catch { /* el navegador puede negarlo */ }
        }, MANTENER_MS)
      }}
      onPointerMove={(ev) => {
        if (!arrastrando.current) return
        const paginas = (ev.clientX - xInicial.current) / PX_POR_PAGINA
        setPrevia(Math.round(Math.max(0, Math.min(total, paginaInicial.current + paginas))))
      }}
      onPointerUp={() => terminar(true)}
      onPointerCancel={() => terminar(false)}
      onContextMenu={(ev) => { if (editando) ev.preventDefault() }}
      animate={{ scale: editando ? ZOOM_PROGRESO : 1 }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      title="Mantén pulsado para ajustar el progreso"
      className="mx-auto w-full max-w-[300px] touch-none select-none rounded-xl2 border border-line px-3 py-2.5"
    >
      <div className={`mb-1.5 flex justify-between text-xs ${editando ? 'font-bold text-accent' : 'text-ink-dim'}`}>
        <span>Pág. {pagina} de {total}</span>
        <span>{Math.round((pagina / total) * 100)}%</span>
      </div>
      <ProgressBar entry={{ ...entry, current_page: pagina }} />
    </motion.div>
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
