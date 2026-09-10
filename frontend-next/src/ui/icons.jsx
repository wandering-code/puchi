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
// Actividad: dos siluetas, que es de lo que va la sección — lo que van
// leyendo los demás.
export const IconActividad = (p) => (
  <svg {...base} {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <circle cx="17" cy="9.5" r="2.2" />
    <path d="M16 14.6a4.6 4.6 0 0 1 4.5 4.4" />
  </svg>
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
export const IconMenu = (p) => (
  <svg {...base} {...p}><path d="M4 7h16M4 12h16M4 17h10" /></svg>
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

// ─── Luniteca ──────────────────────────────────────────────────────────────
export const IconSearch = (p) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
)
export const IconFilter = (p) => (
  <svg {...base} {...p}><path d="M4 6h16M7 12h10M10 18h4" /></svg>
)
export const IconSort = (p) => (
  <svg {...base} {...p}><path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3" /></svg>
)
export const IconGrid = (p) => (
  <svg {...base} {...p}><rect x="4" y="4" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" /></svg>
)
export const IconList = (p) => (
  <svg {...base} {...p}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
)
export const IconChevron = (p) => (
  <svg {...base} {...p}><path d="m6 9 6 6 6-6" /></svg>
)
export const IconX = (p) => (
  <svg {...base} {...p}><path d="m6 6 12 12M18 6 6 18" /></svg>
)
export const IconArrowLeft = (p) => (
  <svg {...base} {...p}><path d="M19 12H6m5-5-5 5 5 5" /></svg>
)

export const IconPencil = (p) => (
  <svg {...base} {...p}><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" /><path d="m14.5 6.5 3 3" /></svg>
)

export const IconPlus = (p) => (
  <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
)

export const IconCheck = (p) => (
  <svg {...base} {...p}><path d="m5 13 4.5 4.5L19 7" /></svg>
)

// Flechas hacia dentro (plegar todo) o hacia fuera (desplegar todo).
export const IconPlegarTodo = ({ expandir = false, ...p }) => (
  <svg {...base} {...p}>
    {expandir
      ? <path d="M8 4 12 8l4-4M8 20l4-4 4 4M4 12h16" />
      : <path d="M8 8 12 4l4 4M8 16l4 4 4-4M4 12h16" />}
  </svg>
)

export const IconLomos = (p) => (
  <svg {...base} {...p}>
    <rect x="4" y="7" width="4" height="13" rx="1" />
    <rect x="10" y="4" width="4" height="16" rx="1" />
    <rect x="16" y="9" width="4" height="11" rx="1" />
  </svg>
)

// Sol y luna: el selector de tema (claro / oscuro) en Ajustes.
export const IconSol = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)
export const IconLuna = (p) => (
  <svg {...base} {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
  </svg>
)
