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

// ─── Club y administración ─────────────────────────────────────────────────
// El club es un libro ABIERTO, no lomos: la Luniteca (IconBooks) son los
// libros que tienes, y el club es el que se está leyendo entre todos.
export const IconClub = (p) => (
  <svg {...base} {...p}>
    <path d="M12 6.5C10.4 5 7.4 4.4 4 5v13c3.4-.6 6.4 0 8 1.5 1.6-1.5 4.6-2.1 8-1.5V5c-3.4-.6-6.4 0-8 1.5z" />
    <path d="M12 6.5v13" />
  </svg>
)

// Administración: un escudo con su visto. Nada de engranajes, que ese es el
// gesto de Ajustes y no es lo mismo decidir quién entra que elegir un tema.
export const IconEscudo = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3.2 19 6v5.4c0 4.4-2.9 7.6-7 9.4-4.1-1.8-7-5-7-9.4V6z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </svg>
)

export const IconTrash = (p) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M9.5 7V5.2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7" />
    <path d="m6.5 7 .9 12.1a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9L17.5 7" />
  </svg>
)

export const IconCalendario = (p) => (
  <svg {...base} {...p}>
    <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
    <path d="M8 3v4M16 3v4M4 10.5h16" />
  </svg>
)

// El marcador de la lectura actual: la cinta que se deja puesta en el libro
// que el club está leyendo ahora mismo.
export const IconMarcador = (p) => (
  <svg {...base} {...p}><path d="M7 4h10v16l-5-4.2L7 20z" /></svg>
)

// Una diana: hasta dónde hay que llegar. La usa el club para marcar la página
// objetivo de la próxima quedada, donde solo caben un icono y un número.
export const IconObjetivo = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.6" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
  </svg>
)

// ─── Diskordkito ───────────────────────────────────────────────────────────
// Un bocadillo, que es lo que es. Sin la cola apuntando a ningún sitio: a
// tamaño de icono de menú, la cola solo ensucia la silueta.
export const IconChat = (p) => (
  <svg {...base} {...p}>
    <path d="M20 12.5c0 3.9-3.6 7-8 7-1 0-2-.2-2.9-.5L4 20.5l1.6-3.4A6.6 6.6 0 0 1 4 12.5c0-3.9 3.6-7 8-7s8 3.1 8 7z" />
  </svg>
)

// Enviar: la flecha que sale, no un avión de papel — el resto de iconos de la
// app son trazos simples y un avión canta como prestado de otra parte.
export const IconEnviar = (p) => (
  <svg {...base} {...p}><path d="M5 12h13m-6-6 6 6-6 6" /></svg>
)

// ─── Llamadas ──────────────────────────────────────────────────────────────
export const IconTelefono = (p) => (
  <svg {...base} {...p}>
    <path d="M7.5 4h-2a1.5 1.5 0 0 0-1.5 1.6c.4 8 6.4 14 14.4 14.4a1.5 1.5 0 0 0 1.6-1.5v-2a1.5 1.5 0 0 0-1.2-1.5l-2.3-.5a1.5 1.5 0 0 0-1.5.6l-.7 1a12 12 0 0 1-5.4-5.4l1-.7a1.5 1.5 0 0 0 .6-1.5l-.5-2.3A1.5 1.5 0 0 0 7.5 4z" />
  </svg>
)

// El de colgar es el mismo auricular girado, como en todos los teléfonos desde
// hace cuarenta años: no hace falta explicarlo.
export const IconColgar = (p) => (
  <svg {...base} {...p}>
    <path d="M2.8 13.2a15 15 0 0 1 18.4 0" />
    <path d="M6.6 12.1 5.2 15a1.3 1.3 0 0 1-1.6.7l-1.1-.4a1.3 1.3 0 0 1-.7-1.8l.9-1.7M17.4 12.1l1.4 2.9a1.3 1.3 0 0 0 1.6.7l1.1-.4a1.3 1.3 0 0 0 .7-1.8l-.9-1.7" />
  </svg>
)

export const IconVideoCamara = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="6.5" width="12.5" height="11" rx="2.5" />
    <path d="m15.5 11 5-2.6v7.2l-5-2.6z" />
  </svg>
)
export const IconVideoCamaraOff = (p) => (
  <svg {...base} {...p}>
    <path d="M8.5 6.5H13a2.5 2.5 0 0 1 2.5 2.5v1.2M15.5 14.6V15a2.5 2.5 0 0 1-2.5 2.5H5.5A2.5 2.5 0 0 1 3 15V9a2.5 2.5 0 0 1 1.6-2.3" />
    <path d="m15.5 11 5-2.6v7.2l-2.6-1.3M3.5 3.5l17 17" />
  </svg>
)

export const IconMicro = (p) => (
  <svg {...base} {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
  </svg>
)
export const IconMicroOff = (p) => (
  <svg {...base} {...p}>
    <path d="M15 5.8V6a3 3 0 0 0-6 0v5c0 .4.1.8.2 1.1M9.6 14.4A3 3 0 0 0 15 12.6V11" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 9.8 5.6M18.5 11.5a6.5 6.5 0 0 1-.6 2.7M12 18v3M3.5 3.5l17 17" />
  </svg>
)

// Encoger la llamada a una pastilla para seguir usando Puchi, y volver a ella.
export const IconEncoger = (p) => (
  <svg {...base} {...p}><path d="m7 10 5 5 5-5" /><path d="M5 5h14" /></svg>
)
