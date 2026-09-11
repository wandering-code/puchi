import { useCallback, useState } from 'react'

// Tu propia imagen, en dos tamaños: un toque la agranda y otro la devuelve.
//
// Eran tres y sobraba uno. Un botón que hay que tocar tres veces para volver a
// donde estabas no es un ajuste, es una adivinanza — y encima el del medio no
// resolvía nada que no resolvieran los otros dos. Dos estados: o normal, o
// grande. Igual que tocar a otra persona la pone en primer plano y volver a
// tocarla reparte otra vez.
//
// Lo que NO hace: ponerte en primer plano. Verte a ti mismo grande es para
// comprobar que sales bien encuadrado, no para protagonizar la llamada — y en
// una llamada de grupo, quitarle el sitio a otro para ponerte tú sería justo lo
// contrario de lo que se quiere. El primer plano se lo lleva a quien tocas.
export const TAMANOS = ['normal', 'grande']

// Medidas de la tarjeta flotante del uno a uno. En píxeles y no en clases de
// Tailwind porque se animan: pasar de una clase a otra da un salto, y animar el
// número da el estirón.
export const CAJA = {
  normal: { width: 100, height: 140 },
  grande: { width: 186, height: 262 },
}

// Cuánto crece tu cuadrito según dónde esté, que no es lo mismo:
//
// - En la FILA (con alguien en primer plano) hay sitio de sobra alrededor, así
//   que puede crecer de verdad.
// - En la REJILLA, cada uno tiene su celda y crecer es invadir la del vecino.
//   Con 1,5 el cuadro se comía medio cuadro de al lado; 1,18 se nota y no tapa
//   a nadie. "Un poco más grande" era literal.
export const EN_LA_FILA = { normal: 1, grande: 1.5 }
export const EN_LA_REJILLA = { normal: 1, grande: 1.18 }

export function usarMiTamano() {
  const [tamano, setTamano] = useState('normal')
  const siguiente = useCallback(() => {
    setTamano(actual => TAMANOS[(TAMANOS.indexOf(actual) + 1) % TAMANOS.length])
  }, [])
  return [tamano, siguiente]
}
