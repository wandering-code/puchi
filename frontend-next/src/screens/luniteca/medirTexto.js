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

// OJO con las fuentes: aquí no vale ni `document.fonts.ready` ni
// `document.fonts.check`.
//
// `ready` solo espera a las fuentes que ya se estaban usando, y las de los
// lomos empiezan a cargarse justo cuando se pinta el primer lomo. Y `check`
// contesta que sí antes de tiempo en WebKit: decía que Libre Baskerville
// estaba lista cuando el navegador seguía pintando con Georgia, más estrecha,
// así que la cuenta daba por bueno un renglón de 104px en un hueco de 96 y el
// título salía cortado en Safari mientras en Chrome se veía perfecto.
//
// Lo único fiable es esperar a que resuelva nuestro propio `fonts.load` de esa
// fuente concreta. Hasta entonces se usa la estimación de siempre, sin
// guardarla, y al llegar la fuente se avisa para repintar con la medida buena.
const listas = new Set()
const pedidas = new Set()
const avisos = new Set()

// Solo el primer nombre de la lista: el resto son las de reserva.
function familiaPrincipal(familia) {
  return familia.split(',')[0].trim().replace(/^['"]|['"]$/g, '')
}

function disponible(tipografia) {
  if (typeof document === 'undefined' || !document.fonts) return false
  const spec = `${tipografia.peso} ${BASE}px "${familiaPrincipal(tipografia.familia)}"`
  if (listas.has(spec)) return true
  if (!pedidas.has(spec)) {
    pedidas.add(spec)
    document.fonts.load(spec).then(() => {
      listas.add(spec)
      // Fuera lo medido a ojo mientras no había fuente.
      CACHE.clear()
      avisos.forEach(fn => fn())
    }).catch(() => {})
  }
  return false
}

// ¿Está ya la fuente de esta tipografía? Además de contestar, la pide si no se
// había pedido. Lo usan los lomos para no enseñar el título hasta poder
// medirlo bien: con la estimación se pintaba un título de un tamaño y al
// llegar la fuente saltaba a otro, y ese baile al entrar en la estantería se
// veía en todos los lomos a la vez.
export function fuenteLista(tipografia) {
  return disponible(tipografia)
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

// Lo que ocupa de ANCHO un renglón de esta tipografía, por punto de tamaño:
// de la tilde más alta al descendente más bajo, o el interlineado si el dibujo
// cabe dentro de él.
//
// Este número es el que se le da luego a cada renglón como ancho y como
// interlineado, en píxeles, para que el bloque mida exactamente lo que la
// cuenta dice. Es lo que permite que el lomo se vea igual en Chrome y en
// Safari: sin ello, cada motor repartía el texto a su manera —WebKit metía
// cinco renglones donde la cuenta permitía tres y el bloque se salía del lomo
// por los dos lados— porque el envoltorio lo decidía el navegador.
const MUESTRA = 'ÁQÑÍGJYPgjyp'
const INTERLINEADO = 1.25

export function anchoDeRenglonPorPunto(tipografia) {
  const clave = `renglon|${tipografia.familia}|${tipografia.peso}|${tipografia.mayusculas}`
  const guardado = CACHE.get(clave)
  if (guardado !== undefined) return guardado
  if (!ctx || !disponible(tipografia)) return 1.4     // sin fuente, lo prudente
  ctx.font = `${tipografia.peso} ${BASE}px ${tipografia.familia}`
  const texto = tipografia.mayusculas ? MUESTRA.toUpperCase() : MUESTRA
  const m = ctx.measureText(texto)
  const dibujo = (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) / BASE
  const valor = Math.max(INTERLINEADO, dibujo)
  CACHE.set(clave, valor)
  return valor
}
