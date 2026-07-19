// Un item de fondo de pantalla (tabla shop_items, type="wallpaper") puede
// traer un gradiente CSS (los 8 de fábrica) o una imagen subida por el admin
// — esto resuelve cualquiera de los dos a un valor válido para `background`.
export function wallpaperCss(item) {
  if (!item) return null
  if (item.data?.image_url) return `center / cover no-repeat url(${item.data.image_url})`
  return item.data?.bg ?? null
}
