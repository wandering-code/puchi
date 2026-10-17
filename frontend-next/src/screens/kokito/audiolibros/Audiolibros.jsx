import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../../../platform/api'
import { esAdmin, useAuth } from '../../../platform/auth'
import { useCapa } from '../../../platform/capas'
import { Cover } from '../../luniteca/piezas'
import { IconAudiolibro, IconEnlace, IconSubir } from '../../../ui/icons'
import FichaAudiolibro from './FichaAudiolibro'
import { capitulos, duracion } from './formato'

// Audiolibros, la parte del admin (fase 1, issue #63 de puchi): subir el
// EPUB, repasar sus capítulos y enlazarlo con los libros del catálogo. Aquí
// todavía no se genera audio; cada audiolibro se queda en "Borrador".

const ENTRA = { duration: 0.24, ease: [0.22, 1, 0.36, 1] }

export default function Audiolibros() {
  const { player } = useAuth()
  const [lista, setLista] = useState(null)
  const [error, setError] = useState(null)
  const [subiendo, setSubiendo] = useState(null) // nombre del archivo
  const ficha = useCapa(null) // id del audiolibro abierto
  const entrada = useRef(null)

  const cargar = useCallback(() => {
    api('/audiobooks')
      .then(l => { setLista(l); setError(null) })
      .catch(e => { setLista([]); setError(e.message) })
  }, [])
  useEffect(() => { cargar() }, [cargar])

  async function subir(archivo) {
    if (!archivo) return
    setSubiendo(archivo.name)
    setError(null)
    const datos = new FormData()
    datos.append('epub_file', archivo)
    try {
      const nuevo = await api('/audiobooks', { method: 'POST', body: datos })
      setLista(l => [nuevo, ...(l || [])])
      ficha.abrir(nuevo.id)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubiendo(null)
      if (entrada.current) entrada.current.value = ''
    }
  }

  // La ficha avisa de cada cambio con el audiolibro entero: la tarjeta de la
  // lista se pone al día sin volver a pedirla.
  const alCambiar = useCallback((ab) => {
    setLista(l => (l || []).map(x => (x.id === ab.id ? { ...x, ...ab } : x)))
  }, [])
  const alBorrar = useCallback((id) => {
    setLista(l => (l || []).filter(x => x.id !== id))
  }, [])

  if (!esAdmin(player)) {
    return (
      <div className="py-8">
        <h2 className="font-display text-[1.75rem] font-bold tracking-[-0.02em]">Audiolibros</h2>
        <p className="mt-2 text-sm text-ink-dim">Esta parte es solo del admin.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl py-6">
      <header className="mb-5">
        <h2 className="font-display text-[1.75rem] font-bold tracking-[-0.02em]">Audiolibros</h2>
        <p className="mt-1 text-sm text-ink-dim">El EPUB, sus capítulos y con qué libros va cada uno.</p>
      </header>

      <input
        ref={entrada}
        type="file"
        accept=".epub,application/epub+zip"
        className="hidden"
        onChange={e => subir(e.target.files?.[0])}
      />

      {/* Subir es lo primero que se hace aquí, y casi lo único que se hace sin
          un audiolibro delante: va arriba y a todo el ancho. */}
      <motion.button
        onClick={() => entrada.current?.click()}
        disabled={!!subiendo}
        whileTap={subiendo ? undefined : { scale: 0.985 }}
        className="relative flex w-full items-center gap-4 overflow-hidden rounded-xl3 border border-dashed border-accent-line bg-accent-soft/60 px-5 py-4 text-left disabled:cursor-wait"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-sm">
          {subiendo ? <Girando /> : <IconSubir className="h-5 w-5" />}
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-ink">{subiendo ? 'Leyendo el EPUB…' : 'Subir un EPUB'}</span>
          <span className="mt-0.5 block truncate text-xs text-ink-dim">
            {subiendo || 'Salen solos el título, el autor, la portada y los capítulos'}
          </span>
        </span>
        {subiendo && (
          <motion.span
            className="absolute inset-x-0 bottom-0 h-0.5 bg-accent"
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 0.9 }}
            transition={{ duration: 6, ease: [0.1, 0.6, 0.3, 1] }}
          />
        )}
      </motion.button>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 rounded-xl2 bg-danger/10 px-4 py-2.5 text-sm text-danger"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {lista === null && (
        <div className="mt-5 space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[104px] animate-pulse rounded-xl2 bg-surface-2" />
          ))}
        </div>
      )}

      {lista?.length === 0 && !subiendo && (
        <div className="mt-14 flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-ink-mute">
            <IconAudiolibro className="h-8 w-8" />
          </span>
          <p className="mt-4 font-display text-lg font-bold">Todavía no hay ninguno</p>
          <p className="mt-1 max-w-xs text-sm text-ink-dim">
            Sube el EPUB de un libro para empezar a prepararlo.
          </p>
        </div>
      )}

      <div className="mt-5 space-y-2.5">
        <AnimatePresence initial={false} mode="popLayout">
          {(lista || []).map(ab => (
            <motion.div
              key={ab.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={ENTRA}
            >
              <Tarjeta ab={ab} onAbrir={() => ficha.abrir(ab.id)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <FichaAudiolibro
        id={ficha.abierta}
        onCerrar={ficha.cerrar}
        onCambiar={alCambiar}
        onBorrar={alBorrar}
      />
    </div>
  )
}

function Tarjeta({ ab, onAbrir }) {
  const enlazados = ab.books.length
  return (
    <motion.button
      onClick={onAbrir}
      whileTap={{ scale: 0.985 }}
      className="flex w-full items-start gap-4 rounded-xl2 border border-line bg-surface p-3 text-left shadow-[0_1px_0_rgb(var(--color-sombra)/0.04)]"
    >
      <Cover url={ab.cover_url} title={ab.title} className="w-[60px] shrink-0" />
      <div className="min-w-0 flex-1 py-0.5">
        <p className="line-clamp-2 font-display font-bold leading-snug">{ab.title}</p>
        {ab.author && <p className="mt-0.5 truncate text-sm text-ink-dim">{ab.author}</p>}
        <p className="mt-1.5 text-xs tabular-nums text-ink-mute">
          {capitulos(ab.chapters_included)} · {duracion(ab.minutes)}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Etiqueta>Borrador</Etiqueta>
          {enlazados === 0 ? (
            <Etiqueta aviso>Sin libro enlazado</Etiqueta>
          ) : (
            <Etiqueta>
              <IconEnlace className="h-3 w-3" />
              {enlazados === 1 ? '1 libro' : `${enlazados} libros`}
            </Etiqueta>
          )}
        </div>
      </div>
    </motion.button>
  )
}

export function Etiqueta({ children, aviso = false }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        aviso ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink-dim'
      }`}
    >
      {children}
    </span>
  )
}

export function Girando({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} animate-spin`} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.4" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}
