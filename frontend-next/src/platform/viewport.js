// Manejo de viewport/teclado en móvil. PORTADO TAL CUAL desde
// frontend/src/main.jsx (la Puchi actual) — es lo único de este proyecto que
// NO se rediseña. Costó la issue #13 entera de dar con ello en dispositivo
// real, y los comentarios largos con el historial de lo que se probó y
// fracasó siguen en aquel archivo. Resumen de las reglas que no se rompen:
//
//   1. No se compensa el paneo de iOS. Safari sube la página al enfocar un
//      campo tapado por el teclado; cancelarlo (translateY sobre #root) daba
//      dos mecanismos moviendo lo mismo en sentidos opuestos, y de ahí salían
//      el doble salto al enfocar y las franjas de fondo entre contenido y
//      teclado. Lo que sube con el teclado, se oculta; no se pelea.
//   2. Solo se publican medidas (--vvh, --vvtop, --kb); nadie las usa para
//      contrarrestar al navegador.
//   3. El contenido se aparta del teclado con padding-bottom, nunca
//      encogiendo la caja: encogiéndola el fondo se corta y asoma lo que hay
//      detrás.
import { useEffect, useState } from 'react'

// Bloquea el rebote elástico del documento sin romper los scrolls internos.
// Cancela touchmove salvo que el dedo esté dentro de un contenedor que de
// verdad scrollea, detectado en vivo — no por una clase concreta, que fue el
// primer intento y dejó sin scroll a media app.
export function useLockBackgroundScroll() {
  useEffect(() => {
    function isScrollable(el) {
      const style = getComputedStyle(el)
      return /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight
    }
    function findScrollableAncestor(el) {
      while (el && el !== document.body && el !== document.documentElement) {
        if (isScrollable(el)) return el
        el = el.parentElement
      }
      return null
    }
    let scrollableAncestor = null
    function onTouchStart(ev) { scrollableAncestor = findScrollableAncestor(ev.target) }
    function onTouchMove(ev) { if (!scrollableAncestor) ev.preventDefault() }
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
    }
  }, [])
}

let lastKb = null
function setKb(px) {
  if (px === lastKb) return
  lastKb = px
  document.documentElement.style.setProperty('--kb', `${px}px`)
}

// Cuánto tapa el teclado, contado desde el borde inferior de #root. El umbral
// descarta los cambios de la barra de Safari, que se encoge y se estira sola.
// Restar vv.offsetTop es imprescindible: si Safari ya subió la página para
// enseñar el campo, esa subida YA aparta el contenido y no descontarla lo
// aparta el doble (se veía como una franja de fondo sobre el teclado).
// Con interactive-widget=resizes-content esto vale 0 casi siempre; se queda
// como red de seguridad para donde el navegador no haga caso de la directiva.
function measureKb() {
  const vv = window.visualViewport
  const root = document.getElementById('root')
  if (!vv || !root) return 0
  const overlap = root.offsetHeight - vv.height - vv.offsetTop
  return overlap > 100 ? Math.round(overlap) : 0
}

export function usePublishViewportVars() {
  useEffect(() => {
    const vv = window.visualViewport
    const root = document.getElementById('root')
    if (!vv || !root) return
    // translateY(0px) y no '': un transform vacío hace que #root deje de ser
    // el containing block de sus descendientes position:fixed. Es 0 fijo —
    // aquí ya no se compensa nada, solo se conserva esa propiedad.
    root.style.transform = 'translateY(0px)'
    function publish() {
      document.documentElement.style.setProperty('--vvh', `${vv.height}px`)
      document.documentElement.style.setProperty('--vvtop', `${vv.offsetTop}px`)
      setKb(measureKb())
    }
    publish()
    vv.addEventListener('resize', publish)
    vv.addEventListener('scroll', publish)
    // Y cada vez que #root cambia de alto: con resizes-content el navegador
    // encoge el viewport de layout al abrirse el teclado, pero visualViewport
    // avisa ANTES de que eso se refleje en #root. Sin este observer quedaba un
    // teclado fantasma de ~100px hasta que cualquier gesto lo recalculaba.
    const ro = new ResizeObserver(publish)
    ro.observe(root)
    return () => {
      ro.disconnect()
      vv.removeEventListener('resize', publish)
      vv.removeEventListener('scroll', publish)
      root.style.transform = ''
      document.documentElement.style.removeProperty('--vvh')
      document.documentElement.style.removeProperty('--vvtop')
      document.documentElement.style.removeProperty('--kb')
      lastKb = null
    }
  }, [])
}

// Red de seguridad, y solo eso: si tras abrirse el teclado el campo enfocado
// SIGUE fuera de la zona visible, se le trae con el scroll de su contenedor.
// La versión que desplazaba siempre, sin mirar, era peor que el problema.
export function useScrollFocusedIntoView() {
  useEffect(() => {
    let timer = null
    function revealIfHidden(el) {
      const root = document.getElementById('root')
      if (!el || !root || !el.isConnected || document.activeElement !== el) return
      const kb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kb')) || 0
      const rootRect = root.getBoundingClientRect()
      const limiteAbajo = rootRect.top + root.offsetHeight - kb
      const r = el.getBoundingClientRect()
      if (r.top >= rootRect.top && r.bottom <= limiteAbajo) return // ya se ve entero
      el.scrollIntoView({ block: 'nearest' })
    }
    function onFocusIn(ev) {
      const el = ev.target
      if (!el?.matches?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return
      // Una sola vez, con el teclado ya abierto del todo y después de que
      // Safari haya hecho lo suyo — no se compite con él.
      clearTimeout(timer)
      timer = setTimeout(() => revealIfHidden(el), 400)
    }
    function onFocusOut() { clearTimeout(timer) }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])
}

// Los tres juntos, que es como se usan siempre.
export function useMobileViewport() {
  useLockBackgroundScroll()
  usePublishViewportVars()
  useScrollFocusedIntoView()
}

// ¿Está el usuario escribiendo? La barra inferior sube con el teclado en iOS
// (no se compensa el paneo, ver arriba), así que la solución adoptada en la
// Puchi actual es sencillamente ocultarla mientras se escribe — que es lo que
// hacen las apps nativas. Se mira el foco, no --kb: con
// interactive-widget=resizes-content --kb vale 0 casi siempre.
export function useIsTyping() {
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    const SEL = 'input, textarea, [contenteditable=""], [contenteditable="true"]'
    function onFocusIn(ev) { if (ev.target?.matches?.(SEL)) setTyping(true) }
    function onFocusOut() {
      // En el siguiente tick: al saltar de un campo a otro hay un instante sin
      // foco, y sin esto la barra parpadearía en cada salto.
      setTimeout(() => setTyping(!!document.activeElement?.matches?.(SEL)), 0)
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])
  return typing
}
