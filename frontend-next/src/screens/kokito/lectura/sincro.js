// Casar el texto de un capítulo con su audio (#78).
//
// El mapa de cada capítulo (#71) dice en qué segundo empieza y acaba cada
// trozo que se le pidió a Higgs. El texto de esos trozos no es exactamente el
// del libro: lleva comillas, espacios y puntuación retocados, y le faltan
// números romanos sueltos (ver limpiar_texto_voicebox en Kokito). Así que se
// comparan solo letras y números: con eso cada trozo cae en su sitio del
// texto original, y dentro del trozo se reparte el tiempo por caracteres.

const LETRA = /[\p{L}\p{N}]/u

// Los números romanos sueltos que quita la limpieza antes de mandar el texto
// a Higgs (paso 13 de limpiar_texto_voicebox). También se los salta aquí: si
// no, "La abuela V removió el té" no casaba con "La abuela removió el té".
const ROMANO = /(?<![\p{L}\p{N}_])(?:I{1,3}|IV|VI{0,3}|IX|XI{0,3}|XIV|XV|XIX|XX)(?![\p{L}\p{N}_])/gu

// Solo letras y números, en minúscula, y de cada uno su posición en el original.
function normalizar(texto, { sinRomanos = false } = {}) {
  const saltar = new Set()
  if (sinRomanos) {
    for (const m of texto.matchAll(ROMANO)) for (let i = 0; i < m[0].length; i++) saltar.add(m.index + i)
  }
  let norm = ''
  const pos = []
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i]
    if (!saltar.has(i) && LETRA.test(ch)) { norm += ch.toLowerCase()[0]; pos.push(i) }
  }
  return { norm, pos }
}

// Un trozo no puede estar muy lejos del anterior: si lo está, es que se ha
// encontrado otra frase que se le parece.
const LEJOS = 3000

function cerca(pajar, aguja, desde) {
  const i = pajar.indexOf(aguja, desde)
  return i >= 0 && i - desde < LEJOS ? i : -1
}

// [{i, desde, hasta, start, end}]: qué trozo (`i`, su posición en `trozos`) y qué caracteres del texto suenan entre qué
// segundos. Los trozos que no se encuentran (un retoque con otro texto muy
// distinto, por ejemplo) se quedan fuera; los de alrededor cubren el hueco.
export function casar(texto, trozos) {
  if (!texto || !trozos?.length) return []
  const T = normalizar(texto, { sinRomanos: true })
  const out = []
  let cursor = 0
  for (const [i, t] of trozos.entries()) {
    if (t.start == null || t.end == null) continue
    const n = normalizar(t.text || '').norm
    if (!n) continue
    let ini = cerca(T.norm, n, cursor)
    let fin = ini >= 0 ? ini + n.length : -1
    if (ini < 0) {
      // Entero no está: por cómo empieza y cómo acaba.
      const k = Math.min(16, n.length)
      const a = cerca(T.norm, n.slice(0, k), cursor)
      const b = a >= 0 ? cerca(T.norm, n.slice(-k), a) : -1
      if (a < 0 || b < 0 || b + k - a > n.length * 1.5 + 40) continue
      ini = a
      fin = b + k
    }
    // Los signos pegados a los bordes (¡ ¿ « — al principio, ! ? . » al final)
    // van con el trozo: si no, al resaltarlo se quedaban fuera ("¡[Los precios
    // han subido]!"). Sin pasar del trozo anterior ni cruzar un espacio.
    let desde = T.pos[ini]
    let hasta = T.pos[fin - 1] + 1
    const tope = out.length ? out[out.length - 1].hasta : 0
    while (desde > tope && /[^\s\p{L}\p{N}]/u.test(texto[desde - 1])) desde--
    while (hasta < texto.length && /[^\s\p{L}\p{N}]/u.test(texto[hasta])) hasta++
    out.push({ i, desde, hasta, start: t.start, end: t.end })
    cursor = fin
  }
  return out
}

// El segundo en que suena el carácter `off` del texto (o el principio del
// siguiente trozo si cae entre dos, en un título o en lo que no se lee).
export function segundoDe(sincro, off) {
  for (const s of sincro) {
    if (off < s.desde) return s.start
    if (off < s.hasta) return s.start + (s.end - s.start) * (off - s.desde) / Math.max(1, s.hasta - s.desde)
  }
  return null
}

// Por qué carácter del texto va el audio en el segundo `t`.
export function caracterDe(sincro, t) {
  if (!sincro.length) return null
  for (const s of sincro) {
    if (t < s.start) return s.desde
    if (t < s.end) return s.desde + Math.floor((s.hasta - s.desde) * (t - s.start) / Math.max(0.01, s.end - s.start))
  }
  return sincro[sincro.length - 1].hasta - 1
}

// Arreglos de lo que deja el EPUB, solo para leerlo: las capitulares
// separadas de su palabra ("W axillium", "P RÓLOGO", "— N ecesito") y los espacios antes de
// un signo ("Devastadora ."), que suelen venir de una cursiva cortada. Solo se
// quitan espacios, así que casar() da lo mismo con el texto arreglado. Las
// letras que son palabras por sí solas (a, e, o, u, y) no se juntan.
export function arreglar(texto) {
  return (texto || '')
    .replace(/(^|\n)([—―-]\s?)?([B-DF-NP-TV-XZÑ]) (?=\p{L})/gu, '$1$2$3')
    .replace(/(\p{L}) +([.,;:!?…»)\]])/gu, '$1$2')
}

// El texto en párrafos y frases, cada frase con dónde empieza y acaba en el
// texto. Las frases son lo que se toca y lo que se resalta.
const FRASE = /\S[^]*?(?:[.!?…]+[»"”'’)\]]*(?=\s|$)|$)/g

export function trocear(texto) {
  const parrafos = []
  const frases = []
  const linea = /[^\n]+/g
  let m
  while ((m = linea.exec(texto || ''))) {
    if (!m[0].trim()) continue
    const p = { i: parrafos.length, desde: m.index, frases: [] }
    FRASE.lastIndex = 0
    let f
    while ((f = FRASE.exec(m[0]))) {
      const fr = { i: frases.length, p: p.i, desde: m.index + f.index, hasta: m.index + f.index + f[0].length, texto: f[0] }
      p.frases.push(fr)
      frases.push(fr)
      if (f[0].length === 0) FRASE.lastIndex++
    }
    parrafos.push(p)
  }
  return { parrafos, frases }
}

// La frase en la que cae el carácter `off` (búsqueda binaria: se llama cuatro
// veces por segundo mientras suena).
export function fraseEn(frases, off) {
  if (off == null || !frases.length) return null
  let lo = 0
  let hi = frases.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (frases[mid].desde <= off) lo = mid
    else hi = mid - 1
  }
  return frases[lo]
}
