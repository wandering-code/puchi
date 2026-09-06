import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import LoginScreen          from './components/gatos/LoginScreen'
import GatOS                from './components/gatos/GatOS'
import UpdateBanner         from './components/gatos/UpdateBanner'
import { AuthProvider, useAuth } from './utils/auth'
import { useVersionCheck } from './utils/useVersionCheck'
import ViewportDebug from './components/ViewportDebug'

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

// El teclado de iOS y esta app se pelearon durante una issue entera (#13).
// Resumen de lo aprendido, para que no se vuelva a intentar:
//
// Safari "panea" el viewport al enfocar un campo tapado por el teclado — lo
// sube a nivel de compositor, sin tocar el layout. Eso funciona bien y es lo
// que hace cualquier web normal. Lo que aquí lo rompía era CANCELAR ese paneo
// (translateY(vv.offsetTop) sobre #root) para que la barra inferior no subiera
// con el teclado: dos mecanismos moviendo lo mismo en sentidos opuestos, cada
// uno con su propio momento de aplicarse. De ahí salían el doble movimiento al
// enfocar, los campos que acababan igual de tapados, y las franjas de fondo
// oscuro entre el contenido y el teclado. Cada parche a uno sacaba un
// artefacto nuevo en el otro.
//
// Ahora no se cancela nada: iOS panea a su aire. La barra inferior sí subiría
// con el teclado, así que sencillamente SE OCULTA mientras se escribe (ver
// MobileBottomNav en GatOS.jsx) — que es lo que hacen las apps nativas y lo
// que motivaba toda la maquinaria de antes. También se fueron con ella --kb,
// la predicción del alto del teclado y el scrollIntoView global: sin nadie
// estorbando, el propio Safari lleva el campo enfocado a la vista.
//
// Lo único que queda aquí es publicar medidas (nadie las usa para pelearse):
// --vvh/--vvtop las lee CenteredModal (LunitecaV3.jsx), y --kb la convierte
// GatOS.jsx en --kbinset para que cada app aparte su CONTENIDO del teclado
// con un padding-bottom — sin mover ni encoger su fondo, que es la parte que
// costó un día entero encontrar: encogiendo la caja, el fondo se cortaba y
// asomaba el escritorio por detrás; con padding, el fondo sigue pintando
// hasta abajo y solo el contenido se aparta.
let lastKb = null

function setKb(px) {
  if (px === lastKb) return
  lastKb = px
  document.documentElement.style.setProperty('--kb', `${px}px`)
}

// Cuánto tapa el teclado ahora mismo, contado desde el borde de abajo de
// #root. El umbral descarta las diferencias pequeñas de la barra de Safari,
// que se encoge y se estira sola; un teclado real nunca mide tan poco.
//
// Con interactive-widget=resizes-content (index.html) esto vale 0 casi
// siempre, porque el navegador ya encoge el viewport de layout hasta el
// teclado — y entonces el padding que aparta el contenido no llega ni a
// aplicarse. Se queda como red de seguridad para donde el navegador no haga
// caso de esa directiva.
//
// Hubo aquí una "predicción" que adelantaba el alto del teclado de la última
// vez al enfocar un campo, para que el hueco estuviera encogido antes de que
// el teclado apareciera. Retirada: con resizes-content aplicaba un teclado
// fantasma que el navegador nunca confirmaba, así que el contenido se
// encogía al enfocar y volvía a estirarse 800ms después — los campos
// desapareciendo y reapareciendo de golpe que reportó Wander.
//
// El `- vv.offsetTop` es imprescindible: si Safari ya ha subido la página para
// enseñar un campo, esa subida YA aparta el contenido del teclado, y no
// descontarla lo aparta el doble. Se veía como una franja del color del fondo
// entre el último campo y el teclado, del grosor exacto de lo que hubiera
// subido la página (issue #13, visto en dispositivo). El teclado empieza en
// vv.offsetTop + vv.height; lo que queda tapado por debajo es lo que va de ahí
// al final de #root.
function measureKb() {
  const vv = window.visualViewport
  const root = document.getElementById('root')
  if (!vv || !root) return 0
  const overlap = root.offsetHeight - vv.height - vv.offsetTop
  return overlap > 100 ? Math.round(overlap) : 0
}

function usePublishViewportVars() {
  useEffect(() => {
    const vv = window.visualViewport
    const root = document.getElementById('root')
    if (!vv || !root) return
    // translateY(0px) y no '' — un transform vacío hace que #root deje de ser
    // el "containing block" de sus descendientes position:fixed, y de eso sí
    // depende el layout (CenteredModal). Es 0 fijo: aquí ya no se compensa
    // nada, solo se conserva esa propiedad del transform.
    root.style.transform = 'translateY(0px)'
    function publish() {
      document.documentElement.style.setProperty('--vvh', `${vv.height}px`)
      document.documentElement.style.setProperty('--vvtop', `${vv.offsetTop}px`)
      setKb(measureKb())
    }
    publish()
    vv.addEventListener('resize', publish)
    vv.addEventListener('scroll', publish)
    // Y CADA VEZ QUE #root CAMBIA DE ALTO, que es lo que de verdad hacía
    // falta: con interactive-widget=resizes-content (index.html) el navegador
    // encoge el viewport de layout al abrirse el teclado, pero visualViewport
    // avisa ANTES de que ese encogimiento se refleje en #root. Calculando en
    // ese instante salía un teclado fantasma de ~100px que ya no tapaba nada,
    // se apartaba el contenido de más, y nada lo volvía a mirar: quedaba una
    // franja del color del fondo entre la app y el teclado hasta que un gesto
    // cualquiera disparaba otro evento de viewport y lo recalculaba. Wander
    // dio con ello al ver que le bastaba hacer scroll para que se arreglara
    // (issue #13). El observer cierra ese hueco sin depender de gestos.
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
//
// La versión anterior de esto desplazaba siempre, sin mirar, y era peor que
// el problema: en "Buscar" movía la pantalla aunque el teclado no tapara nada,
// y en "A mano" se pasaba tanto que dejaba la pantalla en blanco. Ahora lo
// normal es que no haga falta: de traer el campo a la vista se encarga
// Safari, y esto solo entra si al terminar de abrirse el teclado el campo
// sigue sin verse entero.
function useScrollFocusedIntoView() {
  useEffect(() => {
    let timer = null
    function revealIfHidden(el) {
      const root = document.getElementById('root')
      if (!el || !root || !el.isConnected || document.activeElement !== el) return
      const kb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kb')) || 0
      const rootRect = root.getBoundingClientRect()
      // Zona visible = #root menos lo que tapa el teclado por abajo. Se mide
      // todo con getBoundingClientRect (el mismo sistema de coordenadas para
      // los dos), así que da igual si Safari ha subido la página o no.
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

function App() {
  const { player, login, logout } = useAuth()
  const updateAvailable = useVersionCheck()
  useLockBackgroundScroll()
  usePublishViewportVars()
  useScrollFocusedIntoView()

  return (
    <div style={{ width:'100%', height:'100%', overflow:'hidden', background:'#0a0a0a', position:'relative' }}>
      <UpdateBanner show={updateAvailable} />
      <ViewportDebug />
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
