import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { api } from '../../platform/api'
import { useAuth } from '../../platform/auth'
import HojaInferior from './HojaInferior'
import RecortarFoto from './RecortarFoto'
import { BotonBorrarEsquina } from './piezas'
import { IconCamara, IconImagen } from '../../ui/icons'

// Elegir el lomo de TU copia del libro: igual que SelectorPortada, lo que se
// pone aquí va a tu entrada de la estantería (PersonalShelf.spine_url), no al
// libro compartido. A diferencia de la portada, una foto de lomo casi nunca
// encaja tal cual en forma de lomo — por eso, antes de subirla, siempre pasa
// por RecortarFoto, que deja recortar a la forma que tenga el lomo de verdad
// en la foto (sin una proporción impuesta). `ancho`/`alto` aquí son solo
// para las miniaturas de la galería, del tamaño de ESTE libro para hacerse
// una idea de cómo quedaría.
export default function SelectorLomo({ abierta, libro, ancho, alto, elegida, onCerrar, onElegir, onSubir }) {
  const { player } = useAuth()
  const [datos, setDatos] = useState(null)   // null = cargando
  const [pendiente, setPendiente] = useState(null) // File esperando recorte
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState(null)
  const camara = useRef(null)
  const galeria = useRef(null)

  useEffect(() => {
    if (!abierta) return
    let cancelado = false
    setDatos(null)
    setError(null)
    api(`/books/${libro.id}/spines`)
      .then(d => { if (!cancelado) setDatos(d) })
      .catch(() => { if (!cancelado) setError('No se han podido cargar los lomos.') })
    return () => { cancelado = true }
  }, [abierta, libro.id])

  function alElegirArchivo(ev) {
    const fichero = ev.target.files?.[0]
    ev.target.value = ''   // permite volver a elegir el mismo archivo
    if (fichero) setPendiente(fichero)
  }

  async function alConfirmarRecorte(blob) {
    setPendiente(null)
    setSubiendo(true)
    setError(null)
    try {
      const url = await onSubir(blob)
      onElegir(url)
    } catch {
      setError('No se ha podido subir la foto.')
    } finally {
      setSubiendo(false)
    }
  }

  // Mismo mecanismo que SelectorPortada: borra la fila de la galería (nunca
  // el lomo elegido ahora mismo, que sigue apuntando al mismo archivo — el
  // servidor solo borra el archivo si ya no lo usa nadie).
  async function borrarSubida(id) {
    try {
      await api(`/books/${libro.id}/spines/${id}`, { method: 'DELETE' })
      setDatos(d => (d ? { ...d, user_uploads: d.user_uploads.filter(u => u.id !== id) } : d))
    } catch {
      setError('No se ha podido borrar el lomo.')
    }
  }

  const subidas = datos?.user_uploads || []
  const generado = datos?.default_url

  return (
    <>
      <HojaInferior abierta={abierta && !pendiente} titulo="Lomo" onCerrar={onCerrar}>
        <div className="mb-4 flex gap-2.5">
          <button
            onClick={() => camara.current?.click()}
            disabled={subiendo}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl2 bg-accent text-[14px] font-semibold text-on-accent disabled:opacity-60"
          >
            <IconCamara className="h-4 w-4" />
            Hacer una foto
          </button>
          <button
            onClick={() => galeria.current?.click()}
            disabled={subiendo}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl2 border border-line text-[14px] font-semibold text-ink disabled:opacity-60"
          >
            <IconImagen className="h-4 w-4" />
            Galería
          </button>
        </div>
        <input ref={camara} type="file" accept="image/*" capture="environment" onChange={alElegirArchivo} className="hidden" />
        <input ref={galeria} type="file" accept="image/*" onChange={alElegirArchivo} className="hidden" />

        {subiendo && <p className="mb-3 text-sm text-ink-mute">Subiendo…</p>}
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

        {generado && elegida && elegida !== generado && (
          <button onClick={() => onElegir('')} className="mb-5 flex w-full items-center gap-3 rounded-xl2 border border-line p-2 text-left">
            <MiniLomo url={generado} ancho={ancho} alto={alto} />
            <span className="text-sm text-ink-dim">Volver al lomo de la estantería</span>
          </button>
        )}

        {datos === null && !error && (
          <div className="flex gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-md bg-surface-2" style={{ width: ancho, height: alto }} />
            ))}
          </div>
        )}

        {subidas.length > 0 && (
          <section>
            <h4 className="mb-2.5 text-[11px] uppercase tracking-[0.14em] text-ink-mute">Subidas por el club</h4>
            <div className="flex flex-wrap gap-3">
              {subidas.map(u => (
                <Opcion
                  key={u.url}
                  url={u.url}
                  ancho={ancho}
                  alto={alto}
                  pie={u.uploaded_by ? `por ${u.uploaded_by}` : null}
                  elegida={elegida === u.url}
                  onElegir={() => onElegir(u.url)}
                  onBorrar={u.uploaded_by_id === player?.id ? () => borrarSubida(u.id) : null}
                />
              ))}
            </div>
          </section>
        )}

        {datos && subidas.length === 0 && (
          <p className="text-sm text-ink-mute">
            Nadie ha subido todavía una foto del lomo de este libro. Puedes ser el primero.
          </p>
        )}
      </HojaInferior>

      {pendiente && (
        <RecortarFoto
          file={pendiente}
          titulo="Encuadra el lomo"
          instrucciones="Ajusta las esquinas al lomo · pellizca o usa la rueda para acercar"
          proporcionInicial={0.28}
          onCancelar={() => setPendiente(null)}
          onConfirmar={alConfirmarRecorte}
        />
      )}
    </>
  )
}

function MiniLomo({ url, ancho, alto }) {
  return (
    <div
      className="shrink-0 overflow-hidden rounded-sm bg-surface-2"
      style={{ width: ancho, height: alto, backgroundImage: `url(${url})`, backgroundSize: 'cover' }}
    />
  )
}

function Opcion({ url, ancho, alto, pie, elegida, onElegir, onBorrar }) {
  return (
    <div className="text-left">
      {/* El botón de borrar va FUERA de este, no dentro: dos <button>
          anidados es HTML inválido, y aquí además tocar la cruz no debe
          elegir también el lomo. */}
      <div className="relative" style={{ width: ancho }}>
        <motion.button onClick={onElegir} whileTap={{ scale: 0.95 }} className="block">
          <div className={`overflow-hidden rounded-sm ring-offset-2 ring-offset-surface transition-[box-shadow] ${elegida ? 'ring-2 ring-accent' : ''}`}>
            <MiniLomo url={url} ancho={ancho} alto={alto} />
          </div>
        </motion.button>
        {onBorrar && <BotonBorrarEsquina etiqueta="Borrar este lomo" onConfirmar={onBorrar} />}
      </div>
      {pie && <p className="mt-1 max-w-[--w] truncate text-[10px] text-ink-mute" style={{ '--w': `${ancho}px`, maxWidth: ancho }}>{pie}</p>}
    </div>
  )
}
