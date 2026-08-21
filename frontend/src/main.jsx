import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import LoginScreen          from './components/gatos/LoginScreen'
import GatOS                from './components/gatos/GatOS'
import UpdateBanner         from './components/gatos/UpdateBanner'
import { AuthProvider, useAuth } from './utils/auth'
import { useVersionCheck } from './utils/useVersionCheck'

function App() {
  const { player, login, logout } = useAuth()
  const updateAvailable = useVersionCheck()

  return (
    <div style={{ width:'100%', height:'100%', overflow:'hidden', background:'#0a0a0a', position:'relative' }}>
      <UpdateBanner show={updateAvailable} />
      {!player ? (
        <LoginScreen />
      ) : (
        <GatOS
          player={player}
          onLogout={logout}
          onProfileUpdate={(u) => u === null ? logout() : login({ ...player, ...u })}
        />
      )}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider><App /></AuthProvider>
)
