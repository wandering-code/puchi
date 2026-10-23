import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { api } from '../../platform/api'
import { FORMATO_LABEL, STATUS_LABEL, subirLomo, subirPortada } from './shelf'
import { Cover } from './piezas'
import { CamposFecha } from './editores'
import { RellenarDatos, TamanoLibro } from './BookEditForm'
import { Chip, usarSugerencias } from './ListaPrevia'
import { TARJETA_TENIDA, usarTinteDePortada } from './colorPortada'
import { medidas, usarAnchoLomo } from './Lomos'
import HojaInferior, { useHoja } from './HojaInferior'
import RecortarFoto from './RecortarFoto'
import CamaraGuiada, { pedirSensores, proporcionEsperada } from './CamaraGuiada'
import { AccionesFoto } from './FotoLibro'
import { useDeshacerAlta } from './deshacerAlta'
import { IconChevron } from '../../ui/icons'
import Desplegable from '../../ui/Desplegable'
import { LLEGADA, enCss } from '../../ui/curvas'

// Dar de alta un libro a mano: para lo que la búsqueda no encuentra —
// ediciones raras, libros que no están en Open Library, o cosas que no son
// libros al uso.
//
// Se pueden poner TODOS los datos que tiene un libro en Puchi, no solo los
// cinco de identificarlo: la portada, el lomo, la sinopsis, el ISBN, el alto,
// y los que son de tu copia (puntuación, carpeta, precio, dónde lo lees,
// notas...). Antes de esto un libro dado de alta a mano nacía pelado y había
// que ir a su ficha a completarlo campo a campo, aunque los tuvieras todos
// delante en el momento de añadirlo; los importadores en bloque sí los traían
// (ver CAMPOS en importar.js), así que el alta de uno era la única puerta por
// la que no cabían.
//
// Lo que no es imprescindible va plegado: el formulario se abre con lo de
// siempre a la vista y lo demás a un toque, para que añadir un libro rápido
// siga siendo escribir el título y darle a añadir.
const VACIO = {
  // del libro (catálogo compartido con el club)
  title: '', author: '', genre: '', year: '', num_pages: '',
  isbn: '', synopsis: '', height_mm: '', cover_url: '',
  // de tu copia
  status: 'want_to_read', started_at: '', finished_at: '', rating: '',
  times_read: '', current_page: '', reading_format: '',
  custom_total_pages: '', ereader_total_pages: '', folder: '', price: '', notes: '',
}

// Los campos que el botón de rellenar puede traer aquí. Dos más que en la
// ficha de un libro guardado (ver RellenarDatos): en un alta el ISBN y la
// portada todavía están en blanco, así que sí hay dónde ponerlos.
const A_RELLENAR = ['author', 'genre', 'synopsis', 'year', 'num_pages', 'isbn', 'cover_url']

const num = (v) => (v === '' || v == null ? null : Number(v))

