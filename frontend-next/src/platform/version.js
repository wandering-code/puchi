import { useEffect, useState } from 'react'

// El commit que está corriendo. Sirve para saber de un vistazo si lo que ves
// en el móvil es el código de ahora o una copia vieja: con el service worker
// de la PWA por medio, un dispositivo puede quedarse atrás sin que se note, y
// entonces las medidas de local y lo que se ve en el móvil no hablan de lo
// mismo.
//
// En el build es un valor fijo, puesto al compilar. En desarrollo se pregunta
// al servidor, porque ahí el valor fijo se calcula al arrancar Vite y se queda
// congelado: se sigue commiteando y el sello sigue enseñando el commit de
// entonces, que engaña más que no poner nada.
export function useVersion() {
  const [version, setVersion] = useState(__VERSION__)
  const [compilado, setCompilado] = useState(__FECHA_BUILD__)

  useEffect(() => {
    if (!import.meta.env.DEV) return
    let vigente = true
    fetch('/next/__version')
      .then(r => r.json())
      .then(v => { if (vigente) { setVersion(v.version); setCompilado(v.compilado) } })
      .catch(() => {})
    return () => { vigente = false }
  }, [])

  return { version, compilado }
}
