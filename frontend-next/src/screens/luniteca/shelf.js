// Reglas de la estantería. Portadas desde LunitecaV3.jsx (la Luniteca nueva de
// la Puchi actual), que a su vez las calcó de LunitecaV2.jsx: son reglas de
// negocio ya validadas contra el uso real, y cambiarlas aquí desincronizaría
// las dos Lunitecas, que escriben en la MISMA base de datos. Lo que sí cambia
// en esta versión es la presentación, no esto.

import { api } from '../../platform/api'

export const STATUS_LABEL = {
  reading:      'Leyendo',
  rereading:    'Releyendo',
  read:         'Leído',
  want_to_read: 'Por leer',
  dropped:      'Dropeado',
}

export const STATUS_ORDER = ['want_to_read', 'reading', 'rereading', 'read', 'dropped']

// El color con el que se marca cada estado. Los tres primeros salen de la
// paleta de Luniteca (--luni3-read/want/dropped); "leyendo" usa el acento.
export const STATUS_COLOR = {
  reading:      'var(--color-accent)',
  rereading:    'var(--color-accent)',
  read:         'var(--color-read)',
  want_to_read: 'var(--color-want)',
  dropped:      'var(--color-danger)',
}

export function progressPct(e) {
  const total = totalPages(e)
  if (total && e.current_page != null) return Math.min(Math.round(e.current_page / total * 100), 100)
  return Math.round((e.progress || 0) * 100)
}

export function totalPages(e) {
  return e.custom_total_pages || e.book.num_pages || e.ereader_total_pages || null
}

// ─── Dónde se lee: físico, eReader o los dos ────────────────────────────────
//
// `current_page` sigue siendo UNA sola cifra (la de siempre): las páginas del
// físico si se conocen, y solo si no hay ninguna referencia física cae en las
// del eReader — nunca las dos guardadas a la vez. Pasar de un lado a otro es
// una regla de tres entre los dos totales, así que mover la página en un
// formato se nota en el otro sin guardar nada aparte.
export const FORMATO_LABEL = { fisico: 'Físico', ereader: 'eReader', ambos: 'Físico + eReader' }

export function totalFisico(e) {
  return e.custom_total_pages || e.book.num_pages || null
}

export function totalEreader(e) {
  return e.ereader_total_pages || null
}

// La página "base" en la que vive current_page: físico si se conoce, si no
// eReader. Un libro marcado leído sin página guardada (se pudo marcar por
// otra vía) se da por terminado del todo, igual que hacía `paginaDe` antes de
// que hubiera dos formatos que elegir.
function paginaBaseDe(e) {
  const base = totalFisico(e) || totalEreader(e)
  if (!base) return null
  return e.current_page ?? (e.status === 'read' ? base : 0)
}

// La página actual, convertida al lado que se pida ('fisico' o 'ereader').
export function paginaEnLado(e, lado) {
  const fisico = totalFisico(e), ereader = totalEreader(e)
  const base = fisico || ereader
  const enBase = paginaBaseDe(e)
  const destino = lado === 'ereader' ? ereader : fisico
  if (enBase == null || !destino) return null
  return destino === base ? enBase : Math.round(enBase / base * destino)
}

// Y al revés: de una página escrita o arrastrada en un lado concreto, la
// página equivalente en la base que de verdad se guarda como current_page.
export function paginaDesdeLado(e, lado, pagina) {
  const fisico = totalFisico(e), ereader = totalEreader(e)
  const base = fisico || ereader
  const origen = lado === 'ereader' ? ereader : fisico
  if (!base || !origen) return pagina
  return origen === base ? pagina : Math.round(pagina / origen * base)
}

// Lo que costó una copia, en euros. Sin decimales cuando son un número
// redondo (12 €, no 12,00 €) — que es como se dice un precio en voz alta.
export function formatoPrecio(n) {
  return n.toLocaleString('es', { style: 'currency', currency: 'EUR', minimumFractionDigits: n % 1 === 0 ? 0 : 2 })
}

export const EMPTY_FILTERS = { genre: '', folder: '', author: '', maxPages: '', minRating: '' }

// De 50 en 50: nadie filtra "máximo 437 páginas".
export const MAX_PAGES_OPTIONS = Array.from({ length: 20 }, (_, i) => String((i + 1) * 100))

