import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { api } from '../../platform/api'
import { Cover } from './piezas'
import { useHoja } from './HojaInferior'
import SelectorPortada from './SelectorPortada'
import SelectorLomo from './SelectorLomo'
import { MM_MAX, MM_MIN, TAMANOS, medidas, usarAnchoLomo } from './Lomos'
import { IconRefresh, IconX } from '../../ui/icons'
import BotonPeligro from '../../ui/BotonPeligro'

// Editar los datos del LIBRO: título, autor, género, año, páginas, sinopsis y
// portada. Son datos compartidos con todo el club (PATCH /books/{id}), a
// diferencia del estado, las fechas, la puntuación o las notas, que son de tu
// copia y se editan tocándolos directamente en la ficha.
//
// La portada es la excepción: lo que se elige aquí se guarda en TU entrada de
// la estantería, no en el libro, así que cada jugador puede ver la que
// prefiera del mismo libro.
export default function BookEditForm({ entry, generos, onGuardar, onCancelar, onSubirPortada, onSubirLomo, onEliminar }) {
  const libro = entry.book
  const [borrador, setBorrador] = useState(() => ({
    title: libro.title || '',
    author: libro.author || '',
    genre: libro.genre || '',
    year: libro.year != null ? String(libro.year) : '',
    num_pages: libro.num_pages != null ? String(libro.num_pages) : '',
    synopsis: libro.synopsis || '',
    // La portada/el lomo PROPIOS (lo que esta persona ha elegido para su
    // copia), no los efectivos del libro. Si se sembrara con libro.cover_url
    // / libro.spine_url —que ya vienen resueltos, con el propio si lo hay o
    // si no el del libro— cualquier "Guardar" sin tocar ninguno de los dos
    // los adoptaría como si se hubieran elegido a mano (ver guardarLibro en
    // Luniteca.jsx, que compara esto contra own_cover_url/own_spine_url para
    // decidir si hay que guardar algo). Con el lomo eso se notaba mucho: el
    // generado se quedaba congelado en ESE jugador y, al tratarse ya como
    // "foto de verdad" (spine_custom), perdía el título de encima; y en
    // cuanto el libro se regeneraba a otro tamaño (regenerarLomoSiToca en
    // Luniteca.jsx), el archivo al que seguía apuntando se borraba y el lomo
    // se quedaba de un solo color.
    cover_url: entry.own_cover_url || '',
    spine_url: entry.own_spine_url || '',
    height_mm: libro.height_mm != null ? String(libro.height_mm) : '',
  }))
  const [guardando, setGuardando] = useState(false)
  const portada = useHoja()
  const lomo = useHoja()
  // Mismo tamaño que ve la estantería para este libro (ver medidas() en
  // Lomos.jsx) — pero contando el tamaño que hay en el BORRADOR, no el
  // guardado: así al tocar "Tapa dura" el lomo de la muestra crece en el
  // momento y se ve a qué se está diciendo que sí.
  const mmElegidos = borrador.height_mm === '' ? null : Number(borrador.height_mm)
  const { ancho: anchoLomoBase, alto: altoLomo } = medidas({
    ...entry, book: { ...entry.book, height_mm: mmElegidos },
  })
  // Lo que se ENSEÑA arriba no es el borrador a secas: si no has tocado la
  // portada/el lomo, borrador.cover_url/spine_url están vacíos (significan
  // "sin elegir uno propio", ver arriba) y hay que enseñar el efectivo del
  // libro — el mismo que ya se ve en la balda.
  //
  // Y "el del libro" tampoco es libro.cover_url / libro.spine_url si tienes
  // uno propio: te llegan ya sustituidos por el tuyo (ver _shelf_entry_out),
  // así que al quitar el tuyo aquí seguía viéndose hasta guardar. El del
  // libro de verdad lo cuentan los selectores en cuanto lo cargan
  // (`porDefecto`); hasta entonces, sin propio, vale el que llega.
  const [porDefecto, setPorDefecto] = useState(() => ({
    cover: entry.own_cover_url ? null : (libro.cover_url || ''),
    spine: entry.own_spine_url ? null : (libro.spine_url || ''),
  }))
  const coverMostrada = borrador.cover_url || (porDefecto.cover ?? libro.cover_url) || ''
  const spineMostrado = borrador.spine_url || (porDefecto.spine ?? '') || ''
  // Con una foto de verdad puesta, el ancho de la vista previa sale de la
  // proporción REAL de esa foto (mismo hook que usa la balda) y no del ancho
  // por páginas: si no, esta miniatura recorta la foto a una forma que no es
  // la que se subió, y lo que se ve aquí no es lo que se ve luego en la balda
  // (visto: un lomo fino de verdad, apretado aquí en un hueco mucho más
  // ancho, se veía "cortado").
  const anchoLomo = usarAnchoLomo(spineMostrado, anchoLomoBase, altoLomo)

  const set = (clave) => (ev) => setBorrador(b => ({ ...b, [clave]: ev.target.value }))

  async function guardar() {
    setGuardando(true)
    try {
      await onGuardar(borrador)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-6 pb-kb">
      <div className="flex items-center gap-3 py-4">
        <h2 className="flex-1 font-display text-xl font-bold tracking-[-0.01em]">Editar libro</h2>
        <button
          onClick={onCancelar}
          aria-label="Descartar cambios"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-mute transition-colors active:bg-surface-2"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>

      <p className="text-xs leading-relaxed text-ink-dim">
        Toca la portada o el lomo para cambiarlos — lo que elijas se guarda en tu copia, el
        resto del club sigue con la suya. El lomo, si no le pones una foto de verdad (tuya o
        de otro del club, recortada en el momento), se genera solo a partir de la portada.
      </p>

      <div className="mt-3 flex items-end gap-4">
        <motion.button
          onClick={portada.abrir}
          whileTap={{ scale: 0.96 }}
          className="w-24 shrink-0"
          aria-label="Cambiar la portada"
        >
          <Cover url={coverMostrada} title={borrador.title} />
        </motion.button>
        <motion.button
          onClick={lomo.abrir}
          whileTap={{ scale: 0.96 }}
          className="shrink-0 overflow-hidden rounded-sm bg-surface-2"
          style={{ width: anchoLomo, height: altoLomo }}
          aria-label="Cambiar el lomo"
        >
          {spineMostrado && (
            <div className="h-full w-full" style={{ backgroundImage: `url(${spineMostrado})`, backgroundSize: 'cover' }} />
          )}
        </motion.button>
      </div>

      <RellenarDatos borrador={borrador} setBorrador={setBorrador} />

      <Campo etiqueta="Título">
        <input value={borrador.title} onChange={set('title')} className={ENTRADA + ' font-semibold'} />
      </Campo>

      <Campo etiqueta="Autor">
        <input value={borrador.author} onChange={set('author')} className={ENTRADA} />
      </Campo>

      <Campo etiqueta="Género">
        <input value={borrador.genre} onChange={set('genre')} placeholder="Sin género" className={ENTRADA} />
        {/* Los géneros que ya usas, para tocarlos en vez de escribirlos y no
            acabar con "Novela", "novela" y "Novelas" como tres géneros. */}
        {generos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {generos.map(g => (
              <button
                key={g}
                onClick={() => setBorrador(b => ({ ...b, genre: g }))}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  borrador.genre === g ? 'border-accent-line bg-accent-soft text-accent' : 'border-line text-ink-dim'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        )}
      </Campo>

      <div className="flex gap-3">
        <Campo etiqueta="Año" className="flex-1">
          {/* Campo numérico y no un desplegable de mil años: se escribe antes
              de lo que se busca en una rueda, y no monta mil opciones. */}
          <input
            value={borrador.year}
            onChange={ev => setBorrador(b => ({ ...b, year: ev.target.value.replace(/\D/g, '').slice(0, 4) }))}
            inputMode="numeric"
            placeholder="—"
            className={ENTRADA}
          />
        </Campo>
        <Campo etiqueta="Páginas" className="flex-1">
          <input
            value={borrador.num_pages}
            onChange={ev => setBorrador(b => ({ ...b, num_pages: ev.target.value.replace(/\D/g, '').slice(0, 5) }))}
            inputMode="numeric"
            placeholder="—"
            className={ENTRADA}
          />
        </Campo>
      </div>

      <Campo etiqueta="Tamaño">
        <TamanoLibro
          mm={mmElegidos}
          onElegir={mm => setBorrador(b => ({ ...b, height_mm: mm == null ? '' : String(mm) }))}
        />
      </Campo>

      <Campo etiqueta="Sinopsis">
        <textarea
          value={borrador.synopsis}
          onChange={set('synopsis')}
          rows={7}
          className={ENTRADA + ' h-auto resize-none py-3 leading-relaxed'}
        />
      </Campo>

      <div className="mt-6 flex items-center gap-3">
        <motion.button
          onClick={guardar}
          disabled={guardando}
          whileTap={{ scale: 0.98 }}
          className="h-12 flex-1 rounded-xl2 bg-accent text-[15px] font-semibold text-on-accent disabled:opacity-60"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </motion.button>
        <button onClick={onCancelar} className="h-12 px-4 text-[15px] text-ink-dim">
          Cancelar
        </button>
      </div>

      <div className="mt-8 border-t border-line pt-4">
        <BotonPeligro
          etiqueta="Eliminar de mi estantería"
          pregunta="¿Seguro? Se pierden tus notas y fechas."
          onConfirmar={onEliminar}
        />
      </div>

      <SelectorPortada
        abierta={portada.abierta}
        libro={libro}
        elegida={borrador.cover_url}
        onCerrar={portada.cerrar}
        onSubir={onSubirPortada}
        onElegir={(url, { cerrar = true } = {}) => { setBorrador(b => ({ ...b, cover_url: url })); if (cerrar) portada.cerrar() }}
        onPorDefecto={url => setPorDefecto(p => ({ ...p, cover: url }))}
      />

      <SelectorLomo
        abierta={lomo.abierta}
        libro={libro}
        ancho={anchoLomo}
        alto={altoLomo}
        elegida={borrador.spine_url}
        onCerrar={lomo.cerrar}
        onSubir={onSubirLomo}
        onElegir={(url, { cerrar = true } = {}) => { setBorrador(b => ({ ...b, spine_url: url })); if (cerrar) lomo.cerrar() }}
        onPorDefecto={url => setPorDefecto(p => ({ ...p, spine: url }))}
      />
    </div>
  )
}

const ENTRADA = 'h-12 w-full rounded-xl2 border border-line bg-surface px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-mute focus:border-accent-line'

function Campo({ etiqueta, className = '', children }) {
  return (
    <label className={`mt-4 block ${className}`}>
      <span className="mb-1.5 block px-1 text-[13px] text-ink-dim">{etiqueta}</span>
      {children}
    </label>
  )
}

// Cuánto mide el libro de alto. Sin esto, la vista de lomos se lo inventa a
// partir de un hash del título (ver medidas() en Lomos.jsx), y entonces dos
// tomos de la misma edición salen de alturas distintas solo porque se llaman
// distinto — que es lo que esto viene a arreglar. Los tres tamaños de
// siempre están para no tener que medir nada; "a medida" es para el libro
// raro (un álbum ilustrado, un bolsillo antiguo) que no es ninguno de ellos.
// Exportado porque la revisión de una importación lo usa igual (ver
// ListaPrevia.jsx): el alto es un campo que también se puede traer de una
// hoja de cálculo, y elegirlo ahí tiene que sentirse como elegirlo aquí.
export function TamanoLibro({ mm, onElegir }) {
  const preset = TAMANOS.find(t => t.mm === mm)
  const [aMedida, setAMedida] = useState(mm != null && !preset)
  const cm = mm != null ? (mm / 10).toFixed(1).replace('.', ',') : ''

  function escribirCm(texto) {
    const limpio = texto.replace(',', '.').replace(/[^\d.]/g, '').slice(0, 5)
    const valor = Number(limpio)
    if (!limpio || Number.isNaN(valor)) return onElegir(null)
    onElegir(Math.round(valor * 10))
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {TAMANOS.map(t => (
          <button
            key={t.clave}
            type="button"
            onClick={() => { setAMedida(false); onElegir(t.mm) }}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              !aMedida && preset?.clave === t.clave ? 'border-accent-line bg-accent-soft text-accent' : 'border-line text-ink-dim'
            }`}
          >
            {t.nombre} <span className="opacity-60">{(t.mm / 10).toFixed(0)} cm</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAMedida(v => !v)}
          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
            aMedida ? 'border-accent-line bg-accent-soft text-accent' : 'border-line text-ink-dim'
          }`}
        >
          A medida
        </button>
        {mm != null && (
          <button
            type="button"
            onClick={() => { setAMedida(false); onElegir(null) }}
            className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-mute"
          >
            Quitar
          </button>
        )}
      </div>
      {aMedida && (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={cm}
            onChange={ev => escribirCm(ev.target.value)}
            inputMode="decimal"
            placeholder="23,5"
            className={ENTRADA + ' w-24'}
          />
          <span className="text-xs text-ink-mute">cm de alto (de {MM_MIN / 10} a {MM_MAX / 10})</span>
        </div>
      )}
      <p className="mt-2 text-xs leading-relaxed text-ink-mute">
        Para que dos libros que miden lo mismo se vean iguales en la balda. Sin esto, el alto del
        lomo se saca del título, así que dos tomos de una misma saga pueden salir uno más alto que
        otro. El grosor no se toca aquí: ese sale de las páginas.
      </p>
    </>
  )
}

// Rellena de golpe los datos del libro preguntando a Open Library y Google
// Books. Escribe en el borrador, no en el libro: se revisa antes de guardar.
// El título nunca se toca — es lo que identifica al libro y lo que se ha
// usado para buscarlo.
//
// `campos` dice qué se rellena, porque no es lo mismo según desde dónde se
// llame: la ficha de un libro ya guardado edita lo que edita, y el alta a
// mano puede además estrenar el ISBN y la portada, que ahí todavía no
// existen. `soloHuecos` es la otra diferencia: refrescar los datos de un
// libro guardado SUSTITUYE lo que hubiera (es lo que se le pide al botón),
// mientras que en un alta a medio escribir lo que acabas de teclear manda
// sobre lo que diga una API.
const CAMPOS_ENRIQUECIBLES = ['author', 'genre', 'synopsis', 'year', 'num_pages']
const NOMBRE_CAMPO = {
  author: 'autor', genre: 'género', synopsis: 'sinopsis', year: 'año',
  num_pages: 'páginas', isbn: 'ISBN', cover_url: 'portada',
}

export function RellenarDatos({ borrador, setBorrador, campos = CAMPOS_ENRIQUECIBLES, soloHuecos = false }) {
  const [estado, setEstado] = useState('quieto')   // quieto | buscando | ok | nada

  async function rellenar() {
    setEstado('buscando')
    try {
      const params = new URLSearchParams({ title: borrador.title })
      if (borrador.author) params.set('author', borrador.author)
      // Con ISBN la respuesta es la de ESE libro y no la de un candidato
      // parecido por título, así que se manda si se tiene.
      if (borrador.isbn) params.set('isbn', borrador.isbn)
      const fresco = await api(`/books/enrich?${params}`)
      const nuevos = {}
      for (const campo of campos) {
        if (!fresco[campo]) continue
        // El autor no se pisa nunca, ni siquiera refrescando: es la mitad de
        // lo que se ha usado para buscar, y una API que devuelva otro (la
        // edición de otra editorial, un traductor) no sabe más que tú.
        if ((soloHuecos || campo === 'author') && borrador[campo]) continue
        nuevos[campo] = String(fresco[campo])
      }
      const hay = Object.keys(nuevos).length > 0
      if (hay) setBorrador(b => ({ ...b, ...nuevos }))
      setEstado(hay ? 'ok' : 'nada')
    } catch {
      setEstado('nada')
    }
    setTimeout(() => setEstado('quieto'), 2500)
  }

  const lista = campos.map(c => NOMBRE_CAMPO[c])
  const texto = {
    quieto: soloHuecos
      ? 'Rellenar los datos que falten'
      : `Rellenar ${lista.slice(0, -1).join(', ')} y ${lista[lista.length - 1]}`,
    buscando: 'Buscando…',
    ok: 'Datos actualizados',
    nada: 'Sin novedades',
  }[estado]

  return (
    <button
      type="button"
      onClick={rellenar}
      disabled={estado === 'buscando' || !borrador.title}
      className="mt-5 flex items-center gap-2 text-sm font-semibold text-accent disabled:opacity-60"
    >
      <motion.span
        animate={{ rotate: estado === 'buscando' ? 360 : 0 }}
        transition={estado === 'buscando' ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : { duration: 0 }}
        className="flex"
      >
        <IconRefresh className="h-4 w-4" />
      </motion.span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={estado}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {texto}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}

