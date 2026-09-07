// Saca el color del lomo de la propia portada, para que el libro de la balda
// se parezca al que tienes en la mano.
//
// Se mira la FRANJA IZQUIERDA de la portada, no la imagen entera: en un libro
// real el lomo continúa por ahí, así que ese borde es lo más parecido que hay
// a su color. Un promedio de toda la portada saldría lavado (casi siempre
// tirando a gris) porque mezcla ilustración, cielo, tipografía y márgenes.
//
// Solo funciona con portadas del MISMO ORIGEN: las que el servidor ya ha
// cacheado en /uploads. Con una de covers.openlibrary.org el navegador
// prohíbe leer los píxeles del canvas y salta la excepción — ahí se devuelve
// null y el lomo se queda con su color por defecto. Cuando esta vista se
// asiente, lo suyo es calcularlo en el servidor al cachear la portada y
// guardarlo con el libro; esto de aquí no haría falta.

const CACHE_MEMORIA = new Map()
const CLAVE = 'luni_colores_lomo'

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

        // Se promedia dando más peso a los píxeles con color: si no, cuatro
        // píxeles de margen blanco se llevan por delante el color real de la
        // franja.
        let r = 0, g = 0, b = 0, peso = 0
        for (let i = 0; i < data.length; i += 4) {
          const max = Math.max(data[i], data[i + 1], data[i + 2])
          const min = Math.min(data[i], data[i + 1], data[i + 2])
          const p = 0.25 + (max - min) / 255      // gris pesa poco, color pesa mucho
          r += data[i] * p; g += data[i + 1] * p; b += data[i + 2] * p; peso += p
        }
        const { h, s, l } = aHsl(r / peso, g / peso, b / peso)
        // Se lleva al rango de un lomo: ni un amarillo fluorescente ni un
        // blanco, que en una balda entera quedarían fatal y no dejarían leer
        // el título encima.
        const color = `hsl(${Math.round(h)} ${Math.round(Math.min(Math.max(s, 18), 55))}% ${Math.round(Math.min(Math.max(l, 24), 46))}%)`
        terminar(color)
      } catch {
        // getImageData con una imagen de otro origen: no se puede leer.
        terminar(null)
      }
    }
    img.src = url
  })
}
