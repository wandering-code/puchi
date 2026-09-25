import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../../platform/api'
import ListaPrevia, { ENTRADA, usarSugerencias } from './ListaPrevia'
import { filaDeLibro, importarFilas, marcarDuplicados } from './importar'
import { IconCamara } from '../../ui/icons'

const NODO_CAMARA = 'puchi-escaner-isbn'

// Añadir libros pasando el código de barras de la contraportada por la cámara.
// El de 13 dígitos ES el ISBN, así que un escaneo es un lookup exacto — sin
// buscar por título, sin elegir entre ediciones parecidas, sin escribir nada.
//
// Escanea de seguido: la cámara no se cierra después de cada libro, se van
// acumulando y al final se revisan y se añaden todos de una vez (misma lista
// de revisión que las importaciones de archivo, ver ListaPrevia). Es lo que
// hace que valga la pena para vaciar una estantería entera, que es justo para
// lo que se hizo en la Puchi anterior.

export default function EscanerISBN({ estanteria, onImportado }) {
  const [camara, setCamara] = useState(false)
  const [filas, setFilas] = useState([])
  const [incluidas, setIncluidas] = useState({})
  const [aviso, setAviso] = useState(null)       // { texto, tono } — lo último que ha pasado
  const [enviando, setEnviando] = useState(false)
  const [avanceEnvio, setAvanceEnvio] = useState(null)
  const [resultados, setResultados] = useState(null)
  const { generos, carpetas } = usarSugerencias(estanteria)
  // Los ISBN de esta sesión, para no volver a consultar (ni volver a añadir) el
  // mismo libro cuando la cámara lo relee al mover el siguiente delante.
  const vistos = useRef(new Set())

  async function alDetectar(isbn) {
    if (vistos.current.has(isbn)) return
    vistos.current.add(isbn)
    setAviso({ texto: 'Buscando…', tono: 'neutro' })
    try {
      const libro = await api(`/books/isbn/${isbn}`)
      anadirFila(filaDeLibro(libro, { isbn }))
      setAviso({ texto: `Añadido: ${libro.title}`, tono: 'bien' })
    } catch (err) {
      // No encontrado no es un callejón sin salida: entra igualmente con su
      // ISBN y sin título, para poder escribirlo en la revisión en vez de
      // perder el libro que se acaba de escanear (y tener que buscar el
      // código otra vez).
      anadirFila(filaDeLibro({ isbn }, { completado: 'error' }))
      setAviso({
        texto: err.status === 404
          ? `El ${isbn} no está en Open Library — ponle el título abajo`
          : 'No se ha podido consultar. Prueba otra vez.',
        tono: 'aviso',
      })
    }
  }

  function anadirFila(fila) {
    const [marcada] = marcarDuplicados([fila], estanteria)
    setFilas(fs => [marcada, ...fs])
    // Un libro sin título no se puede guardar (lo rechaza el backend), así que
    // entra desmarcado: hay que ponerle nombre para que cuente.
    setIncluidas(i => ({ ...i, [marcada.clave]: !marcada.duplicada && !!marcada.title }))
  }

  async function importar() {
    setEnviando(true)
    try {
      const aMandar = filas.filter(f => incluidas[f.clave])
      const r = await importarFilas(aMandar, 'scan', setAvanceEnvio)
      setFilas(aMandar)
      setResultados(r)
      onImportado?.()
    } catch (e) {
      setAviso({ texto: e.message || 'No se han podido añadir.', tono: 'aviso' })
    } finally {
      setEnviando(false); setAvanceEnvio(null)
    }
  }

  function reiniciar() {
    vistos.current = new Set()
    setFilas([]); setIncluidas({}); setResultados(null); setAviso(null)
  }

  return (
    <div className="pb-2">
      {!resultados && (
        <>
          <AnimatePresence initial={false} mode="wait">
            {camara
              ? <Camara key="camara" onDetectar={alDetectar} onCerrar={() => setCamara(false)} onError={texto => { setCamara(false); setAviso({ texto, tono: 'aviso' }) }} />
              : (
                <motion.div key="reposo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="mt-1 text-sm leading-relaxed text-ink-mute">
                    Apunta al código de barras de la contraportada, el de 13 dígitos. Puedes ir
                    pasando libros uno detrás de otro: se van juntando abajo y los añades todos al
                    final.
                  </p>
                  <motion.button
                    onClick={() => setCamara(true)}
                    whileTap={{ scale: 0.98 }}
                    className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl2 bg-accent text-[15px] font-semibold text-on-accent"
                  >
                    <IconCamara className="h-5 w-5" />
                    {filas.length ? 'Seguir escaneando' : 'Abrir la cámara'}
                  </motion.button>
                </motion.div>
              )}
          </AnimatePresence>

          <AMano onIsbn={alDetectar} />

          <AnimatePresence>
            {aviso && (
              <motion.p
                key={aviso.texto}
                initial={{ opacity: 0, transform: 'translateY(-4px)' }}
                animate={{ opacity: 1, transform: 'translateY(0px)' }}
                exit={{ opacity: 0 }}
                className={`mt-3 text-sm ${aviso.tono === 'aviso' ? 'text-danger' : aviso.tono === 'bien' ? 'text-read' : 'text-ink-mute'}`}
              >
                {aviso.texto}
              </motion.p>
            )}
          </AnimatePresence>
        </>
      )}

      {filas.length > 0 && (
        <div className="mt-4">
          <ListaPrevia
            filas={filas}
            incluidas={incluidas}
            onAlternar={clave => setIncluidas(i => ({ ...i, [clave]: !i[clave] }))}
            onTodas={valor => setIncluidas(Object.fromEntries(filas.map(f => [f.clave, valor])))}
            onParche={(clave, parche) => setFilas(fs => fs.map(f => f.clave === clave ? { ...f, ...parche } : f))}
            generos={generos}
            carpetas={carpetas}
            deDonde="escaneados"
            etiquetaReinicio="Escanear más libros"
            enviando={enviando}
            avanceEnvio={avanceEnvio}
            resultados={resultados}
            onImportar={importar}
            onReiniciar={reiniciar}
          />
        </div>
      )}
    </div>
  )
}

