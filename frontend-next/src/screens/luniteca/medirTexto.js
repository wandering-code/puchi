// Cuánto mide un texto de verdad con la tipografía que le toca al lomo.
//
// Antes esto se estimaba: cada tipografía llevaba apuntado un "ancho de letra
// media" y el largo salía de multiplicarlo por el número de letras. Esa cuenta
// falla por los dos lados — una "i" y una "W" no miden lo mismo, y el
// espaciado entre letras tampoco entraba —, y se notaba: títulos cortados por
// quedarse corta la estimación y títulos escritos en letra de hormiga en lomos
// anchos por pasarse.
//
// Medir con canvas cuesta microsegundos y da el ancho exacto que va a ocupar
// el navegador al pintarlo (comprobado: canvas + el espaciado sumado a mano
// da el mismo píxel que measure del DOM). Se mide a 100px y se guarda el ancho
// POR PUNTO de tamaño: el ancho de un texto es proporcional al cuerpo de la
// letra, así que con una medición valen todos los tamaños que se prueben
// después.

const lienzo = typeof document !== 'undefined' ? document.createElement('canvas') : null
const ctx = lienzo ? lienzo.getContext('2d') : null
const CACHE = new Map()
const BASE = 100

// OJO con las fuentes: `document.fonts.ready` NO vale aquí. Solo espera a las
// fuentes que ya se estaban usando cuando se le preguntó, y las de los lomos
// (Libre Baskerville, Archivo Narrow) empiezan a cargarse justo cuando se
// pinta el primer lomo. Midiendo con `ready` salía la fuente de reserva
// (Georgia, bastante más estrecha) y por eso se cortaban títulos: la cuenta
// creía que "BELOVED" medía 53px y en pantalla medía 75.
//
// Así que se pregunta por CADA fuente concreta: si no está lista, se pide y se
// devuelve la estimación de siempre sin guardarla en la caché; cuando llega,
// se avisa y la vista se repinta ya con la medida buena.
const pedidas = new Set()
const avisos = new Set()

// Solo el primer nombre de la lista: `fonts.check` con una familia genérica de
// reserva ("serif") contesta que sí aunque la de verdad no esté.
function familiaPrincipal(familia) {
  return familia.split(',')[0].trim().replace(/^['"]|['"]$/g, '')
}

function disponible(tipografia) {
  if (typeof document === 'undefined' || !document.fonts) return false
  const spec = `${tipografia.peso} ${BASE}px "${familiaPrincipal(tipografia.familia)}"`
  if (document.fonts.check(spec)) return true
  if (!pedidas.has(spec)) {
    pedidas.add(spec)
    document.fonts.load(spec).then(() => avisos.forEach(fn => fn())).catch(() => {})
  }
  return false
}

// Para que la vista se redibuje con las medidas buenas en cuanto haya fuentes.
export function alCargarFuentes(fn) {
  avisos.add(fn)
  return () => avisos.delete(fn)
}

// Ancho de un texto por cada punto de tamaño de letra.
export function anchoPorPunto(texto, tipografia) {
  if (!texto) return 0
  const clave = `${tipografia.familia}|${tipografia.peso}|${tipografia.espaciado}|${tipografia.mayusculas}|${texto}`
  const guardado = CACHE.get(clave)
  if (guardado !== undefined) return guardado

  // Reserva mientras la fuente no esté: la estimación de antes. No se guarda,
  // para volver a medirla de verdad en cuanto cargue.
  if (!ctx || !disponible(tipografia)) {
    return texto.length * tipografia.ancho * (tipografia.mayusculas ? 1.14 : 1)
  }

  ctx.font = `${tipografia.peso} ${BASE}px ${tipografia.familia}`
  const t = tipografia.mayusculas ? texto.toUpperCase() : texto
  // El espaciado entre letras no lo aplica measureText en todos los
  // navegadores; sumarlo a mano es exacto, porque va en "em".
  const espaciado = parseFloat(tipografia.espaciado) || 0
  const ancho = (ctx.measureText(t).width + espaciado * BASE * t.length) / BASE
  CACHE.set(clave, ancho)
  return ancho
}

// Lo que ocupa de ANCHO un renglón de esta tipografía, por punto de tamaño.
//
// En escritura vertical los renglones se apilan a lo ancho del lomo, así que
// esto decide cuántos caben. Es lo que ocupa el DIBUJO de las letras (de la
// tilde más alta al descendente más bajo), que es menos que el interlineado:
// medido, 1,14 en Libre Baskerville y 1,18 en Archivo Narrow, contra el 1,25
// del interlineado. La cuenta usa el interlineado para separar renglones y
// esto para el último, que es hasta donde llega la tinta.
const MUESTRA = 'ÁQÑgjyp'

export function anchoDeRenglonPorPunto(tipografia) {
  const clave = `renglon|${tipografia.familia}|${tipografia.peso}`
  const guardado = CACHE.get(clave)
  if (guardado !== undefined) return guardado
  if (!ctx || !disponible(tipografia)) return 1.25   // sin fuente, lo prudente
  ctx.font = `${tipografia.peso} ${BASE}px ${tipografia.familia}`
  const m = ctx.measureText(MUESTRA)
  const alto = (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) / BASE
  // Un suelo defensivo por si una fuente contesta medidas absurdas.
  const valor = Math.max(0.9, alto)
  CACHE.set(clave, valor)
  return valor
}
