import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Utilidad estándar de shadcn/ui — combina clases condicionales (clsx) y
// resuelve conflictos entre clases de Tailwind (twMerge), para que un
// `className` pasado desde fuera pueda sobrescribir limpiamente el de un
// componente sin dejar clases duplicadas/contradictorias.
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
