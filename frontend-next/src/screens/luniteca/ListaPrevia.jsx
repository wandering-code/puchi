import { memo, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Cover } from './piezas'
import { CamposFecha } from './editores'
import { TamanoLibro } from './BookEditForm'
import { FORMATO_LABEL, STATUS_LABEL } from './shelf'
import { IconCheck, IconChevron, IconX } from '../../ui/icons'

// Revisar antes de importar. Es el paso común a las tres formas de traer
// libros en bloque —el CSV de Goodreads, una hoja de cálculo cualquiera y el
// escáner de códigos de barras—, porque las tres llegan aquí con la misma
// forma de fila (ver importar.js) y lo que hace falta a partir de ahí es
// siempre lo mismo: ver qué ha entendido, quitar lo que no quieras, corregir
// lo que haya salido mal y mandarlo.
//
// Nada se guarda hasta que se toca el botón del final. Mientras, se puede
// editar fila a fila con los mismos controles que la ficha de un libro (el
// tamaño, las fechas, los estados) para que corregir una importación no sea
// una pantalla aparte con sus propias reglas.

export default function ListaPrevia({
  filas, incluidas, onAlternar, onParche, onTodas,
  progreso, generos = [], carpetas = [], deDonde = 'en el archivo',
  enviando, avanceEnvio, resultados, onImportar, onReiniciar, etiquetaReinicio = 'Importar otro archivo',
}) {
  const [abiertas, setAbiertas] = useState({})
  const nuevas = filas.filter(f => incluidas[f.clave]).length
  const duplicadas = filas.filter(f => f.duplicada).length

  if (resultados) {
    return <Resultados resultados={resultados} filas={filas} onReiniciar={onReiniciar} etiquetaReinicio={etiquetaReinicio} />
  }

  return (
    <div className="pb-2">
      <div className="sticky top-0 z-10 -mx-6 mb-1 border-b border-line bg-bg/95 px-6 py-3 backdrop-blur">
        <p className="text-sm">
          <span className="font-semibold">{filas.length}</span> {filas.length === 1 ? 'libro' : 'libros'} {deDonde}
          {duplicadas > 0 && <span className="text-ink-mute">, {duplicadas} ya {duplicadas === 1 ? 'lo tienes' : 'los tienes'}</span>}
        </p>
        <div className="mt-1 flex items-center gap-3 text-xs text-ink-mute">
          <button onClick={() => onTodas(true)} className="text-accent">Marcar todos</button>
          <button onClick={() => onTodas(false)} className="text-accent">Ninguno</button>
          {progreso && progreso.hechas < progreso.total && (
            <span className="ml-auto">Completando datos… {progreso.hechas}/{progreso.total}</span>
          )}
        </div>
      </div>

      <div className="divide-y divide-[color:var(--color-line)]">
        {filas.map(fila => (
          <Fila
            key={fila.clave}
            fila={fila}
            incluida={!!incluidas[fila.clave]}
            abierta={!!abiertas[fila.clave]}
            onAlternar={() => onAlternar(fila.clave)}
            onAbrir={() => setAbiertas(a => ({ ...a, [fila.clave]: !a[fila.clave] }))}
            onParche={parche => onParche(fila.clave, parche)}
            generos={generos}
            carpetas={carpetas}
          />
        ))}
      </div>

      <div className="mt-5">
        <motion.button
          onClick={onImportar}
          disabled={enviando || nuevas === 0}
          whileTap={{ scale: 0.98 }}
          className="h-12 w-full rounded-xl2 bg-accent text-[15px] font-semibold text-on-accent disabled:opacity-60"
        >
          {enviando
            ? `Añadiendo… ${avanceEnvio ? `${avanceEnvio.hechas}/${avanceEnvio.total}` : ''}`
            : nuevas === 0
              ? 'No hay nada marcado'
              : `Añadir ${nuevas} ${nuevas === 1 ? 'libro' : 'libros'} a mi estantería`}
        </motion.button>
        {progreso && progreso.hechas < progreso.total && !enviando && (
          <p className="mt-2 text-center text-xs text-ink-mute">
            Puedes añadirlos ya: lo que quede por completar se puede rellenar después desde la ficha.
          </p>
        )}
      </div>
    </div>
  )
}

