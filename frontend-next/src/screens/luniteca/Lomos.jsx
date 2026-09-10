import { memo, useEffect, useState } from 'react'
import { claveDeAutor, totalPages } from './shelf'
import { colorDePortada } from './colorPortada'
import { alCargarFuentes, anchoDeRenglonPorPunto, anchoPorPunto, fuenteLista } from './medirTexto'

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

// Las medidas de la balda. Los lomos son más anchos y más altos de lo que
// eran: con 22-46px el título salía pegado a los cantos por los lados (medido:
// 2,3px de aire en "Project Hail Mary" o "El problema final") y había que
// achicar mucho la letra. El grosor lo siguen mandando las páginas —un libro
// de 700 páginas nunca es más fino que uno de 300—, lo que cambia es la escala
// entera; el alto va aparte, que dos libros del mismo grosor pueden tener
// formatos distintos.
const ALTO_FILA = 190        // alto de cada balda, en px
const ALTO_MAX = 180         // el libro más alto
const ALTO_MIN = 134         // el más bajo
const ANCHO_MIN = 26         // un libro finito
const ANCHO_MAX = 56         // un tocho

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
// Cuánto se distinguen dos colores (contraste WCAG, de 1 a 21).
function contraste(a, b) {
  const canal = v => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }
  const luz = c => 0.2126 * canal(c[0]) + 0.7152 * canal(c[1]) + 0.0722 * canal(c[2])
  const la = luz(a), lb = luz(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// El color del texto del lomo cuando se saca de la portada.
//
// No se usa tal cual: se le respeta el TONO y se le cambia lo clara que es
// hasta que se lea sobre el lomo. Un lomo siempre acaba siendo oscuro (el
// color de la portada se acota para que la balda no parezca un semáforo), así
// que el rojo de una portada crema, puesto tal cual, quedaba ilegible y se
// descartaba entero. Aclarándolo se conserva lo que importa —que ese libro es
// el rojo— y se puede leer, que es justo lo que hace un lomo de verdad.
function aHslDesde(r, g, b) {
  const rr = r / 255, gg = g / 255, bb = b / 255
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb)
  const l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6
    else if (max === gg) h = ((bb - rr) / d + 2) / 6
    else h = ((rr - gg) / d + 4) / 6
  }
  return { h: h * 360, s: s * 100, l: l * 100 }
}

function aRgbDesde(h, s, l) {
  const c = (1 - Math.abs(2 * (l / 100) - 1)) * (s / 100)
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l / 100 - c / 2
  const tramo = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h / 60) % 6]
  return tramo.map(v => Math.round((v + m) * 255))
}

function colorLegible(paleta) {
  const t = paleta?.tinta
  if (!t) return null
  const lomo = paleta.color.match(/hsl\((\d+) (\d+)% (\d+)%\)/)
  if (!lomo) return null
  const fondo = aRgbDesde(Number(lomo[1]), Number(lomo[2]), Number(lomo[3]))

  const { h, s, l } = aHslDesde(t.r, t.g, t.b)
  // Un color sin color no aporta nada: el blanco y el negro de siempre ya
  // llevan su sombra pensada para leerse sobre cualquier lomo.
  if (s < 12) return null

  // 4.5 es el listón de WCAG para texto normal; el título del lomo va en
  // negrita y con sombra, así que con 3.4 se lee de sobra.
  const META = 3.4
  const vale = ll => contraste(aRgbDesde(h, s, ll), fondo) >= META
  if (vale(l)) return `rgb(${t.r} ${t.g} ${t.b})`
  // Se busca la claridad más parecida a la original que sí se lea, mirando
  // hacia arriba y hacia abajo a la vez: así un rojo oscuro sobre lomo oscuro
  // acaba en rojo claro, y no en blanco.
  for (let paso = 2; paso <= 100; paso += 2) {
    for (const ll of [l + paso, l - paso]) {
      if (ll < 12 || ll > 94) continue
      if (vale(ll)) {
        const [r, g, b] = aRgbDesde(h, Math.min(s + 8, 92), ll)
        return `rgb(${r} ${g} ${b})`
      }
    }
  }
  return null
}

