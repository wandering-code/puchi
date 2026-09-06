import React, { useEffect, useState } from 'react'

// Overlay de diagnóstico del viewport con el teclado abierto (issues #13 y #14).
// APAGADO salvo que la URL lleve `?vvdebug=1` — el comportamiento del
// teclado de iOS Safari no se puede reproducir aquí (Claude solo tiene
// Chromium headless, ver memoria feedback-verificacion-ios-safari), así que
// esto existe para que Daniel pueda leer los números reales desde su iPhone
// o mandar una captura, en vez de tener que describir "se mueve raro". Se
// puede borrar entero (este archivo + sus dos líneas en main.jsx) cuando la
// issue se cierre.
//
// Aquí se miden dos cosas distintas:
//
// 1. La LÍNEA ROJA: dónde empieza el teclado (vv.offsetTop + vv.height). Si un
//    campo enfocado acaba por debajo, el overlay lo marca como TAPADO. Es lo
//    que se hizo para #13, que ya está resuelto.
//
// 2. La SONDA de la franja (#14): qué elemento ocupa de verdad la banda oscura
//    entre el final del contenido y el teclado. #14 documenta diez hipótesis
//    probadas y descartadas sobre su origen (interfaz de Safari, lienzo del
//    documento, borde del contenedor de apps...) — ninguna se había MEDIDO. La
//    sonda dispara elementFromPoint en una columna de puntos justo por encima
//    de la línea del teclado y, por cada impacto, sube por los ancestros hasta
//    el primero que pinta un fondo opaco. Eso responde a la vez a "qué elemento
//    es la franja" y a "quién le da el color oscuro", que es lo único que hace
//    falta saber para arreglarla.
//    La columna del borde derecho existe porque en la captura de #14 se veía
//    una barra de scroll dentro de la franja: si ahí hay un elemento con
//    overflow, la sonda lo marca con SCROLL.

// Desplazamientos respecto de donde empieza el teclado. Los POSITIVOS caen
// dentro de la franja misma: si ahí sale null es que no hay página, y entonces
// la franja es del navegador y no hay nada que arreglar en el layout. Los
// negativos entran en la app, y sirven de control: si TODOS dan null otra vez,
// el que está mal es el sistema de coordenadas, no la página.
const CENTRO = [40, 8, -1, -10, -32, -72, -130]
const DERECHA = [40, -10]

// Nombre corto y reconocible de un elemento, para que quepa en la pantalla del
// móvil: tag + id + las dos primeras clases.
function etiqueta(el) {
  if (!el) return 'null'
  const raw = typeof el.className === 'string' ? el.className : (el.getAttribute?.('class') || '')
  const cls = raw.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.')
  return el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (cls ? `.${cls}` : '')
}

// rgb(26, 26, 46) -> #1a1a2e. Los colores en hexadecimal se reconocen de un
// vistazo contra index.css; los rgb() largos no, y además no caben.
function colorCorto(c) {
  const m = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/.exec(c || '')
  if (!m) return c || '—'
  const hex = [m[1], m[2], m[3]].map(v => Number(v).toString(16).padStart(2, '0')).join('')
  const a = m[4] === undefined ? 1 : Number(m[4])
  return `#${hex}${a < 1 ? ` a${a}` : ''}`
}

function esTransparente(c) {
  return !c || c === 'transparent' || /rgba\(\s*[\d.]+,\s*[\d.]+,\s*[\d.]+,\s*0\s*\)/.test(c)
}

// El elemento que de verdad pinta el color que se ve en ese punto: el propio
// impacto si tiene fondo, y si no el primer ancestro que lo tenga. Sin esto la
// sonda diría "aquí hay un div" sin decir de dónde sale el oscuro, que es justo
// el dato que falta en #14.
function quienPinta(el) {
  let n = el
  while (n && n.nodeType === 1) {
    const c = getComputedStyle(n).backgroundColor
    if (!esTransparente(c)) return `${etiqueta(n)} ${colorCorto(c)}`
    n = n.parentElement
  }
  return 'nadie (lienzo)'
}

function tieneScroll(el) {
  if (!el) return false
  const o = getComputedStyle(el)
  return el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(o.overflowY)
}

