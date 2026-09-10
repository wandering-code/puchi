// Claro u oscuro, para toda Puchi: Inicio, Luniteca, Actividad y Ajustes.
//
// El tema de verdad vive en la cuenta, como la vista y el resto de gustos
// (platform/preferencias.jsx): es de la persona, no del navegador, así que el
// móvil y el ordenador se ven igual. Pero la cuenta tarda en llegar —hay que
// pedirla al servidor—, y mientras tanto la app ya está pintada. De ahí la
// copia en localStorage: no manda, solo sirve para acertar en el primer
// fotograma y no soltar un fogonazo blanco al abrir con el oscuro puesto.

export const TEMAS = ['claro', 'oscuro']

const CLAVE = 'luni_tema'

// El color con el que iOS pinta la barra de estado y el fondo de la app
// instalada. Es una meta, no una variable CSS, así que hay que moverla a mano
// cuando cambia el tema; si no, la barra se queda del color del otro.
const BARRA = { claro: '#f7f3ee', oscuro: '#16120e' }

export function temaGuardado() {
  try {
    const v = localStorage.getItem(CLAVE)
    return TEMAS.includes(v) ? v : 'claro'
  } catch {
    // Safari en privado tira al leer localStorage.
    return 'claro'
  }
}

export function aplicarTema(tema) {
  const elegido = TEMAS.includes(tema) ? tema : 'claro'
  document.documentElement.dataset.tema = elegido
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', BARRA[elegido])
  try { localStorage.setItem(CLAVE, elegido) } catch { /* ver arriba */ }
  return elegido
}

// El cambio de tema, con el círculo que se abre desde donde lo has tocado.
//
// Lo hace la View Transitions API, que es la única forma de que se vea el
// contenido NUEVO apareciendo: el navegador guarda una foto de la pantalla de
// antes, aplica el cambio, y deja animar una encima de otra. Sin ella habría
// que tapar con un color plano y el contenido saldría de golpe al destaparlo.
//
// Si no está (o si el sistema pide menos movimiento), el tema se aplica y ya.
// Es una gracia, no la funcionalidad: nunca debe impedir el cambio.
// `alAplicar` va DENTRO de la transición a propósito, y esto es lo que la hace
// funcionar. Guardar la preferencia provoca un render de React, y su efecto
// vuelve a aplicar el tema; si eso pasa fuera, ocurre antes de que la
// transición saque la foto del "antes" —basta con que se cuele en un
// microtask— y entonces las dos fotos son idénticas: la animación corre
// entera sin que se vea absolutamente nada. Medido: al entrar en el callback
// el documento ya decía "oscuro".
export function cambiarDeTema(tema, origen, alAplicar = () => {}) {
  const aplicar = () => { aplicarTema(tema); alAplicar() }
  const menosMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || menosMovimiento || !origen) {
    aplicar()
    return
  }
  const transicion = document.startViewTransition(aplicar)
  transicion.ready.then(() => {
    const { x, y } = origen
    // El radio es hasta la esquina más lejana: si no, el círculo termina
    // antes de cubrir la pantalla y el último trozo cambia de golpe.
    const radio = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    )
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radio}px at ${x}px ${y}px)`] },
      {
        duration: 520,
        easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
        // Se recorta la foto NUEVA, que va encima: así el tema entrante se
        // abre paso sobre el anterior en vez de que el anterior se encoja.
        pseudoElement: '::view-transition-new(root)',
      },
    )
  }).catch(() => { /* si la transición se cancela, el tema ya está puesto */ })
}
