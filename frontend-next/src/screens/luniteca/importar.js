// Traer libros de fuera, en bloque: lo que comparten el importador de
// Goodreads, el de una hoja de cálculo cualquiera y el escáner de códigos de
// barras. Aquí no hay nada de pantalla — solo leer el archivo, entender qué
// dice cada columna, completar lo que falte contra las APIs y mandarlo al
// backend. La pantalla la ponen ImportarLibros.jsx, EscanerISBN.jsx y la lista
// de revisión que comparten (ListaPrevia.jsx).
//
// Los tres flujos existían ya en la Puchi anterior, cada uno en su propio
// modal con su propio parser, su propio mapeo de estados y su propia copia de
// las mismas correcciones (ver BulkAddModal/ExcelImportModal/
// GoodreadsImportModal en frontend/). Al pasarlos aquí se quedan en un solo
// sitio: una fila importada es siempre la misma forma de objeto venga de donde
// venga, así que el paso de revisar y el de enviar son los mismos para todos.

import { api } from '../../platform/api'
import { MM_MAX, MM_MIN } from './Lomos'

// ─── Campos a los que se puede mapear una columna ───────────────────────────
//
// `alias` son los nombres de columna que se reconocen solos al subir el
// archivo; `plantilla` es el encabezado exacto que lleva esa columna en la
// plantilla descargable, y siempre es uno de sus propios alias para que al
// volver a subirla el mapeo se adivine sin tocar nada.
//
// El orden es el de la plantilla, y va de lo que identifica el libro a lo que
// es de tu copia. Los cinco últimos (alto, precio, dónde se lee y las dos
// paginaciones propias) son los campos que la ficha ya tenía pero ninguna
// importación traía — lo que hacía que exportar de Puchi y volver a importar
// perdiera justo lo que Puchi sabe y las demás apps no.
export const CAMPOS = [
  { clave: 'title',       etiqueta: 'Título',           obligatorio: true, tipo: 'texto',  plantilla: 'Título',              alias: ['titulo', 'nombre', 'title', 'name', 'libro', 'book'] },
  { clave: 'author',      etiqueta: 'Autor',            tipo: 'texto',     plantilla: 'Autor',               alias: ['autor', 'autora', 'author', 'autores', 'writer'] },
  { clave: 'isbn',        etiqueta: 'ISBN',             tipo: 'isbn',      plantilla: 'ISBN',                alias: ['isbn', 'isbn13', 'isbn10', 'isbn 13', 'isbn 10'] },
  { clave: 'year',        etiqueta: 'Año',              tipo: 'entero',    plantilla: 'Año',                 alias: ['ano', 'anio', 'year', 'publicacion', 'ano de publicacion'] },
  { clave: 'num_pages',   etiqueta: 'Páginas',          tipo: 'entero',    plantilla: 'Páginas',             alias: ['paginas', 'pages', 'num paginas', 'numero de paginas', 'n paginas'] },
  { clave: 'genre',       etiqueta: 'Género',           tipo: 'texto',     plantilla: 'Género',              alias: ['genero', 'genre', 'categoria'] },
  { clave: 'synopsis',    etiqueta: 'Sinopsis',         tipo: 'texto',     plantilla: 'Sinopsis',            alias: ['sinopsis', 'synopsis', 'resumen', 'descripcion', 'argumento', 'summary'] },
  { clave: 'status',      etiqueta: 'Estado',           tipo: 'estado',    plantilla: 'Estado',              alias: ['estado', 'status', 'estanteria', 'shelf'] },
  { clave: 'rating',      etiqueta: 'Puntuación (0-5)', tipo: 'numero',    plantilla: 'Puntuación',          alias: ['puntuacion', 'rating', 'valoracion', 'nota', 'calificacion', 'estrellas', 'stars'] },
  { clave: 'started_at',  etiqueta: 'Empezado',         tipo: 'fecha',     plantilla: 'Empezado',            alias: ['empezado', 'fecha inicio', 'fecha de inicio', 'inicio', 'start date', 'started', 'comenzado'] },
  { clave: 'finished_at', etiqueta: 'Terminado',        tipo: 'fecha',     plantilla: 'Terminado',           alias: ['terminado', 'fecha fin', 'fecha de fin', 'fin', 'end date', 'finished', 'date read', 'fecha de lectura'] },
  { clave: 'times_read',  etiqueta: 'Veces leído',      tipo: 'entero',    plantilla: 'Veces leído',         alias: ['veces leido', 'read count', 'relecturas', 'numero de lecturas'] },
  { clave: 'current_page', etiqueta: 'Página actual',   tipo: 'entero',    plantilla: 'Página actual',       alias: ['pagina actual', 'pagina', 'current page', 'por donde voy'] },
  { clave: 'folder',      etiqueta: 'Carpeta',          tipo: 'texto',     plantilla: 'Carpeta',             alias: ['carpeta', 'folder', 'coleccion'] },
  { clave: 'notes',       etiqueta: 'Notas',            tipo: 'texto',     plantilla: 'Notas',               alias: ['notas', 'notes', 'comentarios', 'comentario', 'resena'] },
  { clave: 'height_mm',   etiqueta: 'Alto (cm)',        tipo: 'alto',      plantilla: 'Alto (cm)',           alias: ['alto', 'alto cm', 'altura', 'tamano', 'height'] },
  { clave: 'price',       etiqueta: 'Precio (€)',       tipo: 'numero',    plantilla: 'Precio (€)',          alias: ['precio', 'price', 'coste', 'lo que costo'] },
  { clave: 'reading_format', etiqueta: 'Dónde se lee',  tipo: 'formato',   plantilla: 'Dónde se lee',        alias: ['donde se lee', 'formato', 'format', 'soporte', 'edicion'] },
  { clave: 'custom_total_pages',  etiqueta: 'Páginas de tu edición', tipo: 'entero', plantilla: 'Páginas de tu edición', alias: ['paginas de tu edicion', 'paginas de mi edicion', 'total propio'] },
  { clave: 'ereader_total_pages', etiqueta: 'Páginas en el eReader', tipo: 'entero', plantilla: 'Páginas en el eReader', alias: ['paginas en el ereader', 'paginas ereader', 'paginas kindle', 'ereader pages'] },
]

