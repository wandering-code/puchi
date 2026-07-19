import { useEffect, useRef } from 'react'

const JITSI_DOMAIN = 'meet.jit.si'
const ROOM_NAME    = 'luni-book-club-village'

export default function JitsiOverlay({ player, onClose }) {
  const apiRef = useRef(null)

  useEffect(() => {
    if (apiRef.current || !window.JitsiMeetExternalAPI) return

    apiRef.current = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
      roomName:      ROOM_NAME,
      parentNode:    document.getElementById('jitsi-container'),
      userInfo:      { displayName: player.name },
      configOverwrite: {
        startWithAudioMuted:  true,
        startWithVideoMuted:  false,
        prejoinPageEnabled:   false,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_BRAND_WATERMARK: false,
      },
    })

    apiRef.current.addEventListener('videoConferenceLeft', onClose)
    return () => apiRef.current?.dispose()
  }, [])

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-[800px] h-[560px] max-w-[95vw] max-h-[80vh] rounded-xl overflow-hidden border-2 border-yellow-400 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 font-pixel text-xs bg-black/70 text-white px-3 py-1 rounded hover:bg-red-800 transition-colors"
        >
          ✕ cerrar
        </button>
        <div id="jitsi-container" className="w-full h-full" />
      </div>
    </div>
  )
}
