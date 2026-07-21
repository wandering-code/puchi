// Avatar de un jugador: si tiene foto subida (avatar_url) se muestra esa,
// recortada en círculo; si no, el emoji de siempre. Un solo sitio para esta
// lógica porque el avatar aparece en muchos componentes (chat, llamadas,
// login, menú superior...) y todos deben reaccionar igual al subir una foto.
export default function PlayerAvatar({ emoji, url, size = 20, style }) {
  if (url) {
    return (
      <img src={url} alt="" style={{
        width: size, height: size, borderRadius: '50%', objectFit: 'cover',
        flexShrink: 0, display: 'block', ...style,
      }} />
    )
  }
  return (
    // Mismo tamaño de caja exacto que el <img> de arriba (width/height:size)
    // — antes esto solo fijaba el font-size, y el cuadro real que ocupa un
    // emoji no coincide con el em-square exacto de la fuente (varía según
    // fuente/plataforma), así que quedaba desplazado en vertical/horizontal
    // frente a quien sí tuviera foto de perfil en la misma fila. Centrado
    // con flex en una caja de tamaño fijo en vez de fiarse de line-height.
    <span style={{
      width: size, height: size, fontSize: size, lineHeight: 1,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, ...style,
    }}>
      {emoji ?? '⭐'}
    </span>
  )
}
