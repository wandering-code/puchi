import { useCallback } from 'react'
import { api } from '../../platform/api'
import { useAvisos } from '../../platform/avisos'
import { Cover } from './piezas'

// "Añadido · Deshacer", al añadir un libro a tu estantería desde cualquier
// sitio (buscar, alta a mano, sugerencias, la estantería de otro, el club).
//
// Un toque de más al añadir es fácil, y el alta sale al momento en la
// actividad de todo el mundo. Deshacer borra la entrada, y el servidor, al
// ver que se borra al poco de añadirla, se lleva también lo que dejó en la
// actividad (ver _borrar_entrada en main.py) — así que no hace falta
// nada más aquí. La estantería se entera sola por el aviso en vivo de 'shelf'.
//
// También vale para una tanda (una importación, lo escaneado de golpe): se le
// pasa la lista de entradas y el aviso dice cuántos son; deshacer los quita
// todos en una sola petición.
const DURACION_MS = 10000

export function useDeshacerAlta() {
  const { mostrar, cerrar } = useAvisos()

  // `onDeshecho`: para que quien lo añadió vuelva a ofrecer el botón de
  // añadir, en vez de seguir diciendo "Añadido" de un libro que ya no está.
  // Una entrada ({ id, book }) o una lista de ellas.
  return useCallback((entradas, { onDeshecho } = {}) => {
    const lista = (Array.isArray(entradas) ? entradas : [entradas]).filter(e => e?.id)
    if (!lista.length) return
    const una = lista.length === 1
    const clave = `alta-${lista.map(e => e.id).join('-')}`
    const libro = lista[0].book || {}

    async function deshacer() {
      cerrar(clave)
      try {
        if (una) await api(`/shelf/personal/${lista[0].id}`, { method: 'DELETE' })
        else await api('/shelf/personal/bulk-delete', { method: 'POST', body: { ids: lista.map(e => e.id) } })
        onDeshecho?.()
      } catch {
        mostrar({ titulo: 'No se ha podido deshacer', texto: 'Puedes quitarlo desde su ficha' })
      }
    }

    mostrar({
      clave,
      duracion: DURACION_MS,
      progreso: true,
      titulo: una ? 'Añadido a tu estantería' : `Añadidos ${lista.length} libros a tu estantería`,
      texto: una ? libro.title : lista.slice(0, 3).map(e => e.book?.title).filter(Boolean).join(', ') + (lista.length > 3 ? '…' : ''),
      icono: <div className="w-8 shrink-0"><Cover url={libro.cover_url} title={libro.title} realce={false} /></div>,
      acciones: (
        <button
          onClick={deshacer}
          className="h-10 w-full rounded-xl2 border border-line text-sm font-semibold text-ink active:bg-surface-2"
        >
          Deshacer
        </button>
      ),
    })
  }, [mostrar, cerrar])
}
