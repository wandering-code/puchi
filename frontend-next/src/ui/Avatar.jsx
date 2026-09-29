import { useEffect, useState } from 'react'

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
// Las fotos que ya han llegado enteras alguna vez: esas se enseñan desde el
// primer frame, sin pasar por el emoji (que si no, parpadearía en cada avatar
// de cada lista al montarse).
const enteras = new Set()

export default function Avatar({ jugador, size = 32, className = '' }) {
  // Si la foto no carga se cae al emoji, que es lo que hay debajo. Pasa de
  // verdad: una cuenta puede tener guardada la ruta de un avatar que ya no
  // está en el servidor, y el navegador pinta ahí su icono de imagen rota — un
  // cuadradito con un interrogante donde debería estar la cara de alguien.
  const [rota, setRota] = useState(false)
  // La foto solo se enseña cuando ha llegado ENTERA. Hasta entonces se ve el
  // emoji, como sin foto. Pasaba en la barra de arriba: la descarga se cortaba
  // a medias (la app a segundo plano, la red del móvil) y el JPEG, que se
  // pinta de arriba abajo según llega, se quedaba con media cara y el resto
  // del color del jugador, sin que llegara nunca ni un load ni un error.
  const [cargada, setCargada] = useState(() => enteras.has(jugador?.avatar_url))
  // Y si se queda así, se vuelve a pedir al volver a la app: con otra `key`
  // el <img> es nuevo y hace una petición nueva.
  const [intento, setIntento] = useState(0)
  const url = jugador?.avatar_url
  const [urlPrevia, setUrlPrevia] = useState(url)
  if (urlPrevia !== url) { setUrlPrevia(url); setRota(false); setCargada(enteras.has(url)) }

  const pendiente = !!url && !rota && !cargada
  useEffect(() => {
    if (!pendiente) return
    const alVolver = () => { if (document.visibilityState === 'visible') setIntento(n => n + 1) }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [pendiente])

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
      {!(url && !rota && cargada) && <span>{jugador?.avatar_emoji || '⭐'}</span>}
      {url && !rota && (
        <img
          key={intento}
          src={url}
          alt=""
          onLoad={() => { enteras.add(url); setCargada(true) }}
          onError={() => setRota(true)}
          className={cargada ? 'h-full w-full object-cover' : 'absolute h-0 w-0 opacity-0'}
        />
      )}
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
