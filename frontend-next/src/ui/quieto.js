import { useEffect, useState } from 'react'

// Congelar la pantalla de debajo mientras algo se mueve por encima: la ficha
// subiendo o bajando, o un libro volando de la balda a su portada.
//
// Va por un contador y no por "poner y quitar" a pelo porque hay dos cosas que
// lo piden a la vez (la ficha y el vuelo) y se solapan: la última en soltar
// devolvía el gesto aunque la otra siguiera en marcha, o al revés, lo dejaba
// cortado. Con un contador, se suelta cuando ya no lo pide nadie.
//
// Se corta el GESTO (touch-action) y no el overflow: cambiar el overflow de un
// contenedor con scroll puede saltar su posición, y eso se vería peor que el
// problema que se quiere evitar.
let cuantos = 0
const oyentes = new Set()

function zona() {
  return document.querySelector('[data-scroll="pantalla"]')
}

export function congelarPantalla() {
  cuantos += 1
  const donde = zona()
  if (donde) donde.style.touchAction = 'none'
  oyentes.forEach(avisar => avisar(true))
  let hecho = false
  return function soltar() {
    if (hecho) return
    hecho = true
    cuantos = Math.max(0, cuantos - 1)
    const ahora = zona()
    if (cuantos === 0) {
      if (ahora) ahora.style.touchAction = ''
      oyentes.forEach(avisar => avisar(false))
    }
  }
}

// ¿Hay algo moviéndose ahora mismo? Lo pregunta la ficha para no dejarse
// desplazar mientras el libro todavía está volando hacia ella: su animación
// termina antes que el vuelo, y sin esto se podía apartar la portada justo
// cuando el libro iba a posarse encima.
export function usarPantallaOcupada() {
  const [ocupada, setOcupada] = useState(cuantos > 0)
  useEffect(() => {
    oyentes.add(setOcupada)
    setOcupada(cuantos > 0)
    return () => { oyentes.delete(setOcupada) }
  }, [])
  return ocupada
}

// `tope` es una red de seguridad, no el plan: lo normal es que se suelte al
// acabar la animación. Pero si esa animación no llega a empezar (Motion no
// anima lo que ya está en su sitio, y entonces tampoco avisa de que ha
// terminado), sin tope la pantalla se quedaba clavada para siempre.
export function usarPantallaQuieta(activo, tope = 900) {
  useEffect(() => {
    if (!activo) return
    const soltar = congelarPantalla()
    const reloj = setTimeout(soltar, tope)
    return () => { clearTimeout(reloj); soltar() }
  }, [activo, tope])
}