// Todas las notas que se pueden poner, medias incluidas: se puntúa a medias
// estrellas (ver EditableRating), así que un filtro que solo llegara a los
// enteros no podría pedir "de 3,5 para arriba", que es justo el corte que se
// quiere hacer. Empieza en 0,5, la nota más baja que existe — filtrar por ahí
// es, en la práctica, "solo los que tienen nota".
export const MIN_RATING_OPTIONS = Array.from({ length: 10 }, (_, i) => String((i + 1) / 2))

// Se aplica sobre toda la estantería ANTES de repartir por estado, así que un
// filtro por género o carpeta se nota en todas las secciones a la vez.
export function matchesFilters(e, filters) {
  if (filters.genre  && e.book.genre  !== filters.genre)  return false
  if (filters.folder && e.folder      !== filters.folder) return false
  if (filters.author && e.book.author !== filters.author) return false
  if (filters.maxPages) {
    const total = totalPages(e)
    if (!total || total > Number(filters.maxPages)) return false
  }
  if (filters.minRating && !(e.rating >= Number(filters.minRating))) return false
  return true
}

// Busca dentro de la estantería propia (título o autor). No es el buscador de
// "Añadir libro", que va contra Open Library y todavía no está portado.
export function matchesQuery(e, query) {
  if (!query.trim()) return true
  const q = query.trim().toLowerCase()
  return (e.book.title || '').toLowerCase().includes(q) || (e.book.author || '').toLowerCase().includes(q)
}

export const SORT_FIELDS = [
  { field: 'title',  label: 'Título' },
  { field: 'author', label: 'Autor' },
  { field: 'genre',  label: 'Género' },
  { field: 'date',   label: 'Fecha' },
  { field: 'size',   label: 'Tamaño' },
]

// El tamaño de un libro para ordenar: su alto de verdad (el campo Tamaño de
// la ficha) y, entre dos del mismo alto, su grosor, que sale de las páginas.
// Los que no tienen alto van al final en los dos sentidos: el que se les ve
// en la balda es inventado (sale del título), y colocarlos por él sería
// ordenar por azar.
function compararTamano(a, b, dir) {
  const ha = a.book.height_mm || null
  const hb = b.book.height_mm || null
  if ((ha == null) !== (hb == null)) return ha == null ? 1 : -1
  const signo = dir === 'asc' ? 1 : -1
  if (ha !== hb) return (ha - hb) * signo
  const pa = totalPages(a) || 0
  const pb = totalPages(b) || 0
  if (pa !== pb) return (pa - pb) * signo
  return (a.book.title || '').localeCompare(b.book.title || '', 'es')
}

// Cuando hay un orden elegido sustituye al de por defecto DENTRO de cada
// sección o año; nunca cambia qué libro cae en qué sección, que eso lo decide
// el estado.
export function compareEntries(a, b, sort) {
  if (!sort.field) return 0
  if (sort.field === 'size') return compararTamano(a, b, sort.dir)
  let va, vb
  if (sort.field === 'title')  { va = a.book.title?.toLowerCase()  || ''; vb = b.book.title?.toLowerCase()  || '' }
  if (sort.field === 'author') { va = a.book.author?.toLowerCase() || ''; vb = b.book.author?.toLowerCase() || '' }
  if (sort.field === 'genre')  { va = a.book.genre?.toLowerCase()  || ''; vb = b.book.genre?.toLowerCase()  || '' }
  if (sort.field === 'date')   { va = a.finished_at || a.started_at || ''; vb = b.finished_at || b.started_at || '' }
  if (va < vb) return sort.dir === 'asc' ? -1 : 1
  if (va > vb) return sort.dir === 'asc' ? 1 : -1
  return 0
}

export function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

// "inicio – fin" al terminar (o "… – dropeado …" si se dejó). La fecha que
// falte simplemente no se escribe: un libro que estás leyendo pone cuándo lo
// empezaste y ya está, sin un "¿?" recordando que todavía no lo has acabado.
// Y si no hay ninguna de las dos, no hay etiqueta. Nunca fechas para "por
// leer".
export function readingDatesLabel(e) {
  const tracksDates = ['reading', 'rereading', 'read', 'dropped'].includes(e.status)
  if (!tracksDates || (!e.started_at && !e.finished_at)) return null
  const start = e.started_at ? fmtDate(e.started_at) : ''
  if (!e.finished_at) return start
  const end = fmtDate(e.finished_at)
  const fin = e.status === 'dropped' ? `dropeado ${end}` : end
  // Sin inicio no hay rango que escribir: solo el final.
  return start ? `${start} – ${fin}` : fin
}

