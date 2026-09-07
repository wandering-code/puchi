import { useRef } from 'react'
import { animate, useMotionValue } from 'motion/react'

// Cerrar una capa tirando de ella hacia abajo, con el gesto puesto SOLO en su
// asa y no en el panel entero.
//
// Esto no es un capricho de organización: el `drag` de Motion le pone al
// elemento `touch-action: pan-x`, y ese elemento era el mismo que tenía el
// scroll — así que en el móvil la ficha de un libro no se podía desplazar con
// el dedo (comprobado: touch-action pan-x y scrollTop clavado en 0 al
// arrastrar). Un test que scrolleaba con `scrollTo()` no lo detectaba, porque
// eso no pasa por el gesto táctil.
//
// Con el gesto en el asa, el panel queda con su touch-action intacto y el
// contenido se desplaza con normalidad.
export function useArrastreParaCerrar(onCerrar, { umbral = 100, velocidadMin = 500 } = {}) {
  const y = useMotionValue(0)
  const inicioY = useRef(null)
  const inicioT = useRef(0)

  function alEmpezar(ev) {
    try { ev.currentTarget.setPointerCapture(ev.pointerId) } catch { /* el navegador puede negarlo */ }
    inicioY.current = ev.clientY
    inicioT.current = performance.now()
  }
  function alMover(ev) {
    if (inicioY.current == null) return
    // Solo hacia abajo: hacia arriba no se despega del borde.
    y.set(Math.max(0, ev.clientY - inicioY.current))
  }
  function alSoltar(ev) {
    if (inicioY.current == null) return
    const recorrido = Math.max(0, ev.clientY - inicioY.current)
    const velocidad = (recorrido / Math.max(1, performance.now() - inicioT.current)) * 1000
    inicioY.current = null
    // Distancia O velocidad: un tirón corto y rápido también cierra.
    if (recorrido > umbral || velocidad > velocidadMin) onCerrar()
    else animate(y, 0, { type: 'spring', stiffness: 500, damping: 40 })
  }

  return {
    y,
    // Se reparten sobre el asa. touch-action:none ahí es inofensivo: el asa no
    // scrollea nada.
    asa: {
      onPointerDown: alEmpezar,
      onPointerMove: alMover,
      onPointerUp: alSoltar,
      onPointerCancel: alSoltar,
      style: { touchAction: 'none' },
    },
  }
}
