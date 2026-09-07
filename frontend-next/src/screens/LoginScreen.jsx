import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from '../platform/auth'
import { api } from '../platform/api'
import { IconArrow, IconPaw } from '../ui/icons'

export default function LoginScreen() {
  const { login } = useAuth()
  const [players, setPlayers] = useState([])
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Se resuelve en vivo mientras se escribe: si el nombre coincide con una
  // cuenta, se ve su avatar antes de meter el PIN. No se lista el resto de
  // perfiles en ningún momento — misma regla que la Puchi actual.
  const matched = players.find(p => p.name.toLowerCase() === name.trim().toLowerCase())

  useEffect(() => { api('/players').then(setPlayers).catch(() => setPlayers([])) }, [])

  async function onSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !pin) return
    setLoading(true); setError('')
    try {
      if (!matched) throw new Error('No hay ninguna cuenta con ese nombre')
      const data = await api('/auth/login', { method: 'POST', body: { player_id: matched.id, pin } })
      login({ ...data.player, token: data.token })
    } catch (err) {
      setError(err.message || 'Error de conexión')
      setLoading(false)
    }
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-bg-deep">
      <Aurora />

      {/* pb-kb aparta el contenido del teclado con padding, sin encoger la
          caja: encogiéndola se corta el fondo y asoma lo de detrás. */}
      <div className="relative z-10 flex flex-1 flex-col justify-center px-6 pt-safe pb-kb">
        <motion.div
          className="mx-auto w-full max-w-sm"
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } }}
        >
          <Fade className="mb-10 flex flex-col items-center gap-4">
            <motion.div
              initial={{ scale: 0.7, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
            >
              <IconPaw className="h-14 w-14 text-accent" />
            </motion.div>
            <div className="text-center">
              <h1 className="font-display text-[3.25rem] font-semibold leading-none tracking-[-0.03em]">Puchi</h1>
              {/* Versalitas espaciadas: a este tamaño un texto normal se lee
                  como una nota al pie: espaciado, se lee como parte de la marca. */}
              <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-ink-mute">Versión nueva</p>
            </div>
          </Fade>

          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Fade>
              <Field
                label="Nombre"
                value={name}
                onChange={setName}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                adornment={<AvatarPreview player={matched} />}
              />
            </Fade>

            <Fade>
              <Field
                label="PIN"
                value={pin}
                onChange={(v) => setPin(v.replace(/\D/g, '').slice(0, 8))}
                type="password"
                // inputMode numérico: en el móvil sale el teclado de números,
                // no el completo. autoComplete one-time-code evita que el
                // gestor de contraseñas intente rellenar aquí la del wifi.
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </Fade>

            <AnimatePresence>
              {error && (
                <motion.p
                  className="px-1 text-sm text-danger"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <Fade>
              <motion.button
                type="submit"
                disabled={loading || !name.trim() || !pin}
                whileTap={{ scale: 0.97 }}
                className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-xl2 bg-accent text-base font-semibold text-bg-deep shadow-[0_10px_30px_-10px_var(--color-accent)] transition-colors disabled:bg-surface-2 disabled:text-ink-mute disabled:shadow-none"
              >
                {loading ? 'Entrando…' : 'Entrar'}
                {!loading && <IconArrow className="h-5 w-5" />}
              </motion.button>
            </Fade>
          </form>

          <Fade className="mt-8 text-center text-sm text-ink-mute">
            ¿Cuenta nueva?{' '}
            {/* El registro (con avatar, recorte de foto y aprobación del
                admin) todavía no está portado — se hace en la Puchi actual y
                luego se entra aquí, que la sesión es la misma. */}
            <a href="/" className="text-ink-dim underline underline-offset-4">Regístrate en la Puchi actual</a>
          </Fade>
        </motion.div>
      </div>
    </div>
  )
}

// Envuelve cualquier hijo en la entrada escalonada del contenedor.
function Fade({ children, className }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      {children}
    </motion.div>
  )
}

// Campo con etiqueta flotante. El label sube al enfocar o al haber texto, en
// vez de un placeholder que desaparece: en móvil, con el campo ya escrito,
// deja de saberse qué era cada uno.
function Field({ label, value, onChange, adornment, ...rest }) {
  const [focused, setFocused] = useState(false)
  const raised = focused || value.length > 0
  return (
    <label className="relative flex items-center rounded-xl2 border border-line bg-surface/70 backdrop-blur-xl transition-colors focus-within:border-accent/60 focus-within:bg-surface">
      <motion.span
        className="pointer-events-none absolute left-4 origin-left text-ink-mute"
        animate={{ y: raised ? -12 : 0, scale: raised ? 0.78 : 1, opacity: raised ? 0.8 : 1 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {label}
      </motion.span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="h-16 w-full bg-transparent px-4 pt-5 text-base text-ink outline-none"
        {...rest}
      />
      {adornment}
    </label>
  )
}

function AvatarPreview({ player }) {
  return (
    <div className="mr-3 h-10 w-10 shrink-0">
      <AnimatePresence mode="wait">
        {player && (
          <motion.div
            key={player.id}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-line"
            style={{ background: player.color || '#333' }}
          >
            {player.avatar_url
              ? <img src={player.avatar_url} alt="" className="h-full w-full object-cover" />
              : <span className="text-lg">{player.avatar_emoji || '⭐'}</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Fondo: dos manchas de color muy difuminadas que respiran despacio. Se
// animan solo opacidad y transform (las dos van en el compositor, sin
// repintar) — un blur animado sobre un móvil de gama media va a tirones.
function Aurora() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <motion.div
        className="absolute -left-24 -top-24 h-80 w-80 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, #7c6cf5 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.5, 0.35] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, #f0b429 0%, transparent 70%)' }}
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.22, 0.34, 0.22] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="absolute inset-0 grain" />
    </div>
  )
}
