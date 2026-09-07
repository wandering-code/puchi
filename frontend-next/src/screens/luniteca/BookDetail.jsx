import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { STATUS_LABEL, STATUS_ORDER, readingDatesLabel, statusPatch, totalPages } from './shelf'
import { Chip, Cover, EditableRating, ProgressBar, StatusDot } from './piezas'
import { IconArrowLeft, IconChevron } from '../../ui/icons'

export default function BookDetail({ entry, onCerrar, onActualizar }) {
  const libro = entry.book
  const total = totalPages(entry)

  // En un portal a <body>, no dentro de la pantalla: la ficha tapa la app
  // entera, y ahí dentro no puede. El contenedor de la ruta vive dentro de un
  // <main z-10> por debajo de la barra superior <header z-20> del armazón, y
  // el z-index de un hijo nunca escapa del contexto de apilamiento de su
  // padre — se vio en captura, con el título de la ficha y el de la barra
  // pintados uno encima de otro.
  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-bg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <header className="shrink-0 border-b border-line bg-bg/90 backdrop-blur-xl pt-safe">
        <div className="flex h-14 items-center gap-2 px-3">
          <button
            onClick={onCerrar}
            aria-label="Volver a la estantería"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl2 text-ink transition-colors active:bg-surface-2"
          >
            <IconArrowLeft className="h-5 w-5" />
          </button>
          <p className="min-w-0 flex-1 truncate text-sm text-ink-dim">{libro.title}</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-kb">
        <div className="mx-auto w-full max-w-md py-5">
          <div className="flex gap-4">
            {/* Misma layoutId que la portada de la estantería: al abrir, esa
                misma portada crece hasta aquí en vez de aparecer otra. */}
            <motion.div layoutId={`portada-${entry.id}`} className="w-28 shrink-0 sm:w-32">
              <Cover url={libro.cover_url} className="shadow-md" priority />
            </motion.div>

            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl font-semibold leading-tight tracking-[-0.02em]">{libro.title}</h2>
              {libro.author && <p className="mt-1 text-sm text-ink-dim">{libro.author}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {libro.year && <Chip>{libro.year}</Chip>}
                {libro.genre && <Chip>{libro.genre}</Chip>}
                {total && <Chip>{total} pág.</Chip>}
                {entry.times_read > 0 && (
                  <Chip>{entry.times_read} {entry.times_read === 1 ? 'lectura' : 'lecturas'}</Chip>
                )}
                {entry.folder && <Chip>{entry.folder}</Chip>}
              </div>
            </div>
          </div>

          <Bloque titulo="Estado">
            <SelectorEstado
              status={entry.status}
              onCambiar={(nuevo) => onActualizar(statusPatch(nuevo, entry))}
            />
            {readingDatesLabel(entry) && (
              <p className="mt-3 text-xs text-ink-mute">{readingDatesLabel(entry)}</p>
            )}
          </Bloque>

          <Bloque titulo="Tu puntuación">
            <div className="flex items-center gap-3">
              <EditableRating rating={entry.rating} onChange={(r) => onActualizar({ rating: r })} />
              <span className="text-sm text-ink-mute">
                {entry.rating ? entry.rating.toFixed(1).replace('.0', '') : 'Sin puntuar'}
              </span>
            </div>
          </Bloque>

          {['reading', 'rereading'].includes(entry.status) && (
            <Bloque titulo="Progreso">
              <EditorProgreso entry={entry} onActualizar={onActualizar} />
            </Bloque>
          )}

          {libro.synopsis && (
            <Bloque titulo="Sinopsis">
              <Sinopsis texto={libro.synopsis} />
            </Bloque>
          )}

          <Bloque titulo="Tus notas">
            <EditorNotas notes={entry.notes} onGuardar={(notes) => onActualizar({ notes })} />
          </Bloque>
        </div>
      </div>
    </motion.div>,
    document.body,
  )
}

function Bloque({ titulo, children }) {
  return (
    <section className="mt-7">
      <h3 className="mb-2.5 text-[11px] uppercase tracking-[0.14em] text-ink-mute">{titulo}</h3>
      {children}
    </section>
  )
}

function SelectorEstado({ status, onCambiar }) {
  return (
    <div className="flex flex-wrap gap-2">
      {STATUS_ORDER.map(s => {
        const activo = s === status
        return (
          <motion.button
            key={s}
            onClick={() => !activo && onCambiar(s)}
            whileTap={{ scale: 0.96 }}
            className={`relative flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors ${
              activo ? 'border-accent-line text-accent' : 'border-line text-ink-dim'
            }`}
          >
            {activo && (
              // La pastilla se desplaza del estado viejo al nuevo: el cambio se
              // ve como un movimiento, no como dos parpadeos.
              <motion.span
                layoutId="estado-activo"
                className="absolute inset-0 rounded-full bg-accent-soft"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <StatusDot status={s} className="relative" />
            <span className="relative">{STATUS_LABEL[s]}</span>
          </motion.button>
        )
      })}
    </div>
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
    return <p className="text-sm text-ink-mute">Este libro no tiene número de páginas, así que no se puede llevar la cuenta.</p>
  }

  function confirmar(valor) {
    setArrastrando(null)
    if (valor !== entry.current_page) onActualizar({ current_page: valor })
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="font-display text-xl font-semibold">{Math.round((pagina / total) * 100)}%</p>
        <p className="text-sm text-ink-mute">{pagina} / {total} pág.</p>
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
        className="mt-3 h-11 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-surface-2 [&::-webkit-slider-thumb]:mt-[-9px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow"
      />

      <div className="mt-1 flex gap-2">
        {[-10, -1, 1, 10].map(paso => (
          <button
            key={paso}
            onClick={() => confirmar(Math.min(Math.max(pagina + paso, 0), total))}
            className="h-9 flex-1 rounded-xl2 border border-line text-sm text-ink-dim active:bg-surface-2"
          >
            {paso > 0 ? `+${paso}` : paso}
          </button>
        ))}
      </div>
    </div>
  )
}

const LINEAS_SINOPSIS = 6

function Sinopsis({ texto }) {
  const [abierta, setAbierta] = useState(false)
  const [desborda, setDesborda] = useState(false)
  const parrafo = useRef(null)

  // Solo se ofrece "Leer más" si de verdad hay texto cortado: preguntárselo al
  // DOM en vez de contar caracteres, que con la fuente y el ancho reales falla.
  useEffect(() => {
    const el = parrafo.current
    if (el) setDesborda(el.scrollHeight > el.clientHeight + 4)
  }, [texto])

  return (
    <div>
      <motion.p
        ref={parrafo}
        className="overflow-hidden text-[15px] leading-relaxed text-ink-dim"
        initial={false}
        animate={{ WebkitLineClamp: abierta ? 999 : LINEAS_SINOPSIS }}
        style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: LINEAS_SINOPSIS }}
      >
        {texto}
      </motion.p>
      {(desborda || abierta) && (
        <button
          onClick={() => setAbierta(v => !v)}
          className="mt-1.5 flex items-center gap-1 text-sm text-accent"
        >
          {abierta ? 'Leer menos' : 'Leer más'}
          <IconChevron className={`h-3.5 w-3.5 transition-transform ${abierta ? 'rotate-180' : ''}`} />
        </button>
      )}
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
