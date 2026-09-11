import { useCallback, useState } from 'react'

// Tu propia imagen, en tres tamaños.
//
// Un toque pasa al siguiente y del último vuelve al primero. Tres y no dos
// porque "un poco más grande" y "quiero verme bien" son dos cosas distintas, y
// porque con un ciclo siempre se puede volver sin buscar otro botón.
//
// Lo que NO hace: ponerte en primer plano. Verte a ti mismo grande es para
// comprobar que sales bien encuadrado, no para protagonizar la llamada — y en
// una llamada de grupo, quitarte el sitio a otro para ponerte tú sería justo lo
// contrario de lo que se quiere. El primer plano se lo lleva a quien tocas.
export const TAMANOS = ['pequena', 'mediana', 'grande']

// Medidas de la tarjeta flotante del uno a uno. En píxeles y no en clases de
// Tailwind porque se animan: pasar de una clase a otra da un salto, y animar el
// número da el estirón.
export const CAJA = {
  pequena: { width: 96, height: 136 },
  mediana: { width: 132, height: 186 },
  grande: { width: 180, height: 254 },
}

// Cuánto crece tu cuadrito dentro de la fila de la llamada de grupo. Ahí no se
// puede crecer tanto como en el uno a uno: la fila tiene un alto, y lo que se
// agranda empujaría a los demás fuera de la pantalla.
export const EN_LA_FILA = { pequena: 1, mediana: 1.3, grande: 1.6 }

export function usarMiTamano() {
  const [tamano, setTamano] = useState('pequena')
  const siguiente = useCallback(() => {
    setTamano(actual => TAMANOS[(TAMANOS.indexOf(actual) + 1) % TAMANOS.length])
  }, [])
  return [tamano, siguiente]
}
