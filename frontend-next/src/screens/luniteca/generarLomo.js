import { api } from '../../platform/api'
import { colorDePortada } from './colorPortada'
import { medidas } from './Lomos'

// Genera la imagen de un lomo y la sube — mismo dibujo que ve quien mira la
// balda (Lomos.jsx, capasDeFondo), pero hecho UNA vez en un <canvas> en vez
// de recomponerlo cada vez que se pinta. El título y el autor NO van dentro
// de la imagen: siguen siendo el texto vivo de siempre, puesto encima
// (Lomos.jsx ya lo hace así cuando `spine_custom` es falso) — así no hace
// falta reproducir aquí la tipografía vertical, que es lo más delicado de
// cuadrar, y el texto sigue siendo accesible. La imagen lleva solo lo que
// era caro de pintar en vivo: el color, la portada, el relieve y la
// textura con blend-mode.
//
// Se llama sola al añadir un libro con portada, o al ponerle/cambiarle la
// portada (ver Luniteca.jsx) — nunca hace falta pedirlo a mano. Si algo
// falla (portada de otro origen que el navegador no deja leer, red caída),
// no pasa nada: el libro se queda sin `spine_url` y Lomos.jsx lo sigue
// dibujando en vivo como hace hoy con todos. Nunca debe romper el alta ni
// la edición de un libro por esto.
//
// IMPORTANTE: los números de cada capa (colores, degradados, posiciones)
// tienen que seguir siendo los mismos que capasDeFondo() en Lomos.jsx — si
// se retoca el aspecto del lomo ahí, hay que retocarlo aquí también, o los
// libros ya generados dejarán de parecerse a los que se dibujan en vivo.

const FRANJA = 0.04 // igual que Lomos.jsx: el 4% izquierdo de la portada

function cargarImagen(url) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    // Portada de otro origen sin CORS, red caída, lo que sea: sin imagen,
    // no sin lomo entero.
    img.onerror = () => resolve(null)
    img.src = url
  })
}

// Cabezada y nervios son franjas finas que en CSS salen de un
// repeating-linear-gradient / linear-gradient — en canvas se pintan a mano,
// franja a franja, porque no hay un equivalente directo de una sola llamada.
function pintarCabezada(ctx, ancho, alto, arriba) {
  const y = arriba ? 1 : alto - 3
  const x0 = 1, ancho2 = ancho - 2
  for (let x = 0; x < ancho2; x++) {
    ctx.fillStyle = x % 2 === 0 ? 'rgba(238,226,205,.209)' : 'rgba(155,115,90,.171)'
    ctx.fillRect(x0 + x, y, 1, 2)
  }
}

function pintarNervio(ctx, ancho, y) {
  const g = ctx.createLinearGradient(0, y, 0, y + 4)
  g.addColorStop(0, 'rgba(255,255,255,.16)')
  g.addColorStop(1, 'rgba(0,0,0,.28)')
  ctx.fillStyle = g
  ctx.fillRect(0, y, ancho, 4)
}

// El grano de textura: la MISMA svg que usa Lomos.jsx (capasDeFondo,
// TEXTURA_LOMO), cargada una vez y reutilizada para todos los lomos que se
// generen en la misma sesión.
let texturaCargada = null
function cargarTextura() {
  if (!texturaCargada) {
    texturaCargada = cargarImagen(
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='64' height='64' filter='url(%23n)' opacity='0.108'/%3E%3C/svg%3E",
    )
  }
  return texturaCargada
}

