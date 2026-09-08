import { memo, useEffect, useState } from 'react'
import { totalPages } from './shelf'
import { colorDePortada } from './colorPortada'
import { alCargarFuentes, anchoPorPunto } from './medirTexto'

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

// La tipografía se elige por AUTOR, no por libro: en una balda de verdad los
// cuatro tomos del mismo escritor son de la misma colección y llevan el mismo
// diseño de lomo. Eligiéndola por título salían cuatro lomos distintos del
// mismo autor, que es lo que no pasa nunca en una estantería.
function tipografiaDe(entry) {
  const genero = (entry.book.genre || '').toLowerCase()
  const h = huella(entry.book.author || entry.book.title || '')
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

// Lo que ocupa un texto, de largo, a un tamaño dado. La medida es la real de
// la fuente (ver medirTexto.js), con un pelín de holgura: el navegador redondea
// a subpíxeles al pintar y un texto calculado al milímetro se corta.
const HOLGURA = 1.03
function largoDe(texto, tipografia, tamano) {
  if (!texto) return 0
  return anchoPorPunto(texto, tipografia) * tamano * HOLGURA
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

// Reparte el lomo entre título y autor buscando el TÍTULO MÁS GRANDE que
// quepa entero, con los renglones que haga falta.
//
// Un lomo tiene dos medidas y las dos mandan: el largo (lo que da de sí de
// arriba abajo) y el ancho (cuántos renglones caben de canto). Un título que
// no entra de una tirada no se escribe en letra de hormiga: se parte en dos o
// tres renglones, que es lo que hace cualquier lomo de verdad y lo que permite
// que en un tocho de 46px el título se lea de lejos.
//
// El autor va detrás del título a lo LARGO del lomo, no a su lado: el texto
// está de canto, así que lo que se apila a lo ancho son los renglones del
// título, y el autor se lleva su trozo del largo esté el título en una línea o
// en tres. Se abrevia hasta que quepa ("Gabriel García Márquez" → "G. García
// Márquez" → "García Márquez" → "Márquez") y solo desaparece si ni el
// apellido entra.
const MAX_LINEAS = 3
// Lo que ocupa de ANCHO un renglón, por cada punto de letra (interlineado
// incluido).
const ANCHO_RENGLON = 1.25
// El aire entre el final del título y el nombre del autor, a lo largo del
// lomo. Lo reserva el reparto y lo pinta el layout: tienen que ser el mismo
// número o el autor sale pegado al título (se leía "SALVAJESR. Bolaño").
export const SEPARACION_AUTOR = 6

function repartirTexto({ titulo: tituloEntero, autor, largoUtil, anchoLomo, tipografia, tamanoIdeal }) {
  const SEPARACION = SEPARACION_AUTOR
  // El subtítulo va aparte y en segundo plano, como en cualquier lomo
  // impreso: "Apocalipsis Z: El principio del fin" es "Apocalipsis Z" en
  // grande y el resto en pequeño debajo. Metiéndolo todo en el mismo texto, el
  // título de ese libro salía a 9px en un lomo de 37 mientras su vecino, con
  // un lomo más estrecho, lo llevaba a 12.
  const dosPuntos = tituloEntero.indexOf(':')
  const titulo = dosPuntos > 0 ? tituloEntero.slice(0, dosPuntos).trim() : tituloEntero
  const subtitulo = dosPuntos > 0 ? tituloEntero.slice(dosPuntos + 1).trim() : ''
  const anchoLibre = anchoLomo - 4
  // El umbral de ancho es solo para que el autor no ahogue un lomo finísimo.
  const versiones = anchoLomo >= 26 ? abreviaturasDe(autor) : []
  // El autor nunca es más grande que el título: va en segundo plano, como en
  // un lomo impreso. Sin este tope, en un título largo (que baja mucho de
  // tamaño para caber) el autor acababa siendo el texto grande del lomo.
  const topeAutor = t => Math.min(Math.max(TAMANO_MINIMO_AUTOR, tamanoIdeal - 4), t)
  // El nombre del autor se pinta en la misma familia que el título pero sin
  // negrita, sin espaciado y sin mayúsculas, así que se mide con esas mismas
  // propiedades: medirlo como el título lo daba por más largo de lo que es y
  // se quedaba fuera algún nombre que sí cabía.
  const tipoAutor = { ...tipografia, peso: 400, espaciado: '0', mayusculas: false }

  // La palabra más larga del título, por punto de tamaño. El navegador parte
  // por palabras, nunca dentro de una: un título de una sola palabra
  // ("Beloved", "Fundación") NO cabe en dos renglones por mucho que la cuenta
  // diga que sí — se salía del lomo y quedaba cortado.
  const palabraMasLarga = titulo
    .split(/\s+/)
    .reduce((mayor, palabra) => Math.max(mayor, largoDe(palabra, tipografia, 1)), 0)

  // ¿Cabe el título a este tamaño en el largo que le dejan? Devuelve en
  // cuántos renglones, o null si no hay manera.
  const renglonesDelTitulo = (t, largoAutor) => {
    const disponible = largoUtil - largoAutor
    if (disponible <= 0) return null
    const largo = largoDe(titulo, tipografia, t)
    if (largo <= disponible) return t * ANCHO_RENGLON <= anchoLibre ? 1 : null
    // Hay que partirlo: al hacerlo por palabras se pierde un poco al final de
    // cada renglón, y ninguna palabra puede pasarse de largo.
    const porRenglon = disponible * 0.92
    if (palabraMasLarga * t > porRenglon) return null
    const lineas = Math.ceil(largo / porRenglon)
    if (lineas > MAX_LINEAS) return null
    if (lineas * t * ANCHO_RENGLON > anchoLibre) return null
    return lineas
  }

  // El subtítulo es lo último en entrar y lo primero en caerse: solo se pinta
  // si, ya colocados título y autor, aún sobra largo para él en una línea.
  const conSubtitulo = (reparto, largoOcupado) => {
    if (!subtitulo || reparto.lineas > 1) return reparto
    const sobra = largoUtil - largoOcupado - SEPARACION
    const porPunto = largoDe(subtitulo, tipografia, 1) || 1
    const sub = Math.min(Math.max(TAMANO_MINIMO_AUTOR, reparto.tamanoTitulo - 4), Math.floor(sobra / porPunto))
    return sub >= TAMANO_MINIMO_AUTOR ? { ...reparto, sub: subtitulo, tamanoSub: sub } : reparto
  }

  // Primera vuelta: título lo más grande posible CON autor. Manda el tamaño de
  // letra sobre lo completo del nombre — "Márquez" que se lee vale más que un
  // "G. García Márquez" de 5px, que es lo que salía al revés—, así que para
  // cada tamaño de título se busca la letra de autor más grande y, con ella,
  // el nombre más completo que quepa.
  //
  // Y entre dos repartos parecidos gana el de menos renglones: partir
  // "Apocalipsis Z" en "Apocalipsis" y una "Z" suelta se lee peor que bajarle
  // dos puntos a la letra y dejarlo de una tirada. Por eso, al encontrar uno
  // que vale, se siguen probando tamaños dos puntos más pequeños por si alguno
  // cabe en menos renglones.
  const MARGEN_RENGLON = 2
  let mejor = null
  for (let t = tamanoIdeal; t >= TAMANO_MINIMO; t--) {
    if (mejor && (mejor.lineas === 1 || t < mejor.tamanoTitulo - MARGEN_RENGLON)) break
    for (let a = topeAutor(t); a >= TAMANO_MINIMO_AUTOR; a--) {
      let encontrado = null
      for (const version of versiones) {
        const largoAutor = largoDe(version, tipoAutor, a) + SEPARACION
        const lineas = renglonesDelTitulo(t, largoAutor)
        if (lineas) {
          encontrado = {
            tamanoTitulo: t, tamanoAutor: a, lineas, autor: version, titulo,
            largoOcupado: largoDe(titulo, tipografia, t) + largoAutor,
          }
          break
        }
      }
      if (encontrado) {
        if (!mejor || encontrado.lineas < mejor.lineas) mejor = encontrado
        break
      }
    }
  }
  if (mejor) return conSubtitulo(mejor, mejor.largoOcupado)

  // Segunda vuelta: no hay sitio para el autor por ningún lado, manda el
  // título entero.
  for (let t = tamanoIdeal; t >= TAMANO_MINIMO; t--) {
    const lineas = renglonesDelTitulo(t, 0)
    if (lineas) {
      return conSubtitulo(
        { tamanoTitulo: t, tamanoAutor: 0, lineas, autor: null, titulo },
        largoDe(titulo, tipografia, t),
      )
    }
  }
  return { tamanoTitulo: TAMANO_MINIMO, tamanoAutor: 0, lineas: 1, autor: null, titulo }
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
    tamano, tipografia: tipografiaDe(entry), torcido, tapaDura,
  }
}

export default function Lomos({ entries, onAbrir }) {
  // Las medidas del texto dependen de la fuente, y las fuentes propias llegan
  // un momento después. Al llegar, se repinta con las medidas buenas.
  //
  // El número viaja como prop hasta cada lomo A PROPÓSITO: los lomos están
  // memoizados, así que sin una prop que cambie se quedaban con el reparto
  // hecho a ojo con la fuente de reserva (y con el título cortado).
  const [revision, repintar] = useState(0)
  useEffect(() => alCargarFuentes(() => repintar(n => n + 1)), [])

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
      {entries.map(e => <Lomo key={e.id} entry={e} onAbrir={onAbrir} revision={revision} />)}
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
  const [paleta, setPaleta] = useState(null)
  useEffect(() => {
    let vigente = true
    colorDePortada(libro.cover_url).then(p => { if (vigente && p) setPaleta(p) })
    return () => { vigente = false }
  }, [libro.cover_url])

  // Un lomo de fondo claro pide tinta oscura, como cualquier libro con la
  // cubierta clara. Solo se sabe cuando la portada se ha podido leer; con el
  // color de reserva (siempre oscuro) el texto va en blanco.
  const claro = paleta ? paleta.luz >= 58 : false

  // El aire de arriba y abajo. Va con el alto del libro, no fijo: 8px sueltos
  // son un 6% de un lomo bajo pero solo un 4,7% de uno alto, y en los altos el
  // título quedaba pegado al canto de arriba (visto en "La voluntad de
  // muchos"). Un lomo impreso deja bastante más margen que eso.
  const margen = Math.max(10, Math.round(alto * 0.09))
  // El largo aprovechable del lomo, quitando ese aire.
  const largoUtil = alto - margen * 2
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
          backgroundColor: paleta?.color || color,
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
        {/* Velo: separa el texto del fondo. En un lomo oscuro oscurece un poco
            más; en uno claro aclara, porque ahí el título va en tinta oscura,
            como en un libro de verdad con la cubierta clara. */}
        {libro.cover_url && (
          <>
            {/* La franja de la portada estirada trae sus bandas horizontales
                (cielo, tierra, la faja de color), y con tanto contraste el
                título tenía que competir con ellas. Un velo del propio color
                del lomo las calma sin quitarle el carácter: el lomo sigue
                siendo el de ese libro, pero de un color más uniforme, que es
                justo lo que pasa en el lomo impreso. */}
            {paleta && (
              <span
                className="pointer-events-none absolute inset-0"
                style={{ backgroundColor: paleta.color, opacity: 0.45 }}
              />
            )}
            <span className={`pointer-events-none absolute inset-0 ${claro ? 'bg-white/25' : 'bg-ink/20'}`} />
          </>
        )}

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

        {/* Cabezada: el hilo de tela que asoma por arriba y por abajo del lomo
            en un libro cosido. Solo en tapa dura, que es donde la lleva. */}
        {tapaDura && [true, false].map(arriba => (
          <span
            key={String(arriba)}
            className="pointer-events-none absolute inset-x-[1px] h-[2px]"
            style={{
              [arriba ? 'top' : 'bottom']: 1,
              borderRadius: 1,
              // Rayas finas y de poco contraste: la cabezada es un hilo
              // trenzado, no una cremallera (con 2px y mucho contraste
              // parecía justo eso).
              background: 'repeating-linear-gradient(to right, rgba(238,226,205,.55) 0 1px, rgba(155,115,90,.45) 1px 2px)',
              opacity: 0.38,
            }}
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

        {/* Textura: el mismo grano del fondo de la app, muy flojo, para que el
            lomo no se lea como un plano de color liso sino como tela o papel. */}
        <span
          className="pointer-events-none absolute inset-0 opacity-[.18] mix-blend-overlay"
          style={{
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='64' height='64' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E\")",
          }}
        />

        <span
          className="absolute inset-0 flex items-center px-[2px] text-center"
          // De arriba abajo, que es como se leen los lomos aquí: se inclina la
          // cabeza a la derecha y se lee. Al revés (de abajo arriba) es la
          // convención anglosajona y en una balda española se ve del revés.
          // En escritura vertical el eje principal del flex es el vertical, así
          // que el título crece a lo largo del lomo y el autor se queda al pie.
          style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            gap: texto.autor ? SEPARACION_AUTOR : 0,
            // El mismo margen que reserva el reparto: si no coinciden, el
            // título se sale por donde la cuenta creía que había sitio.
            paddingTop: margen,
            paddingBottom: margen,
          }}
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
            className={`min-h-0 flex-1 overflow-hidden leading-tight ${claro ? 'text-[#241f19] drop-shadow-[0_1px_1px_rgba(255,255,255,.5)]' : 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.55)]'} ${texto.lineas === 1 ? 'whitespace-nowrap' : ''}`}
            style={{
              fontFamily: tipografia.familia,
              fontWeight: tipografia.peso,
              letterSpacing: tipografia.espaciado,
              textTransform: tipografia.mayusculas ? 'uppercase' : 'none',
              fontSize: texto.tamanoTitulo,
              textAlign: 'center',
            }}
          >
            {texto.titulo}
          </span>
          {texto.sub && (
            // El subtítulo, en pequeño y algo apagado, como en el lomo
            // impreso: se lee después del título, no compite con él.
            <span
              className={`shrink-0 whitespace-nowrap leading-tight ${claro ? 'text-[#241f19]/80 drop-shadow-[0_1px_1px_rgba(255,255,255,.5)]' : 'text-white/85 drop-shadow-[0_1px_2px_rgba(0,0,0,.55)]'}`}
              style={{
                fontFamily: tipografia.familia,
                fontWeight: tipografia.peso,
                letterSpacing: tipografia.espaciado,
                textTransform: tipografia.mayusculas ? 'uppercase' : 'none',
                fontSize: texto.tamanoSub,
              }}
            >
              {texto.sub}
            </span>
          )}
          {texto.autor && (
            <span
              className={`shrink-0 whitespace-nowrap leading-tight ${claro ? 'text-[#241f19]/85 drop-shadow-[0_1px_1px_rgba(255,255,255,.6)]' : 'text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,.7)]'}`}
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