// Una fila sola. `memo` porque son cientos y el completado automático las va
// parcheando de cinco en cinco: sin esto, cada portada que llega vuelve a
// pintar la lista entera y la revisión se queda a tirones mientras se completa.
const Fila = memo(function Fila({ fila, incluida, abierta, onAlternar, onAbrir, onParche, generos, carpetas }) {
  const meta = [
    fila.author,
    fila.year || null,
    fila.num_pages ? `${fila.num_pages} pág.` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className={`py-3 ${incluida ? '' : 'opacity-55'}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={onAlternar}
          aria-label={incluida ? 'No importar este libro' : 'Importar este libro'}
          aria-pressed={incluida}
          className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${
            incluida ? 'border-accent bg-accent text-on-accent' : 'border-line text-transparent'
          }`}
        >
          <IconCheck className="h-4 w-4" />
        </button>

        <button onClick={onAbrir} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <div className="w-9 shrink-0">
            <Cover url={fila.cover_url} title={fila.title} realce={false} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] leading-tight">{fila.title || <span className="text-danger">Sin título</span>}</p>
            {meta && <p className="mt-0.5 truncate text-xs text-ink-mute">{meta}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Etiqueta>{STATUS_LABEL[fila.status]}</Etiqueta>
              {fila.rating ? <Etiqueta>{String(fila.rating).replace('.', ',')} ★</Etiqueta> : null}
              {fila.duplicada && <Etiqueta tono="aviso">ya lo tienes</Etiqueta>}
              {/* Sin ISBN los datos se han buscado por título y autor, así que
                  puede ser otra edición — o otro libro con el mismo nombre. Se
                  dice en la fila para que se mire, no se corrige solo. */}
              {fila.fuente === 'search' && <Etiqueta tono="aviso">datos por título</Etiqueta>}
              {fila.completado === 'error' && <Etiqueta tono="aviso">sin datos</Etiqueta>}
            </div>
            {fila.mismoAutor?.length > 0 && (
              <p className="mt-1 text-[11px] leading-snug text-ink-mute/80">
                De {fila.author} ya tienes {fila.mismoAutor.slice(0, 2).join(', ')}
                {fila.mismoAutor.length > 2 ? ` y ${fila.mismoAutor.length - 2} más` : ''} — ¿es el mismo en otra edición?
              </p>
            )}
          </div>
          <IconChevron className={`mt-1 h-4 w-4 shrink-0 text-ink-mute transition-transform ${abierta ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {abierta && (
          <motion.div
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <Editor fila={fila} onParche={onParche} generos={generos} carpetas={carpetas} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

// Los mismos campos que la ficha, en el mismo orden y con los mismos
// controles. Lo que no se pueda arreglar aquí habrá que arreglarlo libro a
// libro después de importar, que es mucho peor.
function Editor({ fila, onParche, generos, carpetas }) {
  const llevaInicio = ['reading', 'read', 'dropped'].includes(fila.status)
  const llevaFin = ['read', 'dropped'].includes(fila.status)
  const entero = (clave, max = 5) => (ev) => {
    const limpio = ev.target.value.replace(/\D/g, '').slice(0, max)
    onParche({ [clave]: limpio ? Number(limpio) : null })
  }

  return (
    <div className="mt-3 rounded-xl2 border border-line bg-surface p-3.5">
      <Campo etiqueta="Título">
        <input value={fila.title} onChange={e => onParche({ title: e.target.value })} className={ENTRADA} />
      </Campo>
      <Campo etiqueta="Autor">
        <input value={fila.author} onChange={e => onParche({ author: e.target.value })} className={ENTRADA} />
      </Campo>

      <Campo etiqueta="Estado">
        <div className="flex flex-wrap gap-1.5">
          {['want_to_read', 'reading', 'read', 'dropped'].map(id => (
            <Chip key={id} activo={fila.status === id} onClick={() => onParche({ status: id })}>
              {STATUS_LABEL[id]}
            </Chip>
          ))}
        </div>
      </Campo>

      <Campo etiqueta="Puntuación">
        <select
          value={fila.rating ?? ''}
          onChange={e => onParche({ rating: e.target.value ? Number(e.target.value) : null })}
          className={ENTRADA + ' appearance-none'}
        >
          <option value="">Sin puntuar</option>
          {[5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5].map(n => (
            <option key={n} value={n}>{String(n).replace('.', ',')} ★</option>
          ))}
        </select>
      </Campo>

      {/* Las fechas que tienen sentido para el estado elegido, y solo esas —
          mismo criterio que la ficha y que el alta a mano. Un libro por leer
          no se ha empezado. */}
      {llevaInicio && (
        <Campo etiqueta="Empezado">
          <CamposFecha value={fila.started_at} onChange={v => onParche({ started_at: v })} />
        </Campo>
      )}
      {llevaFin && (
        <Campo etiqueta="Terminado">
          <CamposFecha value={fila.finished_at} onChange={v => onParche({ finished_at: v })} />
        </Campo>
      )}

      <Campo etiqueta="Género">
        <input value={fila.genre} onChange={e => onParche({ genre: e.target.value })} placeholder="Sin género" className={ENTRADA} />
        {generos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {generos.map(g => (
              <Chip key={g} activo={fila.genre === g} onClick={() => onParche({ genre: g })}>{g}</Chip>
            ))}
          </div>
        )}
      </Campo>

      <div className="flex gap-3">
        <Campo etiqueta="Año" className="flex-1">
          <input value={fila.year ?? ''} onChange={entero('year', 4)} inputMode="numeric" placeholder="—" className={ENTRADA} />
        </Campo>
        <Campo etiqueta="Páginas" className="flex-1">
          <input value={fila.num_pages ?? ''} onChange={entero('num_pages')} inputMode="numeric" placeholder="—" className={ENTRADA} />
        </Campo>
      </div>

      <Campo etiqueta="Tamaño">
        <TamanoLibro mm={fila.height_mm} onElegir={mm => onParche({ height_mm: mm })} />
      </Campo>

      <Campo etiqueta="Dónde se lee">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(FORMATO_LABEL).map(([id, texto]) => (
            <Chip
              key={id}
              activo={fila.reading_format === id}
              onClick={() => onParche({ reading_format: fila.reading_format === id ? '' : id })}
            >
              {texto}
            </Chip>
          ))}
        </div>
      </Campo>

      <div className="flex gap-3">
        <Campo etiqueta="Página actual" className="flex-1">
          <input value={fila.current_page ?? ''} onChange={entero('current_page')} inputMode="numeric" placeholder="—" className={ENTRADA} />
        </Campo>
        <Campo etiqueta="Veces leído" className="flex-1">
          <input value={fila.times_read ?? ''} onChange={entero('times_read', 2)} inputMode="numeric" placeholder="—" className={ENTRADA} />
        </Campo>
      </div>

      <div className="flex gap-3">
        <Campo etiqueta="Páginas de tu edición" className="flex-1">
          <input value={fila.custom_total_pages ?? ''} onChange={entero('custom_total_pages')} inputMode="numeric" placeholder="—" className={ENTRADA} />
        </Campo>
        <Campo etiqueta="Páginas en el eReader" className="flex-1">
          <input value={fila.ereader_total_pages ?? ''} onChange={entero('ereader_total_pages')} inputMode="numeric" placeholder="—" className={ENTRADA} />
        </Campo>
      </div>

      <div className="flex gap-3">
        <Campo etiqueta="Precio (€)" className="flex-1">
          <input
            value={fila.price == null ? '' : String(fila.price).replace('.', ',')}
            onChange={e => {
              const limpio = e.target.value.replace(',', '.').replace(/[^\d.]/g, '').slice(0, 7)
              onParche({ price: limpio ? Number(limpio) : null })
            }}
            inputMode="decimal" placeholder="—" className={ENTRADA}
          />
        </Campo>
        <Campo etiqueta="Carpeta" className="flex-1">
          <input value={fila.folder} onChange={e => onParche({ folder: e.target.value })} placeholder="Sin carpeta" className={ENTRADA} />
        </Campo>
      </div>
      {carpetas.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {carpetas.map(c => (
            <Chip key={c} activo={fila.folder === c} onClick={() => onParche({ folder: c })}>{c}</Chip>
          ))}
        </div>
      )}

      <Campo etiqueta="Notas">
        <textarea
          value={fila.notes}
          onChange={e => onParche({ notes: e.target.value })}
          rows={3}
          className={ENTRADA + ' h-auto resize-none py-2.5 leading-relaxed'}
        />
      </Campo>

      {fila.isbn && <p className="mt-3 text-[11px] text-ink-mute">ISBN {fila.isbn}</p>}
    </div>
  )
}

// Lo que ha entrado y lo que no. Los fallos se enseñan uno a uno con su
// motivo: el backend procesa libro a libro, así que un "ya está en tu
// estantería" en el número 40 no impide que los otros 39 estén dentro, y
// esconderlo detrás de un "algo ha fallado" dejaría sin saber qué repetir.
function Resultados({ resultados, filas, onReiniciar, etiquetaReinicio }) {
  const fallos = resultados.filter(r => !r.ok)
  const bien = resultados.length - fallos.length

  return (
    <div className="pb-4 pt-2">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-read/15 text-read">
          <IconCheck className="h-6 w-6" />
        </span>
        <div>
          <p className="text-[17px] font-semibold">
            {bien} {bien === 1 ? 'libro añadido' : 'libros añadidos'}
          </p>
          {fallos.length > 0 && (
            <p className="text-sm text-ink-mute">{fallos.length} se {fallos.length === 1 ? 'ha' : 'han'} quedado fuera</p>
          )}
        </div>
      </div>

      {fallos.length > 0 && (
        <div className="mt-4 rounded-xl2 border border-line">
          {fallos.map(f => (
            <div key={f.index} className="flex items-start gap-2 border-b border-line px-3.5 py-2.5 last:border-0">
              <IconX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
              <div className="min-w-0">
                <p className="truncate text-sm">{f.title || filas[f.index]?.title}</p>
                <p className="text-xs text-ink-mute">{f.error}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onReiniciar}
        className="mt-5 h-12 w-full rounded-xl2 border border-line text-[15px] font-semibold text-ink-dim"
      >
        {etiquetaReinicio}
      </button>
    </div>
  )
}

// ─── Piezas ─────────────────────────────────────────────────────────────────

export const ENTRADA = 'h-11 w-full rounded-xl2 border border-line bg-surface px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-mute focus:border-accent-line'

export function Campo({ etiqueta, className = '', children }) {
  return (
    <label className={`mt-3 block ${className}`}>
      <span className="mb-1.5 block px-1 text-[12px] text-ink-dim">{etiqueta}</span>
      {children}
    </label>
  )
}

export function Chip({ activo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
        activo ? 'border-accent-line bg-accent-soft text-accent' : 'border-line text-ink-dim'
      }`}
    >
      {children}
    </button>
  )
}

function Etiqueta({ children, tono }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10.5px] ${
      tono === 'aviso' ? 'bg-surface-2 text-ink-dim' : 'bg-accent-soft text-accent'
    }`}>
      {children}
    </span>
  )
}

// Los géneros y las carpetas que ya usas, para tocarlos en vez de escribirlos
// y no acabar con "Novela", "novela" y "Novelas" como tres géneros distintos
// (mismo motivo que en la ficha). Se sacan de la estantería tal como está.
export function usarSugerencias(estanteria) {
  return useMemo(() => {
    const generos = new Set(), carpetas = new Set()
    for (const e of estanteria || []) {
      if (e.book?.genre) generos.add(e.book.genre)
      if (e.folder) carpetas.add(e.folder)
    }
    return {
      generos: [...generos].sort((a, b) => a.localeCompare(b, 'es')),
      carpetas: [...carpetas].sort((a, b) => a.localeCompare(b, 'es')),
    }
  }, [estanteria])
}
