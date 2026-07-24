import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { C } from './lunitecaTheme'

const ELEMENT_ID = 'luni-barcode-scanner'

// Escáner de código de barras (ISBN) con la cámara — usado tanto para añadir
// un libro suelto como, en modo `continuous`, para ir acumulando varios de
// golpe antes de retocarlos (ver BulkAddModal). Un único sitio para la
// cámara/decodificación para que los dos flujos se comporten igual.
export default function BarcodeScannerModal({ onDetect, onClose, continuous = false, feedback, scanCount }) {
  const scannerRef = useRef(null)
  const lastCodeRef = useRef({ code: null, at: 0 })
  const [starting, setStarting] = useState(true)
  const [error, setError] = useState(null)
  const [manualIsbn, setManualIsbn] = useState('')

  useEffect(() => {
    let cancelled = false
    const scanner = new Html5Qrcode(ELEMENT_ID, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
      ],
      verbose: false,
    })
    scannerRef.current = scanner

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 260, height: 160 } },
      decodedText => {
        // El mismo código de barras sigue "leyéndose" mientras la cámara
        // encuadra el mismo libro — sin este margen, un único código
        // disparaba onDetect decenas de veces por segundo.
        const now = Date.now()
        if (lastCodeRef.current.code === decodedText && now - lastCodeRef.current.at < 2500) return
        lastCodeRef.current = { code: decodedText, at: now }
        onDetect(decodedText.trim())
      },
      () => {} // "no se ve ningún código en este frame" — se dispara constantemente, se ignora
    )
      .then(() => { if (!cancelled) setStarting(false) })
      .catch(() => { if (!cancelled) { setError('No se pudo acceder a la cámara. Compruébalo en los permisos del navegador, o escribe el ISBN a mano.'); setStarting(false) } })

    return () => {
      cancelled = true
      scanner.stop().then(() => scanner.clear()).catch(() => {})
    }
  }, [])

  function submitManual() {
    const isbn = manualIsbn.trim().replace(/[^0-9Xx]/g, '')
    if (isbn.length < 8) return
    onDetect(isbn)
    setManualIsbn('')
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      style={{
        position: 'absolute', inset: 0, zIndex: 150,
        background: 'rgba(15,10,6,0.85)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.15 } }}
        transition={{ type: 'spring', damping: 24, stiffness: 320 }}
        style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 16, width: '100%', maxWidth: 380,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
        <div style={{
          padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
            {continuous ? `Escanear libros${scanCount ? ` (${scanCount})` : ''}` : 'Escanear código de barras'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000', minHeight: 220 }}>
            <div id={ELEMENT_ID} style={{ width: '100%' }} />
            {starting && !error && (
              <p style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 12, margin: 0 }}>
                Iniciando cámara…
              </p>
            )}
          </div>

          {error
            ? <p style={{ fontSize: 11.5, color: '#ef4444', margin: 0 }}>{error}</p>
            : <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>Apunta al código de barras de la contraportada (el de 13 dígitos).</p>}

          {feedback && (
            <p style={{ fontSize: 12, color: C.accent, fontWeight: 600, margin: 0 }}>{feedback}</p>
          )}

          {/* Alternativa sin cámara — mismo camino que un escaneo, por si el
              navegador no tiene acceso a la cámara o el código está dañado. */}
          <div style={{ display: 'flex', gap: 6, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
            <input
              value={manualIsbn}
              onChange={ev => setManualIsbn(ev.target.value)}
              onKeyDown={ev => ev.key === 'Enter' && submitManual()}
              placeholder="O escribe el ISBN a mano"
              style={{
                flex: 1, minWidth: 0, background: C.surfaceHi, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: '7px 10px', color: C.text, fontSize: 12,
                outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
              }}
            />
            <button onClick={submitManual} disabled={manualIsbn.trim().length < 8} style={{
              background: C.accent, border: 'none', borderRadius: 8, padding: '0 14px',
              color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              opacity: manualIsbn.trim().length < 8 ? 0.4 : 1,
            }}>Buscar</button>
          </div>

          {continuous && (
            <button onClick={onClose} style={{
              background: C.accentBg, border: `1px solid ${C.accentBd}`, borderRadius: 8,
              padding: '8px 0', color: C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>Terminar de escanear</button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
