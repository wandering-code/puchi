import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '../platform/auth'
import { useIsTyping } from '../platform/viewport'
import { isIOS, isStandalone, safeInsets } from '../platform/pwa'
import { IconBooks, IconExit, IconHome, IconSettings } from '../ui/icons'

const TABS = [
  { to: '/',          label: 'Inicio',     Icon: IconHome },
  { to: '/biblioteca', label: 'Biblioteca', Icon: IconBooks },
  { to: '/ajustes',    label: 'Ajustes',    Icon: IconSettings },
]

export default function Shell() {
  const location = useLocation()
  const typing = useIsTyping()

  return (
    <div className="relative flex h-full w-full flex-col bg-bg">
      {/* El fondo, aparte del contenido: un degradado que aclara hacia arriba
          (da profundidad y sitio a la barra superior) más el grano. Los dos
          son capas estáticas, así que no repintan al navegar ni al scrollear. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(120% 70% at 50% 0%, #1c1d35 0%, var(--color-bg) 55%, var(--color-bg-deep) 100%)' }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 grain" />

      <TopBar />

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
              <Route path="/biblioteca" element={<Placeholder title="Biblioteca" nota="Primera app a portar. Los libros son los reales: mismo backend y misma base de datos que la Puchi actual." />} />
              <Route path="/ajustes"    element={<Ajustes />} />
              <Route path="*"           element={<Placeholder title="Nada por aquí" nota="Esa ruta no existe (todavía)." />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav hidden={typing} />
    </div>
  )
}

function TopBar() {
  const { player } = useAuth()
  return (
    <header className="relative z-20 shrink-0 border-b border-line backdrop-blur-xl pt-safe">
      <div className="flex h-14 items-center gap-3 px-5">
        <div
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-line"
          style={{ background: player?.color || '#333' }}
        >
          {player?.avatar_url
            ? <img src={player.avatar_url} alt="" className="h-full w-full object-cover" />
            : <span>{player?.avatar_emoji || '⭐'}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-semibold leading-tight tracking-[-0.01em]">{player?.name}</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-ink-mute leading-tight">Puchi nueva</p>
        </div>
      </div>
    </header>
  )
}

function BottomNav({ hidden }) {
  return (
    // Se va con el teclado en vez de pelearse con él: en iOS el paneo la
    // subiría por encima del teclado, y es lo que hacen las apps nativas.
    <motion.nav
      className="z-20 shrink-0 border-t border-line bg-bg/85 backdrop-blur-xl pb-safe"
      animate={{ y: hidden ? 120 : 0, opacity: hidden ? 0 : 1 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      style={{ pointerEvents: hidden ? 'none' : undefined }}
    >
      <div className="flex h-16 items-stretch">
        {TABS.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className="relative flex flex-1 items-center justify-center">
            {({ isActive }) => (
              <>
                {/* layoutId: la pastilla se DESPLAZA de una pestaña a otra en
                    vez de desaparecer y reaparecer. Es lo que hace que el
                    cambio de sección se lea como un movimiento y no como un
                    parpadeo. */}
                {isActive && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute inset-x-3 inset-y-2 rounded-xl2 bg-surface-2"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative flex flex-col items-center gap-1">
                  <Icon className={`h-6 w-6 transition-colors duration-200 ${isActive ? 'text-accent' : 'text-ink-mute'}`} />
                  <span className={`text-[11px] transition-colors duration-200 ${isActive ? 'text-ink' : 'text-ink-mute'}`}>{label}</span>
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </motion.nav>
  )
}

function Placeholder({ title, nota }) {
  return (
    <div className="py-8">
      <h2 className="font-display text-[1.75rem] font-semibold tracking-[-0.02em]">{title}</h2>
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

  useEffect(() => {
    const id = setInterval(() => setInfo(snapshot()), 500)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="py-8">
      <h2 className="font-display text-[1.75rem] font-semibold tracking-[-0.02em]">Ajustes</h2>
      <p className="mt-2 text-sm text-ink-dim">Sesión de {player?.name}.</p>

      <div className="mt-6 overflow-hidden rounded-xl2 border border-line bg-surface">
        <p className="border-b border-line px-4 py-2 text-xs uppercase tracking-wider text-ink-mute">Diagnóstico</p>
        <dl className="divide-y divide-[color:var(--color-line)] text-sm">
          {Object.entries(info).map(([k, v]) => (
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

function snapshot() {
  const cs = getComputedStyle(document.documentElement)
  const vv = window.visualViewport
  const safe = safeInsets()
  return {
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
