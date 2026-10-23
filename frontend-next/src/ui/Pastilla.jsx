import { useLayoutEffect, useRef } from 'react'
import { LLEGADA } from './curvas'
import { curva, movimientoReducido } from './telon'

// La pastilla que marca lo elegido y se desliza de una opción a otra (el menú,
// las pestañas, los selectores), como hacía Motion con `layoutId`, pero a la
// frecuencia de la pantalla.
//
// Motion la movía calculando el transform en JavaScript fotograma a
// fotograma, y Safari deja eso a 60. Aquí se hace lo mismo que hacía él
// (FLIP): la que se va apunta dónde estaba, la que llega se planta en su
// sitio y el navegador anima un transform desde la otra (Web Animations, en
// la GPU).
//
// Se usa igual que antes: dentro de la opción elegida, con el mismo `grupo`
// en todas.
//
//   {activa && <Pastilla grupo="menu" className="absolute inset-0 rounded-xl2 bg-accent-soft" />}

const ultimas = new Map()   // grupo → { rect, cuando }
// Solo se desliza desde la de antes si acaba de irse: si se cerró el menú y
// se abre mucho después, aparece en su sitio sin más.
const RECIENTE = 400

export default function Pastilla({ grupo, className = '', style, as: Etiqueta = 'span', t = LLEGADA }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const antes = ultimas.get(grupo)
    const ahora = el.getBoundingClientRect()
    if (antes && performance.now() - antes.cuando < RECIENTE && ahora.width && ahora.height && !movimientoReducido()) {
      const { rect: r } = antes
      const dx = r.left - ahora.left
      const dy = r.top - ahora.top
      const sx = r.width / ahora.width
      const sy = r.height / ahora.height
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5 || Math.abs(sx - 1) > 0.01 || Math.abs(sy - 1) > 0.01) {
        el.animate(
          [{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transform: 'none' }],
          { duration: t.duration * 1000, easing: curva(t) },
        )
      }
    }
    // Al irse (todavía puesta en la página), dónde estaba.
    return () => {
      if (el.isConnected) ultimas.set(grupo, { rect: el.getBoundingClientRect(), cuando: performance.now() })
    }
  }, [grupo, t])
  return <Etiqueta ref={ref} aria-hidden className={className} style={{ transformOrigin: '0 0', ...style }} />
}
