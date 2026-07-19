import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [player, setPlayer] = useState(() => {
    const saved = localStorage.getItem('luni_player')
    return saved ? JSON.parse(saved) : null
  })

  function login(playerData) {
    localStorage.setItem('luni_player', JSON.stringify(playerData))
    setPlayer(playerData)
  }

  function logout() {
    localStorage.removeItem('luni_player')
    setPlayer(null)
  }

  // El objeto de jugador se guarda en localStorage al loguear y de ahí en
  // adelante la app confiaba en él ciegamente, sin volver a mirar el
  // servidor — así que una sesión abierta desde antes de añadir un campo
  // (p.ej. club_member) se queda para siempre con ese campo a undefined
  // (tratado como false), y si el admin te aprueba/rechaza/cambia permisos
  // mientras ya tenías sesión, tampoco te enterabas nunca. Al cargar la app
  // se revalida contra /auth/me (la cookie de sesión sigue siendo válida
  // aunque el player guardado esté desactualizado) y se refresca el objeto
  // completo, conservando el token (que /auth/me no devuelve).
  useEffect(() => {
    if (!player) return
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(fresh => login({ ...fresh, token: player.token }))
      .catch(() => logout())
    // Solo al montar — no se quiere repetir en cada cambio de `player`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AuthContext.Provider value={{ player, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
