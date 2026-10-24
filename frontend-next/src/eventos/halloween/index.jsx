import { Link } from 'react-router-dom'
import { useAuth } from '../../platform/auth'
import { IconArrow } from '../../ui/icons'
import { memo } from 'react'
import { Arana, Calabaza, Luz, Murcielago, Sombrero, Telarana, Vela } from './piezas'
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
      <div className="absolute bottom-[84px] right-4 h-9 w-11" style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <Luz tam={110} />
        <Calabaza className="relative h-full w-full" />
      </div>
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
      <div className="pointer-events-none absolute bottom-3 right-4 h-14 w-[68px]">
        <Luz tam={150} />
        <Calabaza className="relative h-full w-full" />
      </div>
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

// Lo que se apoya en la balda de la vista de lomos. `alto` es el de la fila
// (ALTO_FILA de Lomos.jsx): cada pieza ocupa una fila entera y se asienta
// abajo, como un libro más.
//
// La luz va dentro de una caja con z-index propio para pintarse por encima de
// los lomos de alrededor: es lo que hace que se vea que los ilumina.
function Hueco({ alto, children }) {
  return (
    <div aria-hidden className="pointer-events-none relative z-[1] flex items-end gap-0.5 px-1" style={{ height: alto }}>
      {children}
    </div>
  )
}

// La luz de una vela, a la altura de su llama: la vela mide `h` px y la
// llama queda a ~78% de su altura desde abajo.
const luzDeVela = (h, x, retraso) => <Luz x={x} y={`calc(100% - ${Math.round(h * 0.78)}px)`} tam={h * 2.4} retraso={retraso} />

function DosVelas({ alto, retraso = 0 }) {
  return (
    <Hueco alto={alto}>
      {luzDeVela(52, '35%', retraso)}
      <Vela alto={26} className="relative h-[52px] w-[21px]" />
      <Vela alto={18} className="relative h-[52px] w-[21px]" />
    </Hueco>
  )
}

function UnaVela({ alto, retraso = 0 }) {
  return (
    <Hueco alto={alto}>
      {luzDeVela(64, '50%', retraso)}
      <Vela alto={30} className="relative h-[64px] w-[26px]" />
    </Hueco>
  )
}

function CalabazaEncendida({ alto, retraso = 0, ancho = 56 }) {
  const h = Math.round(ancho * 40 / 48)
  return (
    <Hueco alto={alto}>
      <Luz y={`calc(100% - ${Math.round(h * 0.4)}px)`} tam={ancho * 2.6} retraso={retraso} />
      <Calabaza className="relative" style={{ width: ancho, height: h }} />
    </Hueco>
  )
}

// Al final de cada estantería, la calabaza grande encendida con una vela al
// lado, en un solo hueco estrecho: si fueran varias piezas sueltas, a menudo
// no cabrían detrás del último libro y abrirían una balda nueva solo para ellas.
function Balda({ alto }) {
  return (
    <Hueco alto={alto}>
      <Luz x="40%" y="calc(100% - 26px)" tam={150} />
      <Calabaza className="relative h-[46px] w-[56px]" />
      <Vela alto={22} className="relative -ml-1 h-[44px] w-[18px]" />
    </Hueco>
  )
}

// Entre los libros, de vez en cuando, algo apoyado. Siempre en los mismos
// sitios (sale de la posición del libro, no del azar), para que la balda no
// cambie cada vez que se abre. Pocas, para que no se coman la estantería.
// Memo: hay una por libro y casi todas no pintan nada.
const EntreLibros = memo(function EntreLibros({ indice, alto }) {
  if (indice === 0) return null
  const retraso = -((indice * 0.37) % 2.8)   // que no parpadeen todas a la vez
  if (indice % 31 === 19) return <CalabazaEncendida alto={alto} ancho={44} retraso={retraso} />
  if (indice % 14 === 6) return <DosVelas alto={alto} retraso={retraso} />
  if (indice % 23 === 12) return <UnaVela alto={alto} retraso={retraso} />
  return null
})

export default {
  id: 'halloween',
  nombre: 'Halloween',
  desde: '10-01',
  hasta: '11-02',
  // Lo que se cuenta en Ajustes junto al interruptor.
  descripcion: 'Murciélagos, telarañas y calabazas por toda la app, con los colores de la noche. Se adapta al tema claro y al oscuro.',
  // La barra de estado de iOS, a juego con --color-bg de cada tema.
  barra: { claro: '#f3eadb', oscuro: '#120c17' },
  adornos: { fondo: Fondo, cabecera: Cabecera, logo: Logo, menu: Menu, menuFondo: MenuFondo, inicio: Inicio, balda: Balda, entreLibros: EntreLibros },
}
