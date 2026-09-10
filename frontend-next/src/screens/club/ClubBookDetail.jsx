import { useCallback, useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { api } from '../../platform/api'
import { useLiveUpdates } from '../../platform/live'
import { copiarAMiEstanteria, totalPages } from '../luniteca/shelf'
import { Chip, Cover, StarRating } from '../luniteca/piezas'
import { BotonGuardarlo } from '../luniteca/BookDetail'
import { Pastilla, CamposFecha, Sinopsis } from '../luniteca/editores'
import HojaInferior, { useHoja } from '../luniteca/HojaInferior'
import PantallaInferior from '../luniteca/PantallaInferior'
import Avatar, { NombreJugador } from '../../ui/Avatar'
import BotonPeligro from '../../ui/BotonPeligro'
import { IconArrowLeft } from '../../ui/icons'
import { CLUB_STATUS_LABEL, CLUB_STATUS_ORDER, fechaCorta } from './clubShelf'
import Puntuaciones from './Puntuaciones'
import Sesiones from './Sesiones'

// La ficha de un libro del club. Misma pantalla y mismos gestos que la ficha
// de tu estantería (portada grande, pastillas que se tocan para cambiar el
// dato, apartados debajo), pero con lo que solo tiene sentido en el club:
// quién lo propuso, en qué punto del ciclo está, las puntuaciones de todos y
// las sesiones.
//
// Quién puede tocar qué lo decide el backend, no esta pantalla: el estado, las
// fechas, las notas del club, las sesiones y el borrado son solo del admin
// (devuelve 403 a cualquier otro). Aquí solo se decide qué se enseña, para no
// ofrecer botones que van a fallar.

const COLOR_DE_ESTADO = {
  proposed: 'var(--color-want)',
  active:   'var(--color-accent)',
  finished: 'var(--color-read)',
}

export default function ClubBookDetail({
  entrada, abierta = true, esAdmin = false, vuelo = null,
  onCerrar, onCambiado, onEliminada,
}) {
  const club = entrada.club
  const libro = entrada.book
  const paginas = totalPages(entrada)
  const [sesiones, setSesiones] = useState(null)

  const cargarSesiones = useCallback(() => {
    api(`/sessions?club_shelf_id=${club.id}`)
      .then(setSesiones)
      .catch(() => setSesiones([]))
  }, [club.id])

  useEffect(() => { setSesiones(null); cargarSesiones() }, [cargarSesiones])

  // Una sesión añadida desde otro dispositivo aparece aquí sin recargar. Solo
  // las de este libro: el aviso trae el club_shelf_id.
  useLiveUpdates(['sessions'], useCallback(msg => {
    if (msg.club_shelf_id === club.id) cargarSesiones()
  }, [cargarSesiones, club.id]))

  // Lo que se toca de la entrada del club (fechas, notas) va por el mismo
  // PATCH; el estado tiene endpoint propio porque activar un libro desactiva
  // el que estuviera activo, y eso lo resuelve el servidor.
  async function actualizar(patch) {
    await api(`/shelf/club/${club.id}`, { method: 'PATCH', body: patch })
    onCambiado()
  }

  async function cambiarEstado(status) {
    await api(`/shelf/club/${club.id}/status`, { method: 'PATCH', body: { status } })
    onCambiado()
  }

  async function borrar() {
    await api(`/shelf/club/${club.id}`, { method: 'DELETE' })
    onEliminada()
  }

  return (
    <PantallaInferior
      abierta={abierta}
      onCerrar={onCerrar}
      aparicion={vuelo ? 'fundido' : 'subir'}
      visible={!vuelo || vuelo.sentido !== 'vuelta'}
      cabecera={
        <div className="pointer-events-none sticky top-0 z-10 flex justify-between px-3">
          <motion.button
            onClick={onCerrar}
            aria-label="Volver a la estantería del club"
            whileTap={{ scale: 0.92 }}
            className="pointer-events-auto mt-1 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface/90 text-ink shadow-sm backdrop-blur"
          >
            <IconArrowLeft className="h-5 w-5" />
          </motion.button>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-md px-6 pb-kb">
        <div className="flex flex-col items-center text-center">
          {/* La marca del aterrizaje del libro que viene volando desde la
              balda, igual que en la ficha de tu estantería. */}
          <div
            className="w-[168px] shrink-0"
            data-portada-ficha
            style={{ opacity: vuelo && !vuelo.aterrizado ? 0 : 1 }}
          >
            <Cover url={libro.cover_url} title={libro.title} priority relieve realce={false} className="sombra-portada" />
          </div>

          <h2 className="mt-5 font-display text-[1.6rem] font-bold leading-tight tracking-[-0.02em]">
            {libro.title}
          </h2>
          {libro.author && <p className="mt-1.5 text-[15px] text-ink-dim">{libro.author}</p>}

          {(libro.genre || libro.year || paginas) && (
            <p className="mt-3 text-xs text-ink-mute">
              {[libro.genre, libro.year, paginas && `${paginas} pág.`].filter(Boolean).join(' · ')}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <EstadoDelClub club={club} esAdmin={esAdmin} onCambiar={cambiarEstado} />
            <FechasDelClub club={club} esAdmin={esAdmin} onActualizar={actualizar} />
            {club.proposed_by && (
              <Chip>
                <span className="mr-1.5 inline-flex align-[-4px]">
                  <Avatar jugador={club.proposed_by} size={16} />
                </span>
                Lo propuso <NombreJugador jugador={club.proposed_by} className="ml-1 font-semibold" />
              </Chip>
            )}
          </div>

          {/* La media del club, grande, cuando ya está leído: es el resultado
              de la lectura y lo primero que se viene a mirar en un libro
              antiguo. El desglose de quién puso qué va más abajo. */}
          {club.status === 'finished' && club.avg_rating != null && (
            <div className="mt-5 flex flex-col items-center gap-1">
              <StarRating rating={club.avg_rating} size={22} />
              <p className="text-xs text-ink-mute">
                {club.avg_rating.toLocaleString('es')} de media entre {club.vote_count}
                {club.vote_count === 1 ? ' voto' : ' votos'}
              </p>
            </div>
          )}

          {/* Llevárselo a la estantería propia: el club decide qué se lee, pero
              lo leído es de cada uno. Sin salir de aquí, igual que desde la
              estantería de otra persona. */}
          <BotonGuardarlo key={libro.id} onGuardar={() => copiarAMiEstanteria(libro)} />
        </div>

        <div className="mt-9">
          <Apartado titulo="Sinopsis">
            <Sinopsis texto={libro.synopsis} />
          </Apartado>

          {/* Después de la sinopsis y no antes: lo primero que se viene a leer
              de un libro es de qué va. Y para quien no es admin, un libro sin
              notas del club no enseña nada aquí. */}
          <NotasDelClub club={club} esAdmin={esAdmin} onActualizar={actualizar} />

          {/* Las puntuaciones solo cuando el club ha terminado el libro: a
              medias no dicen nada, y ver las de los demás antes de acabar
              cambia lo que opinas. */}
          {club.status === 'finished' && (
            <Puntuaciones entradaId={club.id} onCambiado={onCambiado} />
          )}

          <Sesiones
            entradaId={club.id}
            sesiones={sesiones}
            esAdmin={esAdmin}
            onCambiado={() => { cargarSesiones(); onCambiado() }}
          />

          {esAdmin && (
            <div className="mb-8 border-t border-line pt-5">
              <BotonPeligro
                etiqueta="Quitar el libro del club"
                pregunta="¿Seguro? Se pierden sus sesiones y sus puntuaciones."
                confirmar="Quitar"
                onConfirmar={borrar}
              />
            </div>
          )}
        </div>
      </div>
    </PantallaInferior>
  )
}

// ─── El estado en el ciclo del club ────────────────────────────────────────
// Propuesto → lectura actual → leído. Solo puede haber una lectura actual: al
// activar un libro, el que estuviera activo vuelve a propuestos, y de eso se
// encarga el servidor en la misma llamada.
function EstadoDelClub({ club, esAdmin, onCambiar }) {
  const hoja = useHoja()
  const color = COLOR_DE_ESTADO[club.status]

  if (!esAdmin) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em]"
        style={{ borderColor: color, color }}
      >
        {CLUB_STATUS_LABEL[club.status] || club.status}
      </span>
    )
  }

  return (
    <>
      <Pastilla onClick={hoja.abrir} color={color}>
        <span className="font-semibold uppercase tracking-[0.06em]">
          {CLUB_STATUS_LABEL[club.status] || club.status}
        </span>
      </Pastilla>
      <HojaInferior abierta={hoja.abierta} titulo="Estado en el club" onCerrar={hoja.cerrar}>
        <div className="flex flex-col gap-2 pb-2">
          {CLUB_STATUS_ORDER.map(id => {
            const activo = id === club.status
            const c = COLOR_DE_ESTADO[id]
            return (
              <button
                key={id}
                onClick={() => { hoja.cerrar(); if (!activo) onCambiar(id) }}
                className="rounded-xl2 border px-4 py-3 text-left text-sm font-semibold transition-colors"
                style={{
                  borderColor: c,
                  background: activo ? c : 'transparent',
                  color: activo ? 'var(--color-on-accent)' : 'var(--color-ink)',
                }}
              >
                {CLUB_STATUS_LABEL[id]}
              </button>
            )
          })}
        </div>
        <p className="pb-2 text-xs leading-relaxed text-ink-mute">
          Solo puede haber una lectura actual: al marcar esta, la que hubiera vuelve a propuestos.
          Marcarlo como leído le pone la fecha de hoy si no tenía ninguna.
        </p>
      </HojaInferior>
    </>
  )
}

// ─── Cuándo lo empezó y lo terminó el club ─────────────────────────────────
function FechasDelClub({ club, esAdmin, onActualizar }) {
  const hoja = useHoja()
  const desde = fechaCorta(club.activated_at)
  const hasta = fechaCorta(club.read_date)
  const etiqueta = desde && hasta ? `${desde} – ${hasta}` : (hasta || desde)

  // Propuesto y sin fechas todavía: no hay nada que enseñar, y una pastilla
  // vacía en un libro que nadie ha empezado solo ocupa sitio.
  if (!etiqueta && (!esAdmin || club.status === 'proposed')) return null
  if (!esAdmin) return <Chip>{etiqueta}</Chip>

  return (
    <>
      <Pastilla onClick={hoja.abrir}>{etiqueta || 'Poner fechas'}</Pastilla>
      <HojaInferior abierta={hoja.abierta} titulo="Fechas del club" onCerrar={hoja.cerrar}>
        <div className="flex flex-col gap-4 pb-2">
          <div>
            <p className="mb-1.5 text-[13px] text-ink-dim">Se empezó</p>
            <CamposFecha
              value={club.activated_at ? club.activated_at.slice(0, 10) : ''}
              onChange={v => onActualizar({ activated_at: v })}
            />
          </div>
          <div>
            <p className="mb-1.5 text-[13px] text-ink-dim">Se terminó</p>
            <CamposFecha
              value={club.read_date ? club.read_date.slice(0, 10) : ''}
              onChange={v => onActualizar({ read_date: v })}
            />
          </div>
        </div>
      </HojaInferior>
    </>
  )
}

// ─── Notas del club ────────────────────────────────────────────────────────
// Son del club entero, no de nadie: por qué se eligió, qué edición se leyó, lo
// que haya que recordar. Las escribe el admin y las lee todo el mundo — lo que
// cada uno piense para sí va en las notas de SU copia del libro, en su
// estantería.
function NotasDelClub({ club, esAdmin, onActualizar }) {
  const [texto, setTexto] = useState(club.club_notes || '')
  const [guardado, setGuardado] = useState(false)

  // Si cambian desde otro dispositivo mientras esto está abierto, se adoptan,
  // salvo que se esté escribiendo aquí algo distinto sin guardar.
  const [ultimoGuardado, setUltimoGuardado] = useState(club.club_notes || '')
  if ((club.club_notes || '') !== ultimoGuardado && texto === ultimoGuardado) {
    setUltimoGuardado(club.club_notes || '')
    setTexto(club.club_notes || '')
  }

  if (!esAdmin) {
    if (!club.club_notes) return null
    return (
      <Apartado titulo="Notas del club">
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-dim">{club.club_notes}</p>
      </Apartado>
    )
  }

  // Se guarda al salir del campo, no en cada tecla, igual que las notas de la
  // ficha de tu estantería.
  function alSalir() {
    if (texto === ultimoGuardado) return
    setUltimoGuardado(texto)
    onActualizar({ club_notes: texto })
    setGuardado(true)
    setTimeout(() => setGuardado(false), 1800)
  }

  return (
    <Apartado titulo="Notas del club">
      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        onBlur={alSalir}
        rows={3}
        placeholder="Por qué se eligió, qué edición, lo que haya que recordar…"
        className="w-full resize-none rounded-xl2 border border-line bg-surface p-3 text-[15px] leading-relaxed outline-none transition-colors placeholder:text-ink-mute focus:border-accent-line"
      />
      {guardado && <p className="mt-1 text-xs text-read">Guardado</p>}
    </Apartado>
  )
}

function Apartado({ titulo, children }) {
  return (
    <section className="mb-8">
      <h3 className="mb-2.5 text-[11px] uppercase tracking-[0.14em] text-ink-mute">{titulo}</h3>
      {children}
    </section>
  )
}
