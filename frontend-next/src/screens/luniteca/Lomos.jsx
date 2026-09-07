import { memo, useEffect, useState } from 'react'
import { totalPages } from './shelf'
import { colorDePortada } from './colorPortada'

// Vista de estantería: los libros de canto, como en una balda de verdad.
//
// Los lomos se DIBUJAN con los datos del libro, no se buscan: no existe
// ninguna fuente de lomos por ISBN — Open Library y Google Books sirven la
// portada (la cara frontal), y el lomo solo aparece en las contadísimas
// ediciones con la sobrecubierta entera escaneada.
//
// El color sale de la propia portada cuando se puede leer (ver
// colorPortada.js): así el lomo se parece al libro que tienes en la mano. Con
// las portadas que sirve Open Library no se puede — son de otro origen y el
// navegador prohíbe leer sus píxeles —, y ahí se usa un color estable sacado
// del título y el autor.
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

// Cuánto de la portada se usa como lomo: el 4% de su izquierda. Estirado al
// ancho del lomo, esa tira no deja reconocer ninguna forma — lo que queda son
// las bandas horizontales de color del diseño, que es justo lo que hereda un
// lomo de verdad (el color de arriba, la franja de la editorial abajo, los
// degradados). Y, a diferencia de leer los píxeles, esto funciona con las
// portadas de Open Library: solo hay que pintarlas, no inspeccionarlas.
const FRANJA = 0.04

const Lomo = memo(function Lomo({ entry, onAbrir }) {
  const { ancho, alto, color } = medidas(entry)
  const libro = entry.book
  const paginas = totalPages(entry)

  // El color de la portada llega después (hay que cargarla y leerla), así que
  // el lomo nace con su color de reserva y cambia al de verdad en cuanto está.
  const [colorReal, setColorReal] = useState(null)
  useEffect(() => {
    let vigente = true
    colorDePortada(libro.cover_url).then(c => { if (vigente && c) setColorReal(c) })
    return () => { vigente = false }
  }, [libro.cover_url])

  // Nervios: las bandas en relieve del lomo de una tapa dura. Solo en los
  // libros gruesos, que son los que se encuadernan así.
  const conNervios = paginas && paginas >= 500
  // El autor solo cabe en los lomos anchos; en uno de 24px estorbaría al
  // título en vez de aportar.
  const cabeElAutor = ancho >= 30 && libro.author

  return (
    // Cada lomo ocupa una fila de alto fijo y se apoya abajo, para que todos
    // descansen sobre la misma balda aunque midan distinto.
    <div className="flex items-end" style={{ height: ALTO_FILA }}>
      <button
        onClick={() => onAbrir(entry)}
        aria-label={libro.title}
        title={`${libro.title}${libro.author ? ` — ${libro.author}` : ''}`}
        className="relative overflow-hidden rounded-[2px] shadow-sm transition-[background-color,transform] duration-300 active:translate-y-[-4px]"
        style={{
          width: ancho,
          height: alto,
          backgroundColor: colorReal || color,
          ...(libro.cover_url && {
            backgroundImage: `url(${libro.cover_url})`,
            // 1/0.04 = 2500%: el 4% izquierdo ocupa todo el ancho del lomo.
            backgroundSize: `${100 / FRANJA}% 100%`,
            backgroundPosition: 'left center',
            backgroundRepeat: 'no-repeat',
          }),
        }}
      >
        {/* Velo: garantiza que el título blanco se lea sobre una franja clara,
            que las hay (portadas de fondo blanco). Sin él habría que adivinar
            la luminancia de una imagen que el navegador no deja inspeccionar
            si viene de otro origen. */}
        {libro.cover_url && <span className="pointer-events-none absolute inset-0 bg-ink/25" />}

        {/* Volumen: un lomo no es plano. Sombra en los dos cantos y una franja
            de luz descentrada hacia la izquierda, que es como le da la luz a un
            libro puesto de pie en una balda. */}
        <span
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(to right, rgba(0,0,0,.35) 0%, rgba(255,255,255,.10) 28%, rgba(0,0,0,.10) 62%, rgba(0,0,0,.32) 100%)' }}
        />

        {/* Filetes dobles arriba y abajo, como los de un lomo impreso. */}
        {[6, 9, alto - 10, alto - 7].map((y, i) => (
          <span
            key={i}
            className="pointer-events-none absolute inset-x-0 h-px"
            style={{ top: y, background: i % 2 ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.3)' }}
          />
        ))}

        {conNervios && [0.34, 0.5, 0.66].map(p => (
          <span
            key={p}
            className="pointer-events-none absolute inset-x-0 h-[4px]"
            style={{
              top: `${p * 100}%`,
              background: 'linear-gradient(to bottom, rgba(255,255,255,.16), rgba(0,0,0,.28))',
            }}
          />
        ))}

        {/* El brillo del borde por donde se abre el libro. */}
        <span className="pointer-events-none absolute inset-y-0 right-0 w-[2px] bg-white/10" />

        <span
          className="absolute inset-0 flex items-center justify-between px-[3px] py-3 text-center"
          // De arriba abajo, que es como se leen los lomos aquí: se inclina la
          // cabeza a la derecha y se lee. Al revés (de abajo arriba) es la
          // convención anglosajona y en una balda española se ve del revés.
          // En vertical-rl el eje principal del flex es el vertical, así que
          // justify-between deja el título arriba y el autor al pie, como en
          // un lomo impreso.
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          <span className="line-clamp-1 text-[9px] font-semibold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.5)]">
            {libro.title}
          </span>
          {cabeElAutor && (
            <span className="line-clamp-1 text-[7px] leading-tight text-white/75 drop-shadow-[0_1px_2px_rgba(0,0,0,.5)]">
              {libro.author}
            </span>
          )}
        </span>

        {entry.rating > 0 && (
          // La nota, como un punto: en 30px de ancho no cabe un número que se
          // lea, pero sí saber de un vistazo cuáles te gustaron.
          <span className="pointer-events-none absolute inset-x-0 bottom-[3px] flex justify-center">
            <span className="h-1.5 w-1.5 rounded-full bg-accent ring-1 ring-black/20" />
          </span>
        )}
      </button>
    </div>
  )
})
