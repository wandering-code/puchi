import { ponerBarraDelEvento } from '../platform/tema'
import halloween from './halloween'

// Eventos de temporada: Halloween, y los que vengan (Navidad, el aniversario
// del club…). Cada uno es una carpeta aquí al lado con tres cosas:
//
//   index.jsx  la ficha del evento: nombre, cuándo está puesto, el color de la
//              barra de estado y sus `adornos` (ver más abajo).
//   *.css      su paleta, como una capa encima del tema de cada uno:
//              `:root[data-evento="<id>"]` para el claro y
//              `:root[data-evento="<id>"][data-tema="oscuro"]` para el oscuro.
//              Así el evento se adapta al tema elegido en vez de sustituirlo.
//   piezas     los dibujos (SVG) que pone en cada sitio de la app.
//
// Para añadir uno: copiar la carpeta de halloween, cambiarle id, fechas,
// paleta y piezas, e importarlo en EVENTOS. Nada más: Ajustes, el interruptor,
// la paleta y los sitios donde se cuelgan los adornos ya lo recogen solos.
//
// Los sitios donde un evento puede colgar algo (ver <Adorno sitio="…">):
//   fondo      capa fija a la pantalla, por encima del contenido y sin
//              poder tocarse (telarañas en las esquinas…). También en el login.
//   contenido  capa pegada a la PÁGINA: se va con el scroll (murciélagos).
//              Recibe `alto`, lo que mide el contenido. También en el login.
//   cabecera   colgando de la barra de arriba.
//   logo       encima del logo, allí donde salga (menú, Inicio, login, splash).
//   menu       debajo del nombre "Puchi" en el menú lateral.
//   menuFondo  dentro del panel del menú, detrás de las entradas.
//   inicio     una tarjeta al principio de Inicio.
//   balda      lo que se apoya al final de la estantería de lomos.
//   entreLibros  se llama detrás de CADA lomo con su `indice`; devuelve algo
//              solo en los sitios que quiera (velas cada tantos libros…).
//              Detrás del último libro no se llama: ese sitio es de `balda`.
// Un evento no tiene por qué llenarlos todos: el que no traiga, no se pinta.
export const EVENTOS = [halloween]

// "MM-DD" → número comparable (1031 para el 31 de octubre).
const dia = mmdd => Number(mmdd.replace('-', ''))

// ¿Cae `fecha` dentro de la temporada del evento? Las fechas son de calendario,
// sin año, así que vale cada año sin tocar nada. Una temporada puede cruzar el
// fin de año (Navidad: 12-01 → 01-06).
export function enTemporada(evento, fecha = new Date()) {
  const hoy = (fecha.getMonth() + 1) * 100 + fecha.getDate()
  const desde = dia(evento.desde)
  const hasta = dia(evento.hasta)
  return desde <= hasta ? hoy >= desde && hoy <= hasta : hoy >= desde || hoy <= hasta
}

// Para probar un evento fuera de su fecha (o ver la app sin ninguno):
// `?evento=halloween` o `?evento=ninguno` en la URL. Dura lo que la pestaña.
const CLAVE_FORZADO = 'puchi_evento_forzado'
function forzado() {
  try {
    const pedido = new URLSearchParams(location.search).get('evento')
    if (pedido) sessionStorage.setItem(CLAVE_FORZADO, pedido)
    return sessionStorage.getItem(CLAVE_FORZADO)
  } catch {
    return null
  }
}

// El evento de ahora, se haya apagado o no su decoración (eso es cosa de cada
// uno, ver usarEvento). Se calcula una vez al abrir la app: que cambie a
// medianoche con la app abierta no merece la pena.
function deTemporada() {
  const f = forzado()
  if (f === 'ninguno') return null
  if (f) return EVENTOS.find(e => e.id === f) || null
  return EVENTOS.find(e => enTemporada(e)) || null
}
export const EVENTO_DE_TEMPORADA = deTemporada()

// Si cada uno quiere la decoración o no va con la cuenta (usarPreferencia),
// pero la cuenta tarda en llegar. Esta copia local es solo para acertar en el
// primer fotograma —splash y login incluidos—, igual que la del tema.
const CLAVE_COPIA = 'puchi_decoracion'
function copia() {
  try { return JSON.parse(localStorage.getItem(CLAVE_COPIA)) || {} } catch { return {} }
}
export function decoracionGuardada(evento) {
  const v = copia()[evento.id]
  return v === undefined ? true : v !== false
}
function guardarCopia(evento, puesta) {
  try { localStorage.setItem(CLAVE_COPIA, JSON.stringify({ ...copia(), [evento.id]: puesta })) } catch { /* Safari privado */ }
}

// Pone el evento (o ninguno) en el documento: la paleta sale del CSS del
// evento a partir de este atributo, y la barra de estado se tiñe a juego.
export function aplicarEvento(evento, puesta) {
  if (evento) guardarCopia(evento, puesta)
  const activo = evento && puesta ? evento : null
  if (activo) document.documentElement.dataset.evento = activo.id
  else delete document.documentElement.dataset.evento
  ponerBarraDelEvento(activo?.barra)
  return activo
}
