import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import LoginScreen          from './components/gatos/LoginScreen'
import GatOS                from './components/gatos/GatOS'
import { AuthProvider, useAuth } from './utils/auth'

function App() {
  const { player, login, logout } = useAuth()

  return (
    <div style={{ width:'100%', height:'100%', overflow:'hidden', background:'#0a0a0a', position:'relative' }}>
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
