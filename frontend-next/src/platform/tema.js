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
