import { LLEGADA, SALIDA, enCss } from './curvas'

// Abrir y cerrar un trozo de contenido, con su altura animada, en CSS.
//
// Con Motion (`height: 'auto'`) la altura se calculaba y se escribía desde
// JavaScript en cada fotograma, y Safari deja eso a 60 por segundo aunque la
// pantalla vaya a 120 (ver ui/curvas.js). Aquí la anima el navegador: una
// rejilla de una sola fila que pasa de 0fr a 1fr. El contenido vive siempre
// montado (y `inert` cuando está cerrado, para que no se pueda llegar a él
// con el teclado ni lo lea el lector de pantalla).

export default function Desplegable({ abierto, children, className = '' }) {
  const curva = enCss(abierto ? LLEGADA : SALIDA)
  return (
    <div
      className={`grid ${className}`}
      style={{
        gridTemplateRows: abierto ? '1fr' : '0fr',
        opacity: abierto ? 1 : 0,
        transition: `grid-template-rows ${curva}, opacity ${curva}`,
      }}
      inert={!abierto}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}
