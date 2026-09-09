import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../../platform/api'
import { useAuth } from '../../platform/auth'
import { readingDatesLabel, statusPatch, totalPages } from './shelf'
import { Chip, Cover, EditableRating, MANTENER_MS, ProgressBar, StarRating, StatusChip } from './piezas'
import { EditorCarpeta, EditorEstado, EditorFechas, EditorLecturas, Sinopsis } from './editores'
import { IconArrowLeft, IconPencil } from '../../ui/icons'
import BookEditForm from './BookEditForm'
import PantallaInferior from './PantallaInferior'

// Distribución tomada de la Luniteca nueva de la Puchi actual: portada grande
// centrada, título y autor debajo, la ficha técnica en una línea y los datos
// que se pueden cambiar como pastillas que abren su propio editor — en vez de
// una lista de bloques con encabezados, que era lo de antes y se parecía más a
// la Luniteca vieja. Lo que se toca es el dato en sí.
// `soloLectura` es para la estantería de otra persona: los mismos datos, sin
// poder tocar nada. Las notas privadas no llegan siquiera (el backend las quita
// de las entradas ajenas), así que aquí no hay nada que esconder: se cambian
// los editores por su valor a secas y se ofrece guardarse el libro.
export default function BookDetail({
  entry, carpetas, generos, onCerrar, onActualizar, onGuardarLibro, onSubirPortada, onEliminar,
  vuelo = null, soloLectura = false, deQuien = null, onGuardarEnMiEstanteria,
}) {
  const libro = entry.book
  const paginas = totalPages(entry)

  // Puntuar algo que aún no has empezado no significa nada; en cuanto se ha
  // leído (o se ha dejado a medias) sí.
  const puedePuntuar = entry.status !== 'want_to_read'
  const llevaProgreso = ['reading', 'rereading', 'read'].includes(entry.status)
  const llevaLecturas = ['read', 'rereading'].includes(entry.status)

  // Los datos del libro (título, autor, portada…) se editan en un formulario
  // aparte, que sustituye al contenido de la ficha: son datos compartidos con
  // todo el club, no como el estado o las notas, que se tocan en el sitio.
  const [editando, setEditando] = useState(false)

  return (
    <PantallaInferior
      onCerrar={onCerrar}
      // Abierta desde la estantería, la ficha no sube: el libro vuela hasta
      // ella y la ficha se descubre cuando aterriza (ver VueloDelLibro).
      aparicion={vuelo ? 'fundido' : 'subir'}
      visible={!vuelo || vuelo.sentido !== 'vuelta'}
      cabecera={
        /* El botón de volver flota sobre la portada en vez de ocupar una barra
           propia: así la portada empieza arriba del todo y la ficha se lee como
           una página, no como una pantalla con cabecera. */
        <div className="pointer-events-none sticky top-0 z-10 flex justify-between px-3">
          {/* Editando, la flecha sale de la edición y no de la ficha: si cerrara
              del todo se perderían los cambios sin avisar. */}
          <motion.button
            onClick={() => (editando ? setEditando(false) : onCerrar())}
            aria-label={editando ? 'Descartar cambios' : 'Volver a la estantería'}
            whileTap={{ scale: 0.92 }}
            className="pointer-events-auto mt-1 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface/90 text-ink shadow-sm backdrop-blur"
          >
            <IconArrowLeft className="h-5 w-5" />
          </motion.button>
          {!editando && !soloLectura && (
            <motion.button
              onClick={() => setEditando(true)}
              aria-label="Editar los datos del libro"
              whileTap={{ scale: 0.92 }}
              className="pointer-events-auto mt-1 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface/90 text-ink shadow-sm backdrop-blur"
            >
              <IconPencil className="h-[18px] w-[18px]" />
            </motion.button>
          )}
        </div>
      }
    >
      {editando ? (
        <BookEditForm
          entry={entry}
          generos={generos}
          onCancelar={() => setEditando(false)}
          onSubirPortada={onSubirPortada}
          onEliminar={onEliminar}
          onGuardar={async (borrador) => { await onGuardarLibro(borrador); setEditando(false) }}
        />
      ) : (
      <div className="mx-auto w-full max-w-md px-6 pb-kb">
        <div className="flex flex-col items-center text-center">
          {/* La marca es para la animación de abrir desde la estantería: ahí
              es donde tiene que aterrizar el libro que sale volando. */}
          {/* Con el libro en vuelo, su hueco espera vacío: la portada de la
              ficha aparece justo cuando el libro aterriza encima, y así no se
              ven las dos a la vez. */}
          {/* Sin fundido a propósito: el libro aterriza justo encima y con el
              mismo tamaño, así que el relevo es invisible si se hace de golpe.
              Con una transición quedaba un parpadeo con el hueco vacío, entre
              que el libro se retira y la portada acaba de aparecer. */}
          <div
            className="w-[168px] shrink-0"
            data-portada-ficha
            style={{ opacity: vuelo && !vuelo.aterrizado ? 0 : 1 }}
          >
            <Cover
              url={libro.cover_url}
              title={libro.title}
              priority
              relieve
              className="shadow-[0_6px_14px_rgba(60,40,20,0.18),0_18px_34px_-16px_rgba(60,40,20,0.4)]"
            />
          </div>

          <h2 className="mt-5 font-display text-[1.6rem] font-bold leading-tight tracking-[-0.02em]">
            {libro.title}
          </h2>
          {libro.author && <p className="mt-1.5 text-[15px] text-ink-dim">{libro.author}</p>}

          {/* De quién es lo que se está mirando. Sin esto, la ficha de otra
              persona es idéntica a la tuya salvo por lo que no deja tocar, y
              no se sabe de quién son esas fechas ni esa nota. */}
          {soloLectura && deQuien && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-ink-mute">
              <span
                className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full text-[11px]"
                style={{ background: deQuien.color || 'var(--color-surface-2)' }}
              >
                {deQuien.avatar_url
                  ? <img src={deQuien.avatar_url} alt="" className="h-full w-full object-cover" />
                  : <span>{deQuien.avatar_emoji || '⭐'}</span>}
              </span>
              En la estantería de {deQuien.name}
            </p>
          )}

          {/* La ficha técnica del libro, que no se edita desde aquí: es del
              libro compartido, no de tu copia. */}
          {(libro.genre || libro.year || paginas) && (
            <p className="mt-3 text-xs text-ink-mute">
              {[libro.genre, libro.year, paginas && `${paginas} pág.`].filter(Boolean).join(' · ')}
            </p>
          )}

          {/* Y esto sí es tuyo: cada pastilla enseña su valor y se toca para
              cambiarlo. En la estantería de otro, las mismas pastillas sin
              tocar nada. */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {soloLectura ? (
              <>
                <StatusChip status={entry.status} />
                {readingDatesLabel(entry) && <Chip>{readingDatesLabel(entry)}</Chip>}
                {entry.folder && <Chip>{entry.folder}</Chip>}
                {llevaLecturas && entry.times_read > 1 && <Chip>{entry.times_read} lecturas</Chip>}
              </>
            ) : (
              <>
                <EditorEstado entry={entry} onActualizar={onActualizar} />
                <EditorFechas entry={entry} onActualizar={onActualizar} />
                <EditorCarpeta entry={entry} carpetas={carpetas} onActualizar={onActualizar} />
                {llevaLecturas && <EditorLecturas entry={entry} onActualizar={onActualizar} />}
              </>
            )}
          </div>

          {/* Sin número debajo: la nota ya se lee en las propias estrellas. */}
          {puedePuntuar && (
            <div className="mt-5">
              {soloLectura
                ? (entry.rating > 0
                    ? <StarRating rating={entry.rating} size={22} />
                    : <p className="text-xs text-ink-mute">Sin puntuar</p>)
                : <EditableRating rating={entry.rating} onChange={r => onActualizar({ rating: r })} size={26} />}
            </div>
          )}

          {llevaProgreso && (
            <div className="mt-6 w-full">
              {soloLectura
                ? <ProgressBar entry={entry} />
                : <EditorProgreso entry={entry} onActualizar={onActualizar} />}
            </div>
          )}

          {/* Lo que se puede hacer con el libro de otro: quedárselo. */}
          {soloLectura && onGuardarEnMiEstanteria && (
            <button
              onClick={onGuardarEnMiEstanteria}
              className="mt-7 flex h-12 w-full items-center justify-center rounded-xl2 bg-accent text-[15px] font-semibold text-on-accent transition-transform active:scale-[0.99]"
            >
              Añadir a mi estantería
            </button>
          )}
        </div>

        <div className="mt-9">
          <Apartado titulo="Sinopsis">
            <Sinopsis texto={libro.synopsis} />
          </Apartado>

          {!soloLectura && (
            <Apartado titulo="Tus notas">
              <EditorNotas notes={entry.notes} onGuardar={notes => onActualizar({ notes })} />
            </Apartado>
          )}

          <OtrasLecturas libroId={libro.id} />
        </div>
        </div>
      )}
    </PantallaInferior>
  )
}

