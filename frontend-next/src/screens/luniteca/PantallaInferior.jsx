import { useLayoutEffect, useRef, useState } from 'react'
import { usarNodoQuieto, usarPantallaOcupada, usarPantallaQuieta } from '../../ui/quieto'
import { LLEGADA, SALIDA } from '../../ui/curvas'
import { createPortal } from 'react-dom'
import { motion, useIsPresent } from 'motion/react'
import { useArrastreParaCerrar } from '../../ui/arrastre'

// Una pantalla completa que sube desde abajo: la ficha de un libro y añadir
// libro. Es la hermana mayor de HojaInferior — misma llegada y mismo gesto para
// cerrar, pero ocupando casi todo el alto en vez de lo que mida su contenido.
//
// Se usa para lo que tiene mucho dentro o cambia de tamaño mientras se usa: una
// hoja que crece y encoge según lo que enseñe da un salto cada vez, y eso se
// nota (pasó con las pestañas de Buscar y A mano).
//
// NO lleva su propio AnimatePresence: quien la usa la monta dentro del suyo, y
// así la animación de salida funciona al desmontarla.

// Lo que se deja ver de la pantalla de debajo, arriba del todo. No llega al
// borde a propósito: esa franja recuerda que lo de abajo sigue ahí y que esto
// se cierra, igual que las hojas del propio iPhone. En un móvil con notch se
// usa el alto de la zona segura, que ya deja el hueco justo bajo la barra de
// estado.
const HUECO = 'max(2rem, env(safe-area-inset-top))'

