// Capítulos descargados para escuchar sin conexión (fase 9, #71).
//
// Se guardan enteros en la caché del navegador (Cache Storage), con la misma
// URL que pide el reproductor. El service worker (public/kokito-sw.js) los
// sirve desde ahí cuando están, así que reproducir uno descargado no cambia
// nada en el reproductor. La URL lleva ?v=fecha de generación: si el admin
// regenera un capítulo, la descarga vieja ya no coincide y se usa la red
// hasta volver a descargarlo.

const CACHE = 'kokito-audio-v1'

export const hayDescargas = typeof caches !== 'undefined'

export function urlAudio(abId, c) {
  return `/api/listen/${abId}/chapters/${c.id}/audio?v=${encodeURIComponent(c.generated_at || '')}`
}

const prefijo = (abId, capId) => `/api/listen/${abId}/chapters/${capId}/audio`

// Qué capítulos de este libro están descargados, en su versión actual.
export async function descargados(libro) {
  if (!hayDescargas || !libro) return new Set()
  const cache = await caches.open(CACHE)
  const claves = new Set((await cache.keys()).map(r => new URL(r.url).pathname + new URL(r.url).search))
  return new Set(libro.chapters.filter(c => c.ready && claves.has(urlAudio(libro.id, c))).map(c => c.id))
}

// Lo que ocupa lo descargado de este libro, en bytes.
export async function ocupado(libro) {
  if (!hayDescargas || !libro) return 0
  const cache = await caches.open(CACHE)
  let total = 0
  for (const r of await cache.keys()) {
    if (!new URL(r.url).pathname.startsWith(`/api/listen/${libro.id}/`)) continue
    const resp = await cache.match(r)
    total += Number(resp?.headers.get('Content-Length')) || (await resp?.clone().blob())?.size || 0
  }
  return total
}

export async function descargarCapitulo(abId, c) {
  const cache = await caches.open(CACHE)
  const url = urlAudio(abId, c)
  const r = await fetch(url, { credentials: 'include' })
  if (!r.ok) throw new Error(`No se ha podido descargar «${c.title}»`)
  await cache.put(url, r)
  // Las versiones anteriores de este capítulo (otro ?v=) ya no sirven.
  for (const k of await cache.keys()) {
    const u = new URL(k.url)
    if (u.pathname === prefijo(abId, c.id) && u.pathname + u.search !== url) await cache.delete(k)
  }
}

export async function borrarLibro(abId) {
  const cache = await caches.open(CACHE)
  for (const k of await cache.keys()) {
    if (new URL(k.url).pathname.startsWith(`/api/listen/${abId}/`)) await cache.delete(k)
  }
}

// Que el navegador no borre las descargas por su cuenta cuando ande justo de
// espacio. En iPhone, con la app en la pantalla de inicio, suele concederlo.
export async function pedirQueSeQueden() {
  try { return await navigator.storage?.persist?.() } catch { return false }
}

export function megas(bytes) {
  if (!bytes) return '0 MB'
  const mb = bytes / 1024 / 1024
  return mb >= 1000 ? `${(mb / 1024).toFixed(1).replace('.', ',')} GB` : `${Math.round(mb)} MB`
}
