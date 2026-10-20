// El logo de Puchi (la huella con el libro), el mismo de los iconos de la app.
// Es public/icons/icon-512.png sin el fondo crema, para que vaya bien sobre
// el tema claro y el oscuro.
export default function Logo({ className = '' }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}icons/logo.png`}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`select-none object-contain ${className}`}
    />
  )
}
