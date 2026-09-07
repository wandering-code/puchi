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

// La tipografía del título, estable por libro.
//
// La fuente de una portada NO se puede detectar: es una imagen, y averiguarlo
// pediría reconocimiento de texto y de tipos. Lo que sí se puede es dar a cada
// libro una tipografía coherente con lo que es, que es lo que hace que una
// balda real se vea variada: cada editorial y cada colección usan la suya.
//
// Se elige por género cuando se conoce (ensayo e historia tiran a romana;
// cómic y novela gráfica, a condensada de palo) y, si no, por el mismo número
// estable que ya decide color y medidas. El resultado no cambia nunca para el
// mismo libro.
// `ancho` es lo que ocupa de largo una letra media, en proporción al tamaño
// de la fuente: sirve para calcular cuánto va a medir un título antes de
// pintarlo. Una condensada ocupa mucho menos que una romana.
const TIPOGRAFIAS = [
  { familia: "'Libre Baskerville', Georgia, serif", peso: 700, espaciado: '0.01em', mayusculas: false, ancho: 0.56 },
  { familia: "'Archivo Narrow', 'Public Sans', sans-serif", peso: 700, espaciado: '0.06em', mayusculas: true, ancho: 0.50 },
  { familia: "'Public Sans', system-ui, sans-serif", peso: 700, espaciado: '0.02em', mayusculas: false, ancho: 0.54 },
  { familia: "'Libre Baskerville', Georgia, serif", peso: 400, espaciado: '0.04em', mayusculas: true, ancho: 0.62 },
]

function tipografiaDe(entry, h) {
  const genero = (entry.book.genre || '').toLowerCase()
  if (/ensayo|historia|filosof|poes|clásic|clasic/.test(genero)) return TIPOGRAFIAS[h % 2 === 0 ? 0 : 3]
  if (/cómic|comic|gráfic|grafic|manga|infantil/.test(genero)) return TIPOGRAFIAS[1]
  return TIPOGRAFIAS[h % TIPOGRAFIAS.length]
}

// Cuánto tiene que medir la letra para que un texto quepa entero en el largo
// disponible. Se prefiere achicar la letra a cortar el texto: un lomo con
// puntos suspensivos no dice qué libro es.
const TAMANO_MINIMO = 6
// El autor aguanta un punto menos que el título: va en segundo plano, como en
// un lomo impreso, y con 6px como suelo para los dos se quedaba fuera en todos
// los libros de título largo (medido: solo salía en la mitad de ellos).
const TAMANO_MINIMO_AUTOR = 5

// Lo que ocupa un texto, de largo, a un tamaño dado.
function largoDe(texto, tipografia, tamano) {
  if (!texto) return 0
  // Las mayúsculas ocupan bastante más que la caja baja.
  return texto.length * tipografia.ancho * (tipografia.mayusculas ? 1.14 : 1) * tamano
}

// Un lomo de verdad no borra al autor cuando no cabe: lo abrevia. "Gabriel
// García Márquez" pasa a "G. García Márquez", después a "García Márquez" y, en
// el peor caso, al apellido solo. Es lo que hacen las editoriales, y es lo que
// permite que el autor salga casi siempre en vez de desaparecer.
function abreviaturasDe(nombre) {
  if (!nombre) return []
  const partes = nombre.trim().split(/\s+/)
  if (partes.length === 1) return [nombre]
  const apellidos = partes.slice(1).join(' ')
  // Sin repetidos: con un nombre de dos palabras varias versiones coinciden.
  return [...new Set([
    nombre,                             // Gabriel García Márquez
    `${partes[0][0]}. ${apellidos}`,    // G. García Márquez
    apellidos,                          // García Márquez
    partes[partes.length - 1],          // Márquez
  ].filter(Boolean))]
}

