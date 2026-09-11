import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { nombreDeCanal, useChat } from '../../platform/chat'
import { useLlamadas } from '../../platform/llamadas'
import PantallaInferior from '../luniteca/PantallaInferior'
import Avatar from '../../ui/Avatar'
import { IconArrowLeft, IconClub, IconEnviar, IconTelefono, IconVideoCamara } from '../../ui/icons'
import { BloqueDeMensajes, PuntoConectado, SeparadorDeDia, agruparMensajes } from './piezas'

// Un botón de llamar de la cabecera. En redondo y del color de la app, como
// los de la barra de la estantería — no en verde de teléfono, que aquí
// desentonaría: el verde se reserva para "contestar" en la tarjeta de una
// llamada entrante, donde sí hay que distinguirlo del rojo de rechazar.
function BotonLlamar({ etiqueta, deshabilitado, onClick, children }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={deshabilitado}
      whileTap={{ scale: 0.9 }}
      aria-label={etiqueta}
      title={deshabilitado ? 'Ya estás en una llamada' : etiqueta}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/[0.08] text-accent transition-colors active:bg-accent/20 disabled:bg-surface-2 disabled:text-ink-mute"
    >
      {children}
    </motion.button>
  )
}

// Una conversación. La misma en los dos sitios donde puede vivir:
//
// - **Suelta**, ocupando su panel, cuando hay ancho (tablet, ordenador): la
//   lista se queda a la izquierda y esto a la derecha. Sin flecha de volver,
//   porque no se ha ido a ninguna parte.
// - **Encima**, a pantalla completa, en el móvil: sube desde abajo como la
//   ficha de un libro y se cierra igual.
//
// El contenido es idéntico en los dos casos — cabecera, mensajes, campo de
// escribir—; lo único que cambia es el marco. Si fueran dos componentes, cada
// arreglo habría que hacerlo dos veces.

export default function Conversacion({ canalId, abierta = true, onCerrar, suelta = false }) {
  const cuerpo = useRef(null)
  const tripas = <Tripas canalId={canalId} abierta={abierta} onCerrar={onCerrar} suelta={suelta} refCuerpo={cuerpo} />

  if (suelta) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl3 border border-line bg-bg">
        {tripas}
      </div>
    )
  }
  return tripas
}

