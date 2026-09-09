// Saca el color del lomo de la propia portada, para que el libro de la balda
// se parezca al que tienes en la mano.
//
// Se mira la FRANJA IZQUIERDA de la portada, no la imagen entera: en un libro
// real el lomo continúa por ahí, así que ese borde es lo más parecido que hay
// a su color. Un promedio de toda la portada saldría lavado (casi siempre
// tirando a gris) porque mezcla ilustración, cielo, tipografía y márgenes.
//
// Devuelve { color, luz } o null. `luz` es la luminosidad real de la franja
// (0-100), para decidir el color del texto que va encima.
//
// Solo funciona con portadas del MISMO ORIGEN: las que el servidor ya ha
// cacheado en /uploads. Con una de covers.openlibrary.org el navegador
// prohíbe leer los píxeles del canvas y salta la excepción — ahí se devuelve
// null y el lomo se queda con su color por defecto. Cuando esta vista se
// asiente, lo suyo es calcularlo en el servidor al cachear la portada y
// guardarlo con el libro; esto de aquí no haría falta.

const CACHE_MEMORIA = new Map()
const CLAVE = 'luni_colores_lomo2'

function cacheDisco() {
  try { return JSON.parse(localStorage.getItem(CLAVE) || '{}') } catch { return {} }
}

function guardarEnDisco(url, color) {
  try {
    const todo = cacheDisco()
    todo[url] = color
    // Un tope para no llenar el almacenamiento: con cientos de libros esto
    // crecería sin fin. Al pasarse, se empieza de cero — recalcular cuesta
    // unos milisegundos por portada.
    const claves = Object.keys(todo)
    if (claves.length > 500) return localStorage.setItem(CLAVE, JSON.stringify({ [url]: color }))
    localStorage.setItem(CLAVE, JSON.stringify(todo))
  } catch { /* modo privado o almacenamiento lleno: se queda en memoria */ }
}

function aHsl(r, g, b) {
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

// El color en el que está escrito el TÍTULO en la portada, para escribirlo
// igual en el lomo. Sin leer una sola letra y sin OCR:
//
//   1. Se cuantizan los colores en una rejilla gruesa. El grupo más numeroso
//      es el fondo.
//   2. De cada grupo se mira cuánto BORDE tiene por superficie. Aquí está la
//      gracia: una letra es un trazo fino, casi todo borde; un sol, una faja o
//      un cielo son manchas, casi todo interior. Sin esta cuenta, en una
//      portada ilustrada salía elegido el sol en vez del título.
//   3. Gana el que más resalte del fondo teniendo forma de letra.
//
// Aun así no sabe qué es una letra: si una portada lleva una filigrana fina y
// el título en un color plano, se equivocará. Es una aproximación, no una
// lectura.
function colorDelTitulo(ctx, ancho, alto) {
  const { data } = ctx.getImageData(0, 0, ancho, alto)
  const clave = i => (data[i] >> 5) * 10000 + (data[i + 1] >> 5) * 100 + (data[i + 2] >> 5)
  const grupos = new Map()
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 4
      if (data[i + 3] < 16) continue
      const k = clave(i)
      const g = grupos.get(k) || { n: 0, borde: 0, r: 0, g: 0, b: 0 }
      g.n++; g.r += data[i]; g.g += data[i + 1]; g.b += data[i + 2]
      // ¿toca algo que no sea de su color? Entonces es borde.
      const vecinos = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
      for (const [vx, vy] of vecinos) {
        if (vx < 0 || vy < 0 || vx >= ancho || vy >= alto) continue
        if (clave((vy * ancho + vx) * 4) !== k) { g.borde++; break }
      }
      grupos.set(k, g)
    }
  }
  const lista = [...grupos.values()]
    .map(g => ({ n: g.n, filo: g.borde / g.n, r: g.r / g.n, g: g.g / g.n, b: g.b / g.n }))
  if (lista.length < 2) return null
  lista.sort((a, b) => b.n - a.n)
  const total = lista.reduce((suma, g) => suma + g.n, 0)
  const fondo = lista[0]
  const luz = c => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255

  let mejor = null
  for (const g of lista.slice(1)) {
    const parte = g.n / total
    // Ni cuatro píxeles sueltos ni media portada.
    if (parte < 0.004 || parte > 0.30) continue
    const contraste = Math.abs(luz(g) - luz(fondo))
    if (contraste < 0.20) continue
    // Un texto ronda el 0,5 de borde por píxel; una mancha, menos de 0,2.
    if (g.filo < 0.42) continue
    const nota = contraste * g.filo
    if (!mejor || nota > mejor.nota) mejor = { ...g, nota, parte }
  }
  if (!mejor) return null
  return {
    r: Math.round(mejor.r), g: Math.round(mejor.g), b: Math.round(mejor.b),
    parte: +mejor.parte.toFixed(3), filo: +mejor.filo.toFixed(2),
  }
}

