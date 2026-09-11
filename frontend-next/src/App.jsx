import { AnimatePresence, motion } from 'motion/react'
import { useAuth } from './platform/auth'
import { useMobileViewport } from './platform/viewport'
import { useLiveConnection } from './platform/live'
import { usarTema } from './platform/preferencias'
import { AvisosProvider } from './platform/avisos'
import { ChatProvider } from './platform/chat'
import { LlamadasProvider } from './platform/llamadas'
import AvisosDeMensaje from './screens/diskordkito/AvisosDeMensaje'
import AvisoDeLlamada from './screens/diskordkito/AvisoDeLlamada'
import Llamada from './screens/diskordkito/Llamada'
import LlamadaGrupo from './screens/diskordkito/LlamadaGrupo'
import PastillaLlamada from './screens/diskordkito/PastillaLlamada'
import LoginScreen from './screens/LoginScreen'
import Shell from './screens/Shell'
import UpdatePrompt from './ui/UpdatePrompt'

export default function App() {
  const { player, checking } = useAuth()
  useMobileViewport()
  // Un solo WebSocket para toda la app, mientras haya sesión: es el que hace
  // que un cambio hecho en otro dispositivo (o en la Puchi actual, que comparte
  // base de datos) se vea aquí sin recargar.
  useLiveConnection(player?.token)
  // Aquí arriba, y no en Ajustes: el tema es de toda la app, así que en cuanto
  // llega la cuenta hay que ponerlo, se esté donde se esté. Si viviera en la
  // pantalla que lo cambia, entrar directamente a Luniteca dejaría el tema de
  // la copia local aunque en la cuenta hubiera otro.
  usarTema()

  return (
    <div className="relative h-full w-full overflow-hidden bg-bg">
      <UpdatePrompt />
      {/* mode="wait" para que la pantalla que se va termine antes de que
          entre la siguiente: solapadas se ven las dos a la vez medio segundo
          y el cambio parece un parpadeo. */}
      <AnimatePresence mode="wait" initial={false}>
        {checking ? (
          <Splash key="splash" />
        ) : !player ? (
          <motion.div
            key="login"
            className="h-full w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <LoginScreen />
          </motion.div>
        ) : (
          <motion.div
            key="shell"
            className="h-full w-full"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Los avisos y el chat van POR ENCIMA de las pantallas, envolviendo
                al Shell entero. Es lo que hace que un mensaje (y, cuando estén,
                una llamada) te llegue estés en la Luniteca, en el club o donde
                sea — y que la pantalla de Diskordkito pueda estar cerrada sin
                que nadie se quede sin enterarse. */}
            <AvisosProvider>
              <ChatProvider>
                <LlamadasProvider>
                  <AvisosDeMensaje />
                  <AvisoDeLlamada />
                  {/* El escenario y la pastilla van en portales a <body>, así
                      que da igual dónde se pongan aquí — lo que importa es que
                      están FUERA del Shell: la llamada sobrevive a cambiar de
                      pantalla, que es justo la gracia. */}
                  <Llamada />
                  <LlamadaGrupo />
                  <PastillaLlamada />
                  <Shell />
                </LlamadasProvider>
              </ChatProvider>
            </AvisosProvider>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Lo que se ve mientras /auth/me confirma que la sesión guardada sigue viva.
// Es el mismo fondo que el resto para que no haya ningún destello de otro
// color al arrancar desde el icono de inicio.
function Splash() {
  return (
    <motion.div
      key="splash"
      className="flex h-full w-full items-center justify-center bg-bg"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <PawMark className="h-10 w-10 text-accent" />
      </motion.div>
    </motion.div>
  )
}

function PawMark({ className }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="currentColor" aria-hidden="true">
      <ellipse cx="32" cy="40" rx="16" ry="13" />
      <ellipse cx="13" cy="26" rx="7" ry="8.5" transform="rotate(-18 13 26)" />
      <ellipse cx="51" cy="26" rx="7" ry="8.5" transform="rotate(18 51 26)" />
      <ellipse cx="22" cy="12" rx="6" ry="7.5" transform="rotate(-8 22 12)" />
      <ellipse cx="42" cy="12" rx="6" ry="7.5" transform="rotate(8 42 12)" />
    </svg>
  )
}
