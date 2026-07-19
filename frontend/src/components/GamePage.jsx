import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../utils/auth'
import { createGame } from '../game'
import JitsiOverlay from './JitsiOverlay'
import LibraryOverlay from './LibraryOverlay'
import SettingsMenu from './SettingsMenu'

export default function GamePage() {
  const containerRef = useRef(null)
  const gameRef      = useRef(null)
  const { player, login, logout } = useAuth()

  const [jitsiOpen,       setJitsiOpen]       = useState(false)
  const [libraryOpen,     setLibraryOpen]     = useState(false)
  const [libraryTab,      setLibraryTab]      = useState('personal')
  const [libraryPlayerId, setLibraryPlayerId] = useState(null)
  const [settingsOpen,    setSettingsOpen]    = useState(false)

  // Referencia para saber qué overlays están abiertos sin closure stale
  const anyOverlayOpen = useRef(false)
  anyOverlayOpen.current = jitsiOpen || libraryOpen || settingsOpen

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return
    gameRef.current = createGame(containerRef.current, player)
    return () => { gameRef.current?.destroy(true); gameRef.current = null }
  }, [player])

  // Eventos desde Phaser
  useEffect(() => {
    const onJitsi   = () => setJitsiOpen(true)
    const onLibrary = (e) => {
      setLibraryTab(e.detail?.tab ?? 'personal')
      setLibraryPlayerId(e.detail?.playerId ?? null)
      setLibraryOpen(true)
    }
    window.addEventListener('luni:openJitsi',   onJitsi)
    window.addEventListener('luni:openLibrary', onLibrary)
    return () => {
      window.removeEventListener('luni:openJitsi',   onJitsi)
      window.removeEventListener('luni:openLibrary', onLibrary)
    }
  }, [])

  // ESC global — abre/cierra ajustes si no hay otro overlay encima
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== 'Escape') return
      if (jitsiOpen || libraryOpen) return   // esos tienen su propio cierre
      setSettingsOpen(v => !v)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [jitsiOpen, libraryOpen])

  function closeOverlay(setter) {
    setter(false)
    containerRef.current?.querySelector('canvas')?.focus()
  }

  function handleProfileUpdate(updatedPlayer) {
    // Actualiza el contexto de auth para que los cambios se reflejen en el juego
    login({ ...player, ...updatedPlayer })
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Botón ajustes siempre visible */}
      <button
        onClick={() => setSettingsOpen(v => !v)}
        className="absolute top-2 left-2 font-pixel text-[9px] text-gray-500 hover:text-yellow-300 transition-colors z-10"
        title="Ajustes [ESC]"
      >
        ⚙ ajustes
      </button>

      <button
        onClick={logout}
        className="absolute top-2 right-2 font-pixel text-[9px] text-gray-500 hover:text-white transition-colors z-10"
      >
        salir
      </button>

      {settingsOpen && (
        <SettingsMenu
          player={player}
          onClose={() => closeOverlay(setSettingsOpen)}
          onProfileUpdate={handleProfileUpdate}
        />
      )}

      {jitsiOpen && (
        <JitsiOverlay player={player} onClose={() => closeOverlay(setJitsiOpen)} />
      )}

      {libraryOpen && (
        <LibraryOverlay
          player={player}
          initialTab={libraryTab}
          initialPlayerId={libraryPlayerId}
          onClose={() => closeOverlay(setLibraryOpen)}
        />
      )}
    </div>
  )
}
