import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { EMPTY_FILTERS, MAX_PAGES_OPTIONS, SORT_FIELDS } from './shelf'
import { IconChevron, IconX } from '../../ui/icons'

// Filtros y orden en una hoja que sube desde abajo. Antes eran dos paneles que
// se desplegaban dentro de la barra de herramientas y empujaban la estantería
// hacia abajo: el contenido daba un salto cada vez y los controles quedaban
// arriba del todo, lejos del pulgar. Aquí la estantería no se mueve, y lo que
// se toca está en la mitad de abajo de la pantalla.
export default function HojaFiltros({
  abierta, onCerrar, sort, onSort, filters, onFilters, opciones, visibles,
}) {
  // Como el menú lateral y la ficha: el gesto de volver cierra la hoja en vez
  // de sacar de la app.
  useEffect(() => {
    if (!abierta) return
    window.history.pushState({ hoja: true }, '')
    const alVolver = () => onCerrar({ desdeHistorial: true })
    window.addEventListener('popstate', alVolver)
    const alPulsar = (ev) => { if (ev.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', alPulsar)
    return () => {
      window.removeEventListener('popstate', alVolver)
      window.removeEventListener('keydown', alPulsar)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta])

  const hayFiltros = Object.keys(EMPTY_FILTERS).some(k => filters[k] !== EMPTY_FILTERS[k])
  const hayAlgo = hayFiltros || !!sort.field

  return createPortal(
    <AnimatePresence>
      {abierta && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-ink/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => onCerrar()}
          />

          <motion.div
            role="dialog"
            aria-label="Filtrar y ordenar"
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-[28px] border-t border-line bg-surface pb-safe"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            // Se cierra tirando de ella hacia abajo, que es lo que se intenta
            // por instinto. Solo hacia abajo (top: 0), para que no se pueda
            // despegar del borde.
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              // Distancia O velocidad: un tirón corto y rápido también cierra.
              if (info.offset.y > 90 || info.velocity.y > 500) onCerrar()
            }}
          >
            {/* El asa: además de indicar que se puede arrastrar, es la zona por
                la que se agarra sin tocar ningún control. */}
            <div className="flex shrink-0 cursor-grab justify-center pb-1 pt-3 active:cursor-grabbing">
              <span className="h-1 w-10 rounded-full bg-line" />
            </div>

            <div className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-1">
              <h3 className="flex-1 font-display text-lg font-bold tracking-[-0.01em]">Filtrar y ordenar</h3>
              <button
                onClick={() => onCerrar()}
                aria-label="Cerrar"
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-mute transition-colors active:bg-surface-2"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
              <Apartado titulo="Ordenar por">
                <div className="flex flex-wrap gap-2">
                  {SORT_FIELDS.map(({ field, label }) => {
                    const activo = sort.field === field
                    return (
                      <button
                        key={field}
                        onClick={() => onSort(activo
                          // Tocar el que ya está activo alterna el sentido, y
                          // al tercer toque lo quita: sin botón aparte.
                          ? (sort.dir === 'asc' ? { field, dir: 'desc' } : { field: '', dir: 'asc' })
                          : { field, dir: 'asc' })}
                        className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors ${
                          activo ? 'border-accent-line bg-accent-soft text-accent' : 'border-line text-ink-dim'
                        }`}
                      >
                        {label}
                        {activo && (
                          <IconChevron className={`h-3.5 w-3.5 transition-transform ${sort.dir === 'asc' ? 'rotate-180' : ''}`} />
                        )}
                      </button>
                    )
                  })}
                </div>
              </Apartado>

              <Apartado titulo="Filtrar">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Desplegable label="Género"  value={filters.genre}  onChange={v => onFilters({ ...filters, genre: v })}  options={opciones.generos} />
                  <Desplegable label="Autor"   value={filters.author} onChange={v => onFilters({ ...filters, author: v })} options={opciones.autores} />
                  <Desplegable label="Carpeta" value={filters.folder} onChange={v => onFilters({ ...filters, folder: v })} options={opciones.carpetas} />
                  <Desplegable
                    label="Máximo de páginas" value={filters.maxPages}
                    onChange={v => onFilters({ ...filters, maxPages: v })}
                    options={MAX_PAGES_OPTIONS}
                  />
                  <Desplegable
                    label="Nota mínima" value={filters.minRating}
                    onChange={v => onFilters({ ...filters, minRating: v })}
                    options={['1', '2', '3', '4', '5']}
                    formato={v => v.replace('.', ',')}
                  />
                </div>
              </Apartado>
            </div>

            <div className="flex shrink-0 gap-2 border-t border-line px-5 pb-2 pt-3">
              {hayAlgo && (
                <button
                  onClick={() => { onFilters(EMPTY_FILTERS); onSort({ field: '', dir: 'asc' }) }}
                  className="h-12 flex-1 rounded-xl2 border border-line text-[15px] text-ink-dim transition-colors active:bg-surface-2"
                >
                  Limpiar
                </button>
              )}
              <button
                onClick={() => onCerrar()}
                className="h-12 flex-[2] rounded-xl2 bg-accent text-[15px] font-semibold text-on-accent transition-transform active:scale-[0.98]"
              >
                Ver {visibles} {visibles === 1 ? 'libro' : 'libros'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function Apartado({ titulo, children }) {
  return (
    <section className="mb-5">
      <h4 className="mb-2.5 text-[11px] uppercase tracking-[0.14em] text-ink-mute">{titulo}</h4>
      {children}
    </section>
  )
}

// El <select> se queda (en el móvil abre la rueda del sistema, que con el
// pulgar no la mejora ninguna lista hecha a mano), pero con appearance:none y
// flecha propia. Sin eso, iOS lo pinta con su estilo nativo e ignora el
// redondeo: eran los únicos recuadros con esquinas rectas de toda la app.
function Desplegable({ label, value, onChange, options, formato = v => v }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="px-1 text-[13px] text-ink-dim">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`h-12 w-full appearance-none rounded-xl2 border bg-bg px-3.5 pr-10 text-[15px] outline-none transition-colors ${
            value ? 'border-accent-line text-accent' : 'border-line text-ink'
          }`}
        >
          <option value="">Cualquiera</option>
          {options.map(o => <option key={o} value={o}>{formato(o)}</option>)}
        </select>
        <IconChevron
          className={`pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${value ? 'text-accent' : 'text-ink-mute'}`}
        />
      </div>
    </label>
  )
}
