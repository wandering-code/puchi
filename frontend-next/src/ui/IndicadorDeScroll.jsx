import { useEffect, useRef, useState } from 'react'

// El indicador de scroll de las pantallas, en los móviles.
//
// El de Safari de iOS se quedaba DEBAJO de las barras pegadas con capa propia
// (la de buscar/filtrar/vista de la Luniteca, z-20): al bajar por la
// estantería, el indicador desaparecía detrás de ellas. Desde CSS no hay forma
// de subirlo, así que en los dispositivos táctiles se esconde el del sistema
// (index.css, [data-scroll="pantalla"]) y se pinta este, que hace lo mismo:
// aparece al desplazar y se desvanece al parar. Va por encima de las barras
// pegadas y de los adornos, y por debajo de hojas y fichas (z-40+).
//
// Un solo oyente en <main>, en fase de captura: los eventos de scroll no
// suben, pero sí se capturan al bajar, así que sirve para la pantalla que
// esté puesta aunque se cambie de sección. Solo transform y opacity.
//
// En el ordenador no se usa: allí se queda la barra del navegador, fina
// (ver index.css), que además se puede arrastrar.
const MINIMO = 36          // alto mínimo del indicador, px
const MARGEN = 3           // aire arriba y abajo
const ESPERA = 900         // lo que tarda en irse al parar

export default function IndicadorDeScroll() {
  const tactil = useTactil()
  const capa = useRef(null)
  const pieza = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!tactil) return
    const main = capa.current?.parentElement
    if (!main) return
    let reloj = null
    let pedido = 0
    let alto = 0
    const pintar = el => {
      pedido = 0
      const { scrollTop, scrollHeight, clientHeight } = el
      const sobra = scrollHeight - clientHeight
      if (sobra <= 1) return setVisible(false)
      const pista = clientHeight - MARGEN * 2
      const h = Math.max(MINIMO, Math.round(pista * (clientHeight / scrollHeight)))
      if (h !== alto) { alto = h; pieza.current.style.height = `${h}px` }
      // El rebote de iOS lleva scrollTop por debajo de 0 y por encima del
      // final: se queda en los extremos en vez de salirse.
      const t = Math.min(1, Math.max(0, scrollTop / sobra))
      pieza.current.style.transform = `translateY(${Math.round(MARGEN + t * (pista - h))}px)`
      setVisible(true)
      clearTimeout(reloj)
      reloj = setTimeout(() => setVisible(false), ESPERA)
    }
    const alDesplazar = e => {
      const el = e.target
      if (!(el instanceof Element) || el.dataset.scroll !== 'pantalla') return
      if (!pedido) pedido = requestAnimationFrame(() => pintar(el))
    }
    main.addEventListener('scroll', alDesplazar, { capture: true, passive: true })
    return () => {
      main.removeEventListener('scroll', alDesplazar, { capture: true })
      cancelAnimationFrame(pedido)
      clearTimeout(reloj)
    }
  }, [tactil])

  if (!tactil) return null
  return (
    <div ref={capa} aria-hidden className="pointer-events-none absolute inset-y-0 right-[2px] z-[35] w-[3px]">
      <div
        ref={pieza}
        className="absolute left-0 top-0 w-full rounded-full"
        style={{
          background: 'color-mix(in srgb, var(--color-ink) 32%, transparent)',
          opacity: visible ? 1 : 0,
          transition: `opacity ${visible ? 120 : 360}ms ease-out`,
          willChange: 'transform',
        }}
      />
    </div>
  )
}

// Táctil = sin ratón que pase por encima (el iPhone, el iPad sin trackpad).
function useTactil() {
  const [t] = useState(() => typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches)
  return t
}
