import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { IconArrow, IconCheck, IconPlus } from '../ui/icons'

// Crear cuenta, sin pasar por la Puchi actual.
//
// Registrarse no da acceso: la cuenta queda PENDIENTE y no aparece siquiera en
// la pantalla de entrar hasta que el admin la aprueba (lo decide el backend, no
// esto). Por eso el final no es "ya estás dentro" sino una pantalla que explica
// qué pasa ahora — sin ella, quien se registra se queda mirando un formulario
// que no hace nada y piensa que ha fallado.
//
// Todo va en UNA petición multipart, incluida la foto. No es capricho: como el
// registro no emite sesión, después no hay forma de llamar a
// `POST /players/me/avatar`, que exige estar dentro.

// Las mismas diez ilustraciones que la Puchi actual, para que una cuenta creada
// aquí se vea igual allí mientras convivan.
//
// Ojo con las rutas, que no son la misma: lo que se GUARDA es `/avatars/x.svg`
// (desde la raíz), que es como están las cuentas que ya existen y como lo sirve
// nginx en producción para las dos Puchis. Pero esta app vive bajo /next/, así
// que para ENSEÑARLAS aquí hace falta su propia copia — de ahí el BASE_URL. El
// día que esta versión sustituya a la actual, habrá que servir /avatars/ desde
// la raíz o migrar lo guardado.
const CARAS = [
  ['cat-surprised', 'Gato sorprendido'],
  ['dog-happy', 'Perro feliz'],
  ['panda-sleepy', 'Panda dormido'],
  ['octopus-cool', 'Pulpo con gafas'],
  ['owl-drowsy', 'Búho despistado'],
  ['frog-nervous', 'Rana nerviosa'],
  ['potato-happy', 'Patata feliz'],
  ['ghost-cheeky', 'Fantasma burlón'],
  ['cactus-cool', 'Cactus con gafas'],
  ['egg-happy', 'Huevo frito feliz'],
].map(([id, label]) => ({
  id,
  label,
  guardar: `/avatars/${id}.svg`,
  ver: `${import.meta.env.BASE_URL}avatars/${id}.svg`,
}))

// El color acompaña al nombre por toda la app (quién escribió cada mensaje,
// quién propuso un libro), así que conviene que se distingan entre sí más que
// que sean bonitos por separado.
const COLORES = [
  '#b5603c', '#c2874a', '#3f6b52', '#4b7fa8',
  '#60a5fa', '#8b6bb1', '#c2528a', '#7a6f63',
]

// A cuánto se guarda la foto. 512 va sobrado para un avatar que se ve a 56px
// como mucho, y evita subir cuatro megas de una foto de móvil.
const LADO = 512

