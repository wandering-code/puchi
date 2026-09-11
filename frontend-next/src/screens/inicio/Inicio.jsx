import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useAuth } from '../../platform/auth'
import { usarPreferencia } from '../../platform/preferencias'
import { seccionesDe } from '../secciones'
import { IconArrow, IconPaw, IconSettings } from '../../ui/icons'

// La pantalla de Inicio: una vuelta rápida por lo que hay, para quien acaba de
// entrar por primera vez y no sabe por dónde tirar.
//
// Lo que se cuenta sale de `screens/secciones.jsx`, que es también de donde
// salen las entradas del menú — así la guía no puede hablar de una sección que
// no exista, ni olvidarse de una nueva. Y por lo mismo **a quien no es del
// club no se le menciona el club**: `seccionesDe` ya filtra por permiso, así
// que la guía no tiene que acordarse de esconder nada.
//
// Quien ya se la sabe no tiene por qué pasar por aquí cada vez: en Ajustes se
// elige con qué pantalla arranca Puchi, y esta pantalla lo dice al final para
// que se sepa que se puede.

export default function Inicio() {
  const { player } = useAuth()
  const [inicio] = usarPreferencia('inicio', '/')
  // La de Inicio no se enseña en su propia guía: ya estás en ella.
  const secciones = useMemo(
    () => seccionesDe(player).filter(s => s.to !== '/'),
    [player],
  )

  return (
    <div className="py-6">
      <header className="mb-6">
        <div className="flex items-center gap-2.5">
          <IconPaw className="h-7 w-7 shrink-0 text-accent" />
          <h2 className="font-display text-[1.75rem] font-bold leading-none tracking-[-0.02em]">
            Hola, {player?.name}
          </h2>
        </div>
        <p className="mt-2.5 max-w-prose text-[15px] leading-relaxed text-ink-dim">
          Puchi es donde llevas tus libros: lo que estás leyendo, lo que ya leíste y lo que te
          espera. Esto es un repaso rápido de lo que hay; no hace falta leerlo entero para
          empezar.
        </p>
      </header>

      <div className="space-y-3">
        {secciones.map((seccion, i) => (
          <TarjetaSeccion key={seccion.to} seccion={seccion} orden={i} />
        ))}
      </div>

      <Trucos />

      <Aviso inicioActual={inicio} />
    </div>
  )
}

// Cada sección, con lo justo para saber qué se va a encontrar y un toque para
// ir. Entera es un enlace: leer de qué va algo y tener que buscar después
// dónde estaba es el paso tonto que sobra.
function TarjetaSeccion({ seccion, orden }) {
  const { Icon, label, resumen, puntos = [] } = seccion
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      // Escalonadas, pero con tope: con seis secciones, la última entraría casi
      // medio segundo tarde y se vería llegar.
      transition={{ duration: 0.3, delay: Math.min(orden * 0.05, 0.2), ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        to={seccion.to}
        className="block rounded-xl3 border border-line bg-surface p-4 transition-transform duration-150 active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl2 bg-accent-soft text-accent">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold leading-tight tracking-[-0.01em]">{label}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-dim">{resumen}</p>
          </div>
          <IconArrow className="h-4 w-4 shrink-0 text-ink-mute" />
        </div>

        {puntos.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
            {puntos.map(punto => (
              <li key={punto} className="flex gap-2 text-[13px] leading-relaxed text-ink-dim">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                <span className="min-w-0">{punto}</span>
              </li>
            ))}
          </ul>
        )}
      </Link>
    </motion.div>
  )
}

// Cuatro cosas que no se adivinan mirando la pantalla y que cambian cómo se
// usa la app. Ni una más: esto es una primera toma de contacto, no un manual.
const TRUCOS = [
  ['El menú', 'Se abre con el botón de arriba a la izquierda y se cierra arrastrándolo hacia el lado, sin tener que apuntar al hueco.'],
  ['Las hojas que suben de abajo', 'Se cierran arrastrando el asa hacia abajo, o con el gesto de volver del móvil.'],
  ['Tus gustos van con la cuenta', 'La vista de la estantería, el tema y lo demás se guardan en tu cuenta, no en el navegador: lo eliges una vez y lo ves igual en el móvil y en el ordenador.'],
  ['Puedes instalarla', 'Desde el navegador del móvil, "Añadir a pantalla de inicio": se abre como una app, a pantalla completa.'],
]

function Trucos() {
  return (
    <section className="mt-8">
      <h3 className="mb-2.5 text-[11px] uppercase tracking-[0.14em] text-ink-mute">
        Cosas que conviene saber
      </h3>
      <dl className="overflow-hidden rounded-xl2 border border-line bg-surface divide-y divide-[color:var(--color-line)]">
        {TRUCOS.map(([que, como]) => (
          <div key={que} className="px-4 py-3">
            <dt className="text-sm font-semibold">{que}</dt>
            <dd className="mt-0.5 text-[13px] leading-relaxed text-ink-dim">{como}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// Lo último de la guía, y a propósito: quien acaba de leérsela es justo quien
// no necesita volver a verla mañana.
function Aviso({ inicioActual }) {
  const enInicio = inicioActual === '/'
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.25 }}
      className="mt-8"
    >
      <Link
        to="/ajustes"
        className="flex items-center gap-3 rounded-xl2 border border-accent-line bg-accent-soft p-4 transition-transform duration-150 active:scale-[0.99]"
      >
        <IconSettings className="h-5 w-5 shrink-0 text-accent" />
        <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-accent">
          {enInicio
            ? '¿Prefieres que Puchi arranque en tu estantería, o en cualquier otra pantalla? Se elige en Ajustes.'
            : 'Puchi arranca en la pantalla que elegiste; puedes cambiarla en Ajustes cuando quieras.'}
        </p>
        <IconArrow className="h-4 w-4 shrink-0 text-accent" />
      </Link>
    </motion.div>
  )
}
