import { usarEvento } from './usarEvento'

// El hueco donde un evento de temporada cuelga su pieza para este sitio (la
// lista de sitios está en eventos/index.js). Sin evento, o sin pieza para
// aquí, no pinta nada: los componentes lo ponen sin preguntar.
//
// Lo que entra y sale al encender o apagar la decoración no necesita animarse
// por su cuenta: ese cambio va por el círculo de la View Transition
// (conCirculo, platform/tema.js), que funde la app entera de una vez.
export default function Adorno({ sitio, ...props }) {
  const evento = usarEvento()
  const Pieza = evento?.adornos?.[sitio]
  return Pieza ? <Pieza {...props} /> : null
}

// ¿Trae el evento de ahora algo para este sitio? Para quien tiene que
// preparar el hueco antes (el logo, que cambia de envoltorio).
export function usarHayAdorno(sitio) {
  return !!usarEvento()?.adornos?.[sitio]
}
