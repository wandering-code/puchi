// `transform` entero a partir de los atajos de Motion (x, y, scale, rotate).
//
// Motion solo deja hacer al navegador (Web Animations, en la GPU, a la
// frecuencia de la pantalla) las animaciones de `transform` entero, `opacity`,
// `filter` y `clipPath`. Los atajos `x`, `y`, `scale` o `rotate` los calcula
// él en JavaScript fotograma a fotograma, y Safari deja eso a 60 aunque la
// pantalla vaya a 120. Con esto se escribe igual que antes:
//
//   animate={{ opacity: 1, transform: tf({ y: 0, scale: 1 }) }}
//
// en el mismo orden en que los compone Motion (translate, scale, rotate),
// para que se vea exactamente igual. Los números de x/y son píxeles y los de
// rotate, grados; un texto ('100%', '-50%') va tal cual. Si algún valor es una
// lista (fotogramas clave), sale una lista de transforms.

const px = v => (typeof v === 'number' ? `${v}px` : v)
const deg = v => (typeof v === 'number' ? `${v}deg` : v)

function uno({ x, y, scale, scaleX, scaleY, rotate }) {
  const partes = []
  if (x !== undefined || y !== undefined) partes.push(`translate(${px(x ?? 0)}, ${px(y ?? 0)})`)
  if (scale !== undefined) partes.push(`scale(${scale})`)
  if (scaleX !== undefined) partes.push(`scaleX(${scaleX})`)
  if (scaleY !== undefined) partes.push(`scaleY(${scaleY})`)
  if (rotate !== undefined) partes.push(`rotate(${deg(rotate)})`)
  return partes.length ? partes.join(' ') : 'none'
}

export function tf(valores) {
  const largo = Math.max(0, ...Object.values(valores).map(v => (Array.isArray(v) ? v.length : 0)))
  if (!largo) return uno(valores)
  return Array.from({ length: largo }, (_, i) => uno(Object.fromEntries(
    Object.entries(valores).map(([k, v]) => [k, Array.isArray(v) ? v[Math.min(i, v.length - 1)] : v]),
  )))
}