export default function AltaManual({ onAnadido, onHecho, alClub, estanteria }) {
  const avisarAlta = useDeshacerAlta()
  const [datos, setDatos] = useState(VACIO)
  // Las fotos no se suben hasta que el libro existe (la galería de portadas y
  // lomos cuelga de /books/{id}), así que hasta entonces se quedan aquí: el
  // recorte ya hecho y una URL local para verlo.
  const [fotoPortada, setFotoPortada] = useState(null)
  const [fotoLomo, setFotoLomo] = useState(null)
  const [recorte, setRecorte] = useState(null)   // { file, cual } esperando encuadre
  // Qué bloques están abiertos (#85). Lo que hace falta casi siempre empieza
  // abierto; lo demás, plegado, como antes.
  const [abiertos, setAbiertos] = useState({ basico: true, libro: false, estanteria: true, copia: false })
  const alternar = id => setAbiertos(a => ({ ...a, [id]: !a[id] }))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const primero = useRef(null)
  const hojaPortada = useHoja()
  const hojaLomo = useHoja()
  const { generos, carpetas } = usarSugerencias(estanteria)

  const set = (clave) => (ev) => setDatos(d => ({ ...d, [clave]: ev.target.value }))
  const entero = (clave, max = 5) => (ev) =>
    setDatos(d => ({ ...d, [clave]: ev.target.value.replace(/\D/g, '').slice(0, max) }))

  // Un libro propuesto al club no tiene estado ni fechas que elegir: entra
  // siempre como propuesta, y cuándo se empieza y se termina lo pone el admin
  // desde la ficha cuando toca. Así que en el club esas partes del formulario
  // —y todas las de "tu copia", que ahí no existe— no salen.
  const llevaInicio = !alClub && ['reading', 'read', 'dropped'].includes(datos.status)
  const llevaFin = !alClub && ['read', 'dropped'].includes(datos.status)

  // La portada y el lomo, tal como se van a ver en la balda: el hueco sale de
  // los datos que lleve el formulario AHORA (el alto elegido, las páginas),
  // igual que en la ficha, para que elegir "Tapa dura" se note en el momento.
  const mm = num(datos.height_mm)
  const { ancho: anchoBase, alto: altoLomo } = medidas({
    book: { title: datos.title, author: datos.author, height_mm: mm, num_pages: num(datos.num_pages) },
    custom_total_pages: num(datos.custom_total_pages),
    ereader_total_pages: num(datos.ereader_total_pages),
  })
  const anchoLomo = usarAnchoLomo(fotoLomo?.url, anchoBase, altoLomo)

  function ponerFoto(cual, blob) {
    const url = URL.createObjectURL(blob)
    const guardar = cual === 'portada' ? setFotoPortada : setFotoLomo
    guardar(previa => { if (previa) URL.revokeObjectURL(previa.url); return { blob, url } })
  }

  function quitarFoto(cual) {
    const guardar = cual === 'portada' ? setFotoPortada : setFotoLomo
    guardar(previa => { if (previa) URL.revokeObjectURL(previa.url); return null })
  }

  // Lo que no cabe en el alta: las fotos (necesitan el libro ya creado para
  // subirse) y los datos que son de TU copia, no del libro — el servidor solo
  // los acepta editando la entrada (ver ShelfUpdateRequest en main.py).
  //
  // Un fallo aquí no deshace el alta ni se queda a medias avisando: el libro
  // YA está en la estantería, así que dejar el formulario abierto con un error
  // solo llevaría a volver a darle a "Añadir" y recibir un 409. Se añade lo
  // que haya entrado y lo que falte se termina en la ficha.
  async function completarCopia(entrada) {
    const parche = {}
    if (llevaInicio && datos.started_at) parche.started_at = datos.started_at
    if (llevaFin && datos.finished_at) parche.finished_at = datos.finished_at
    if (datos.rating) parche.rating = Number(datos.rating)
    if (datos.times_read) parche.times_read = Number(datos.times_read)
    if (datos.current_page) parche.current_page = Number(datos.current_page)
    if (datos.reading_format) parche.reading_format = datos.reading_format
    if (datos.custom_total_pages) parche.custom_total_pages = Number(datos.custom_total_pages)
    if (datos.ereader_total_pages) parche.ereader_total_pages = Number(datos.ereader_total_pages)
    if (datos.folder.trim()) parche.folder = datos.folder.trim()
    if (datos.price) parche.price = Number(datos.price.replace(',', '.'))
    if (datos.notes.trim()) parche.notes = datos.notes.trim()
    try {
      if (fotoPortada) parche.cover_url = await subirPortada(entrada.book.id, fotoPortada.blob)
      if (fotoLomo) parche.spine_url = await subirLomo(entrada.book.id, fotoLomo.blob)
    } catch { /* sin foto, con el libro ya dentro */ }
    if (!Object.keys(parche).length) return entrada
    try {
      return await api(`/shelf/personal/${entrada.id}`, { method: 'PATCH', body: parche })
    } catch {
      return entrada
    }
  }

  async function guardar(ev) {
    ev.preventDefault()
    if (!datos.title.trim()) {
      setError('El título es lo único imprescindible')
      setAbiertos(a => ({ ...a, basico: true }))
      primero.current?.focus()
      return
    }
    setGuardando(true); setError(null)
    // Lo del libro va en el alta misma; sin open_lib_key aunque el botón de
    // rellenar haya encontrado el libro fuera: un alta a mano crea SU libro,
    // y mandar la clave de Open Library haría que el servidor reutilizara el
    // que ya hubiera con esa clave, descartando lo que se acaba de escribir.
    const libro = {
      title: datos.title.trim(),
      author: datos.author.trim() || null,
      genre: datos.genre.trim() || null,
      year: num(datos.year),
      num_pages: num(datos.num_pages),
      isbn: datos.isbn.trim() || null,
      synopsis: datos.synopsis.trim() || null,
      height_mm: mm,
      cover_url: datos.cover_url || null,
    }
    try {
      if (alClub) {
        let entrada = await api('/shelf/club', { method: 'POST', body: libro })
        // El libro nace sin portada, así que la foto subida pasa a ser la
        // suya (lo decide el servidor, ver POST /books/{id}/cover) — la
        // estantería del club es compartida y no tiene copia de nadie donde
        // guardarla aparte.
        if (fotoPortada) {
          const url = await subirPortada(entrada.book.id, fotoPortada.blob)
          entrada = { ...entrada, book: { ...entrada.book, cover_url: url } }
        }
        onAnadido(entrada)
        onHecho()
        return
      }
      const entrada = await api('/shelf/personal', {
        method: 'POST',
        body: { ...libro, status: datos.status, origin: 'search' },
      })
      const completa = await completarCopia(entrada)
      onAnadido(completa)
      avisarAlta(completa)
      onHecho()
    } catch (err) {
      setError(err.status === 409 && alClub
        ? 'Ese libro ya está en la estantería del club'
        : (err.message || 'No se ha podido añadir'))
      setGuardando(false)
    }
  }

  const portada = fotoPortada?.url || datos.cover_url
  // Lo que ya se sabe del libro, para dar forma al marco de la cámara.
  const libroParaFoto = { num_pages: num(datos.num_pages), height_mm: mm, cover_url: portada }
  // El libro que se está creando toma el color de su portada en cuanto la
  // tiene, como las tarjetas de la búsqueda (#85).
  const tinte = usarTinteDePortada(portada)

  return (
    <>
    <form onSubmit={guardar} className="pb-2">
      <div style={tinte} className={`${TARJETA_TENIDA} flex items-end gap-4 p-3`}>
        <motion.button
          type="button"
          onClick={hojaPortada.abrir}
          whileTap={{ scale: 0.96 }}
          className="w-24 shrink-0"
          aria-label="Poner una portada"
        >
          <Cover url={portada} title={datos.title} />
        </motion.button>
        {!alClub && (
          <motion.button
            type="button"
            onClick={hojaLomo.abrir}
            whileTap={{ scale: 0.96 }}
            className="shrink-0 overflow-hidden rounded-sm border border-dashed border-line bg-surface-2"
            style={{ width: anchoLomo, height: altoLomo }}
            aria-label="Poner una foto del lomo"
          >
            {fotoLomo && (
              <div className="h-full w-full" style={{ backgroundImage: `url(${fotoLomo.url})`, backgroundSize: 'cover' }} />
            )}
          </motion.button>
        )}
        <p className="text-xs leading-relaxed text-ink-mute">
          {alClub
            ? 'Toca el hueco para hacerle una foto a la portada.'
            : 'Toca los huecos para hacerles una foto. Ninguna hace falta: sin lomo propio se genera uno a partir de la portada.'}
        </p>
      </div>

      <Bloque
        titulo="Lo básico"
        resumen={resumen([datos.title.trim(), datos.author.trim()], 'Título, autor, género, año y páginas')}
        abierto={abiertos.basico}
        onAlternar={() => alternar('basico')}
      >
      <Campo etiqueta="Título">
        <input ref={primero} value={datos.title} onChange={set('title')} className={ENTRADA} />
      </Campo>
      <Campo etiqueta="Autor">
        <input value={datos.author} onChange={set('author')} className={ENTRADA} />
      </Campo>

      {/* Después del título y el autor porque es con eso con lo que busca:
          antes de escribirlos no tiene nada que preguntar. */}
      <RellenarDatos borrador={datos} setBorrador={setDatos} campos={A_RELLENAR} soloHuecos />

      <Campo etiqueta="Género">
        <input value={datos.genre} onChange={set('genre')} placeholder="Sin género" className={ENTRADA} />
        {/* Los géneros que ya usas, para tocarlos en vez de escribirlos y no
            acabar con "Novela", "novela" y "Novelas" como tres géneros. */}
        {generos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {generos.map(g => (
              <Chip key={g} activo={datos.genre === g} onClick={() => setDatos(d => ({ ...d, genre: g }))}>{g}</Chip>
            ))}
          </div>
        )}
      </Campo>

      <div className="flex gap-3">
        <Campo etiqueta="Año" className="flex-1">
          <input value={datos.year} onChange={entero('year', 4)} inputMode="numeric" placeholder="—" className={ENTRADA} />
        </Campo>
        <Campo etiqueta="Páginas" className="flex-1">
          <input value={datos.num_pages} onChange={entero('num_pages')} inputMode="numeric" placeholder="—" className={ENTRADA} />
        </Campo>
      </div>

      </Bloque>

      <Bloque
        titulo="Más datos del libro"
        resumen={resumen([datos.isbn && 'ISBN', mm && 'tamaño', datos.synopsis.trim() && 'sinopsis'], 'ISBN, tamaño y sinopsis', 'Con ')}
        abierto={abiertos.libro}
        onAlternar={() => alternar('libro')}
      >
        <Campo etiqueta="ISBN">
          <input
            value={datos.isbn}
            // Un ISBN son dígitos y como mucho una X final (mismo criterio que
            // aIsbn() en importar.js): lo demás que se pegue sobra.
            onChange={ev => setDatos(d => ({ ...d, isbn: ev.target.value.replace(/[^0-9Xx]/g, '').slice(0, 13) }))}
            inputMode="numeric" placeholder="—" className={ENTRADA}
          />
        </Campo>
        <Campo etiqueta="Tamaño">
          <TamanoLibro mm={mm} onElegir={v => setDatos(d => ({ ...d, height_mm: v == null ? '' : String(v) }))} />
        </Campo>
        <Campo etiqueta="Sinopsis">
          <textarea
            value={datos.synopsis}
            onChange={set('synopsis')}
            rows={6}
            className={ENTRADA + ' h-auto resize-none py-3 leading-relaxed'}
          />
        </Campo>
      </Bloque>

      {!alClub && (
        <Bloque
          titulo="En tu estantería"
          resumen={STATUS_LABEL[datos.status]}
          abierto={abiertos.estanteria}
          onAlternar={() => alternar('estanteria')}
        >
        <Campo etiqueta="Cómo entra">
          <PastillasEstado estado={datos.status} onElegir={id => setDatos(d => ({ ...d, status: id }))} />
        </Campo>

        {/* Las fechas que tienen sentido para el estado elegido, y solo esas:
            un libro por leer no tiene ninguna, uno que estás leyendo tiene
            cuándo lo empezaste, y uno leído o dropeado tiene las dos. Se pueden
            dejar en blanco — se guarda lo que pongas. */}
        <Desplegable abierto={llevaInicio}>
          <Campo etiqueta="Empezado">
            <CamposFecha value={datos.started_at} onChange={v => setDatos(d => ({ ...d, started_at: v }))} />
          </Campo>
        </Desplegable>
        <Desplegable abierto={llevaFin}>
          <Campo etiqueta="Terminado">
            <CamposFecha value={datos.finished_at} onChange={v => setDatos(d => ({ ...d, finished_at: v }))} />
          </Campo>
        </Desplegable>
        </Bloque>
      )}

      {!alClub && (
        <Bloque
          titulo="Tu copia"
          resumen={resumen([
            datos.rating && `${String(datos.rating).replace('.', ',')} ★`,
            datos.reading_format && FORMATO_LABEL[datos.reading_format],
            datos.current_page && `pág. ${datos.current_page}`,
            datos.folder.trim(),
            datos.price && `${datos.price} €`,
            datos.notes.trim() && 'notas',
          ], 'Puntuación, formato, páginas, precio, carpeta y notas')}
          abierto={abiertos.copia}
          onAlternar={() => alternar('copia')}
        >
          <Campo etiqueta="Puntuación">
            <select
              value={datos.rating}
              onChange={set('rating')}
              className={ENTRADA + ' appearance-none'}
            >
              <option value="">Sin puntuar</option>
              {[5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5].map(n => (
                <option key={n} value={n}>{String(n).replace('.', ',')} ★</option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Dónde lo lees">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(FORMATO_LABEL).map(([id, texto]) => (
                <Chip
                  key={id}
                  activo={datos.reading_format === id}
                  onClick={() => setDatos(d => ({ ...d, reading_format: d.reading_format === id ? '' : id }))}
                >
                  {texto}
                </Chip>
              ))}
            </div>
          </Campo>

          {/* La paginación de TU edición: la del libro compartido es la de la
              ficha, y la tuya puede no ser esa (otra editorial, el eReader). */}
          <Desplegable abierto={datos.reading_format === 'fisico' || datos.reading_format === 'ambos'}>
            <Campo etiqueta="Páginas de tu edición">
              <input value={datos.custom_total_pages} onChange={entero('custom_total_pages')} inputMode="numeric" placeholder={datos.num_pages || '—'} className={ENTRADA} />
            </Campo>
          </Desplegable>
          <Desplegable abierto={datos.reading_format === 'ereader' || datos.reading_format === 'ambos'}>
            <Campo etiqueta="Páginas en el eReader">
              <input value={datos.ereader_total_pages} onChange={entero('ereader_total_pages')} inputMode="numeric" placeholder="—" className={ENTRADA} />
            </Campo>
          </Desplegable>

          <div className="flex gap-3">
            <Campo etiqueta="Página actual" className="flex-1">
              <input value={datos.current_page} onChange={entero('current_page')} inputMode="numeric" placeholder="—" className={ENTRADA} />
            </Campo>
            <Campo etiqueta="Veces leído" className="flex-1">
              <input value={datos.times_read} onChange={entero('times_read', 2)} inputMode="numeric" placeholder="—" className={ENTRADA} />
            </Campo>
          </div>

          <div className="flex gap-3">
            <Campo etiqueta="Precio (€)" className="flex-1">
              <input
                value={datos.price}
                onChange={ev => setDatos(d => ({ ...d, price: ev.target.value.replace(/[^\d,]/g, '').slice(0, 7) }))}
                inputMode="decimal" placeholder="—" className={ENTRADA}
              />
            </Campo>
            <Campo etiqueta="Carpeta" className="flex-1">
              <input value={datos.folder} onChange={set('folder')} placeholder="Sin carpeta" className={ENTRADA} />
            </Campo>
          </div>
          {carpetas.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {carpetas.map(c => (
                <Chip key={c} activo={datos.folder === c} onClick={() => setDatos(d => ({ ...d, folder: c }))}>{c}</Chip>
              ))}
            </div>
          )}

          <Campo etiqueta="Notas">
            <textarea
              value={datos.notes}
              onChange={set('notes')}
              rows={3}
              className={ENTRADA + ' h-auto resize-none py-3 leading-relaxed'}
            />
          </Campo>
        </Bloque>
      )}

      <Desplegable abierto={!!error}>
        <p className="pt-3 text-sm text-danger">{error}</p>
      </Desplegable>

      <motion.button
        type="submit"
        disabled={guardando}
        whileTap={{ scale: 0.98 }}
        className="mt-5 h-12 w-full rounded-xl2 bg-accent text-[15px] font-semibold text-on-accent disabled:opacity-60"
      >
        {guardando
          ? (alClub ? 'Proponiendo…' : 'Añadiendo…')
          : (alClub ? 'Proponer al club' : 'Añadir a mi estantería')}
      </motion.button>
    </form>

      <HojaFoto
        hoja={hojaPortada}
        tipo="portada"
        libro={libroParaFoto}
        titulo="Portada"
        ayuda="Una foto de la cubierta, como la tengas en la mano — al aceptar podrás encuadrarla."
        hayFoto={!!fotoPortada}
        onArchivo={(file, deCamara) => setRecorte({ file, cual: 'portada', deCamara })}
        onQuitar={() => quitarFoto('portada')}
      />
      <HojaFoto
        hoja={hojaLomo}
        tipo="lomo"
        libro={libroParaFoto}
        titulo="Lomo"
        ayuda="Una foto del lomo, el canto que se ve en la balda. Si no pones ninguna se genera uno a partir de la portada."
        hayFoto={!!fotoLomo}
        onArchivo={(file, deCamara) => setRecorte({ file, cual: 'lomo', deCamara })}
        onQuitar={() => quitarFoto('lomo')}
      />

      {/* Mismo encuadre a mano que en la ficha (ver SelectorPortada y
          SelectorLomo): una foto de un libro de verdad nunca sale ya recortada
          a la forma que hace falta. Solo cambia con qué rectángulo se abre.
          Fuera del <form> a propósito: un <button> sin `type` dentro de un
          formulario lo ENVÍA, así que encuadrar una foto daría de alta el
          libro a medio rellenar. Las dos hojas de arriba son portales, así
          que ya están fuera por su cuenta. */}
      {recorte && (
        <RecortarFoto
          file={recorte.file}
          titulo={recorte.cual === 'portada' ? 'Encuadra la portada' : 'Encuadra el lomo'}
          instrucciones={recorte.cual === 'portada'
            ? 'Ajusta las esquinas a la cubierta · pellizca o usa la rueda para acercar'
            : 'Ajusta las esquinas al lomo · pellizca o usa la rueda para acercar'}
          proporcionInicial={recorte.deCamara
            ? proporcionEsperada(recorte.cual, libroParaFoto)
            : (recorte.cual === 'portada' ? 2 / 3 : 0.28)}
          onCancelar={() => setRecorte(null)}
          onConfirmar={blob => { ponerFoto(recorte.cual, blob); setRecorte(null) }}
        />
      )}
    </>
  )
}

