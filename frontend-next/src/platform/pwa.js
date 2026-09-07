// ¿La app se está viendo instalada (icono de inicio) o en una pestaña normal?
// En instalada no hay barra de navegador: ni URL, ni botón atrás en iOS, y la
// barra de gestos del iPhone pisa el borde inferior. La UI lo necesita saber.
export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    // iOS no implementó display-mode hasta hace poco; esta propiedad no
    // estándar de Safari es la que de verdad responde en iPhone.
    || window.navigator.standalone === true
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    // iPadOS 13+ se hace pasar por Mac; el touch lo delata.
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// Las safe areas no se pueden leer con getComputedStyle sobre nada que no las
// use: env() solo existe dentro de una declaración. Este medidor oculto las
// aplica como padding para poder leerlas de vuelta en píxeles reales — es la
// única forma de enseñarlas en pantalla (panel de diagnóstico de Ajustes) y
// de comprobar desde el móvil que viewport-fit=cover está haciendo efecto.
let probe = null
export function safeInsets() {
  if (!probe) {
    probe = document.createElement('div')
    probe.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'width:0', 'height:0',
      'visibility:hidden', 'pointer-events:none',
      'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)',
    ].join(';')
    document.body.appendChild(probe)
  }
  const cs = getComputedStyle(probe)
  return { top: cs.paddingTop, right: cs.paddingRight, bottom: cs.paddingBottom, left: cs.paddingLeft }
}
