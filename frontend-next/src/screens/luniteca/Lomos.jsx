import { memo } from 'react'
import { totalPages } from './shelf'

// Vista de estantería: los libros de canto, como en una balda de verdad.
//
// Los lomos se DIBUJAN con los datos del libro, no se buscan: no existe
// ninguna fuente de lomos por ISBN — Open Library y Google Books sirven la
// portada (la cara frontal), y el lomo solo aparece en las contadísimas
// ediciones con la sobrecubierta entera escaneada.
//
// De momento el color sale de un hash del título y el autor. Si esta vista
// convence, el siguiente paso es sacarlo de la portada real (calculado una vez
// en el servidor al cachearla): el lomo pega entonces con el libro que ya
// reconoces. En el navegador no se puede leer el color de una portada de Open
// Library — es otro origen y el canvas lo bloquea.
//
// Es una vista aparte a propósito: si no acaba de funcionar, se quita este
// archivo y su entrada en el selector, y las otras dos siguen igual.

const ALTO_FILA = 176        // alto de cada balda, en px
const ALTO_MAX = 168         // el libro más alto
const ALTO_MIN = 132         // el más bajo
const ANCHO_MIN = 22         // un libro finito
const ANCHO_MAX = 46         // un tocho

// Número estable a partir de un texto: el mismo libro sale siempre igual, y
// dos libros distintos casi nunca coinciden.
function huella(texto) {
  let h = 0
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) | 0
  return Math.abs(h)
}

// Tonos de tinta y papel viejo: nada de colores puros, que en una balda
// entera cantarían. Saturación y luminosidad acotadas para que convivan con
// el crema del fondo.
function colorDeLomo(h) {
  const tono = h % 360
  const saturacion = 22 + (h % 18)      // 22–40%
  const luz = 28 + (Math.floor(h / 7) % 14)   // 28–42%
  return `hsl(${tono} ${saturacion}% ${luz}%)`
}

function medidas(entry) {
  const h = huella(`${entry.book.title}·${entry.book.author || ''}`)
  const paginas = totalPages(entry)
  // El grosor sale de las páginas cuando se saben; si no, del hash, para que
  // la balda no quede con veinte lomos idénticos.
  const ancho = paginas
    ? ANCHO_MIN + Math.min(paginas, 1000) / 1000 * (ANCHO_MAX - ANCHO_MIN)
    : ANCHO_MIN + (h % 100) / 100 * (ANCHO_MAX - ANCHO_MIN)
  // Los libros de una balda no miden todos lo mismo: el alto varía un poco,
  // siempre igual para el mismo libro.
  const alto = ALTO_MIN + (h % 100) / 100 * (ALTO_MAX - ALTO_MIN)
  return { ancho: Math.round(ancho), alto: Math.round(alto), color: colorDeLomo(h) }
}

export default function Lomos({ entries, onAbrir }) {
  return (
    <div
      className="flex flex-wrap items-end gap-x-1.5"
      // La balda: una línea al final de cada fila, dibujada con un degradado
      // que se repite cada fila. Así no hace falta partir los libros en filas
      // a mano ni saber cuántos caben.
      style={{
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${ALTO_FILA - 5}px, var(--color-line) ${ALTO_FILA - 5}px ${ALTO_FILA - 2}px, transparent ${ALTO_FILA - 2}px ${ALTO_FILA}px)`,
      }}
    >
      {entries.map(e => <Lomo key={e.id} entry={e} onAbrir={onAbrir} />)}
    </div>
  )
}

const Lomo = memo(function Lomo({ entry, onAbrir }) {
  const { ancho, alto, color } = medidas(entry)
  const libro = entry.book

  return (
    // Cada lomo ocupa una fila de alto fijo y se apoya abajo, para que todos
    // descansen sobre la misma balda aunque midan distinto.
    <div className="flex items-end" style={{ height: ALTO_FILA }}>
      <button
        onClick={() => onAbrir(entry)}
        aria-label={libro.title}
        title={`${libro.title}${libro.author ? ` — ${libro.author}` : ''}`}
        className="relative overflow-hidden rounded-[2px] shadow-sm transition-transform duration-150 active:translate-y-[-4px]"
        style={{ width: ancho, height: alto, background: color }}
      >
        {/* Filetes: los dos cantos claros que tienen casi todos los lomos
            arriba y abajo, y el brillo del borde por donde se abre el libro. */}
        <span className="pointer-events-none absolute inset-x-0 top-2 h-px bg-white/25" />
        <span className="pointer-events-none absolute inset-x-0 bottom-2 h-px bg-white/25" />
        <span className="pointer-events-none absolute inset-y-0 right-0 w-[2px] bg-white/10" />

        <span
          className="absolute inset-0 flex items-center justify-center px-[3px] py-2 text-center text-[9px] font-semibold leading-tight text-white/90"
          // Texto de abajo arriba, como en una estantería de verdad. El título
          // se recorta si no cabe: un lomo no da para más, y el nombre entero
          // está a un toque de distancia.
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
        >
          <span className="line-clamp-1">{libro.title}</span>
        </span>

        {entry.rating > 0 && (
          // La nota, como un punto: en 30px de ancho no cabe un número que se
          // lea, pero sí saber de un vistazo cuáles te gustaron.
          <span className="pointer-events-none absolute inset-x-0 bottom-[6px] flex justify-center">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
        )}
      </button>
    </div>
  )
})