// Dibuja el lomo en un <canvas> ya creado, del tamaño que le toque (sin
// escalar todavía — eso lo hace quien llama, con el contexto ya escalado a
// la resolución que quiera). Misma firma de datos que capasDeFondo.
async function dibujar(ctx, { libro, paleta, claro, color, ancho, alto, conNervios, tapaDura }) {
  ctx.fillStyle = paleta?.color || color
  ctx.fillRect(0, 0, ancho, alto)

  if (libro.cover_url) {
    const img = await cargarImagen(libro.cover_url)
    if (img) {
      try {
        ctx.drawImage(img, 0, 0, Math.max(1, img.width * FRANJA), img.height, 0, 0, ancho, alto)
      } catch {
        // Canvas "manchado" (portada de origen sin CORS colada por aquí):
        // se sigue sin la portada, con el color liso ya pintado arriba.
      }
    }
    if (paleta) {
      ctx.fillStyle = paleta.color
      ctx.globalAlpha = 0.45
      ctx.fillRect(0, 0, ancho, alto)
      ctx.globalAlpha = 1
    }
    ctx.fillStyle = claro ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.2)'
    ctx.fillRect(0, 0, ancho, alto)
  }

  const volumen = ctx.createLinearGradient(0, 0, ancho, 0)
  volumen.addColorStop(0, 'rgba(0,0,0,.35)')
  volumen.addColorStop(0.28, 'rgba(255,255,255,.10)')
  volumen.addColorStop(0.62, 'rgba(0,0,0,.10)')
  volumen.addColorStop(1, 'rgba(0,0,0,.32)')
  ctx.fillStyle = volumen
  ctx.fillRect(0, 0, ancho, alto)

  ;[6, 9, alto - 10, alto - 7].forEach((y, i) => {
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.3)'
    ctx.fillRect(0, y, ancho, 1)
  })

  if (tapaDura) {
    pintarCabezada(ctx, ancho, alto, true)
    pintarCabezada(ctx, ancho, alto, false)
  }
  if (conNervios) {
    for (const p of [0.34, 0.5, 0.66]) pintarNervio(ctx, ancho, Math.round(p * alto))
  }

  const textura = await cargarTextura()
  if (textura) {
    ctx.globalCompositeOperation = 'overlay'
    for (let y = 0; y < alto; y += 64) {
      for (let x = 0; x < ancho; x += 64) ctx.drawImage(textura, x, y, 64, 64)
    }
    ctx.globalCompositeOperation = 'source-over'
  }
}

// Sube el PNG generado y devuelve { spine_url, spine_custom }, o null si no
// se ha podido generar (sin portada, imagen no legible, fallo de red) — en
// ese caso simplemente no se manda nada y el libro se queda dibujándose en
// vivo, como hasta ahora.
export async function generarYSubirLomo(bookId, entry, generoDelAutor = null) {
  const libro = entry.book
  const { ancho, alto, color, tapaDura } = medidas(entry, generoDelAutor)
  const paleta = libro.cover_url ? await colorDePortada(libro.cover_url) : null
  const claro = paleta ? paleta.luz >= 58 : false

  // ×2 para que no se vea borroso en pantallas retina — un lomo mide pocos
  // píxeles CSS, así que ni siquiera a ×3 pesa nada.
  const escala = 2
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.round(ancho * escala)
  lienzo.height = Math.round(alto * escala)
  const ctx = lienzo.getContext('2d')
  ctx.scale(escala, escala)

  await dibujar(ctx, { libro, paleta, claro, color, ancho, alto, conNervios: tapaDura, tapaDura })

  // JPEG y no PNG: la textura de grano es ruido, que el PNG comprime fatal
  // (unos 60 KB por lomo, 4 MB una balda de 90). En JPEG al 90% son unos
  // 10 KB y no se distingue ni ampliado. No lleva transparencia: el lienzo
  // se pinta entero y las esquinas redondas las pone el CSS.
  const blob = await new Promise(res => lienzo.toBlob(res, 'image/jpeg', 0.9))
  if (!blob) return null

  const datos = new FormData()
  datos.append('file', blob, 'lomo.jpg')
  try {
    const { url } = await api(`/books/${bookId}/spine?generado=true`, { method: 'POST', body: datos })
    return { spine_url: url, spine_custom: false }
  } catch {
    // Sin conexión, backend caído: el libro se queda sin lomo generado por
    // ahora. No es motivo para interrumpir nada de lo que se estaba haciendo.
    return null
  }
}
