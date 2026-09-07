import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER, readingDatesLabel, statusPatch } from './shelf'
import { IconChevron } from '../../ui/icons'
import HojaInferior, { useHoja } from './HojaInferior'

// Los datos de la ficha se editan tocando el dato en sí, no rellenando un
// formulario aparte: cada uno es una pastilla que enseña su valor y abre un
// modal pequeño con lo justo para cambiarlo. Es la idea de la Luniteca nueva
// de la Puchi actual, hecha aquí con las herramientas de esta app.

export function Pastilla({ children, onClick, color, activa }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors"
      style={{
        borderColor: color || 'var(--color-line)',
        color: color || 'var(--color-ink-dim)',
        background: activa ? 'var(--color-accent-soft)' : 'transparent',
      }}
    >
      {children}
    </motion.button>
  )
}

// ─── Estado ────────────────────────────────────────────────────────────────
export function EditorEstado({ entry, onActualizar }) {
  const hoja = useHoja()
  return (
    <>
      <Pastilla onClick={hoja.abrir} color={STATUS_COLOR[entry.status]}>
        <span className="font-semibold uppercase tracking-[0.06em]">{STATUS_LABEL[entry.status]}</span>
      </Pastilla>
      <HojaInferior abierta={hoja.abierta} titulo="Estado" onCerrar={hoja.cerrar}>
            <div className="flex flex-col gap-2 pb-2">
              {STATUS_ORDER.map(id => {
                const activo = id === entry.status
                const color = STATUS_COLOR[id]
                return (
                  <button
                    key={id}
                    onClick={() => { hoja.cerrar(); if (id !== entry.status) onActualizar(statusPatch(id, entry)) }}
                    className="rounded-xl2 border px-4 py-3 text-left text-sm font-semibold transition-colors"
                    style={{
                      borderColor: color,
                      background: activo ? color : 'transparent',
                      color: activo ? 'var(--color-on-accent)' : 'var(--color-ink)',
                    }}
                  >
                    {STATUS_LABEL[id]}
                  </button>
                )
              })}
            </div>
      </HojaInferior>
    </>
  )
}

// ─── Fechas ────────────────────────────────────────────────────────────────
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const ANOS = (() => {
  const actual = new Date().getFullYear()
  return Array.from({ length: 60 }, (_, i) => actual + 1 - i)
})()

// Tres <select>, nunca <input type="date">: el nativo de Safari en iOS lleva
// años con fallos que no se han arreglado, y en la Puchi actual se acabó
// resolviendo exactamente así (CustomDateInput). No se reabre esa discusión.
function CamposFecha({ value, onChange }) {
  const [a, m, d] = value ? value.split('-').map(Number) : [null, null, null]
  const diasDelMes = m && a ? new Date(a, m, 0).getDate() : 31

  function cambiar(parte, valor) {
    const nuevo = { a, m, d, [parte]: valor ? Number(valor) : null }
    // Hasta que no están las tres partes no hay fecha que guardar; si se vacía
    // cualquiera de ellas, se borra la fecha entera.
    if (!nuevo.a || !nuevo.m || !nuevo.d) { onChange(''); return }
    const dia = Math.min(nuevo.d, new Date(nuevo.a, nuevo.m, 0).getDate())
    onChange(`${nuevo.a}-${String(nuevo.m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`)
  }

  const estilo = 'h-11 appearance-none rounded-xl2 border border-line bg-bg px-2.5 text-sm text-ink outline-none'
  // Las opciones, un frame después de que aparezca la hoja: entre los tres
  // desplegables y las dos fechas son más de doscientas, y crearlas a la vez
  // que la hoja le come los primeros fotogramas a la animación.
  const [listas, setListas] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setListas(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div className="grid grid-cols-[1fr_1.6fr_1.2fr] gap-2">
      <select value={d ?? ''} onChange={e => cambiar('d', e.target.value)} className={estilo} aria-label="Día">
        <option value="">—</option>
        {listas
          ? Array.from({ length: diasDelMes }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)
          : d && <option value={d}>{d}</option>}
      </select>
      <select value={m ?? ''} onChange={e => cambiar('m', e.target.value)} className={estilo} aria-label="Mes">
        <option value="">—</option>
        {listas
          ? MESES.map((nombre, i) => <option key={nombre} value={i + 1}>{nombre}</option>)
          : m && <option value={m}>{MESES[m - 1]}</option>}
      </select>
      <select value={a ?? ''} onChange={e => cambiar('a', e.target.value)} className={estilo} aria-label="Año">
        <option value="">—</option>
        {listas
          ? ANOS.map(n => <option key={n} value={n}>{n}</option>)
          : a && <option value={a}>{a}</option>}
      </select>
    </div>
  )
}

export function EditorFechas({ entry, onActualizar }) {
  const hoja = useHoja()
  const llevaInicio = ['reading', 'rereading', 'read', 'dropped'].includes(entry.status)
  const llevaFin = ['read', 'dropped'].includes(entry.status)
  if (!llevaInicio) return null
  const etiqueta = readingDatesLabel(entry)

  return (
    <>
      <Pastilla onClick={hoja.abrir}>{etiqueta || 'Añadir fecha'}</Pastilla>
      <HojaInferior abierta={hoja.abierta} titulo="Fechas de lectura" onCerrar={hoja.cerrar}>
            <div className="flex flex-col gap-4 pb-2">
              <div>
                <p className="mb-1.5 text-[13px] text-ink-dim">Empezado</p>
                <CamposFecha
                  value={entry.started_at ? entry.started_at.slice(0, 10) : ''}
                  onChange={v => onActualizar({ started_at: v })}
                />
              </div>
              {llevaFin && (
                <div>
                  <p className="mb-1.5 text-[13px] text-ink-dim">Terminado</p>
                  <CamposFecha
                    value={entry.finished_at ? entry.finished_at.slice(0, 10) : ''}
                    onChange={v => onActualizar({ finished_at: v })}
                  />
                </div>
              )}
            </div>
      </HojaInferior>
    </>
  )
}

