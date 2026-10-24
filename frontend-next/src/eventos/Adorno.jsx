import { useLayoutEffect, useRef, useState } from 'react'
import { usarEvento } from './usarEvento'
import { ENCOGE } from '../ui/Desplegable'

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
    // El alto se pone directamente en el elemento, en el mismo fotograma en
    // que cambia el contenido (los ResizeObserver avisan antes de pintar): si
    // esperara al render de React iría un fotograma tarde, y al plegar una
    // sección el scroll se recolocaba de golpe. El estado es solo para
    // repartir los murciélagos, que pueden ir un fotograma por detrás.
    let ultimo = 0
    const poner = fondo => {
      if (fondo === ultimo) return
      ultimo = fondo
      el.style.height = `${fondo}px`
      setAlto(fondo)
    }
    const medir = () => {
      let fondo = padre.clientHeight
      for (const h of padre.children) if (h !== el) fondo = Math.max(fondo, h.offsetTop + h.offsetHeight)
      poner(fondo)
    }
    // Al empezar a plegarse algo, la capa encoge ya lo que va a encoger, sin
    // medir nada (ver ENCOGE en ui/Desplegable); nunca por debajo del alto de
    // la pantalla. Solo el elemento, no el reparto de murciélagos: los que se
    // queden por debajo los recorta la propia capa. Si la cuenta no fuera
    // exacta, el ResizeObserver la corrige en cuanto el contenido cambie.
    const encoger = e => {
      ultimo = Math.max(padre.clientHeight, ultimo - (e.detail || 0))
      el.style.height = `${ultimo}px`
    }
    // Se vigila lo que mide cada hermano y, además, si cambian los hermanos:
    // la pantalla puede sustituir su elemento raíz (la Luniteca lo hace al
    // terminar de cargar), y vigilando solo el de al montarse esta capa se
    // quedaba con el alto de antes. Pasó: con todas las secciones plegadas
    // seguía midiendo 4.110px sobre un contenido de 875, y esos 3.000px de
    // más se podían recorrer con el scroll, enseñando el fondo de debajo.
    const ro = new ResizeObserver(medir)
    const vigilar = () => {
      ro.disconnect()
      ro.observe(padre)
      for (const h of padre.children) if (h !== el) ro.observe(h)
      medir()
    }
    vigilar()
    const mo = new MutationObserver(vigilar)
    mo.observe(padre, { childList: true })
    window.addEventListener(ENCOGE, encoger)
    return () => { ro.disconnect(); mo.disconnect(); window.removeEventListener(ENCOGE, encoger) }
  }, [Pieza])
  if (!Pieza) return null
  return (
    <div ref={capa} aria-hidden data-fuera-del-alto className="pointer-events-none absolute inset-x-0 top-0 z-[30] overflow-hidden">
      <Pieza alto={alto} />
    </div>
  )
}
