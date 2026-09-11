import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { esAdmin, useAuth } from './auth'

// Cuántas cuentas esperan aprobación.
//
// Vive aquí arriba y no dentro de la pantalla de Administración por la misma
// razón que el chat: lo que hace falta es enterarse SIN entrar. El número sale
// en el menú lateral, y el aviso salta estés donde estés.
//
// Solo lo pide el admin. Para cualquier otro esto es cero y no se llama a nada:
// `/admin/players` le devolvería 403, y pedirlo para tirarlo sería gastar una
// petición en cada arranque de sesión de todo el club.

const PendientesContext = createContext(null)

export function PendientesProvider({ children }) {
  const { player } = useAuth()
  const admin = esAdmin(player)
  const [cuantas, setCuantas] = useState(0)

  const contar = useCallback(async () => {
    if (!admin) { setCuantas(0); return }
    const lista = await api('/admin/players').catch(() => null)
    if (lista) setCuantas(lista.filter(p => p.status === 'pending').length)
  }, [admin])

  useEffect(() => { contar() }, [contar])

  useEffect(() => {
    if (!admin) return
    function alRecibir(ev) {
      const msg = ev.detail
      // Una cuenta nueva (el backend se lo manda solo al admin), o cualquier
      // cambio en los jugadores: aprobar o rechazar una desde otro dispositivo
      // tiene que bajar el número aquí también.
      if (msg?.type === 'cuenta_pendiente') { contar(); return }
      if (msg?.type === 'luni_update' && msg.scope === 'players') contar()
    }
    window.addEventListener('puchi:ws', alRecibir)
    return () => window.removeEventListener('puchi:ws', alRecibir)
  }, [admin, contar])

  const valor = useMemo(() => ({ cuantas, recontar: contar }), [cuantas, contar])
  return <PendientesContext.Provider value={valor}>{children}</PendientesContext.Provider>
}

export function usePendientes() {
  return useContext(PendientesContext) || { cuantas: 0, recontar: () => {} }
}
