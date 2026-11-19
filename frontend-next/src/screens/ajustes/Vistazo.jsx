import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../platform/auth'
import { api } from '../../platform/api'
import { recordado, recordar } from '../../platform/memoria'
import { usarPreferencia } from '../../platform/preferencias'
import { Cifras, Coleccion, Herramientas, LibrosLeyendo } from '../luniteca/Luniteca'
import { LunaDelPanel, usarPanel } from '../luniteca/panel'
import { CajaSeccion, TituloSeccion, huecoEntreSecciones, usarSeparacion } from '../luniteca/separacion'
import { generosDeAutores } from '../luniteca/shelf'

// La vista previa de Ajustes: un trozo de TU Luniteca, con tus libros, pintado
// con las mismas piezas que la de verdad (cabecera, barra, secciones, lomos o
// portadas), así que lo que se ve aquí es exactamente lo que se verá allí.
// Cambia en cuanto se toca una opción: todas son preferencias de la cuenta o
// variables de :root que ya lee la app entera.
//
// Va a escala y sin poder tocarse (inert): se pinta a un ancho de pantalla
// más grande y se encoge, para que quepan la cabecera y una sección y media
// en el hueco. Fija arriba mientras se recorren las opciones de debajo.
const ESCALA = 0.6
const ALTO = 300
const nada = () => {}

export default function Vistazo() {
  const { player } = useAuth()
  const clave = `luniteca:${player.id}`
  const [shelf, setShelf] = useState(() => recordado(clave) ?? null)
  useEffect(() => {
    if (shelf) return
    let vivo = true
    api(`/shelf/personal?player_id=${player.id}`)
      .then(d => { if (!vivo) return; const l = Array.isArray(d) ? d : []; recordar(clave, l); setShelf(l) })
      .catch(() => { if (vivo) setShelf([]) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const caja = useRef(null)
  const [ancho, setAncho] = useState(0)
  useLayoutEffect(() => {
    const el = caja.current
    if (!el) return
    const medir = () => setAncho(el.clientWidth)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="sticky top-0 z-20 -mx-5 bg-bg px-5 pb-3 pt-3">
      <div ref={caja} className="relative overflow-hidden rounded-xl3 border border-line bg-bg sombra-pastilla" style={{ height: ALTO }}>
        {ancho > 0 && shelf && (
          <div
            inert
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 origin-top-left px-5"
            style={{ width: ancho / ESCALA, transform: `scale(${ESCALA})` }}
          >
            <MiniLuniteca shelf={shelf} />
          </div>
        )}
        {/* Que se lea como lo que es: una muestra, no la pantalla de verdad. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-bg to-transparent" />
        <span className="pointer-events-none absolute bottom-2.5 right-3 rounded-full border border-line bg-surface px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-mute">
          Vista previa
        </span>
      </div>
    </div>
  )
}

function MiniLuniteca({ shelf }) {
  // usarPanel sin colgarle la raíz (raiz): así no le cambia el fondo a la
  // pantalla de Ajustes, que es lo que hace en la Luniteca de verdad.
  const panel = usarPanel(true)
  const [separacion] = usarSeparacion()
  const [vista] = usarPreferencia('vista', 'grid')
  const generos = useMemo(() => generosDeAutores(shelf), [shelf])
  const { leyendo, leidos } = useMemo(() => {
    const leyendo = shelf.filter(e => e.status === 'reading' || e.status === 'rereading').slice(0, 6)
    const leidos = shelf
      .filter(e => e.status === 'read')
      .sort((a, b) => String(b.finished_at || '').localeCompare(String(a.finished_at || '')))
      .slice(0, 10)
    return { leyendo, leidos }
  }, [shelf])

  return (
    <div className={panel.claseRaiz}>
      <header className={panel.claseCabecera}>
        <LunaDelPanel conPanel={panel.conPanel} />
        <h2 className="relative font-display text-[1.75rem] font-bold tracking-[-0.02em]">Luniteca</h2>
        <p className="relative mt-1 text-sm text-ink-dim">
          {shelf.length} {shelf.length === 1 ? 'libro' : 'libros'} en tu estantería
        </p>
        {shelf.length > 0 && <Cifras shelf={shelf} onIr={nada} />}
      </header>
      <Herramientas
        panel={panel.barra}
        vista={vista} onVista={nada}
        query="" onQuery={nada}
        onAbrirHoja={nada} onAnadir={nada}
        ordenActivo={false} filtrosActivos={false}
      />
      <div className={`mt-5 ${huecoEntreSecciones(separacion)}`}>
        {leyendo.length > 0 && (
          <CajaSeccion variante={separacion} estado="reading">
            <TituloSeccion variante={separacion} desde={panel.desdeTitulos} label="Leyendo" cuenta={leyendo.length} estado="reading" />
            <LibrosLeyendo entries={leyendo} vista={vista} onAbrir={nada} generosDeAutor={generos} />
          </CajaSeccion>
        )}
        {leidos.length > 0 && (
          <CajaSeccion variante={separacion} estado="read">
            <TituloSeccion variante={separacion} desde={panel.desdeTitulos} label="Leídos" cuenta={leidos.length} estado="read" plegada={false} onAlternar={nada} />
            <div className="pt-3">
              <Coleccion entries={leidos} vista={vista} onAbrir={nada} generosDeAutor={generos} />
            </div>
          </CajaSeccion>
        )}
      </div>
    </div>
  )
}
