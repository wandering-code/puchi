import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import LoginScreen          from './components/gatos/LoginScreen'
import GatOS                from './components/gatos/GatOS'
import UpdateBanner         from './components/gatos/UpdateBanner'
import { AuthProvider, useAuth } from './utils/auth'
import { useVersionCheck } from './utils/useVersionCheck'

// issue reportada: arrastrar hasta el límite del scroll interno de un
// modal (CenteredModal, LunitecaV3.jsx) seguía moviendo/rebotando TODO el
// fondo por debajo (comprobado con capturas de pantalla), pese a que
// html/body ya son position:fixed + overscroll-behavior:none — eso evita el
// scroll "normal" pero no el rebote elástico que el UIScrollView de nivel
// superior de iOS sigue reconociendo aparte, a nivel de gesto táctil, no de
// CSS. Único bloqueo que de verdad funciona: cancelar el propio evento
// touchmove salvo que el dedo esté DENTRO de un contenedor con scroll DE
// VERDAD — detectado en vivo (overflow-y auto/scroll + contenido que de
// hecho desborda), no por una clase concreta. Issue reportada: la primera
// versión de esto miraba solo la clase .luni3-vscroll (propia de
// Luniteca), y como GatOS tiene muchas más apps (chat, ajustes...) con sus
// propios scrolls sin esa clase, les rompía el scroll a todas ellas. Es la
// misma técnica que usan librerías como body-scroll-lock.
function useLockBackgroundScroll() {
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
    function onTouchStart(ev) {
      scrollableAncestor = findScrollableAncestor(ev.target)
    }
    function onTouchMove(ev) {
      if (!scrollableAncestor) ev.preventDefault()
    }
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
    }
  }, [])
}

// iOS "panea" el viewport a nivel de compositor para dejar el input
// enfocado por encima del teclado — independiente de que html/body sean
// position:fixed (eso solo evita el scroll normal del documento, no este
// paneo nativo) y, tal y como se comprobó en dispositivo real, también
// independiente de interactive-widget=overlays-content (probado y
// descartado — seguía paneando igual). Se cancela desplazando #root en
// sentido contrario según visualViewport.offsetTop.
//
// OJO — #root NUNCA se encoge de alto (issue reportada: encogerlo al hueco
// visible, vv.height, hacía que la barra inferior — MobileBottomNav, dentro
// de #root con bottom:0 — "subiera" con el teclado en vez de quedarse fija
// en el fondo físico real de la pantalla, que es lo que se pidió). #root SE
// QUEDA a altura completa siempre: así cualquier bottom:0 dentro de él
// permanece en el sitio de verdad, y si el teclado cubre esa zona
// simplemente la tapa por encima, nunca la desplaza. Quien SÍ necesita
// encogerse (el modal, para que su contenido no quede debajo del teclado)
// usa --vvh/--vvtop por su cuenta (ver CenteredModal, LunitecaV3.jsx) — sin
// depender de que #root cambie de tamaño.
function useLockViewportToKeyboard() {
  useEffect(() => {
    const vv = window.visualViewport
    const root = document.getElementById('root')
    if (!vv || !root) return
    function pin() {
      // Siempre con un valor (nunca ''), aunque offsetTop sea 0 — un
      // transform vacío hace que #root deje de ser el "containing block" de
      // sus descendientes position:fixed.
      root.style.transform = `translateY(${vv.offsetTop}px)`
      document.documentElement.style.setProperty('--vvh', `${vv.height}px`)
      document.documentElement.style.setProperty('--vvtop', `${vv.offsetTop}px`)
    }
    pin()
    vv.addEventListener('resize', pin)
    vv.addEventListener('scroll', pin)
    return () => {
      vv.removeEventListener('resize', pin)
      vv.removeEventListener('scroll', pin)
      root.style.transform = ''
      document.documentElement.style.removeProperty('--vvh')
      document.documentElement.style.removeProperty('--vvtop')
    }
  }, [])
}

function App() {
  const { player, login, logout } = useAuth()
  const updateAvailable = useVersionCheck()
  useLockBackgroundScroll()
  useLockViewportToKeyboard()

  return (
    <div style={{ width:'100%', height:'100%', overflow:'hidden', background:'#0a0a0a', position:'relative' }}>
      <UpdateBanner show={updateAvailable} />
      {!player ? (
        <LoginScreen />
      ) : (
        <GatOS
          player={player}
          onLogout={logout}
          onProfileUpdate={(u) => u === null ? logout() : login({ ...player, ...u })}
        />
      )}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider><App /></AuthProvider>
)
