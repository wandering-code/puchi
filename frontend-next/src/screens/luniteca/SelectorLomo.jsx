import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { api } from '../../platform/api'
import { useAuth } from '../../platform/auth'
import HojaInferior from './HojaInferior'
import RecortarFoto from './RecortarFoto'
import CamaraGuiada, { pedirSensores, proporcionEsperada } from './CamaraGuiada'
import { BotonBorrarEsquina } from './piezas'
import { usarAnchoLomo } from './Lomos'
import { AccionesFoto, Actual, MarcaElegida, Tanda, aparecer } from './FotoLibro'

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
  const [pendiente, setPendiente] = useState(null) // { file, deCamara } esperando recorte
  const [conCamara, setConCamara] = useState(false)
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
    if (fichero) setPendiente({ file: fichero, deCamara: false })
  }

  // La cámara propia (ver CamaraGuiada), no la del sistema: con guías para
  // que el lomo salga recto. El permiso de los sensores del nivel solo se
  // puede pedir aquí, dentro del toque.
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
  // Lo que se ve ahora en la balda: la foto elegida o, si no hay, la
  // generada. Y de dónde sale, dicho en una frase.
  const actual = elegida || generado
  const subidaActual = elegida ? subidas.find(u => u.url === elegida) : null
  const origen = !elegida
    ? (generado ? 'Generado a partir de la portada' : 'Todavía sin lomo')
    : subidaActual?.uploaded_by_id === player?.id
      ? 'Tu foto'
      : subidaActual?.uploaded_by ? `Foto de ${subidaActual.uploaded_by}` : 'Una foto elegida'
  // Las opciones, en una balda: primero la automática, luego las fotos.
  const opciones = [
    ...(generado ? [{ url: generado, valor: '', pie: 'Automático' }] : []),
    ...subidas.map(u => ({
      url: u.url,
      valor: u.url,
      pie: u.uploaded_by_id === player?.id ? 'Tuya' : (u.uploaded_by || 'Del club'),
      foto: true,
      onBorrar: u.uploaded_by_id === player?.id ? () => borrarSubida(u.id) : null,
    })),
  ]

  return (
    <>
      <HojaInferior abierta={abierta && !pendiente && !conCamara} titulo="Lomo" onCerrar={onCerrar}>
        <Actual
          muestra={actual
            ? <MiniLomo url={actual} ancho={ancho} alto={alto} altoVisto={96} foto={!!elegida} />
            : <span className="block rounded-sm border border-dashed border-line" style={{ width: ancho * 96 / alto, height: 96 }} />}
          origen={origen}
          nota={!elegida && generado ? 'Se rehace solo si cambias la portada o el tamaño del libro.' : null}
        />

        <AccionesFoto tipo="lomo" onCamara={abrirCamara} onGaleria={() => galeria.current?.click()} desactivado={subiendo} />

        {subiendo && <p className="mt-3 text-sm text-ink-mute">Subiendo…</p>}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        {datos === null && !error && (
          <Tanda titulo="Otros lomos">
            <div className="flex items-end gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-sm bg-surface-2" style={{ width: ancho * ALTO_OPCION / alto, height: ALTO_OPCION }} />
              ))}
            </div>
          </Tanda>
        )}

        {datos && (
          <Tanda titulo="Otros lomos" cuantas={opciones.length || null}>
            {/* Una balda de verdad: los lomos de pie sobre su estante. */}
            <div className="-mx-5 overflow-x-auto px-5">
              <div className="relative inline-flex min-w-full items-start gap-4 pb-1 pt-3">
                {opciones.map((o, i) => (
                  <Opcion
                    key={o.url}
                    indice={i}
                    url={o.url}
                    ancho={ancho}
                    alto={alto}
                    foto={o.foto}
                    pie={o.pie}
                    elegida={(elegida || '') === o.valor}
                    onElegir={() => onElegir(o.valor)}
                    onBorrar={o.onBorrar}
                  />
                ))}
                <span
                  className="pointer-events-none absolute inset-x-0 h-[7px] rounded-[2px]"
                  style={{ top: ALTO_OPCION + 12, background: 'linear-gradient(var(--balda-luz), var(--balda-cara) 40%, var(--balda-sombra))' }}
                  aria-hidden
                />
              </div>
            </div>
            {subidas.length === 0 && (
              <p className="mt-3 text-xs leading-relaxed text-ink-mute">
                Nadie del club ha subido todavía una foto de este lomo. La tuya, si haces una, aparecerá aquí para todos.
              </p>
            )}
          </Tanda>
        )}
      </HojaInferior>

      {/* Fuera de la hoja: mientras la cámara está abierta la hoja está
          cerrada (e `inert`), y desde la cámara se puede pasar a la galería
          o, si el navegador no deja usarla, a la cámara del sistema. */}
      <input ref={camara} type="file" accept="image/*" capture="environment" onChange={alElegirArchivo} className="hidden" />
      <input ref={galeria} type="file" accept="image/*" onChange={alElegirArchivo} className="hidden" />

      <CamaraGuiada
        abierta={conCamara}
        tipo="lomo"
        libro={libro}
        onCerrar={() => setConCamara(false)}
        onFoto={file => { setConCamara(false); setPendiente({ file, deCamara: true }) }}
        onGaleria={() => { setConCamara(false); galeria.current?.click() }}
        onCamaraSistema={() => { setConCamara(false); camara.current?.click() }}
      />

      {pendiente && (
        <RecortarFoto
          file={pendiente.file}
          titulo="Encuadra el lomo"
          instrucciones="Ajusta las esquinas al lomo · pellizca o usa la rueda para acercar"
          // De la cámara, el lomo llega centrado y con la forma del marco:
          // el rectángulo arranca ya casi encajado.
          proporcionInicial={pendiente.deCamara ? proporcionEsperada('lomo', libro) : 0.28}
          onCancelar={() => setPendiente(null)}
          onConfirmar={alConfirmarRecorte}
        />
      )}
    </>
  )
}

