import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import { aplicarTema, temaGuardado } from './tema'

// Los gustos de cada uno viajan con la CUENTA, no con el navegador.
//
// Antes vivían en localStorage, y eso significaba que la misma persona veía
// una cosa en el móvil y otra en el ordenador, y que al entrar desde otro
// sitio empezaba de cero. Ahora se guardan en el jugador (Player.customization
// del backend) y acompañan a quien entra, esté donde esté.
//
// Y valen para TODO lo que esa persona mira: si eliges ver la estantería como
// lomos, así verás también las de los demás cuando te asomes. Es tu forma de
// mirar, no una propiedad de cada estantería.
//
// Se guardan bajo su propia clave dentro de `customization`, que es un objeto
// compartido con la Puchi actual (ahí está el fondo de pantalla, entre otras
// cosas): el endpoint lo reemplaza entero, así que antes de escribir se relee
// lo que hay y se mezcla, para no llevarse nada por delante.

const CLAVE = 'next'

const PreferenciasContext = createContext(null)

export function PreferenciasProvider({ children }) {
  const { player, login } = useAuth()
  const [locales, setLocales] = useState(null)   // lo elegido en esta sesión, para no esperar al servidor

  const guardadas = player?.customization?.[CLAVE] || {}
  const valores = useMemo(() => ({ ...guardadas, ...(locales || {}) }), [guardadas, locales])

  const guardar = useCallback(async (cambios) => {
    // Primero se ve el cambio y luego se cuenta: son ajustes de aspecto, no
    // hay nada que esperar.
    setLocales(previas => ({ ...(previas || {}), ...cambios }))
    if (!player?.id) return
    try {
      // Se relee la personalización antes de escribir: el objeto es de toda la
      // cuenta y la Puchi actual guarda ahí lo suyo. Con el que teníamos en
      // memoria se podría pisar un cambio hecho desde allí.
      const fresco = await api('/auth/me').catch(() => null)
      const base = fresco?.customization || player.customization || {}
      const customization = { ...base, [CLAVE]: { ...(base[CLAVE] || {}), ...cambios } }
      const actualizado = await api(`/players/${player.id}/customization`, { method: 'PATCH', body: { customization } })
      login({ ...actualizado, token: player.token })
    } catch {
      // Si no se ha podido guardar, al menos queda aplicado en esta sesión.
    }
  }, [player?.id, player?.token, player?.customization, login])

  const valor = useMemo(() => ({ valores, guardar }), [valores, guardar])
  return <PreferenciasContext.Provider value={valor}>{children}</PreferenciasContext.Provider>
}

// El tema no basta con leerlo: hay que ponerlo en el documento, porque el
// color no lo pinta ningún componente sino las variables de :root. Se arranca
// con la copia local (main.jsx ya la aplicó) y se corrige en cuanto llega la
// cuenta, que es la que manda.
export function usarTema() {
  const [tema, poner] = usarPreferencia('tema', temaGuardado())
  useEffect(() => { aplicarTema(tema) }, [tema])
  return [tema, poner]
}

// Una preferencia suelta, con su valor por defecto. Se usa como useState.
export function usarPreferencia(clave, pordefecto) {
  const ctx = useContext(PreferenciasContext)
  const valor = ctx?.valores?.[clave]
  const poner = useCallback(v => ctx?.guardar({ [clave]: v }), [ctx, clave])
  return [valor === undefined ? pordefecto : valor, poner]
}
