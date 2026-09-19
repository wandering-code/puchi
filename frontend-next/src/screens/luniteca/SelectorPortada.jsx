import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { api } from '../../platform/api'
import { useAuth } from '../../platform/auth'
import { BotonBorrarEsquina, Cover } from './piezas'
import HojaInferior from './HojaInferior'
import RecortarFoto from './RecortarFoto'

// Elegir la portada de TU copia del libro. No cambia la del libro compartido:
// cada jugador ve la que ha elegido (PersonalShelf.cover_url), y lo que se
// sube va a una galería común con atribución, para que otros puedan usarla.
//
// Una foto de la portada real (la cubierta del libro en la mano, no una
// captura de pantalla ya recortada) casi nunca sale encuadrada a la
// proporción de un libro por sí sola — sale con mesa, con dedos, con lo que
// hubiera alrededor. Por eso, igual que el lomo (ver SelectorLomo), antes de
// subirla pasa por RecortarFoto: mismo mecanismo, cuatro esquinas libres,
// solo que aquí el rectángulo de partida ya tiene forma de libro (2/3) en
// vez de una franja fina.
export default function SelectorPortada({ abierta, libro, elegida, onCerrar, onElegir, onSubir }) {
  const { player } = useAuth()
  const [datos, setDatos] = useState(null)   // null = cargando
  const [pendiente, setPendiente] = useState(null) // File esperando recorte
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState(null)
  const archivo = useRef(null)

  useEffect(() => {
    if (!abierta) return
    let cancelado = false
    setDatos(null)
    setError(null)
    api(`/books/${libro.id}/covers`)
      .then(d => { if (!cancelado) setDatos(d) })
      .catch(() => { if (!cancelado) setError('No se han podido cargar las portadas.') })
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
      setError('No se ha podido subir la imagen.')
    } finally {
      setSubiendo(false)
    }
  }

  // Borra una portada de la galería (nunca la elegida ahora mismo: si
  // apuntaba a esta, sigue apuntando al mismo archivo — el servidor solo
  // borra el archivo si ya no lo usa nadie, ver delete_book_cover). Se quita
  // de la lista al momento, sin esperar a recargar toda la galería.
  async function borrarSubida(id) {
    try {
      await api(`/books/${libro.id}/covers/${id}`, { method: 'DELETE' })
      setDatos(d => (d ? { ...d, user_uploads: d.user_uploads.filter(u => u.id !== id) } : d))
    } catch {
      setError('No se ha podido borrar la portada.')
    }
  }

  const subidas = datos?.user_uploads || []
  const automaticas = datos?.covers || []

  return (
    <>
    <HojaInferior abierta={abierta && !pendiente} titulo="Portada" onCerrar={onCerrar}>
      <button
        onClick={() => archivo.current?.click()}
        disabled={subiendo}
        className="mb-4 h-12 w-full rounded-xl2 bg-accent text-[15px] font-semibold text-on-accent transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {subiendo ? 'Subiendo…' : 'Subir una foto'}
      </button>
      <input ref={archivo} type="file" accept="image/*" onChange={alElegirArchivo} className="hidden" />

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {datos === null && !error && (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-md bg-surface-2" />
          ))}
        </div>
      )}

      {subidas.length > 0 && (
        <Grupo titulo="Subidas por el club">
          {subidas.map(u => (
            <Opcion
              key={u.url}
              url={u.url}
              pie={u.uploaded_by ? `por ${u.uploaded_by}` : null}
              elegida={elegida === u.url}
              onElegir={() => onElegir(u.url)}
              onBorrar={u.uploaded_by_id === player?.id ? () => borrarSubida(u.id) : null}
            />
          ))}
        </Grupo>
      )}

      {automaticas.length > 0 && (
        <Grupo titulo="De Open Library">
          {automaticas.map(url => (
            <Opcion
              key={url}
              url={url}
              // La portada que ya tienes puesta puede estar guardada como una
              // copia local con otro nombre, así que no basta comparar la URL:
              // el servidor manda a qué ruta local corresponde cada una.
              elegida={elegida === url || elegida === datos?.cover_cache_map?.[url]}
              onElegir={() => onElegir(url)}
            />
          ))}
        </Grupo>
      )}

      {datos && subidas.length === 0 && automaticas.length === 0 && (
        <p className="text-sm text-ink-mute">
          Este libro no tiene portadas para elegir. Puedes subir una foto tú mismo.
        </p>
      )}
    </HojaInferior>

    {pendiente && (
      <RecortarFoto
        file={pendiente}
        titulo="Encuadra la portada"
        instrucciones="Ajusta las esquinas a la cubierta · pellizca o usa la rueda para acercar"
        proporcionInicial={2 / 3}
        onCancelar={() => setPendiente(null)}
        onConfirmar={alConfirmarRecorte}
      />
    )}
    </>
  )
}

function Grupo({ titulo, children }) {
  return (
    <section className="mb-5">
      <h4 className="mb-2.5 text-[11px] uppercase tracking-[0.14em] text-ink-mute">{titulo}</h4>
      <div className="grid grid-cols-3 gap-3">{children}</div>
    </section>
  )
}

function Opcion({ url, pie, elegida, onElegir, onBorrar }) {
  return (
    <div className="text-left">
      {/* El botón de borrar va FUERA de este, no dentro: dos <button>
          anidados es HTML inválido, y aquí además tocar la cruz no debe
          elegir también la portada. */}
      <div className="relative">
        <motion.button onClick={onElegir} whileTap={{ scale: 0.95 }} className="block w-full">
          <div className={`overflow-hidden rounded-md ring-offset-2 ring-offset-surface transition-[box-shadow] ${elegida ? 'ring-2 ring-accent' : ''}`}>
            <Cover url={url} />
          </div>
        </motion.button>
        {onBorrar && <BotonBorrarEsquina etiqueta="Borrar esta portada" onConfirmar={onBorrar} />}
      </div>
      {pie && <p className="mt-1 truncate text-[10px] text-ink-mute">{pie}</p>}
    </div>
  )
}