function Tripas({ canalId, abierta, onCerrar, suelta, refCuerpo }) {
  const { miId, canales, mensajesDe, cargarMensajes, enviar, marcarLeido, mirando, estaOnline } = useChat()
  const canal = canales.find(c => c.id === canalId)
  const mensajes = mensajesDe(canalId)
  const [texto, setTexto] = useState('')
  const [noSalio, setNoSalio] = useState(false)

  const esDelClub = canal?.type !== 'dm'
  const otro = canal?.other_player
  const { llamar, hayLlamada } = useLlamadas()

  useEffect(() => {
    if (!abierta || !canalId) return
    mirando(canalId)
    cargarMensajes(canalId)
    marcarLeido(canalId)
    return () => mirando(null)
  }, [abierta, canalId, mirando, cargarMensajes, marcarLeido])

  // Abajo del todo, que es donde está lo último. Con useLayoutEffect: el salto
  // ocurre antes de pintar y no se ve la conversación aparecer por arriba.
  const cuantos = mensajes?.length ?? 0
  const previos = useRef(0)
  const recienLlegado = cuantos > previos.current && previos.current > 0
  useLayoutEffect(() => {
    previos.current = cuantos
    const el = refCuerpo.current
    if (el) el.scrollTop = el.scrollHeight
  }, [cuantos, canalId, refCuerpo])

  function mandar(ev) {
    ev.preventDefault()
    if (!texto.trim()) return
    if (enviar(canalId, texto)) { setTexto(''); setNoSalio(false) }
    // El socket está cerrado (red caída, backend reiniciándose). No se da por
    // enviado ni se borra lo escrito: se avisa y sigue ahí para reintentarlo.
    else setNoSalio(true)
  }

  const bloques = mensajes ? agruparMensajes(mensajes) : null

  // Con la lista al lado, la cabecera y el campo de escribir ocupan todo el
  // panel: centrados a 42rem se quedaban flotando en medio de un panel mucho
  // más ancho, como si fueran de otra pantalla. Los mensajes sí se quedan en
  // una columna estrecha — una línea de sesenta caracteres se lee bien y una
  // de ciento cuarenta, no.
  const aLoAncho = suelta ? 'w-full px-4' : 'mx-auto w-full max-w-2xl px-3'

  const cabecera = (
    <div className={`shrink-0 border-b border-line ${suelta ? 'bg-surface' : 'sticky top-0 z-10 bg-bg/90 backdrop-blur-xl'}`}>
      <div className={`flex items-center gap-3 py-2 ${aLoAncho}`}>
        {/* La flecha solo cuando esto tapa la pantalla. Con la lista al lado no
            hay nada de donde volver. */}
        {!suelta && (
          <motion.button
            onClick={onCerrar}
            aria-label="Volver a las conversaciones"
            whileTap={{ scale: 0.92 }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink transition-colors active:bg-surface-2"
          >
            <IconArrowLeft className="h-5 w-5" />
          </motion.button>
        )}

        {esDelClub ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <IconClub className="h-5 w-5" />
          </span>
        ) : (
          <span className="relative shrink-0">
            <Avatar jugador={otro} size={36} />
            {estaOnline(otro?.id) && <PuntoConectado />}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-bold leading-tight">{nombreDeCanal(canal)}</p>
          <p className="truncate text-[11px] text-ink-mute">
            {esDelClub
              ? 'Todo el club de lectura'
              : (estaOnline(otro?.id) ? 'Conectada ahora' : 'Desconectada')}
          </p>
        </div>

        {/* Llamar, desde la propia conversación. Es donde se decide: estás
            escribiéndole a alguien y ves que está conectado. */}
        {!esDelClub && otro && (
          <div className="flex shrink-0 items-center gap-1.5">
            <BotonLlamar
              etiqueta={`Llamar a ${otro.name}`}
              deshabilitado={hayLlamada}
              onClick={() => llamar(otro, 'audio')}
            >
              <IconTelefono className="h-[18px] w-[18px]" />
            </BotonLlamar>
            <BotonLlamar
              etiqueta={`Videollamar a ${otro.name}`}
              deshabilitado={hayLlamada}
              onClick={() => llamar(otro, 'video')}
            >
              <IconVideoCamara className="h-[18px] w-[18px]" />
            </BotonLlamar>
          </div>
        )}
      </div>
    </div>
  )

  const escribir = (
    <form
      onSubmit={mandar}
      // pb-escritura: el hueco de abajo crece con el teclado y además deja un
      // respiro propio, para que la caja no quede rozando el borde de la
      // pantalla ni la barra de Safari.
      className={`shrink-0 border-t border-line bg-surface px-3 pt-2.5 ${suelta ? 'pb-3' : 'pb-escritura'}`}
    >
      <div className={`flex items-end gap-2 ${suelta ? 'w-full' : 'mx-auto w-full max-w-2xl'}`}>
        <textarea
          value={texto}
          onChange={ev => { setTexto(ev.target.value); setNoSalio(false) }}
          onKeyDown={ev => {
            // Intro envía, Mayús+Intro hace salto de línea. En el móvil el
            // teclado trae su propia tecla de enviar y esto no estorba.
            if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); mandar(ev) }
          }}
          rows={1}
          placeholder={esDelClub ? 'Escribe al club…' : `Escribe a ${nombreDeCanal(canal)}…`}
          aria-label="Escribir un mensaje"
          className="max-h-32 min-h-[44px] w-full min-w-0 flex-1 resize-none rounded-xl2 border border-line bg-bg px-3.5 py-2.5 text-[15px] leading-relaxed outline-none transition-colors placeholder:text-ink-mute focus:border-accent-line"
        />
        <motion.button
          type="submit"
          disabled={!texto.trim()}
          whileTap={{ scale: 0.9 }}
          aria-label="Enviar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition-opacity disabled:bg-surface-2 disabled:text-ink-mute"
        >
          <IconEnviar className="h-5 w-5" />
        </motion.button>
      </div>
      {noSalio && (
        <p className={`mt-1.5 text-xs text-danger ${suelta ? 'w-full' : 'mx-auto w-full max-w-2xl'}`}>
          Sin conexión ahora mismo. Lo escrito sigue aquí; vuelve a darle en cuanto se recupere.
        </p>
      )}
    </form>
  )

  const hilo = (
    /* Suelto, el hilo ocupa el panel entero. Centrado en una columna estrecha
       dentro de un panel ancho quedaba como una cinta flotando en medio, con
       aire de sobra a los dos lados y las burbujas lejos de los bordes. Lo que
       impide que un mensaje largo cruce la pantalla es el tope de la propia
       burbuja, no un corsé alrededor de todo. */
    <div className={`w-full py-3 ${suelta ? 'px-5' : 'mx-auto max-w-2xl px-4'}`}>
      {bloques === null && (
        <div className="space-y-3 py-4">
          {[70, 45, 60].map((w, i) => (
            <div key={i} className={`h-12 animate-pulse rounded-2xl bg-surface-2 ${i % 2 ? 'ml-auto' : ''}`} style={{ width: `${w}%` }} />
          ))}
        </div>
      )}

      {bloques?.length === 0 && (
        <p className="py-12 text-center text-sm leading-relaxed text-ink-mute">
          {esDelClub
            ? 'Aquí no ha hablado nadie todavía. Estrénalo.'
            : `Todavía no os habéis dicho nada. Escribe a ${nombreDeCanal(canal)}.`}
        </p>
      )}

      {bloques?.map(bloque => (
        bloque.tipo === 'dia'
          ? <SeparadorDeDia key={bloque.id} fecha={bloque.fecha} />
          : (
            <BloqueDeMensajes
              key={bloque.id}
              bloque={bloque}
              mio={bloque.autorId === miId}
              conNombre={esDelClub}
              nuevo={recienLlegado}
            />
          )
      ))}
    </div>
  )

  // Suelta: se monta su propia columna (cabecera fija, hilo con scroll, campo
  // abajo). Encima: lo mismo, pero con el marco de la pantalla que sube.
  if (suelta) {
    return (
      <>
        {cabecera}
        <div ref={refCuerpo} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{hilo}</div>
        {escribir}
      </>
    )
  }

  return (
    <PantallaInferior
      abierta={abierta}
      onCerrar={onCerrar}
      refCuerpo={refCuerpo}
      desdeAbajo
      cabecera={cabecera}
      pie={escribir}
    >
      {hilo}
    </PantallaInferior>
  )
}
