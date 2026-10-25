import { Link } from 'react-router-dom'
import { useAuth } from '../../platform/auth'
import { usarPreferencia } from '../../platform/preferencias'
import { IconArrow } from '../../ui/icons'
import { memo, useLayoutEffect, useRef, useState } from 'react'
import { Arana, Calabaza, Humo, Luz, Murcielago, Sombrero, Telarana, Vela } from './piezas'
import './halloween.css'

// Halloween: del 1 de octubre al 2 de noviembre (Difuntos), cada año.
// Para el siguiente evento, ver eventos/index.js.

// Los murciélagos van pegados a la PÁGINA, no a la pantalla: cada uno tiene
// su sitio en el contenido y su ruta, y al hacer scroll se queda allí aunque
// salga de la vista (sitio `contenido`). Uno cada ~650px de página, a un lado
// y a otro; cada ruta es un lazo amplio, con su duración y su espera para que
// no se muevan a la vez.
const RUTAS = ['hw-ruta-a', 'hw-ruta-b', 'hw-ruta-c']
const SITIOS_X = ['62%', '6%', '38%', '70%', '14%']

function Contenido({ alto }) {
  const murcielagos = []
  for (let y = 150, i = 0; y < alto - 40; y += 650, i++) {
    murcielagos.push({
      top: y + (i % 2) * 90,
      left: SITIOS_X[i % SITIOS_X.length],
      ancho: [44, 34, 40, 30, 38][i % 5],
      ruta: RUTAS[i % RUTAS.length],
      dura: `${9 + (i % 3) * 1.7}s`,
      espera: `${-((i * 2.3) % 9)}s`,
    })
  }
  return murcielagos.map((m, i) => (
    <div
      key={i}
      className={`hw-revoloteo ${m.ruta} absolute`}
      style={{ left: m.left, top: m.top, '--hw-dura': m.dura, '--hw-espera': m.espera, opacity: 'var(--hw-silueta-o)' }}
    >
      <Murcielago style={{ width: m.ancho, height: m.ancho * 26 / 64 }} />
    </div>
  ))
}

function Fondo() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Las telarañas, en dos esquinas opuestas. La de arriba se aparta de
          la barra superior con --hw-arriba (lo pone quien monta el fondo). */}
      <Telarana className="absolute right-0 h-[120px] w-[120px]" style={{ top: 'var(--hw-arriba, env(safe-area-inset-top, 0px))' }} />
      <Telarana className="absolute bottom-0 left-0 h-[96px] w-[96px]" style={{ transform: 'scale(-1, -1)' }} />
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
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <Telarana className="absolute right-0 h-[110px] w-[110px]" style={{ top: 'env(safe-area-inset-top, 0px)' }} />
      {/* z-[2]: por encima de la lista de secciones, que va después y si no
          se quedaría con el toque. */}
      <div className="pointer-events-auto absolute bottom-[84px] right-4 z-[2]" style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <CalabazaEncendible clave="menu" ancho={44} luz={2.5} />
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
      <div className="absolute bottom-3 right-4">
        <CalabazaEncendible clave="inicio" ancho={68} luz={2.2} />
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

// ── Encender y apagar con un toque ──────────────────────────────────────
// Cada vela y cada calabaza encendida se apaga y se enciende tocándola, y se
// queda como la dejaste: va con la cuenta (una lista de las apagadas, en las
// preferencias), así que también se ve igual en el móvil y en el ordenador.
//
// Cada pieza tiene una `clave` fija: la del libro detrás del que está (o la
// estantería, o "inicio"/"menu"). Si ese libro se quita, su vela se va con él.
//
// Vela — al apagar, la llama se recoge, la luz se va y sube humo; al
// encender, la llama prende con un estirón. Con un leve balanceo.
// Calabaza — al apagar, un escalofrío y la cara se oscurece; al encender, da
// un saltito y la luz hace un fogonazo antes de quedarse. Sin humo.
// Todo con Web Animations: solo transform y opacity.
const CLAVE_APAGADAS = 'apagadas_halloween'

const MOVIMIENTO = {
  vela: {
    apagar: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-5deg)' }, { transform: 'rotate(3deg)' }, { transform: 'rotate(-1.5deg)' }, { transform: 'rotate(0deg)' }],
    encender: [{ transform: 'rotate(0deg)' }, { transform: 'rotate(3deg)' }, { transform: 'rotate(-2deg)' }, { transform: 'rotate(0deg)' }],
    dura: 520,
  },
  calabaza: {
    // Un escalofrío: tiembla de lado a lado, cada vez menos, y se encoge un poco.
    apagar: [
      { transform: 'translateX(0) scale(1)' }, { transform: 'translateX(-2px) scale(0.97, 0.95)' },
      { transform: 'translateX(2px) scale(0.97, 0.95)' }, { transform: 'translateX(-1.5px) scale(0.98, 0.96)' },
      { transform: 'translateX(1px) scale(0.99)' }, { transform: 'translateX(0) scale(1)' },
    ],
    // Un saltito: se agacha, sale estirada, cae y se aplasta al tocar la balda.
    encender: [
      { transform: 'translateY(0) scale(1, 1)' }, { transform: 'translateY(0) scale(1.08, 0.88)', offset: 0.15 },
      { transform: 'translateY(-14px) scale(0.94, 1.08)', offset: 0.45 }, { transform: 'translateY(0) scale(1.1, 0.9)', offset: 0.72 },
      { transform: 'translateY(0) scale(1, 1)' },
    ],
    dura: 600,
  },
}

