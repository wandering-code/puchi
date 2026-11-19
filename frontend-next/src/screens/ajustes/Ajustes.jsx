import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { motion } from 'motion/react'
import { useAuth } from '../../platform/auth'
import { useVersion } from '../../platform/version'
import { isIOS, isStandalone, safeInsets } from '../../platform/pwa'
import { usarAspecto, usarPreferencia, usarTema } from '../../platform/preferencias'
import { ACENTOS, cambiarDeTema, conCirculo } from '../../platform/tema'
import { CON_AUDIOLIBROS } from '../../platform/variante'
import { EVENTO_DE_TEMPORADA } from '../../eventos'
import { usarDecoracion } from '../../eventos/usarEvento'
import { AvisosEnAjustes } from '../kokito/avisos/Avisos'
import { usarCabeceraConPanel } from '../luniteca/panel'
import { SelectorSeparacion, usarSeparacion } from '../luniteca/separacion'
import { usarLomosTorcidos } from '../luniteca/Lomos'
import { usarLeyendoComoLaVista } from '../luniteca/Luniteca'
import { seccionesDe } from '../secciones'
import Interruptor from '../../ui/Interruptor'
import Pastilla from '../../ui/Pastilla'
import { IconExit, IconLuna, IconSol } from '../../ui/icons'
import Vistazo from './Vistazo'

// Ajustes, en tres partes:
// - Personalización: el aspecto de toda la app y cómo se ve la estantería,
//   con una vista previa fija arriba (Vistazo) que cambia al tocar cada
//   opción, para elegir sin tener que ir a mirarlo a la Luniteca.
// - General: con qué pantalla se abre, la decoración de temporada…
// - Cuenta: el diagnóstico y cerrar sesión.
export default function Ajustes() {
  const { player, logout } = useAuth()
  const [info, setInfo] = useState(() => snapshot())
  const sello = useVersion()

  useEffect(() => {
    const id = setInterval(() => setInfo(snapshot()), 500)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="py-8">
      <h2 className="font-display text-[1.75rem] font-bold tracking-[-0.02em]">Ajustes</h2>
      <p className="mt-2 text-sm text-ink-dim">Sesión de {player?.name}.</p>

      {/* La vista previa se queda fija SOLO mientras se recorre la
          personalización: es su contenedor el que la acota (sticky dentro de
          esta sección), y al pasar a General se va con ella. */}
      <section className="mt-6">
        <Vistazo />
        <Apartado titulo="Aspecto">
          <Tarjeta>
            <Tema />
            <Acento />
            <div className="px-4 py-3">
              <Textura />
            </div>
          </Tarjeta>
        </Apartado>

        <Apartado titulo="Estantería">
          <Tarjeta>
            <Vista />
            <TamanoPortadas />
            <div className="px-4 py-3"><CabeceraConPanel /></div>
            <div className="px-4 py-3"><ComoSeVeLeyendo /></div>
            <div className="px-4 py-3"><LomosTorcidos /></div>
          </Tarjeta>
          <Tarjeta titulo="Secciones" nota="Cómo se separan Leyendo, Leídos, Por leer… y los años.">
            <Secciones />
          </Tarjeta>
        </Apartado>
      </section>

      <Apartado titulo="General">
        <PantallaDeInicio />
        {EVENTO_DE_TEMPORADA && <DecoracionDeTemporada />}
        {CON_AUDIOLIBROS && <AvisosEnAjustes />}
      </Apartado>

      <Apartado titulo="Cuenta">
        <Tarjeta titulo="Diagnóstico">
          <dl className="divide-y divide-[color:var(--color-line)] text-sm">
            {Object.entries({ ...info, versión: sello.version, compilado: sello.compilado }).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-ink-mute">{k}</dt>
                <dd className="text-right font-mono text-[13px] text-ink">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </Tarjeta>

        <motion.button
          data-pulsa="0.97"
          onClick={logout}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl2 border border-line text-danger"
        >
          <IconExit className="h-5 w-5" />
          Cerrar sesión
        </motion.button>
        <p className="mt-2 px-1 text-xs text-ink-mute">
          La sesión es la misma que la de la Puchi actual: al cerrarla aquí, se cierra también allí.
        </p>
      </Apartado>
    </div>
  )
}

// ── Piezas de la pantalla ────────────────────────────────────────────────

function Apartado({ titulo, children }) {
  return (
    <div className="mt-8">
      <h3 className="px-1 font-display text-lg font-bold tracking-[-0.01em]">{titulo}</h3>
      {children}
    </div>
  )
}

// Una tarjeta de opciones. Sus filas van separadas por una raya.
function Tarjeta({ titulo, nota, children }) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl2 border border-line bg-surface">
      {titulo && (
        <p className="border-b border-line px-4 py-2 text-xs uppercase tracking-wider text-ink-mute">{titulo}</p>
      )}
      <div className="flex flex-col divide-y divide-[color:var(--color-line)]">{children}</div>
      {nota && <p className="border-t border-line px-4 py-2.5 text-xs leading-relaxed text-ink-mute">{nota}</p>}
    </div>
  )
}

