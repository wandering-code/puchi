import { LLEGADA } from './curvas'

// Que algo que se ha arrastrado con el dedo vuelva a su sitio al soltarlo, a
// la frecuencia de la pantalla.
//
// Mientras el dedo está puesto, lo que se arrastra va al ritmo de los eventos
// táctiles y no hay nada que hacer. Pero la vuelta, al soltar, la hacía
// Motion con un muelle desde JavaScript (`animate(valor, 0)`), y Safari deja
// eso a 60. Aquí el valor se pone a 0 de golpe y el navegador anima el
// `transform` desde donde se soltó hasta su sitio (Web Animations, en la GPU).
//
// Si se vuelve a coger a medio camino, `cortar` deja el valor donde se ve en
// ese momento y quita la animación, para que no dé un salto.

const curva = t => `cubic-bezier(${t.ease.join(', ')})`

// `opacidad`: si lo que se arrastra se iba apagando con el recorrido (el
// mini reproductor), la que tenía al soltar, para que vuelva con ella.
export function volverASuSitio(el, valor, eje = 'y', { opacidad = null } = {}) {
  // Con el `drag` de Motion, al soltar arranca su propio muelle de vuelta (en
  // JavaScript): se para antes de poner el valor.
  valor.stop()
  const desde = valor.get()
  valor.set(0)
  if (!el || Math.abs(desde) < 0.5) return null
  const mover = d => (eje === 'y' ? `translateY(${d}px)` : `translateX(${d}px)`)
  const inicio = { transform: mover(desde) }
  const fin = { transform: 'none' }
  if (opacidad != null) { inicio.opacity = opacidad; fin.opacity = 1 }
  return el.animate([inicio, fin], {
    duration: LLEGADA.duration * 1000,
    easing: curva(LLEGADA),
  })
}

export function cortar(el, valor, animacion, eje = 'y') {
  if (!animacion || animacion.playState !== 'running' || !el) return
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
  animacion.cancel()
  valor.set(eje === 'y' ? m.m42 : m.m41)
}
