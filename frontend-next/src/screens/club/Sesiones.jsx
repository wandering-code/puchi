import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../../platform/api'
import { CamposFecha } from '../luniteca/editores'
import HojaInferior, { useHoja } from '../luniteca/HojaInferior'
import { IconCalendario, IconPencil, IconPlus, IconTrash } from '../../ui/icons'
import { IconoPeligro } from '../../ui/BotonPeligro'
import { fechaLarga } from './clubShelf'
import { CampoPagina } from './ObjetivoDeLectura'

// Las sesiones de un libro del club: cuándo se quedó, qué parte tocaba, qué se
// dijo y —lo último que se acuerda antes de levantarse— hasta qué página hay
// que leer PARA LA SIGUIENTE. Ese número se guarda en la sesión en la que se
// decidió, y es el que sale luego a la vista en la tarjeta del club y arriba en
// la ficha (ver ObjetivoDeLectura). Las lee todo el club; las escribe solo el
// admin (lo impone el backend, aquí solo se decide qué botones se enseñan).
//
// El formulario va en una hoja inferior y no metido entre las sesiones: son
// seis campos y uno de ellos es un texto largo, así que en el móvil pide la
// pantalla entera con el teclado subido, no un hueco que empuja el resto de la
// ficha hacia abajo mientras escribes.

