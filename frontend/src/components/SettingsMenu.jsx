import { useState } from 'react'

const COLOR_PALETTE = [
  '#e879f9', '#c026d3', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#84cc16', '#22c55e',
  '#34d399', '#06b6d4', '#60a5fa', '#818cf8',
]

const AVATAR_OPTIONS = [
  '⭐', '🧚', '🌿', '🦋', '🌙', '🔥',
  '🌸', '🐉', '🦊', '🐺', '🌊', '🍄',
]

export default function SettingsMenu({ player, onClose, onProfileUpdate }) {
  const [tab, setTab] = useState('perfil')

  // Perfil
  const [color,  setColor]  = useState(player.color)
  const [avatar, setAvatar] = useState(player.avatar_emoji)
  const [saving, setSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')

  // PIN
  const [currentPin, setCurrentPin] = useState('')
  const [newPin,     setNewPin]     = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinMsg,     setPinMsg]     = useState('')
  const [pinOk,      setPinOk]      = useState(false)

  async function saveProfile() {
    setSaving(true)
    setProfileMsg('')
    const r = await fetch('/api/players/me/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color, avatar_emoji: avatar }),
    })
    setSaving(false)
    if (r.ok) {
      const updated = await r.json()
      setProfileMsg('¡Guardado!')
      onProfileUpdate?.(updated)
    } else {
      setProfileMsg('Error al guardar')
    }
  }

  async function savePin() {
    setPinMsg('')
    setPinOk(false)
    if (newPin !== confirmPin) { setPinMsg('Los PINs no coinciden'); return }
    if (!newPin.match(/^\d{4,8}$/)) { setPinMsg('El PIN debe tener entre 4 y 8 dígitos'); return }
    const r = await fetch('/api/players/me/pin', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_pin: currentPin, new_pin: newPin }),
    })
    if (r.ok) {
      setPinOk(true)
      setPinMsg('PIN cambiado correctamente')
      setCurrentPin(''); setNewPin(''); setConfirmPin('')
    } else {
      const d = await r.json()
      setPinMsg(d.detail || 'Error')
    }
  }

  const TABS = [
    { key: 'perfil',    label: 'Mi personaje' },
    { key: 'seguridad', label: 'Seguridad' },
  ]

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col w-[480px] max-w-[95vw] bg-[#1a1208] border-2 border-yellow-700 rounded-xl overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#2d1f08] border-b border-yellow-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{avatar}</span>
            <span className="font-pixel text-yellow-300 text-xs">{player.name}</span>
          </div>
          <button onClick={onClose} className="font-pixel text-xs text-gray-400 hover:text-white">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-yellow-900">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`font-pixel text-[9px] px-5 py-3 transition-colors ${
                tab === t.key
                  ? 'text-yellow-300 border-b-2 border-yellow-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Perfil */}
        {tab === 'perfil' && (
          <div className="flex flex-col gap-6 p-6">

            {/* Avatar */}
            <div>
              <p className="font-pixel text-[8px] text-gray-400 mb-3">Avatar</p>
              <div className="grid grid-cols-6 gap-2">
                {AVATAR_OPTIONS.map(e => (
                  <button
                    key={e}
                    onClick={() => setAvatar(e)}
                    className={`text-2xl p-2 rounded-lg transition-all ${
                      avatar === e
                        ? 'bg-yellow-700 scale-110 ring-2 ring-yellow-400'
                        : 'hover:bg-white/10'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div>
              <p className="font-pixel text-[8px] text-gray-400 mb-3">Color del nombre</p>
              <div className="grid grid-cols-6 gap-2">
                {COLOR_PALETTE.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-lg transition-all ${
                      color === c ? 'scale-125 ring-2 ring-white' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <p className="font-pixel text-[8px] mt-2" style={{ color }}>
                Así se verá tu nombre
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={saveProfile}
                disabled={saving}
                className="font-pixel text-[9px] bg-yellow-600 text-black px-5 py-2 rounded hover:bg-yellow-400 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
              {profileMsg && (
                <span className="font-pixel text-[8px] text-green-400">{profileMsg}</span>
              )}
            </div>

            <p className="font-pixel text-[7px] text-gray-600 leading-relaxed">
              La personalización del personaje (ropa, físico) estará disponible cuando elijamos el estilo artístico final.
            </p>
          </div>
        )}

        {/* Seguridad */}
        {tab === 'seguridad' && (
          <div className="flex flex-col gap-4 p-6">
            <p className="font-pixel text-[8px] text-gray-400">Cambiar PIN de acceso</p>

            {[
              { label: 'PIN actual',      val: currentPin, set: setCurrentPin },
              { label: 'PIN nuevo',       val: newPin,     set: setNewPin     },
              { label: 'Confirmar nuevo', val: confirmPin, set: setConfirmPin },
            ].map(f => (
              <div key={f.label}>
                <label className="font-pixel text-[7px] text-gray-500 block mb-1">{f.label}</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={f.val}
                  onChange={e => f.set(e.target.value.replace(/\D/g, ''))}
                  className="font-pixel text-center text-white bg-black/40 border border-yellow-900 rounded px-4 py-2 w-32 text-lg tracking-widest focus:outline-none focus:border-yellow-500"
                />
              </div>
            ))}

            <div className="flex items-center gap-4 mt-2">
              <button
                onClick={savePin}
                className="font-pixel text-[9px] bg-yellow-600 text-black px-5 py-2 rounded hover:bg-yellow-400 transition-colors"
              >
                Cambiar PIN
              </button>
              {pinMsg && (
                <span className={`font-pixel text-[8px] ${pinOk ? 'text-green-400' : 'text-red-400'}`}>
                  {pinMsg}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
