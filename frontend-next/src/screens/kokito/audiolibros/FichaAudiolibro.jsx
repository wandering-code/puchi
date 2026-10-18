import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../../../platform/api'
import { useCapa } from '../../../platform/capas'
import PantallaInferior from '../../luniteca/PantallaInferior'
import HojaInferior from '../../luniteca/HojaInferior'
import { Cover } from '../../luniteca/piezas'
import BotonPeligro from '../../../ui/BotonPeligro'
import Interruptor from '../../../ui/Interruptor'
import Avatar from '../../../ui/Avatar'
import {
  IconArrowLeft, IconCheck, IconChevron, IconEnlace, IconPencil, IconRefresh, IconSearch, IconUnir, IconX,
} from '../../../ui/icons'
import { Etiqueta, Girando } from './Audiolibros'
import { duracion, duracionCorta, haceCuanto, palabras, reloj } from './formato'
import { ESTADOS_AB, Generacion, HojaEmpezar, ReproductorCapitulo } from './Generacion'
import RetocarTrozos from './RetocarTrozos'

// La ficha de un audiolibro: sus datos, la voz, con qué libros va y sus
// capítulos. Todo lo que se toca aquí se guarda al momento; no hay botón de
// "guardar" para la ficha entera.

const VOCES = {
  voz_femenina_suave: { nombre: 'Femenina', nota: 'suave' },
  voz_masculina_media: { nombre: 'Masculina', nota: 'media' },
}
const ENTRADA = 'h-12 w-full rounded-xl2 border border-line bg-surface px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-mute focus:border-accent-line'
const SUAVE = { duration: 0.22, ease: [0.22, 1, 0.36, 1] }