const CAMPO_POR_CLAVE = Object.fromEntries(CAMPOS.map(c => [c.clave, c]))

// Los campos que se editan fila a fila en la revisión, y en qué orden. No son
// todos: título, autor, ISBN y sinopsis se editan aparte (arriba de la fila, o
// no se editan), y el resto cabe en una sola columna de formulario.
export const CAMPOS_EDITABLES = [
  'status', 'rating', 'started_at', 'finished_at', 'genre', 'year', 'num_pages',
  'height_mm', 'price', 'reading_format', 'times_read', 'current_page',
  'custom_total_pages', 'ereader_total_pages', 'folder', 'notes',
]

// Un aviso corto bajo la columna al mapearla: los tres campos que en el resto
// de Puchi no son texto libre, así que conviene decir qué se reconoce antes de
// subir en vez de dejar que se descubra en la revisión.
export const AVISOS_MAPEO = {
  status: 'Se reconoce "Leído", "Leyendo", "Por leer"/"Pendiente" o "Dropeado" y sus variantes. Lo que no encaje se queda en "Por leer", editable fila a fila después.',
  reading_format: 'Se reconoce "Físico"/"Papel", "eReader"/"Kindle"/"Digital" y "Ambos". Lo que no encaje se queda sin poner.',
  height_mm: `El alto del libro, para la vista de lomos. En centímetros (21, 23,5…); un número de más de ${Math.round(MM_MIN / 10)} se entiende como milímetros.`,
}

// ─── Convertir lo que venga en el archivo ────────────────────────────────────

