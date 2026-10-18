// Notificaciones push (avisos de audiolibros, #69). Lo carga el service
// worker que genera Workbox (importScripts en vite.config.js), solo en /kokito.
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
