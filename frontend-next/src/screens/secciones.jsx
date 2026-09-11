import { esAdmin } from '../platform/auth'
import { IconActividad, IconBooks, IconClub, IconEscudo, IconHome, IconSettings } from '../ui/icons'

// Las secciones de la app, en un solo sitio.
//
// Vivían dentro de Shell.jsx, que era donde se pintaba el menú. Ahora las
// necesitan tres pantallas —el menú, la guía de Inicio y el selector de
// "con qué pantalla arranca Puchi" de Ajustes— y tenerlas en Shell obligaba a
// que Inicio importara de Shell, que a su vez importa Inicio: un ciclo que ni
// se lee bien ni conviene mantener.
//
// Y aquí está además quién puede ver qué, que es la parte que no se puede
// duplicar: si el menú y el selector de Ajustes usaran criterios distintos,
// alguien podría elegir como pantalla de arranque algo que luego no ve.

export const SECCIONES = [
  {
    to: '/',
    label: 'Inicio',
    Icon: IconHome,
    resumen: 'La guía de la app y por dónde empezar.',
  },
  {
    to: '/luniteca',
    label: 'Luniteca',
    Icon: IconBooks,
    resumen: 'Tu estantería: lo que lees, lo que has leído y lo que te queda.',
    puntos: [
      'Tres formas de mirarla: cuadrícula, lista y la estantería de lomos, con los libros de canto como en una balda de verdad.',
      'Buscar por título o autor, filtrar por género, carpeta, autor, páginas o nota, y ordenar a tu gusto.',
      'La ficha de cada libro: estado, fechas, carpeta, veces leído y tus notas, que no ve nadie más.',
      'Para puntuar y para mover el progreso, mantén pulsado y arrastra — así no se toca sin querer al bajar por la lista.',
      'Añadir libros buscándolos (salen primero los que ya tiene alguien, con sus datos puestos) o a mano.',
      'La portada es tuya: cambiarla no se la cambia a los demás.',
    ],
  },
  {
    to: '/club',
    label: 'Club de lectura',
    Icon: IconClub,
    soloClub: true,
    resumen: 'La estantería del club, con lo que toca leer ahora.',
    puntos: [
      'La lectura actual, los libros propuestos y los que ya habéis leído, agrupados por año.',
      'Hasta qué página hay que llevar leído para la próxima quedada, a la vista en la tarjeta y en la ficha.',
      'Las sesiones de cada libro: cuándo fue, qué parte tocaba y qué se dijo.',
      'La puntuación de cada uno y la media del club, en los libros ya terminados.',
      'Proponer un libro puede cualquiera del club; elegir cuál se lee, el admin.',
    ],
  },
  {
    to: '/actividad',
    label: 'Actividad',
    Icon: IconActividad,
    resumen: 'Lo que van leyendo, terminando y puntuando los demás.',
    puntos: [
      'Desde aquí entras en la estantería de cualquiera: se ve y se maneja igual que la tuya, pero sin poder tocar nada suyo.',
      'Un libro que le veas a alguien te lo puedes guardar en la tuya sin salir de donde estás.',
    ],
  },
  {
    to: '/ajustes',
    label: 'Ajustes',
    Icon: IconSettings,
    resumen: 'Cómo se ve la app y con qué pantalla arranca.',
    puntos: [
      'Claro y oscuro. También está a un toque en el pie del menú lateral.',
      'Cómo se separan las secciones de la estantería.',
      'Con qué pantalla quieres que arranque Puchi.',
    ],
  },
  {
    to: '/admin',
    label: 'Administración',
    Icon: IconEscudo,
    soloAdmin: true,
    resumen: 'Quién entra en Puchi y quién está en el club.',
    puntos: [
      'Aprobar o rechazar las cuentas nuevas, y decidir de paso si entran en el club.',
      'Desactivar una cuenta (pierde el acceso pero conserva sus libros) o borrarla del todo.',
    ],
  },
]

// Las que esta persona puede ver. Es el ÚNICO sitio donde se decide: el menú,
// la guía y el selector de pantalla de arranque preguntan aquí.
//
// Lo de la pantalla es solo para no enseñar lo que no toca; quien de verdad lo
// impide es el backend (`require_club_member` y `require_admin` devuelven 403).
export function seccionesDe(player) {
  return SECCIONES.filter(s => (
    (!s.soloClub || !!player?.club_member) && (!s.soloAdmin || esAdmin(player))
  ))
}

// ¿Puede esta persona arrancar en esta ruta? Se usa al aplicar la pantalla de
// inicio guardada: alguien pudo elegir el club y dejar de ser del club después,
// y entonces su preferencia ya no vale y se vuelve a Inicio.
export function puedeVer(player, ruta) {
  return seccionesDe(player).some(s => s.to === ruta)
}