// Al pasar a "leyendo"/"leído"/"dropeado" se rellenan las fechas que falten
// con la de hoy, sin pisar las que ya hubiera; "leído" además marca la página
// actual al total y suma una lectura; "releyendo" reinicia la fecha de inicio
// y borra la de fin; cualquier otro cambio reinicia el progreso.
export function statusPatch(newStatus, entry) {
  const today = new Date().toISOString().slice(0, 10)
  const total = totalPages(entry)
  const patch = { status: newStatus }
  if (newStatus === 'reading' && !entry.started_at) patch.started_at = today
  if (newStatus === 'rereading') { patch.started_at = today; patch.finished_at = '' }
  if (newStatus === 'read') {
    if (!entry.started_at)  patch.started_at  = today
    if (!entry.finished_at) patch.finished_at = today
    if (total) patch.current_page = total
    // Solo suma lectura al venir de "Releyendo" (una relectura de verdad) o al
    // terminarlo por primera vez. Terminarlo, corregir a mano que en realidad
    // seguías leyendo y volver a terminarlo NO cuenta como lectura nueva.
    if (entry.status === 'rereading' || !(entry.times_read > 0)) {
      patch.times_read = (entry.times_read || 0) + 1
    }
  } else if (newStatus === 'dropped') {
    if (!entry.started_at)  patch.started_at  = today
    if (!entry.finished_at) patch.finished_at = today
  } else if (newStatus !== 'reading') {
    patch.current_page = 0
  }
  return patch
}

// Reparte la estantería en las secciones que se pintan, ya filtrada y
// ordenada. Se llama desde un useMemo: sin él, cada sección recibe arrays
// nuevos en cada render y se reconcilian cientos de portadas por nada.
export function agruparEstanteria(shelf, { filters, query, sort }) {
  const s = shelf || []
  const visible = s.filter(e => matchesFilters(e, filters) && matchesQuery(e, query))

  const reading = visible.filter(e => e.status === 'reading' || e.status === 'rereading')
  const read    = visible.filter(e => e.status === 'read')
  const dropped = visible.filter(e => e.status === 'dropped')
  // "Por leer" se ordena por autor y luego título cuando no hay orden
  // elegido: es una lista para decidir qué coger, y agrupada por autor se
  // decide mejor. Los que no tienen autor caen al final.
  const want = [...visible.filter(e => e.status === 'want_to_read')].sort((a, b) => {
    if (sort.field) return compareEntries(a, b, sort)
    const autorA = a.book.author?.toLowerCase() || '', autorB = b.book.author?.toLowerCase() || ''
    if (!autorA && autorB) return 1
    if (autorA && !autorB) return -1
    if (autorA !== autorB) return autorA < autorB ? -1 : 1
    return (a.book.title || '').toLowerCase() < (b.book.title || '').toLowerCase() ? -1 : 1
  })
  if (sort.field) {
    reading.sort((a, b) => compareEntries(a, b, sort))
    dropped.sort((a, b) => compareEntries(a, b, sort))
  }

  // Los leídos se agrupan por año de fin, del más reciente al más antiguo, y
  // los que no tienen fecha van al final en su propio grupo.
  const porAno = {}
  for (const e of read) {
    const year = e.finished_at ? e.finished_at.slice(0, 4) : 'sin-fecha'
    ;(porAno[year] ||= []).push(e)
  }
  const years = Object.keys(porAno).filter(y => y !== 'sin-fecha').sort((a, b) => b.localeCompare(a))
  if (porAno['sin-fecha']) years.push('sin-fecha')
  for (const y of years) {
    porAno[y].sort((a, b) => sort.field ? compareEntries(a, b, sort) : (b.finished_at || '').localeCompare(a.finished_at || ''))
  }

  return {
    visible,
    reading,
    want,
    dropped,
    readYearGroups: years.map(year => ({ year, items: porAno[year] })),
    years,
    filtrosActivos: Object.keys(EMPTY_FILTERS).some(k => filters[k] !== EMPTY_FILTERS[k]),
    vacia: s.length === 0,
    ningunoVisible: s.length > 0 && visible.length === 0,
  }
}

