import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from './api'
import { useAvisos } from './avisos'
import { useCapa } from './capas'
import { useReproductor } from './reproductor'
import { ponerGlobo, refrescarPush } from './push'
import { Cover } from '../screens/luniteca/piezas'

// Los avisos guardados de cada uno (fase 7 de audiolibros, #69): "ya puedes
// escuchar…", "nuevo capítulo", "completo", "no se va a preparar".
//
// Se guardan en el servidor, así que llegan aunque la app estuviera cerrada:
// al abrirla, la campana de arriba lleva el número. Si está abierta, el
// backend avisa por el WebSocket ("aviso_nuevo") y sale además la tarjeta
// flotante de siempre (platform/avisos.jsx).
//
// De momento solo en /kokito (App.jsx lo monta solo ahí).

const NotificacionesContext = createContext(null)

export function NotificacionesProvider({ children }) {
  const r = useReproductor()
  const { mostrar } = useAvisos()
  const [lista, setLista] = useState(null)
  const [sinLeer, setSinLeer] = useState(0)
  const hoja = useCapa()
  const navegar = useNavigate()
  const vistos = useRef(null) // ids ya conocidos: lo que no esté aquí es nuevo
  // El ?aviso=ID con el que se abre la app desde una notificación. Se lee
  // aquí, al primer render, y no en un efecto: los efectos de las pantallas
  // corren antes, y entrar por /kokito/ redirige a Luniteca y se lo come.
  const avisoDeEntrada = useRef(undefined)
  if (avisoDeEntrada.current === undefined) {
    avisoDeEntrada.current = Number(new URLSearchParams(window.location.search).get('aviso')) || null
  }

  // Abrir un aviso: lo de un audiolibro abre su reproductor (sin arrancar a
  // sonar: el play lo da quien escucha). El de "no se va a preparar" no lleva
  // a ningún sitio.
  const abrirAviso = useCallback(async (n) => {
    // Los del admin, a Audiolibros: la bandeja (una petición) o la ficha del
    // audiolibro (terminado, o con un capítulo que falla).
    if (n.kind.startsWith('adm_')) {
      navegar('/audiolibros', { state: { abrir: n.audiobook_id || null, vez: Date.now() } })
      return
    }
    if (!n.audiobook_id || n.kind === 'ab_rejected' || !r) return
    const datos = await api(`/listen/${n.audiobook_id}`).catch(() => null)
    if (datos) r.abrir(datos, { reproducir: false })
  }, [r, navegar])

  // `cargar` tiene que ser siempre la misma función: los efectos de abajo
  // dependen de ella, y si cambiara en cada render (el reproductor y la capa
  // cambian a menudo) volvería a pedir los avisos sin parar, en bucle. Lo que
  // cambia se lee de aquí al usarlo.
  const ultimo = useRef({})
  ultimo.current = { mostrar, abrirAviso, hoja }

  const cargar = useCallback(async ({ avisarNuevos = false } = {}) => {
    const { mostrar, abrirAviso, hoja } = ultimo.current
    const l = await api('/notices').catch(() => null)
    if (!l) return
    const marca = n => `${n.id}:${n.created_at}` // un aviso puede renovarse (nuevo capítulo)
    const nuevos = vistos.current ? l.filter(n => !n.read && !vistos.current.has(marca(n))) : []
    vistos.current = new Set(l.map(marca))
    setLista(l)
    setSinLeer(l.filter(n => !n.read).length)
    if (!avisarNuevos) return
    // Uno a la vez, el más reciente: dos avisos del mismo audiolibro a la vez
    // no aportan nada.
    const n = nuevos[0]
    if (!n) return
    mostrar({
      clave: `aviso-${n.audiobook_id || n.book_id}`,
      titulo: n.title,
      texto: n.body,
      icono: <Cover url={n.cover_url} title={n.title} className="w-9 shrink-0" />,
      progreso: true,
      onTocar: n.kind === 'ab_rejected' ? () => hoja.abrir() : () => abrirAviso(n),
    })
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // El push (#69, parte 2): renovar la suscripción de este dispositivo al
  // abrir, y el número sobre el icono de la app al día con la campana.
  useEffect(() => { refrescarPush() }, [])
  useEffect(() => { ponerGlobo(sinLeer) }, [sinLeer])

  // Tocar una notificación abre la app en ese aviso: con ?aviso=ID si estaba
  // cerrada, o con un mensaje del service worker si ya estaba abierta.
  const abrirPorId = useCallback(async (id) => {
    const l = await api('/notices').catch(() => null)
    const n = l?.find(x => x.id === id)
    if (!n) return
    await api('/notices/read', { method: 'POST', body: { ids: [id] } }).catch(() => {})
    cargar()
    if (!n.kind.startsWith('adm_') && (n.kind === 'ab_rejected' || !n.audiobook_id)) ultimo.current.hoja.abrir()
    else ultimo.current.abrirAviso(n)
  }, [cargar])

  useEffect(() => {
    const id = avisoDeEntrada.current
    if (id) {
      avisoDeEntrada.current = null
      // Fuera de la URL (si sigue ahí): si no, al recargar se volvería a abrir.
      if (window.location.search.includes('aviso=')) {
        window.history.replaceState(window.history.state, '', window.location.pathname)
      }
      abrirPorId(id)
    }
    function alMensaje(ev) {
      if (ev.data?.type !== 'abrir-aviso') return
      const otro = Number(new URL(ev.data.url).searchParams.get('aviso'))
      if (otro) abrirPorId(otro)
    }
    navigator.serviceWorker?.addEventListener('message', alMensaje)
    return () => navigator.serviceWorker?.removeEventListener('message', alMensaje)
  }, [abrirPorId])

  useEffect(() => {
    function alRecibir(ev) {
      if (ev.detail?.type === 'aviso_nuevo') cargar({ avisarNuevos: true })
    }
    // Al volver a la app: lo que llegó mientras estaba en segundo plano (el
    // WebSocket puede haberse cortado entretanto).
    function alVolver() {
      if (document.visibilityState === 'visible') cargar({ avisarNuevos: true })
    }
    window.addEventListener('puchi:ws', alRecibir)
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      window.removeEventListener('puchi:ws', alRecibir)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [cargar])

  const marcarLeidos = useCallback(async () => {
    if (!sinLeer) return
    setSinLeer(0)
    await api('/notices/read', { method: 'POST', body: {} }).catch(() => {})
  }, [sinLeer])

  const valor = useMemo(() => ({ lista, sinLeer, hoja, abrirAviso, marcarLeidos, recargar: cargar }),
    [lista, sinLeer, hoja, abrirAviso, marcarLeidos, cargar])
  return <NotificacionesContext.Provider value={valor}>{children}</NotificacionesContext.Provider>
}

export function useNotificaciones() {
  return useContext(NotificacionesContext)
}