// ─── Carpeta ───────────────────────────────────────────────────────────────
export function EditorCarpeta({ entry, carpetas, onActualizar }) {
  const hoja = useHoja()
  const [nueva, setNueva] = useState('')

  function elegir(nombre) {
    hoja.cerrar()
    if ((nombre || '') !== (entry.folder || '')) onActualizar({ folder: nombre })
  }

  return (
    <>
      <Pastilla onClick={() => { setNueva(''); hoja.abrir() }} activa={!!entry.folder}>
        {entry.folder || 'Sin carpeta'}
      </Pastilla>
      <HojaInferior abierta={hoja.abierta} titulo="Carpeta" onCerrar={hoja.cerrar}>
            <div className="mb-3 flex flex-col gap-1.5">
              <BotonCarpeta activa={!entry.folder} onClick={() => elegir('')}>Sin carpeta</BotonCarpeta>
              {carpetas.map(c => (
                <BotonCarpeta key={c} activa={entry.folder === c} onClick={() => elegir(c)}>{c}</BotonCarpeta>
              ))}
            </div>
            <form
              onSubmit={ev => { ev.preventDefault(); if (nueva.trim()) elegir(nueva.trim()) }}
              className="flex gap-2"
            >
              <input
                value={nueva}
                onChange={ev => setNueva(ev.target.value)}
                placeholder="Carpeta nueva"
                className="h-11 min-w-0 flex-1 rounded-xl2 border border-line bg-bg px-3 text-[15px] outline-none placeholder:text-ink-mute focus:border-accent-line"
              />
              <button
                type="submit"
                disabled={!nueva.trim()}
                className="h-11 shrink-0 rounded-xl2 bg-accent px-4 text-sm font-semibold text-on-accent transition-colors disabled:bg-surface-2 disabled:text-ink-mute"
              >
                Crear
              </button>
            </form>
      </HojaInferior>
    </>
  )
}

function BotonCarpeta({ activa, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 truncate rounded-xl2 border px-3.5 py-2.5 text-left text-sm transition-colors ${
        activa ? 'border-accent-line bg-accent-soft text-accent' : 'border-line text-ink-dim'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Veces leído ───────────────────────────────────────────────────────────
export function EditorLecturas({ entry, onActualizar }) {
  const hoja = useHoja()
  const veces = entry.times_read || 1
  // Nunca por debajo de 1: si está marcado como leído, se ha leído al menos
  // una vez, y un 0 ahí solo puede ser un error de conteo.
  const paso = (delta) => onActualizar({ times_read: Math.max(1, veces + delta) })

  return (
    <>
      <Pastilla onClick={hoja.abrir}>
        {veces === 1 ? '1 lectura' : `×${veces} lecturas`}
      </Pastilla>
      <HojaInferior abierta={hoja.abierta} titulo="Veces leído" onCerrar={hoja.cerrar}>
            <div className="flex items-center justify-center gap-6 py-2">
              <BotonPaso onClick={() => paso(-1)} deshabilitado={veces <= 1} etiqueta="Una menos">−</BotonPaso>
              <motion.span
                key={veces}
                className="font-display text-4xl font-bold tabular-nums"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
              >
                {veces}
              </motion.span>
              <BotonPaso onClick={() => paso(1)} etiqueta="Una más">+</BotonPaso>
            </div>
      </HojaInferior>
    </>
  )
}

function BotonPaso({ onClick, deshabilitado, etiqueta, children }) {
  return (
    <button
      onClick={onClick}
      disabled={deshabilitado}
      aria-label={etiqueta}
      className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-xl text-ink transition-colors active:bg-surface-2 disabled:opacity-40"
    >
      {children}
    </button>
  )
}

// ─── Sinopsis ──────────────────────────────────────────────────────────────
const LINEAS_PLEGADA = 6

// Se anima la altura real (medida del texto completo), no un line-clamp: así
// el despliegue es un movimiento continuo y no un salto. Con un degradado
// hacia el fondo mientras está plegada, para que se vea que hay más texto.
export function Sinopsis({ texto }) {
  const [abierta, setAbierta] = useState(false)
  const [altura, setAltura] = useState(null)
  const [nodo, setNodo] = useState(null)
  const alturaPlegada = Math.round(15 * 1.7 * LINEAS_PLEGADA)

  useEffect(() => {
    setAbierta(false)
    if (nodo) setAltura(nodo.scrollHeight)
  }, [texto, nodo])

  if (!texto) return <p className="text-sm text-ink-mute">Este libro todavía no tiene sinopsis.</p>

  const desborda = altura != null && altura > alturaPlegada + 4

  return (
    <div>
      <motion.div
        className="relative overflow-hidden"
        initial={false}
        animate={{ height: abierta ? (altura ?? 'auto') : Math.min(altura ?? alturaPlegada, alturaPlegada) }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <p ref={setNodo} className="whitespace-pre-line text-[15px] leading-[1.7] text-ink-dim">
          {texto}
        </p>
        <AnimatePresence>
          {!abierta && desborda && (
            <motion.div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-10"
              style={{ background: 'linear-gradient(to bottom, transparent, var(--color-bg))' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>
      </motion.div>
      {desborda && (
        <button onClick={() => setAbierta(v => !v)} className="mt-2 flex items-center gap-1 text-sm font-semibold text-accent">
          {abierta ? 'Leer menos' : 'Leer más'}
          <IconChevron className={`h-3.5 w-3.5 transition-transform ${abierta ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  )
}
