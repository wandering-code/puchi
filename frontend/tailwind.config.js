/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
      },
      // Colores de shadcn/ui — solo se resuelven a algo visible dentro de
      // .luniteca3-root (Luniteca nueva, issue #8), que es donde viven las
      // variables --background/--primary/etc. (ver index.css). Puramente
      // aditivo: ninguna clase existente en el resto de la app usa estos
      // nombres, así que no cambia nada fuera de ese contenedor.
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      // Un único radio en toda Luniteca (nueva) — "bordes mínimamente
      // redondeados" (ver feedback del canvas de diseño). La plantilla
      // estándar de shadcn resta 2/4px a sm/md respecto a --radius (pensada
      // para una escala con --radius más grande, tipo 0.5rem); aquí eso
      // hacía que rounded-md/rounded-sm dieran 2px/0px en vez de los 4px de
      // V3_RADIUS — la inconsistencia que se colaba cada vez que usaba la
      // clase de Tailwind en vez del borderRadius:V3_RADIUS a mano. Con las
      // tres iguales a var(--radius), da igual cuál se use: siempre 4px.
      borderRadius: {
        lg: 'var(--radius)',
        md: 'var(--radius)',
        sm: 'var(--radius)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
