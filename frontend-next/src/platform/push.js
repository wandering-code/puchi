import { api } from './api'

// Notificaciones push en este dispositivo (avisos de audiolibros, #69).
//
// Estados posibles, que la hoja de avisos explica a su manera:
// - 'sin-soporte': el navegador no sabe (o es /kokito en desarrollo, sin
//   service worker).
// - 'instalar': iPhone o iPad desde Safari. Allí el push solo existe con la
//   app añadida a la pantalla de inicio y abierta desde el icono.
// - 'bloqueado': se dijo que no al permiso; solo se arregla en los ajustes.
// - 'activo' / 'inactivo'.

const esIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const instalada = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true

function hayPush() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function registro() {
  if (!('serviceWorker' in navigator)) return null
  // En desarrollo no hay service worker: sin esto, .ready esperaría siempre.
  const r = await navigator.serviceWorker.getRegistration()
  return r ? navigator.serviceWorker.ready : null
}

export async function estadoPush() {
  if (esIOS() && !instalada()) return 'instalar'
  if (!hayPush()) return 'sin-soporte'
  if (Notification.permission === 'denied') return 'bloqueado'
  const r = await registro()
  if (!r) return 'sin-soporte'
  const s = await r.pushManager.getSubscription()
  return s && Notification.permission === 'granted' ? 'activo' : 'inactivo'
}

function aBytes(base64) {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4)
  const crudo = atob((base64 + relleno).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(crudo, c => c.charCodeAt(0))
}

async function guardar(s) {
  const j = s.toJSON()
  await api('/push/subscribe', {
    method: 'POST',
    body: { endpoint: j.endpoint, keys: j.keys, user_agent: navigator.userAgent },
  })
}

// Tiene que llamarse desde un toque: iOS solo enseña el permiso así.
export async function activarPush() {
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return permiso === 'denied' ? 'bloqueado' : 'inactivo'
  const r = await registro()
  if (!r) return 'sin-soporte'
  let s = await r.pushManager.getSubscription()
  if (!s) {
    const { key } = await api('/push/key')
    s = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(key) })
  }
  await guardar(s)
  return 'activo'
}

export async function desactivarPush() {
  const r = await registro()
  const s = await r?.pushManager.getSubscription()
  if (s) {
    await api('/push/unsubscribe', { method: 'POST', body: { endpoint: s.endpoint } }).catch(() => {})
    await s.unsubscribe().catch(() => {})
  }
  return 'inactivo'
}

// Al abrir la app con el permiso ya dado: vuelve a mandar la suscripción,
// por si el navegador la ha renovado o se activó con otra cuenta. Sin
// preguntar nada.
export async function refrescarPush() {
  try {
    if (!hayPush() || Notification.permission !== 'granted') return
    const r = await registro()
    const s = await r?.pushManager.getSubscription()
    if (s) await guardar(s)
  } catch { /* lo intentará la próxima vez */ }
}

// El número sobre el icono de la app.
export function ponerGlobo(n) {
  try {
    if (!('setAppBadge' in navigator)) return
    if (n > 0) navigator.setAppBadge(n).catch(() => {})
    else navigator.clearAppBadge().catch(() => {})
  } catch { /* no soportado */ }
}
