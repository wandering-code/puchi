// Tokens de diseño de Luniteca (nueva) — issue #8. Mismo mecanismo que
// lunitecaTheme.js (variables CSS definidas en index.css, dentro de
// `.luniteca3-root`), para poder cambiar la paleta sin tocar los sitios que
// usan `V3.xxx`. Paleta y tipografía acordadas en el canvas de diseño:
// editorial cálido, tipografía recta (Public Sans), radios mínimos.
export const V3 = {
  bg:        'var(--luni3-bg)',
  surface:   'var(--luni3-surface)',
  surfaceHi: 'var(--luni3-surfaceHi)',
  border:    'var(--luni3-border)',
  text:      'var(--luni3-text)',
  sub:       'var(--luni3-sub)',
  muted:     'var(--luni3-muted)',
  accent:    'var(--luni3-accent)',
  accentBg:  'var(--luni3-accentBg)',
  accentBd:  'var(--luni3-accentBd)',
  read:      'var(--luni3-read)',
  want:      'var(--luni3-want)',
  dropped:   'var(--luni3-dropped)',
}

export const V3_FONT = "'Public Sans', system-ui, -apple-system, sans-serif"

// Radio mínimo acordado (contraste con la calidez de la paleta) — un único
// valor porque, a diferencia de la Luniteca actual, aquí no hay portadas a
// tamaños muy distintos que pidan radios distintos.
export const V3_RADIUS = 4