export function normaliza(s) {
  return (s ?? '').toString().toLowerCase().normalize('NFD')
    .replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

function aTexto(v) {
  if (v == null) return ''
  if (v instanceof Date) return aFechaIso(v)
  return String(v).trim()
}

function aNumero(v) {
  if (v == null || v === '' || v instanceof Date) return null
  // Coma decimal: una hoja hecha en España escribe "4,5" y "12,90".
  const n = parseFloat(String(v).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function aEntero(v) {
  const n = aNumero(v)
  return n == null ? null : Math.round(n)
}

// Un ISBN son dígitos, y como mucho una X final (el dígito de control de los
// de 10). Todo lo demás que venga pegado sobra, y viene de todo: Goodreads lo
// exporta escapado para que Excel no lo trate como número (="8417956409", del
// que el parser CSV ya se ha comido las comillas y deja =8417956409), y una
// hoja a mano lo escribe con guiones o con "ISBN" delante.
function aIsbn(v) {
  return aTexto(v).replace(/[^0-9Xx]/g, '')
}

// El alto se pide en centímetros, que es como se mide un libro con una regla,
// pero se guarda en milímetros (Book.height_mm). Un número que ya está en el
// rango de milímetros de un libro real se toma tal cual: así una hoja exportada
// de Puchi, que lleva cm, y una hecha a mano con mm valen las dos sin
// preguntar cuál es cuál — 21 solo puede ser centímetros y 210 solo milímetros,
// no hay libro de 21 mm ni de 210 cm.
function aMm(v) {
  const n = aNumero(v)
  if (n == null || n <= 0) return null
  const mm = n >= MM_MIN / 2 ? Math.round(n) : Math.round(n * 10)
  return Math.min(Math.max(mm, MM_MIN), MM_MAX)
}

// Acepta fechas ya interpretadas por SheetJS (cellDates:true) y las formas de
// texto más comunes en hojas hechas a mano.
//
// OJO: cuando la celda de origen es una fecha real de Excel (no texto),
// sheet_to_json ya devuelve el Date ajustado a la hora local del navegador al
// convertir el número de serie — leerlo con getUTCFullYear/… resta el desfase
// otra vez y adelanta la fecha un día en cualquier huso por delante de UTC
// (España, sin ir más lejos). Hay que usar los métodos locales.
export function aFechaIso(v) {
  if (v == null || v === '') return ''
  if (v instanceof Date && !isNaN(v)) {
    const a = v.getFullYear(), m = String(v.getMonth() + 1).padStart(2, '0'), d = String(v.getDate()).padStart(2, '0')
    return `${a}-${m}-${d}`
  }
  const s = String(v).trim()
  let m
  if ((m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(s))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  if ((m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(s))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return ''
}

// "want_to_read" se comprueba antes que "read" para que una negación como "no
// leído" o "sin leer" no caiga en "read" solo por contener la palabra.
const ALIAS_ESTADO = {
  want_to_read: ['por leer', 'pendiente', 'pendientes', 'to read', 'want to read', 'no leido', 'sin leer', 'wishlist', 'tbr'],
  dropped:      ['dropeado', 'abandonado', 'dropped', 'dnf'],
  reading:      ['leyendo', 'reading', 'en curso', 'actual', 'en progreso', 'currently reading'],
  read:         ['leido', 'read', 'terminado', 'finalizado', 'completado', 'done'],
}

export function mapearEstado(bruto) {
  const n = normaliza(aTexto(bruto))
  if (!n) return 'want_to_read'
  for (const [clave, alias] of Object.entries(ALIAS_ESTADO)) if (alias.includes(n)) return clave
  for (const [clave, alias] of Object.entries(ALIAS_ESTADO)) if (alias.some(a => n.includes(a))) return clave
  return 'want_to_read'
}

const ALIAS_FORMATO = {
  ambos:   ['ambos', 'los dos', 'both', 'fisico y ereader', 'fisico ereader'],
  ereader: ['ereader', 'e reader', 'kindle', 'digital', 'ebook', 'epub', 'electronico'],
  fisico:  ['fisico', 'papel', 'physical', 'print', 'tapa dura', 'tapa blanda', 'bolsillo'],
}

// Sin valor reconocible se devuelve null y no 'fisico': suponer dónde se lee un
// libro cambia cómo se cuentan sus páginas (ver paginaEnLado en shelf.js), así
// que es mejor dejarlo sin poner que acertar por defecto.
export function mapearFormato(bruto) {
  const n = normaliza(aTexto(bruto))
  if (!n) return ''
  for (const [clave, alias] of Object.entries(ALIAS_FORMATO)) if (alias.includes(n)) return clave
  for (const [clave, alias] of Object.entries(ALIAS_FORMATO)) if (alias.some(a => n.includes(a))) return clave
  return ''
}

// Una celda bruta, convertida a lo que ese campo guarda. Devuelve siempre algo
// vacío ('' o null) cuando no hay nada aprovechable, nunca `undefined`: la
// fila es un formulario controlado y un undefined ahí deja el <input> suelto.
export function valorDeCampo(clave, bruto) {
  switch (CAMPO_POR_CLAVE[clave]?.tipo) {
    case 'entero':  return aEntero(bruto)
    case 'numero':  return aNumero(bruto)
    case 'fecha':   return aFechaIso(bruto)
    case 'isbn':    return aIsbn(bruto)
    case 'alto':    return aMm(bruto)
    case 'estado':  return mapearEstado(bruto)
    case 'formato': return mapearFormato(bruto)
    default:        return aTexto(bruto)
  }
}

// ─── Leer el archivo ─────────────────────────────────────────────────────────

// Parser CSV (RFC4180) compacto: comas dentro de campos entrecomillados,
// comillas escapadas como "" y saltos de línea dentro de un campo (la reseña de
// Goodreads los trae). No hace falta ninguna librería para esto — SheetJS solo
// se carga para los .xlsx de verdad.
export function parsearCSV(texto) {
  const filas = []
  let fila = [], campo = '', enComillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++ }
        else enComillas = false
      } else campo += c
    } else if (c === '"') {
      enComillas = true
    } else if (c === ',') {
      fila.push(campo); campo = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      fila.push(campo); campo = ''
      if (fila.length > 1 || fila[0] !== '') filas.push(fila)
      fila = []
    } else {
      campo += c
    }
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila) }
  return filas
}