// Reparte el largo del lomo entre título y autor de forma que se lean LOS DOS
// enteros. El autor se va abreviando hasta que quepa, y solo desaparece si ni
// su apellido solo entra. Y si ni el título solo cabe de una tirada, pasa a
// dos líneas, que es lo que hace un lomo de verdad.
function repartirTexto({ titulo, autor, largoUtil, anchoLomo, tipografia, tamanoIdeal }) {
  const idealAutor = Math.max(TAMANO_MINIMO_AUTOR, tamanoIdeal - 4)
  const SEPARACION = 6
  // El umbral de ancho es solo para que el autor no ahogue un lomo finísimo.
  const versiones = anchoLomo >= 26 ? abreviaturasDe(autor) : []

  // Manda el título: se prueba el tamaño más grande posible y, para ese tamaño,
  // el nombre más completo que quepa en lo que sobra. Encogerlos a la vez
  // guardando la proporción (que es lo que se hacía antes) tiraba el autor en
  // todos los títulos largos, porque el título llegaba al mínimo primero y se
  // llevaba al autor por delante aunque a él aún le sobrara sitio.
  for (let t = tamanoIdeal; t >= TAMANO_MINIMO; t--) {
    const sobra = largoUtil - largoDe(titulo, tipografia, t) - SEPARACION
    if (sobra <= 0) continue
    for (const version of versiones) {
      const cabe = Math.floor(sobra / (largoDe(version, tipografia, 1) || 1))
      const a = Math.min(idealAutor, cabe)
      if (a >= TAMANO_MINIMO_AUTOR) {
        return { tamanoTitulo: t, tamanoAutor: a, lineas: 1, autor: version }
      }
    }
  }

  // No caben los dos en fila: el título pasa a dos líneas, si el lomo tiene
  // ancho para ellas. Ahí el título ya no compite con el autor a lo largo del
  // lomo (cada uno va en su columna) y el autor puede volver, con una columna
  // más. Se intenta ANTES de resignarse a un título solo y diminuto: un lomo
  // de verdad parte el título largo en dos renglones, no lo escribe en
  // letra de hormiga para que quepa de una tirada.
  const anchoLibre = anchoLomo - 4
  const dos = Math.floor((largoUtil * 2) / (largoDe(titulo, tipografia, 1) || 1))
  const tamanoDos = Math.max(TAMANO_MINIMO, Math.min(tamanoIdeal, dos))
  // Aquí lo que aprieta es el ANCHO del lomo, no su largo: dos renglones de
  // título más la columna del autor son tres columnas de letra. Así que el
  // título también va bajando de tamaño hasta que la del autor quepa al lado.
  for (let t = tamanoDos; t >= TAMANO_MINIMO; t--) {
    if (t * 2.5 > anchoLibre) continue
    for (const version of versiones) {
      const cabeLargo = Math.floor(largoUtil / (largoDe(version, tipografia, 1) || 1))
      const a = Math.min(idealAutor, cabeLargo)
      if (a >= TAMANO_MINIMO_AUTOR && t * 2.5 + a * 1.5 <= anchoLibre) {
        return { tamanoTitulo: t, tamanoAutor: a, lineas: 2, autor: version }
      }
    }
  }

  // Sin sitio para el autor por ningún lado: manda el título, entero.
  const soloTitulo = Math.floor(largoUtil / (largoDe(titulo, tipografia, 1) || 1))
  const tamano = Math.min(tamanoIdeal, soloTitulo)
  if (tamano >= TAMANO_MINIMO) {
    return { tamanoTitulo: tamano, tamanoAutor: 0, lineas: 1, autor: null }
  }
  return tamanoDos * 2.5 <= anchoLibre
    ? { tamanoTitulo: tamanoDos, tamanoAutor: 0, lineas: 2, autor: null }
    : { tamanoTitulo: TAMANO_MINIMO, tamanoAutor: 0, lineas: 1, autor: null }
}