const TIPOGRAFIAS = [
  { familia: "'Libre Baskerville', Georgia, serif", peso: 700, espaciado: '0.01em', mayusculas: false, ancho: 0.56 },
  { familia: "'Archivo Narrow', 'Public Sans', sans-serif", peso: 700, espaciado: '0.06em', mayusculas: true, ancho: 0.50 },
  { familia: "'Public Sans', system-ui, sans-serif", peso: 700, espaciado: '0.02em', mayusculas: false, ancho: 0.54 },
  { familia: "'Libre Baskerville', Georgia, serif", peso: 400, espaciado: '0.04em', mayusculas: true, ancho: 0.62 },
]

// Fantasía: capitales romanas, que es lo que llevan de verdad esos lomos.
// Cinzel no tiene caja baja, así que el nombre del autor va aparte en la romana
// de siempre — en versalitas se leería peor y a ese tamaño no se distinguiría
// del título.
//
// Va FUERA de la lista de arriba a propósito: esa es la del sorteo por autor, y
// si Cinzel entrara en ella le tocaría también a novela negra o a lo que fuera,
// que es justo lo que no queremos (visto: "El problema final" salió en Cinzel).
const FANTASIA = {
  familia: "'Cinzel', 'Libre Baskerville', serif", peso: 600, espaciado: '0.05em', mayusculas: true, ancho: 0.66,
  familiaAutor: "'Libre Baskerville', Georgia, serif",
}

// La tipografía se elige por AUTOR, no por libro: en una balda de verdad los
// cuatro tomos del mismo escritor son de la misma colección y llevan el mismo
// diseño de lomo. Eligiéndola por título salían cuatro lomos distintos del
// mismo autor, que es lo que no pasa nunca en una estantería.
// La clave del autor para elegir su tipografía: el apellido, en minúsculas y
// sin acentos. Así "James Islington" e "Islington" —el mismo escritor escrito
// de dos formas, que pasa según de dónde venga la ficha— caen en la misma
// colección en vez de salir con dos diseños distintos en la misma balda.
// La misma cuenta que usa shelf.js para agrupar por autor: si se separan, un
// autor podría acabar con dos letras distintas.
const claveAutor = claveDeAutor

