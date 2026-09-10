import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../../platform/api'
import HojaInferior, { useHoja } from '../luniteca/HojaInferior'
import { IconPencil } from '../../ui/icons'
import { diaDeSesion } from './clubShelf'

// Hasta qué página hay que llevar leído para la próxima quedada.
//
// Es el dato que más se consulta de un club mientras hay un libro en marcha
// —"¿por dónde íbamos?"—, así que va a la vista en los dos sitios donde se mira
// el libro que se está leyendo: la tarjeta de la estantería del club y su
// ficha. Lo pone el admin (el backend solo se lo deja a él) y lo lee todo el
// mundo.
//
// **El número es de una sesión, no del libro.** Se acuerda al cerrar una
// quedada ("lo dejamos aquí; para la próxima, hasta la 250"), así que se guarda
// en la sesión en la que se decidió (`sessions.next_page`) y cada sesión deja
// escrito hasta dónde llegaba la lectura siguiente. El que vale ahora mismo es
// el de la última sesión YA CELEBRADA que dejara uno: lo que se apunte en una
// quedada que todavía no ha llegado es para después de esa, no para la que
// viene. Ese cálculo lo hace el backend y llega en la entrada del club
// (`next_page`, `next_page_session_id`, `last_session_id`), para que la
// estantería pueda enseñarlo sin pedir las sesiones de cada libro.
//
// El mismo componente en los dos sitios, con dos tamaños: si fueran dos, el día
// que cambie la forma de escribirlo habría que acordarse de cambiarlo dos veces.

