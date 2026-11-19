import { useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { SesionAlSalir, useAuth } from './platform/auth'
import { useMobileViewport } from './platform/viewport'
import { useLiveConnection } from './platform/live'
import { usarAspecto, usarTema } from './platform/preferencias'
import { usarEventoEnDocumento } from './eventos/usarEvento'
import { AvisosProvider } from './platform/avisos'
import { ChatProvider } from './platform/chat'
import { PendientesProvider } from './platform/pendientes'
import { LlamadasProvider } from './platform/llamadas'
import AvisosDeMensaje from './screens/diskordkito/AvisosDeMensaje'
import AvisoDeLlamada from './screens/diskordkito/AvisoDeLlamada'
import AvisoDeRegistro from './screens/admin/AvisoDeRegistro'
import AvisoDeNovedades from './screens/admin/AvisoDeNovedades'
import Llamada from './screens/diskordkito/Llamada'
import LlamadaGrupo from './screens/diskordkito/LlamadaGrupo'
import PastillaLlamada from './screens/diskordkito/PastillaLlamada'
import LoginScreen from './screens/LoginScreen'
import Shell from './screens/Shell'
import UpdatePrompt from './ui/UpdatePrompt'
import { CON_AUDIOLIBROS } from './platform/variante'
import { ReproductorProvider } from './platform/reproductor'
import { NotificacionesProvider } from './platform/notificaciones'
import { HojaAvisos } from './screens/kokito/avisos/Avisos'
import PantallaReproductor from './screens/kokito/escuchar/PantallaReproductor'
import MiniReproductor from './screens/kokito/escuchar/MiniReproductor'
import PantallaLectura from './screens/kokito/lectura/PantallaLectura'

export default function App() {
  const { player } = useAuth()
  // La app entra animada (.entra) cuando llega del login, pero no cuando es
  // lo primero que se ve: al abrir con la sesión guardada se pasa del splash
  // de index.html a la app de un fotograma al siguiente, como una app nativa,
  // sin que nada crezca ni se funda. Se fija al montar el Shell; tras cerrar
  // sesión, la siguiente entrada vuelve a animarse.
  const entraAnimada = useRef(!player)
  if (!player) entraAnimada.current = true
  // El último jugador con sesión: la app que sale al cerrarla lo sigue viendo
  // durante su animación de salida (ver SesionAlSalir).
  const ultimo = useRef(player)
  if (player) ultimo.current = player
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
  // Y el resto del aspecto (acento, textura, tamaño de portadas).
  usarAspecto('acento')
  usarAspecto('textura')
  usarAspecto('portadas')
  // Lo mismo con la decoración de temporada (src/eventos): va con la cuenta.
  usarEventoEnDocumento()

  return (
    <div className="relative h-full w-full overflow-hidden bg-bg">
      <UpdatePrompt />
      {/* mode="wait" para que la pantalla que se va termine antes de que
          entre la siguiente: solapadas se ven las dos a la vez medio segundo
          y el cambio parece un parpadeo. Solo pasa entre el login y la app. */}
      <AnimatePresence mode="wait" initial={false}>
        {!player ? (
          <motion.div
            key="login"
            className="h-full w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transform: 'scale(0.98)' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <LoginScreen />
          </motion.div>
        ) : (
          <motion.div
            key="shell"
            // La entrada, en CSS (.entra en index.css): con scale Motion la
            // movía desde JavaScript, y con `transform` dejaría uno puesto en
            // el contenedor de toda la app al acabar.
            className={`${entraAnimada.current ? 'entra' : ''} h-full w-full`}
            style={{ '--entra-desde': 'scale(1.02)', '--entra-dura': '400ms' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Los avisos y el chat van POR ENCIMA de las pantallas, envolviendo
                al Shell entero. Es lo que hace que un mensaje (y, cuando estén,
                una llamada) te llegue estés en la Luniteca, en el club o donde
                sea — y que la pantalla de Diskordkito pueda estar cerrada sin
                que nadie se quede sin enterarse. */}
            <SesionAlSalir player={ultimo.current}>
            <AvisosProvider>
              <ChatProvider>
                <LlamadasProvider>
                  <PendientesProvider>
                    <AvisosDeMensaje />
                    <AvisoDeLlamada />
                    <AvisoDeRegistro />
                    {/* Los avisos de novedades del admin (#72). */}
                    <AvisoDeNovedades />
                    {/* El escenario y la pastilla van en portales a <body>, así
                        que da igual dónde se pongan aquí — lo que importa es que
                        están FUERA del Shell: la llamada sobrevive a cambiar de
                        pantalla, que es justo la gracia. */}
                    <Llamada />
                    <LlamadaGrupo />
                    <PastillaLlamada />
                    {/* El reproductor de audiolibros, por fuera del Shell por lo
                        mismo que la llamada: sigue sonando al cambiar de
                        pantalla. De momento solo en /kokito. */}
                    {CON_AUDIOLIBROS ? (
                      <ReproductorProvider>
                        {/* Los avisos de audiolibros (#69), dentro del
                            reproductor: tocar uno abre lo que se escucha. */}
                        <NotificacionesProvider>
                          <Shell />
                          <MiniReproductor />
                          <PantallaReproductor />
                          <PantallaLectura />
                          <HojaAvisos />
                        </NotificacionesProvider>
                      </ReproductorProvider>
                    ) : <Shell />}
                  </PendientesProvider>
                </LlamadasProvider>
              </ChatProvider>
            </AvisosProvider>
            </SesionAlSalir>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
