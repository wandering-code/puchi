import { useState, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useIsMobile } from '../../../utils/responsive'
import PlayerAvatar from '../PlayerAvatar'
import AvatarCropModal from '../AvatarCropModal'
import { PRESET_AVATARS } from '../../../utils/presetAvatars'

// Los fondos de pantalla se gestionan desde Pirestore (catálogo en BD,
// editable por el admin) — Ajustes se queda con lo relativo a la cuenta:
// identidad (nombre, icono/foto) y seguridad (PIN, borrado).

function IconLock({ size = 17, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke={color} strokeWidth="1.35" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke={color} strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  )
}
function IconUser({ size = 17, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <circle cx="8" cy="5.2" r="2.7" stroke={color} strokeWidth="1.35" />
      <path d="M2.5 13.5c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" stroke={color} strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  )
}

export default function SettingsApp({ player, onProfileUpdate }) {
  const isMobile = useIsMobile()
  const fileInputRef = useRef(null)

  // Identidad
  const [name,           setName]           = useState(player.name)
  const [saving,         setSaving]         = useState(false)
  const [profileMsg,     setProfileMsg]     = useState('')
  const [profileMsgOk,   setProfileMsgOk]   = useState(true)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [pickingPreset,  setPickingPreset]  = useState(false)
  const [cropFile,       setCropFile]       = useState(null) // foto elegida, pendiente de encuadrar

  // PIN
  const [curPin,  setCurPin]  = useState('')
  const [newPin,  setNewPin]  = useState('')
  const [confPin, setConfPin] = useState('')
  const [pinMsg,  setPinMsg]  = useState('')
  const [pinOk,   setPinOk]   = useState(false)

  // Borrado de cuenta
  const [deletePin,  setDeletePin]  = useState('')
  const [deleteMsg,  setDeleteMsg]  = useState('')
  const [deleteStep, setDeleteStep] = useState(false)

  async function saveProfile() {
    setSaving(true); setProfileMsg('')
    const r = await fetch('/api/players/me/profile', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setSaving(false)
    if (r.ok) {
      setProfileMsgOk(true); setProfileMsg('Guardado ✓')
      onProfileUpdate?.(await r.json())
    } else {
      const d = await r.json().catch(() => ({}))
      setProfileMsgOk(false); setProfileMsg(d.detail || 'Error al guardar')
    }
  }

  // A diferencia del nombre, elegir un avatar de la galería se guarda al
  // momento (igual que subir/quitar foto) — no hace falta pulsar "Guardar
  // cambios" aparte para esto.
  async function pickPreset(url) {
    setPickingPreset(true); setProfileMsg('')
    const r = await fetch('/api/players/me/profile', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar_url: url }),
    })
    setPickingPreset(false)
    if (r.ok) onProfileUpdate?.(await r.json())
    else { setProfileMsgOk(false); setProfileMsg('Error al guardar') }
  }

  async function uploadPhoto(blob) {
    setUploadingPhoto(true); setProfileMsg('')
    const form = new FormData()
    form.append('file', blob, 'avatar.jpg')
    const r = await fetch('/api/players/me/avatar', { method: 'POST', credentials: 'include', body: form })
    setUploadingPhoto(false)
    if (r.ok) onProfileUpdate?.(await r.json())
    else { setProfileMsgOk(false); setProfileMsg('Error al subir la foto') }
  }

  async function removePhoto() {
    const r = await fetch('/api/players/me/avatar', { method: 'DELETE', credentials: 'include' })
    if (r.ok) onProfileUpdate?.(await r.json())
  }

  async function savePin() {
    setPinMsg(''); setPinOk(false)
    if (newPin !== confPin) { setPinMsg('Los PINs no coinciden'); return }
    if (!/^\d{4,8}$/.test(newPin)) { setPinMsg('El PIN debe tener 4-8 dígitos'); return }
    const r = await fetch('/api/players/me/pin', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_pin: curPin, new_pin: newPin }),
    })
    if (r.ok) { setPinOk(true); setPinMsg('PIN cambiado ✓'); setCurPin(''); setNewPin(''); setConfPin('') }
    else { const d = await r.json(); setPinMsg(d.detail || 'Error') }
  }

  async function deleteAccount() {
    setDeleteMsg('')
    const r = await fetch('/api/players/me', {
      method: 'DELETE', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: deletePin }),
    })
    if (r.ok) { onProfileUpdate?.(null) }
    else { const d = await r.json(); setDeleteMsg(d.detail || 'Error') }
  }

  const labelStyle = { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8, display: 'block' }
  const inputStyle = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: 'white', fontSize: 13, outline: 'none', width: 120, textAlign: 'center', letterSpacing: 4, boxSizing: 'border-box' }
  const cardStyle  = { background: '#1e1f2e', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: isMobile ? 18 : 22, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }
  const btnPrimary = { background: '#5865f2', border: 'none', borderRadius: 8, padding: '8px 20px', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: 13 }
  const btnGhost   = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '7px 14px', color: 'rgba(255,255,255,0.75)', cursor: 'pointer', fontSize: 12.5 }

  return (
    <div style={{ height: '100%', position: 'relative', background: '#111827', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
      <div style={{
        maxWidth: 440, margin: '0 auto',
        padding: isMobile ? '24px 18px 40px' : '36px 32px 48px',
        display: 'flex', flexDirection: 'column', gap: 20, boxSizing: 'border-box',
      }}>
        {/* Sin icono/nombre de la app aquí — ya se ve en la barra superior */}
        <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)' }}>Cuenta de {player.name}</p>

        {/* Identidad: nombre e icono */}
        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconUser size={14} color="rgba(255,255,255,0.5)" />
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>Identidad</h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{
              position: 'relative', width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
              background: player.avatar_url ? '#000' : 'rgba(255,255,255,0.08)',
              border: '2px solid rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <PlayerAvatar emoji={player.avatar_emoji} url={player.avatar_url} size={player.avatar_url ? 64 : 32} style={player.avatar_url ? { borderRadius: 0 } : undefined} />
              {(uploadingPhoto || pickingPreset) && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white' }}>…</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => fileInputRef.current?.click()} style={btnGhost}>Subir foto</button>
              {player.avatar_url && (
                <button type="button" onClick={removePhoto} style={btnGhost}>Quitar foto</button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) setCropFile(f); e.target.value = '' }} />
            </div>
          </div>

          <div>
            <span style={labelStyle}>Galería de avatares</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 6 }}>
              {PRESET_AVATARS.map(a => {
                const active = player.avatar_url === a.url
                return (
                  <button type="button" key={a.id} onClick={() => pickPreset(a.url)} title={a.label} disabled={pickingPreset}
                    style={{ padding: 3, borderRadius: '50%', background: 'transparent', border: active ? '2px solid white' : '2px solid transparent', cursor: 'pointer', transition: 'transform .15s', transform: active ? 'scale(1.1)' : 'scale(1)' }}>
                    <img src={a.url} alt={a.label} style={{ width: '100%', aspectRatio: '1', borderRadius: '50%', display: 'block' }} />
                  </button>
                )
              })}
            </div>
            {player.avatar_url && (
              <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
                Elegir uno de estos sustituye a tu foto/avatar actual.
              </p>
            )}
          </div>

          <div>
            <span style={labelStyle}>Nombre</span>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={20} style={{ ...inputStyle, width: '100%', textAlign: 'left', letterSpacing: 'normal' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={saveProfile} disabled={saving} style={btnPrimary}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
            {profileMsg && <span style={{ fontSize: 12, color: profileMsgOk ? '#23a55a' : '#ed4245' }}>{profileMsg}</span>}
          </div>
        </section>

        {/* Cambiar PIN */}
        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconLock size={13} color="rgba(255,255,255,0.5)" />
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>Cambiar PIN</h3>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            {[['PIN actual', curPin, setCurPin], ['PIN nuevo', newPin, setNewPin], ['Confirmar nuevo', confPin, setConfPin]].map(([label, val, set]) => (
              <div key={label}>
                <span style={labelStyle}>{label}</span>
                <input type="password" inputMode="numeric" maxLength={8} value={val}
                  onChange={e => set(e.target.value.replace(/\D/g, ''))} style={inputStyle} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={savePin} style={btnPrimary}>
              Cambiar PIN
            </button>
            {pinMsg && <span style={{ fontSize: 12, color: pinOk ? '#23a55a' : '#ed4245' }}>{pinMsg}</span>}
          </div>
        </section>

        {/* Zona de peligro */}
        <section style={{ ...cardStyle, background: 'rgba(237,66,69,0.06)', border: '1px solid rgba(237,66,69,0.2)' }}>
          <h3 style={{ color: '#ed4245', fontSize: 13, fontWeight: 700 }}>Zona de peligro</h3>
          {!deleteStep ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                Esta acción borra tu cuenta y no se puede deshacer.
              </p>
              <button onClick={() => setDeleteStep(true)}
                style={{ alignSelf: 'flex-start', background: 'rgba(237,66,69,0.1)', border: '1px solid rgba(237,66,69,0.3)', borderRadius: 8, padding: '8px 16px', color: '#ed4245', cursor: 'pointer', fontSize: 13 }}>
                Eliminar mi cuenta
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                Esta acción es irreversible. Introduce tu PIN para confirmar.
              </p>
              <input type="password" inputMode="numeric" maxLength={8}
                value={deletePin} onChange={e => setDeletePin(e.target.value.replace(/\D/g, ''))}
                placeholder="Tu PIN actual"
                style={{ ...inputStyle, borderColor: 'rgba(237,66,69,0.4)', width: 140 }} />
              {deleteMsg && <span style={{ fontSize: 11, color: '#ed4245' }}>{deleteMsg}</span>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={deleteAccount}
                  style={{ background: '#ed4245', border: 'none', borderRadius: 8, padding: '8px 16px', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  Confirmar eliminación
                </button>
                <button onClick={() => { setDeleteStep(false); setDeletePin(''); setDeleteMsg('') }}
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '8px 16px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 13 }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
      </div>

      <AnimatePresence>
        {cropFile && (
          <AvatarCropModal
            file={cropFile}
            onCancel={() => setCropFile(null)}
            onConfirm={blob => { setCropFile(null); uploadPhoto(blob) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
