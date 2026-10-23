import { useLayoutEffect } from 'react'
import { LLEGADA } from './curvas'
import { curva, movimientoReducido } from './telon'

// Que los de una lista se recoloquen suaves cuando uno llega, se va o cambia
// de tamaño, a la frecuencia de la pantalla. Es lo que hacía Motion con
// `layout`, pero él calculaba el transform en JavaScript fotograma a
// fotograma, y Safari deja eso a 60.
//
// Se apunta dónde está cada hijo del contenedor (su sitio en la maqueta, sin
// transforms) y, en cuanto cambia algo —entra o sale un hijo, o algo cambia
// de tamaño—, antes de pintar, cada uno que se haya movido salta a su sitio
// nuevo y el navegador anima un transform desde donde estaba (FLIP, Web
// Animations, en la GPU). Si se mueve otra vez a medio camino, sigue desde
// donde se ve.
//
// Lo que entra y sale sigue con sus propias animaciones; esto solo mueve a los
// demás. El contenedor tiene que estar posicionado (relative, fixed…), para
// que los sitios se midan contra él.
//
// `escalar`: también el tamaño (los cuadros de una videollamada, que cambian
// de tamaño al entrar alguien).

export function useRecolocar(ref, { escalar = false, t = LLEGADA } = {}) {
  useLayoutEffect(() => {
    const cont = ref.current
    if (!cont) return
    const medir = el => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight })
    const hijos = () => [...cont.children].filter(el => el instanceof HTMLElement)
    let sitios = new Map()
    const animaciones = new Map()
    const ro = new ResizeObserver(() => recolocar())
    const guardar = () => {
      sitios = new Map(hijos().map(el => [el, medir(el)]))
      sitios.forEach((_, el) => ro.observe(el))
    }

    function recolocar() {
      if (movimientoReducido()) { guardar(); return }
      for (const el of hijos()) {
        const antes = sitios.get(el)
        if (!antes) continue
        const ahora = medir(el)
        // Lo que ya va moviéndose: se parte de donde se ve ahora.
        let vx = 0, vy = 0, vsx = 1, vsy = 1
        const enCurso = animaciones.get(el)
        if (enCurso && enCurso.playState === 'running') {
          const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
          vx = m.m41; vy = m.m42; vsx = m.a; vsy = m.d
          enCurso.cancel()
        }
        // Por los centros: así la escala va sobre el origen de siempre (el
        // centro) y no hace falta animar transform-origin, que no va en la GPU.
        const anchoAntes = antes.w * vsx
        const altoAntes = antes.h * vsy
        // (escalar sobre el centro no mueve el centro: solo lo mueve el translate)
        const dx = antes.x + antes.w / 2 + vx - (ahora.x + ahora.w / 2)
        const dy = antes.y + antes.h / 2 + vy - (ahora.y + ahora.h / 2)
        const sx = escalar && ahora.w ? anchoAntes / ahora.w : 1
        const sy = escalar && ahora.h ? altoAntes / ahora.h : 1
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) continue
        const desde = escalar ? `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` : `translate(${dx}px, ${dy}px)`
        animaciones.set(el, el.animate([{ transform: desde }, { transform: 'none' }], {
          duration: t.duration * 1000, easing: curva(t),
        }))
      }
      guardar()
    }

    guardar()
    ro.observe(cont)
    // Los cambios de la lista se ven antes de pintar: las mutaciones avisan
    // en una microtarea, y el ResizeObserver después de maquetar.
    const mo = new MutationObserver(recolocar)
    mo.observe(cont, { childList: true })
    return () => { mo.disconnect(); ro.disconnect(); animaciones.forEach(a => a.cancel()) }
  }, [ref, escalar, t])
}
