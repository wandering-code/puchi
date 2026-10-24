import Adorno, { usarHayAdorno } from '../eventos/Adorno'

// El logo de Puchi (la huella con el libro), el mismo de los iconos de la app.
// Es public/icons/icon-512.png sin el fondo crema, para que vaya bien sobre
// el tema claro y el oscuro.
//
// Si el evento de temporada trae algo para el logo (el sombrero de bruja en
// Halloween), se envuelve en una caja con las mismas medidas para colgárselo
// encima; sin evento, es la imagen sola de siempre.
export default function Logo({ className = '' }) {
  const conAdorno = usarHayAdorno('logo')
  const imagen = (clases) => (
    <img
      src={`${import.meta.env.BASE_URL}icons/logo.png`}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`select-none object-contain ${clases}`}
    />
  )
  if (!conAdorno) return imagen(className)
  return (
    <span className={`relative inline-block shrink-0 ${className}`}>
      {imagen('h-full w-full')}
      <Adorno sitio="logo" />
    </span>
  )
}
