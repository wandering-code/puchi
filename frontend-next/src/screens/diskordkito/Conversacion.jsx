import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { CANAL_DEL_CLUB, nombreDeCanal, useChat } from '../../platform/chat'
import PantallaInferior from '../luniteca/PantallaInferior'
import Avatar from '../../ui/Avatar'
import { IconArrowLeft, IconClub, IconEnviar } from '../../ui/icons'
import { BloqueDeMensajes, PuntoConectado, SeparadorDeDia, agruparMensajes } from './piezas'

// Una conversación, a pantalla completa.
//
// Sube desde abajo como la ficha de un libro, y se cierra igual: con la flecha,
// arrastrando el asa o con el gesto de volver del móvil. No es una columna al
// lado de una lista —eso es el reparto de Discord, pensado para tener catorce
// canales a la vista— sino una pantalla que se abre y se cierra, que es lo que
// pide un móvil y lo que ya hace el resto de Puchi.

export default function Conversacion({ canalId, abierta, onCerrar }) {
  const { miId, canales, mensajesDe, cargarMensajes, enviar, marcarLeido, mirando, estaOnline } = useChat()
  const canal = canales.find(c => c.id === canalId)
  const mensajes = mensajesDe(canalId)
  const [texto, setTexto] = useState('')
  const [noSalio, setNoSalio] = useState(false)
  const cuerpo = useRef(null)

  const esDelClub = canal?.type !== 'dm'
  const otro = canal?.other_player
  const conNombre = esDelClub   // en un uno a uno el nombre sobra: solo sois dos

  // Al abrirla: se piden los mensajes y se marca como leída. Mientras esté
  // abierta, lo que llegue se marca leído solo (lo hace el motor del chat, que
  // sabe qué se está mirando).
  useEffect(() => {
    if (!abierta || !canalId) return
    mirando(canalId)
    cargarMensajes(canalId)
    marcarLeido(canalId)
    return () => mirando(null)
  }, [abierta, canalId, mirando, cargarMensajes, marcarLeido])

  // Abajo del todo, que es donde está lo último. Con useLayoutEffect y no
  // useEffect: así el salto ocurre antes de pintar, y no se ve la conversación
  // aparecer por arriba y bajar de golpe. El nodo que se desplaza es el de la
  // pantalla, que nos lo presta por `refCuerpo`.
  const cuantos = mensajes?.length ?? 0
  const previos = useRef(0)
  const recienLlegado = cuantos > previos.current && previos.current > 0
  useLayoutEffect(() => {
    previos.current = cuantos
    const el = cuerpo.current
    if (el) el.scrollTop = el.scrollHeight
  }, [cuantos, canalId])

  function mandar(ev) {
    ev.preventDefault()
    if (!texto.trim()) return
    if (enviar(canalId, texto)) {
      setTexto('')
      setNoSalio(false)
    } else {
      // El socket está cerrado (red caída, backend reiniciándose). No se da
      // por enviado ni se borra lo escrito: se avisa y el texto sigue ahí
      // para volver a intentarlo cuando vuelva.
      setNoSalio(true)
    }
  }

  const bloques = mensajes ? agruparMensajes(mensajes) : null

  return (
    <PantallaInferior
      abierta={abierta}
      onCerrar={onCerrar}
      refCuerpo={cuerpo}
      desdeAbajo
      cabecera={
        <div className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-3 py-2">
            <motion.button
              onClick={onCerrar}
              aria-label="Volver a las conversaciones"
              whileTap={{ scale: 0.92 }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink transition-colors active:bg-surface-2"
            >
              <IconArrowLeft className="h-5 w-5" />
            </motion.button>

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
          </div>
        </div>
      }
      pie={
        <form
          onSubmit={mandar}
          // pb-kb: el hueco de abajo crece con el teclado en vez de que la caja
          // se encoja (ver index.css y el manejo de --kb). Es lo mismo que hace
          // el resto de la app con los campos de escribir.
          className="border-t border-line bg-surface px-3 pt-2.5 pb-kb"
        >
          <div className="mx-auto flex w-full max-w-2xl items-end gap-2">
            <textarea
              value={texto}
              onChange={ev => { setTexto(ev.target.value); setNoSalio(false) }}
              onKeyDown={ev => {
                // Intro envía, Mayús+Intro hace salto de línea — en el móvil el
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
            <p className="mx-auto mt-1.5 w-full max-w-2xl text-xs text-danger">
              Sin conexión ahora mismo. Lo escrito sigue aquí; vuelve a darle en cuanto se recupere.
            </p>
          )}
        </form>
      }
    >
      <div className="mx-auto w-full max-w-2xl px-4 py-3">
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
                conNombre={conNombre}
                nuevo={recienLlegado}
              />
            )
        ))}
      </div>
    </PantallaInferior>
  )
}
