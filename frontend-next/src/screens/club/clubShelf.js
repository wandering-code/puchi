// Reglas de la estantería del club.
//
// La idea de la que sale todo esto: **el club es una estantería más**. Tiene
// libros que se están leyendo, libros pendientes y libros ya leídos, igual que
// la de cualquiera; lo único distinto es de quién son y quién decide su
// estado. Así que en vez de escribir otra estantería paralela, las entradas
// del club se traducen a la misma forma que usa la tuya y se pintan con los
// mismos componentes (Coleccion, Lomos, la barra de herramientas, la ficha).
//
// La traducción es esta, y es la que hace que todo lo demás encaje:
//
//   club 'active'   → 'reading'       → sección "Lectura actual"
//   club 'proposed' → 'want_to_read'  → sección "Propuestos"
//   club 'finished' → 'read'          → sección "Leídos", agrupados por año
//
// La entrada original se guarda entera en `.club`: lo que es propio del club
// (quién lo propuso, las notas, cuántas sesiones lleva, la media) no cabe en
// la forma de una entrada personal y no hay que perderlo.

import { compareEntries, matchesFilters, matchesQuery } from '../luniteca/shelf'

export const CLUB_STATUS_LABEL = {
  proposed: 'Propuesto',
  active:   'Lectura actual',
  finished: 'Leído por el club',
}

export const CLUB_STATUS_ORDER = ['proposed', 'active', 'finished']

const A_ESTADO_DE_ESTANTERIA = {
  active:   'reading',
  proposed: 'want_to_read',
  finished: 'read',
}

// Una entrada del club con la forma de una entrada de estantería, para que la
// pinten los componentes que ya existen.
//
// Las fechas: `activated_at` es cuándo el club empezó el libro y `read_date`
// cuándo lo terminó, así que caen justo donde van el inicio y el fin de una
// lectura. La puntuación es la MEDIA del club — es la que tiene sentido ver
// sobre la portada en una cuadrícula del club, igual que en la tuya se ve la
// tuya.
//
// Lo que no existe en el club se pone a nulo explícitamente y no se deja
// heredado: progreso, carpeta, veces leído y notas son de una copia personal,
// y si se colaran, la barra de progreso de la ficha o el filtro de carpetas
// enseñarían datos inventados.
export function comoEntrada(e) {
  return {
    id:          e.id,
    book:        e.book,
    club:        e,
    status:      A_ESTADO_DE_ESTANTERIA[e.status] || 'want_to_read',
    rating:      e.avg_rating ?? null,
    started_at:  e.activated_at,
    finished_at: e.read_date,
    folder:      null,
    times_read:  0,
    progress:    0,
    current_page:       null,
    custom_total_pages: null,
    notes:       null,
    added_at:    e.added_at,
  }
}

// Reparte la estantería del club en sus secciones, ya filtrada y ordenada.
// Mismo contrato que agruparEstanteria (se llama desde un useMemo), pero con
// las secciones del club: no hay "dropeados" —un libro del club no se
// abandona, se queda propuesto— y "propuestos" se ordena por cuándo se
// propuso, del más reciente al más antiguo, porque es una cola de propuestas y
// no una lista alfabética para elegir.
export function agruparClub(lista, { filters, query, sort }) {
  const s = lista || []
  const visible = s.filter(e => matchesFilters(e, filters) && matchesQuery(e, query))

  const deEstado = estado => visible.filter(e => e.club.status === estado)

  const actual = deEstado('active')
  const propuestos = [...deEstado('proposed')].sort((a, b) => (
    sort.field
      ? compareEntries(a, b, sort)
      : (b.club.added_at || '').localeCompare(a.club.added_at || '')
  ))

  // Los leídos, por año de la fecha en que el club lo terminó, del más
  // reciente al más antiguo; los que no la tengan, en su propio grupo al final.
  const porAno = {}
  for (const e of deEstado('finished')) {
    const year = e.club.read_date ? e.club.read_date.slice(0, 4) : 'sin-fecha'
    ;(porAno[year] ||= []).push(e)
  }
  const years = Object.keys(porAno).filter(y => y !== 'sin-fecha').sort((a, b) => b.localeCompare(a))
  if (porAno['sin-fecha']) years.push('sin-fecha')
  for (const y of years) {
    porAno[y].sort((a, b) => (
      sort.field
        ? compareEntries(a, b, sort)
        : (b.club.read_date || '').localeCompare(a.club.read_date || '')
    ))
  }

  return {
    visible,
    actual,
    propuestos,
    leidosPorAno: years.map(year => ({ year, items: porAno[year] })),
    years,
    vacia: s.length === 0,
    ningunoVisible: s.length > 0 && visible.length === 0,
  }
}

// Cuántas sesiones lleva un libro, escrito como se dice. Va aquí y no suelto
// en cada tarjeta porque el plural de "sesión" lleva tilde en singular y no en
// plural, y ya se escribió mal una vez.
export function textoSesiones(n) {
  if (!n) return null
  return n === 1 ? '1 sesión' : `${n} sesiones`
}

// La fecha de una sesión, escrita entera ("martes, 3 de junio de 2025"). Se
// construye con la hora fijada a mediodía a propósito: `new Date('2025-06-03')`
// se interpreta como UTC y en España se lee como el día anterior a partir de
// cierta hora.
export function fechaLarga(dia) {
  if (!dia) return '—'
  return new Date(`${dia}T12:00`).toLocaleDateString('es', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export function fechaCorta(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}
