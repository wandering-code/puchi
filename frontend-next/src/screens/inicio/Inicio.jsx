import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Desplegable from '../../ui/Desplegable'
import Marco from '../../ui/Marco'
import { useAuth } from '../../platform/auth'
import { usarPreferencia } from '../../platform/preferencias'
import { CON_AUDIOLIBROS } from '../../platform/variante'
import { seccionesDe } from '../secciones'
import MuestraDeVoz from '../kokito/escuchar/MuestraDeVoz'
import Logo from '../../ui/Logo'
import {
  IconActividad, IconArrow, IconAuriculares, IconBooks, IconCampana, IconChat, IconChevron, IconClub,
  IconSettings,
} from '../../ui/icons'

// La pantalla de Inicio (rediseñada el 2026-10-18 a petición del usuario):
// antes lo contaba todo de golpe y era demasiado. Ahora es un saludo corto y
// un bloque por cada parte de la app, plegado: quien quiera conocerla lo
// despliega, y quien no, ve de un vistazo lo que hay.
//
// Está escrita como la guía de una app de verdad, para quien la usa: nada de
// lo que hace el admin por detrás (preparar audiolibros, aprobar cuentas…).
//
// Qué bloques salen depende de lo que puede ver cada uno (`seccionesDe`, el
// mismo filtro que el menú): a quien no es del club no se le habla del club.

const URL_PUCHI_ANTERIOR = 'https://puchi.wanderingcode.dev/v1'

