import { usarTinteDePortada } from './colorPortada'

// El tinte del color de la portada, como una capa por debajo del contenido de
// la tarjeta que aparece con un fundido de opacidad (en la GPU, a la
// frecuencia de la pantalla). Antes se fundía el color de fondo y el del
// borde de la propia tarjeta, y eso va en el hilo principal, a 60 en Safari.
//
// La tarjeta tiene que llevar `relative isolate` (TARJETA_TENIDA ya los lleva)
// y esto como primer hijo: el `-z-10` lo deja debajo del contenido pero
// encima del fondo neutro de la tarjeta.
export default function TinteDePortada({ url }) {
  const tinte = usarTinteDePortada(url)
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -inset-px -z-10 rounded-[inherit] border transition-opacity duration-300"
      style={{ ...(tinte || {}), opacity: tinte ? 1 : 0 }}
    />
  )
}