export function colorDePortada(url) {
  if (!url) return Promise.resolve(null)
  if (CACHE_MEMORIA.has(url)) return Promise.resolve(CACHE_MEMORIA.get(url))
  const enDisco = cacheDisco()[url]
  if (enDisco !== undefined) {
    CACHE_MEMORIA.set(url, enDisco)
    return Promise.resolve(enDisco)
  }

  return new Promise(resolve => {
    const terminar = (color) => {
      CACHE_MEMORIA.set(url, color)
      guardarEnDisco(url, color)
      resolve(color)
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onerror = () => terminar(null)
    img.onload = () => {
      try {
        // Se dibuja SOLO el 14% izquierdo de la portada, estirado a un lienzo
        // diminuto: el navegador hace el promedio por nosotros al escalar, y
        // leer 4x16 píxeles es instantáneo.
        const lienzo = document.createElement('canvas')
        lienzo.width = 4
        lienzo.height = 16
        const ctx = lienzo.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0, Math.max(1, Math.round(img.width * 0.14)), img.height, 0, 0, 4, 16)
        const { data } = ctx.getImageData(0, 0, 4, 16)

        // La portada entera, aparte y en pequeño, para buscar el color del
        // título.
        const lienzoTitulo = document.createElement('canvas')
        // 96x144 y no menos: a la mitad los renglones se emborronan, el texto
        // deja de tener borde propio y la cuenta del filo no distingue nada.
        lienzoTitulo.width = 96
        lienzoTitulo.height = 144
        const ctxTitulo = lienzoTitulo.getContext('2d', { willReadFrequently: true })
        ctxTitulo.imageSmoothingEnabled = false
        ctxTitulo.drawImage(img, 0, 0, 96, 144)
        const tinta = colorDelTitulo(ctxTitulo, 96, 144)

        // Se promedia dando más peso a los píxeles con color: si no, cuatro
        // píxeles de margen blanco se llevan por delante el color real de la
        // franja.
        let r = 0, g = 0, b = 0, peso = 0
        for (let i = 0; i < data.length; i += 4) {
          // Los píxeles transparentes no cuentan. Sin esto, una portada con
          // alfa (un PNG recortado, un SVG) arrastraba la media al negro: el
          // tono salía bien pero la luminosidad se iba a 3 sobre 100, y con
          // ella la decisión de si el lomo es claro u oscuro.
          const alfa = data[i + 3] / 255
          if (alfa < 0.06) continue
          const max = Math.max(data[i], data[i + 1], data[i + 2])
          const min = Math.min(data[i], data[i + 1], data[i + 2])
          const p = (0.25 + (max - min) / 255) * alfa   // gris pesa poco, color pesa mucho
          r += data[i] * p; g += data[i + 1] * p; b += data[i + 2] * p; peso += p
        }
        // Portada entera transparente: no hay color que sacar.
        if (!peso) return terminar(null)
        const { h, s, l } = aHsl(r / peso, g / peso, b / peso)
        // Se lleva al rango de un lomo: ni un amarillo fluorescente ni un
        // blanco, que en una balda entera quedarían fatal y no dejarían leer
        // el título encima.
        const color = `hsl(${Math.round(h)} ${Math.round(Math.min(Math.max(s, 18), 55))}% ${Math.round(Math.min(Math.max(l, 24), 46))}%)`
        // La luz ORIGINAL de la franja, sin acotar: es la del fondo que se ve
        // de verdad (la portada estirada), y de ella depende si el título se
        // lee mejor en blanco o en negro. Hay portadas claras — la de "El
        // problema final" es gris azulado — donde el texto blanco se pierde.
        terminar({ color, luz: Math.round(l), tinta })
      } catch {
        // getImageData con una imagen de otro origen: no se puede leer.
        terminar(null)
      }
    }
    img.src = url
  })
}