export default function ObjetivoDeLectura({ club, libro, esAdmin, onCambiado, variante = 'ficha' }) {
  const hoja = useHoja()
  const pagina = club.next_page
  const cuando = diaDeSesion(club.next_session?.date)
  const enTarjeta = variante === 'tarjeta'
  const total = libro?.num_pages || null

  // Dónde se escribe: en la sesión que ya lo guarda o, si todavía no hay
  // objetivo, en la última que se celebró. Sin ninguna sesión celebrada no hay
  // dónde apuntarlo — el número pertenece a una quedada.
  const sesionId = club.next_page_session_id || club.last_session_id

  // Sin objetivo puesto y sin poder ponerlo: no hay nada que enseñar, y una
  // caja vacía diciendo "—" solo ocupa sitio en la tarjeta.
  if (!pagina && !esAdmin) return null

  const editable = esAdmin && !!sesionId

  async function guardar(valor) {
    await api(`/sessions/${sesionId}`, { method: 'PATCH', body: { next_page: valor } })
    onCambiado()
  }

  return (
    <>
      {/* Un <span role="button"> y no un <button>: en la tarjeta esto vive
          DENTRO del botón que abre el libro, y un botón dentro de otro no es
          HTML válido — el navegador lo deshace por su cuenta. El
          stopPropagation es lo que evita que el toque llegue a la tarjeta y
          abra la ficha en vez de esto. Es el mismo apaño que ya usa la
          etiqueta de páginas de "Leyendo" en tu estantería. */}
      <span
        role={editable ? 'button' : undefined}
        tabIndex={editable ? 0 : undefined}
        onClick={editable ? (ev => { ev.stopPropagation(); hoja.abrir() }) : undefined}
        onKeyDown={editable ? (ev => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); hoja.abrir() }
        }) : undefined}
        title={editable ? 'Cambiar hasta qué página' : undefined}
        className={`flex items-center gap-2 rounded-xl2 border border-accent-line bg-accent-soft ${
          enTarjeta ? 'px-2.5 py-1.5' : 'px-3.5 py-3'
        } ${editable ? 'cursor-pointer' : ''}`}
      >
        <span className="min-w-0 flex-1">
          {/* En la tarjeta el texto va abreviado y con menos separación entre
              letras: al lado de una portada, en un móvil estrecho, "PARA LA
              PRÓXIMA · LUN 21 SEPT" se partía en dos renglones y la banda se
              comía media tarjeta. En la ficha hay ancho de sobra. */}
          <span className={`block uppercase text-accent/75 ${
            enTarjeta ? 'text-[9px] tracking-[0.1em]' : 'text-[10px] tracking-[0.14em]'
          }`}>
            {cuando
              ? `${enTarjeta ? 'Próxima' : 'Para la próxima'} · ${cuando}`
              : 'Para la próxima'}
          </span>
          {/* El número no salta al cambiar: el que llega entra por abajo
              mientras el que estaba sale por arriba, los dos en la misma celda
              de la rejilla, así que el ancho de la caja no se mueve. */}
          <span className={`mt-0.5 grid font-semibold text-accent ${enTarjeta ? 'text-[13px]' : 'text-[15px]'}`}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={pagina || 'sin'}
                className="[grid-area:1/1]"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
              >
                {pagina
                  ? <>Hasta la p{enTarjeta ? 'ág.' : 'ágina'} {pagina}{total ? <span className="font-normal text-accent/65"> de {total}</span> : null}</>
                  : (
                    <span className="font-normal text-accent/70">
                      {sesionId ? 'Sin marcar todavía' : 'Apúntalo al guardar la primera sesión'}
                    </span>
                  )}
              </motion.span>
            </AnimatePresence>
          </span>
        </span>
        {editable && <IconPencil className={`shrink-0 text-accent/70 ${enTarjeta ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />}
      </span>

      {/* Este <span> no pinta nada: está para cortar la propagación de lo que
          se pulse DENTRO de la hoja.

          La hoja se dibuja con createPortal en <body>, así que en el DOM no
          está dentro de la tarjeta — pero React reparte sus eventos por el
          árbol de COMPONENTES, no por el del documento, y aquí ese árbol dice
          que la hoja cuelga del botón de la tarjeta. Sin esto, pulsar
          "Guardar" guardaba el número y además abría la ficha del libro, que
          es justo lo que el stopPropagation de la etiqueta evita al abrirla.
          Visto en una captura: la hoja se cerraba y detrás había aparecido la
          ficha. */}
      {editable && (
        <span onClick={ev => ev.stopPropagation()}>
        <HojaInferior abierta={hoja.abierta} titulo="Hasta qué página" onCerrar={hoja.cerrar}>
          <FormularioObjetivo
            // La key ata el formulario al número que hay: la hoja vive
            // montada, así que sin ella al abrirla otra vez seguiría puesto el
            // valor con el que se cerró la anterior.
            key={pagina || 'sin'}
            pagina={pagina}
            total={total}
            onGuardar={async (valor) => { await guardar(valor); hoja.cerrar() }}
            onCancelar={hoja.cerrar}
          />
        </HojaInferior>
        </span>
      )}
    </>
  )
}

// El mismo formulario que usa la hoja rápida y el de crear o editar una sesión:
// un número, el total del libro como referencia y saltos para no escribir la
// cifra entera. Se exporta porque la sesión lo lleva dentro de su formulario
// (ver Sesiones.jsx) y tiene que pedirse igual en los dos sitios.
export function CampoPagina({ valor, onCambiar, total, autoFoco = false }) {
  const [campo, setCampo] = useState(null)

  // El teclado sube solo cuando esto es lo único que se viene a escribir. Un
  // frame después de que la hoja llegue, no en el mismo: pedir el foco mientras
  // la hoja todavía sube deja al teclado y al panel peleándose por el alto.
  useEffect(() => {
    if (!campo || !autoFoco) return
    const id = setTimeout(() => { campo.focus(); campo.select() }, 260)
    return () => clearTimeout(id)
  }, [campo, autoFoco])

  const sumar = (paso) => {
    const base = Number(valor || 0) + paso
    onCambiar(String(Math.max(1, total ? Math.min(total, base) : base)))
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <input
          ref={setCampo}
          value={valor}
          onChange={ev => onCambiar(ev.target.value.replace(/\D/g, '').slice(0, 5))}
          inputMode="numeric"
          enterKeyHint="done"
          placeholder="—"
          aria-label="Página"
          className="h-14 w-32 rounded-xl2 border border-line bg-bg px-4 text-center font-display text-2xl font-bold tabular-nums text-ink outline-none transition-colors placeholder:font-normal placeholder:text-ink-mute focus:border-accent-line"
        />
        {total
          ? <span className="text-sm text-ink-mute">de {total} páginas</span>
          : <span className="text-sm text-ink-mute">—</span>}
      </div>

      {/* Saltos rápidos sobre lo que ya hay: en la práctica esto se actualiza
          sumando lo que toque leer esta vez, no escribiendo la cifra entera
          desde cero. */}
      {valor !== '' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {[25, 50, 100].map(paso => (
            <button
              key={paso}
              type="button"
              onClick={() => sumar(paso)}
              className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-dim transition-colors active:bg-surface-2"
            >
              +{paso}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function FormularioObjetivo({ pagina, total, onGuardar, onCancelar }) {
  const [texto, setTexto] = useState(pagina ? String(pagina) : '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const numero = texto === '' ? null : Number(texto)

  async function guardar(ev) {
    ev.preventDefault()
    if (numero != null && total && numero > total) {
      setError(`Este libro tiene ${total} páginas`)
      return
    }
    setGuardando(true); setError(null)
    try {
      await onGuardar(numero)
    } catch (err) {
      setError(err.message || 'No se ha podido guardar')
    } finally {
      // También al terminar bien, aunque la hoja se cierre justo después: la
      // hoja no se desmonta, se aparta, y el formulario solo se vuelve a
      // construir si cambia su key —o sea, si el número ha cambiado—. Al
      // guardar el mismo número que ya había, el mismo formulario se quedaba
      // clavado en "Guardando…" para siempre. Visto en una captura.
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} className="pb-2">
      <p className="text-sm leading-relaxed text-ink-dim">
        Hasta dónde hay que llevar leído el libro para la próxima quedada. Queda apuntado en la
        última sesión y lo ve todo el club.
      </p>

      <div className="mt-4">
        <CampoPagina valor={texto} onCambiar={v => { setTexto(v); setError(null) }} total={total} autoFoco />
      </div>

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
        {/* Quitar el objetivo es guardar "ninguno", no una acción aparte: se
            deja el campo vacío y se guarda. Este botón es el atajo para no
            tener que borrar tres cifras a mano. */}
        <button
          type="button"
          onClick={() => setTexto('')}
          disabled={texto === ''}
          className="h-12 flex-1 rounded-xl2 border border-line text-[15px] text-ink-dim transition-opacity disabled:opacity-40"
        >
          Sin marcar
        </button>
        <motion.button
          type="submit"
          disabled={guardando}
          whileTap={{ scale: 0.98 }}
          className="h-12 flex-[1.4] rounded-xl2 bg-accent text-[15px] font-semibold text-on-accent disabled:opacity-60"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </motion.button>
      </div>

      <button type="button" onClick={onCancelar} className="mt-3 h-10 w-full text-sm text-ink-mute">
        Cancelar
      </button>
    </form>
  )
}