// Valores distintos que hay en la estantería para cada filtro desplegable.
export function opcionesDeFiltro(shelf) {
  const unicos = (fn) => [...new Set((shelf || []).map(fn).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
  return {
    generos: unicos(e => e.book.genre),
    carpetas: unicos(e => e.folder),
    autores: unicos(e => e.book.author),
  }
}

// Copiar a mi estantería un libro que estoy viendo en la de otra persona (o en
// la actividad). Va aquí y no suelto en cada pantalla porque el alta tiene su
// forma: el backend exige `title` aunque se le pase `book_id` —comparte el
// endpoint con el alta a mano, donde el libro todavía no existe—, y el estado
// de "pendiente" se llama `want_to_read`, no `to_read`. Con las dos cosas mal,
// que era como estaba, la petición se iba en un 422 y el botón no hacía nada.
export function copiarAMiEstanteria(libro) {
  return api('/shelf/personal', {
    method: 'POST',
    body: {
      book_id: libro.id,
      title: libro.title,
      author: libro.author,
      cover_url: libro.cover_url,
      num_pages: libro.num_pages,
      genre: libro.genre,
      year: libro.year,
      synopsis: libro.synopsis,
      status: 'want_to_read',
      // Para distinguir en los datos lo copiado de lo buscado por su cuenta.
      origin: 'copied',
    },
  })
}

// El género que mejor describe a un autor, mirando TODOS sus libros.
//
// La tipografía del lomo se elige por autor para que sus libros parezcan una
// colección, pero el género tenía la última palabra, y el género lo trae el
// catálogo libro a libro: "Antes de que los cuelguen" venía como Fantasía y
// "La mejor venganza", del mismo Abercrombie, como Ficción, así que salían con
// letras distintas en la misma balda. Ahora el género se decide una vez por
// autor —el que más se repite entre sus libros— y todos van iguales. De paso,
// un libro suyo al que le falte el género hereda el de los demás.
export function generosDeAutores(entries) {
  const cuentas = new Map()
  for (const e of entries || []) {
    const autor = claveDeAutor(e.book?.author)
    const genero = (e.book?.genre || '').trim()
    if (!autor || !genero) continue
    const suyos = cuentas.get(autor) || new Map()
    suyos.set(genero, (suyos.get(genero) || 0) + 1)
    cuentas.set(autor, suyos)
  }
  const mandan = new Map()
  for (const [autor, suyos] of cuentas) {
    // El más repetido; a igualdad, el primero por orden alfabético, que si no
    // el resultado dependería del orden en que llegaran los libros.
    const mejor = [...suyos.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]
    mandan.set(autor, mejor[0])
  }
  return mandan
}

// El apellido, en minúsculas y sin tildes: es la clave con la que se agrupan
// los libros de un mismo autor (misma cuenta que usa el lomo para elegir letra).
export function claveDeAutor(autor) {
  if (!autor) return ''
  const partes = autor.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/)
  return partes[partes.length - 1]
}

// ─── Subir una foto de portada o de lomo ────────────────────────────────────
//
// Las dos suben a la GALERÍA del libro (compartida, con atribución) y
// devuelven la URL; quién se queda con esa foto lo decide quien llama,
// poniéndola en su propia entrada de la estantería. Aquí y no en la pantalla
// que las usa porque son tres: la ficha de un libro, el alta a mano y lo que
// venga después.
export async function subirPortada(bookId, fichero) {
  const datos = new FormData()
  datos.append('file', fichero)
  const r = await api(`/books/${bookId}/cover`, { method: 'POST', body: datos })
  return r.url
}

// El blob llega YA RECORTADO (ver RecortarFoto). Sin `generado=true`: una
// foto de verdad nunca pisa el lomo compartido del libro, cada uno pone la
// suya en su propia copia.
export async function subirLomo(bookId, blob) {
  const datos = new FormData()
  datos.append('file', blob, 'lomo.jpg')
  const r = await api(`/books/${bookId}/spine`, { method: 'POST', body: datos })
  return r.url
}