function usarEncendida(tipo, clave) {
  const [apagadas, ponerApagadas] = usarPreferencia(CLAVE_APAGADAS, [])
  const encendida = !apagadas.includes(clave)
  const [humos, setHumos] = useState([])
  const pieza = useRef(null)
  const luz = useRef(null)
  const alternar = () => {
    const sigue = !encendida
    ponerApagadas(sigue ? apagadas.filter(c => c !== clave) : [...apagadas, clave])
    const m = MOVIMIENTO[tipo]
    pieza.current?.animate(sigue ? m.encender : m.apagar, { duration: m.dura, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
    if (tipo === 'vela' && !sigue) setHumos(h => [...h, Date.now()])
    // El fogonazo de la calabaza al encenderse: la luz sale más grande y
    // más fuerte y se asienta.
    if (tipo === 'calabaza' && sigue) {
      luz.current?.animate(
        [{ transform: 'scale(0.4)', opacity: 0 }, { transform: 'scale(1.35)', opacity: 1, offset: 0.4 }, { transform: 'scale(1)', opacity: 1 }],
        { duration: 700, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      )
    }
  }
  const quitarHumo = id => setHumos(h => h.filter(x => x !== id))
  return { encendida, alternar, humos, quitarHumo, pieza, luz }
}

// La luz, que entra y sale con un fundido por encima de su propio parpadeo.
// Ocupa la caja de la pieza para que el fogonazo crezca desde su centro.
function LuzQueSeApaga({ encendida, capa, ...props }) {
  return (
    <span
      ref={capa}
      className="pointer-events-none absolute inset-0"
      style={{ opacity: encendida ? 1 : 0, transition: `opacity ${encendida ? 520 : 260}ms ease-out` }}
    >
      <Luz {...props} />
    </span>
  )
}

const tocable = 'pointer-events-auto relative block h-full w-full origin-bottom [touch-action:manipulation]'

// `cera`: alto de la cera en unidades del dibujo (40 de alto); `h`/`w`, px.
function VelaEncendible({ clave, cera = 26, h = 52, w = 21, retraso = 0 }) {
  const { encendida, alternar, humos, quitarHumo, pieza, luz } = usarEncendida('vela', clave)
  const arriba = 40 - cera
  const llama = Math.round(((arriba - 6) / 40) * h)   // centro de la llama, desde arriba
  const mecha = Math.round(((arriba - 2) / 40) * h)
  return (
    <span className="relative inline-block shrink-0" style={{ width: w, height: h }}>
      <LuzQueSeApaga capa={luz} encendida={encendida} x="50%" y={llama} tam={h * 2.4} retraso={retraso} />
      <button ref={pieza} type="button" onClick={alternar} aria-label={encendida ? 'Apagar la vela' : 'Encender la vela'} className={tocable}>
        <Vela alto={cera} encendida={encendida} className="h-full w-full" />
      </button>
      {humos.map(id => (
        <Humo key={id} onFin={() => quitarHumo(id)} className="left-1/2" style={{ top: mecha }} />
      ))}
    </span>
  )
}

function CalabazaEncendible({ clave, ancho = 56, retraso = 0, luz: cuanta = 2.6 }) {
  const { encendida, alternar, pieza, luz } = usarEncendida('calabaza', clave)
  const h = Math.round(ancho * 40 / 48)
  return (
    <span className="relative inline-block shrink-0" style={{ width: ancho, height: h }}>
      <LuzQueSeApaga capa={luz} encendida={encendida} y="58%" tam={ancho * cuanta} retraso={retraso} />
      <button ref={pieza} type="button" onClick={alternar} aria-label={encendida ? 'Apagar la calabaza' : 'Encender la calabaza'} className={tocable}>
        <Calabaza encendida={encendida} className="h-full w-full" />
      </button>
    </span>
  )
}

// Lo que se apoya en la balda de la vista de lomos. `alto` es el de la fila
// (ALTO_FILA de Lomos.jsx): cada pieza ocupa una fila entera y se asienta
// abajo, como un libro más.
//
// La caja lleva z-index propio para que la luz se pinte por encima de los
// lomos de alrededor: es lo que hace que se vea que los ilumina. Ella misma no
// se puede tocar; las velas y calabazas sí.
function Hueco({ alto, children }) {
  return (
    <div className="pointer-events-none relative z-[1] flex items-end gap-0.5 px-1" style={{ height: alto }}>
      {children}
    </div>
  )
}

function DosVelas({ alto, clave, retraso = 0 }) {
  return (
    <Hueco alto={alto}>
      <VelaEncendible clave={`${clave}-a`} cera={26} retraso={retraso} />
      <VelaEncendible clave={`${clave}-b`} cera={18} retraso={retraso - 0.9} />
    </Hueco>
  )
}

function UnaVela({ alto, clave, retraso = 0 }) {
  return (
    <Hueco alto={alto}>
      <VelaEncendible clave={clave} cera={30} h={64} w={26} retraso={retraso} />
    </Hueco>
  )
}

function CalabazaEnLaBalda({ alto, clave, retraso = 0, ancho = 56 }) {
  return (
    <Hueco alto={alto}>
      <CalabazaEncendible clave={clave} ancho={ancho} retraso={retraso} />
    </Hueco>
  )
}

// Al final de cada estantería, la calabaza grande con una vela al lado.
//
// Solo si cabe detrás del último libro: si no, abriría una balda nueva solo
// para ella, y una balda vacía con una calabaza se ve como un hueco raro.
// Cuando no cabe se saca del reparto (absolute) y no se ve; se vuelve a mirar
// si cambia el ancho.
function Balda({ alto, clave }) {
  const caja = useRef(null)
  const [cabe, setCabe] = useState(true)
  useLayoutEffect(() => {
    const el = caja.current
    const padre = el?.parentElement
    if (!padre) return
    const medir = () => {
      const anterior = el.previousElementSibling
      if (!anterior) return setCabe(true)
      const estilo = getComputedStyle(padre)
      const hueco = parseFloat(estilo.columnGap) || 0
      const p = padre.getBoundingClientRect()
      const fin = anterior.getBoundingClientRect().right - p.left
      const libre = p.width - parseFloat(estilo.paddingRight || 0) - fin - hueco
      setCabe(libre >= el.offsetWidth)
    }
    medir()
    // No basta con vigilar la estantería: los lomos cambian de ancho cuando
    // llega su imagen, y la estantería puede seguir midiendo lo mismo. Pasaba
    // al abrir: con los anchos provisionales los libros ocupaban dos filas y
    // la calabaza cabía en la segunda; al llegar las imágenes cabían todos en
    // la primera y ella se quedaba sola abajo, sin que nada avisara (mismo
    // alto, mismo ancho). Así que se vigila también cada libro, y se vuelven
    // a vigilar si cambian (filtros, libros nuevos).
    const ro = new ResizeObserver(medir)
    const vigilar = () => {
      ro.disconnect()
      ro.observe(padre)
      for (const hijo of padre.children) if (hijo !== el) ro.observe(hijo)
    }
    vigilar()
    const mo = new MutationObserver(() => { vigilar(); medir() })
    mo.observe(padre, { childList: true })
    return () => { ro.disconnect(); mo.disconnect() }
  }, [])
  return (
    <div ref={caja} style={cabe ? undefined : { position: 'absolute', visibility: 'hidden' }}>
      <Hueco alto={alto}>
        <CalabazaEncendible clave={`${clave}-calabaza`} ancho={56} />
        <span className="-ml-1"><VelaEncendible clave={`${clave}-vela`} cera={22} h={44} w={18} retraso={-1.3} /></span>
      </Hueco>
    </div>
  )
}

// Entre los libros, de vez en cuando, algo apoyado. Siempre en los mismos
// sitios (sale de la posición del libro, no del azar), para que la balda no
// cambie cada vez que se abre. Pocas, para que no se coman la estantería.
// Memo: hay una por libro y casi todas no pintan nada.
const EntreLibros = memo(function EntreLibros({ indice, alto, clave }) {
  if (indice === 0) return null
  const retraso = -((indice * 0.37) % 2.8)   // que no parpadeen todas a la vez
  if (indice % 31 === 19) return <CalabazaEnLaBalda alto={alto} clave={`libro-${clave}`} ancho={44} retraso={retraso} />
  if (indice % 14 === 6) return <DosVelas alto={alto} clave={`libro-${clave}`} retraso={retraso} />
  if (indice % 23 === 12) return <UnaVela alto={alto} clave={`libro-${clave}`} retraso={retraso} />
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
  adornos: { fondo: Fondo, contenido: Contenido, cabecera: Cabecera, logo: Logo, menu: Menu, menuFondo: MenuFondo, inicio: Inicio, balda: Balda, entreLibros: EntreLibros },
}
