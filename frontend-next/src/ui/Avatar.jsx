import { useState } from 'react'

// La cara de un jugador: su foto si la tiene, si no su emoji sobre su color.
//
// Estaba copiado a mano en cinco sitios (la barra superior, el pie del menú,
// la cabecera de un perfil, "en la estantería de X" y "otros que lo han
// leído") y cada copia con un tamaño y un redondeo distintos. El club y la
// administración lo necesitan en varios sitios más —quién propuso un libro,
// quién ha puesto cada puntuación, cada fila de la lista de cuentas—, así que
// aquí está una sola vez y esos cinco ya lo usan.
//
// Los dos que NO se han traído aquí es porque no son un avatar a secas: el de
// Actividad lleva un aro de color que dice a quién estás mirando, y el del
// login se monta y desmonta con su propia animación al cambiar de cuenta.
//
// El tamaño va en píxeles y no en clases de Tailwind a propósito: se usa desde
// 16px (dentro de una línea de texto) hasta 56px (la cabecera de un perfil), y
// el emoji tiene que encoger con la caja o se sale.
export default function Avatar({ jugador, size = 32, className = '' }) {
  // Si la foto no carga se cae al emoji, que es lo que hay debajo. Pasa de
  // verdad: una cuenta puede tener guardada la ruta de un avatar que ya no
  // está en el servidor, y el navegador pinta ahí su icono de imagen rota — un
  // cuadradito con un interrogante donde debería estar la cara de alguien.
  const [rota, setRota] = useState(false)
  const url = jugador?.avatar_url
  const [urlPrevia, setUrlPrevia] = useState(url)
  if (urlPrevia !== url) { setUrlPrevia(url); setRota(false) }

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line ${className}`}
      style={{
        width: size,
        height: size,
        background: jugador?.color || 'var(--color-surface-2)',
        fontSize: Math.round(size * 0.5),
        lineHeight: 1,
      }}
    >
      {url && !rota
        ? <img src={url} alt="" onError={() => setRota(true)} className="h-full w-full object-cover" />
        : <span>{jugador?.avatar_emoji || '⭐'}</span>}
    </span>
  )
}

// El nombre con su color, que es como se reconoce a alguien de un vistazo en
// toda la app.
export function NombreJugador({ jugador, className = '' }) {
  return (
    <span className={`truncate ${className}`} style={{ color: jugador?.color || 'var(--color-ink)' }}>
      {jugador?.name || '—'}
    </span>
  )
}
