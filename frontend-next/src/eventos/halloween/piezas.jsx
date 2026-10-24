// Los dibujos de Halloween. Siluetas planas y sin degradados, con los colores
// de la paleta del evento (--hw-*, en halloween.css), para que cada pieza se
// vea bien con el tema claro y con el oscuro sin tener dos versiones.
//
// Todo es decoración: aria-hidden y sin poder tocarse.

const deco = { 'aria-hidden': true, focusable: 'false' }

// ── Murciélago ──────────────────────────────────────────────────────────
// Una silueta simétrica: orejas, alas con el borde de abajo festoneado y el
// cuerpo en medio.
const ALAS = 'M32 9L30.5 5L29.5 9.5Q27.5 10 26 10.5Q16 3 2 7Q6 10 8 15Q11 12 15 15Q18 12 22 16Q25 14 28 18Q30 21 32 22Q34 21 36 18Q39 14 42 16Q46 12 49 15Q53 12 56 15Q58 10 62 7Q48 3 38 10.5Q36.5 10 34.5 9.5L33.5 5Z'

export function Murcielago({ className = '', style }) {
  return (
    <svg {...deco} viewBox="0 0 64 26" className={className} style={style}>
      <g className="hw-aleteo">
        <path d={ALAS} fill="var(--hw-silueta)" />
      </g>
    </svg>
  )
}

// ── Telaraña ────────────────────────────────────────────────────────────
// Anclada en la esquina de arriba a la derecha del dibujo; para las otras
// esquinas se le da la vuelta con CSS. Se calcula una vez: radios que salen
// de la esquina y anillos que cuelgan entre ellos, un poco vencidos hacia
// dentro como una tela de verdad.
const RADIOS = [0, 14, 31, 49, 67, 90]
const ANILLOS = [18, 36, 55, 76]
const TELA = (() => {
  const punto = (r, grados) => {
    const a = grados * Math.PI / 180
    return [100 - r * Math.cos(a), r * Math.sin(a)]
  }
  const f = n => n.toFixed(1)
  let d = ''
  for (const g of RADIOS) {
    const [x, y] = punto(100, g)
    d += `M100 0L${f(x)} ${f(y)}`
  }
  for (const r of ANILLOS) {
    RADIOS.forEach((g, i) => {
      if (i === 0) return
      const [x0, y0] = punto(r, RADIOS[i - 1])
      const [x1, y1] = punto(r, g)
      const [cx, cy] = punto(r * 0.84, (RADIOS[i - 1] + g) / 2)
      d += `M${f(x0)} ${f(y0)}Q${f(cx)} ${f(cy)} ${f(x1)} ${f(y1)}`
    })
  }
  return d
})()

export function Telarana({ className = '', style }) {
  return (
    <svg {...deco} viewBox="0 0 100 100" className={className} style={style}>
      <path d={TELA} fill="none" stroke="var(--hw-tela)" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  )
}

// ── Araña ───────────────────────────────────────────────────────────────
// Colgada de un hilo largo: la parte de arriba del hilo queda escondida detrás
// de la barra superior, así que al subir y bajar nunca se ve dónde acaba.
export function Arana({ className = '', style, hilo = 90 }) {
  return (
    <svg {...deco} viewBox={`0 0 24 ${hilo + 22}`} width="24" height={hilo + 22} className={className} style={style}>
      <path d={`M12 0V${hilo + 4}`} stroke="var(--hw-silueta)" strokeWidth="0.8" opacity="0.7" />
      <g transform={`translate(0 ${hilo})`} stroke="var(--hw-silueta)" strokeWidth="1.3" strokeLinecap="round" fill="none">
        {/* Cuatro patas a cada lado, dobladas como rodillas. */}
        <path d="M9 9 4 5 2 8M9 11 3 10 1 13M9 13 4 15 2 19M10 14 6 18 5 22" />
        <path d="M15 9 20 5 22 8M15 11 21 10 23 13M15 13 20 15 22 19M14 14 18 18 19 22" />
      </g>
      <g transform={`translate(0 ${hilo})`} fill="var(--hw-silueta)">
        <circle cx="12" cy="6.5" r="3" />
        <ellipse cx="12" cy="13" rx="4.2" ry="5" />
      </g>
    </svg>
  )
}

// ── Sombrero de bruja ───────────────────────────────────────────────────
// Para el logo: cono con la punta vencida, cinta de calabaza y ala ancha.
export function Sombrero({ className = '', style }) {
  return (
    <svg {...deco} viewBox="0 0 40 30" className={className} style={style}>
      <path d="M10 24C14 16 17 8 22 3C24 1 28 2 29 4C26 4 25 6 25 9C26 15 28 20 30 24Z" fill="var(--hw-sombrero)" />
      <path d="M11.4 21.2Q20 23.4 28.8 21L29.8 23.6Q20 26.2 10.4 23.7Z" fill="var(--color-accent)" />
      <ellipse cx="20" cy="25" rx="19" ry="4.2" fill="var(--hw-sombrero)" />
    </svg>
  )
}

// ── Calabaza ────────────────────────────────────────────────────────────
// Tres gajos (los de los lados, más oscuros), el rabo y la cara tallada. De
// noche la cara es la luz de la vela y parpadea (ver .hw-vela).
export function Calabaza({ className = '', style, cara = true }) {
  return (
    <svg {...deco} viewBox="0 0 48 40" className={className} style={style}>
      <path d="M22.5 11.5Q22 6 25 3.5L27.2 5.2Q25 7.5 25.6 11.5Z" fill="var(--hw-tallo)" />
      <ellipse cx="15.5" cy="25" rx="11.5" ry="13" fill="var(--hw-calabaza-sombra)" />
      <ellipse cx="32.5" cy="25" rx="11.5" ry="13" fill="var(--hw-calabaza-sombra)" />
      <ellipse cx="24" cy="25" rx="11" ry="14.5" fill="var(--hw-calabaza)" />
      {cara && (
        <path
          className="hw-vela"
          fill="var(--hw-cara)"
          d="M14.5 21H20L17.3 16.5ZM28 21H33.5L30.7 16.5ZM22.5 25.5H25.5L24 23ZM13.5 28Q24 36.5 34.5 28L31.5 29.6L29.8 28.2L27.2 30.8L24 29.3L20.8 30.8L18.2 28.2L16.5 29.6Z"
        />
      )}
    </svg>
  )
}
