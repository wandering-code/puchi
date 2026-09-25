import { useEffect, useState } from 'react'

// Imágenes de lomo descargadas Y decodificadas antes de pintarlas.
//
// Un lomo con su imagen de fondo (generada o foto) se pintaba en cuanto
// existía el botón: primero su color de reserva, liso, y luego la imagen a
// trozos, de arriba abajo, según iba llegando de la red. Con la estantería
// entera abriéndose a la vez se veía la balda "cargar por fases". Aquí se
// pide la imagen aparte, se espera a que esté entera y decodificada, y solo
// entonces se le deja al lomo ponérsela: cuando el CSS la pide, el navegador
// ya la tiene en memoria y la pinta de una vez.

const listas = new Set()
const rotas = new Set()
const promesas = new Map()   // url → promesa de que esté lista
const avisar = new Map()     // url → Set de funciones a las que avisar

export function imagenLista(url) {
  return !url || listas.has(url)
}

// Lista, pero porque no se pudo cargar: quien espere algo más de ella (su
// forma, por ejemplo) no debe quedarse esperando.
export function imagenRota(url) {
  return rotas.has(url)
}

// La cola, UNA para toda la app y de pocas en pocas: con la estantería
// entera pidiendo a la vez (cada sección, cada año), todas competían por la
// misma red y las de arriba, las que se ven al abrir, llegaban tan tarde
// como las del fondo. Lo que corre prisa (lo que se va a ver ya) se cuela
// delante — en su propia fila, también por orden de llegada: si se colara
// siempre la primera, al montarse cuarenta lomos seguidos el último pasaría
// delante de todos y la balda se llenaría de abajo arriba.
const urgentes = []
const normales = []
let enMarcha = 0
const A_LA_VEZ = 6

function siguiente() {
  while (enMarcha < A_LA_VEZ && (urgentes.length || normales.length)) {
    const { url, listo } = urgentes.length ? urgentes.shift() : normales.shift()
    if (imagenLista(url)) { listo(); continue }
    enMarcha++
    descargar(url).finally(() => { enMarcha--; listo(); siguiente() })
  }
}

function descargar(url) {
  return new Promise(resolve => {
    const img = new Image()
    img.decoding = 'async'
    const hecho = () => {
      listas.add(url)
      avisar.get(url)?.forEach(f => f())
      avisar.delete(url)
      resolve()
    }
    img.onload = () => (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).finally(hecho)
    // Rota o sin red: el lomo no se puede quedar en hueco para siempre.
    img.onerror = () => { rotas.add(url); hecho() }
    img.src = url
  })
}

// Pide una imagen. `urgente`: va a la fila de lo que corre prisa (y si ya
// esperaba en la normal, se cambia de fila).
export function precargarImagen(url, { urgente = false } = {}) {
  if (imagenLista(url)) return Promise.resolve()
  const enNormal = normales.findIndex(p => p.url === url)
  if (enNormal >= 0) {
    if (urgente) urgentes.push(...normales.splice(enNormal, 1))
    return promesas.get(url)
  }
  if (promesas.has(url)) return promesas.get(url)   // ya en la fila urgente o descargándose
  const promesa = new Promise(listo => {
    const pedido = { url, listo }
    if (urgente) urgentes.push(pedido)
    else normales.push(pedido)
  })
  promesas.set(url, promesa)
  promesa.then(() => promesas.delete(url))
  siguiente()
  return promesa
}

// Muchas, en el orden dado (el de la balda: primero las de arriba).
export function precargarImagenes(urls) {
  for (const u of urls || []) precargarImagen(u)
}

// ¿Está lista ya esta imagen? Se entera sola cuando lo esté. Quien pregunta
// es un lomo que se va a enseñar ya, así que pasa delante.
export function usarImagenLista(url) {
  const [lista, setLista] = useState(() => imagenLista(url))
  useEffect(() => {
    if (imagenLista(url)) { setLista(true); return }
    setLista(false)
    const alLlegar = () => setLista(true)
    if (!avisar.has(url)) avisar.set(url, new Set())
    avisar.get(url).add(alLlegar)
    precargarImagen(url, { urgente: true })
    return () => avisar.get(url)?.delete(alLlegar)
  }, [url])
  return lista
}
