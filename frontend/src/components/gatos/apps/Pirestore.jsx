import { useState, useEffect, useRef } from 'react'
import { useIsMobile } from '../../../utils/responsive'
import { wallpaperCss } from '../../../utils/wallpaper'

// Todo lo del catálogo es gratis por ahora — no hay sistema de monedas
// todavía (ver ESTADO_ACTUAL.md). El precio "Gratis" se muestra igualmente
// para que la tienda ya tenga la forma que tendrá cuando haya contenido de
// pago, y de momento equipar cualquier cosa es instantáneo.
// Los iconos de perfil se editan desde Ajustes, no desde aquí (quitados 2026-07-17).
// El catálogo vive en BD (tabla shop_items) — el admin (wander) puede
// añadir/quitar fondos desde esta misma pantalla, subiendo una imagen propia
// (no escribiendo CSS). Los límites de abajo deben coincidir con los que
// valida de verdad el backend (`_WALLPAPER_*` en main.py) — esto es solo para
// avisar rápido en el navegador antes de subir nada.
const MAX_BYTES     = 5 * 1024 * 1024   // 5 MB
const MIN_W         = 1280               // HD — por debajo se ve pixelado a pantalla completa
const MIN_H         = 720
const ACCEPTED_EXTS = ['.jpg', '.jpeg', '.png', '.webp']

function checkImageFile(file) {
  return new Promise(resolve => {
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase()
    if (!ACCEPTED_EXTS.includes(ext)) return resolve('Formato no soportado — usa JPG, PNG o WEBP')
    if (file.size > MAX_BYTES) return resolve('La imagen pesa demasiado (máximo 5 MB)')
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      if (img.naturalWidth < MIN_W || img.naturalHeight < MIN_H) {
        resolve(`La imagen es demasiado pequeña (mínimo ${MIN_W}×${MIN_H}px, esta es ${img.naturalWidth}×${img.naturalHeight}px)`)
      } else {
        resolve(null)
      }
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve('El archivo no es una imagen válida') }
    img.src = url
  })
}

