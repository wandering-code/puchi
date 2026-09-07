// Cuánto mide un texto de verdad con la tipografía que le toca al lomo.
//
// Antes esto se estimaba: cada tipografía llevaba apuntado un "ancho de letra
// media" y el largo salía de multiplicarlo por el número de letras. Esa cuenta
// falla por los dos lados — una "i" y una "W" no miden lo mismo, y el
// espaciado entre letras tampoco entraba —, y se notaba: títulos cortados por
// quedarse corta la estimación ("El camino de los reyes") y títulos escritos
// en letra de hormiga en lomos anchos por pasarse.
//
// Medir con canvas cuesta microsegundos y da el ancho exacto que va a ocupar
// el navegador al pintarlo. Se mide a 100px y se guarda el ancho POR PUNTO de
// tamaño: el ancho de un texto es proporcional al cuerpo de la letra, así que
// con una medición valen todos los tamaños que se prueben después.

const lienzo = typeof document !== 'undefined' ? document.createElement('canvas') : null
const ctx = lienzo ? lienzo.getContext('2d') : null
const CACHE = new Map()

const BASE = 100

// Las fuentes propias (Public Sans, Libre Baskerville, Archivo Narrow) tardan
// un momento en estar disponibles. Si se mide antes, el navegador contesta con
// las medidas de la fuente de reserva y salen mal. Mientras no estén, se
// devuelve la estimación de siempre y se vuelve a medir cuando cargan.
let fuentesListas = false
const avisos = new Set()
if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.ready.then(() => {
    fuentesListas = true
    CACHE.clear()
    avisos.forEach(fn => fn())
  })
}

// Para que la vista se redibuje con las medidas buenas en cuanto haya fuentes.
export function alCargarFuentes(fn) {
  if (fuentesListas) return () => {}
  avisos.add(fn)
  return () => avisos.delete(fn)
}

export function fuentesDisponibles() {
  return fuentesListas
}

// Ancho de un texto por cada punto de tamaño de letra.
export function anchoPorPunto(texto, tipografia) {
  if (!texto) return 0
  const clave = `${tipografia.familia}|${tipografia.peso}|${tipografia.espaciado}|${tipografia.mayusculas}|${texto}`
  const guardado = CACHE.get(clave)
  if (guardado !== undefined) return guardado

  let ancho
  if (!ctx || !fuentesListas) {
    // Reserva mientras no hay fuentes: la estimación de antes.
    ancho = texto.length * tipografia.ancho * (tipografia.mayusculas ? 1.14 : 1)
  } else {
    ctx.font = `${tipografia.peso} ${BASE}px ${tipografia.familia}`
    // letterSpacing en canvas no lo soportan todos los navegadores; si no
    // está, se suma a mano, que para un espaciado en "em" es exacto.
    const espaciado = parseFloat(tipografia.espaciado) || 0
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
    const t = tipografia.mayusculas ? texto.toUpperCase() : texto
    ancho = (ctx.measureText(t).width + espaciado * BASE * t.length) / BASE
  }
  CACHE.set(clave, ancho)
  return ancho
}
