import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../utils/auth'
import PlayerAvatar from './PlayerAvatar'
import AvatarCropModal from './AvatarCropModal'
import { PRESET_AVATARS } from '../../utils/presetAvatars'
import { COLOR_OPTIONS } from '../../utils/colorOptions'

export default function LoginScreen() {
  const [players,  setPlayers]  = useState([])
  const [step,     setStep]     = useState('select')   // select | pin | register | pending
  const [selected, setSelected] = useState(null)
  const [pin,      setPin]      = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const { login } = useAuth()

  // Registro
  const [regName,       setRegName]       = useState('')
  const [regPin,        setRegPin]        = useState('')
  const [regPin2,       setRegPin2]       = useState('')
  const [regColor,      setRegColor]      = useState('#60a5fa')
  // Avatar: o un preset de la galería (URL fija) o una foto propia recortada
  // (Blob, aún no subida — se manda en el mismo POST /auth/register porque
  // el registro no da sesión hasta que un admin lo aprueba).
  const [regAvatarUrl,   setRegAvatarUrl]   = useState(PRESET_AVATARS[0].url)
  const [regAvatarBlob,  setRegAvatarBlob]  = useState(null)
  const [regAvatarPreview, setRegAvatarPreview] = useState(null) // object URL del blob recortado, para previsualizar
  const [cropFile,      setCropFile]      = useState(null) // File pendiente de recortar en el modal
  const fileInputRef = useRef(null)

  function pickPreset(url) {
    setRegAvatarUrl(url)
    setRegAvatarBlob(null)
    setRegAvatarPreview(null)
  }

  function onFileChosen(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo fichero después
    if (file) setCropFile(file)
  }

  function onCropConfirm(blob) {
    setRegAvatarBlob(blob)
    setRegAvatarPreview(URL.createObjectURL(blob))
    setCropFile(null)
  }

  // Libera el object URL de la previsualización anterior al reemplazarla o
  // al desmontar — igual que ya hace AvatarCropModal con el suyo.
  useEffect(() => () => { if (regAvatarPreview) URL.revokeObjectURL(regAvatarPreview) }, [regAvatarPreview])

  useEffect(() => {
    fetch('/api/players', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setPlayers)
      .catch(() => setPlayers([]))
  }, [])

  function selectPlayer(p) {
    setSelected(p); setPin(''); setError(''); setStep('pin')
  }

  async function handleLogin(e) {
    e.preventDefault()
    if (!pin) return
    setLoading(true); setError('')
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: selected.id, pin }),
      })
      if (!r.ok) { setError('PIN incorrecto'); setLoading(false); return }
      const data = await r.json()
      login({ ...data.player, token: data.token })
    } catch { setError('Error de conexión') }
    setLoading(false)
  }

  async function handleRegister(e) {
    e.preventDefault()
    if (!regName.trim()) { setError('Escribe un nombre'); return }
    if (regPin !== regPin2) { setError('Los PINs no coinciden'); return }
    if (!/^\d{4,8}$/.test(regPin)) { setError('PIN: 4-8 dígitos'); return }
    setLoading(true); setError('')
    try {
      // multipart, no JSON: la foto propia (si se eligió) viaja en el mismo
      // request — el registro no da sesión hasta que un admin lo aprueba, así
      // que no hay forma de subirla después con un POST /players/me/avatar aparte.
      const form = new FormData()
      form.append('name', regName.trim())
      form.append('pin', regPin)
      form.append('color', regColor)
      if (regAvatarBlob) form.append('avatar_file', regAvatarBlob, 'avatar.jpg')
      else form.append('avatar_url', regAvatarUrl)
      const r = await fetch('/api/auth/register', {
        method: 'POST', credentials: 'include',
        body: form,
      })
      if (!r.ok) { const d = await r.json(); setError(d.detail || 'Error'); setLoading(false); return }
      const data = await r.json()
      // La cuenta queda pendiente de aprobación por el admin — no se loguea
      // directamente (antes sí lo hacía; el registro dejó de ser automático).
      if (data.pending) { setStep('pending'); setLoading(false); return }
      localStorage.removeItem(`gatos_windows_${data.player.id}`)
      login({ ...data.player, token: data.token })
    } catch { setError('Error de conexión') }
    setLoading(false)
  }

  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      background: 'radial-gradient(ellipse at 30% 20%, #1a1040 0%, #0a0a14 60%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      padding: '24px 16px', boxSizing: 'border-box', overflowY: 'auto',
    }}>
      <motion.div initial={{ opacity:0, y:-20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5 }}
        style={{ marginBottom: 40, textAlign: 'center' }}>
        <span style={{ fontSize: 48 }}>🐾</span>
        <p style={{ fontFamily: '"Press Start 2P"', fontSize: 18, color: 'rgba(255,255,255,0.9)', marginTop: 12, letterSpacing: 2 }}>GatOS</p>
        <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: 1, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>Puchi v0.1</p>
      </motion.div>

      <AnimatePresence mode="wait">

        {/* Selección de usuario */}
        {step === 'select' && (
          <motion.div key="select" initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.95 }} transition={{ duration:0.2 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 600 }}>
              {players.map(p => (
                <button key={p.id} onClick={() => selectPlayer(p)}
                  style={{ background:'rgba(255,255,255,0.05)', border:`1px solid ${p.color}44`, borderRadius:16, padding:'20px 24px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:10, transition:'all .2s', minWidth: 100 }}
                  onMouseEnter={e => { e.currentTarget.style.background=`${p.color}22`; e.currentTarget.style.borderColor=p.color }}
                  onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor=`${p.color}44` }}>
                  <PlayerAvatar emoji={p.avatar_emoji} url={p.avatar_url} size={40} />
                  <span style={{ fontSize:14, fontWeight:700, color:p.color }}>{p.name}</span>
                </button>
              ))}

              {/* Botón crear cuenta */}
              <button onClick={() => { setStep('register'); setError('') }}
                style={{ background:'rgba(255,255,255,0.04)', border:'2px dashed rgba(255,255,255,0.2)', borderRadius:16, padding:'20px 24px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:10, transition:'all .2s', minWidth: 100 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.5)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.2)' }}>
                <span style={{ fontSize: 40 }}>➕</span>
                <span style={{ fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.4)' }}>Crear cuenta</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* PIN */}
        {step === 'pin' && selected && (
          <motion.div key="pin" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }} transition={{ duration:0.2 }}
            style={{ background:'rgba(255,255,255,0.05)', border:`1px solid ${selected.color}44`, borderRadius:20, padding:40, display:'flex', flexDirection:'column', alignItems:'center', gap:20, width:'100%', maxWidth:320, boxSizing:'border-box' }}>
            <PlayerAvatar emoji={selected.avatar_emoji} url={selected.avatar_url} size={48} />
            <p style={{ fontSize:16, fontWeight:700, color:selected.color }}>{selected.name}</p>
            <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, width:'100%' }}>
              <input type="password" inputMode="numeric" maxLength={8} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,''))} placeholder="PIN" autoFocus
                style={{ textAlign:'center', letterSpacing:8, fontSize:18, background:'rgba(255,255,255,0.08)', border:`1px solid ${selected.color}66`, borderRadius:10, padding:'12px 20px', color:'white', outline:'none', width:'100%' }} />
              {error && <p style={{ fontSize:13, color:'#f87171' }}>{error}</p>}
              <button type="submit" disabled={loading || !pin}
                style={{ background:selected.color, border:'none', borderRadius:10, padding:'12px 32px', color:'black', fontSize:14, cursor:'pointer', fontWeight:700, width:'100%', opacity:(!pin||loading)?0.5:1 }}>
                {loading ? 'Cargando…' : 'Iniciar sesión'}
              </button>
            </form>
            <button onClick={() => setStep('select')} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)', cursor:'pointer', fontSize:12 }}>← Volver</button>
          </motion.div>
        )}

        {/* Registro */}
        {step === 'register' && (
          <motion.div key="register" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }} transition={{ duration:0.2 }}
            style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:20, padding:32, display:'flex', flexDirection:'column', gap:16, width:'100%', maxWidth:400, boxSizing:'border-box' }}>
            <p style={{ fontSize:17, fontWeight:700, color:'rgba(255,255,255,0.85)', textAlign:'center' }}>Crear cuenta</p>

            <form onSubmit={handleRegister} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {/* Nombre */}
              <div>
                <label style={{ fontSize:11, color:'rgba(255,255,255,0.4)', display:'block', marginBottom:6 }}>Nombre de usuario</label>
                <input value={regName} onChange={e => setRegName(e.target.value)} maxLength={20} placeholder="Tu nombre..."
                  style={{ width:'100%', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:8, padding:'8px 12px', color:'white', fontSize:14, outline:'none' }} />
              </div>

              {/* Avatar: preset de la galería o foto propia */}
              <div>
                <label style={{ fontSize:11, color:'rgba(255,255,255,0.4)', display:'block', marginBottom:6 }}>Avatar</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:6 }}>
                  {PRESET_AVATARS.map(a => {
                    const active = !regAvatarBlob && regAvatarUrl === a.url
                    return (
                      <button type="button" key={a.id} onClick={() => pickPreset(a.url)} title={a.label}
                        style={{ padding:2, borderRadius:'50%', background:'transparent', cursor:'pointer', border:active?'2px solid white':'2px solid transparent' }}>
                        <img src={a.url} alt={a.label} style={{ width:'100%', aspectRatio:'1', borderRadius:'50%', display:'block' }} />
                      </button>
                    )
                  })}
                  {/* Foto propia — mismo tamaño de celda que los presets, con la previsualización si ya se recortó una */}
                  <button type="button" onClick={() => fileInputRef.current?.click()} title="Subir tu propia foto"
                    style={{
                      padding:2, borderRadius:'50%', cursor:'pointer',
                      background: regAvatarBlob ? 'transparent' : 'rgba(255,255,255,0.08)',
                      border: regAvatarBlob ? '2px solid white' : '2px dashed rgba(255,255,255,0.35)',
                      display:'flex', alignItems:'center', justifyContent:'center', aspectRatio:'1',
                    }}>
                    {regAvatarPreview
                      ? <img src={regAvatarPreview} alt="Tu foto" style={{ width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover', display:'block' }} />
                      : <span style={{ fontSize:16, color:'rgba(255,255,255,0.5)' }}>＋</span>}
                  </button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChosen} style={{ display:'none' }} />
              </div>

              {/* Color */}
              <div>
                <label style={{ fontSize:11, color:'rgba(255,255,255,0.4)', display:'block', marginBottom:6 }}>Color</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {COLOR_OPTIONS.map(c => (
                    <button type="button" key={c} onClick={() => setRegColor(c)}
                      style={{ width:24, height:24, borderRadius:6, background:c, border:regColor===c?'3px solid white':'3px solid transparent', cursor:'pointer' }} />
                  ))}
                </div>
                <p style={{ fontSize:12, color:regColor, marginTop:6, fontWeight:600 }}>{regName || 'Tu nombre'}</p>
              </div>

              {/* PINs */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[['PIN', regPin, setRegPin], ['Confirmar PIN', regPin2, setRegPin2]].map(([label, val, set]) => (
                  <div key={label}>
                    <label style={{ fontSize:10, color:'rgba(255,255,255,0.4)', display:'block', marginBottom:4 }}>{label}</label>
                    <input type="password" inputMode="numeric" maxLength={8} value={val} onChange={e => set(e.target.value.replace(/\D/g,''))}
                      style={{ width:'100%', textAlign:'center', letterSpacing:6, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:8, padding:'8px', color:'white', fontSize:14, outline:'none' }} />
                  </div>
                ))}
              </div>

              {error && <p style={{ fontSize:12, color:'#f87171', textAlign:'center' }}>{error}</p>}

              <button type="submit" disabled={loading}
                style={{ background:'#60a5fa', border:'none', borderRadius:10, padding:'12px', color:'black', fontSize:14, cursor:'pointer', fontWeight:700, opacity:loading?0.5:1 }}>
                {loading ? 'Creando…' : 'Crear cuenta'}
              </button>
            </form>

            <button onClick={() => { setStep('select'); setError('') }} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)', cursor:'pointer', fontSize:12 }}>← Volver</button>
          </motion.div>
        )}

        {/* Cuenta creada, pendiente de aprobación por el admin */}
        {step === 'pending' && (
          <motion.div key="pending" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }} transition={{ duration:0.2 }}
            style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(96,165,250,0.3)', borderRadius:20, padding:32, display:'flex', flexDirection:'column', alignItems:'center', gap:14, width:'100%', maxWidth:360, boxSizing:'border-box', textAlign:'center' }}>
            <span style={{ fontSize: 36 }}>⏳</span>
            <p style={{ fontSize:16, fontWeight:700, color:'rgba(255,255,255,0.9)' }}>Cuenta creada</p>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.5)', lineHeight:1.5 }}>
              Un admin tiene que aprobarla antes de que puedas entrar. Vuelve a intentarlo más tarde.
            </p>
            <button onClick={() => { setStep('select'); setRegName(''); setRegPin(''); setRegPin2(''); setError('') }}
              style={{ background:'#60a5fa', border:'none', borderRadius:10, padding:'10px 24px', color:'black', fontSize:13, cursor:'pointer', fontWeight:700 }}>
              Volver
            </button>
          </motion.div>
        )}

      </AnimatePresence>

      <AnimatePresence>
        {cropFile && (
          <AvatarCropModal file={cropFile} onCancel={() => setCropFile(null)} onConfirm={onCropConfirm} />
        )}
      </AnimatePresence>
    </div>
  )
}
