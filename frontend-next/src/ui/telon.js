// Lo que tienen en común las cosas que cambian de alto sin animar la altura
// (ver ui/Desplegable.jsx): la altura cambia de golpe y lo que hay debajo se
// desliza con `transform` desde donde estaba hasta su sitio nuevo (FLIP), que
// el navegador hace en la GPU a la frecuencia de la pantalla. Animar la
// altura de verdad va en el hilo principal, y Safari lo deja a 60.
//
//   1. fotografiar(nodo)   antes de que cambie nada (en el render)
//   2. el cambio se pinta  (React)
//   3. deslizar(foto, …)   en un useLayoutEffect, antes de que se vea

export const curva = t => `cubic-bezier(${t.ease.join(', ')})`
export const movimientoReducido = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const desplaza = el => {
  const o = getComputedStyle(el).overflowY
  return o === 'auto' || o === 'scroll'
}

// Lo que se mueve cuando esto cambia de alto: los hermanos que van detrás, en
// cada nivel hacia arriba, hasta la primera capa posicionada (una hoja pegada
// abajo, que entonces se mueve entera y lo de dentro se mide contra ella).
// Y la zona con scroll en la que está, con su contenido: al plegar puede
// tener que recolocar el scroll (ver deslizar).
function vecinos(nodo) {
  const lista = []
  let ancla = null
  let zona = null
  let contenido = null
  for (let n = nodo; n && n !== document.body; n = n.parentElement) {
    if (n !== nodo) {
      if (!zona && desplaza(n)) { zona = n; contenido = hijoDe(n, nodo) }
      const pos = getComputedStyle(n).position
      if (pos === 'fixed' || pos === 'absolute') { ancla = n; break }
    }
    for (let s = n.nextElementSibling; s; s = s.nextElementSibling) lista.push(s)
  }
  if (!zona) { zona = document.scrollingElement; contenido = hijoDe(document.body, nodo) }
  return { lista, ancla, zona, contenido }
}

function hijoDe(padre, nodo) {
  let n = nodo
  while (n && n.parentElement !== padre) n = n.parentElement
  return n
}

// Hasta dónde llega de verdad lo desplazable. No vale scrollHeight a secas:
// lo que va marcado con data-fuera-del-alto (la capa de adornos que se estira
// hasta el final del contenido, ver CapaDeContenido en eventos/Adorno) va un
// fotograma por detrás de lo que mide, y al medir cómo quedará plegado aún
// tiene el alto de antes. Con él contado, el telón creía que el scroll no
// tendría que moverse y al acabar todo saltaba de golpe (medido: 581px).
function finDelContenido(zona) {
  if (zona === document.scrollingElement) return zona.scrollHeight
  let fin = 0
  for (const h of zona.children) {
    if (h.hasAttribute('data-fuera-del-alto')) continue
    fin = Math.max(fin, h.offsetTop + h.offsetHeight)
  }
  return Math.max(zona.clientHeight, fin + (parseFloat(getComputedStyle(zona).paddingBottom) || 0))
}

// Dónde empieza lo desplazable de la zona, en la pantalla: lo de dentro se
// mide contra esto, así que no cuenta cuánto esté desplazado (y da igual si el
// navegador mueve el scroll mientras se mide).
function origenZona(zona) {
  if (zona === document.scrollingElement) return -zona.scrollTop
  return zona.getBoundingClientRect().top + zona.clientTop - zona.scrollTop
}

// Dónde está cada uno: lo de dentro del contenido, contra el contenido; lo
// demás de la zona con scroll, contra lo desplazable; lo de fuera, contra la
// hoja si la hay o contra la pantalla.
function posiciones({ lista, ancla, zona, contenido }) {
  const base = ancla ? ancla.getBoundingClientRect().top : 0
  const baseContenido = contenido ? contenido.getBoundingClientRect().top : base
  const baseZona = origenZona(zona)
  const contra = n => (contenido?.contains(n) ? baseContenido : zona.contains(n) ? baseZona : base)
  return {
    ancla: ancla ? base : 0,
    tops: lista.map(n => n.getBoundingClientRect().top - contra(n)),
  }
}

// Dónde está todo tal como se VE ahora (con las animaciones que estén a
// medias): si se toca a mitad de un telón, el siguiente arranca de ahí.
export function fotografiar(nodo) {
  const v = vecinos(nodo)
  return { ...v, antes: posiciones(v) }
}