function paginasDe(entry) { return totalPages(entry) }

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
  // Uno de cada ocho libros, más o menos, va torcido: en una balda de verdad
  // nunca están todos a plomo. El ángulo es pequeño y siempre el mismo para el
  // mismo libro, y se apoya en su esquina de abajo, como se apoyaría de
  // verdad. Los vecinos no se mueven de sitio (el giro no ocupa espacio), así
  // que se solapan un poco entre ellos, que es justo lo que pasa.
  // El signo y la magnitud salen de OTROS bits del número, no del mismo que
  // decide si va torcido: como ese exige un múltiplo, el resto siempre daba
  // par y todos los torcidos salían idénticos (medido: 2 de 40, los dos a -2°).
  const torcido = h % 7 === 0 ? (((h >> 3) % 2 ? 1 : -1) * (2 + ((h >> 5) % 3))) : 0
  // Los libros gordos van encuadernados en tapa dura: lomo redondeado, con sus
  // cofias arriba y abajo. Los finos son rústica y tienen el lomo plano.
  const tapaDura = (paginasDe(entry) || 0) >= 500

  // El título ocupa el lomo a lo largo, así que su tamaño va con el grosor:
  // en un lomo de 22px una letra de 13 no cabe, y en uno de 46 una de 9 se
  // pierde.
  const tamano = Math.round(9 + (ancho - ANCHO_MIN) / (ANCHO_MAX - ANCHO_MIN) * 5)
  return {
    ancho: Math.round(ancho), alto: Math.round(alto), color: colorDeLomo(h),
    tamano, tipografia: tipografiaDe(entry, h), torcido, tapaDura,
  }
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
  const { ancho, alto, color, tamano, tipografia, torcido, tapaDura } = medidas(entry)
  const libro = entry.book
  // El color de la portada llega después (hay que cargarla y leerla), así que
  // el lomo nace con su color de reserva y cambia al de verdad en cuanto está.
  const [colorReal, setColorReal] = useState(null)
  useEffect(() => {
    let vigente = true
    colorDePortada(libro.cover_url).then(c => { if (vigente && c) setColorReal(c) })
    return () => { vigente = false }
  }, [libro.cover_url])

  // El largo aprovechable del lomo, quitando el aire de arriba y abajo.
  const largoUtil = alto - 16
  const texto = repartirTexto({
    titulo: libro.title,
    autor: libro.author,
    largoUtil,
    anchoLomo: ancho,
    tipografia,
    tamanoIdeal: tamano,
  })

  // Nervios: las bandas en relieve del lomo de una tapa dura. Solo en los
  // libros gruesos, que son los que se encuadernan así.
  const conNervios = tapaDura


  // Un libro inclinado ocupa más sitio del que ocupa de pie: su parte de
  // arriba se va hacia un lado. Ese ancho de más se le reserva al lado que
  // corresponde, porque son libros físicos y no pueden atravesar al vecino.
  // Sin esto, los torcidos se solapaban con el de al lado.
  const desplazamiento = torcido ? Math.ceil(alto * Math.sin(Math.abs(torcido) * Math.PI / 180)) : 0

  return (
    // Cada lomo ocupa una fila de alto fijo y se apoya abajo, para que todos
    // descansen sobre la misma balda aunque midan distinto.
    <div
      className="flex items-end"
      style={{
        height: ALTO_FILA,
        paddingRight: torcido > 0 ? desplazamiento : undefined,
        paddingLeft: torcido < 0 ? desplazamiento : undefined,
      }}
    >
      <button
        onClick={() => onAbrir(entry)}
        aria-label={libro.title}
        title={`${libro.title}${libro.author ? ` — ${libro.author}` : ''}`}
        className="relative overflow-hidden transition-[background-color,transform] duration-300 active:translate-y-[-4px]"
        style={{
          width: ancho,
          height: alto,
          backgroundColor: colorReal || color,
          // Tapa dura: lomo redondeado. Rústica: plano.
          borderRadius: tapaDura ? '4px / 6px' : '2px',
          // Se apoya en su esquina de abajo, que es donde tocaría la balda.
          transform: torcido ? `rotate(${torcido}deg)` : undefined,
          transformOrigin: 'bottom left',
          // Dos sombras: la que un libro proyecta sobre el de su derecha, y la
          // de contacto con la balda. Es lo que hace que la fila parezca tener
          // fondo en vez de ser un montón de rectángulos pegados.
          boxShadow: '3px 0 6px -2px rgba(60,40,20,.45), 0 2px 3px -1px rgba(60,40,20,.35)',
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

        {/* El canto de las páginas asomando por el borde de delante: una franja
            de papel con sus rayas finas, no un simple brillo. En un libro real
            es lo único que se ve del interior desde la balda. */}
        <span
          className="pointer-events-none absolute inset-y-[3px] right-0 w-[3px] opacity-70"
          style={{
            background: 'repeating-linear-gradient(to bottom, rgba(245,238,225,.9) 0 1px, rgba(180,168,150,.75) 1px 2px)',
          }}
        />

        {/* Textura: el mismo grano del fondo de la app, muy flojo, para que el
            lomo no se lea como un plano de color liso sino como tela o papel. */}
        <span
          className="pointer-events-none absolute inset-0 opacity-[.18] mix-blend-overlay"
          style={{
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='64' height='64' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E\")",
          }}
        />

        <span
          className="absolute inset-0 flex items-center px-[2px] py-2 text-center"
          // De arriba abajo, que es como se leen los lomos aquí: se inclina la
          // cabeza a la derecha y se lee. Al revés (de abajo arriba) es la
          // convención anglosajona y en una balda española se ve del revés.
          // En escritura vertical el eje principal del flex es el vertical, así
          // que el título crece a lo largo del lomo y el autor se queda al pie.
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          {/* Una sola línea a lo largo del lomo, recortada con puntos suspensivos
              si no cabe. Antes el título se partía en dos columnas cuando era
              largo, y en un libro torcido el texto se salía del lomo. En
              escritura vertical, text-align centra a lo largo del lomo. */}
          {/* Una línea a lo largo del lomo, con la letra achicada lo que haga
              falta para que el título quepa ENTERO: un lomo con puntos
              suspensivos no dice qué libro es. En escritura vertical,
              text-align es lo que centra a lo largo. */}
          <span
            className={`min-h-0 flex-1 overflow-hidden leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.55)] ${texto.lineas === 1 ? 'whitespace-nowrap' : ''}`}
            style={{
              fontFamily: tipografia.familia,
              fontWeight: tipografia.peso,
              letterSpacing: tipografia.espaciado,
              textTransform: tipografia.mayusculas ? 'uppercase' : 'none',
              fontSize: texto.tamanoTitulo,
              textAlign: 'center',
            }}
          >
            {libro.title}
          </span>
          {texto.autor && (
            <span
              className="shrink-0 whitespace-nowrap leading-tight text-white/75 drop-shadow-[0_1px_2px_rgba(0,0,0,.5)]"
              style={{ fontFamily: tipografia.familia, fontSize: texto.tamanoAutor }}
            >
              {texto.autor}
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
