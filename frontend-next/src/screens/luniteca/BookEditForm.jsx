import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../../platform/api'
import { Cover } from './piezas'
import { useHoja } from './HojaInferior'
import SelectorPortada from './SelectorPortada'
import { IconRefresh, IconX } from '../../ui/icons'
import BotonPeligro from '../../ui/BotonPeligro'

// Editar los datos del LIBRO: título, autor, género, año, páginas, sinopsis y
// portada. Son datos compartidos con todo el club (PATCH /books/{id}), a
// diferencia del estado, las fechas, la puntuación o las notas, que son de tu
// copia y se editan tocándolos directamente en la ficha.
//
// La portada es la excepción: lo que se elige aquí se guarda en TU entrada de
// la estantería, no en el libro, así que cada jugador puede ver la que
// prefiera del mismo libro.
export default function BookEditForm({ entry, generos, onGuardar, onCancelar, onSubirPortada, onEliminar }) {
  const libro = entry.book
  const [borrador, setBorrador] = useState(() => ({
    title: libro.title || '',
    author: libro.author || '',
    genre: libro.genre || '',
    year: libro.year != null ? String(libro.year) : '',
    num_pages: libro.num_pages != null ? String(libro.num_pages) : '',
    synopsis: libro.synopsis || '',
    cover_url: libro.cover_url || '',
  }))
  const [guardando, setGuardando] = useState(false)
  const portada = useHoja()

  const set = (clave) => (ev) => setBorrador(b => ({ ...b, [clave]: ev.target.value }))

  async function guardar() {
    setGuardando(true)
    try {
      await onGuardar(borrador)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-6 pb-kb">
      <div className="flex items-center gap-3 py-4">
        <h2 className="flex-1 font-display text-xl font-bold tracking-[-0.01em]">Editar libro</h2>
        <button
          onClick={onCancelar}
          aria-label="Descartar cambios"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-mute transition-colors active:bg-surface-2"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <motion.button
          onClick={portada.abrir}
          whileTap={{ scale: 0.96 }}
          className="w-24 shrink-0"
          aria-label="Cambiar la portada"
        >
          <Cover url={borrador.cover_url} title={borrador.title} />
        </motion.button>
        <p className="flex-1 text-xs leading-relaxed text-ink-dim">
          Toca la portada para elegir otra o subir una foto. La que elijas la ves solo tú;
          el resto del club sigue con la suya.
        </p>
      </div>

      <RellenarDatos borrador={borrador} setBorrador={setBorrador} />

      <Campo etiqueta="Título">
        <input value={borrador.title} onChange={set('title')} className={ENTRADA + ' font-semibold'} />
      </Campo>

      <Campo etiqueta="Autor">
        <input value={borrador.author} onChange={set('author')} className={ENTRADA} />
      </Campo>

      <Campo etiqueta="Género">
        <input value={borrador.genre} onChange={set('genre')} placeholder="Sin género" className={ENTRADA} />
        {/* Los géneros que ya usas, para tocarlos en vez de escribirlos y no
            acabar con "Novela", "novela" y "Novelas" como tres géneros. */}
        {generos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {generos.map(g => (
              <button
                key={g}
                onClick={() => setBorrador(b => ({ ...b, genre: g }))}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  borrador.genre === g ? 'border-accent-line bg-accent-soft text-accent' : 'border-line text-ink-dim'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        )}
      </Campo>

      <div className="flex gap-3">
        <Campo etiqueta="Año" className="flex-1">
          {/* Campo numérico y no un desplegable de mil años: se escribe antes
              de lo que se busca en una rueda, y no monta mil opciones. */}
          <input
            value={borrador.year}
            onChange={ev => setBorrador(b => ({ ...b, year: ev.target.value.replace(/\D/g, '').slice(0, 4) }))}
            inputMode="numeric"
            placeholder="—"
            className={ENTRADA}
          />
        </Campo>
        <Campo etiqueta="Páginas" className="flex-1">
          <input
            value={borrador.num_pages}
            onChange={ev => setBorrador(b => ({ ...b, num_pages: ev.target.value.replace(/\D/g, '').slice(0, 5) }))}
            inputMode="numeric"
            placeholder="—"
            className={ENTRADA}
          />
        </Campo>
      </div>

      <Campo etiqueta="Sinopsis">
        <textarea
          value={borrador.synopsis}
          onChange={set('synopsis')}
          rows={7}
          className={ENTRADA + ' h-auto resize-none py-3 leading-relaxed'}
        />
      </Campo>

      <div className="mt-6 flex items-center gap-3">
        <motion.button
          onClick={guardar}
          disabled={guardando}
          whileTap={{ scale: 0.98 }}
          className="h-12 flex-1 rounded-xl2 bg-accent text-[15px] font-semibold text-on-accent disabled:opacity-60"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </motion.button>
        <button onClick={onCancelar} className="h-12 px-4 text-[15px] text-ink-dim">
          Cancelar
        </button>
      </div>

      <div className="mt-8 border-t border-line pt-4">
        <BotonPeligro
          etiqueta="Eliminar de mi estantería"
          pregunta="¿Seguro? Se pierden tus notas y fechas."
          onConfirmar={onEliminar}
        />
      </div>

      <SelectorPortada
        abierta={portada.abierta}
        libro={libro}
        elegida={borrador.cover_url}
        onCerrar={portada.cerrar}
        onSubir={onSubirPortada}
        onElegir={(url) => { setBorrador(b => ({ ...b, cover_url: url })); portada.cerrar() }}
      />
    </div>
  )
}

const ENTRADA = 'h-12 w-full rounded-xl2 border border-line bg-surface px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-mute focus:border-accent-line'

function Campo({ etiqueta, className = '', children }) {
  return (
    <label className={`mt-4 block ${className}`}>
      <span className="mb-1.5 block px-1 text-[13px] text-ink-dim">{etiqueta}</span>
      {children}
    </label>
  )
}

// Rellena de golpe autor, género, sinopsis, año y páginas preguntando a Open
// Library y Google Books. Escribe en el borrador, no en el libro: se revisa
// antes de guardar. El título nunca se toca — es lo que identifica al libro y
// lo que se ha usado para buscarlo.
function RellenarDatos({ borrador, setBorrador }) {
  const [estado, setEstado] = useState('quieto')   // quieto | buscando | ok | nada

  async function rellenar() {
    setEstado('buscando')
    try {
      const params = new URLSearchParams({ title: borrador.title })
      if (borrador.author) params.set('author', borrador.author)
      const fresco = await api(`/books/enrich?${params}`)
      const nuevos = {}
      if (fresco.author && !borrador.author) nuevos.author = fresco.author
      if (fresco.genre) nuevos.genre = fresco.genre
      if (fresco.synopsis) nuevos.synopsis = fresco.synopsis
      if (fresco.year) nuevos.year = String(fresco.year)
      if (fresco.num_pages) nuevos.num_pages = String(fresco.num_pages)
      const hay = Object.keys(nuevos).length > 0
      if (hay) setBorrador(b => ({ ...b, ...nuevos }))
      setEstado(hay ? 'ok' : 'nada')
    } catch {
      setEstado('nada')
    }
    setTimeout(() => setEstado('quieto'), 2500)
  }

  const texto = {
    quieto: 'Rellenar autor, género, sinopsis, año y páginas',
    buscando: 'Buscando…',
    ok: 'Datos actualizados',
    nada: 'Sin novedades',
  }[estado]

  return (
    <button
      onClick={rellenar}
      disabled={estado === 'buscando' || !borrador.title}
      className="mt-5 flex items-center gap-2 text-sm font-semibold text-accent disabled:opacity-60"
    >
      <motion.span
        animate={{ rotate: estado === 'buscando' ? 360 : 0 }}
        transition={estado === 'buscando' ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : { duration: 0 }}
        className="flex"
      >
        <IconRefresh className="h-4 w-4" />
      </motion.span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={estado}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {texto}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

