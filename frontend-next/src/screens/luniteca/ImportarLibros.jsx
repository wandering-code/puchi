import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import ListaPrevia, { Campo, ENTRADA, usarSugerencias } from './ListaPrevia'
import {
  AVISOS_MAPEO, CAMPOS, adivinarMapeo, completarFilas, descargarPlantilla,
  filasDeGoodreads, filasDeTabla, importarFilas, leerHoja, leerLibroDeExcel,
  marcarDuplicados, valorDeCampo,
} from './importar'
import { IconArrowLeft, IconBooks, IconTabla } from '../../ui/icons'

// Traer la biblioteca de golpe, desde un archivo: el export de Goodreads o una
// hoja de cálculo propia. Las dos formas que tenía la Puchi anterior, aquí en
// una sola pantalla porque casi todo el camino es el mismo — subir, revisar,
// añadir — y solo cambia el principio: el CSV de Goodreads tiene columnas
// fijas y conocidas, así que se lee sin preguntar nada; una hoja cualquiera hay
// que preguntar qué es cada columna.
//
// Lo que se sube no sale del navegador hasta que se toca "Añadir": el archivo
// se lee aquí, se completa contra el backend libro a libro y solo entonces se
// manda. Nada de subir el archivo entero a ningún sitio.

export default function ImportarLibros({ estanteria, onImportado }) {
  const [fuente, setFuente] = useState(null)     // null | 'goodreads' | 'excel'
  const [paso, setPaso] = useState('subir')      // subir | mapeo | previa
  const [error, setError] = useState('')
  const [leyendo, setLeyendo] = useState(false)

  // Solo del camino de la hoja de cálculo.
  const [libroExcel, setLibroExcel] = useState(null)
  const [hoja, setHoja] = useState('')
  const [encabezado, setEncabezado] = useState([])
  const [filasBrutas, setFilasBrutas] = useState([])
  const [mapeo, setMapeo] = useState({})         // índice de columna -> clave de campo

  const [filas, setFilas] = useState([])
  const [incluidas, setIncluidas] = useState({})
  const [progreso, setProgreso] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [avanceEnvio, setAvanceEnvio] = useState(null)
  const [resultados, setResultados] = useState(null)
  const { generos, carpetas } = usarSugerencias(estanteria)
  // Al salir de la revisión (o al cambiar de archivo) el completado que siga
  // en marcha tiene que parar: son cientos de peticiones, y sin esto seguirían
  // llegando parches de filas que ya no existen.
  const vigente = useRef(0)

  function volverAlPrincipio() {
    vigente.current++
    setFuente(null); setPaso('subir'); setError(''); setLibroExcel(null)
    setFilas([]); setIncluidas({}); setProgreso(null); setResultados(null); setAvanceEnvio(null)
  }

  function atras() {
    vigente.current++
    setError('')
    if (paso === 'previa') { setProgreso(null); setPaso(fuente === 'excel' ? 'mapeo' : 'subir') }
    else if (paso === 'mapeo') setPaso('subir')
    else volverAlPrincipio()
  }

  // ─── Leer el archivo ──────────────────────────────────────────────────────

  async function elegirArchivo(fichero) {
    if (!fichero) return
    setError(''); setLeyendo(true)
    try {
      if (fuente === 'goodreads') {
        const texto = await fichero.text()
        aRevisar(filasDeGoodreads(texto))
      } else {
        const libro = await leerLibroDeExcel(fichero)
        setLibroExcel(libro)
        await cargarHoja(libro, libro.SheetNames[0])
      }
    } catch (e) {
      setError(e.message || 'No se ha podido leer el archivo.')
    } finally {
      setLeyendo(false)
    }
  }

  async function cargarHoja(libro, nombre) {
    const { encabezado: cabeceras, filas: datos } = await leerHoja(libro, nombre)
    if (!datos.length) { setError('Esa hoja está vacía.'); return }
    setHoja(nombre)
    setEncabezado(cabeceras)
    setFilasBrutas(datos)
    setMapeo(adivinarMapeo(cabeceras))
    setError('')
    setPaso('mapeo')
  }

  // ─── Revisar ──────────────────────────────────────────────────────────────

  function aRevisar(crudas) {
    const marcadas = marcarDuplicados(crudas, estanteria)
    setFilas(marcadas)
    setIncluidas(Object.fromEntries(marcadas.map(f => [f.clave, !f.duplicada])))
    setResultados(null)
    setPaso('previa')
    const turno = ++vigente.current
    completarFilas(marcadas, {
      parche: (clave, parche) => setFilas(fs => fs.map(f => f.clave === clave ? { ...f, ...parche } : f)),
      avance: setProgreso,
      abortada: () => vigente.current !== turno,
    })
  }

  function confirmarMapeo() {
    if (!Object.values(mapeo).includes('title')) return
    aRevisar(filasDeTabla(filasBrutas, mapeo))
  }

  async function importar() {
    setEnviando(true); setError('')
    // El completado en marcha se corta: lo que se manda es lo que se está
    // viendo, y seguir parcheando filas mientras entran en la base de datos
    // solo cambiaría la pantalla, no lo guardado.
    vigente.current++
    setProgreso(null)
    try {
      const aMandar = filas.filter(f => incluidas[f.clave])
      const r = await importarFilas(aMandar, fuente, setAvanceEnvio)
      // Los índices que devuelve el backend son de la lista enviada, no de la
      // lista completa — para que los fallos de la pantalla de resultados
      // apunten al libro correcto, se le pasa esa misma lista.
      setFilas(aMandar)
      setResultados(r)
      onImportado?.()
    } catch (e) {
      setError(e.message || 'No se han podido añadir. Inténtalo otra vez.')
    } finally {
      setEnviando(false); setAvanceEnvio(null)
    }
  }

  // ─── Pantallas ────────────────────────────────────────────────────────────

  if (!fuente) {
    return (
      <div className="pb-2">
        <p className="mt-1 text-sm leading-relaxed text-ink-mute">
          Para traer muchos libros de una vez. Nada se guarda hasta que lo hayas revisado.
        </p>
        <Opcion
          titulo="Desde Goodreads"
          texto="El .csv que te descarga Goodreads, con tus estanterías, puntuaciones y fechas de lectura."
          onClick={() => { setFuente('goodreads'); setPaso('subir') }}
          icono={<IconBooks className="h-5 w-5" />}
        />
        <Opcion
          titulo="Desde una hoja de cálculo"
          texto="Un Excel o un .csv con las columnas que tengas. Tú dices qué es cada una."
          onClick={() => { setFuente('excel'); setPaso('subir') }}
          icono={<IconTabla className="h-5 w-5" />}
        />
      </div>
    )
  }

  return (
    <div className="pb-2">
      <button onClick={atras} className="mt-1 mb-1 flex items-center gap-1.5 text-sm text-accent">
        <IconArrowLeft className="h-4 w-4" />
        {paso === 'subir' ? 'Otra forma de importar' : 'Atrás'}
      </button>

      {paso === 'subir' && (
        <Subida
          fuente={fuente}
          leyendo={leyendo}
          onArchivo={elegirArchivo}
        />
      )}

      {paso === 'mapeo' && (
        <Mapeo
          libro={libroExcel}
          hoja={hoja}
          onHoja={nombre => cargarHoja(libroExcel, nombre)}
          encabezado={encabezado}
          filasBrutas={filasBrutas}
          mapeo={mapeo}
          setMapeo={setMapeo}
          onConfirmar={confirmarMapeo}
        />
      )}

      {paso === 'previa' && (
        <ListaPrevia
          filas={filas}
          incluidas={incluidas}
          onAlternar={clave => setIncluidas(i => ({ ...i, [clave]: !i[clave] }))}
          onTodas={valor => setIncluidas(Object.fromEntries(filas.map(f => [f.clave, valor])))}
          onParche={(clave, parche) => setFilas(fs => fs.map(f => f.clave === clave ? { ...f, ...parche } : f))}
          progreso={progreso}
          generos={generos}
          carpetas={carpetas}
          enviando={enviando}
          avanceEnvio={avanceEnvio}
          resultados={resultados}
          onImportar={importar}
          onReiniciar={volverAlPrincipio}
        />
      )}

      <AnimatePresence>
        {error && (
          <motion.p
            className="mt-3 text-sm text-danger"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Subir el archivo ────────────────────────────────────────────────────────

function Subida({ fuente, leyendo, onArchivo }) {
  const input = useRef(null)
  const [encima, setEncima] = useState(false)
  const esGoodreads = fuente === 'goodreads'

  return (
    <div>
      {esGoodreads ? (
        <div className="rounded-xl2 border border-line bg-surface p-3.5">
          <p className="text-sm font-semibold">Cómo sacar el archivo</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-ink-dim">
            <li>En Goodreads, entra en <strong>goodreads.com/review/import</strong>.</li>
            <li>Toca <strong>Export Library</strong> y espera a que prepare el archivo.</li>
            <li>Descárgalo (es un <code>.csv</code>) y súbelo aquí.</li>
          </ol>
        </div>
      ) : (
        <div className="rounded-xl2 border border-line bg-surface p-3.5">
          <p className="text-sm font-semibold">Cómo funciona</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-ink-dim">
            <li>Sube tu hoja tal cual la tengas, con las columnas que quieras y en el orden que quieras.</li>
            <li>Dices qué columna es el título, cuál el autor… Solo el título hace falta.</li>
            <li>Revisas la lista y corriges lo que haga falta antes de añadir nada.</li>
          </ol>
          <button
            onClick={descargarPlantilla}
            className="mt-3 h-10 w-full rounded-xl2 border border-line text-[13px] font-semibold text-ink-dim"
          >
            Descargar la plantilla de Puchi
          </button>
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-mute">
            Trae todas las columnas que Puchi sabe leer —incluidas el alto del libro, el precio,
            dónde lo lees y las páginas de tu edición— con sus nombres ya puestos, así que al
            subirla el mapeo se hace solo. Lleva una fila de ejemplo: bórrala y escribe encima.
          </p>
        </div>
      )}

      <div
        onDragOver={e => { e.preventDefault(); setEncima(true) }}
        onDragLeave={() => setEncima(false)}
        onDrop={e => { e.preventDefault(); setEncima(false); onArchivo(e.dataTransfer.files?.[0]) }}
        onClick={() => input.current?.click()}
        className={`mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-xl2 border border-dashed px-4 py-8 text-center transition-colors ${
          encima ? 'border-accent bg-accent-soft' : 'border-line'
        }`}
      >
        <p className="text-sm text-ink-dim">
          {leyendo
            ? 'Leyendo el archivo…'
            : esGoodreads
              ? 'Toca para elegir el .csv de Goodreads'
              : 'Toca para elegir tu Excel (.xlsx, .xls o .csv)'}
        </p>
        <p className="text-xs text-ink-mute">o arrástralo aquí</p>
        <input
          ref={input}
          type="file"
          accept={esGoodreads
            ? '.csv,text/csv'
            : '.xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'}
          className="hidden"
          onChange={e => onArchivo(e.target.files?.[0])}
        />
      </div>
    </div>
  )
}

// ─── Decir qué es cada columna ───────────────────────────────────────────────

function Mapeo({ libro, hoja, onHoja, encabezado, filasBrutas, mapeo, setMapeo, onConfirmar }) {
  const hayTitulo = Object.values(mapeo).includes('title')

  // Un ejemplo de verdad de esa columna: la primera celda con algo. Es lo que
  // hace reconocible una columna llamada "Columna 7" o "Fecha".
  function ejemplo(indice) {
    for (const fila of filasBrutas) {
      const v = fila[indice]
      if (v !== '' && v != null) return v instanceof Date ? valorDeCampo('started_at', v) : String(v)
    }
    return ''
  }

  return (
    <div>
      {libro?.SheetNames.length > 1 && (
        <Campo etiqueta="Hoja">
          <select value={hoja} onChange={e => onHoja(e.target.value)} className={ENTRADA + ' appearance-none'}>
            {libro.SheetNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </Campo>
      )}

      <p className="mt-3 text-[13px] leading-relaxed text-ink-mute">
        {encabezado.length} columnas y {filasBrutas.length} filas. Di a qué corresponde cada una —
        el título hace falta, lo demás es opcional.
      </p>

      <div className="mt-3 space-y-2">
        {encabezado.map((nombre, i) => {
          const usadas = new Set(
            Object.entries(mapeo).filter(([indice]) => Number(indice) !== i).map(([, clave]) => clave)
          )
          const muestra = ejemplo(i)
          const aviso = AVISOS_MAPEO[mapeo[i]]
          return (
            <div key={i} className="rounded-xl2 border border-line p-3">
              <p className="truncate text-sm font-semibold">{nombre}</p>
              {muestra && <p className="truncate text-xs text-ink-mute">Ej.: {muestra}</p>}
              <select
                value={mapeo[i] || ''}
                onChange={e => setMapeo(m => {
                  const siguiente = { ...m }
                  if (!e.target.value) delete siguiente[i]
                  else siguiente[i] = e.target.value
                  return siguiente
                })}
                className={ENTRADA + ' mt-2 appearance-none'}
              >
                <option value="">No importar</option>
                {CAMPOS.map(c => (
                  <option key={c.clave} value={c.clave} disabled={usadas.has(c.clave)}>
                    {c.etiqueta}{c.obligatorio ? ' *' : ''}
                  </option>
                ))}
              </select>
              {aviso && <p className="mt-2 text-[11.5px] leading-relaxed text-ink-mute">{aviso}</p>}
            </div>
          )
        })}
      </div>

      <motion.button
        onClick={onConfirmar}
        disabled={!hayTitulo}
        whileTap={{ scale: 0.98 }}
        className="mt-5 h-12 w-full rounded-xl2 bg-accent text-[15px] font-semibold text-on-accent disabled:opacity-60"
      >
        {hayTitulo ? 'Revisar los libros' : 'Falta decir cuál es el título'}
      </motion.button>
    </div>
  )
}

function Opcion({ titulo, texto, onClick, icono }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className="mt-3 flex w-full items-start gap-3 rounded-xl2 border border-line bg-surface p-3.5 text-left"
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
        {icono}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{titulo}</span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-mute">{texto}</span>
      </span>
    </motion.button>
  )
}
