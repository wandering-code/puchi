import { useEffect, useState } from 'react'

const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION ?? 'dev'
const CHECK_INTERVAL_MS = 5 * 60 * 1000

// Comprueba si hay un build más nuevo que el que tiene cargado esta pestaña,
// para poder avisar en vez de depender de que iOS revalide su caché de
// arranque por su cuenta (no siempre lo hace en las PWA guardadas en
// pantalla de inicio — antes había que borrar y volver a añadir el icono
// para ver un despliegue nuevo). Se comprueba al montar, cada vez que la
// pestaña vuelve a primer plano (típico al reabrir la app desde el icono) y
// cada CHECK_INTERVAL_MS mientras sigue abierta. Mismo mecanismo ya probado
// en el proyecto pokemongo (frontend/src/lib/useVersionCheck.js).
export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data.version && data.version !== CURRENT_VERSION) {
          setUpdateAvailable(true)
        }
      } catch {
        // Sin conexión, o version.json no existe (p.ej. en dev): ignorar.
      }
    }

    check()
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    const interval = setInterval(check, CHECK_INTERVAL_MS)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(interval)
    }
  }, [])

  return updateAvailable
}