export default function FichaAudiolibro({ id, onCerrar, onCambiar, onBorrar }) {
  const [ab, setAb] = useState(null)
  const [sugerencias, setSugerencias] = useState(null)
  const [error, setError] = useState(null)
  const hojaCapitulo = useCapa(null)
  const hojaDatos = useCapa()
  const hojaBuscar = useCapa()
  const hojaEmpezar = useCapa()
  const [sobremesa, setSobremesa] = useState(null)

  // Al cerrar, `id` pasa a null pero la ficha sigue a la vista mientras baja:
  // se queda con el último audiolibro para no vaciarse a mitad de animación.
  useEffect(() => {
    if (!id) return
    if (ab?.id !== id) { setAb(null); setSugerencias(null) }
    setError(null)
    api(`/audiobooks/${id}`).then(setAb).catch(e => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Mientras haya algo en marcha, la ficha se pone al día sola: el progreso
  // lo va contando el sobremesa. Sin nada en marcha, solo se mira cómo está
  // el sobremesa, más despacio.
  const enMarcha = ab?.status === 'en_cola' || ab?.status === 'generando'
  useEffect(() => {
    if (!id) return
    let vivo = true
    const mirar = () => {
      api('/audiobook-worker/status').then(e => vivo && setSobremesa(e)).catch(() => {})
      if (enMarcha) {
        api(`/audiobooks/${id}`).then(f => { if (vivo) { setAb(f); onCambiar(f) } }).catch(() => {})
      }
    }
    mirar()
    const t = setInterval(mirar, enMarcha ? 4000 : 15000)
    return () => { vivo = false; clearInterval(t) }
  }, [id, enMarcha, onCambiar])

  const cargarSugerencias = useCallback((abId) => {
    api(`/audiobooks/${abId}/suggestions`).then(setSugerencias).catch(() => setSugerencias([]))
  }, [])
  useEffect(() => { if (id) cargarSugerencias(id) }, [id, cargarSugerencias])

  // Cada cambio devuelve el audiolibro entero: así la ficha y la tarjeta de
  // la lista nunca enseñan cosas distintas.
  const aplicar = useCallback(async (peticion, { recargarSugerencias = false } = {}) => {
    setError(null)
    try {
      const fresco = await peticion
      if (fresco) {
        setAb(fresco)
        onCambiar(fresco)
        if (recargarSugerencias) cargarSugerencias(fresco.id)
      }
      return fresco
    } catch (e) {
      setError(e.message)
      return null
    }
  }, [onCambiar, cargarSugerencias])

  const cambiar = (cuerpo) => aplicar(api(`/audiobooks/${ab.id}`, { method: 'PATCH', body: cuerpo }))
  const generar = (inicio) => aplicar(api(`/audiobooks/${ab.id}/generate`, { method: 'POST', body: { start_chapter_id: inicio } }))
  const pausar = () => aplicar(api(`/audiobooks/${ab.id}/pause`, { method: 'POST' }))
  const retener = (ahora = false) => aplicar(api(`/audiobooks/${ab.id}/hold`, { method: 'POST', body: { now: ahora } }))
  const reanudar = () => aplicar(api(`/audiobooks/${ab.id}/resume`, { method: 'POST' }))
  const enlazar = (libro) => aplicar(
    api(`/audiobooks/${ab.id}/books`, { method: 'POST', body: { book_id: libro.id, move: !!libro.linked_to } }),
    { recargarSugerencias: true },
  )
  const desenlazar = (libro) => aplicar(
    api(`/audiobooks/${ab.id}/books/${libro.id}`, { method: 'DELETE' }),
    { recargarSugerencias: true },
  )

  // Optimista: apartar o recuperar capítulos se hace de seguido sobre varios,
  // y esperar a cada respuesta se nota.
  function alternarCapitulo(cap) {
    setAb(a => ({ ...a, chapters: a.chapters.map(c => (c.id === cap.id ? { ...c, included: !c.included } : c)) }))
    aplicar(api(`/audiobooks/${ab.id}/chapters/${cap.id}`, { method: 'PATCH', body: { included: !cap.included } }))
  }

  async function borrar() {
    try {
      await api(`/audiobooks/${ab.id}`, { method: 'DELETE' })
      onBorrar(ab.id)
      onCerrar()
    } catch (e) {
      setError(e.message)
    }
  }

  const capituloAbierto = ab?.chapters.find(c => c.id === hojaCapitulo.abierta) || null

  return (
    <PantallaInferior
      abierta={!!id}
      onCerrar={onCerrar}
      cabecera={
        <div className="pointer-events-none sticky top-0 z-10 flex justify-between px-3">
          <motion.button
            onClick={onCerrar}
            aria-label="Volver a los audiolibros"
            whileTap={{ scale: 0.92 }}
            className="pointer-events-auto mt-1 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface/90 text-ink shadow-sm backdrop-blur"
          >
            <IconArrowLeft className="h-5 w-5" />
          </motion.button>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-md px-6 pb-kb">
        {!ab && !error && (
          <div className="flex flex-col items-center pt-4">
            <div className="aspect-[2/3] w-[132px] animate-pulse rounded-md bg-surface-2" />
            <div className="mt-5 h-6 w-48 animate-pulse rounded bg-surface-2" />
            <div className="mt-2 h-4 w-28 animate-pulse rounded bg-surface-2" />
          </div>
        )}

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-2 rounded-xl2 bg-danger/10 px-4 py-2.5 text-sm text-danger"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {ab && (
          <>
            <Cabecera ab={ab} onEditar={hojaDatos.abrir} />
            <Cifras ab={ab} />
            <Voz ab={ab} onCambiar={voice => cambiar({ voice })} />
            <Generacion ab={ab} sobremesa={sobremesa} onGenerar={hojaEmpezar.abrir} onPausar={pausar}
              onRetener={retener} onReanudar={reanudar} />

            <Seccion
              titulo="Libros"
              nota="Quien tenga uno de estos en su estantería podrá escucharlo."
            >
              <AnimatePresence initial={false} mode="popLayout">
                {ab.books.map(libro => (
                  <motion.div key={libro.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={SUAVE}>
                    <FilaLibro libro={libro} enlazado>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => desenlazar(libro)}
                        aria-label={`Quitar ${libro.title}`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-mute active:bg-surface-2"
                      >
                        <IconX className="h-4 w-4" />
                      </motion.button>
                    </FilaLibro>
                  </motion.div>
                ))}
              </AnimatePresence>

              {ab.books.length === 0 && (
                <p className="rounded-xl2 border border-dashed border-line px-4 py-3 text-sm text-ink-dim">
                  Sin enlazar: de momento nadie lo vería.
                </p>
              )}

              {sugerencias?.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-mute">Puede que sea…</p>
                  <div className="space-y-2">
                    {sugerencias.map(libro => (
                      <FilaLibro key={libro.id} libro={libro}>
                        <BotonEnlazar libro={libro} onEnlazar={() => enlazar(libro)} />
                      </FilaLibro>
                    ))}
                  </div>
                </div>
              )}

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={hojaBuscar.abrir}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl2 border border-line text-sm font-medium text-ink-dim active:bg-surface-2"
              >
                <IconSearch className="h-4 w-4" />
                Buscar otro en el catálogo
              </motion.button>
            </Seccion>

            <Oyentes oyentes={ab.listeners} />

            <Seccion
              titulo="Capítulos"
              nota={`Toca uno para leerlo, renombrarlo o unirlo con el siguiente. ${
                ab.chapters_total - ab.chapters_included > 0
                  ? `Los apartados (${ab.chapters_total - ab.chapters_included}) no se leerán.`
                  : ''
              }`}
            >
              <div className="overflow-hidden rounded-xl2 border border-line bg-surface">
                {ab.chapters.map((cap, i) => (
                  <FilaCapitulo
                    key={cap.id}
                    cap={cap}
                    primera={i === 0}
                    onAbrir={() => hojaCapitulo.abrir(cap.id)}
                    onAlternar={() => alternarCapitulo(cap)}
                  />
                ))}
              </div>
            </Seccion>

            <div className="mt-10 space-y-4 border-t border-line pt-6 pb-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs leading-relaxed text-ink-mute">
                  Volver a leer el EPUB deshace los cambios en los capítulos. Los libros enlazados se quedan.
                </p>
                <BotonPeligro
                  etiqueta="Volver a leer"
                  pregunta="¿Deshacer los cambios en los capítulos?"
                  confirmar="Volver a leer"
                  onConfirmar={() => aplicar(api(`/audiobooks/${ab.id}/reread`, { method: 'POST' }))}
                  className="shrink-0"
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs leading-relaxed text-ink-mute">
                  Borra el EPUB, los capítulos y los enlaces. Los libros de las estanterías no se tocan.
                </p>
                <BotonPeligro
                  etiqueta="Eliminar"
                  pregunta="¿Borrar este audiolibro?"
                  onConfirmar={borrar}
                  className="shrink-0"
                />
              </div>
            </div>
          </>
        )}
      </div>

      {ab && (
        <>
          <HojaCapitulo
            ab={ab}
            cap={capituloAbierto}
            abierta={!!hojaCapitulo.abierta && !!capituloAbierto}
            onCerrar={hojaCapitulo.cerrar}
            onAplicar={aplicar}
          />
          <HojaDatos ab={ab} abierta={hojaDatos.abierta} onCerrar={hojaDatos.cerrar} onGuardar={cambiar} />
          <HojaEmpezar ab={ab} abierta={hojaEmpezar.abierta} onCerrar={hojaEmpezar.cerrar} onGenerar={generar} />
          <HojaBuscar ab={ab} abierta={hojaBuscar.abierta} onCerrar={hojaBuscar.cerrar} onEnlazar={enlazar} />
        </>
      )}
    </PantallaInferior>
  )
}

// ─── Piezas de la ficha ──────────────────────────────────────────────────────

function Cabecera({ ab, onEditar }) {
  return (
    <div className="flex flex-col items-center text-center">
      <Cover url={ab.cover_url} title={ab.title} className="w-[132px]" relieve priority />
      <h2 className="mt-5 font-display text-[1.6rem] font-bold leading-tight tracking-[-0.02em]">{ab.title}</h2>
      {ab.author && <p className="mt-1.5 text-[15px] text-ink-dim">{ab.author}</p>}
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={() => onEditar()}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-ink-dim active:bg-surface-2"
      >
        <IconPencil className="h-3.5 w-3.5" />
        Título y autor
      </motion.button>
    </div>
  )
}

function Cifras({ ab }) {
  const cifras = [
    { etiqueta: 'Capítulos', valor: ab.chapters_included, nota: ab.chapters_total > ab.chapters_included ? `de ${ab.chapters_total}` : null },
    { etiqueta: 'Duración', valor: duracionCorta(ab.minutes), nota: 'aprox.' },
    { etiqueta: 'Estado', valor: ESTADOS_AB[ab.status] || ab.status, nota: ab.chapters_ready ? `${ab.chapters_ready} ${ab.chapters_ready === 1 ? 'listo' : 'listos'}` : (ab.status === 'borrador' ? 'sin generar' : 'aún ninguno listo') },
  ]
  return (
    <div className="mt-6 grid grid-cols-3 gap-2">
      {cifras.map(c => (
        <div key={c.etiqueta} className="rounded-xl2 border border-line bg-surface px-2 py-3 text-center">
          <p className="text-[11px] uppercase tracking-[0.1em] text-ink-mute">{c.etiqueta}</p>
          <p className="mt-1 whitespace-nowrap font-display text-[15px] font-bold leading-tight tabular-nums">{c.valor}</p>
          {c.nota && <p className="text-[11px] text-ink-mute">{c.nota}</p>}
        </div>
      ))}
    </div>
  )
}

function Voz({ ab, onCambiar }) {
  return (
    <div className="mt-6">
      <p className="mb-2 px-1 text-[13px] text-ink-dim">Voz</p>
      <div className="flex gap-1 rounded-xl2 bg-surface-2/70 p-1">
        {ab.voices.map(v => {
          const activa = ab.voice === v
          const info = VOCES[v] || { nombre: v }
          return (
            <button
              key={v}
              onClick={() => !activa && onCambiar(v)}
              aria-pressed={activa}
              className={`relative flex-1 rounded-[14px] py-2.5 text-sm transition-colors ${activa ? 'text-ink' : 'text-ink-dim'}`}
            >
              {activa && (
                <motion.span
                  layoutId={`voz-${ab.id}`}
                  className="absolute inset-0 rounded-[14px] bg-surface shadow-sm"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative font-semibold">{info.nombre}</span>
              {info.nota && <span className="relative ml-1 text-xs text-ink-mute">{info.nota}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Seccion({ titulo, nota, children }) {
  return (
    <section className="mt-9">
      <h3 className="px-1 font-display text-lg font-bold tracking-[-0.01em]">{titulo}</h3>
      {nota && <p className="mb-3 mt-0.5 px-1 text-[13px] leading-relaxed text-ink-dim">{nota}</p>}
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function FilaLibro({ libro, enlazado = false, children }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl2 border p-2.5 ${enlazado ? 'border-accent-line bg-accent-soft/50' : 'border-line bg-surface'}`}>
      <Cover url={libro.cover_url} title={libro.title} className="w-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">{libro.title}</p>
        <p className="mt-0.5 truncate text-xs text-ink-dim">
          {[libro.author, libro.year].filter(Boolean).join(' · ')}
        </p>
        {libro.linked_to
          ? <p className="mt-1 text-[11px] text-ink-mute">Ahora va con «{libro.linked_to.title}»</p>
          : <Duenos duenos={libro.owners} />}
      </div>
      {children}
    </div>
  )
}

// Las caras de quien tiene el libro, solapadas, y sus nombres al lado:
// "wander y Haig", "Ana, Luis y 3 más".
function Duenos({ duenos }) {
  if (!duenos?.length) return <p className="mt-1 text-[11px] text-ink-mute">En ninguna estantería</p>
  const nombres = duenos.map(d => d.name)
  const texto = nombres.length <= 2 ? nombres.join(' y ') : `${nombres.slice(0, 2).join(', ')} y ${nombres.length - 2} más`
  return (
    <div className="mt-1 flex min-w-0 items-center gap-1.5">
      <span className="flex shrink-0 -space-x-1.5">
        {duenos.slice(0, 4).map(d => (
          <span key={d.id} className="rounded-full ring-2 ring-surface"><Avatar jugador={d} size={18} /></span>
        ))}
      </span>
      <span className="truncate text-[11px] text-ink-mute">{texto}</span>
    </div>
  )
}

// Lo que tiene cada uno en su estantería, de más a menos interesado en
// escucharlo ahora.
const ESTADOS = {
  reading:      { orden: 0, texto: 'Lo está leyendo' },
  rereading:    { orden: 1, texto: 'Lo está releyendo' },
  want_to_read: { orden: 2, texto: 'Quiere leerlo' },
  read:         { orden: 3, texto: 'Ya lo ha leído' },
  dropped:      { orden: 4, texto: 'Lo dejó a medias' },
}

function Oyentes({ oyentes }) {
  const lista = [...(oyentes || [])].sort((a, b) =>
    (ESTADOS[a.shelf_status]?.orden ?? 9) - (ESTADOS[b.shelf_status]?.orden ?? 9) || a.name.localeCompare(b.name))
  return (
    <Seccion
      titulo="Quién podrá escucharlo"
      nota="Quien tiene alguno de esos libros en su estantería. Los avisos van a quien lo pidió."
    >
      {lista.length === 0 ? (
        <p className="rounded-xl2 border border-dashed border-line px-4 py-3 text-sm text-ink-dim">
          Nadie todavía: enlaza un libro que tenga alguien.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl2 border border-line bg-surface">
          {lista.map((o, i) => (
            <div key={o.id} className={`flex items-center gap-3 px-3.5 py-2.5 ${i ? 'border-t border-line/70' : ''}`}>
              <Avatar jugador={o} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight" style={{ color: o.color || undefined }}>{o.name}</p>
                <p className="mt-0.5 truncate text-[11px] text-ink-mute">
                  {ESTADOS[o.shelf_status]?.texto || 'En su estantería'}
                </p>
              </div>
              <EstadoAviso oyente={o} />
            </div>
          ))}
        </div>
      )}
    </Seccion>
  )
}

// Lo que sabe del audiolibro cada uno: si lo pidió, si se le ha avisado y si
// lo ha visto (fase 7, #69).
const AVISO = { ab_ready: 'Avisado', ab_new_chapter: 'Avisado de un capítulo', ab_complete: 'Avisado: completo' }

function EstadoAviso({ oyente }) {
  const ultimo = (oyente.notices || []).filter(n => AVISO[n.kind]).at(-1)
  if (!oyente.requested && !ultimo) return null
  if (!ultimo) {
    return <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-dim">Lo pidió</span>
  }
  return (
    <span className="shrink-0 text-right">
      <span className="block rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">{AVISO[ultimo.kind]}</span>
      <span className="mt-0.5 block text-[10px] text-ink-mute">{ultimo.read ? 'Visto' : 'Sin ver'} · {haceCuanto(ultimo.at)}</span>
    </span>
  )
}

function BotonEnlazar({ libro, onEnlazar, yaEnlazado = false }) {
  const [enviando, setEnviando] = useState(false)
  if (yaEnlazado) {
    return (
      <span className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold text-accent">
        <IconCheck className="h-3.5 w-3.5" /> Enlazado
      </span>
    )
  }
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      disabled={enviando}
      onClick={async () => { setEnviando(true); await onEnlazar(); setEnviando(false) }}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 text-xs font-semibold text-on-accent shadow-sm disabled:opacity-70"
    >
      {enviando ? <Girando className="h-3.5 w-3.5" /> : <IconEnlace className="h-3.5 w-3.5" />}
      {libro.linked_to ? 'Mover aquí' : 'Enlazar'}
    </motion.button>
  )
}

function FilaCapitulo({ cap, primera, onAbrir, onAlternar }) {
  return (
    <div className={`flex items-center ${primera ? '' : 'border-t border-line/70'}`}>
      <button onClick={onAbrir} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3.5 pr-2 text-left active:bg-surface-2">
        <span className="w-6 shrink-0 text-right text-xs tabular-nums text-ink-mute">{cap.position + 1}</span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-sm transition-colors ${
              cap.included ? 'text-ink' : 'text-ink-mute line-through decoration-ink-mute/40'
            }`}
          >
            {cap.title}
          </span>
          <EstadoCapitulo cap={cap} />
          {cap.status === 'generando' && (
            <span className="mt-1.5 block h-0.5 overflow-hidden rounded-full bg-surface-2">
              <motion.span
                className="block h-full rounded-full bg-accent"
                initial={false}
                animate={{ width: `${cap.progress * 100}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 24 }}
              />
            </span>
          )}
        </span>
      </button>
      {/* El círculo: incluido o apartado, de un toque y sin abrir nada. */}
      <button
        onClick={onAlternar}
        role="switch"
        aria-checked={cap.included}
        aria-label={cap.included ? `Apartar ${cap.title}` : `Incluir ${cap.title}`}
        className="flex h-12 w-12 shrink-0 items-center justify-center"
      >
        <motion.span
          initial={false}
          animate={{
            backgroundColor: cap.included ? 'var(--color-accent)' : 'rgba(0,0,0,0)',
            borderColor: cap.included ? 'var(--color-accent)' : 'var(--color-line)',
            scale: cap.included ? 1 : 0.92,
          }}
          transition={{ type: 'spring', stiffness: 520, damping: 30 }}
          className="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] text-on-accent"
        >
          <AnimatePresence initial={false}>
            {cap.included && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.15 }}>
                <IconCheck className="h-3.5 w-3.5" />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.span>
      </button>
    </div>
  )
}

// Debajo del título de cada capítulo: si está, cuánto dura de verdad; si no,
// lo que se estima y en qué punto está.
function EstadoCapitulo({ cap }) {
  if (!cap.included) {
    return <span className="mt-0.5 block text-[11px] text-ink-mute">apartado</span>
  }
  const base = 'mt-0.5 flex items-center gap-1 text-[11px] tabular-nums'
  if (cap.status === 'listo') {
    return (
      <span className={`${base} text-read`}>
        <IconCheck className="h-3 w-3" /> {reloj(cap.duration_s)}
      </span>
    )
  }
  if (cap.status === 'generando') {
    return <span className={`${base} text-accent`}>Generando · {Math.round(cap.progress * 100)} %</span>
  }
  if (cap.status === 'en_cola') {
    return <span className={`${base} text-ink-dim`}>En cola · {duracion(cap.minutes)} aprox.</span>
  }
  if (cap.status === 'error') {
    return <span className={`${base} text-danger`}>Falló al generarlo</span>
  }
  return (
    <span className={`${base} text-ink-mute`}>
      {duracion(cap.minutes)} aprox.{cap.looks_like_extra && ' · ¿es parte de la historia?'}
    </span>
  )
}

// ─── Hojas ───────────────────────────────────────────────────────────────────

// Lo largo se pinta por partes: un capítulo puede pasar de 20.000 palabras, y
// meterlas todas de golpe en la hoja hace que tarde en subir.
const TROZO_LECTURA = 8000

function HojaCapitulo({ ab, cap, abierta, onCerrar, onAplicar }) {
  const [titulo, setTitulo] = useState('')
  const [tiempo, setTiempo] = useState(null)
  const [irA, setIrA] = useState(null)
  const refrescarFicha = useCallback(() => { onAplicar(api(`/audiobooks/${ab.id}`)) }, [onAplicar, ab.id])
  const pantallaRetoque = useCapa()
  const [texto, setTexto] = useState(null)
  const [hasta, setHasta] = useState(TROZO_LECTURA)
  const [uniendo, setUniendo] = useState(false)
  const capId = cap?.id

  useEffect(() => {
    if (!abierta || !capId) return
    setTitulo(cap.title)
    setTexto(null)
    setHasta(TROZO_LECTURA)
    api(`/audiobooks/${ab.id}/chapters/${capId}/text`).then(d => setTexto(d.text)).catch(() => setTexto(''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, capId])

  if (!cap) return <HojaInferior abierta={false} titulo="" onCerrar={onCerrar} />

  const i = ab.chapters.findIndex(c => c.id === cap.id)
  const siguiente = ab.chapters[i + 1]
  const parrafos = texto ? texto.slice(0, hasta).split(/\n{2,}/).filter(p => p.trim()) : []

  function guardarTitulo() {
    const limpio = titulo.trim()
    if (!limpio) { setTitulo(cap.title); return }
    if (limpio !== cap.title) {
      onAplicar(api(`/audiobooks/${ab.id}/chapters/${cap.id}`, { method: 'PATCH', body: { title: limpio } }))
    }
  }

  async function unir() {
    setUniendo(true)
    await onAplicar(api(`/audiobooks/${ab.id}/chapters/${cap.id}/merge`, { method: 'POST' }))
    setUniendo(false)
    // El texto ha crecido: se vuelve a pedir el del capítulo, ya unido.
    api(`/audiobooks/${ab.id}/chapters/${cap.id}/text`).then(d => setTexto(d.text)).catch(() => {})
  }

  return (
    <HojaInferior abierta={abierta} titulo={`Capítulo ${cap.position + 1}`} onCerrar={onCerrar}>
      <label className="block">
        <span className="mb-1.5 block px-1 text-[13px] text-ink-dim">Título</span>
        <input
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          onBlur={guardarTitulo}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className={`${ENTRADA} font-semibold`}
        />
      </label>

      <div className="mt-4 rounded-xl2 border border-line bg-surface px-4 py-3">
        <Interruptor
          puesto={cap.included}
          onCambiar={v => onAplicar(api(`/audiobooks/${ab.id}/chapters/${cap.id}`, { method: 'PATCH', body: { included: v } }))}
          etiqueta={cap.included ? 'Se lee en el audiolibro' : 'Apartado: no se leerá'}
          nota={cap.looks_like_extra ? 'Por el título o lo corto que es, parece que no es parte de la historia.' : null}
        />
      </div>

      <p className="mt-3 px-1 text-xs tabular-nums text-ink-mute">
        {palabras(cap.words)} · {duracion(cap.minutes)} aprox.
      </p>

      {cap.has_audio && (
        <div className="mt-4">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-mute">El audio</p>
          <ReproductorCapitulo
            src={`/api/audiobooks/${ab.id}/chapters/${cap.id}/audio?v=${encodeURIComponent(cap.generated_at || '')}`}
            duracionS={cap.duration_s}
            irA={irA}
            onTiempo={setTiempo}
          />
          <p className="mt-1.5 px-1 text-[11px] text-ink-mute">
            Generado el {new Date(cap.generated_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            {cap.voice_used && cap.voice_used !== ab.voice && ' · con la otra voz'}
          </p>
        </div>
      )}

      {/* Retocar trozos sueltos: el capítulo entero en texto, en su propia
          pantalla (RetocarTrozos), para tocar la parte que suena mal. */}
      {cap.has_audio && cap.pieces && cap.status === 'listo' && (
        <button
          onClick={() => pantallaRetoque.abrir()}
          className="mt-4 flex w-full items-center gap-3 rounded-xl2 border border-line px-4 py-3 text-left transition-transform duration-150 active:scale-[0.99] active:bg-surface-2"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-dim">
            <IconRefresh className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Retocar trozos</span>
            <span className="block text-xs text-ink-mute">
              {cap.retouches ? `${cap.retouches} en camino · ` : ''}Toca en el texto lo que suena mal
            </span>
          </span>
          <IconChevron className="h-4 w-4 shrink-0 -rotate-90 text-ink-mute" />
        </button>
      )}
      <RetocarTrozos
        ab={ab}
        cap={cap}
        abierta={!!pantallaRetoque.abierta}
        onCerrar={pantallaRetoque.cerrar}
        onHecho={refrescarFicha}
      />

      {cap.status === 'error' && cap.error && (
        <p className="mt-4 rounded-xl2 bg-danger/10 px-3.5 py-2.5 text-xs leading-relaxed text-danger">
          Falló tres veces: {cap.error}
        </p>
      )}

      {cap.included && (cap.status === 'listo' || cap.status === 'error') && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => onAplicar(api(`/audiobooks/${ab.id}/chapters/${cap.id}/regenerate`, { method: 'POST' }))}
          className="mt-3 flex w-full items-center gap-3 rounded-xl2 border border-line px-4 py-3 text-left active:bg-surface-2"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-dim">
            <IconRefresh className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{cap.status === 'error' ? 'Volver a intentarlo' : 'Regenerar'}</span>
            <span className="block text-xs text-ink-mute">Pasa el primero de la cola; el audio de ahora se queda hasta que llegue el nuevo</span>
          </span>
        </motion.button>
      )}
      {(cap.status === 'en_cola' || cap.status === 'generando') && (
        <p className="mt-3 rounded-xl2 bg-accent-soft/60 px-3.5 py-2.5 text-xs text-ink-dim">
          {cap.status === 'generando'
            ? `Generándose ahora: ${Math.round(cap.progress * 100)} %${cap.progress_note ? ` · ${cap.progress_note}` : ''}`
            : 'En la cola, esperando su turno.'}
        </p>
      )}

      {siguiente && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={unir}
          disabled={uniendo}
          className="mt-3 flex w-full items-center gap-3 rounded-xl2 border border-line px-4 py-3 text-left active:bg-surface-2 disabled:opacity-60"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-dim">
            {uniendo ? <Girando className="h-4 w-4" /> : <IconUnir className="h-4 w-4" />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Unir con el siguiente</span>
            <span className="block truncate text-xs text-ink-mute">«{siguiente.title}» pasa a ser parte de este</span>
          </span>
        </motion.button>
      )}

      <div className="mt-6">
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-mute">El texto</p>
        <div className="rounded-xl2 bg-bg px-4 py-4" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
          {texto === null && (
            <div className="space-y-2.5">
              {[92, 100, 84, 96, 60].map((w, k) => (
                <div key={k} className="h-3 animate-pulse rounded bg-surface-2" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}
          {texto === '' && <p className="text-sm text-ink-mute">Este capítulo no tiene texto.</p>}
          {parrafos.map((p, k) => (
            <p key={k} className="mb-3 text-[14px] leading-[1.75] text-ink last:mb-0">{p}</p>
          ))}
          {texto && texto.length > hasta && (
            <button
              onClick={() => setHasta(h => h + TROZO_LECTURA * 2)}
              className="mt-3 w-full rounded-full border border-line py-2 font-sans text-xs font-semibold text-ink-dim active:bg-surface-2"
            >
              Seguir leyendo
            </button>
          )}
        </div>
      </div>
    </HojaInferior>
  )
}

function HojaDatos({ ab, abierta, onCerrar, onGuardar }) {
  const [titulo, setTitulo] = useState(ab.title)
  const [autor, setAutor] = useState(ab.author || '')
  useEffect(() => {
    if (abierta) { setTitulo(ab.title); setAutor(ab.author || '') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta])

  async function guardar() {
    const hecho = await onGuardar({ title: titulo, author: autor })
    if (hecho) onCerrar()
  }

  return (
    <HojaInferior
      abierta={abierta}
      titulo="Título y autor"
      onCerrar={onCerrar}
      pie={
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={guardar}
          disabled={!titulo.trim()}
          className="h-12 flex-1 rounded-xl2 bg-accent text-sm font-semibold text-on-accent disabled:opacity-50"
        >
          Guardar
        </motion.button>
      }
    >
      <p className="mb-4 text-[13px] leading-relaxed text-ink-dim">
        Los que vienen en el EPUB. Es solo el nombre del audiolibro: los libros enlazados no cambian.
      </p>
      <label className="block">
        <span className="mb-1.5 block px-1 text-[13px] text-ink-dim">Título</span>
        <input value={titulo} onChange={e => setTitulo(e.target.value)} className={`${ENTRADA} font-semibold`} />
      </label>
      <label className="mt-4 block">
        <span className="mb-1.5 block px-1 text-[13px] text-ink-dim">Autor</span>
        <input value={autor} onChange={e => setAutor(e.target.value)} className={ENTRADA} />
      </label>
    </HojaInferior>
  )
}

function HojaBuscar({ ab, abierta, onCerrar, onEnlazar }) {
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const turno = useRef(0)

  useEffect(() => { if (abierta) { setQ(''); setResultados(null) } }, [abierta])

  useEffect(() => {
    const limpio = q.trim()
    if (limpio.length < 2) { setResultados(null); return }
    const mio = ++turno.current
    setBuscando(true)
    const t = setTimeout(() => {
      api(`/audiobooks/${ab.id}/catalog?q=${encodeURIComponent(limpio)}`)
        .then(r => { if (mio === turno.current) setResultados(r) })
        .catch(() => { if (mio === turno.current) setResultados([]) })
        .finally(() => { if (mio === turno.current) setBuscando(false) })
    }, 250)
    return () => clearTimeout(t)
  }, [q, ab.id])

  const enlazados = new Set(ab.books.map(b => b.id))

  return (
    <HojaInferior abierta={abierta} titulo="Buscar en el catálogo" onCerrar={onCerrar}>
      <p className="mb-3 text-[13px] leading-relaxed text-ink-dim">
        Solo los libros que ya tiene alguien en su estantería: los demás no tendrían quién lo escuche.
      </p>
      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Título o autor"
          enterKeyHint="search"
          className={`${ENTRADA} pl-10`}
        />
        {buscando && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-mute"><Girando className="h-4 w-4" /></span>}
      </div>

      <div className="mt-4 space-y-2 pb-2">
        {resultados?.length === 0 && (
          <p className="py-6 text-center text-sm text-ink-mute">Nada con ese título o autor.</p>
        )}
        {resultados?.map(libro => (
          <FilaLibro key={libro.id} libro={libro}>
            {/* Tras enlazar, el botón pasa solo a "Enlazado": la ficha se
                pone al día y con ella `enlazados`. */}
            <BotonEnlazar libro={libro} yaEnlazado={enlazados.has(libro.id)} onEnlazar={() => onEnlazar(libro)} />
          </FilaLibro>
        ))}
      </div>
    </HojaInferior>
  )
}