// `ruta`: la sección a la que lleva el bloque, y la que decide si se enseña.
// Los bloques sin ruta (instalarla, trucos) los ve todo el mundo.
const BLOQUES = [
  {
    id: 'luniteca',
    ruta: '/luniteca',
    Icon: IconBooks,
    titulo: 'Luniteca, tu estantería',
    resumen: 'Todos tus libros: los que lees, los que leíste y los que te esperan.',
    ir: 'Ir a mi estantería',
    funciones: [
      ['Añade tus libros', 'Búscalos por título o autor, escanea el código de barras con la cámara o tráete tu biblioteca entera desde Goodreads o una hoja de cálculo. Y si no aparece, a mano.'],
      ['Lleva la cuenta', 'Márcalos como «por leer», «leyendo», «leído» o «dropeado», con sus fechas, y apunta por qué página vas: en papel, en eReader o en los dos.'],
      ['Puntúa y apunta', 'Ponle nota a cada libro y escribe tus impresiones. Lo que te costó y tus notas son solo tuyos.'],
      ['Mírala a tu manera', 'En cuadrícula, en lista o como una balda de verdad, con los libros de canto. Busca, filtra y ordena como quieras.'],
      ['Pide un audiolibro', 'Desde la ficha de cualquier libro de tu estantería: dinos por dónde quieres empezar y te avisamos en cuanto esté.', 'audio', 'muestra'],
      ['Léelo en la app', 'Si un libro tiene audiolibro, puedes leer su texto aquí mismo. Toca una frase y empieza a sonar desde ahí; mientras escuchas, el texto te sigue.', 'audio'],
    ],
  },
  {
    id: 'escuchar',
    ruta: '/escuchar',
    Icon: IconAuriculares,
    titulo: 'Escuchar',
    resumen: 'Los audiolibros de tus libros, con un reproductor pensado para ellos.',
    ir: 'Ir a Escuchar',
    muestra: true,
    funciones: [
      ['Sigue donde lo dejaste', 'En el móvil o en el ordenador: lo que escuchas se guarda en tu cuenta. Y lo escuchado avanza solo la página en tu estantería.'],
      ['Del papel al audio', 'Si vas leyendo el libro por otro lado, te proponemos seguir escuchando justo desde tu página.'],
      ['Velocidad y temporizador', 'Escucha más rápido o más despacio, y pon un temporizador para dormirte sin perder el punto.'],
      ['Sin conexión', 'Descarga los capítulos y escúchalos sin cobertura, en el avión o en el metro.'],
      ['Descubre más', 'Los audiolibros que hay aunque no tengas el libro: añádelo a tu estantería con un toque y a escuchar.'],
    ],
  },
  {
    id: 'club',
    ruta: '/club',
    Icon: IconClub,
    titulo: 'Club de lectura',
    resumen: 'Lo que leemos juntos, al ritmo de las quedadas.',
    ir: 'Ir al club',
    funciones: [
      ['La lectura actual', 'Qué toca leer ahora y hasta qué página hay que llegar para la próxima quedada.'],
      ['Propón libros', 'Cualquiera del club puede proponer el siguiente.'],
      ['Las sesiones', 'De cada libro, cuándo nos vimos, qué parte tocaba y qué se dijo.'],
      ['Las notas del club', 'Lo que le puso cada uno a cada libro, y la media.'],
    ],
  },
  {
    id: 'diskordkito',
    ruta: '/diskordkito',
    Icon: IconChat,
    titulo: 'Diskordkito',
    resumen: 'Para hablar con el club, en grupo o de tú a tú.',
    ir: 'Ir a Diskordkito',
    funciones: [
      ['Quién está', 'Arriba ves quién está conectado; toca a alguien y habláis.'],
      ['Canal y privados', 'El canal de todo el club y una conversación aparte con cada uno.'],
      ['Llamadas', 'De voz o con vídeo, con una persona o con varias a la vez.'],
      ['Te enteras estés donde estés', 'Los mensajes y las llamadas te avisan en cualquier pantalla de la app.'],
    ],
  },
  {
    id: 'actividad',
    ruta: '/actividad',
    Icon: IconActividad,
    titulo: 'Actividad',
    resumen: 'Qué están leyendo, terminando y puntuando los demás.',
    ir: 'Ver la actividad',
    funciones: [
      ['Lo último de todos', 'Quién empieza un libro, quién lo termina y qué nota le pone.'],
      ['Las estanterías de los demás', 'Entra en la de cualquiera y mírala como la tuya.'],
      ['Llévate ideas', 'Un libro que te llame la atención, a tu estantería con un toque.'],
    ],
  },
  {
    id: 'avisos',
    Icon: IconCampana,
    titulo: 'Avisos',
    resumen: 'Lo que pasa mientras no estás mirando.',
    funciones: [
      ['La campana', 'Arriba a la derecha: tus audiolibros listos, capítulos nuevos y respuestas a lo que pediste.', 'audio'],
      ['En tu móvil', 'Actívalos en Ajustes y te llegarán como notificación, aunque no tengas la app abierta.', 'audio'],
      ['Novedades', 'Cuando haya algo nuevo en Puchi, te lo contaremos al entrar.'],
    ],
  },
  {
    id: 'ajustes',
    ruta: '/ajustes',
    Icon: IconSettings,
    titulo: 'Ajustes',
    resumen: 'Puchi a tu gusto.',
    ir: 'Ir a Ajustes',
    funciones: [
      ['Claro u oscuro', 'También a un toque desde el pie del menú.'],
      ['Con qué pantalla arranca', 'Si prefieres entrar directamente a tu estantería, o a cualquier otra.'],
      ['Va contigo', 'Tus gustos se guardan en tu cuenta: los eliges una vez y los ves igual en todos tus dispositivos.'],
    ],
  },
  {
    id: 'movil',
    // El logo a color, algo más grande que los iconos de línea para que se lea.
    // Su fondo no se oscurece al abrir: sobre el acento se perdía el contorno.
    Icon: () => <Logo className="h-7 w-7" />,
    fondoFijo: true,
    titulo: 'Puchi en tu móvil',
    resumen: 'Instálala y se abre como una app más.',
    funciones: [
      ['Instálala', 'Desde el navegador del móvil: menú → «Añadir a pantalla de inicio». Se abre a pantalla completa, como cualquier app.'],
      ['¿Ya la tenías de antes?', 'Si la añadiste antes de que cambiara la dirección, quita el icono y vuelve a añadirla desde aquí: el viejo puede no abrirse o enseñar una versión antigua.'],
      ['Gestos', 'El menú se abre con el botón de arriba a la izquierda y se cierra arrastrándolo. Las hojas que suben desde abajo se cierran arrastrando el asa o con el gesto de volver.'],
    ],
  },
]