// El alto al que se ven los lomos entre los que elegir.
const ALTO_OPCION = 118

// Un lomo en pequeño, a `altoVisto` de alto. Si es una foto de verdad, con
// su forma real (el mismo cálculo que la balda); si es el generado, con el
// grosor que le da la balda.
function MiniLomo({ url, ancho, alto, altoVisto, foto = false }) {
  const anchoReal = usarAnchoLomo(url, ancho, alto, foto)
  const k = altoVisto / alto
  return (
    <div
      className="shrink-0 overflow-hidden rounded-[3px] bg-surface-2 shadow-[2px_0_5px_-2px_rgb(var(--color-sombra)/.45)]"
      style={{ width: anchoReal * k, height: altoVisto, backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    />
  )
}

function Opcion({ indice, url, ancho, alto, foto, pie, elegida, onElegir, onBorrar }) {
  return (
    <motion.div className="flex shrink-0 flex-col items-center" {...aparecer(indice)}>
      {/* El botón de borrar va FUERA de este, no dentro: dos <button>
          anidados es HTML inválido, y aquí además tocar la cruz no debe
          elegir también el lomo. */}
      <div className="relative">
        <motion.button onClick={onElegir} whileTap={{ scale: 0.95 }} className="relative block" aria-label={`Elegir: ${pie}`} aria-pressed={elegida}>
          <MiniLomo url={url} ancho={ancho} alto={alto} altoVisto={ALTO_OPCION} foto={foto} />
          {elegida && <MarcaElegida grupo="lomo" redondeo={3} />}
        </motion.button>
        {onBorrar && <BotonBorrarEsquina etiqueta="Borrar este lomo" onConfirmar={onBorrar} />}
      </div>
      {/* Debajo del estante. */}
      <p className={`mt-4 max-w-[72px] truncate text-center text-[11px] ${elegida ? 'font-semibold text-accent' : 'text-ink-mute'}`}>{pie}</p>
    </motion.div>
  )
}
