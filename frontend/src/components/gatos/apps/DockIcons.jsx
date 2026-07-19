// Iconos SVG de apps para el Dock — estilo macOS (44×44, gradiente + símbolo blanco)

function AppIconDiskordkito({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <defs>
        <linearGradient id="g-disko" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      <rect width="44" height="44" rx="10" fill="url(#g-disko)" />
      {/* Orejas de gato encima de la burbuja */}
      <path d="M14 14 L11 8 L17 12" fill="white" opacity="0.75" />
      <path d="M30 14 L33 8 L27 12" fill="white" opacity="0.75" />
      {/* Burbuja de chat */}
      <path d="M10 15 Q10 11 14 11 L30 11 Q34 11 34 15 L34 27 Q34 31 30 31 L22 31 L18 36 L18 31 L14 31 Q10 31 10 27 Z"
        fill="white" opacity="0.95" />
      {/* Tres puntos */}
      <circle cx="17" cy="21" r="2.1" fill="#5865f2" />
      <circle cx="22" cy="21" r="2.1" fill="#5865f2" />
      <circle cx="27" cy="21" r="2.1" fill="#5865f2" />
    </svg>
  )
}

function AppIconLuniteca({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <defs>
        <linearGradient id="g-luni" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
      </defs>
      <rect width="44" height="44" rx="10" fill="url(#g-luni)" />
      {/* Lomo del libro */}
      <rect x="21" y="10" width="2" height="24" rx="1" fill="white" opacity="0.6" />
      {/* Página izquierda */}
      <path d="M22 11 C18 10 11 11 9 13 L9 33 C11 31.5 17 31 22 32 Z"
        fill="white" opacity="0.9" />
      {/* Página derecha */}
      <path d="M22 11 C26 10 33 11 35 13 L35 33 C33 31.5 27 31 22 32 Z"
        fill="white" opacity="0.78" />
      {/* Marcapáginas */}
      <path d="M30 9 L28 9 L28 18 L29 17 L30 18 Z" fill="white" opacity="0.95" />
    </svg>
  )
}

function AppIconPirestore({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <defs>
        <linearGradient id="g-pire" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#be185d" />
        </linearGradient>
      </defs>
      <rect width="44" height="44" rx="10" fill="url(#g-pire)" />
      {/* Asas de la bolsa */}
      <path d="M17 19 Q17 12 22 12 Q27 12 27 19"
        stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.95" />
      {/* Cuerpo de la bolsa */}
      <path d="M12 19 L13.5 36 L30.5 36 L32 19 Z" fill="white" opacity="0.92" />
      {/* Estrella */}
      <path d="M22 23.5 L23.1 26.8 L26.6 26.8 L23.8 28.8 L24.9 32 L22 30 L19.1 32 L20.2 28.8 L17.4 26.8 L20.9 26.8 Z"
        fill="#ec4899" opacity="0.9" />
    </svg>
  )
}

function AppIconSettings({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <defs>
        <linearGradient id="g-sett" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
      </defs>
      <rect width="44" height="44" rx="10" fill="url(#g-sett)" />
      {/* Slider 1 */}
      <line x1="10" y1="15" x2="34" y2="15" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.45" />
      <circle cx="17" cy="15" r="4.5" fill="white" opacity="0.95" />
      {/* Slider 2 */}
      <line x1="10" y1="23" x2="34" y2="23" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.45" />
      <circle cx="27" cy="23" r="4.5" fill="white" opacity="0.95" />
      {/* Slider 3 */}
      <line x1="10" y1="31" x2="34" y2="31" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.45" />
      <circle cx="20" cy="31" r="4.5" fill="white" opacity="0.95" />
    </svg>
  )
}

function AppIconAdmin({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <defs>
        <linearGradient id="g-admin" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
      </defs>
      <rect width="44" height="44" rx="10" fill="url(#g-admin)" />
      {/* Escudo */}
      <path d="M22 9 L32 13 L32 21 Q32 30 22 35 Q12 30 12 21 L12 13 Z"
        fill="white" opacity="0.92" />
      {/* Check */}
      <path d="M17 22 L20.5 25.5 L27 18" stroke="#475569" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

export const DOCK_ICONS = {
  diskordkito: AppIconDiskordkito,
  luniteca2:   AppIconLuniteca,
  pirestore:   AppIconPirestore,
  settings:    AppIconSettings,
  admin:       AppIconAdmin,
}
