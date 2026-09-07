// Iconos de línea, dibujados a mano y sin librería: un solo trazo de
// currentColor, 24×24, grosor 1.6. Nunca emoji — misma norma que la Puchi
// actual (los Icon* de LunitecaV3).
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export const IconHome = (p) => (
  <svg {...base} {...p}><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" /></svg>
)
export const IconBooks = (p) => (
  <svg {...base} {...p}><path d="M5 4h4v16H5zM11 4h3v16h-3z" /><path d="m16.5 5 3.2.8-3 15-3.2-.8z" /></svg>
)
export const IconSettings = (p) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
    <circle cx="9" cy="7" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="8" cy="17" r="2" />
  </svg>
)
export const IconExit = (p) => (
  <svg {...base} {...p}><path d="M15 5V4a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-1" /><path d="M11 12h9m-3-3 3 3-3 3" /></svg>
)
export const IconArrow = (p) => (
  <svg {...base} {...p}><path d="M5 12h13m-5-5 5 5-5 5" /></svg>
)
export const IconRefresh = (p) => (
  <svg {...base} {...p}><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v4h-4" /></svg>
)
export const IconPaw = (p) => (
  <svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true" {...p}>
    <ellipse cx="32" cy="40" rx="16" ry="13" />
    <ellipse cx="13" cy="26" rx="7" ry="8.5" transform="rotate(-18 13 26)" />
    <ellipse cx="51" cy="26" rx="7" ry="8.5" transform="rotate(18 51 26)" />
    <ellipse cx="22" cy="12" rx="6" ry="7.5" transform="rotate(-8 22 12)" />
    <ellipse cx="42" cy="12" rx="6" ry="7.5" transform="rotate(8 42 12)" />
  </svg>
)