export default function Inicio() {
  const { player } = useAuth()
  const [inicio] = usarPreferencia('inicio', '/')
  const [abiertos, setAbiertos] = useState(() => new Set())
  const visibles = useMemo(() => {
    const rutas = new Set(seccionesDe(player).map(s => s.to))
    return BLOQUES
      .filter(b => !b.ruta || rutas.has(b.ruta))
      .map(b => ({ ...b, funciones: b.funciones.filter(([, , solo]) => solo !== 'audio' || CON_AUDIOLIBROS) }))
  }, [player])

  const alternar = id => setAbiertos(prev => {
    const s = new Set(prev)
    s.has(id) ? s.delete(id) : s.add(id)
    return s
  })

  return (
    <div className="py-6">
      <header className="mb-6">
        <div className="flex items-center gap-2.5">
          <Logo className="h-8 w-8 shrink-0" />
          <h2 className="font-display text-[1.75rem] font-bold leading-none tracking-[-0.02em]">
            Hola, {player?.name}
          </h2>
        </div>
        <p className="mt-2.5 max-w-prose text-[15px] leading-relaxed text-ink-dim">
          {/* El club, solo a quien es del club: a los demás ni se les nombra. */}
          {player?.club_member
            ? 'Puchi es tu biblioteca: lo que lees, lo que escuchas y lo que compartes con el club.'
            : 'Puchi es tu biblioteca: lo que lees, lo que escuchas y lo que leen los demás.'}
        </p>
        <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-ink-mute">
          ¿Quieres conocerla mejor? Despliega cualquier apartado.
        </p>
      </header>

      <div className="space-y-2.5">
        {visibles.map((b, i) => (
          <Bloque key={b.id} bloque={b} orden={i} abierto={abiertos.has(b.id)} onAlternar={() => alternar(b.id)} />
        ))}
      </div>

      <Arranque inicioActual={inicio} />

      <p className="mt-6 text-center text-[11px] text-ink-mute">
        ¿Buscas la Puchi de antes? Está en{' '}
        <a href={URL_PUCHI_ANTERIOR} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          puchi.wanderingcode.dev/v1
        </a>
      </p>
    </div>
  )
}

function Bloque({ bloque: b, orden, abierto, onAlternar }) {
  const { Icon } = b
  // El fondo y el borde los pone el Marco, que encoge y crece con el telón
  // del Desplegable (ver ui/Marco).
  const marco = useRef(null)
  return (
    // Las animaciones de esta pantalla van en CSS (la entrada con .entra, el
    // despliegue con Desplegable): las hace el navegador a la frecuencia de
    // la pantalla, y no Motion desde JavaScript, que en Safari va a 60.
    <section
      className="entra relative isolate"
      style={{ '--entra-desde': 'translateY(10px)', '--entra-dura': '300ms', '--entra-espera': `${Math.min(orden * 40, 200)}ms` }}
    >
      <Marco ref={marco} radio={28} resaltado={abierto} />
      <button onClick={onAlternar} aria-expanded={abierto} className="relative flex w-full items-center gap-3 p-4 text-left">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl2 transition-colors ${abierto && !b.fondoFijo ? 'bg-accent text-on-accent' : 'bg-accent-soft text-accent'}`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[17px] font-bold leading-tight tracking-[-0.01em]">{b.titulo}</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-ink-dim">{b.resumen}</span>
        </span>
        <IconChevron className={`h-4 w-4 shrink-0 text-ink-mute transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`} />
      </button>

      <Desplegable abierto={abierto} onTelon={t => marco.current?.telon(t)}>
            <div className="px-4 pb-4">
              {b.muestra && CON_AUDIOLIBROS && <MuestraDeVoz className="mb-2" />}
              <div className="space-y-2">
                {b.funciones.map(([titulo, texto, , muestra]) => (
                  <div key={titulo} className="rounded-xl2 bg-bg/70 px-3.5 py-3">
                    <p className="text-sm font-semibold leading-snug">{titulo}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-dim">{texto}</p>
                    {muestra && <MuestraDeVoz className="mt-2.5" />}
                  </div>
                ))}
              </div>
              {b.ruta && (
                <Link
                  to={b.ruta}
                  className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl2 bg-accent-soft text-[13px] font-semibold text-accent transition-transform duration-150 active:scale-[0.99]"
                >
                  {b.ir}
                  <IconArrow className="h-4 w-4" />
                </Link>
              )}
            </div>
      </Desplegable>
    </section>
  )
}

// Al final, a propósito: quien ya se la sabe no tiene por qué pasar por aquí
// cada vez.
function Arranque({ inicioActual }) {
  const enInicio = inicioActual === '/'
  return (
    <Link
      to="/ajustes"
      className="mt-6 flex items-center gap-3 rounded-xl2 border border-line bg-surface p-4 transition-transform duration-150 active:scale-[0.99]"
    >
      <IconSettings className="h-5 w-5 shrink-0 text-accent" />
      <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink-dim">
        {enInicio
          ? '¿Prefieres que Puchi arranque directamente en tu estantería? Se elige en Ajustes.'
          : 'Puchi arranca en la pantalla que elegiste; puedes cambiarla en Ajustes.'}
      </p>
      <IconArrow className="h-4 w-4 shrink-0 text-ink-mute" />
    </Link>
  )
}