export default function Sesiones({ entradaId, sesiones, totalPaginas, esAdmin, onCambiado }) {
  const hoja = useHoja()
  const [editando, setEditando] = useState(null)   // la sesión que se está tocando, o null = nueva

  function abrirNueva() { setEditando(null); hoja.abrir() }
  function abrirEdicion(s) { setEditando(s); hoja.abrir() }

  async function guardar(datos) {
    if (editando) await api(`/sessions/${editando.id}`, { method: 'PATCH', body: datos })
    else await api('/sessions', { method: 'POST', body: { ...datos, club_shelf_id: entradaId } })
    hoja.cerrar()
    onCambiado()
  }

  async function borrar(id) {
    await api(`/sessions/${id}`, { method: 'DELETE' })
    onCambiado()
  }

  return (
    <section className="mb-8">
      <div className="mb-2.5 flex items-center gap-2">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-ink-mute">
          Sesiones{sesiones?.length ? ` · ${sesiones.length}` : ''}
        </h3>
        <span className="h-px flex-1 bg-line" />
        {esAdmin && (
          <motion.button
            onClick={abrirNueva}
            whileTap={{ scale: 0.9 }}
            aria-label="Añadir sesión"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent"
          >
            <IconPlus className="h-4 w-4" />
          </motion.button>
        )}
      </div>

      {sesiones === null && (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl2 bg-surface-2" />
          ))}
        </div>
      )}

      {sesiones?.length === 0 && (
        <p className="rounded-xl2 border border-dashed border-line px-4 py-5 text-center text-sm text-ink-mute">
          {esAdmin
            ? 'Todavía no hay sesiones. Añade la primera con el +.'
            : 'Todavía no hay sesiones para este libro.'}
        </p>
      )}

      {/* popLayout: al borrar una, las de abajo suben a su sitio en vez de dar
          un salto cuando la que se va deja de ocupar. */}
      <div className="space-y-2">
        <AnimatePresence initial={false} mode="popLayout">
          {(sesiones || []).map(s => (
            <motion.div
              key={s.id}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <TarjetaSesion
                sesion={s}
                esAdmin={esAdmin}
                onEditar={() => abrirEdicion(s)}
                onBorrar={() => borrar(s.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <HojaInferior
        abierta={hoja.abierta}
        titulo={editando ? 'Editar sesión' : 'Nueva sesión'}
        onCerrar={hoja.cerrar}
      >
        <FormularioSesion
          // La key ata el formulario a lo que se está editando: la hoja vive
          // montada, así que sin ella al pasar de una sesión a otra (o a una
          // nueva) seguirían puestos los campos de la anterior.
          key={editando?.id || 'nueva'}
          inicial={editando}
          totalPaginas={totalPaginas}
          onGuardar={guardar}
          onCancelar={hoja.cerrar}
        />
      </HojaInferior>
    </section>
  )
}

// El backend guarda día y hora de inicio juntos en un solo campo, así que una
// sesión sin hora vuelve como "00:00". Nadie queda a medianoche: se lee como
// "no se puso hora" y no se enseña.
const SIN_HORA = '00:00'

function TarjetaSesion({ sesion, esAdmin, onEditar, onBorrar }) {
  const horas = [sesion.start_time === SIN_HORA ? null : sesion.start_time, sesion.end_time]
    .filter(Boolean).join(' – ')
  return (
    <div className="flex items-start gap-3 rounded-xl2 border border-line bg-surface px-3.5 py-3">
      <IconCalendario className="mt-0.5 h-4 w-4 shrink-0 text-ink-mute" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {/* first-letter y no capitalize: el nombre del día viene en
              minúscula del navegador y capitalize pondría en mayúscula también
              el mes ("Martes, 3 De Junio"). */}
          <p className="text-sm font-semibold leading-tight first-letter:uppercase">{fechaLarga(sesion.date)}</p>
          {horas && <span className="text-xs tabular-nums text-ink-mute">{horas}</span>}
        </div>
        {sesion.part_to_discuss && (
          <p className="mt-1 text-xs font-medium text-accent">{sesion.part_to_discuss}</p>
        )}
        {sesion.notes && (
          <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-ink-dim">{sesion.notes}</p>
        )}
        {/* Lo que se acordó aquí para la vez siguiente. Con su propio realce:
            de una sesión pasada esto es lo único que sigue haciendo falta. */}
        {sesion.next_page && (
          <p className="mt-1.5 inline-flex rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
            Después: hasta la página {sesion.next_page}
          </p>
        )}
      </div>
      {esAdmin && (
        <div className="flex shrink-0 gap-1.5">
          <motion.button
            onClick={onEditar}
            whileTap={{ scale: 0.9 }}
            aria-label="Editar sesión"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-mute"
          >
            <IconPencil className="h-4 w-4" />
          </motion.button>
          <IconoPeligro etiqueta="Borrar sesión" onConfirmar={onBorrar}>
            <IconTrash className="h-4 w-4" />
          </IconoPeligro>
        </div>
      )}
    </div>
  )
}

// Las horas sí van con <input type="time">: el que está roto en Safari de iOS
// es `type="date"` (por eso las fechas van con los tres <select> de
// CamposFecha, ver editores.jsx), no el de hora, que levanta su ruedecita y se
// comporta.
function FormularioSesion({ inicial, totalPaginas, onGuardar, onCancelar }) {
  const [dia, setDia] = useState(inicial?.date || '')
  const [inicio, setInicio] = useState(inicial?.start_time === SIN_HORA ? '' : (inicial?.start_time || ''))
  const [fin, setFin] = useState(inicial?.end_time || '')
  const [parte, setParte] = useState(inicial?.part_to_discuss || '')
  const [notas, setNotas] = useState(inicial?.notes || '')
  const [pagina, setPagina] = useState(inicial?.next_page ? String(inicial.next_page) : '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  async function guardar(ev) {
    ev.preventDefault()
    if (!dia) { setError('Sin día no hay sesión que guardar'); return }
    setGuardando(true); setError(null)
    try {
      // Cadena vacía y no null: el backend distingue "no se toca" (campo
      // ausente) de "se borra" (cadena vacía), así que vaciar una hora o una
      // nota tiene que llegar como vacío para que se quite de verdad.
      const datos = {
        start_time:      inicio || '',
        end_time:        fin || '',
        part_to_discuss: parte.trim() || '',
        notes:           notas.trim() || '',
        // Siempre presente, también vacío: el backend distingue "no lo toques"
        // (campo ausente) de "quítalo" (null), y aquí el formulario tiene la
        // última palabra sobre las dos cosas.
        next_page:       pagina === '' ? null : Number(pagina),
      }
      // El día solo se manda si ha cambiado. Al editar, mandarlo siempre
      // impide quitar la hora: el backend rehace la fecha completa a partir
      // del día y, si la hora llega vacía, se queda con la que ya tenía.
      if (!inicial || dia !== inicial.date) datos.date = dia
      await onGuardar(datos)
    } catch (err) {
      setError(err.message || 'No se ha podido guardar')
    } finally {
      // También al terminar bien: la hoja se aparta pero no se desmonta, y el
      // formulario solo se reconstruye si cambia su key. Sin esto, volver a
      // editar la misma sesión la encontraba con el botón en "Guardando…".
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} className="pb-2">
      <Campo etiqueta="Día">
        <CamposFecha value={dia} onChange={setDia} />
      </Campo>

      {/* min-w-0 en las dos columnas: un <input type="time"> trae un ancho
          propio bastante mayor que su contenido, y un hijo de flex no baja de
          su ancho intrínseco salvo que se le diga. Sin esto, en el iPhone las
          dos horas se solapaban y la segunda se salía de la pantalla. */}
      <div className="flex gap-3">
        <Campo etiqueta="Empieza" className="min-w-0 flex-1">
          <input type="time" value={inicio} onChange={e => setInicio(e.target.value)} className={ENTRADA} />
        </Campo>
        <Campo etiqueta="Termina" className="min-w-0 flex-1">
          <input type="time" value={fin} onChange={e => setFin(e.target.value)} className={ENTRADA} />
        </Campo>
      </div>

      <Campo etiqueta="Parte a comentar">
        <input
          value={parte}
          onChange={e => setParte(e.target.value)}
          placeholder="Capítulos 1–5, Parte II…"
          className={ENTRADA}
        />
      </Campo>

      <Campo etiqueta="Notas">
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          rows={3}
          placeholder="Lo que se dijo, lo que quedó pendiente…"
          className="w-full resize-none rounded-xl2 border border-line bg-bg p-3 text-[15px] leading-relaxed outline-none transition-colors placeholder:text-ink-mute focus:border-accent-line"
        />
      </Campo>

      {/* Lo último que se acuerda antes de levantarse, y por eso va al final
          del formulario: hasta dónde hay que leer para la próxima vez. Es lo
          que luego sale en la estantería del club y arriba en la ficha. */}
      <Campo etiqueta="Para la siguiente, hasta la página">
        <CampoPagina valor={pagina} onCambiar={setPagina} total={totalPaginas} variante="campo" />
      </Campo>

      <AnimatePresence>
        {error && (
          <motion.p
            className="mt-3 text-sm text-danger"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onCancelar}
          className="h-12 flex-1 rounded-xl2 border border-line text-[15px] text-ink-dim"
        >
          Cancelar
        </button>
        <motion.button
          type="submit"
          disabled={guardando || !dia}
          whileTap={{ scale: 0.98 }}
          className="h-12 flex-[1.4] rounded-xl2 bg-accent text-[15px] font-semibold text-on-accent transition-colors disabled:bg-surface-2 disabled:text-ink-mute"
        >
          {guardando ? 'Guardando…' : 'Guardar sesión'}
        </motion.button>
      </div>
    </form>
  )
}

const ENTRADA = 'h-12 w-full min-w-0 rounded-xl2 border border-line bg-bg px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-mute focus:border-accent-line'

// Sin `first:mt-0`: cuando dos Campos van uno al lado del otro dentro de un
// flex, solo el primero es `:first-child` y perdía el margen de arriba — las
// dos columnas quedaban descuadradas en vertical. Visto en el móvil.
function Campo({ etiqueta, className = '', children }) {
  return (
    <label className={`mt-4 block ${className}`}>
      <span className="mb-1.5 block px-1 text-[13px] text-ink-dim">{etiqueta}</span>
      {children}
    </label>
  )
}
