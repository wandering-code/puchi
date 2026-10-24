import { Link } from 'react-router-dom'
import { useAuth } from '../../platform/auth'
import { IconArrow } from '../../ui/icons'
import { Arana, Calabaza, Murcielago, Sombrero, Telarana } from './piezas'
import './halloween.css'

// Halloween: del 1 de octubre al 2 de noviembre (Difuntos), cada año.
// Para el siguiente evento, ver eventos/index.js.

// Los murciélagos de paso: dónde vuelan, cuánto tardan en volver y hacia qué
// lado. Las esperas negativas hacen que al abrir la app no salgan todos a la
// vez desde el borde.
const MURCIELAGOS = [
  { y: '18vh', sube: '22px', dura: '26s', espera: '-4s', ancho: 52 },
  { y: '46vh', sube: '34px', dura: '34s', espera: '-19s', ancho: 38, alReves: true },
  { y: '72vh', sube: '18px', dura: '41s', espera: '-30s', ancho: 44 },
]

function Fondo() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Las telarañas, en dos esquinas opuestas. La de arriba se aparta de
          la barra superior con --hw-arriba (lo pone quien monta el fondo). */}
      <Telarana className="absolute right-0 h-[120px] w-[120px]" style={{ top: 'var(--hw-arriba, env(safe-area-inset-top, 0px))' }} />
      <Telarana className="absolute bottom-0 left-0 h-[96px] w-[96px]" style={{ transform: 'scale(-1, -1)' }} />
      {MURCIELAGOS.map((m, i) => (
        <div
          key={i}
          className={`hw-vuelo ${m.alReves ? 'hw-al-reves' : ''}`}
          style={{ '--hw-y': m.y, '--hw-sube': m.sube, '--hw-dura': m.dura, '--hw-espera': m.espera, opacity: 'var(--hw-silueta-o)' }}
        >
          <Murcielago style={{ width: m.ancho, height: m.ancho * 26 / 64 }} />
        </div>
      ))}
    </div>
  )
}

// Colgando de la barra de arriba, hacia la derecha (a la izquierda está el
// botón del menú y en medio el título). Va debajo de la barra: el hilo sale
// de detrás de ella.
function Cabecera() {
  const hilo = 70
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute right-[22%]"
      style={{ top: `calc(env(safe-area-inset-top, 0px) + 3.5rem - ${hilo - 8}px)` }}
    >
      <Arana hilo={hilo} className="hw-arana" />
    </div>
  )
}

// Encima del logo, un poco ladeado. El logo le deja el hueco (ui/Logo.jsx).
function Logo() {
  return (
    <Sombrero
      className="pointer-events-none absolute"
      style={{ width: '82%', left: '14%', top: '-46%', transform: 'rotate(-14deg)' }}
    />
  )
}

function Menu() {
  return (
    <p className="mt-1 text-[10px] font-semibold uppercase leading-none tracking-[0.16em] text-accent">
      Edición Halloween
    </p>
  )
}

function MenuFondo() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <Telarana className="absolute right-0 h-[110px] w-[110px]" style={{ top: 'env(safe-area-inset-top, 0px)' }} />
      <Calabaza className="absolute bottom-[84px] right-4 h-9 w-11 opacity-80" style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }} />
    </div>
  )
}

// Cuántas noches faltan para el 31. Después del 31 ya no hay cuenta atrás,
// solo despedida.
function cuentaAtras(fecha = new Date()) {
  const noche = new Date(fecha.getFullYear(), 9, 31)
  const hoy = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
  return Math.round((noche - hoy) / 86400000)
}

function Inicio() {
  const { player } = useAuth()
  const faltan = cuentaAtras()
  const titulo = faltan > 1 ? `Faltan ${faltan} noches para Halloween`
    : faltan === 1 ? 'Mañana es Halloween'
    : faltan === 0 ? 'Esta noche es Halloween'
    : 'Halloween se despide'
  return (
    <section
      className="entra relative mb-6 overflow-hidden rounded-xl3 border border-accent-line bg-accent-soft p-4 pr-24"
      style={{ '--entra-desde': 'translateY(10px)', '--entra-dura': '300ms' }}
    >
      <Telarana className="pointer-events-none absolute -right-1 -top-1 h-20 w-20" />
      <Calabaza className="pointer-events-none absolute bottom-3 right-4 h-14 w-[68px]" />
      <Calabaza cara={false} className="pointer-events-none absolute bottom-3 right-[72px] h-7 w-[34px] opacity-90" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Temporada</p>
      <h3 className="mt-1 font-display text-[19px] font-bold leading-tight tracking-[-0.01em]">{titulo}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-dim">
        {faltan >= 0
          ? `Puchi se ha disfrazado, ${player?.name}: hay murciélagos sueltos, telarañas por las esquinas y alguna calabaza en tu estantería.`
          : `Los murciélagos se quedan hasta el día 2, ${player?.name}. Luego Puchi vuelve a ser la de siempre.`}
      </p>
      <Link to="/ajustes" className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent">
        Se puede quitar en Ajustes
        <IconArrow className="h-3.5 w-3.5" />
      </Link>
    </section>
  )
}

// Dos calabazas al final de la estantería de lomos, apoyadas como un libro
// más. `alto` es el de la fila (ALTO_FILA de Lomos.jsx).
function Balda({ alto }) {
  return (
    <div aria-hidden className="pointer-events-none flex items-end gap-0.5 pl-2" style={{ height: alto }}>
      <Calabaza className="h-[46px] w-[56px]" />
      <Calabaza cara={false} className="h-[26px] w-[31px]" />
    </div>
  )
}

export default {
  id: 'halloween',
  nombre: 'Halloween',
  desde: '10-01',
  hasta: '11-02',
  // Lo que se cuenta en Ajustes junto al interruptor.
  descripcion: 'Murciélagos, telarañas y calabazas por toda la app, con los colores de la noche. Se adapta al tema claro y al oscuro.',
  // La barra de estado de iOS, a juego con --color-bg de cada tema.
  barra: { claro: '#f3eadb', oscuro: '#120c17' },
  adornos: { fondo: Fondo, cabecera: Cabecera, logo: Logo, menu: Menu, menuFondo: MenuFondo, inicio: Inicio, balda: Balda },
}
