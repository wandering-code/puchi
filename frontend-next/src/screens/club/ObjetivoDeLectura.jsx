import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../../platform/api'
import HojaInferior, { useHoja } from '../luniteca/HojaInferior'
import { IconObjetivo, IconPencil } from '../../ui/icons'
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
// El mismo componente en los dos sitios, pero con dos formas muy distintas:
//
// - En la ficha es una banda con su título ("Para la próxima · lun 21 sept") y
//   el número grande. Ahí hay sitio y es donde se administra.
// - En la tarjeta de la estantería es SOLO una diana y el número, metido en la
//   misma línea que las demás señas del libro. La primera versión era la banda
//   entera también aquí y, en el móvil de verdad, se comía la tarjeta.
//
// Y en la tarjeta, sin objetivo puesto no se enseña nada — ni al admin: una
// tarjeta de estantería es para reconocer el libro de un vistazo, no un sitio
// donde rellenar huecos. El admin lo pone desde la ficha o desde la sesión.

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

  // Sin objetivo no hay nada que enseñar: en la tarjeta nunca, y en la ficha
  // solo si hay quien pueda ponerlo.
  if (!pagina && (enTarjeta || !esAdmin)) return null

  const editable = esAdmin && !!sesionId

  async function guardar(valor) {
    await api(`/sessions/${sesionId}`, { method: 'PATCH', body: { next_page: valor } })
    onCambiado()
  }

  // Un <span role="button"> y no un <button>: en la tarjeta esto vive DENTRO
  // del botón que abre el libro, y un botón dentro de otro no es HTML válido —
  // el navegador lo deshace por su cuenta. El stopPropagation es lo que evita
  // que el toque llegue a la tarjeta y abra la ficha en vez de esto. Es el
  // mismo apaño que ya usa la etiqueta de páginas de "Leyendo" en tu
  // estantería.
  const gestos = editable
    ? {
        role: 'button',
        tabIndex: 0,
        title: 'Cambiar hasta qué página',
        onClick: ev => { ev.stopPropagation(); hoja.abrir() },
        onKeyDown: ev => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); hoja.abrir() }
        },
      }
    : {}

  return (
    <>
      {enTarjeta ? (
        // La diana y el número, y nada más. Los márgenes negativos con relleno
        // agrandan la zona que responde al dedo sin mover nada de sitio: el
        // texto mide 11px y sin esto no se acierta.
        <span
          {...gestos}
          className={`-my-1 inline-flex items-center gap-1 rounded-full px-1 py-1 font-medium text-accent ${editable ? 'cursor-pointer' : ''}`}
        >
          <IconObjetivo className="h-3 w-3 shrink-0" />
          hasta la pág. {pagina}
        </span>
      ) : (
        <span
          {...gestos}
          className={`flex items-center gap-2 rounded-xl2 border border-accent-line bg-accent-soft px-3.5 py-3 ${editable ? 'cursor-pointer' : ''}`}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] uppercase tracking-[0.14em] text-accent/75">
              Para la próxima{cuando ? ` · ${cuando}` : ''}
            </span>
            {/* El número no salta al cambiar: el que llega entra por abajo
                mientras el que estaba sale por arriba, los dos en la misma
                celda de la rejilla, así que la caja no cambia de alto. */}
            <span className="mt-0.5 grid text-[15px] font-semibold text-accent">
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
                    ? <>Hasta la página {pagina}{total ? <span className="font-normal text-accent/65"> de {total}</span> : null}</>
                    : (
                      <span className="font-normal text-accent/70">
                        {sesionId ? 'Sin marcar todavía' : 'Apúntalo al guardar la primera sesión'}
                      </span>
                    )}
                </motion.span>
              </AnimatePresence>
            </span>
          </span>
          {editable && <IconPencil className="h-4 w-4 shrink-0 text-accent/70" />}
        </span>
      )}

      {/* Este <span> no pinta nada: está para cortar la propagación de lo que
          se pulse DENTRO de la hoja.

          La hoja se dibuja con createPortal en <body>, así que en el DOM no
          está dentro de la tarjeta — pero React reparte sus eventos por el
          árbol de COMPONENTES, no por el del documento, y aquí ese árbol dice
          que la hoja cuelga del botón de la tarjeta. Sin esto, pulsar
          "Guardar" guardaba el número y además abría la ficha del libro, que
          es justo lo que el stopPropagation de la etiqueta evita al abrirla.
          Visto en una captura: la hoja se cerraba y detrás había aparecido la
          ficha.

          `contents` para que no genere caja: en la tarjeta esto cuelga de la
          fila de señas del libro, que es un flex con gap, y un hijo vacío
          abriría un hueco después del número. */}
      {editable && (
        <span className="contents" onClick={ev => ev.stopPropagation()}>
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
export function CampoPagina({ valor, onCambiar, total, autoFoco = false, variante = 'grande' }) {
  // 'grande' es la hoja rápida, donde el número es LO ÚNICO que se pide y se
  // enseña como tal. 'campo' es dentro del formulario de la sesión, donde es un
  // campo más entre otros seis: allí una caja de 56px con el número a 24px
  // rompía el ritmo de los demás y, con "de 496 páginas" al lado, se salía.
  const grande = variante === 'grande'
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
          className={`shrink-0 rounded-xl2 border border-line bg-bg text-center tabular-nums text-ink outline-none transition-colors placeholder:font-normal placeholder:text-ink-mute focus:border-accent-line ${
            grande
              ? 'h-14 w-32 px-4 font-display text-2xl font-bold'
              : 'h-12 w-24 px-3 text-[15px] font-semibold'
          }`}
        />
        {total && (
          <span className={`min-w-0 text-ink-mute ${grande ? 'text-sm' : 'text-[13px]'}`}>
            de {total} páginas
          </span>
        )}
      </div>

      {/* Saltos rápidos sobre lo que ya hay: en la práctica esto se actualiza
          sumando lo que toque leer esta vez, no escribiendo la cifra entera
          desde cero. */}
      {valor !== '' && (
        <div className={`flex flex-wrap gap-2 ${grande ? 'mt-3' : 'mt-2'}`}>
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