function IconCheck({ size = 12, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M2 6.2l2.6 2.6L10 3" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconTrash({ size = 12, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M2.5 3.5h7M4.5 3.5V2.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M4.8 3.5l.3 6.5a1 1 0 0 0 1 1h.8a1 1 0 0 0 1-1l.3-6.5"
        stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconPlus({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M6 1.5v9M1.5 6h9" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export default function Pirestore({ player, onProfileUpdate }) {
  const isMobile = useIsMobile()
  const isAdmin = player?.name?.toLowerCase() === 'wander'
  const fileInputRef = useRef(null)

  const [wallpapers, setWallpapers] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const [showForm, setShowForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newFile, setNewFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [formErr, setFormErr] = useState('')
  const [creating, setCreating] = useState(false)

  const currentWallpaper = player.customization?.wallpaper ?? 'default'

  function loadWallpapers() {
    setLoading(true)
    fetch('/api/shop/items?type=wallpaper', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setWallpapers)
      .finally(() => setLoading(false))
  }
  useEffect(loadWallpapers, [])

  // Si el admin añade o quita un fondo desde otro dispositivo mientras
  // Pirestore está abierta, el catálogo se refresca solo sin recargar.
  useEffect(() => {
    function onWs(ev) {
      const msg = ev.detail
      if (msg.type === 'luni_update' && msg.scope === 'shop') loadWallpapers()
    }
    window.addEventListener('luni:ws', onWs)
    return () => window.removeEventListener('luni:ws', onWs)
  }, [])

  async function equipWallpaper(id) {
    if (id === currentWallpaper || busyId) return
    setBusyId(id)
    const newCustomization = { ...(player.customization ?? {}), wallpaper: id }
    const r = await fetch(`/api/players/${player.id}/customization`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customization: newCustomization }),
    })
    setBusyId(null)
    if (r.ok) onProfileUpdate?.({ ...player, customization: newCustomization })
  }

  async function onPickFile(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setFormErr('')
    const err = await checkImageFile(f)
    if (err) { setFormErr(err); setNewFile(null); setPreviewUrl(null); return }
    setNewFile(f)
    setPreviewUrl(URL.createObjectURL(f))
  }

  function resetForm() {
    setShowForm(false); setNewLabel(''); setNewFile(null); setFormErr('')
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
  }

  async function createWallpaper(e) {
    e.preventDefault()
    setFormErr('')
    if (!newLabel.trim()) { setFormErr('Ponle un nombre'); return }
    if (!newFile) { setFormErr('Elige una imagen'); return }
    setCreating(true)
    const form = new FormData()
    form.append('label', newLabel.trim())
    form.append('file', newFile)
    const r = await fetch('/api/shop/items/wallpaper-image', { method: 'POST', credentials: 'include', body: form })
    setCreating(false)
    if (r.ok) {
      const created = await r.json()
      resetForm()
      loadWallpapers()
      // Si acabas de subirlo es porque lo quieres puesto ya, no solo en el catálogo.
      equipWallpaper(created.item_id)
    } else {
      const d = await r.json().catch(() => ({}))
      setFormErr(d.detail || 'Error al crear')
    }
  }

  async function deleteWallpaper(item) {
    if (!window.confirm(`¿Quitar "${item.label}" de la tienda?`)) return
    const r = await fetch(`/api/shop/items/${item.id}`, { method: 'DELETE', credentials: 'include' })
    if (r.ok) loadWallpapers()
  }

  const cardBase = {
    position: 'relative', cursor: 'pointer', borderRadius: 12,
    border: '2px solid transparent', transition: 'transform .15s, border-color .15s',
  }
  const priceTag = {
    position: 'absolute', top: 6, right: 6, fontSize: 9.5, fontWeight: 700,
    color: '#23a55a', background: 'rgba(35,165,90,0.14)', border: '1px solid rgba(35,165,90,0.3)',
    borderRadius: 20, padding: '2px 7px', pointerEvents: 'none',
  }
  const equippedRing = { border: '2px solid #5865f2', boxShadow: '0 0 0 3px rgba(88,101,242,0.18)' }
  const equippedBadge = {
    position: 'absolute', bottom: 6, left: 6, display: 'flex', alignItems: 'center', gap: 3,
    fontSize: 9.5, fontWeight: 700, color: 'white', background: '#5865f2',
    borderRadius: 20, padding: '2px 7px 2px 5px', pointerEvents: 'none',
  }
  const fieldStyle = { width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block' }

  return (
    <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', background: '#111827', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: isMobile ? '20px 16px 40px' : '32px 32px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Sin icono/nombre de la app aquí — ya se ve en la barra superior */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)' }}>Fondos de pantalla para tu escritorio</p>
          {isAdmin && (
            <button onClick={() => (showForm ? resetForm() : setShowForm(true))} style={{
              display: 'flex', alignItems: 'center', gap: 6, background: showForm ? 'rgba(255,255,255,0.1)' : '#5865f2',
              border: 'none', borderRadius: 8, padding: '6px 12px', color: 'white', cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
            }}>
              <IconPlus size={11} color="white" /> {showForm ? 'Cancelar' : 'Añadir fondo'}
            </button>
          )}
        </div>

        {isAdmin && showForm && (
          <form onSubmit={createWallpaper} style={{
            background: '#1e1f2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
            padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div>
              <span style={labelStyle}>Nombre</span>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)} maxLength={30}
                placeholder="p. ej. Amanecer" style={fieldStyle} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {previewUrl && (
                <div style={{ width: 80, height: 50, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
                  <img src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <button type="button" onClick={() => fileInputRef.current?.click()} style={{
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
                padding: '8px 14px', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 12.5,
              }}>
                {newFile ? 'Cambiar imagen' : 'Elegir imagen'}
              </button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={onPickFile} />
            </div>

            <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
              JPG, PNG o WEBP · mínimo {MIN_W}×{MIN_H}px · máximo 5 MB. Se recorta para llenar la pantalla (apaisada
              queda mejor), y si es muy grande se reduce sola al guardarla.
            </p>

            {formErr && <span style={{ fontSize: 12, color: '#ed4245' }}>{formErr}</span>}

            <button type="submit" disabled={creating || !newFile} style={{
              alignSelf: 'flex-start', background: '#5865f2', border: 'none', borderRadius: 8,
              padding: '8px 16px', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: 13,
              opacity: (creating || !newFile) ? 0.6 : 1,
            }}>
              {creating ? 'Subiendo…' : 'Crear'}
            </button>
          </form>
        )}

        {loading ? (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>Cargando…</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 12 }}>
            {wallpapers.map(w => {
              const equipped = w.item_id === currentWallpaper
              return (
                <div key={w.id} onClick={() => equipWallpaper(w.item_id)}
                  style={{
                    ...cardBase, ...(equipped ? equippedRing : {}), height: 84,
                    background: wallpaperCss(w), opacity: busyId === w.item_id ? 0.6 : 1,
                    transform: equipped ? 'scale(1.02)' : 'scale(1)',
                  }}
                  onMouseEnter={e => { if (!equipped) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }}
                  onMouseLeave={e => { if (!equipped) e.currentTarget.style.borderColor = 'transparent' }}
                >
                  <span style={priceTag}>Gratis</span>
                  {isAdmin && (
                    <button onClick={e => { e.stopPropagation(); deleteWallpaper(w) }} title="Quitar de la tienda"
                      style={{
                        position: 'absolute', top: 6, left: 6, width: 20, height: 20, borderRadius: 6,
                        background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ed4245',
                      }}>
                      <IconTrash size={11} color="#ed4245" />
                    </button>
                  )}
                  {equipped && <span style={equippedBadge}><IconCheck size={10} color="white" /> En uso</span>}
                  <span style={{
                    position: 'absolute', bottom: equipped ? 26 : 6, left: 6, right: 6, fontSize: 10,
                    color: 'rgba(255,255,255,0.75)', background: 'rgba(0,0,0,0.4)', borderRadius: 4,
                    padding: '2px 5px', display: 'inline-block',
                  }}>
                    {w.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
          Más contenido (packs de pago, monedas del juego) próximamente.
        </p>
      </div>
    </div>
  )
}
