import { useRef } from 'react'
import { useRecolocar } from './recolocar'

// Un contenedor cuyos hijos se recolocan suaves cuando uno llega, se va o
// cambia de tamaño (ver ui/recolocar.js), en vez de `layout` de Motion en cada
// hijo. Lleva `relative` para que los sitios se midan contra él.
export default function Lista({ as: Etiqueta = 'div', className = '', escalar = false, children, ...resto }) {
  const ref = useRef(null)
  useRecolocar(ref, { escalar })
  return <Etiqueta ref={ref} className={`relative ${className}`} {...resto}>{children}</Etiqueta>
}