export default function ViewportDebug() {
  const on = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('vvdebug')
  const [state, setState] = useState(null)
  const [log, setLog] = useState([])
  const [sonda, setSonda] = useState(null)

  useEffect(() => {
    if (!on) return
    const vv = window.visualViewport
    if (!vv) return
    const t0 = performance.now()
    // Alto del viewport de layout en reposo, medido antes de que haya teclado.
    // Es la referencia contra la que se sabe si el navegador ha encogido el
    // layout o no (ver veredicto abajo).
    const baseClient = document.documentElement.clientHeight

    function snapshot(source) {
      const root = document.getElementById('root')
      const rootRect = root ? root.getBoundingClientRect() : { top: 0, bottom: 0 }
      const rootTop = rootRect.top
      const el = document.activeElement
      const isField = el?.matches?.('input, textarea, select, [contenteditable]')
      const r = isField ? el.getBoundingClientRect() : null
      const clienth = document.documentElement.clientHeight
      // MEDIDO EN EL IPHONE (captura del 19:02, issue #14) — no es teoría:
      //   root 775@-420 · vvh 355 · vvtop 420
      // El overlay va dibujado en top:0 de #root con translateY(--vvtop), o sea
      // en rect -420 + 420 = 0, y en la captura sale pegado al borde de arriba
      // del área visible. Luego en coordenadas de getBoundingClientRect el 0 ES
      // el borde superior visible, y el teclado empieza en vv.height (355) a
      // secas. Sumar vv.offsetTop —que es lo que hacía la primera versión de
      // esto— apuntaba a 775, unos 400px por DEBAJO del final del documento
      // (#root acaba en rect 355): por eso la sonda devolvía null en los siete
      // puntos. Ese null no decía nada de la franja, solo "fuera de la página".
      const kbTop = vv.height
      // Si algún día rootTop deja de valer exactamente -vvtop, esta cuenta deja
      // de dar 0 y quiere decir que el sistema de coordenadas de ese dispositivo
      // no es el de aquí — antes de creerse la sonda, mirar esto.
      const desfase = Math.round(rootTop + vv.offsetTop)
      // Si el navegador hiciera caso a interactive-widget=resizes-content
      // (index.html), el viewport de layout se encogería con el teclado. OJO con
      // clientHeight: html es position:fixed con height:100% (index.css), así
      // que devuelve el alto del PROPIO html —775, resuelto contra el bloque
      // contenedor inicial, que no encoge— y no el del viewport. La comparación
      // que vale es innerHeight contra vv.height.
      const kbAbierto = vv.height < baseClient - 100
      return {
        source,
        kbAbierto,
        resizes: !kbAbierto ? null : window.innerHeight <= vv.height + 30,
        t: Math.round(performance.now() - t0),
        vvh: Math.round(vv.height),
        vvtop: Math.round(vv.offsetTop),
        rooth: root ? root.offsetHeight : 0,
        rootTop: Math.round(rootTop),
        rootBottom: Math.round(rootRect.bottom),
        desfase,
        innerh: window.innerHeight,
        baseClient,
        clienth,
        kb: Math.round(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kb')) || 0),
        // Posición relativa a #root. El overlay lleva translateY(--vvtop), así
        // que hay que descontarlo aquí para que la línea caiga donde toca.
        kbLine: Math.round(kbTop - rootTop - vv.offsetTop),
        field: isField ? (el.tagName.toLowerCase() + (el.name ? `[${el.name}]` : '')) : '—',
        top: r ? Math.round(r.top) : null,
        bottom: r ? Math.round(r.bottom) : null,
        tapado: r ? r.bottom > kbTop : null,
      }
    }
    function record(source) {
      const s = snapshot(source)
      setState(s)
      setLog(l => [s, ...l].slice(0, 3))
    }

    // elementFromPoint usa las mismas coordenadas que getBoundingClientRect, y
    // en el iPhone el 0 de esas coordenadas es el borde superior VISIBLE (ver
    // el bloque MEDIDO EN EL IPHONE de snapshot). Así que el teclado empieza en
    // vv.height a secas, sin sumarle vv.offsetTop.
    function medirFranja() {
      const kbTop = vv.height
      const cx = Math.round(window.innerWidth / 2)
      const dx = Math.max(0, window.innerWidth - 3)
      const punto = (x, dy) => {
        const y = Math.round(kbTop + dy)
        const el = document.elementFromPoint(x, y)
        const r = el?.getBoundingClientRect?.()
        return {
          dy,
          hit: etiqueta(el),
          rect: r ? `${Math.round(r.top)}→${Math.round(r.bottom)}` : '',
          scroll: tieneScroll(el),
          pinta: el ? quienPinta(el) : '—',
        }
      }
      setSonda({
        cx, dx,
        kbTop: Math.round(kbTop),
        centro: CENTRO.map(dy => punto(cx, dy)),
        derecha: DERECHA.map(dy => punto(dx, dy)),
      })
    }

    record('init')
    const onResize = () => record('resize')
    const onScroll = () => record('scroll')
    const onFocusIn = () => setTimeout(() => record('focus'), 0)
    // 600ms después del foco = con el teclado ya del todo abierto y el
    // scroll de useScrollFocusedIntoView (main.jsx) ya aplicado: es la
    // captura que dice si el campo acabó visible y si quedó hueco, y el único
    // momento en que tiene sentido sondear la franja (antes se está moviendo
    // todo todavía).
    const onSettled = () => setTimeout(() => { record('+600ms'); medirFranja() }, 600)
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onScroll)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusin', onSettled)
    return () => {
      vv.removeEventListener('resize', onResize)
      vv.removeEventListener('scroll', onScroll)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusin', onSettled)
    }
  }, [on])

  if (!on || !state) return null

  const line = (y, color, label) => (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: y, height: 0,
      borderTop: `1.5px dashed ${color}`, zIndex: 100001, pointerEvents: 'none',
      transform: 'translateY(var(--vvtop, 0px))',
    }}>
      <span style={{
        position: 'absolute', right: 2, top: -13, background: color, color: '#000',
        font: '9px/1.3 ui-monospace, Menlo, monospace', padding: '1px 3px',
      }}>{label}</span>
    </div>
  )

  const fila = (p, i) => (
    <div key={i} style={{ marginTop: 2 }}>
      <div style={{ color: p.scroll ? '#ffd166' : '#7CFC98' }}>
        {String(p.dy).padStart(4)} {p.hit} {p.rect}{p.scroll ? ' SCROLL' : ''}
      </div>
      <div style={{ color: '#9ecbff', paddingLeft: 22 }}>pinta {p.pinta}</div>
    </div>
  )

  return (
    <>
      {/* position:absolute dentro de #root (no fixed, no portal), con el mismo
          translateY(--vvtop) que MenuBar: así el overlay y la línea del teclado
          se quedan a la vista cuando Safari sube la página, que es justo cuando
          hay que leerlos. */}
      {line(state.kbLine, '#ff4d4d', `teclado ${state.kbLine}`)}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100000,
        background: 'rgba(0,0,0,0.86)', color: '#7CFC98', pointerEvents: 'none',
        font: '9px/1.3 ui-monospace, Menlo, monospace', padding: '4px 6px',
        maxHeight: '58%', overflow: 'hidden',
        transform: 'translateY(var(--vvtop, 0px))',
      }}>
        <div style={{ color: '#fff' }}>
          root {state.rooth} · rect {state.rootTop}→{state.rootBottom} · inner {state.innerh}
        </div>
        <div style={{ color: '#fff' }}>
          vvh {state.vvh} · vvtop {state.vvtop} · client {state.clienth}/{state.baseClient} · --kb {state.kb}
        </div>
        {/* rootBottom contra vvh es LA comparación: si coinciden, la app acaba
            justo en el borde visible y la franja de #14 no es suya. desfase
            distinto de 0 avisa de que las coordenadas no son las medidas en el
            iPhone y de que la sonda estaría apuntando mal. */}
        <div style={{ color: Math.abs(state.rootBottom - state.vvh) <= 2 ? '#7CFC98' : '#ffd166' }}>
          rootBottom−vvh {state.rootBottom - state.vvh}
          {Math.abs(state.rootBottom - state.vvh) <= 2 ? ' (la app llega al borde)' : ' (la app NO llega)'}
          {state.desfase !== 0 ? ` · desfase ${state.desfase}!` : ''}
        </div>
        <div style={{ color: state.resizes === null ? '#888' : (state.resizes ? '#7CFC98' : '#ff8080') }}>
          {state.resizes === null
            ? 'teclado cerrado — enfoca un campo'
            : `resizes-content: ${state.resizes ? 'SI (layout encogido)' : 'NO (Safari solo panea)'}`}
        </div>
        {log.map((s, i) => (
          <div key={i} style={{ opacity: i === 0 ? 1 : 0.45, whiteSpace: 'nowrap' }}>
            {String(s.t).padStart(5)}ms {s.source.padEnd(6)} h{s.vvh} top{s.vvtop} · {s.field}
            {s.bottom != null ? ` ${s.top}→${s.bottom} ${s.tapado ? 'TAPADO' : 'ok'}` : ''}
          </div>
        ))}
        {sonda && (
          <>
            <div style={{ color: '#fff', marginTop: 4 }}>
              ── franja · teclado en y={sonda.kbTop} · x={sonda.cx} ──
            </div>
            {sonda.centro.map(fila)}
            <div style={{ color: '#fff', marginTop: 3 }}>── borde der · x={sonda.dx} ──</div>
            {sonda.derecha.map(fila)}
          </>
        )}
      </div>
    </>
  )
}