export default function PantallaInferior({ abierta = true, onCerrar, cabecera, children, aparicion = 'subir', visible = true }) {
  // `aparicion`: 'subir' es la de siempre. 'fundido' es para cuando el libro ya
  // ha volado hasta aquí desde la estantería: la pantalla no puede subir
  // también, porque entonces la portada se movería mientras el libro aterriza
  // sobre ella.
  const subiendo = aparicion === 'subir'
  // Igual que HojaInferior y que el menú lateral: el armazón se queda montado
  // y solo se mueve. Quien la usa la mantiene montada con la última ficha que
  // se abrió, así que al abrir la siguiente no hay que levantar nada.
  const aVista = abierta && visible
  // Con 'fundido' la pantalla ya está en su sitio desde el primer fotograma
  // aunque no se vea: así se puede medir dónde cae su portada mientras el libro
  // todavía está volando hacia ella.
  // El gesto de cerrar va solo en el asa. Si estuviera en todo el panel, Motion
  // le pondría touch-action al elemento que contiene el scroll y el contenido
  // no se podría desplazar con el dedo (ver ui/arrastre.js).
  const arrastre = useArrastreParaCerrar(onCerrar, { umbral: 110 })
  const cuerpo = useRef(null)
  // Mientras la ficha va de un sitio a otro —subiendo o bajando— no se
  // desplaza nada: ni ella ni la pantalla de debajo. Un scroll a media
  // animación se ve como un tirón, y con el libro volando además lo deja
  // aterrizando donde ya no hay nada.
  //
  // Y al abrirse llega siempre por arriba: como ya no se desmonta al cerrarla,
  // sin esto la siguiente (o la misma otra vez) aparecía por donde se hubiera
  // quedado.
  // ¿Nace ya abierta? La ficha vive premontada y cerrada, así que no debe
  // animar nada al montarse (initial={false}); pero "añadir libro" se monta
  // en el momento de abrirse, y con initial={false} aparecía plantada en su
  // sitio, sin subir. Cada una necesita un arranque distinto.
  const nacioAbierta = useRef(abierta)
  // ¿Sigue montada, o quien la usa la está quitando? La ficha vive premontada
  // y esto vale siempre true; "añadir libro" sí se monta y se desmonta, y es
  // lo que avisa de que se está yendo para que baje en vez de desaparecer.
  const presente = useIsPresent()

  const [moviendose, setMoviendose] = useState(false)
  const estrenada = useRef(false)
  const colchon = useRef(null)
  // Al acabar la animación se espera un pelín antes de devolver el gesto. Sin
  // esto iba muy justo —medido: la ficha se quedaba quieta a 448ms y el gesto
  // volvía a 481ms—, y basta con que el muelle asiente un poco más lento para
  // que se pueda desplazar la ficha mientras todavía se está colocando.
  const soltarConCalma = () => {
    clearTimeout(colchon.current)
    colchon.current = setTimeout(() => setMoviendose(false), 140)
  }
  useLayoutEffect(() => {
    // El primer render no es un movimiento: la ficha nace donde le toca.
    if (!estrenada.current) { estrenada.current = true; if (!abierta) return }
    if (abierta && cuerpo.current) cuerpo.current.scrollTop = 0
    clearTimeout(colchon.current)
    setMoviendose(true)
    // Red de seguridad, y no un adorno: si el panel ya está donde tiene que
    // estar, Motion no anima nada y no avisa de que haya terminado, así que
    // sin esto el gesto se quedaba cortado PARA SIEMPRE. Pasaba justo en la
    // primera ficha que se abría en cada sesión, que es la que se monta ya
    // colocada; las siguientes sí animan y se soltaban solas.
    const suelta = setTimeout(() => setMoviendose(false), 900)
    return () => { clearTimeout(suelta); clearTimeout(colchon.current) }
  }, [abierta])
  // Mientras se va tampoco se desplaza nada: es el mismo movimiento que al
  // cerrarla desde dentro, y allí ya se bloqueaba.
  usarPantallaQuieta(moviendose || !presente)
  // Y tampoco se desplaza mientras haya algo más en marcha —el libro volando,
  // sin ir más lejos—, que acaba después que ella.
  const ocupada = usarPantallaOcupada()
  const quieta = moviendose || ocupada || !presente
  usarNodoQuieto(cuerpo, quieta)

  return createPortal(
    <>
      {/* La franja que queda a la vista, difuminada: lo de detrás se reconoce
          pero no compite con lo que hay delante. */}
      <motion.div
        className="fixed inset-0 z-50 bg-velo backdrop-blur-[6px]"
        initial={nacioAbierta.current ? { opacity: 0 } : false}
        animate={{ opacity: abierta ? 1 : 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        style={{ pointerEvents: abierta ? 'auto' : 'none' }}
        onClick={() => onCerrar()}
        aria-hidden
      />

      <motion.div
        data-panel="pantalla"
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[28px] border-t border-line bg-bg sombra-panel"
        style={{ y: arrastre.y, top: HUECO, pointerEvents: abierta ? 'auto' : 'none', willChange: 'transform' }}
        inert={!abierta}
        initial={nacioAbierta.current ? (subiendo ? { y: '100%' } : { opacity: 0 }) : false}
        // Las dos propiedades se animan SIEMPRE, cada una con su regla. Antes
        // se animaba solo una según el modo, y como el modo cambia al cerrarse
        // (el vuelo acaba y se vuelve a 'subir'), la ficha se aparcaba abajo
        // recuperando la opacidad, y la siguiente que llegaba con vuelo se veía
        // un fotograma abajo del todo antes de plantarse en su sitio.
        animate={{ y: abierta ? 0 : '100%', opacity: aVista ? 1 : 0 }}
        // Al desmontarse hay que decirlo aparte: `animate` no llega a correr
        // porque para entonces el elemento ya no está. Sin esto, "añadir
        // libro" no bajaba, desaparecía de golpe (la ficha no lo notaba
        // porque vive premontada y nunca se desmonta).
        exit={{ y: '100%', transition: SALIDA }}
        onAnimationComplete={soltarConCalma}
        transition={{
          // Subiendo, el panel llega con su muelle. Con el libro volando no se
          // mueve: se planta donde toca de un fotograma para otro, todavía
          // transparente, y lo que se ve es el fundido. Al cerrarse así, se
          // espera a que el fundido acabe antes de aparcarlo abajo.
          y: subiendo
            ? (abierta ? LLEGADA : SALIDA)
            : { duration: 0, delay: abierta ? 0 : 0.34 },
          opacity: subiendo
            // Subiendo se ve entero todo el rato: aparece al abrir y se apaga
            // cuando ya ha salido de la pantalla.
            ? { duration: 0, delay: abierta ? 0 : 0.32 }
            // El fundido es largo y empieza algo después de arrancar el vuelo:
            // la ficha va apareciendo mientras el libro sube, en vez de salir
            // de golpe cuando aterriza.
            : { duration: 0.34, delay: aVista ? 0.14 : 0 },
        }}
      >
        {/* El asa ya no necesita apartarse de la zona segura: el panel entero
            empieza por debajo de ella. */}
        <div {...arrastre.asa} className="flex shrink-0 cursor-grab justify-center pb-1 pt-2 active:cursor-grabbing">
          <span className="h-1 w-10 rounded-full bg-line" />
        </div>

        <div ref={cuerpo} className="flex-1 overflow-y-auto overscroll-contain">
          {cabecera}
          {children}
        </div>
      </motion.div>
    </>,
    document.body,
  )
}
