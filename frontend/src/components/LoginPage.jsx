import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../utils/auth'

const PLAYERS = [
  { id: 1, name: 'Lara',   color: '#e879f9', avatar: '🧚' },
  { id: 2, name: 'Nadia',  color: '#34d399', avatar: '🌿' },
  { id: 3, name: 'Wander', color: '#60a5fa', avatar: '⭐' },
]

export default function LoginPage() {
  const [selected, setSelected] = useState(null)
  const [pin, setPin]           = useState('')
  const [error, setError]       = useState('')
  const { login } = useAuth()
  const navigate  = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    if (!selected) return
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: selected.id, pin }),
        credentials: 'include',
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.detail || 'PIN incorrecto')
        return
      }
      const data = await res.json()
      login({ ...selected, token: data.token })
      navigate('/')
    } catch {
      setError('Error de conexión')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-8 bg-[#1a1a2e]">
      <h1 className="font-pixel text-yellow-300 text-2xl tracking-wider" style={{ textShadow: '3px 3px 0 #92400e' }}>
        El Pueblecito
      </h1>

      <div className="flex gap-6">
        {PLAYERS.map(p => (
          <button
            key={p.id}
            onClick={() => { setSelected(p); setPin('') }}
            className={`flex flex-col items-center gap-2 p-4 border-4 rounded transition-all ${
              selected?.id === p.id
                ? 'border-white scale-110'
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
            style={{ background: selected?.id === p.id ? p.color + '33' : 'transparent' }}
          >
            <span className="text-4xl">{p.avatar}</span>
            <span className="font-pixel text-xs" style={{ color: p.color }}>{p.name}</span>
          </button>
        ))}
      </div>

      {selected && (
        <form onSubmit={handleLogin} className="flex flex-col items-center gap-4">
          <label className="font-pixel text-xs text-gray-400">PIN de acceso</label>
          <input
            type="password"
            maxLength={6}
            value={pin}
            onChange={e => setPin(e.target.value)}
            className="font-pixel text-center text-white bg-[#0f0f1e] border-2 border-gray-600 rounded px-4 py-2 w-32 text-lg tracking-widest focus:outline-none focus:border-yellow-400"
            autoFocus
          />
          {error && <p className="font-pixel text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            className="font-pixel text-xs bg-yellow-400 text-black px-6 py-2 rounded hover:bg-yellow-300 active:scale-95 transition-all"
          >
            Entrar
          </button>
        </form>
      )}
    </div>
  )
}
