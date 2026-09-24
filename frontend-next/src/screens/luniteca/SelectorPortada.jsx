import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { api } from '../../platform/api'
import { useAuth } from '../../platform/auth'
import { BotonBorrarEsquina, Cover } from './piezas'
import HojaInferior from './HojaInferior'
import RecortarFoto from './RecortarFoto'
import CamaraGuiada, { pedirSensores, proporcionEsperada } from './CamaraGuiada'
import { AccionesFoto, Actual, MarcaElegida, Tanda, aparecer } from './FotoLibro'

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
export default function SelectorPortada({ abierta, libro, elegida, onCerrar, onElegir, onSubir, onPorDefecto }) {
  const { player } = useAuth()
  const [datos, setDatos] = useState(null)   // null = cargando
  const [pendiente, setPendiente] = useState(null) // { file, deCamara } esperando recorte
  const [conCamara, setConCamara] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState(null)
  const archivo = useRef(null)
  const camaraSistema = useRef(null)

  useEffect(() => {
    if (!abierta) return
    let cancelado = false
    setDatos(null)
    setError(null)
    api(`/books/${libro.id}/covers`)
      // Quien la usa quiere saber cuál es la portada del libro (la que se ve
      // sin una propia), para enseñarla si se vuelve a ella antes de guardar.
      .then(d => { if (!cancelado) { setDatos(d); if (d.default_url !== undefined) onPorDefecto?.(d.default_url || '') } })
      .catch(() => { if (!cancelado) setError('No se han podido cargar las portadas.') })
    return () => { cancelado = true }
  }, [abierta, libro.id])

  function alElegirArchivo(ev) {
    const fichero = ev.target.files?.[0]
    ev.target.value = ''   // permite volver a elegir el mismo archivo
    if (fichero) setPendiente({ file: fichero, deCamara: false })
  }

  // Misma cámara con guías que el lomo (ver CamaraGuiada).
  function abrirCamara() {
    pedirSensores()
    setConCamara(true)
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
      const borrada = datos?.user_uploads.find(u => u.id === id)
      setDatos(d => (d ? { ...d, user_uploads: d.user_uploads.filter(u => u.id !== id) } : d))
      // Si era la elegida, se vuelve a la del libro (sin cerrar la hoja).
      if (borrada && borrada.url === elegida) onElegir('', { cerrar: false })
    } catch {
      setError('No se ha podido borrar la portada.')
    }
  }

  const subidas = datos?.user_uploads || []
  const automaticas = datos?.covers || []
  // La portada que tiene puesta ahora tu copia y de dónde sale. La que te
  // hayas elegido para tu copia puede estar guardada como copia local con
  // otro nombre: el servidor dice a qué ruta local corresponde cada una.
  const esLaElegida = url => elegida === url || elegida === datos?.cover_cache_map?.[url]
  const subidaActual = elegida ? subidas.find(u => u.url === elegida) : null
  const origen = !elegida
    ? 'La portada del libro'
    : subidaActual
      ? (subidaActual.uploaded_by_id === player?.id ? 'Tu foto' : `Foto de ${subidaActual.uploaded_by || 'alguien del club'}`)
      : automaticas.some(esLaElegida) ? 'De Open Library' : 'Una portada elegida'

  return (
    <>
    <HojaInferior abierta={abierta && !pendiente && !conCamara} titulo="Portada" onCerrar={onCerrar}>
      <Actual
        muestra={<div className="w-16"><Cover url={elegida || (datos?.default_url ?? libro.cover_url)} title={libro.title} /></div>}
        origen={origen}
        nota={elegida ? 'Solo la ves tú: el resto del club sigue con la suya.' : null}
      />

      <AccionesFoto tipo="portada" onCamara={abrirCamara} onGaleria={() => archivo.current?.click()} desactivado={subiendo} />

      {subiendo && <p className="mt-3 text-sm text-ink-mute">Subiendo…</p>}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {datos === null && !error && (
        <Tanda titulo="Otras portadas">
          <div className="grid grid-cols-3 gap-3.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-md bg-surface-2" />
            ))}
          </div>
        </Tanda>
      )}

      {subidas.length > 0 && (
        <Tanda titulo="Fotos del club" cuantas={subidas.length}>
          <div className="grid grid-cols-3 gap-3.5">
            {subidas.map((u, i) => (
              <Opcion
                key={u.url}
                indice={i}
                url={u.url}
                pie={u.uploaded_by_id === player?.id ? 'Tuya' : (u.uploaded_by || 'Del club')}
                elegida={esLaElegida(u.url)}
                onElegir={() => onElegir(u.url)}
                onBorrar={u.uploaded_by_id === player?.id ? () => borrarSubida(u.id) : null}
              />
            ))}
          </div>
        </Tanda>
      )}

      {automaticas.length > 0 && (
        <Tanda titulo="De Open Library" cuantas={automaticas.length}>
          <div className="grid grid-cols-3 gap-3.5">
            {automaticas.map((url, i) => (
              <Opcion
                key={url}
                indice={subidas.length + i}
                url={url}
                elegida={esLaElegida(url)}
                onElegir={() => onElegir(url)}
              />
            ))}
          </div>
        </Tanda>
      )}

      {datos && subidas.length === 0 && automaticas.length === 0 && (
        <p className="mt-5 text-xs leading-relaxed text-ink-mute">
          Este libro no tiene más portadas para elegir. La tuya, si haces una foto, aparecerá aquí para todo el club.
        </p>
      )}
    </HojaInferior>

    {/* Fuera de la hoja, que está cerrada (e `inert`) mientras se usa la
        cámara: desde ella se puede saltar a la galería o a la del sistema. */}
    <input ref={archivo} type="file" accept="image/*" onChange={alElegirArchivo} className="hidden" />
    <input ref={camaraSistema} type="file" accept="image/*" capture="environment" onChange={alElegirArchivo} className="hidden" />

    <CamaraGuiada
      abierta={conCamara}
      tipo="portada"
      libro={libro}
      onCerrar={() => setConCamara(false)}
      onFoto={file => { setConCamara(false); setPendiente({ file, deCamara: true }) }}
      onGaleria={() => { setConCamara(false); archivo.current?.click() }}
      onCamaraSistema={() => { setConCamara(false); camaraSistema.current?.click() }}
    />

    {pendiente && (
      <RecortarFoto
        file={pendiente.file}
        titulo="Encuadra la portada"
        instrucciones="Ajusta las esquinas a la cubierta · pellizca o usa la rueda para acercar"
        proporcionInicial={pendiente.deCamara ? proporcionEsperada('portada', libro) : 2 / 3}
        onCancelar={() => setPendiente(null)}
        onConfirmar={alConfirmarRecorte}
      />
    )}
    </>
  )
}

function Opcion({ indice, url, pie, elegida, onElegir, onBorrar }) {
  return (
    <motion.div className="text-left" {...aparecer(indice)}>
      {/* El botón de borrar va FUERA de este, no dentro: dos <button>
          anidados es HTML inválido, y aquí además tocar la cruz no debe
          elegir también la portada. */}
      <div className="relative">
        <motion.button onClick={onElegir} whileTap={{ scale: 0.95 }} className="relative block w-full" aria-pressed={elegida}>
          <Cover url={url} />
          {elegida && <MarcaElegida grupo="portada" redondeo={6} />}
        </motion.button>
        {onBorrar && <BotonBorrarEsquina etiqueta="Borrar esta portada" onConfirmar={onBorrar} />}
      </div>
      {pie && <p className={`mt-1.5 truncate text-[11px] ${elegida ? 'font-semibold text-accent' : 'text-ink-mute'}`}>{pie}</p>}
    </motion.div>
  )
}
