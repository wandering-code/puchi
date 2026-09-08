import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '../platform/auth'
import { useVersion } from '../platform/version'
import { isIOS, isStandalone, safeInsets } from '../platform/pwa'
import { useCapa } from '../platform/capas'
import Luniteca from './luniteca/Luniteca'
import { SelectorSeparacion, guardarSeparacion, leerSeparacion } from './luniteca/separacion'
import { IconBooks, IconExit, IconHome, IconMenu, IconPaw, IconSettings } from '../ui/icons'

const SECCIONES = [
  { to: '/',           label: 'Inicio',     Icon: IconHome },
  { to: '/luniteca',   label: 'Luniteca',   Icon: IconBooks },
  { to: '/ajustes',    label: 'Ajustes',    Icon: IconSettings },
]

export default function Shell() {
  const location = useLocation()
  const menu = useCapa()

  // El botón atrás de Android (y el gesto de volver) cierra el menú en vez de
  // salir de la app: instalada no hay barra de navegador que deshaga nada, y
  // salirse de golpe al querer cerrar un panel se siente roto. De que ese
  // "atrás" cierre solo la capa de arriba cuando hay varias abiertas se ocupa
  // useCapa (platform/capas.js).

  // Cerrar el menú AL NAVEGAR a una sección desde dentro. Aquí no se puede
  // tocar el historial: el router hace su propio pushState en el mismo clic y
  // el history.back() se aplicaría después, deshaciendo esa navegación — con
  // el efecto, visto en captura, de pulsar "Biblioteca" y acabar en "Inicio".
  // La entrada del menú se queda enterrada y sin efecto, porque que el menú
  // esté abierto es estado de React: volver a ella no lo reabre.
  function cerrarMenuAlNavegar() {
    menu.reemplazar(false)
  }

  const seccion = SECCIONES.find(s => s.to === location.pathname)

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Fondo de un solo color, plano. La textura de papel la pone el fondo
          del documento (index.css), no una capa aquí: como capa costaba
          frames en cada animación que pasara por encima. */}
      <TopBar titulo={seccion?.label} onAbrirMenu={menu.abrir} />

      <main className="relative z-10 flex-1 overflow-hidden">
        {/* Cada ruta es su propia capa a pantalla completa con su scroll: así
            el scroll de una no arrastra al de la otra durante la transición. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            className="absolute inset-0 overflow-y-auto overscroll-contain px-5 pb-kb"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <Routes location={location}>
              <Route path="/"           element={<Placeholder title="Inicio" nota="Aquí irá lo que abra la app: novedades del club, lo que estás leyendo, accesos rápidos." />} />
              <Route path="/luniteca"   element={<Luniteca />} />
              <Route path="/ajustes"    element={<Ajustes />} />
              <Route path="*"           element={<Placeholder title="Nada por aquí" nota="Esa ruta no existe (todavía)." />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      <MenuLateral abierto={menu.abierta} onCerrar={menu.cerrar} onNavegar={cerrarMenuAlNavegar} />
    </div>
  )
}

function TopBar({ titulo, onAbrirMenu }) {
  const { player } = useAuth()
  const { version } = useVersion()
  return (
    <header className="relative z-20 shrink-0 border-b border-line bg-bg/85 backdrop-blur-xl pt-safe">
      <div className="flex h-14 items-center gap-3 px-3">
        <button
          onClick={onAbrirMenu}
          aria-label="Abrir menú"
          // 44px de lado: por debajo de eso, en el móvil se falla el toque.
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl2 text-ink transition-colors active:bg-surface-2"
        >
          <IconMenu className="h-6 w-6" />
        </button>

        {/* La sección actual, en el centro. Con el menú escondido detrás de un
            botón hace falta algo que diga dónde estás. */}
        <div className="min-w-0 flex-1 text-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={titulo}
              className="truncate text-sm text-ink-dim"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              {titulo}
            </motion.p>
          </AnimatePresence>
          {/* El commit, aquí a la vista mientras se está trasteando: evita
              entrar en Ajustes cada vez para saber si el móvil ya tiene el
              código nuevo. Fuera cuando esto se asiente. */}
          <p className="truncate font-mono text-[10px] leading-none text-ink-mute/70">{version}</p>
        </div>

        {/* Solo el avatar: quién eres se ve al desplegar el menú, y el nombre
            aquí competía con el título de la sección en un móvil estrecho.
            Va dentro de un hueco del mismo ancho que el botón de menú, para
            que el título quede centrado de verdad y no descuadrado. */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-end">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line"
            style={{ background: player?.color || 'var(--color-surface-2)' }}
          >
            {player?.avatar_url
              ? <img src={player.avatar_url} alt="" className="h-full w-full object-cover" />
              : <span>{player?.avatar_emoji || '⭐'}</span>}
          </div>
        </div>
      </div>
    </header>
  )
}

