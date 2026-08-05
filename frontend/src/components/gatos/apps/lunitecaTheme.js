// Tokens de diseño de Luniteca — alineados con la paleta de Diskordkito
// (fondo azul-grisáceo oscuro, acento "blurple"). En su propio archivo para
// que LunitecaV2.jsx y sus modales (BulkAddModal, etc.) puedan
// compartirlos sin crear una importación circular entre ellos.
//
// Cada valor es una variable CSS (definida en index.css, dentro de
// `.luniteca-root` / `.luniteca-root.luni-light`) en vez de un color fijo,
// para poder soportar modo oscuro/claro sin tocar los ~400 sitios que ya
// usan `C.xxx` — solo hace falta que el contenedor raíz de Luniteca lleve
// la clase `luniteca-root` (y `luni-light` cuando corresponda).
export const C = {
  bg:        'var(--luni-bg)',
  surface:   'var(--luni-surface)',
  surfaceHi: 'var(--luni-surfaceHi)',
  border:    'var(--luni-border)',
  accent:    'var(--luni-accent)',
  accentBg:  'var(--luni-accentBg)',
  accentBd:  'var(--luni-accentBd)',
  text:      'var(--luni-text)',
  sub:       'var(--luni-sub)',
  muted:     'var(--luni-muted)',
  read:      'var(--luni-read)',
  reading:   'var(--luni-reading)',
  want:      'var(--luni-want)',
  dropped:   'var(--luni-dropped)',
  // Solo usados en la barra lateral de navegación (fuera de C originalmente,
  // eran rgba(255,255,255,...) fijos) — ver LunitecaV2.jsx.
  railInactive: 'var(--luni-railInactive)',
  railHover:    'var(--luni-railHover)',
  railDot:      'var(--luni-railDot)',
}