// ─── La cámara ───────────────────────────────────────────────────────────────

function Camara({ onDetectar, onCerrar, onError }) {
  const [arrancando, setArrancando] = useState(true)
  const ultimo = useRef({ codigo: null, cuando: 0 })
  // El callback de la librería se registra una vez y vive lo que viva la
  // cámara, así que tiene que leer SIEMPRE el onDetectar de ahora y no el del
  // primer render — si no, cada escaneo llamaría a una versión congelada que
  // ve la lista de libros vacía.
  const detectar = useRef(onDetectar)
  detectar.current = onDetectar

  useEffect(() => {
    // getUserMedia solo existe en un contexto seguro. En local eso es HTTPS o
    // localhost: abriendo el dev server por la IP de la LAN (que es como se
    // prueba desde el móvil, ver la sección 10 de CLAUDE.md) no hay cámara
    // posible, y sin este aviso lo que se ve es un permiso que nunca llega.
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      onError('Aquí no hay cámara disponible: hace falta HTTPS (o abrirlo en el propio ordenador). Escribe el ISBN a mano.')
      return
    }
    let cancelado = false
    let escaner = null
    ;(async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
        if (cancelado) return
        escaner = new Html5Qrcode(NODO_CAMARA, {
          // Solo códigos de libro: un QR o un código de otra cosa no tiene
          // nada que buscar aquí, y cuantos menos formatos, más rápido lee.
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
          verbose: false,
        })
        await escaner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          texto => {
            // El mismo código se sigue "leyendo" mientras la cámara enfoca el
            // mismo libro: sin este margen, un solo código dispara la búsqueda
            // decenas de veces por segundo.
            const ahora = Date.now()
            if (ultimo.current.codigo === texto && ahora - ultimo.current.cuando < 2500) return
            ultimo.current = { codigo: texto, cuando: ahora }
            detectar.current(texto.trim())
          },
          () => {},   // "en este fotograma no se ve ningún código": constante, se ignora
        )
        if (!cancelado) setArrancando(false)
      } catch {
        if (!cancelado) onError('No se ha podido abrir la cámara. Mira los permisos del navegador, o escribe el ISBN a mano.')
      }
    })()

    return () => {
      cancelado = true
      escaner?.stop().then(() => escaner.clear()).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="relative mt-1 min-h-[220px] overflow-hidden rounded-xl2 bg-black">
        <div id={NODO_CAMARA} className="w-full [&_video]:!w-full" />
        {arrancando && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
            Abriendo la cámara…
          </p>
        )}
      </div>
      <button
        onClick={onCerrar}
        className="mt-3 h-11 w-full rounded-xl2 border border-accent-line bg-accent-soft text-sm font-semibold text-accent"
      >
        Terminar de escanear
      </button>
    </motion.div>
  )
}

// Misma vía que un escaneo, para cuando no hay cámara (o el código está
// borrado): se escribe el ISBN y se busca igual.
function AMano({ onIsbn }) {
  const [texto, setTexto] = useState('')
  const isbn = texto.replace(/[^0-9Xx]/g, '')

  function enviar(ev) {
    ev.preventDefault()
    if (isbn.length < 8) return
    onIsbn(isbn)
    setTexto('')
  }

  return (
    <form onSubmit={enviar} className="mt-3 flex gap-2">
      <input
        value={texto}
        onChange={e => setTexto(e.target.value)}
        placeholder="O escribe el ISBN a mano"
        inputMode="numeric"
        enterKeyHint="search"
        className={ENTRADA + ' h-12 flex-1'}
      />
      <button
        type="submit"
        disabled={isbn.length < 8}
        className="h-12 shrink-0 rounded-xl2 border border-accent-line px-4 text-sm font-semibold text-accent disabled:opacity-50"
      >
        Buscar
      </button>
    </form>
  )
}