// Quién más tiene este libro y qué le pareció. Es el puente entre tu
// estantería y la de los demás: desde aquí se llega a su registro.
function OtrasLecturas({ libroId }) {
  const { player } = useAuth()
  const navegar = useNavigate()
  const [otras, setOtras] = useState(null)

  useEffect(() => {
    let vigente = true
    api(`/books/${libroId}/lecturas`)
      .then(todas => { if (vigente) setOtras(todas.filter(l => l.player?.id !== player?.id)) })
      .catch(() => { if (vigente) setOtras([]) })
    return () => { vigente = false }
  }, [libroId, player?.id])

  if (!otras?.length) return null

  return (
    <Apartado titulo={otras.length === 1 ? 'Alguien más lo ha leído' : 'Otros que lo han leído'}>
      <ul className="flex flex-col divide-y divide-[color:var(--color-line)]">
        {otras.map(l => (
          <li key={l.id}>
            <button
              onClick={() => navegar(`/quien/${l.player.id}?libro=${libroId}`)}
              className="flex w-full items-center gap-3 py-2.5 text-left"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm"
                style={{ background: l.player.color || 'var(--color-surface-2)' }}
              >
                {l.player.avatar_url
                  ? <img src={l.player.avatar_url} alt="" className="h-full w-full object-cover" />
                  : <span>{l.player.avatar_emoji || '⭐'}</span>}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{l.player.name}</span>
                <span className="block text-xs text-ink-mute">
                  {readingDatesLabel(l) || ESTADOS_TEXTO[l.status] || ''}
                </span>
              </span>
              {l.rating > 0 && <StarRating rating={l.rating} />}
            </button>
          </li>
        ))}
      </ul>
    </Apartado>
  )
}

const ESTADOS_TEXTO = {
  reading:   'Leyéndolo ahora',
  rereading: 'Releyéndolo',
  to_read:   'Lo tiene pendiente',
  dropped:   'Lo dejó a medias',
  read:      'Leído',
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
