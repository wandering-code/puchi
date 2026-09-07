import { createContext, useContext, useState, useEffect } from 'react'

// Portado de frontend/src/utils/auth.jsx sin cambios de comportamiento.
// Comparte a propósito la clave de localStorage y la cookie de sesión con la
// Puchi actual: las dos viven en el mismo origen, así que si ya has entrado
// en / no tienes que volver a entrar en /next (y al revés). El precio es que
// cerrar sesión en una la cierra en la otra — asumido mientras convivan.
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [player, setPlayer] = useState(() => {
    const saved = localStorage.getItem('luni_player')
    return saved ? JSON.parse(saved) : null
  })
  // Hasta que /auth/me conteste no se sabe si la sesión guardada sigue viva.
  // Sin esto se pinta la app entera y se cae al login medio segundo después.
  const [checking, setChecking] = useState(!!localStorage.getItem('luni_player'))

  function login(playerData) {
    localStorage.setItem('luni_player', JSON.stringify(playerData))
    setPlayer(playerData)
  }

  function logout() {
    localStorage.removeItem('luni_player')
    setPlayer(null)
  }

  // El jugador guardado en localStorage se queda congelado con los campos que
  // existieran el día que se guardó, y no se entera de que el admin le haya
  // aprobado o cambiado permisos. Al arrancar se revalida contra /auth/me (la
  // cookie sigue valiendo aunque el objeto guardado esté viejo) conservando el
  // token, que /auth/me no devuelve.
  useEffect(() => {
    if (!player) return
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(fresh => login({ ...fresh, token: player.token }))
      .catch(() => logout())
      .finally(() => setChecking(false))
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AuthContext.Provider value={{ player, checking, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
