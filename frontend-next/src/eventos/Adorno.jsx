import { useLayoutEffect, useRef, useState } from 'react'
import { usarEvento } from './usarEvento'

// El hueco donde un evento de temporada cuelga su pieza para este sitio (la
// lista de sitios está en eventos/index.js). Sin evento, o sin pieza para
// aquí, no pinta nada: los componentes lo ponen sin preguntar.
//
// Lo que entra y sale al encender o apagar la decoración no necesita animarse
// por su cuenta: ese cambio va por el círculo de la View Transition
// (conCirculo, platform/tema.js), que funde la app entera de una vez.
export default function Adorno({ sitio, ...props }) {
  const evento = usarEvento()
  const Pieza = evento?.adornos?.[sitio]
  return Pieza ? <Pieza {...props} /> : null
}

// ¿Trae el evento de ahora algo para este sitio? Para quien tiene que
// preparar el hueco antes (el logo, que cambia de envoltorio).
export function usarHayAdorno(sitio) {
  return !!usarEvento()?.adornos?.[sitio]
}

// La pieza misma, para quien la pinta muchas veces seguidas (una por libro en
// la estantería): así se pregunta por el evento una vez y no en cada hueco.
export function usarPiezaDeAdorno(sitio) {
  return usarEvento()?.adornos?.[sitio] || null
}

// La capa del sitio `contenido`: lo que va PEGADO A LA PÁGINA y no a la
// pantalla (los murciélagos de Halloween). Se pone dentro del contenedor que
// hace scroll, como hermana de la pantalla, así que al bajar se va con ella.
//
// No envuelve a la pantalla (algunas usan h-full y dejarían de llenar), sino
// que mide hasta dónde llega lo que hay a su lado y se estira hasta ahí. Mide
// a los hermanos y no el scrollHeight, que la incluye a ella misma: si no,
// nunca podría encoger. Recorta lo que se salga, para no alargar el scroll.
//
// z-[30]: por encima de las barras pegadas de las pantallas (sticky, hasta
// z-20: la de buscar/filtrar/vista de la Luniteca). Debajo, un murciélago se
// metía tras su fondo, que es del color de la página: desaparecía detrás de
// algo que no se ve. Y por debajo de todo lo que se abre encima (hojas, la
// ficha, avisos: z-40 en adelante).
export function CapaDeContenido() {
  const Pieza = usarPiezaDeAdorno('contenido')
  const capa = useRef(null)
  const [alto, setAlto] = useState(0)
  useLayoutEffect(() => {
    const el = capa.current
    const padre = el?.parentElement
    if (!Pieza || !padre) return
    const medir = () => {
      let fondo = padre.clientHeight
      for (const h of padre.children) if (h !== el) fondo = Math.max(fondo, h.offsetTop + h.offsetHeight)
      setAlto(fondo)
    }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(padre)
    for (const h of padre.children) if (h !== el) ro.observe(h)
    return () => ro.disconnect()
  }, [Pieza])
  if (!Pieza) return null
  return (
    <div ref={capa} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-[30] overflow-hidden" style={{ height: alto }}>
      <Pieza alto={alto} />
    </div>
  )
}
