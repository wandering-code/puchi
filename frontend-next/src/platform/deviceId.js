const KEY = 'luni_device_id'

// Identificador estable de "este navegador", no de la cuenta. Se manda al
// abrir el WebSocket para que el backend admita varias conexiones a la vez
// del mismo jugador (una por dispositivo) sin que una eche a la otra.
// Misma clave que la Puchi actual a propósito: es el mismo dispositivo.
export function getDeviceId() {
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)
    localStorage.setItem(KEY, id)
  }
  return id
}
