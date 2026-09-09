import { useEffect, useState } from 'react'

// Congelar lo que se desplaza mientras algo se mueve por encima: la ficha
// subiendo o bajando, o un libro volando de la balda a su portada.
//
// Se corta de dos maneras a la vez, y las dos hacen falta:
//
//   - `touch-action: none` impide que EMPIECE un gesto nuevo.
//   - `overflow: hidden` corta el que YA está en marcha. Sin esto quedaba el
//     hueco que se notaba: tocar un libro y seguir arrastrando sin levantar el
//     dedo (o tocarlo con la estantería aún deslizándose por inercia) es un
//     gesto que empezó ANTES de que nadie pudiera bloquearlo, y touch-action
//     ya no puede pararlo.
//
// Al cambiar el overflow, el navegador puede llevarse por delante la posición
// del scroll, así que se guarda y se repone: es la razón por la que antes solo
// se tocaba touch-action.
function congelarNodo(el) {
  if (!el) return () => {}
  const antes = { touchAction: el.style.touchAction, overflowY: el.style.overflowY, y: el.scrollTop }
  el.style.touchAction = 'none'
  el.style.overflowY = 'hidden'
  el.scrollTop = antes.y
  let hecho = false
  return function soltar() {
    if (hecho) return
    hecho = true
    el.style.touchAction = antes.touchAction
    el.style.overflowY = antes.overflowY
    el.scrollTop = antes.y
  }
}

// La pantalla de debajo la piden dos a la vez (la ficha y el vuelo) y se
// solapan, así que va por un contador: se suelta cuando ya no lo pide nadie.
// Con "poner y quitar" a pelo, el primero en soltar devolvía el gesto aunque
// el otro siguiera en marcha.
let cuantos = 0
let soltarPantalla = null
const oyentes = new Set()

export function congelarPantalla() {
  cuantos += 1
  if (cuantos === 1) {
    soltarPantalla = congelarNodo(document.querySelector('[data-scroll="pantalla"]'))
    oyentes.forEach(avisar => avisar(true))
  }
  let hecho = false
  return function soltar() {
    if (hecho) return
    hecho = true
    cuantos = Math.max(0, cuantos - 1)
    if (cuantos === 0) {
      soltarPantalla?.()
      soltarPantalla = null
      oyentes.forEach(avisar => avisar(false))
    }
  }
}

// `tope` es una red de seguridad, no el plan: lo normal es soltar al acabar la
// animación. Pero Motion no anima lo que ya está en su sitio, y entonces
// tampoco avisa de que ha terminado; sin tope, la pantalla se quedaba clavada.
export function usarPantallaQuieta(activo, tope = 900) {
  useEffect(() => {
    if (!activo) return
    const soltar = congelarPantalla()
    const reloj = setTimeout(soltar, tope)
    return () => { clearTimeout(reloj); soltar() }
  }, [activo, tope])
}

// Lo mismo para un elemento concreto (el cuerpo de la ficha, por ejemplo).
export function usarNodoQuieto(ref, activo, tope = 1400) {
  useEffect(() => {
    if (!activo) return
    const soltar = congelarNodo(ref.current)
    const reloj = setTimeout(soltar, tope)
    return () => { clearTimeout(reloj); soltar() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, tope])
}

// ¿Hay algo moviéndose ahora mismo? Lo pregunta la ficha para no dejarse
// desplazar mientras el libro todavía vuela hacia ella: su animación termina
// antes que el vuelo, y sin esto se podía apartar la portada justo cuando el
// libro iba a posarse encima.
export function usarPantallaOcupada() {
  const [ocupada, setOcupada] = useState(cuantos > 0)
  useEffect(() => {
    oyentes.add(setOcupada)
    setOcupada(cuantos > 0)
    return () => { oyentes.delete(setOcupada) }
  }, [])
  return ocupada
}
