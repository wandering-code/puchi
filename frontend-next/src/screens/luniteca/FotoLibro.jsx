import { motion } from 'motion/react'
import { IconCamara, IconCheck, IconImagen } from '../../ui/icons'

// Las piezas que comparten las hojas de lomo y portada (SelectorLomo,
// SelectorPortada y las del alta a mano): arriba, lo que hay puesto AHORA y
// de dónde sale; debajo, las dos maneras de poner otra (la cámara con guías
// como principal, la galería como alternativa); y, en las galerías, la
// marca de la elegida. Así las tres hojas se leen igual.

// Lo que hay puesto ahora. `muestra` es el lomo o la portada en pequeño;
// `origen`, de dónde sale en una frase.
export function Actual({ muestra, origen, nota = null }) {
  return (
    <div className="mb-5 flex items-center gap-4 rounded-2xl bg-surface-2/60 p-3.5">
      <div className="flex shrink-0 items-end">{muestra}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-mute">Ahora en tu estantería</p>
        <p className="mt-1 text-[15px] font-semibold leading-snug">{origen}</p>
        {nota && <p className="mt-1 text-xs leading-relaxed text-ink-mute">{nota}</p>}
      </div>
    </div>
  )
}

// Las dos puertas para poner una foto nueva.
export function AccionesFoto({ tipo, onCamara, onGaleria, desactivado = false }) {
  return (
    <div className="grid gap-2.5">
      <motion.button
        type="button"
        onClick={onCamara}
        disabled={desactivado}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-3.5 rounded-2xl bg-accent px-4 py-3.5 text-left text-on-accent disabled:opacity-60"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
          <IconCamara className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Hacer una foto</span>
          <span className="block text-[12px] opacity-80">
            {tipo === 'lomo' ? 'Con marco y nivel, para que el lomo salga recto' : 'Con marco y nivel, para que la portada salga recta'}
          </span>
        </span>
      </motion.button>
      <motion.button
        type="button"
        onClick={onGaleria}
        disabled={desactivado}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-3.5 rounded-2xl border border-line px-4 py-3 text-left disabled:opacity-60"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-dim">
          <IconImagen className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">Elegir de la galería</span>
          <span className="block text-[12px] text-ink-mute">Una foto que ya tengas en el móvil</span>
        </span>
      </motion.button>
    </div>
  )
}

// El título de cada tanda de opciones, con cuántas hay.
export function Tanda({ titulo, cuantas = null, children }) {
  return (
    <section className="mt-6">
      <h4 className="mb-3 flex items-baseline gap-2 text-[11px] uppercase tracking-[0.14em] text-ink-mute">
        {titulo}
        {cuantas != null && <span className="tabular-nums text-ink-mute/70">{cuantas}</span>}
      </h4>
      {children}
    </section>
  )
}

// El aro y la marca de la opción elegida. Con `layoutId`, al cambiar de
// elegida el aro se desliza de una a otra en vez de saltar.
export function MarcaElegida({ grupo, redondeo = 6 }) {
  return (
    <>
      <motion.span
        layoutId={`elegida-${grupo}`}
        className="pointer-events-none absolute -inset-[3px] border-2 border-accent"
        style={{ borderRadius: redondeo + 3 }}
        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
      />
      <motion.span
        className="pointer-events-none absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-on-accent shadow"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 600, damping: 30 }}
      >
        <IconCheck className="h-3 w-3" strokeWidth={2.4} />
      </motion.span>
    </>
  )
}

// Las opciones de una galería aparecen una detrás de otra, no de golpe.
export const aparecer = (i) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, delay: Math.min(i, 10) * 0.035, ease: [0.22, 1, 0.36, 1] },
})
