import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../../platform/api'
import { esAdmin as esElAdmin, useAuth } from '../../platform/auth'
import { useLiveUpdates } from '../../platform/live'
import Avatar from '../../ui/Avatar'
import BotonPeligro from '../../ui/BotonPeligro'
import { IconCheck, IconX } from '../../ui/icons'

// Administración: quién entra en Puchi y quién está en el club de lectura.
//
// Registrarse no da acceso: una cuenta nueva queda pendiente y no aparece
// siquiera en la pantalla de entrar hasta que se aprueba. Y ser usuario no es
// lo mismo que ser del club: son dos permisos distintos, y el club es el que
// abre la estantería del club, sus puntuaciones y sus sesiones.
//
// Todo lo de aquí lo impone el backend (`require_admin`): esta pantalla solo
// decide qué botones se enseñan.

const PESTANAS = [
  { id: 'pendientes',   label: 'Pendientes' },
  { id: 'miembros',     label: 'Cuentas' },
  { id: 'desactivados', label: 'Desactivadas' },
]

export default function Admin() {
  const { player } = useAuth()
  const [jugadores, setJugadores] = useState(null)
  const [pestana, setPestana] = useState('pendientes')
  const [error, setError] = useState(null)
  // Al aprobar una cuenta se decide de una vez si además entra en el club: si
  // fueran dos pasos, lo normal sería aprobar y olvidarse del segundo. Se
  // guarda por fila mientras se decide.
  const [clubAlAprobar, setClubAlAprobar] = useState({})

  const cargar = useCallback(() => {
    api('/admin/players')
      .then(lista => { setJugadores(lista); setError(null) })
      .catch(err => { setJugadores([]); setError(err.message || 'No se ha podido cargar') })
  }, [])

  useEffect(() => { cargar() }, [cargar])
  // Una cuenta nueva registrada mientras esto está abierto aparece sola.
  useLiveUpdates(['players'], cargar)

  // Optimista: el cambio se ve al momento y, si el servidor lo rechaza, se
  // vuelve a lo que había. Aprobar o desactivar a alguien es un gesto que se
  // hace de seguido sobre varias cuentas, y esperar a cada respuesta se nota.
  async function actualizar(id, cambios) {
    const antes = jugadores
    setJugadores(js => js.map(p => p.id === id ? { ...p, ...cambios } : p))
    try {
      const fresco = await api(`/admin/players/${id}`, { method: 'PATCH', body: cambios })
      setJugadores(js => js.map(p => p.id === id ? fresco : p))
    } catch (err) {
      setJugadores(antes)
      setError(err.message || 'No se ha podido guardar')
    }
  }

  async function eliminar(id) {
    const antes = jugadores
    setJugadores(js => js.filter(p => p.id !== id))
    try {
      await api(`/admin/players/${id}`, { method: 'DELETE' })
    } catch (err) {
      setJugadores(antes)
      setError(err.message || 'No se ha podido eliminar')
    }
  }

  const listas = useMemo(() => ({
    pendientes:   (jugadores || []).filter(p => p.status === 'pending'),
    miembros:     (jugadores || []).filter(p => p.status === 'approved'),
    desactivados: (jugadores || []).filter(p => p.status === 'deactivated'),
  }), [jugadores])

  if (!esElAdmin(player)) return <SinAcceso />

  const visibles = listas[pestana]

  return (
    <div className="py-6">
      <header className="mb-4">
        <h2 className="font-display text-[1.75rem] font-bold tracking-[-0.02em]">Administración</h2>
        <p className="mt-1 text-sm text-ink-dim">Quién entra en Puchi y quién está en el club.</p>
      </header>

      {/* Pegada arriba, como la barra de herramientas de la estantería: con
          varias cuentas hay que bajar, y cambiar de pestaña sin volver arriba
          es la diferencia entre usarlo y no usarlo. */}
      <div className="sticky top-0 z-20 -mx-5 border-b border-line bg-bg/85 px-5 py-2 backdrop-blur-xl">
        <div className="flex gap-1">
          {PESTANAS.map(({ id, label }) => {
            const activa = pestana === id
            const cuenta = listas[id].length
            return (
              <button
                key={id}
                onClick={() => setPestana(id)}
                aria-pressed={activa}
                className={`relative flex-1 rounded-xl2 py-2.5 text-[13px] font-semibold transition-colors ${
                  activa ? 'text-accent' : 'text-ink-dim'
                }`}
              >
                {activa && (
                  <motion.span
                    layoutId="admin-pestana"
                    className="absolute inset-0 rounded-xl2 bg-accent-soft"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative inline-flex items-center gap-1.5">
                  {label}
                  {/* La cuenta solo donde importa que no se quede sin mirar:
                      una solicitud pendiente es alguien esperando. */}
                  {id === 'pendientes' && cuenta > 0 && (
                    <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-bold leading-normal text-on-accent">
                      {cuenta}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      {jugadores === null && (
        <div className="mt-5 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl2 bg-surface-2" />
          ))}
        </div>
      )}

      {jugadores !== null && visibles.length === 0 && (
        <p className="mt-10 text-center text-sm text-ink-mute">{VACIO[pestana]}</p>
      )}

      {/* Las tres listas se cruzan al cambiar de pestaña, y dentro de cada una
          las filas que se van (una cuenta aprobada sale de "Pendientes") se
          animan en su sitio en vez de desaparecer de golpe. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pestana}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 space-y-2"
        >
          <AnimatePresence initial={false} mode="popLayout">
            {visibles.map(p => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              >
                <FilaCuenta
                  jugador={p}
                  pestana={pestana}
                  soyYo={p.id === player.id}
                  clubAlAprobar={!!clubAlAprobar[p.id]}
                  onClubAlAprobar={v => setClubAlAprobar(m => ({ ...m, [p.id]: v }))}
                  onActualizar={cambios => actualizar(p.id, cambios)}
                  onEliminar={() => eliminar(p.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

const VACIO = {
  pendientes:   'No hay ninguna cuenta esperando aprobación.',
  miembros:     'Todavía no hay cuentas aprobadas.',
  desactivados: 'No hay cuentas desactivadas.',
}

function FilaCuenta({ jugador, pestana, soyYo, clubAlAprobar, onClubAlAprobar, onActualizar, onEliminar }) {
  return (
    <div className="rounded-xl2 border border-line bg-surface p-3">
      <div className="flex items-center gap-3">
        <Avatar jugador={jugador} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight" style={{ color: jugador.color || 'var(--color-ink)' }}>
            {jugador.name}
            {soyYo && <span className="ml-2 align-middle text-xs font-normal text-ink-mute">tú</span>}
          </p>
          <p className="mt-0.5 text-xs text-ink-mute">{subtitulo(jugador, pestana)}</p>
        </div>
      </div>

      {pestana === 'pendientes' && (
        <div className="mt-3">
          <Interruptor
            puesto={clubAlAprobar}
            onCambiar={onClubAlAprobar}
            etiqueta="Entra también en el club de lectura"
          />
          <div className="mt-3 flex gap-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => onActualizar({ status: 'approved', club_member: clubAlAprobar })}
              className="flex h-11 flex-[1.3] items-center justify-center gap-2 rounded-xl2 bg-accent text-sm font-semibold text-on-accent"
            >
              <IconCheck className="h-4 w-4" />
              Aprobar
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => onActualizar({ status: 'rejected' })}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl2 border border-line text-sm text-danger"
            >
              <IconX className="h-4 w-4" />
              Rechazar
            </motion.button>
          </div>
        </div>
      )}

      {pestana === 'miembros' && (
        <div className="mt-3">
          <Interruptor
            puesto={jugador.club_member}
            // El admin no puede quitarse a sí mismo del club: sería echarse de
            // la parte que administra, y el backend lo rechazaría igual.
            deshabilitado={soyYo}
            onCambiar={v => onActualizar({ club_member: v })}
            etiqueta="Miembro del club de lectura"
            nota={soyYo ? 'No puedes quitártelo a ti mismo' : null}
          />
          {!soyYo && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                onClick={() => onActualizar({ status: 'deactivated' })}
                className="h-10 rounded-xl2 border border-line px-3.5 text-sm text-ink-dim"
              >
                Desactivar
              </button>
              <BotonPeligro
                etiqueta="Eliminar"
                pregunta="¿Borrar la cuenta y todos sus libros?"
                onConfirmar={onEliminar}
              />
            </div>
          )}
        </div>
      )}

      {pestana === 'desactivados' && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            // Reactivar devuelve el acceso tal cual lo tendría alguien recién
            // aprobado. No se guarda si antes estaba o no en el club —
            // desactivar se lo quita—, así que se asume el caso normal y, si
            // no era del club, se le quita desde "Cuentas".
            onClick={() => onActualizar({ status: 'approved', club_member: true })}
            className="flex h-10 items-center gap-2 rounded-xl2 bg-accent px-3.5 text-sm font-semibold text-on-accent"
          >
            <IconCheck className="h-4 w-4" />
            Reactivar
          </motion.button>
          <BotonPeligro
            etiqueta="Eliminar"
            pregunta="¿Borrar la cuenta y todos sus libros?"
            onConfirmar={onEliminar}
          />
        </div>
      )}
    </div>
  )
}

function subtitulo(jugador, pestana) {
  const cuando = fecha(jugador.created_at)
  if (pestana === 'pendientes') return cuando ? `Se registró el ${cuando}` : 'Esperando aprobación'
  if (pestana === 'desactivados') return 'Sin acceso — sus libros siguen guardados'
  return [
    cuando ? `Se unió el ${cuando}` : null,
    jugador.club_member ? 'en el club' : 'sin acceso al club',
  ].filter(Boolean).join(' · ')
}

function fecha(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Un interruptor de verdad y no un <input type="checkbox">: se toca con el
// pulgar, se ve encendido o apagado de un vistazo y se mueve al cambiar, que
// es lo que confirma que el cambio ha ido. La caja nativa mide 13px en el
// móvil y no se puede teñir con la paleta de la app.
function Interruptor({ puesto, onCambiar, etiqueta, nota = null, deshabilitado = false }) {
  return (
    <button
      role="switch"
      aria-checked={puesto}
      disabled={deshabilitado}
      onClick={() => onCambiar(!puesto)}
      className="flex w-full items-center gap-3 text-left disabled:opacity-50"
    >
      <span
        className="flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors"
        style={{ background: puesto ? 'var(--color-accent)' : 'var(--color-surface-2)' }}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 520, damping: 34 }}
          className="h-5 w-5 rounded-full bg-surface shadow-sm"
          style={{ marginLeft: puesto ? 'auto' : 0 }}
        />
      </span>
      <span className="min-w-0">
        <span className={`block text-sm ${puesto ? 'text-ink' : 'text-ink-dim'}`}>{etiqueta}</span>
        {nota && <span className="mt-0.5 block text-xs text-ink-mute">{nota}</span>}
      </span>
    </button>
  )
}

function SinAcceso() {
  return (
    <div className="py-8">
      <h2 className="font-display text-[1.75rem] font-bold tracking-[-0.02em]">Administración</h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-dim">
        Esta parte es solo del admin.
      </p>
    </div>
  )
}
