// La proporción real (ancho/alto) de una foto de lomo subida a mano, leída
// de la propia imagen — no hay que calcularla ni suponerla: cada foto sabe
// perfectamente qué forma tiene. Se usa para que el hueco del libro en la
// balda (ver Lomos.jsx) se parezca al lomo de verdad en vez de a una
// proporción inventada.
//
// Solo hace falta el TAMAÑO de la imagen (naturalWidth/naturalHeight), no
// sus píxeles, así que —a diferencia de colorPortada.js— esto funciona con
// cualquier imagen sin toparse con las restricciones de "otro origen" del
// navegador.
//
// Mismo patrón de caché que colorPortada.js: en memoria para lo que dura la
// pestaña, y en disco para no releer la imagen en la siguiente visita.

const CACHE_MEMORIA = new Map()
const CLAVE = 'luni_prop_lomo1'

function cacheDisco() {
  try { return JSON.parse(localStorage.getItem(CLAVE) || '{}') } catch { return {} }
}

function guardarEnDisco(url, ratio) {
  try {
    const todo = cacheDisco()
    todo[url] = ratio
    const claves = Object.keys(todo)
    if (claves.length > 500) return localStorage.setItem(CLAVE, JSON.stringify({ [url]: ratio }))
    localStorage.setItem(CLAVE, JSON.stringify(todo))
  } catch { /* modo privado o almacenamiento lleno: se queda en memoria */ }
}

export function proporcionFoto(url) {
  if (!url) return Promise.resolve(null)
  if (CACHE_MEMORIA.has(url)) return Promise.resolve(CACHE_MEMORIA.get(url))
  const enDisco = cacheDisco()[url]
  if (enDisco !== undefined) {
    CACHE_MEMORIA.set(url, enDisco)
    return Promise.resolve(enDisco)
  }
  return new Promise(resolve => {
    const img = new Image()
    img.onerror = () => resolve(null)   // no se guarda: puede ser un fallo pasajero de red
    img.onload = () => {
      const ratio = img.naturalWidth / img.naturalHeight
      CACHE_MEMORIA.set(url, ratio)
      guardarEnDisco(url, ratio)
      resolve(ratio)
    }
    img.src = url
  })
}

// Leer por adelantado la proporción de un montón de fotos, mismo motivo que
// precargarColores en colorPortada.js: que no se vean los huecos cambiar de
// ancho uno a uno mientras se baja por la balda.
export function precargarProporciones(urls) {
  const cola = [...new Set((urls || []).filter(Boolean))]
  let vivo = true
  let enMarcha = 0
  function siguiente() {
    if (!vivo) return
    while (enMarcha < 6 && cola.length) {
      const url = cola.shift()
      enMarcha++
      proporcionFoto(url).finally(() => { enMarcha--; siguiente() })
    }
  }
  siguiente()
  return () => { vivo = false }
}