// Elegir de dónde sale la foto. Las mismas dos puertas que el selector de
// lomos de la ficha —la cámara y la galería—, porque en el móvil no son lo
// mismo: el libro está delante mientras lo das de alta.
function HojaFoto({ hoja, tipo, libro, titulo, ayuda, hayFoto, onArchivo, onQuitar }) {
  const camara = useRef(null)
  const galeria = useRef(null)
  const [conCamara, setConCamara] = useState(false)

  function alElegirArchivo(ev) {
    const fichero = ev.target.files?.[0]
    ev.target.value = ''   // permite volver a elegir el mismo archivo
    if (!fichero) return
    hoja.cerrar()
    onArchivo(fichero, false)
  }

  // La cámara con guías (ver CamaraGuiada). El permiso de los sensores del
  // nivel solo se puede pedir dentro del toque.
  function abrirCamara() {
    pedirSensores()
    hoja.cerrar()
    setConCamara(true)
  }

  return (
    <>
    <HojaInferior abierta={hoja.abierta} titulo={titulo} onCerrar={hoja.cerrar}>
      <p className="mb-4 text-sm leading-relaxed text-ink-mute">{ayuda}</p>
      <AccionesFoto tipo={tipo} onCamara={abrirCamara} onGaleria={() => galeria.current?.click()} />

      {hayFoto && (
        <button
          type="button"
          onClick={() => { hoja.cerrar(); onQuitar() }}
          className="mt-3 h-11 w-full rounded-xl2 border border-line text-sm text-ink-dim"
        >
          Quitar la foto
        </button>
      )}
    </HojaInferior>

    {/* Fuera de la hoja, que está cerrada (e `inert`) mientras se usa la
        cámara: desde ella se puede saltar a la galería o a la del sistema. */}
    <input ref={camara} type="file" accept="image/*" capture="environment" onChange={alElegirArchivo} className="hidden" />
    <input ref={galeria} type="file" accept="image/*" onChange={alElegirArchivo} className="hidden" />

    <CamaraGuiada
      abierta={conCamara}
      tipo={tipo}
      libro={libro}
      onCerrar={() => setConCamara(false)}
      onFoto={file => { setConCamara(false); onArchivo(file, true) }}
      onGaleria={() => { setConCamara(false); galeria.current?.click() }}
      onCamaraSistema={() => { setConCamara(false); camara.current?.click() }}
    />
    </>
  )
}