// `generoDelAutor` es el que predomina entre los libros de ese autor. Manda
// sobre el del libro suelto: el catálogo los trae desiguales (mismo autor,
// unos como Fantasía y otros como Ficción) y eso rompía la colección.
function tipografiaDe(entry, generoDelAutor) {
  const genero = (generoDelAutor || entry.book.genre || '').toLowerCase()
  const h = huella(claveAutor(entry.book.author) || entry.book.title || '')
  if (/ensayo|historia|filosof|poes|clásic|clasic/.test(genero)) return TIPOGRAFIAS[h % 2 === 0 ? 0 : 3]
  if (/cómic|comic|gráfic|grafic|manga|infantil/.test(genero)) return TIPOGRAFIAS[1]
  if (/fantas|épic|epic/.test(genero)) return FANTASIA
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
// El aire a los lados del texto dentro del lomo. Sin él los renglones quedan
// pegados al canto y, con la curvatura y la sombra del lomo, parecen cortados.
const MARGEN_LATERAL = 4
// El aire entre el final del título y el nombre del autor, a lo largo del
// lomo. Lo reserva el reparto y lo pinta el layout: tienen que ser el mismo
// número o el autor sale pegado al título (se leía "SALVAJESR. Bolaño").
export const SEPARACION_AUTOR = 6

// El reparto de un libro no cambia mientras no cambien su lomo ni su letra,
// así que se guarda. Es lo más caro de pintar una balda —hay que probar
// tamaños hasta dar con el que cabe, midiendo cada renglón— y sin esto se
// repetía entero en cada cambio de vista. Se vacía cuando llega una fuente
// nueva, porque entonces las medidas de antes ya no valen.
const REPARTOS = new Map()
alCargarFuentes(() => REPARTOS.clear())

// Los argumentos con los que se reparte el texto de un libro. Están aquí y no
// sueltos en el componente porque los usa también el precalentado: si los dos
// sitios no calculan EXACTAMENTE lo mismo, la clave del guardado no coincide y
// el trabajo adelantado no sirve de nada.
export function argumentosDeTexto(entry, generoDelAutor, yaMedido) {
  const { ancho, alto, tamano, tipografia } = yaMedido || medidas(entry, generoDelAutor)
  // El aire de arriba y abajo, proporcional al alto del lomo.
  const margen = Math.max(10, Math.round(alto * 0.09))
  return { titulo: entry.book.title, autor: entry.book.author, largoUtil: alto - margen * 2, anchoLomo: ancho, tipografia, tamanoIdeal: tamano, margen }
}

function repartirTextoGuardado(args) {
  const { titulo, autor, largoUtil, anchoLomo, tipografia, tamanoIdeal } = args
  const clave = `${titulo}|${autor}|${largoUtil}|${anchoLomo}|${tamanoIdeal}|${tipografia.familia}|${tipografia.peso}|${tipografia.espaciado}|${tipografia.mayusculas}`
  const guardado = REPARTOS.get(clave)
  if (guardado) return guardado
  const hecho = repartirTexto(args)
  // Tope, que una estantería grande con varias vistas llenaría esto sin fin.
  if (REPARTOS.size > 1500) REPARTOS.clear()
  REPARTOS.set(clave, hecho)
  return hecho
}

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
  const anchoLibre = anchoLomo - MARGEN_LATERAL * 2
  // Lo que ocupa de ancho cada renglón de esta tipografía, medido. Es también
  // el ancho y el interlineado que se le pone a cada renglón al pintarlo, así
  // que el bloque mide exactamente esto por el número de renglones, en
  // cualquier navegador.
  const anchoRenglon = anchoDeRenglonPorPunto(tipografia)
  const anchoDelBloque = (lineas, t) => lineas * anchoRenglon * t
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
  const tipoAutor = {
    ...tipografia,
    familia: tipografia.familiaAutor || tipografia.familia,
    peso: 400, espaciado: '0', mayusculas: false,
  }
  const anchoVersion = new Map(versiones.map(v => [v, largoDe(v, tipoAutor, 1)]))

  // Cuántos renglones necesita el título a este tamaño, repartido POR PALABRAS
  // igual que lo hace el navegador: se van metiendo palabras en el renglón
  // mientras quepan y, cuando una no cabe, empieza otro.
  //
  // Antes esto se estimaba dividiendo el largo total entre el disponible, con
  // un descuento del 8% por lo que se pierde al final de cada renglón. Se
  // quedaba corto en los títulos de palabras largas: "El nombre del viento"
  // salía a cuatro renglones donde la cuenta decía tres, y el bloque de texto
  // acababa siendo más ancho que el propio lomo (medido: 50px de texto en un
  // lomo de 45).
  const palabras = titulo.split(/\s+/).filter(Boolean)
  const anchoEspacio = largoDe(' ', tipografia, 1)
  // Los anchos se miden UNA vez por libro, a un punto de tamaño, y luego solo
  // se multiplican: el reparto prueba muchas combinaciones de tamaño, nombre y
  // renglones, y medir dentro de ese bucle costaba 160 ms de más con 300
  // libros (medido con la CPU a 1/4).
  const anchosPalabras = palabras.map(palabra => largoDe(palabra, tipografia, 1))

  const renglonesNecesarios = (t, disponible) => {
    const lineas = []
    let actual = ''
    let ancho = 0
    for (let i = 0; i < palabras.length; i++) {
      const w = anchosPalabras[i] * t
      if (w > disponible) return null          // no cabe ni sola: este tamaño no vale
      if (!actual) { actual = palabras[i]; ancho = w; continue }
      const conEspacio = ancho + anchoEspacio * t + w
      if (conEspacio <= disponible) { actual += ` ${palabras[i]}`; ancho = conEspacio }
      else { lineas.push(actual); actual = palabras[i]; ancho = w }
    }
    lineas.push(actual)
    const ultima = lineas[lineas.length - 1]
    // Viuda: el último renglón se queda con una palabra corta y sola. En
    // composición no se deja nunca, y en un lomo canta más todavía
    // ("APOCALIPSIS" y debajo una "Z" suelta).
    return { lineas: lineas.length, texto: lineas, viuda: lineas.length > 1 && !ultima.includes(' ') && ultima.length <= 2 }
  }

  // Los renglones se apilan desde el canto de la derecha (es escritura
  // vertical) y el hueco que sobra se queda todo del lado izquierdo, así que
  // el texto acaba descentrado —medido: 4,5px de aire a un lado y 3,3 al
  // otro—. Se reparte a partes iguales moviendo el bloque medio sobrante.
  // Ya no hace falta corregir el centrado: cada renglón ocupa exactamente el
  // ancho que se le da, así que el bloque queda centrado por sí solo.
  const ajusteOptico = () => 0

  // ¿Cabe el título a este tamaño en el largo que le dejan? Devuelve en
  // cuántos renglones, o null si no hay manera.
  const renglonesDelTitulo = (t, largoAutor) => {
    const disponible = largoUtil - largoAutor
    if (disponible <= 0) return null
    const plan = renglonesNecesarios(t, disponible)
    if (!plan || plan.lineas > MAX_LINEAS) return null
    const { lineas } = plan
    plan.largoTitulo = disponible
    // El ancho del bloque: los renglones se colocan cada uno a una distancia
    // de interlineado, pero el dibujo de las letras del último sobresale de su
    // caja de línea (ascendentes, tildes, descendentes). Contarlo todo a
    // interlineado dejaba el texto asomando un píxel por el canto.
    if (anchoDelBloque(lineas, t) > anchoLibre) return null
    return plan
  }

  // El subtítulo es lo último en entrar y lo primero en caerse: solo se pinta
  // si, ya colocados título y autor, aún sobra largo para él en una línea.
  const conSubtitulo = (reparto, largoOcupado) => {
    if (!subtitulo || reparto.lineas > 1) return reparto
    const sobra = largoUtil - largoOcupado - SEPARACION
    const porPunto = largoDe(subtitulo, tipografia, 1) || 1
    const sub = Math.min(Math.max(TAMANO_MINIMO_AUTOR, reparto.tamanoTitulo - 4), Math.floor(sobra / porPunto))
    if (sub < TAMANO_MINIMO_AUTOR) return reparto
    return {
      ...reparto,
      sub: subtitulo,
      tamanoSub: sub,
      largoTitulo: reparto.largoTitulo - largoDe(subtitulo, tipografia, sub) - SEPARACION,
    }
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
  const MARGEN_RENGLON = 3
  // Cada mejora tiene su precio en tamaño de letra, porque lo que manda sigue
  // siendo que el título se lea:
  //   - quitar una palabra suelta al final ("APOCALIPSIS" y debajo una "Z")
  //     compensa hasta tres puntos;
  //   - juntar el título en menos renglones, nada: solo se prefiere a
  //     igualdad de tamaño. Pagando un punto por ello, los títulos acababan de
  //     una tirada pero dos puntos más pequeños y con el lomo medio vacío.
  // Sin precio, un título de 9px en dos renglones acababa a 6px en uno solo.
  const mejorQue = (cand, act) => {
    const perdida = act.tamanoTitulo - cand.tamanoTitulo
    if (act.viuda && !cand.viuda && perdida <= MARGEN_RENGLON) return true
    if (cand.lineas < act.lineas && !cand.viuda && perdida <= 0) return true
    return false
  }
  let mejor = null
  let techo = null      // el primer tamaño que valió: el límite es SUYO, no el
                        // del mejor de turno, o cada candidato nuevo bajaría el
                        // listón y el título acabaría en letra de hormiga.
  for (let t = tamanoIdeal; t >= TAMANO_MINIMO; t--) {
    if (mejor && ((mejor.lineas === 1 && !mejor.viuda) || t < techo - MARGEN_RENGLON)) break
    for (let a = topeAutor(t); a >= TAMANO_MINIMO_AUTOR; a--) {
      let encontrado = null
      for (const version of versiones) {
        const largoAutor = anchoVersion.get(version) * a + SEPARACION
        const plan = renglonesDelTitulo(t, largoAutor)
        if (plan) {
          encontrado = {
            tamanoTitulo: t, tamanoAutor: a, lineas: plan.lineas, viuda: plan.viuda, autor: version, titulo,
            largoTitulo: plan.largoTitulo,
            renglones: plan.texto,
            anchoRenglon: anchoRenglon * t,
            largoOcupado: largoDe(titulo, tipografia, t) + largoAutor,
          }
          break
        }
      }
      if (encontrado) {
        if (techo === null) techo = encontrado.tamanoTitulo
        if (!mejor || mejorQue(encontrado, mejor)) mejor = encontrado
        break
      }
    }
  }
  if (mejor) return conSubtitulo({ ...mejor, ajuste: 0 }, mejor.largoOcupado)

  // Segunda vuelta: no hay sitio para el autor por ningún lado, manda el
  // título entero.
  for (let t = tamanoIdeal; t >= TAMANO_MINIMO; t--) {
    const plan = renglonesDelTitulo(t, 0)
    if (plan) {
      return conSubtitulo(
        {
          tamanoTitulo: t, tamanoAutor: 0, lineas: plan.lineas, autor: null, titulo,
          largoTitulo: plan.largoTitulo, renglones: plan.texto, anchoRenglon: anchoRenglon * t, ajuste: 0,
        },
        largoDe(titulo, tipografia, t),
      )
    }
  }
  return {
    tamanoTitulo: TAMANO_MINIMO, tamanoAutor: 0, lineas: 1, autor: null, titulo,
    largoTitulo: largoUtil, renglones: [titulo], anchoRenglon: anchoRenglon * TAMANO_MINIMO, ajuste: 0,
  }
}

function paginasDe(entry) { return totalPages(entry) }

function medidas(entry, generoDelAutor) {
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
  const tamano = Math.round(10 + (ancho - ANCHO_MIN) / (ANCHO_MAX - ANCHO_MIN) * 6)
  return {
    ancho: Math.round(ancho), alto: Math.round(alto), color: colorDeLomo(h),
    tamano, tipografia: tipografiaDe(entry, generoDelAutor), torcido, tapaDura,
  }
}

// Cuántos lomos se pintan de una vez. Con una estantería llena, hacerlo de
// golpe bloqueaba el hilo más de un segundo y medio (medido con 300 libros y
// la CPU a 1/6), y por eso el propio botón que cambia de vista se quedaba sin
// animar. Repartido en tandas, el navegador respira entre una y otra.
const PRIMERA_TANDA = 40
const TANDA = 60

export default function Lomos({ entries, onAbrir, fueraId = null, generosDeAutor = null }) {
  // Las medidas del texto dependen de la fuente, y las fuentes propias llegan
  // un momento después. Al llegar, se repinta con las medidas buenas.
  //
  // El número viaja como prop hasta cada lomo A PROPÓSITO: los lomos están
  // memoizados, así que sin una prop que cambie se quedaban con el reparto
  // hecho a ojo con la fuente de reserva (y con el título cortado).
  const [pintados, setPintados] = useState(() => Math.min(entries.length, PRIMERA_TANDA))
  useEffect(() => {
    if (pintados >= entries.length) return
    const id = requestAnimationFrame(() => setPintados(n => Math.min(entries.length, n + TANDA)))
    return () => cancelAnimationFrame(id)
  }, [pintados, entries.length])

  const [revision, repintar] = useState(0)
  useEffect(() => alCargarFuentes(() => repintar(n => n + 1)), [])
  // Si alguna fuente no llegara, a los 1,2s se enseña el título con lo que
  // haya: mejor un título medido a ojo que un lomo mudo para siempre.
  const [seAcabaLaEspera, acabar] = useState(false)
  useEffect(() => {
    const reloj = setTimeout(() => acabar(true), 1200)
    return () => clearTimeout(reloj)
  }, [])

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
      {entries.map((e, i) => (
        <Lomo
          key={e.id}
          entry={e}
          onAbrir={onAbrir}
          revision={revision}
          volando={e.id === fueraId}
          sinPrisa={seAcabaLaEspera}
          generoDelAutor={generosDeAutor?.get(claveAutor(e.book.author)) || null}
          // Los que todavía no toca se montan VACÍOS: ocupan su sitio exacto
          // pero no llevan nada dentro. Antes ni siquiera se montaban, y la
          // balda entraba midiendo una séptima parte de lo que iba a medir
          // (1.421px de 9.401 con 300 libros) e iba creciendo a saltos: si
          // bajabas deprisa te topabas con el fondo y el fondo se alejaba.
          conContenido={i < pintados}
        />
      ))}
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

const Lomo = memo(function Lomo({ entry, onAbrir, volando = false, sinPrisa = false, generoDelAutor = null, conContenido = true }) {
  // Una sola vez: antes se medía aquí y otra vez dentro de argumentosDeTexto,
  // y con la balda entera montada eso era el doble de trabajo por lomo.
  const medido = medidas(entry, generoDelAutor)
  const { ancho, alto, color, tamano, tipografia, torcido, tapaDura } = medido
  const conLetra = sinPrisa || fuenteLista(tipografia)
  const libro = entry.book
  // El color de la portada llega después (hay que cargarla y leerla), así que
  // el lomo nace con su color de reserva y cambia al de verdad en cuanto está.
  const [paleta, setPaleta] = useState(null)
  useEffect(() => {
    // Solo el que se va a llenar: leer la portada cuesta cargarla y mirarla
    // píxel a píxel, y con la balda entera montada eran trescientas a la vez.
    if (!conContenido) return
    let vigente = true
    colorDePortada(libro.cover_url).then(p => { if (vigente && p) setPaleta(p) })
    return () => { vigente = false }
  }, [libro.cover_url, conContenido])

  // Un lomo de fondo claro pide tinta oscura, como cualquier libro con la
  // cubierta clara. Solo se sabe cuando la portada se ha podido leer; con el
  // color de reserva (siempre oscuro) el texto va en blanco.
  const claro = paleta ? paleta.luz >= 58 : false
  // El título, escrito con la tinta de su propia portada — si se lee. Se
  // compara con el color del lomo (que también sale de la portada) y solo se
  // usa cuando hay contraste de sobra; si no, se queda el blanco o el negro de
  // siempre, que es lo que garantiza que el lomo se pueda leer en la balda.
  const tintaPropia = colorLegible(paleta)

  // El aire de arriba y abajo. Va con el alto del libro, no fijo: 8px sueltos
  // son un 6% de un lomo bajo pero solo un 4,7% de uno alto, y en los altos el
  // título quedaba pegado al canto de arriba (visto en "La voluntad de
  // muchos"). Un lomo impreso deja bastante más margen que eso.
  const { margen, ...argumentos } = argumentosDeTexto(entry, generoDelAutor, medido)
  // Repartir el título es lo más caro de un lomo, así que el que va vacío ni
  // lo intenta: se hará cuando le toque llenarse.
  const texto = conContenido ? repartirTextoGuardado(argumentos) : null

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
        // Se pasa el nodo: la animación de abrir clona este mismo lomo para
        // que el que sale volando sea idéntico al que estaba en la balda.
        onClick={ev => onAbrir(entry, ev.currentTarget)}
        aria-label={libro.title}
        title={`${libro.title}${libro.author ? ` — ${libro.author}` : ''}`}
        className={`relative overflow-hidden transition-[background-color,transform] duration-300 active:translate-y-[-4px] ${volando ? 'invisible' : ''}`}
        style={{
          width: ancho,
          height: alto,
          // El navegador se salta el pintado de los lomos que no se ven, pero
          // el lomo SIGUE en el DOM: al desplazarse no hay que montar nada, así
          // que el scroll no da tirones. El tamaño va declarado para que no
          // haga falta mirar dentro para saber cuánto ocupa.
          contentVisibility: 'auto',
          containIntrinsicSize: `${ancho}px ${alto}px`,
          // Sin llenar todavía: un hueco del color del papel, no un libro. Con
          // el color de reserva se veía un lomo morado que un instante después
          // se volvía azul marino al llegar su portada, y ese cambio de color
          // cantaba más que el propio hueco.
          backgroundColor: conContenido ? (paleta?.color || color) : 'color-mix(in srgb, var(--color-line) 55%, transparent)',
          // Tapa dura: lomo redondeado. Rústica: plano.
          borderRadius: tapaDura ? '4px / 6px' : '2px',
          // Se apoya en su esquina de abajo, que es donde tocaría la balda.
          transform: torcido ? `rotate(${torcido}deg)` : undefined,
          transformOrigin: 'bottom left',
          // Dos sombras: la que un libro proyecta sobre el de su derecha, y la
          // de contacto con la balda. Es lo que hace que la fila parezca tener
          // fondo en vez de ser un montón de rectángulos pegados.
          boxShadow: conContenido
            ? '3px 0 6px -2px rgba(60,40,20,.45), 0 2px 3px -1px rgba(60,40,20,.35)'
            : 'none',
          ...(conContenido && libro.cover_url && {
            backgroundImage: `url(${libro.cover_url})`,
            // 1/0.04 = 2500%: el 4% izquierdo ocupa todo el ancho del lomo.
            backgroundSize: `${100 / FRANJA}% 100%`,
            backgroundPosition: 'left center',
            backgroundRepeat: 'no-repeat',
          }),
        }}
      >
        {/* Un lomo sin llenar todavía: se ve su tamaño y su color, que es lo
            que hace falta para que la balda mida lo que tiene que medir. */}
        {conContenido && (<>
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
          className="absolute inset-0 flex items-center text-center"
          // De arriba abajo, que es como se leen los lomos aquí: se inclina la
          // cabeza a la derecha y se lee. Al revés (de abajo arriba) es la
          // convención anglosajona y en una balda española se ve del revés.
          // En escritura vertical el eje principal del flex es el vertical, así
          // que el título crece a lo largo del lomo y el autor se queda al pie.
          style={{
            // El título espera a tener su fuente. Sin esto se pintaba primero
            // con la medida estimada y saltaba de tamaño al llegar la letra
            // buena: al entrar en la estantería se veían todos los lomos
            // recolocarse a la vez. El lomo (color, tamaño, relieve) sí sale al
            // instante; lo único que llega un pelín después es lo escrito.
            opacity: conLetra ? 1 : 0,
            transition: 'opacity 140ms ease-out',
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            gap: texto.autor ? SEPARACION_AUTOR : 0,
            // El mismo margen que reserva el reparto: si no coinciden, el
            // título se sale por donde la cuenta creía que había sitio.
            paddingTop: margen,
            paddingBottom: margen,
            paddingLeft: MARGEN_LATERAL,
            paddingRight: MARGEN_LATERAL,
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
          {/* El título, un renglón por elemento. Los partimos nosotros (ver
              repartirTexto) en vez de dejar que el navegador envuelva el
              texto: así el número de renglones y el ancho del bloque son los
              que dice la cuenta, y no lo que decida cada motor. Antes lo hacía
              el navegador y Safari no repartía igual que Chrome — metía cinco
              renglones donde la cuenta permitía tres y el título se salía del
              lomo por los dos lados (medido: -7,7px).

              Cada renglón ocupa de ancho, y de interlineado, lo mismo: lo que
              mide el dibujo de esa tipografía. */}
          <span
            data-parte="titulo"
            // Lo que la cuenta le reservó, para poder compararlo en las
            // pruebas con lo que el navegador le da de verdad.
            data-largo={Math.round(texto.largoTitulo)}
            className={`shrink-0 ${claro ? 'text-[#241f19] drop-shadow-[0_1px_1px_rgba(255,255,255,.5)]' : 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.55)]'}`}
            style={{
              // El color de la portada, si lo hay y se lee; si no, manda la
              // clase (el blanco o el negro de siempre).
              ...(tintaPropia ? { color: tintaPropia } : null),
              fontFamily: tipografia.familia,
              fontWeight: tipografia.peso,
              letterSpacing: tipografia.espaciado,
              textTransform: tipografia.mayusculas ? 'uppercase' : 'none',
              fontSize: texto.tamanoTitulo,
              // `block`, no flex: en escritura vertical los bloques se apilan
              // a lo ancho, que es como se colocan los renglones de un lomo.
              // Con flex se ponían uno detrás de otro a lo largo y se
              // encabalgaban unos con otros (visto en Safari).
              display: 'block',
              height: Math.max(0, Math.floor(texto.largoTitulo)),
            }}
          >
            {texto.renglones.map((linea, i) => (
              <span
                key={i}
                data-parte="renglon"
                className="block whitespace-nowrap text-center"
                style={{ width: texto.anchoRenglon, lineHeight: `${texto.anchoRenglon}px` }}
              >
                {linea}
              </span>
            ))}
          </span>
          {texto.sub && (
            // El subtítulo, en pequeño y algo apagado, como en el lomo
            // impreso: se lee después del título, no compite con él.
            <span
              data-parte="subtitulo"
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
              data-parte="autor"
              className={`shrink-0 whitespace-nowrap leading-tight ${claro ? 'text-[#241f19]/85 drop-shadow-[0_1px_1px_rgba(255,255,255,.6)]' : 'text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,.7)]'}`}
              style={{ fontFamily: tipografia.familiaAutor || tipografia.familia, fontSize: texto.tamanoAutor }}
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
        </>)}
      </button>
    </div>
  )
})
