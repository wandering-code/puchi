const KEY = 'luni_device_id'

// Identificador estable de "este navegador" (no de la cuenta) — persistido en
// localStorage, así que sobrevive a recargas y sigue siendo el mismo entre
// sesiones en el mismo dispositivo/navegador. Se manda al conectar el
// WebSocket para que el backend pueda tener varias conexiones abiertas a la
// vez para un mismo jugador (una por dispositivo) sin que una eche a la otra
// — antes, entrar desde el móvil cortaba en el acto la conexión (y con ella
// cualquier llamada en marcha) que ya hubiera en el PC.
export function getDeviceId() {
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)
    localStorage.setItem(KEY, id)
  }
  return id
}
