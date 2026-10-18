import { useEffect, useState } from 'react'
import { api } from '../../../platform/api'
import { CON_AUDIOLIBROS } from '../../../platform/variante'

// Qué libros del catálogo tienen un audiolibro que ya se puede escuchar
// (#74): para el filtro "Con audiolibro" de la Luniteca. Un Set de ids, o
// null fuera de /kokito (y mientras llega), que es "no hay filtro de audio".
export function usarLibrosConAudio() {
  const [ids, setIds] = useState(null)
  useEffect(() => {
    if (!CON_AUDIOLIBROS) return
    let vivo = true
    api('/listen/books')
      .then(d => { if (vivo) setIds(new Set(d.book_ids)) })
      .catch(() => {})
    return () => { vivo = false }
  }, [])
  return ids
}
