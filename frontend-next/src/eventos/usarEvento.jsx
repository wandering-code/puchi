import { useEffect } from 'react'
import { usarPreferencia } from '../platform/preferencias'
import { EVENTO_DE_TEMPORADA, aplicarEvento, decoracionGuardada } from '.'

// La decoración del evento de ahora, encendida o apagada. Va con la cuenta,
// una clave por evento (`decoracion_halloween`, `decoracion_navidad`…): apagar
// Halloween un año no apaga la Navidad. Por defecto, encendida.
export function usarDecoracion(evento = EVENTO_DE_TEMPORADA) {
  const [valor, poner] = usarPreferencia(
    evento ? `decoracion_${evento.id}` : 'decoracion_ninguno',
    evento ? decoracionGuardada(evento) : false,
  )
  return [!!evento && valor !== false, poner]
}

// El evento que se está viendo ahora mismo, o null: sin evento en temporada, o
// con su decoración apagada. Es lo que preguntan los adornos.
export function usarEvento() {
  const [puesta] = usarDecoracion()
  return puesta ? EVENTO_DE_TEMPORADA : null
}

// Lo llama App, una vez, como usarTema: en cuanto llega la cuenta, el
// documento tiene que reflejar lo que ella diga.
export function usarEventoEnDocumento() {
  const [puesta] = usarDecoracion()
  useEffect(() => { aplicarEvento(EVENTO_DE_TEMPORADA, puesta) }, [puesta])
}
