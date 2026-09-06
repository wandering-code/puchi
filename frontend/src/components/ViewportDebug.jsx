import React, { useEffect, useState } from 'react'

// Overlay de diagnóstico del viewport con el teclado abierto (issue #13).
// APAGADO salvo que la URL lleve `?vvdebug=1` — el comportamiento del
// teclado de iOS Safari no se puede reproducir aquí (Claude solo tiene
// Chromium headless, ver memoria feedback-verificacion-ios-safari), así que
// esto existe para que Daniel pueda leer los números reales desde su iPhone
// o mandar una captura, en vez de tener que describir "se mueve raro". Se
// puede borrar entero (este archivo + sus dos líneas en main.jsx) cuando la
// issue se cierre.
//
// La LÍNEA ROJA es lo importante de la captura: donde empieza el teclado
// (vv.height, medido desde el borde de arriba de #root).
// Si un campo enfocado acaba por debajo de esa línea, el overlay lo marca
// como TAPADO.
export default function ViewportDebug() {
  const on = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('vvdebug')
  const [state, setState] = useState(null)
  const [log, setLog] = useState([])

  useEffect(() => {
    if (!on) return
    const vv = window.visualViewport
    if (!vv) return
    const t0 = performance.now()

    function snapshot(source) {
      const root = document.getElementById('root')
      const rootTop = root ? root.getBoundingClientRect().top : 0
      const el = document.activeElement
      const isField = el?.matches?.('input, textarea, select, [contenteditable]')
      const r = isField ? el.getBoundingClientRect() : null
      // Línea (en coordenadas del viewport de layout, las mismas que
      // devuelve getBoundingClientRect) donde debería empezar el teclado.
      const kbTop = vv.offsetTop + vv.height
      return {
        source,
        t: Math.round(performance.now() - t0),
        vvh: Math.round(vv.height),
        vvtop: Math.round(vv.offsetTop),
        rooth: root ? root.offsetHeight : 0,
        rootTop: Math.round(rootTop),
        innerh: window.innerHeight,
        clienth: document.documentElement.clientHeight,
        // Posición relativa a #root, para pintar la guía.
        kbLine: Math.round(kbTop - rootTop),
        field: isField ? (el.tagName.toLowerCase() + (el.name ? `[${el.name}]` : '')) : '—',
        top: r ? Math.round(r.top) : null,
        bottom: r ? Math.round(r.bottom) : null,
        tapado: r ? r.bottom > kbTop : null,
      }
    }
    function record(source) {
      const s = snapshot(source)
      setState(s)
      setLog(l => [s, ...l].slice(0, 10))
    }

    record('init')
    const onResize = () => record('resize')
    const onScroll = () => record('scroll')
    const onFocusIn = () => setTimeout(() => record('focus'), 0)
    // 600ms después del foco = con el teclado ya del todo abierto y el
    // scroll de useScrollFocusedIntoView (main.jsx) ya aplicado: es la
    // captura que dice si el campo acabó visible y si quedó hueco.
    const onSettled = () => setTimeout(() => record('+600ms'), 600)
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
    }}>
      <span style={{
        position: 'absolute', right: 2, top: -13, background: color, color: '#000',
        font: '9px/1.3 ui-monospace, Menlo, monospace', padding: '1px 3px',
      }}>{label}</span>
    </div>
  )

  return (
    <>
      {/* position:absolute dentro de #root (no fixed, no portal): así les
          llega la compensación de translateY de useLockViewportToKeyboard y
          se quedan quietas en pantalla mientras el teclado abre — que es
          justo lo que se está midiendo. */}
      {line(state.kbLine, '#ff4d4d', `teclado ${state.kbLine}`)}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100000,
        background: 'rgba(0,0,0,0.82)', color: '#7CFC98', pointerEvents: 'none',
        font: '10px/1.35 ui-monospace, Menlo, monospace', padding: '4px 6px',
        maxHeight: '42%', overflow: 'hidden',
      }}>
        <div style={{ color: '#fff' }}>
          root {state.rooth}@{state.rootTop} · inner {state.innerh} · client {state.clienth}
        </div>
        <div style={{ color: '#fff' }}>
          vvh {state.vvh} · vvtop {state.vvtop}
        </div>
        {log.map((s, i) => (
          <div key={i} style={{ opacity: i === 0 ? 1 : 0.5, whiteSpace: 'nowrap' }}>
            {String(s.t).padStart(5)}ms {s.source.padEnd(6)} h{s.vvh} top{s.vvtop} · {s.field}
            {s.bottom != null ? ` ${s.top}→${s.bottom} ${s.tapado ? 'TAPADO' : 'ok'}` : ''}
          </div>
        ))}
      </div>
    </>
  )
}
