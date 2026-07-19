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
    <span style={{ fontSize: size, lineHeight: 1, flexShrink: 0, display: 'inline-block', ...style }}>
      {emoji ?? '⭐'}
    </span>
  )
}
