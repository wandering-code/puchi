// Lo que el service worker de /kokito hace además de lo que genera Workbox
// (lo carga con importScripts, ver vite.config.js):
// - notificaciones push (avisos de audiolibros, #69);
// - escuchar sin conexión (fase 9, #71), al final del archivo.
//
// El servidor manda { title, body, tag, url, badge } cifrado; aquí se enseña
// y, al tocarlo, se abre la app en el aviso (o se lleva a la que ya está
// abierta, para no tener dos).

self.addEventListener('push', (evento) => {
  let datos = {}
  try {
    datos = evento.data ? evento.data.json() : {}
  } catch {
    datos = { title: 'Kokito', body: evento.data ? evento.data.text() : '' }
  }
  evento.waitUntil((async () => {
    // El número sobre el icono de la app (iOS 16.4+, Android, escritorio).
    if (typeof datos.badge === 'number' && self.navigator.setAppBadge) {
      try {
        if (datos.badge > 0) await self.navigator.setAppBadge(datos.badge)
        else await self.navigator.clearAppBadge()
      } catch { /* sin permiso para el globo: no pasa nada */ }
    }
    await self.registration.showNotification(datos.title || 'Kokito', {
      body: datos.body || '',
      // Uno por libro: un "nuevo capítulo" sustituye al anterior.
      tag: datos.tag,
      renotify: !!datos.tag,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      data: { url: datos.url || './' },
    })
  })())
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const url = new URL(evento.notification.data?.url || './', self.location.origin).href
  evento.waitUntil((async () => {
    const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const nuestra = abiertas.find(c => c.url.startsWith(self.registration.scope))
    if (nuestra) {
      // Ya abierta: que vaya al aviso ella misma, sin recargar.
      nuestra.postMessage({ type: 'abrir-aviso', url })
      return nuestra.focus()
    }
    return self.clients.openWindow(url)
  })())
})


// ─── Escuchar sin conexión (#71) ──────────────────────────────────────────
//
// Los capítulos descargados (platform/descargas.js) están en la caché
// AUDIO, con la misma URL que pide el reproductor (con su ?v=, que cambia si
// se regenera el capítulo: así nunca suena una versión vieja). Si está, se
// sirve desde ahí y si no, de la red, como siempre.
//
// El <audio> pide por trozos (Range), sobre todo en iPhone, y al saltar a un
// punto del capítulo. La caché guarda el archivo entero, así que aquí se
// recorta el trozo pedido: blob.slice no copia nada.
//
// Lo que necesita la app para abrir un audiolibro (la lista de Escuchar, los
// datos de cada uno) va "red primero": si hay red se usa y se guarda; si no,
// se tira de lo último guardado.

const AUDIO = 'kokito-audio-v1'
const DATOS = 'kokito-escuchar-v1'
const ES_AUDIO = /^\/api\/listen\/\d+\/chapters\/\d+\/audio$/
const ES_DATOS = /^\/api\/listen\/(catalog|books|\d+|book\/\d+)$/

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request
  if (peticion.method !== 'GET') return
  const url = new URL(peticion.url)
  if (url.origin !== self.location.origin) return
  if (ES_AUDIO.test(url.pathname)) evento.respondWith(audioGuardado(peticion))
  else if (ES_DATOS.test(url.pathname)) evento.respondWith(redPrimero(peticion))
})

async function audioGuardado(peticion) {
  const guardado = await (await caches.open(AUDIO)).match(peticion.url)
  if (!guardado) return fetch(peticion)
  const rango = peticion.headers.get('range')
  if (!rango) return guardado
  const blob = await guardado.blob()
  const m = /bytes=(\d*)-(\d*)/.exec(rango)
  let inicio, fin
  if (!m || (m[1] === '' && m[2] === '')) {
    inicio = 0
    fin = blob.size - 1
  } else if (m[1] === '') {
    // "bytes=-500": los últimos 500
    inicio = Math.max(0, blob.size - Number(m[2]))
    fin = blob.size - 1
  } else {
    inicio = Number(m[1])
    fin = m[2] === '' ? blob.size - 1 : Math.min(Number(m[2]), blob.size - 1)
  }
  if (inicio >= blob.size) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${blob.size}` } })
  }
  return new Response(blob.slice(inicio, fin + 1), {
    status: 206,
    headers: {
      'Content-Type': guardado.headers.get('Content-Type') || 'audio/mp4',
      'Content-Range': `bytes ${inicio}-${fin}/${blob.size}`,
      'Content-Length': String(fin - inicio + 1),
      'Accept-Ranges': 'bytes',
    },
  })
}

async function redPrimero(peticion) {
  try {
    const respuesta = await fetch(peticion)
    if (respuesta.ok) {
      const copia = respuesta.clone()
      caches.open(DATOS).then(c => c.put(peticion, copia)).catch(() => {})
    }
    return respuesta
  } catch (error) {
    const guardado = await (await caches.open(DATOS)).match(peticion)
    if (guardado) return guardado
    throw error
  }
}
