import { useImperativeHandle, useRef } from 'react'

// El marco (fondo, borde y esquinas redondas) de una tarjeta que se pliega y
// se despliega, para que encoja y crezca con el telón (ui/Desplegable) en vez
// de quedarse con su tamaño hasta el final y cambiar de golpe.
//
// La altura no se anima (va en el hilo principal, a 60 en Safari): el marco
// son tres piezas por detrás del contenido. La de arriba, con sus esquinas,
// no se mueve; la de abajo, con las suyas, se desliza con lo que hay debajo
// (translate); y el tramo de en medio se estira o encoge (scaleY desde
// arriba: los lados son rayas verticales, y estiradas no se deforman). Todo
// transform, en la GPU, a la frecuencia de la pantalla.
//
// Se pone como primer hijo de una caja `relative isolate` sin fondo ni borde
// propios, y su `telon` se le pasa al Desplegable de dentro:
//
//   const marco = useRef(null)
//   <section className="relative isolate">
//     <Marco ref={marco} resaltado={abierto} />
//     …
//     <Desplegable abierto={abierto} onTelon={t => marco.current?.telon(t)}>…</Desplegable>
//   </section>
//
// `resaltado`: el borde de color de abierta, como una capa que aparece con un
// fundido de opacidad (fundir el color del borde va en el hilo principal).
// `fondo` (una clase) y `borde` (un color): por defecto, los de una tarjeta.

const PIEZA = 'pointer-events-none absolute inset-x-0 -z-10'
const RESALTE = 'pointer-events-none absolute border-accent-line transition-opacity duration-200'
// El tramo de en medio se solapa un píxel con las otras dos, para que a mitad
// de camino no asome una raya entre piezas.
const SOLAPE = 1

export default function Marco({ ref, radio = 28, resaltado = false, fondo = 'bg-surface', borde = null }) {
  const caja = useRef(null)
  const cuerpo = useRef(null)
  const pie = useRef(null)

  useImperativeHandle(ref, () => ({
    // Lo llama el Desplegable con lo que cambia de alto el contenido (con el
    // DOM ya abierto, abriendo o cerrando) y las mismas opciones de su
    // animación. Devuelve las animaciones, para que las quite a la vez que las
    // suyas.
    telon({ abriendo, delta, opciones }) {
      const alto = caja.current?.parentElement?.offsetHeight
      if (!alto || !cuerpo.current || !pie.current || delta < 0.5) return []
      const borde = radio - SOLAPE
      const tramo = Math.max(1, alto - 2 * borde)
      const plegado = `scaleY(${Math.max(0, alto - delta - 2 * borde) / tramo})`
      const subido = `translateY(${-delta}px)`
      const [desdeC, hastaC] = abriendo ? [plegado, 'none'] : ['none', plegado]
      const [desdeP, hastaP] = abriendo ? [subido, 'none'] : ['none', subido]
      return [
        cuerpo.current.animate([{ transform: desdeC }, { transform: hastaC }], opciones),
        pie.current.animate([{ transform: desdeP }, { transform: hastaP }], opciones),
      ]
    },
  }), [radio])

  const r = `${radio}px`
  const resalte = { opacity: resaltado ? 1 : 0 }
  const pieza = `${PIEZA} ${fondo} ${borde ? '' : 'border-line'}`
  const color = borde ? { borderColor: borde } : null
  return (
    <span ref={caja} aria-hidden className="contents">
      <span className={`${pieza} top-0 border-x border-t`} style={{ ...color, height: r, borderTopLeftRadius: r, borderTopRightRadius: r }}>
        <span className={`${RESALTE} -inset-x-px -top-px border-x border-t`} style={{ ...resalte, bottom: 0, borderTopLeftRadius: r, borderTopRightRadius: r }} />
      </span>
      <span ref={cuerpo} className={`${pieza} origin-top border-x`} style={{ ...color, top: radio - SOLAPE, bottom: radio - SOLAPE }}>
        <span className={`${RESALTE} -inset-x-px inset-y-0 border-x`} style={resalte} />
      </span>
      <span ref={pie} className={`${pieza} bottom-0 border-x border-b`} style={{ ...color, height: r, borderBottomLeftRadius: r, borderBottomRightRadius: r }}>
        <span className={`${RESALTE} -inset-x-px -bottom-px border-x border-b`} style={{ ...resalte, top: 0, borderBottomLeftRadius: r, borderBottomRightRadius: r }} />
      </span>
    </span>
  )
}