// Adivina el mapeo inicial por el nombre de cada columna, para no obligar a
// rellenar veinte casillas a mano cuando el archivo ya usa nombres obvios
// ("Título", "Autor"…). Siempre editable después: es un punto de partida, no
// una decisión.
export function adivinarMapeo(encabezados) {
  const usados = new Set()
  const mapeo = {}
  encabezados.forEach((h, i) => {
    const n = normaliza(h)
    if (!n) return
    for (const campo of CAMPOS) {
      if (usados.has(campo.clave)) continue
      if (campo.alias.some(a => n === a || n.includes(a))) {
        mapeo[i] = campo.clave
        usados.add(campo.clave)
        break
      }
    }
  })
  return mapeo
}

let filaSeq = 0
function filaVacia(extra) {
  return {
    clave: `f${filaSeq++}`,
    title: '', author: '', isbn: '', synopsis: '', genre: '', folder: '', notes: '',
    status: 'want_to_read', rating: null, started_at: '', finished_at: '',
    year: null, num_pages: null, times_read: null, current_page: null,
    height_mm: null, price: null, reading_format: '',
    custom_total_pages: null, ereader_total_pages: null,
    cover_url: null, open_lib_key: null,
    completado: 'pendiente',  // pendiente | hecho | error — ver completarFilas
    fuente: null,             // 'isbn' | 'search' — de dónde salió lo completado
    ...extra,
  }
}

// Una fila a partir de lo que devuelve un lookup de libro del backend
// (/books/isbn/… en el escáner). Ya viene completo de Open Library, así que no
// pasa por completarFilas: se marca como hecho y entra directo a la revisión.
export function filaDeLibro(libro, extra) {
  return filaVacia({
    title: libro.title || '',
    author: libro.author || '',
    isbn: libro.isbn || '',
    open_lib_key: libro.open_lib_key || null,
    cover_url: libro.cover_url || null,
    year: libro.year ?? null,
    num_pages: libro.num_pages ?? null,
    genre: libro.genre || '',
    synopsis: libro.synopsis || '',
    completado: 'hecho',
    fuente: 'isbn',
    ...extra,
  })
}

// De la tabla cruda (array de arrays, ya sin encabezado) a filas, según el
// mapeo elegido en la pantalla anterior.
export function filasDeTabla(tabla, mapeo) {
  const columnaDe = {}
  for (const [indice, clave] of Object.entries(mapeo)) columnaDe[clave] = Number(indice)
  return tabla.map(bruta => {
    const valores = {}
    for (const campo of CAMPOS) {
      const col = columnaDe[campo.clave]
      if (col == null) continue
      valores[campo.clave] = valorDeCampo(campo.clave, bruta[col])
    }
    if (valores.rating != null) valores.rating = Math.min(Math.max(valores.rating, 0), 5)
    return valores.title ? filaVacia(valores) : null
  }).filter(Boolean)
}

