import { useEffect, useRef } from 'react'
import { usarPreferencia } from '../../platform/preferencias'
import { IconLuna } from '../../ui/icons'

// PRUEBA (2026-10-18, #79): la cabecera de las estanterías (Luniteca y el
// club) como un panel teñido del color de la app, con una luna de fondo, que
// acaba en la barra de herramientas con las esquinas redondeadas. Se enciende
// en Ajustes y va con la cuenta; apagado, la de antes.

export const TINTE = 'bg-[color-mix(in_srgb,var(--color-accent)_11%,var(--color-bg))]'
const PANEL = `${TINTE} rounded-b-[26px] shadow-[0_10px_24px_-14px_rgb(var(--color-sombra)/.45)]`

export function usarCabeceraConPanel() {
  return usarPreferencia('luniteca_cabecera_panel', false)
}

// Todo lo que cambia con el panel puesto. `listo`: si la pantalla ya ha
// pintado su contenido (antes, `raiz` no apunta a nada).
export function usarPanel(listo = true) {
  const [conPanel] = usarCabeceraConPanel()
  const raiz = useRef(null)

  // El rebote del iPhone al tirar hacia abajo estando arriba deja ver el
  // fondo de la zona que se desplaza, no lo que hay por encima de la cabecera
  // (eso iOS no lo pinta: probado). Así que, con el panel, ese fondo es del
  // tinte en su mitad de arriba y la pantalla lleva el suyo propio encima.
  useEffect(() => {
    const zona = conPanel && listo && raiz.current?.closest('[data-scroll="pantalla"]')
    if (!zona) return
    zona.style.background = 'linear-gradient(to bottom, color-mix(in srgb, var(--color-accent) 11%, var(--color-bg)) 50%, var(--color-bg) 50%)'
    return () => { zona.style.background = '' }
  }, [conPanel, listo])

  return {
    conPanel,
    raiz,
    claseRaiz: conPanel ? '-mx-5 min-h-full bg-bg px-5 py-6' : 'py-6',
    claseCabecera: conPanel ? `relative -mx-5 -mt-6 px-5 pb-3 pt-6 ${TINTE}` : 'mb-4',
    // El fondo de la barra de herramientas (ver Herramientas en Luniteca.jsx).
    barra: conPanel ? PANEL : null,
    // Con el panel la barra mide 60px y no 56: los títulos pegados, debajo.
    desdeTitulos: conPanel ? 'top-[60px]' : 'top-14',
  }
}

export function LunaDelPanel({ conPanel }) {
  if (!conPanel) return null
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <IconLuna className="absolute -right-6 -top-4 h-40 w-40 text-accent opacity-[0.09]" />
    </div>
  )
}