// Cada grupo de campos en su bloque, como los de Inicio (#85), y todos se
// pueden plegar. Plegado dice lo que lleva puesto, para no tener que abrirlo
// a mirar. El despliegue va en CSS (ui/Desplegable): lo hace el navegador a
// la frecuencia de la pantalla, y no Motion desde JavaScript, que en Safari
// va a 60.
function Bloque({ titulo, resumen, abierto, onAlternar, children }) {
  return (
    <section className={`mt-3 overflow-hidden rounded-xl3 border bg-surface transition-colors ${abierto ? 'border-accent-line' : 'border-line'}`}>
      <button type="button" onClick={onAlternar} aria-expanded={abierto} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[16px] font-bold leading-tight tracking-[-0.01em]">{titulo}</span>
          {resumen && <span className="mt-0.5 block truncate text-[12.5px] text-ink-dim">{resumen}</span>}
        </span>
        <IconChevron className={`h-4 w-4 shrink-0 text-ink-mute transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`} />
      </button>
      <Desplegable abierto={abierto}>
        <div className="-mt-2 px-4 pb-4">{children}</div>
      </Desplegable>
    </section>
  )
}

// El estado con el que entra. La pastilla de fondo se desliza hasta el
// elegido, como antes, pero la mueve el navegador en CSS (a la frecuencia de
// la pantalla) en vez de Motion con layoutId, que en Safari va a 60. Se mide
// dónde cae el botón elegido, también si las pastillas saltan de línea.
const ESTADOS = ['want_to_read', 'reading', 'read', 'dropped']