// Goodreads pega el nombre de la saga al título — "Brazales de duelo (Nacidos
// de la bruma, #6)" — pero en Puchi los libros se guardan con el título limpio
// (los añadidos a mano o vía Open Library nunca llevan esa coletilla). Sin
// quitarla, ni el deduplicado ni una reimportación reconocen un libro de saga
// que ya está en la estantería. Solo se recorta un paréntesis final que
// contenga "#<número>": eso es el marcador de saga de Goodreads y no un
// subtítulo de verdad como "(Spanish Edition)".
function sinSaga(titulo) {
  return (titulo || '').replace(/\s*\([^()]*#\d+[^()]*\)\s*$/, '').trim()
}

const ESTANTE_GOODREADS = { 'read': 'read', 'currently-reading': 'reading', 'to-read': 'want_to_read' }

export function filasDeGoodreads(texto) {
  const tabla = parsearCSV(texto)
  if (tabla.length < 2) throw new Error('El archivo está vacío.')
  const encabezado = tabla[0].map(h => h.trim())
  if (!encabezado.includes('Title') || !encabezado.includes('Exclusive Shelf')) {
    throw new Error('Esto no parece un export de Goodreads. Descárgalo en goodreads.com/review/import.')
  }
  const indice = Object.fromEntries(encabezado.map((h, i) => [h, i]))
  const dato = (f, nombre) => (indice[nombre] != null ? (f[indice[nombre]] || '').trim() : '')

  return tabla.slice(1).filter(f => f.length > 1 || f[0]).map(f => {
    const estante = dato(f, 'Exclusive Shelf')
    const puntuacion = aNumero(dato(f, 'My Rating'))
    return filaVacia({
      title: sinSaga(dato(f, 'Title')),
      author: dato(f, 'Author'),
      isbn: aIsbn(dato(f, 'ISBN13')) || aIsbn(dato(f, 'ISBN')),
      status: ESTANTE_GOODREADS[estante] || 'want_to_read',
      // Las estanterías propias de Goodreads ("favoritos", "pendientes-2024"…)
      // no son estados de Puchi, pero dicen algo: entran como carpeta, que es
      // exactamente para lo mismo. Goodreads las lista todas separadas por
      // comas en "Bookshelves" y se coge la primera, porque una carpeta solo
      // puede ser una. Si no hay ninguna, se mira si la estantería
      // "exclusiva" es una que no conocemos y se usa esa.
      folder: (dato(f, 'Bookshelves').split(',')[0] || '').trim()
        || (ESTANTE_GOODREADS[estante] ? '' : (estante || '')),
      rating: puntuacion && puntuacion > 0 ? puntuacion : null,
      // Goodreads no exporta la fecha de inicio, solo la de fin.
      finished_at: aFechaIso(dato(f, 'Date Read')),
      times_read: aEntero(dato(f, 'Read Count')) || null,
      year: aEntero(dato(f, 'Original Publication Year') || dato(f, 'Year Published')),
      num_pages: aEntero(dato(f, 'Number of Pages')),
      notes: dato(f, 'My Review'),
    })
  }).filter(f => f.title)
}

// ─── Lo que ya tienes ────────────────────────────────────────────────────────

function clave(s) {
  return normaliza(s)
}

// Marca cada fila con si ya la tienes (para no importarla dos veces) y, si no,
// con qué más tienes de ese mismo autor.
//
// Un título en otro idioma ("The Name of the Wind" vs "El nombre del viento")
// no comparte ni una palabra con su traducción, así que no hay forma fiable de
// detectarlo por texto. En vez de perseguir eso, se avisa cuando el autor de
// una fila "nueva" ya tiene algo en la estantería y que decida quien mira: es
// la misma obra en otra edición, o de verdad otro libro.
export function marcarDuplicados(filas, estanteria) {
  const lista = estanteria || []
  const isbns = new Set(lista.map(e => (e.book?.isbn || '').trim()).filter(Boolean))
  const claves = new Set(lista.map(e => `${clave(e.book?.title)}|${clave(e.book?.author)}`))
  const porAutor = new Map()
  for (const e of lista) {
    const k = clave(e.book?.author)
    if (!k) continue
    if (!porAutor.has(k)) porAutor.set(k, [])
    porAutor.get(k).push(e.book?.title)
  }
  const marcadas = filas.map(f => {
    const duplicada = (f.isbn && isbns.has(f.isbn)) || claves.has(`${clave(f.title)}|${clave(f.author)}`)
    return { ...f, duplicada, mismoAutor: duplicada ? [] : (porAutor.get(clave(f.author)) || []) }
  })
  // Lo que no tienes es lo que hay que revisar y confirmar: va primero, para
  // no tener que bajar por toda la lista hasta llegar a lo importante. Orden
  // estable, así que dentro de cada grupo se respeta el del archivo.
  marcadas.sort((a, b) => (a.duplicada === b.duplicada) ? 0 : (a.duplicada ? 1 : -1))
  return marcadas
}

// ─── Completar contra las APIs ───────────────────────────────────────────────

// Rellena portada, sinopsis, páginas, año, género e ISBN de cada fila contra
// Google Books + Open Library (backend: /books/enrich), SIN pisar nada de lo
// que venga del archivo — lo que ya dice la hoja manda, esto solo tapa huecos.
//
// Con ISBN es un lookup exacto. Sin ISBN (habitual en una hoja personal, a
// diferencia del export de Goodreads, que casi siempre lo trae) es una
// búsqueda por título y autor, y por eso esas filas se marcan aparte
// (fuente:'search'): puede haber traído la edición equivocada y conviene
// mirarlas.
//
// Se lanza después de pintar la lista, nunca antes: una biblioteca de
// cientos de libros tarda un rato en completarse del todo, pero se puede
// revisar y editar desde el primer instante.
export async function completarFilas(filas, { parche, avance, abortada }) {
  const objetivo = filas.filter(f => f.title)
  if (!objetivo.length) return
  avance?.({ hechas: 0, total: objetivo.length })
  let cursor = 0
  let hechas = 0
  // Cinco a la vez: suficiente para que no se note la espera y poco para no
  // reventar a Open Library (ni el proxy de dev) con una librería entera.
  const EN_PARALELO = 5
  async function trabajador() {
    while (cursor < objetivo.length) {
      if (abortada?.()) return
      const fila = objetivo[cursor++]
      try {
        const params = new URLSearchParams()
        if (fila.title)  params.set('title', fila.title)
        if (fila.author) params.set('author', fila.author)
        if (fila.isbn)   params.set('isbn', fila.isbn)
        const b = await api(`/books/enrich?${params}`)
        parche(fila.clave, {
          author: fila.author || b.author || '',
          synopsis: fila.synopsis || b.synopsis || '',
          cover_url: fila.cover_url || b.cover_url || null,
          num_pages: fila.num_pages || b.num_pages || null,
          year: fila.year || b.year || null,
          genre: fila.genre || b.genre || '',
          isbn: fila.isbn || b.isbn || '',
          open_lib_key: fila.open_lib_key || b.open_lib_key || null,
          completado: 'hecho',
          fuente: b.source || null,
        })
      } catch {
        parche(fila.clave, { completado: 'error' })
      }
      avance?.({ hechas: ++hechas, total: objetivo.length })
    }
  }
  await Promise.all(Array.from({ length: EN_PARALELO }, trabajador))
}

// ─── Enviar ──────────────────────────────────────────────────────────────────

// Las fechas solo se mandan para los estados en los que significan algo: un
// libro por leer no se ha empezado, y uno que se está leyendo no se ha
// terminado. Mismo criterio que la ficha (ver EditorFechas).
const LLEVA_INICIO = ['reading', 'read', 'dropped']
const LLEVA_FIN = ['read', 'dropped']

function cuerpoDeFila(f) {
  const cuerpo = {
    title: f.title,
    author: f.author || undefined,
    isbn: f.isbn || undefined,
    open_lib_key: f.open_lib_key || undefined,
    cover_url: f.cover_url || undefined,
    synopsis: f.synopsis || undefined,
    genre: f.genre || undefined,
    year: f.year || undefined,
    num_pages: f.num_pages || undefined,
    height_mm: f.height_mm || undefined,
    status: f.status,
    rating: f.rating || undefined,
    times_read: f.times_read || undefined,
    current_page: f.current_page || undefined,
    custom_total_pages: f.custom_total_pages || undefined,
    ereader_total_pages: f.ereader_total_pages || undefined,
    reading_format: f.reading_format || undefined,
    price: f.price || undefined,
    folder: f.folder || undefined,
    notes: f.notes || undefined,
  }
  if (LLEVA_INICIO.includes(f.status) && f.started_at) cuerpo.started_at = f.started_at
  if (LLEVA_FIN.includes(f.status) && f.finished_at) cuerpo.finished_at = f.finished_at
  return cuerpo
}

// El backend procesa y confirma libro a libro, así que un error en uno no
// deshace los que ya entraron — pero un envío de 500 libros en una sola
// petición se queda colgado lo suficiente como para parecer roto (y se lleva
// por delante cualquier timeout que haya en medio). Se manda por tandas, y el
// avance se va contando entre tanda y tanda.
const POR_TANDA = 40

export async function importarFilas(filas, origin, avance) {
  const resultados = []
  for (let i = 0; i < filas.length; i += POR_TANDA) {
    const tanda = filas.slice(i, i + POR_TANDA)
    const r = await api('/shelf/personal/bulk', {
      method: 'POST',
      body: { books: tanda.map(cuerpoDeFila), origin },
    })
    // El índice que devuelve el backend es el de SU tanda: se traslada al de
    // la lista entera para poder emparejar cada resultado con su fila.
    for (const res of r.results || []) resultados.push({ ...res, index: res.index + i })
    avance?.({ hechas: Math.min(i + POR_TANDA, filas.length), total: filas.length })
  }
  return resultados
}

// ─── La plantilla descargable ────────────────────────────────────────────────

// Una hoja en blanco con los nombres de columna que el mapeo reconoce solo
// (ver `plantilla` en CAMPOS), y una fila de ejemplo que se borra: sin ella no
// se ve de qué forma espera cada columna sus datos, y es justo lo que más se
// pregunta (¿la fecha cómo?, ¿la puntuación sobre cuánto?).
const EJEMPLO = {
  title: 'El nombre del viento', author: 'Patrick Rothfuss', isbn: '9788401352836',
  year: 2007, num_pages: 880, genre: 'Fantasía', synopsis: '',
  status: 'Leído', rating: 4.5, started_at: '2024-01-05', finished_at: '2024-02-18',
  times_read: 1, current_page: '', folder: 'Saga Crónica del asesino de reyes',
  notes: 'Prestado a Pablo', height_mm: '23,5', price: '24,90',
  reading_format: 'Físico', custom_total_pages: '', ereader_total_pages: '',
}

export async function descargarPlantilla() {
  const XLSX = await import('xlsx')
  const hoja = XLSX.utils.aoa_to_sheet([
    CAMPOS.map(c => c.plantilla),
    CAMPOS.map(c => EJEMPLO[c.clave] ?? ''),
  ])
  hoja['!cols'] = CAMPOS.map(() => ({ wch: 22 }))
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, 'Mis libros')
  XLSX.writeFile(libro, 'plantilla-puchi.xlsx')
}

// Lee un .xlsx/.xls/.csv y devuelve el libro de SheetJS. La librería pesa
// bastante y solo hace falta aquí, así que se carga bajo demanda (import
// dinámico) en vez de ir en el bundle principal: la mayoría de sesiones en
// Puchi son de móvil y no pasan por una importación nunca.
export async function leerLibroDeExcel(fichero) {
  const [XLSX, buffer] = await Promise.all([import('xlsx'), fichero.arrayBuffer()])
  const libro = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
  if (!libro.SheetNames.length) throw new Error('El archivo no tiene ninguna hoja.')
  return libro
}

export async function leerHoja(libro, nombre) {
  const XLSX = await import('xlsx')
  const tabla = XLSX.utils.sheet_to_json(libro.Sheets[nombre], { header: 1, raw: true, defval: '' })
  const filas = tabla.slice(1).filter(f => f.some(c => String(c ?? '').trim() !== ''))
  const encabezado = (tabla[0] || []).map((h, i) => String(h ?? '').trim() || `Columna ${i + 1}`)
  return { encabezado, filas }
}
