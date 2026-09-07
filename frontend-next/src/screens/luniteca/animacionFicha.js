// Cuatro formas de abrir y cerrar la ficha de un libro. No es una prueba
// temporal: es una preferencia de cada jugador, que se elige en Ajustes.
//
// Se guarda en el perfil (Player.customization, el mismo sitio que el fondo de
// pantalla), así que viaja con la cuenta y no se queda en el navegador donde
// se eligió. Y también en localStorage, que es de donde se lee al arrancar:
// así la primera ficha que abras ya sale como la dejaste, sin esperar a que
// el perfil llegue del servidor.
import { api } from '../../platform/api'

const CLAVE = 'luni_anim_ficha'

export const VARIANTES = [
  {
    id: 'portada',
    nombre: 'La portada crece',
    detalle: 'La portada que tocas viaja hasta su sitio en la ficha y vuelve al cerrar.',
  },
  {
    id: 'lateral',
    nombre: 'Entra desde la derecha',
    detalle: 'Como pasar de pantalla en una app nativa: la ficha empuja desde el lado.',
  },
  {
    id: 'hoja',
    nombre: 'Sube desde abajo',
    detalle: 'Igual que los filtros o el estado, y se cierra tirando de ella hacia abajo.',
  },
  {
    id: 'zoom',
    nombre: 'Crece desde el libro',
    detalle: 'La ficha entera se abre desde el punto exacto donde estaba la portada.',
  },
]

function valida(v) {
  return VARIANTES.some(x => x.id === v) ? v : null
}

export function leerVariante(player) {
  let guardada = null
  try { guardada = localStorage.getItem(CLAVE) } catch { /* modo privado */ }
  // El perfil manda: es lo que vale en todos los dispositivos. La copia local
  // solo cubre el arranque, antes de que el perfil esté disponible.
  return valida(player?.customization?.animacionFicha) || valida(guardada) || 'portada'
}

// Guarda en el perfil y deja la copia local. El PATCH del servidor reemplaza
// el objeto entero de personalización, así que hay que mandarlo completo: si
// solo se enviara esta clave, se borraría el fondo de pantalla elegido.
export async function guardarVariante(id, player, refrescarPlayer) {
  try { localStorage.setItem(CLAVE, id) } catch { /* modo privado */ }
  const customization = { ...(player?.customization || {}), animacionFicha: id }
  refrescarPlayer?.(customization)
  try {
    await api(`/players/${player.id}/customization`, { method: 'PATCH', body: { customization } })
  } catch {
    // Sin conexión se queda con la copia local; el próximo cambio lo reintenta.
  }
}

const SUAVE = { type: 'spring', stiffness: 420, damping: 40 }

// Lo que le toca al contenedor de la ficha según la variante. `origen` es el
// centro de la portada que se ha tocado, en coordenadas de pantalla: solo lo
// usa el zoom, para crecer justo desde ahí y no desde el medio.
export function animacionDeFicha(variante, origen) {
  if (variante === 'lateral') {
    return {
      className: 'bg-bg',
      initial: { x: '100%' },
      animate: { x: 0 },
      exit: { x: '100%' },
      transition: SUAVE,
    }
  }
  if (variante === 'hoja') {
    return {
      className: 'bg-bg rounded-t-[28px] border-t border-line overflow-hidden',
      initial: { y: '100%' },
      animate: { y: 0 },
      exit: { y: '100%' },
      transition: SUAVE,
      arrastrable: true,
    }
  }
  if (variante === 'zoom') {
    return {
      className: 'bg-bg',
      initial: { opacity: 0, scale: 0.25 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.25 },
      transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
      // Crece desde donde estaba la portada. Sin esto crecería desde el
      // centro de la pantalla y no se entendería de dónde sale.
      style: origen ? { transformOrigin: `${origen.x}px ${origen.y}px` } : undefined,
    }
  }
  // 'portada': el contenedor solo aparece; quien viaja es la propia portada,
  // con su layoutId compartido con la tarjeta de la estantería.
  return {
    className: 'bg-bg',
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
    portadaCompartida: true,
  }
}
