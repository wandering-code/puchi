// Cómo llegan y se van las capas que se abren encima: el menú lateral, las
// hojas y la ficha de un libro.
//
// Antes cada una traía su propio muelle (stiffness 420-460, damping 40-42), y
// un muelle blando reparte mal el tiempo: medido en el menú, tardaba 368ms en
// llegar, con los dos primeros fotogramas casi sin moverse y una cola de
// 133ms para recorrer los últimos 17px. Los fotogramas iban a 60, pero la
// sensación no era la del scroll —que responde al instante y para en seco—
// sino la de algo blandengue.
//
// Esta curva es la de los paneles del sistema: sale disparada y frena al
// final sin rebote ni cola. Con 300ms el gesto se siente inmediato y el
// recorrido se ve entero.
export const LLEGADA = { duration: 0.3, ease: [0.32, 0.72, 0, 1] }

// Irse puede ser algo más rápido que llegar: al cerrar ya sabes lo que va a
// pasar y esperar la misma ceremonia cansa.
export const SALIDA = { duration: 0.24, ease: [0.4, 0, 0.6, 1] }