// Con el DOM ya en su estado ABIERTO (abriendo, o cerrando sin plegar aún),
// mueve lo de debajo. Abriendo, desde donde estaba hasta su sitio; cerrando,
// hasta donde acabará plegado, que se mide aplicando un momento el estado
// plegado (`plegar(true)` / `plegar(false)`) sin que llegue a pintarse.
// Devuelve las animaciones (con fill: 'both': se quedan en su último
// fotograma hasta que se cancelan, justo al plegar de verdad).
//
// `encoge` (opcional, al cerrar): cuánto va a encoger exactamente lo que se
// pliega, si quien llama lo sabe. Entonces no hace falta plegar de mentira
// para medir dónde acabará todo: lo de debajo sube eso mismo. Plegar y
// desplegar de mentira obliga al navegador a recolocar la página entera dos
// veces más dentro del mismo toque; con la estantería de lomos era lo que se
// comía el primer fotograma (medido: 64 de 81ms, CPU frenada x4) y el
// plegado parecía instantáneo. Solo vale dentro de una pantalla que hace
// scroll (la capa que lo contiene no cambia de tamaño); en una hoja que se
// ajusta a su contenido se sigue midiendo.
export function deslizar(foto, { abriendo, plegar, t, encoge = null }) {
  const { zona, contenido } = foto
  const ahora = posiciones(foto)
  let plegado = null
  // Plegando abajo del todo, al quitar el contenido el scroll ya no puede
  // quedarse donde está y el navegador lo sube: todo lo de arriba bajaría de
  // golpe al acabar. Así que eso se hace durante la animación: el contenido
  // entero baja poco a poco lo que vaya a subir el scroll.
  let bajada = 0
  if (!abriendo && encoge != null && foto.ancla === zona) {
    const scroll = zona.scrollTop
    plegado = { ancla: ahora.ancla, tops: ahora.tops.map(top => top - encoge) }
    bajada = Math.max(0, scroll - (Math.max(zona.clientHeight, finDelContenido(zona) - encoge) - zona.clientHeight))
  } else if (!abriendo) {
    const scroll = zona.scrollTop
    plegar(true)
    plegado = posiciones(foto)
    bajada = Math.max(0, scroll - (finDelContenido(zona) - zona.clientHeight))
    plegar(false)
    zona.scrollTop = scroll   // por si medirlo ya lo había movido
  }
  const opciones = { duration: t.duration * 1000, easing: curva(t), fill: 'both' }
  const hechas = []
  const alto = window.innerHeight
  const mover = (n, desde, hasta) => {
    if (Math.abs(desde) < 0.5 && Math.abs(hasta) < 0.5) return
    // Lo que no se ve ni al empezar ni al acabar no hace falta moverlo (con
    // una lista larga detrás serían cientos de animaciones para nada). Pero
    // lo que entra en la pantalla por el camino, sí.
    const r = n.getBoundingClientRect()
    const arriba = Math.min(r.top + desde, r.top + hasta)
    const abajo = Math.max(r.bottom + desde, r.bottom + hasta)
    if (abajo < -200 || arriba > alto + 200) return
    hechas.push(n.animate([{ transform: `translateY(${desde}px)` }, { transform: `translateY(${hasta}px)` }], opciones))
  }
  if (foto.ancla) mover(foto.ancla, foto.antes.ancla - ahora.ancla, abriendo ? 0 : plegado.ancla - ahora.ancla)
  // Lo que baja con el scroll: todo lo que cuelga de la zona. El contenido
  // (y lo de antes) baja tal cual; lo de después, además de su propio
  // movimiento (abajo).
  const enLista = new Set(foto.lista)
  if (bajada > 0.5) {
    for (const hijo of zona === document.scrollingElement ? [contenido] : zona.children) {
      if (hijo && !enLista.has(hijo)) mover(hijo, 0, bajada)
    }
  }
  foto.lista.forEach((n, i) => {
    if (!n.isConnected) return
    // Lo de dentro del contenido ya baja con él; lo demás de la zona baja
    // por su cuenta, sumado a lo suyo.
    const extra = bajada > 0.5 && zona.contains(n) && !contenido?.contains(n) ? bajada : 0
    mover(n, foto.antes.tops[i] - ahora.tops[i], abriendo ? 0 : plegado.tops[i] - ahora.tops[i] + extra)
  })
  return { animaciones: hechas, opciones }
}
