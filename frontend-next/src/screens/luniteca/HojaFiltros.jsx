import { useEffect, useState } from 'react'
import { EMPTY_FILTERS, MAX_PAGES_OPTIONS, MIN_RATING_OPTIONS, SORT_FIELDS } from './shelf'
import { IconChevron } from '../../ui/icons'
import HojaInferior from './HojaInferior'

// Filtros y orden en la hoja que sube desde abajo. Antes eran dos paneles que
// se desplegaban dentro de la barra de herramientas y empujaban la estantería
// hacia abajo: el contenido daba un salto cada vez y los controles quedaban
// arriba del todo, lejos del pulgar. Aquí la estantería no se mueve, y lo que
// se toca está en la mitad de abajo de la pantalla.
export default function HojaFiltros({
  abierta, onCerrar, sort, onSort, filters, onFilters, opciones, visibles,
}) {
  const hayFiltros = Object.keys(EMPTY_FILTERS).some(k => filters[k] !== EMPTY_FILTERS[k])
  const hayAlgo = hayFiltros || !!sort.field

  return (
    <HojaInferior
      abierta={abierta}
      titulo="Filtrar y ordenar"
      onCerrar={onCerrar}
      pie={
        <>
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
        </>
      }
    >
      <Apartado titulo="Ordenar por">
        <div className="flex flex-wrap gap-2">
          {SORT_FIELDS.map(({ field, label }) => {
            const activo = sort.field === field
            return (
              <button
                key={field}
                onClick={() => onSort(activo
                  // Tocar el que ya está activo alterna el sentido, y al
                  // tercer toque lo quita: sin botón aparte.
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
            options={MIN_RATING_OPTIONS}
            // El valor viaja con punto (es lo que compara el filtro), pero se
            // enseña con coma, que es como se escribe aquí.
            formato={v => v.replace('.', ',')}
          />
        </div>
      </Apartado>
    </HojaInferior>
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
// redondeo: eran los únicos recuadros de esquinas rectas de toda la app.
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
          <OpcionesDiferidas items={options} actual={value} formato={formato} />
        </select>
        <IconChevron
          className={`pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${value ? 'text-accent' : 'text-ink-mute'}`}
        />
      </div>
    </label>
  )
}

// Las opciones se montan un frame DESPUÉS de que aparezca la hoja.
//
// Medido con una estantería de 300 libros (300 autores, 40 géneros, 12
// carpetas): entre todos los desplegables salían 387 <option>, y crearlos
// hacía que la hoja tardara 362ms en aparecer la primera vez y 131ms las
// siguientes, con tareas largas de 68-105ms que se comían los primeros
// fotogramas de la animación. Un frame después, la hoja entra limpia y las
// listas se rellenan mucho antes de que dé tiempo a desplegar ninguna.
//
// El valor ya elegido sí se pinta desde el primer momento: si no, un filtro
// puesto parpadearía vacío al abrir.
function OpcionesDiferidas({ items, actual, formato }) {
  const [listas, setListas] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setListas(true))
    return () => cancelAnimationFrame(id)
  }, [])
  if (!listas) return actual ? <option value={actual}>{formato(actual)}</option> : null
  return <>{items.map(o => <option key={o} value={o}>{formato(o)}</option>)}</>
}
