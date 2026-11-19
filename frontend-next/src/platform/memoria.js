// Lo último que enseñó cada pantalla, en memoria y solo durante la sesión.
//
// Cada pantalla vuelve a pedir sus datos al montarse, y montarse es cada vez
// que se entra en ella desde el menú: volver a la Luniteca era verla vacía (la
// cabecera y las cajas) y luego rellenarse, aunque se acabara de estar allí.
// Con esto se pinta al instante con lo que ya había y se refresca por detrás,
// como cualquier app nativa: lo que haya cambiado entra en cuanto llega.
//
// Solo memoria, nunca localStorage: no sobrevive a cerrar la app, así que lo
// más viejo que se puede ver es lo de hace un rato en esta misma sesión, y
// siempre se pide lo nuevo al entrar. Se vacía al cerrar sesión.
const guardado = new Map()

export function recordado(clave) {
  return guardado.get(clave)
}

export function recordar(clave, valor) {
  if (valor == null) guardado.delete(clave)
  else guardado.set(clave, valor)
}

export function olvidarTodo() {
  guardado.clear()
}