function MenuLateral({ abierto, onCerrar, onNavegar }) {
  const { player } = useAuth()
  return (
    <AnimatePresence>
      {abierto && (
        <>
          {/* El velo se pinta con la tinta de la paleta, no con negro: sobre el
              crema, un negro puro corta demasiado. */}
          <motion.div
            className="fixed inset-0 z-40 bg-ink/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onCerrar}
          />

          <motion.aside
            role="dialog"
            aria-label="Menú"
            className="fixed inset-y-0 left-0 z-50 flex w-[78%] max-w-[320px] flex-col border-r border-line bg-surface pt-safe pb-safe pl-safe"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 460, damping: 42 }}
            // Arrastrar hacia la izquierda para cerrarlo: es como se cierra un
            // panel así en cualquier app del móvil, y sin ello hay que apuntar
            // al velo con el pulgar. Solo hacia la izquierda (right: 0), para
            // que no se pueda separar del borde.
            drag="x"
            dragConstraints={{ left: -360, right: 0 }}
            dragElastic={0.08}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              // O se ha arrastrado lo bastante, o se ha lanzado con fuerza: lo
              // segundo es lo que hace que un gesto rápido y corto también
              // cierre, que es como se maneja esto con el pulgar.
              if (info.offset.x < -70 || info.velocity.x < -420) onCerrar()
            }}
          >
            <div className="flex items-center gap-3 px-5 py-5">
              <IconPaw className="h-7 w-7 text-accent" />
              <div className="min-w-0">
                <p className="font-display text-xl font-semibold leading-none tracking-[-0.02em]">Puchi</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink-mute">Versión nueva</p>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto overscroll-contain px-3">
              {SECCIONES.map(({ to, label, Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={onNavegar}
                  className="relative mb-1 flex h-12 items-center gap-3 rounded-xl2 px-3"
                >
                  {({ isActive }) => (
                    <>
                      {/* layoutId: al cambiar de sección la pastilla se
                          desplaza de una entrada a otra en vez de aparecer y
                          desaparecer. */}
                      {isActive && (
                        <motion.span
                          layoutId="menu-activo"
                          className="absolute inset-0 rounded-xl2 bg-accent-soft"
                          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        />
                      )}
                      <Icon className={`relative h-5 w-5 ${isActive ? 'text-accent' : 'text-ink-mute'}`} />
                      <span className={`relative text-[15px] ${isActive ? 'font-semibold text-accent' : 'text-ink-dim'}`}>
                        {label}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-3 border-t border-line px-5 py-4">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line"
                style={{ background: player?.color || 'var(--color-surface-2)' }}
              >
                {player?.avatar_url
                  ? <img src={player.avatar_url} alt="" className="h-full w-full object-cover" />
                  : <span>{player?.avatar_emoji || '⭐'}</span>}
              </div>
              <div className="min-w-0">
                <p className="truncate font-display font-semibold leading-tight">{player?.name}</p>
                <p className="text-xs text-ink-mute leading-tight">Sesión iniciada</p>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function Placeholder({ title, nota }) {
  return (
    <div className="py-8">
      <h2 className="font-display text-[1.75rem] font-bold tracking-[-0.02em]">{title}</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-dim">{nota}</p>
    </div>
  )
}

// Además de cerrar sesión, esta pantalla es el panel de diagnóstico del
// esqueleto: los valores que solo se pueden comprobar en el móvil de verdad
// (si la app va instalada, cuánto miden las safe areas, si el teclado se
// detecta) se ven aquí en vez de tener que adivinarlos desde el escritorio.
function Ajustes() {
  const { player, logout } = useAuth()
  const [info, setInfo] = useState(() => snapshot())
  const sello = useVersion()

  useEffect(() => {
    const id = setInterval(() => setInfo(snapshot()), 500)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="py-8">
      <h2 className="font-display text-[1.75rem] font-bold tracking-[-0.02em]">Ajustes</h2>
      <p className="mt-2 text-sm text-ink-dim">Sesión de {player?.name}.</p>

      <SeparacionDeSecciones />

      <div className="mt-6 overflow-hidden rounded-xl2 border border-line bg-surface">
        <p className="border-b border-line px-4 py-2 text-xs uppercase tracking-wider text-ink-mute">Diagnóstico</p>
        <dl className="divide-y divide-[color:var(--color-line)] text-sm">
          {Object.entries({ ...info, versión: sello.version, compilado: sello.compilado }).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-ink-mute">{k}</dt>
              <dd className="text-right font-mono text-[13px] text-ink">{String(v)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={logout}
        className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl2 border border-line text-danger"
      >
        <IconExit className="h-5 w-5" />
        Cerrar sesión
      </motion.button>
      <p className="mt-2 px-1 text-xs text-ink-mute">
        La sesión es la misma que la de la Puchi actual: al cerrarla aquí, se cierra también allí.
      </p>
    </div>
  )
}

// Provisional, mientras se decide cómo separar las secciones de la estantería:
// se prueban las cuatro en el móvil y se deja la que gane.
function SeparacionDeSecciones() {
  const [elegida, setElegida] = useState(leerSeparacion)
  return (
    <div className="mt-6 overflow-hidden rounded-xl2 border border-line bg-surface">
      <p className="border-b border-line px-4 py-2 text-xs uppercase tracking-wider text-ink-mute">
        Secciones de la estantería
      </p>
      <SelectorSeparacion
        elegida={elegida}
        onElegir={(id) => { guardarSeparacion(id); setElegida(id) }}
      />
      <p className="border-t border-line px-4 py-2.5 text-xs text-ink-mute">
        Vuelve a Luniteca para verlo. Cuando decidas, quito las otras tres.
      </p>
    </div>
  )
}

function snapshot() {
  const cs = getComputedStyle(document.documentElement)
  const vv = window.visualViewport
  const safe = safeInsets()
  return {
    // Lo primero, y a propósito: con el service worker por medio, un
    // dispositivo puede quedarse en una versión vieja sin que se note, y
    // entonces lo que se prueba en local y lo que se ve en el móvil no son el
    // mismo código. Aquí se ve el commit exacto que está corriendo.
    instalada:  isStandalone() ? 'sí' : 'no (pestaña)',
    plataforma: isIOS() ? 'iOS' : navigator.platform || '—',
    'safe top':    safe.top,
    'safe bottom': safe.bottom,
    viewport:   vv ? `${Math.round(vv.width)}×${Math.round(vv.height)}` : '—',
    dpr:        window.devicePixelRatio,
    '--kb':     cs.getPropertyValue('--kb').trim() || '0px',
    '--vvh':    cs.getPropertyValue('--vvh').trim() || '—',
  }
}