// Una fila con su nombre y, debajo, un selector de varias opciones en
// botones. La elegida lleva una pastilla que se desliza de una a otra (Pastilla:
// solo transform, en la GPU).
function Segmentado({ etiqueta, nota, grupo, opciones, elegida, onElegir }) {
  return (
    <div className="px-4 py-3">
      <p className="text-sm font-semibold text-ink">{etiqueta}</p>
      {nota && <p className="mt-0.5 text-xs leading-relaxed text-ink-mute">{nota}</p>}
      <div role="radiogroup" aria-label={etiqueta} className="mt-2.5 grid gap-1 rounded-full bg-surface-2/70 p-1" style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}>
        {opciones.map(({ id, nombre, Icono }) => {
          const activa = elegida === id
          return (
            <button
              key={id}
              role="radio"
              aria-checked={activa}
              onClick={e => onElegir(id, e)}
              className={`relative flex h-9 items-center justify-center gap-1.5 rounded-full px-2 text-[13px] transition-colors ${activa ? 'font-semibold text-accent' : 'text-ink-dim'}`}
            >
              {activa && <Pastilla grupo={grupo} className="absolute inset-0 rounded-full bg-surface sombra-pastilla" />}
              {Icono && <Icono className="relative h-[15px] w-[15px] shrink-0" />}
              <span className="relative truncate">{nombre}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Aspecto ──────────────────────────────────────────────────────────────

// Claro u oscuro. El mismo círculo que el botón del menú, abierto desde el
// botón que se toca (ver cambiarDeTema en platform/tema.js).
function Tema() {
  const [tema, ponerTema] = usarTema()
  const elegir = (siguiente, e) => {
    if (siguiente === tema) return
    const caja = e.currentTarget.getBoundingClientRect()
    cambiarDeTema(
      siguiente,
      { x: caja.left + caja.width / 2, y: caja.top + caja.height / 2 },
      () => flushSync(() => ponerTema(siguiente)),
    )
  }
  return (
    <Segmentado
      etiqueta="Tema"
      grupo="ajustes-tema"
      opciones={[{ id: 'claro', nombre: 'Claro', Icono: IconSol }, { id: 'oscuro', nombre: 'Oscuro', Icono: IconLuna }]}
      elegida={tema}
      onElegir={elegir}
    />
  )
}

// El color de la app: botones, la sección de Leyendo, el panel de la
// cabecera… Cada muestra se pinta con el tono que tendrá en el tema puesto.
function Acento() {
  const [acento, poner] = usarAspecto('acento')
  const [tema] = usarTema()
  const elegido = ACENTOS.find(a => a.id === acento) || ACENTOS[0]
  return (
    <div className="px-4 py-3">
      <p className="text-sm font-semibold text-ink">Color</p>
      <p className="mt-0.5 text-xs leading-relaxed text-ink-mute">
        El de los botones, la sección de Leyendo y el panel de arriba. Ahora: {elegido.nombre.toLowerCase()}.
      </p>
      {/* Repartidas a lo ancho, en una fila: las seis caben en el móvil más
          estrecho (375px) sin saltar a otra línea. */}
      <div role="radiogroup" aria-label="Color" className="mt-3 flex justify-between">
        {ACENTOS.map(a => {
          const activo = a.id === acento
          const color = tema === 'oscuro' ? a.oscuro : a.claro
          return (
            <button
              key={a.id}
              role="radio"
              aria-checked={activo}
              aria-label={a.nombre}
              data-pulsa="0.9"
              onClick={() => poner(a.id)}
              className="relative flex h-11 w-11 items-center justify-center rounded-full"
            >
              {/* El aro de la elegida, por fuera de la muestra. */}
              <span
                className={`absolute inset-0 rounded-full border-2 transition-opacity duration-200 ${activo ? 'opacity-100' : 'opacity-0'}`}
                style={{ borderColor: color }}
              />
              <span className="h-8 w-8 rounded-full" style={{ background: color }} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Textura() {
  const [textura, poner] = usarAspecto('textura')
  return (
    <Interruptor
      puesto={textura !== 'no'}
      onCambiar={v => poner(v ? 'si' : 'no')}
      etiqueta="Fondo con grano de papel"
      nota="Una textura muy suave en el fondo. Apagado, liso."
    />
  )
}

// ── Estantería ───────────────────────────────────────────────────────────

// La misma preferencia que el selector de la barra de la Luniteca.
function Vista() {
  const [vista, poner] = usarPreferencia('vista', 'grid')
  return (
    <Segmentado
      etiqueta="Vista"
      grupo="ajustes-vista"
      opciones={[
        { id: 'grid', nombre: 'Cuadrícula' },
        { id: 'list', nombre: 'Lista' },
        { id: 'lomos', nombre: 'Estantería' },
      ]}
      elegida={vista}
      onElegir={id => poner(id)}
    />
  )
}

function TamanoPortadas() {
  const [portadas, poner] = usarAspecto('portadas')
  return (
    <Segmentado
      etiqueta="Tamaño de las portadas"
      nota="En la cuadrícula: cuántas caben por fila."
      grupo="ajustes-portadas"
      opciones={[
        { id: 'pequenas', nombre: 'Pequeñas' },
        { id: 'normales', nombre: 'Normales' },
        { id: 'grandes', nombre: 'Grandes' },
      ]}
      elegida={portadas}
      onElegir={id => poner(id)}
    />
  )
}

function CabeceraConPanel() {
  const [conPanel, poner] = usarCabeceraConPanel()
  return (
    <Interruptor
      puesto={conPanel}
      onCambiar={poner}
      etiqueta="Cabecera con panel de color"
      nota="La parte de arriba de la Luniteca, en un panel teñido del color de la app."
    />
  )
}

// «Leyendo» con sus tarjetas grandes o con la misma vista que el resto de la
// estantería, sin perder por dónde vas: ver LibrosLeyendo en Luniteca.jsx.
function ComoSeVeLeyendo() {
  const [comoLaVista, poner] = usarLeyendoComoLaVista()
  return (
    <Interruptor
      puesto={comoLaVista}
      onCambiar={poner}
      etiqueta="Leyendo con la misma vista que el resto"
      nota="Con por dónde vas encima de cada libro. Apagado, las tarjetas grandes."
    />
  )
}

function LomosTorcidos() {
  const [torcidos, poner] = usarLomosTorcidos()
  return (
    <Interruptor
      puesto={torcidos}
      onCambiar={poner}
      etiqueta="Algunos lomos torcidos"
      nota="En la estantería, uno de cada siete se apoya un poco, como en una balda de verdad."
    />
  )
}

function Secciones() {
  const [elegida, poner] = usarSeparacion()
  return <SelectorSeparacion elegida={elegida} onElegir={poner} />
}

// ── General ──────────────────────────────────────────────────────────────

// La decoración del evento de ahora (Halloween, Navidad…: ver src/eventos).
// Solo sale mientras hay uno en temporada; encendida por defecto y con la
// cuenta, como el resto. Al cambiarla, la app se repinta con el mismo círculo
// que el tema, abierto desde el interruptor.
function DecoracionDeTemporada() {
  const evento = EVENTO_DE_TEMPORADA
  const [puesta, poner] = usarDecoracion(evento)
  const dedo = useRef(null)
  const [d, m] = evento.hasta.split('-').map(Number).reverse()
  const hasta = new Date(2000, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
  const cambiar = v => conCirculo(dedo.current, 'encendiendo', () => flushSync(() => poner(v)))
  return (
    <div className="mt-3 overflow-hidden rounded-xl2 border border-line bg-surface">
      <p className="border-b border-line px-4 py-2 text-xs uppercase tracking-wider text-ink-mute">
        Temporada
      </p>
      <div
        className="px-4 py-3"
        onPointerDown={e => { dedo.current = { x: e.clientX, y: e.clientY } }}
      >
        <Interruptor
          puesto={puesta}
          onCambiar={cambiar}
          etiqueta={`Decoración de ${evento.nombre}`}
          nota={evento.descripcion}
        />
      </div>
      <p className="border-t border-line px-4 py-2.5 text-xs text-ink-mute">
        Se quita sola después del {hasta}.
      </p>
    </div>
  )
}

// Con qué pantalla arranca Puchi. Lo elige cada uno y va con su cuenta.
//
// Las opciones salen de `seccionesDe`, el mismo sitio del que salen las
// entradas del menú, así que quien no es del club no puede elegir el club aquí
// — ni siquiera verlo en la lista. Si se listaran a mano, este selector y el
// menú acabarían diciendo cosas distintas.
function PantallaDeInicio() {
  const { player } = useAuth()
  const [elegida, elegir] = usarPreferencia('inicio', '/')
  const opciones = useMemo(() => seccionesDe(player), [player])
  // La guardada puede haber dejado de valer (se perdió el acceso al club): se
  // enseña Inicio como puesta, que es lo que va a pasar de verdad al arrancar.
  const actual = opciones.some(o => o.to === elegida) ? elegida : '/'

  return (
    <div className="mt-3 overflow-hidden rounded-xl2 border border-line bg-surface">
      <p className="border-b border-line px-4 py-2 text-xs uppercase tracking-wider text-ink-mute">
        Al abrir Puchi
      </p>
      <div className="flex flex-col divide-y divide-[color:var(--color-line)]">
        {opciones.map(({ to, label, Icon, resumen }) => {
          const activa = actual === to
          return (
            <button
              key={to}
              onClick={() => elegir(to)}
              className="flex items-center gap-3 px-4 py-3 text-left"
            >
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${activa ? 'border-accent bg-accent' : 'border-line'}`}>
                {activa && (
                  <Pastilla grupo="inicio-elegida" className="h-2 w-2 rounded-full bg-on-accent" />
                )}
              </span>
              <Icon className={`h-[18px] w-[18px] shrink-0 ${activa ? 'text-accent' : 'text-ink-mute'}`} />
              <span className="min-w-0">
                <span className={`block text-sm font-semibold ${activa ? 'text-accent' : 'text-ink'}`}>{label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-mute">{resumen}</span>
              </span>
            </button>
          )
        })}
      </div>
      <p className="border-t border-line px-4 py-2.5 text-xs leading-relaxed text-ink-mute">
        Se aplica la próxima vez que abras la app. Entrar en Inicio desde el menú sigue llevándote
        a Inicio, elijas lo que elijas aquí.
      </p>
    </div>
  )
}

// ── Diagnóstico ──────────────────────────────────────────────────────────

function snapshot() {
  const cs = getComputedStyle(document.documentElement)
  const vv = window.visualViewport
  const safe = safeInsets()
  return {
    // Lo primero, y a propósito: con el service worker por medio, un
    // dispositivo puede quedarse en una versión vieja sin que se note, y
    // entonces lo que se prueba en local y lo que se ve en el móvil no son el
    // mismo código. Aquí se ve el commit exacto que está corriendo.
    instalada:  isStandalone() ? 'sí' : 'no (pestaña)',
    plataforma: isIOS() ? 'iOS' : navigator.platform || '—',
    'safe top':    safe.top,
    'safe bottom': safe.bottom,
    viewport:   vv ? `${Math.round(vv.width)}×${Math.round(vv.height)}` : '—',
    dpr:        window.devicePixelRatio,
    '--kb':     cs.getPropertyValue('--kb').trim() || '0px',
    '--vvh':    cs.getPropertyValue('--vvh').trim() || '—',
  }
}