function PastillasEstado({ estado, onElegir }) {
  const caja = useRef(null)
  const botones = useRef({})
  const [sitio, setSitio] = useState(null)
  const [conTransicion, setConTransicion] = useState(false)

  useLayoutEffect(() => {
    const medir = () => {
      const b = botones.current[estado]
      if (b) setSitio({ x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight })
    }
    medir()
    const ro = new ResizeObserver(medir)
    if (caja.current) ro.observe(caja.current)
    return () => ro.disconnect()
  }, [estado])
  // La primera vez se planta en su sitio; a partir de ahí, se desliza.
  useEffect(() => {
    if (!sitio || conTransicion) return
    const id = requestAnimationFrame(() => setConTransicion(true))
    return () => cancelAnimationFrame(id)
  }, [sitio, conTransicion])

  const curva = enCss(LLEGADA)
  return (
    <div ref={caja} className="relative flex flex-wrap gap-2">
      {sitio && (
        <span
          aria-hidden
          className="absolute left-0 top-0 rounded-full bg-accent-soft"
          style={{
            width: sitio.w, height: sitio.h,
            transform: `translate(${sitio.x}px, ${sitio.y}px)`,
            transition: conTransicion ? `transform ${curva}, width ${curva}, height ${curva}` : 'none',
          }}
        />
      )}
      {ESTADOS.map(id => (
        <button
          key={id}
          ref={n => { botones.current[id] = n }}
          type="button"
          onClick={() => onElegir(id)}
          className={`relative rounded-full border px-3.5 py-2 text-sm transition-colors ${
            estado === id ? 'border-accent-line text-accent' : 'border-line text-ink-dim'
          }`}
        >
          {STATUS_LABEL[id]}
        </button>
      ))}
    </div>
  )
}

// Lo que va puesto en un bloque, en una línea: "Dune, Frank Herbert", o lo
// que se puede poner si todavía no hay nada.
function resumen(partes, vacio, antes = '') {
  const puestas = partes.filter(Boolean)
  if (!puestas.length) return vacio
  const texto = puestas.join(', ')
  return antes + (antes ? texto : texto.charAt(0).toUpperCase() + texto.slice(1))
}

const ENTRADA = 'h-12 w-full rounded-xl2 border border-line bg-bg/60 px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-mute focus:border-accent-line'

function Campo({ etiqueta, className = '', children }) {
  return (
    <label className={`mt-4 block ${className}`}>
      <span className="mb-1.5 block px-1 text-[13px] text-ink-dim">{etiqueta}</span>
      {children}
    </label>
  )
}