export default function Registro({ onVolver }) {
  const [nombre, setNombre] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [color, setColor] = useState(COLORES[0])
  const [cara, setCara] = useState(CARAS[0])
  const [foto, setFoto] = useState(null)          // { blob, url } si hay foto propia
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [hecho, setHecho] = useState(false)
  const fichero = useRef(null)

  // La previsualización es un object URL: hay que soltarlo al cambiarla o al
  // salir, o se queda la foto entera retenida en memoria.
  useEffect(() => () => { if (foto?.url) URL.revokeObjectURL(foto.url) }, [foto])

  async function elegirFoto(ev) {
    const f = ev.target.files?.[0]
    ev.target.value = ''   // permite volver a elegir la MISMA foto
    if (!f) return
    setError('')
    try {
      const blob = await recortarCuadrada(f)
      setFoto(previa => {
        if (previa?.url) URL.revokeObjectURL(previa.url)
        return { blob, url: URL.createObjectURL(blob) }
      })
    } catch {
      setError('No se ha podido leer esa imagen')
    }
  }

  async function enviar(ev) {
    ev.preventDefault()
    const limpio = nombre.trim()
    if (!limpio) { setError('Escribe un nombre'); return }
    if (limpio.length > 30) { setError('El nombre es demasiado largo'); return }
    if (!/^\d{4,8}$/.test(pin)) { setError('El PIN tiene que ser de 4 a 8 dígitos'); return }
    if (pin !== pin2) { setError('Los dos PIN no coinciden'); return }

    setEnviando(true); setError('')
    try {
      // multipart y no JSON: la foto viaja en el mismo envío (ver arriba).
      const datos = new FormData()
      datos.append('name', limpio)
      datos.append('pin', pin)
      datos.append('color', color)
      if (foto) datos.append('avatar_file', foto.blob, 'avatar.jpg')
      else datos.append('avatar_url', cara.guardar)

      const r = await fetch('/api/auth/register', { method: 'POST', body: datos })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        throw new Error(d.detail || 'No se ha podido crear la cuenta')
      }
      setHecho(true)
    } catch (err) {
      setError(err.message || 'Error de conexión')
      setEnviando(false)
    }
  }

  if (hecho) return <Pendiente nombre={nombre.trim()} onVolver={onVolver} />

  return (
    <form onSubmit={enviar} className="mx-auto w-full max-w-sm">
      <div className="mb-6 text-center">
        <h1 className="font-display text-[2rem] font-bold leading-none tracking-[-0.02em]">Crear cuenta</h1>
        <p className="mt-2 text-sm text-ink-dim">Un admin tendrá que aprobarla antes de que puedas entrar.</p>
      </div>

      {/* La cara, lo primero: es lo que se elige con gusto, y engancha más que
          empezar por un campo de texto. */}
      <p className="mb-2 px-1 text-[13px] text-ink-dim">Tu cara</p>
      <div className="mb-5 grid grid-cols-5 gap-2">
        {CARAS.map(c => {
          const puesta = !foto && cara.id === c.id
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => { setFoto(null); setCara(c) }}
              aria-label={c.label}
              aria-pressed={puesta}
              className={`relative aspect-square overflow-hidden rounded-xl2 border-2 transition-colors ${
                puesta ? 'border-accent' : 'border-line'
              }`}
              style={{ background: puesta ? color : 'var(--color-surface)' }}
            >
              <img src={c.ver} alt="" className="h-full w-full object-cover" />
            </button>
          )
        })}

      </div>

      {/* Tu foto, en su propia fila y no como una celda más de la rejilla: diez
          caras llenan dos filas justas, y la celda once se quedaba sola en una
          tercera media vacía. Así además se puede decir con palabras lo que es. */}
      <button
        type="button"
        onClick={() => fichero.current?.click()}
        aria-label="Usar una foto tuya"
        aria-pressed={!!foto}
        className={`mb-5 flex w-full items-center gap-3 rounded-xl2 border-2 px-3 py-2.5 text-left transition-colors ${
          foto ? 'border-accent bg-accent-soft' : 'border-dashed border-line'
        }`}
      >
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full ${foto ? '' : 'bg-surface-2 text-ink-mute'}`}>
          {foto
            ? <img src={foto.url} alt="" className="h-full w-full object-cover" />
            : <IconPlus className="h-5 w-5" />}
        </span>
        <span className={`text-sm ${foto ? 'font-semibold text-accent' : 'text-ink-dim'}`}>
          {foto ? 'Usando una foto tuya · toca para cambiarla' : 'O usa una foto tuya'}
        </span>
      </button>
      <input ref={fichero} type="file" accept="image/*" onChange={elegirFoto} className="hidden" />

      <p className="mb-2 px-1 text-[13px] text-ink-dim">Tu color</p>
      <div className="mb-5 flex flex-wrap gap-2">
        {COLORES.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`Color ${c}`}
            aria-pressed={color === c}
            className={`h-9 w-9 rounded-full border-2 transition-transform ${
              color === c ? 'scale-110 border-ink' : 'border-transparent'
            }`}
            style={{ background: c }}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <Campo etiqueta="Nombre" valor={nombre} onCambiar={v => { setNombre(v); setError('') }} autoComplete="username" autoCapitalize="words" autoCorrect="off" />
        <Campo
          etiqueta="PIN (4 a 8 números)"
          valor={pin}
          onCambiar={v => { setPin(v.replace(/\D/g, '').slice(0, 8)); setError('') }}
          type="password" inputMode="numeric" autoComplete="new-password"
        />
        <Campo
          etiqueta="Repite el PIN"
          valor={pin2}
          onCambiar={v => { setPin2(v.replace(/\D/g, '').slice(0, 8)); setError('') }}
          type="password" inputMode="numeric" autoComplete="new-password"
          // Se avisa en cuanto se ve que no cuadran, no al darle a crear: si el
          // aviso llega al final, hay que volver a escribir los dos.
          mal={pin2.length > 0 && pin.length > 0 && !pin.startsWith(pin2) && pin2.length <= pin.length}
        />
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            className="mt-3 px-1 text-sm text-danger"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <motion.button
        type="submit"
        disabled={enviando}
        whileTap={{ scale: 0.97 }}
        className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-xl2 bg-accent text-base font-semibold text-on-accent shadow-[0_10px_30px_-10px_var(--color-accent)] transition-colors disabled:bg-surface-2 disabled:text-ink-mute disabled:shadow-none"
      >
        {enviando ? 'Creando…' : 'Crear cuenta'}
        {!enviando && <IconArrow className="h-5 w-5" />}
      </motion.button>

      <button type="button" onClick={onVolver} className="mt-5 h-10 w-full text-sm text-ink-mute">
        Ya tengo cuenta
      </button>
    </form>
  )
}

// Lo que pasa después de crearla. No es un "¡listo!" y a otra cosa: la cuenta
// todavía no sirve para nada, y hay que decirlo claro.
function Pendiente({ nombre, onVolver }) {
  return (
    <motion.div
      className="mx-auto w-full max-w-sm text-center"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.span
        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-read/15 text-read"
        initial={{ scale: 0.5 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 20, delay: 0.1 }}
      >
        <IconCheck className="h-8 w-8" />
      </motion.span>

      <h1 className="font-display text-[1.75rem] font-bold leading-tight tracking-[-0.02em]">
        Cuenta creada, {nombre}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-dim">
        Ahora tiene que aprobarla el admin. Hasta entonces no podrás entrar — ni siquiera aparecerá
        tu nombre en la pantalla de acceso. Avísale y vuelve luego.
      </p>

      <button
        onClick={onVolver}
        className="mt-7 h-12 w-full rounded-xl2 border border-line text-[15px] text-ink-dim"
      >
        Volver a la pantalla de entrar
      </button>
    </motion.div>
  )
}

// Mismo campo con etiqueta flotante que la pantalla de entrar, para que las dos
// se sientan la misma pantalla y no dos formularios de apps distintas.
function Campo({ etiqueta, valor, onCambiar, mal = false, ...resto }) {
  const [enfocado, setEnfocado] = useState(false)
  const arriba = enfocado || valor.length > 0
  return (
    <label className={`relative flex items-center rounded-xl2 border bg-surface/70 backdrop-blur-xl transition-colors focus-within:bg-surface ${
      mal ? 'border-danger' : 'border-line focus-within:border-accent/60'
    }`}>
      <motion.span
        className="pointer-events-none absolute left-4 origin-left text-ink-mute"
        animate={{ y: arriba ? -12 : 0, scale: arriba ? 0.78 : 1, opacity: arriba ? 0.8 : 1 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {etiqueta}
      </motion.span>
      <input
        value={valor}
        onChange={e => onCambiar(e.target.value)}
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        className="h-16 w-full bg-transparent px-4 pt-5 text-base text-ink outline-none"
        {...resto}
      />
    </label>
  )
}

// Recorta la foto a un cuadrado por el centro y la reduce, en el propio
// navegador. No es el recortador con el que se elige el encuadre a mano que
// tiene la Puchi actual: se coge el centro, que es donde está la cara en
// prácticamente cualquier foto de perfil. Lo otro es una pantalla entera con
// su gesto de arrastrar y pellizcar, y no vale la pena para esto.
function recortarCuadrada(fichero) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fichero)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const lado = Math.min(img.width, img.height)
      const lienzo = document.createElement('canvas')
      lienzo.width = LADO
      lienzo.height = LADO
      lienzo.getContext('2d').drawImage(
        img,
        (img.width - lado) / 2, (img.height - lado) / 2, lado, lado,
        0, 0, LADO, LADO,
      )
      lienzo.toBlob(b => (b ? resolve(b) : reject(new Error('sin blob'))), 'image/jpeg', 0.9)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('no carga')) }
    img.src = url
  })
}
