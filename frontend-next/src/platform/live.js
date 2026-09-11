import { useEffect } from 'react'
import { getDeviceId } from './deviceId'

// Avisos en vivo del backend (mismo WebSocket que la Puchi actual). Los usa
// Luniteca para enterarse de un cambio hecho desde otro dispositivo — o desde
// la Puchi actual, que escribe en la MISMA base de datos — sin recargar.
//
// Con reconexión desde el primer día: en la Puchi actual esto no la tenía, y
// si el backend se reiniciaba o el móvil perdía la red un momento, la pestaña
// se quedaba muda hasta recargar a mano (ya pasó, y hubo que arreglarlo allí).
let socket = null
let intentos = 0
let temporizador = null
let suscriptores = 0
let tokenActual = null

function conectar() {
  if (!tokenActual || socket) return
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const url = `${proto}://${location.host}/ws?token=${encodeURIComponent(tokenActual)}&device_id=${encodeURIComponent(getDeviceId())}`
  const ws = new WebSocket(url)
  socket = ws

  ws.onopen = () => { intentos = 0 }
  ws.onmessage = (ev) => {
    let msg
    try { msg = JSON.parse(ev.data) } catch { return }
    // Se reparte como evento del window, igual que en la Puchi actual: así
    // cualquier pantalla escucha sin tener que pasarse el socket por props.
    window.dispatchEvent(new CustomEvent('puchi:ws', { detail: msg }))
  }
  ws.onclose = () => {
    // Solo si el que se cierra sigue siendo el de ahora. Si ya se creó otro
    // mientras tanto, poner `socket = null` aquí deja a null un socket VIVO: la
    // app sigue recibiendo por él (los mensajes llegan) pero deja de poder
    // enviar nada, porque enviarPorWS mira esta variable y la ve vacía.
    //
    // Pasa de verdad y por dos caminos: en desarrollo, StrictMode monta el
    // efecto dos veces y el cierre del primer socket llega cuando el segundo ya
    // existe; y al volver de segundo plano, la reconexión puede crear uno nuevo
    // antes de que llegue el onclose del que se murió sin avisar. Se destapó al
    // estrenar el chat — hasta entonces nada salía por aquí, solo entraba.
    if (socket !== ws) return
    socket = null
    if (suscriptores === 0) return
    // Espera creciente hasta 15s, para no martillear al backend mientras está
    // reiniciándose (un despliegue tarda unos segundos en volver).
    const espera = Math.min(1000 * 2 ** intentos++, 15000)
    clearTimeout(temporizador)
    temporizador = setTimeout(conectar, espera)
  }
  ws.onerror = () => ws.close()
}

// Mantiene el socket abierto mientras haya alguien escuchando. Se llama una
// vez, arriba del todo (App), con el token de la sesión.
export function useLiveConnection(token) {
  useEffect(() => {
    if (!token) return
    tokenActual = token
    suscriptores++
    conectar()
    // Al volver de segundo plano el socket puede llevar rato muerto sin que
    // haya llegado el onclose: en iOS, al bloquear la pantalla, la conexión se
    // corta sin avisar. Al volver se comprueba y se reconecta si hace falta.
    function alVolver() {
      if (document.visibilityState === 'visible' && !socket) { intentos = 0; conectar() }
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      suscriptores--
      document.removeEventListener('visibilitychange', alVolver)
      if (suscriptores === 0) {
        clearTimeout(temporizador)
        socket?.close()
        socket = null
      }
    }
  }, [token])
}

// Mandar por el mismo socket. Hasta ahora esto solo escuchaba —los cambios se
// hacían por HTTP y el socket servía para enterarse—, pero el chat y la
// señalización de las llamadas van POR AQUÍ: un mensaje o una oferta de WebRTC
// no pueden pasar por una petición HTTP y esperar a que el servidor los
// reparta, tienen que salir por el mismo tubo que ya está abierto.
//
// Devuelve si ha salido. No encola: si el socket está cerrado (se cayó la red
// y la reconexión todavía no ha entrado), quien llama se entera y puede
// decidir qué hacer — en el chat, no dar por enviado un mensaje que no salió.
export function enviarPorWS(mensaje) {
  if (socket?.readyState !== WebSocket.OPEN) return false
  socket.send(JSON.stringify(mensaje))
  return true
}

// Escucha los avisos que interesen. `scopes` son los del backend
// (_notify_luni): 'shelf' y 'books' para lo que toca a la estantería.
export function useLiveUpdates(scopes, alCambiar) {
  useEffect(() => {
    function alRecibir(ev) {
      const msg = ev.detail
      if (msg?.type !== 'luni_update') return
      if (!scopes.includes(msg.scope)) return
      alCambiar(msg)
    }
    window.addEventListener('puchi:ws', alRecibir)
    return () => window.removeEventListener('puchi:ws', alRecibir)
    // scopes se pasa como literal en el sitio de uso; se compara por contenido
    // para no reenganchar el listener en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopes.join(','), alCambiar])
}
