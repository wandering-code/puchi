// Cómo se dicen las cifras de un audiolibro.

// Minutos → "45 min", "3 h 05 min", "12 h". La duración es una estimación
// (palabras entre la velocidad de lectura de Higgs, ver audiolibros.py), así
// que no se finge más precisión que el minuto.
export function duracion(minutos) {
  if (!minutos) return 'menos de 1 min'
  if (minutos < 60) return `${minutos} min`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m ? `${h} h ${String(m).padStart(2, '0')} min` : `${h} h`
}

export function palabras(n) {
  // useGrouping 'always': en español el separador de miles no sale con cuatro
  // cifras ("7717"), y en una lista de capítulos se lee mejor "7.717".
  return `${n.toLocaleString('es-ES', { useGrouping: 'always' })} ${n === 1 ? 'palabra' : 'palabras'}`
}

// Para los recuadros pequeños de cifras: "30 h 49 m" cabe en una línea.
export function duracionCorta(minutos) {
  if (minutos < 60) return duracion(minutos)
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m ? `${h} h ${m} m` : `${h} h`
}

export function capitulos(n) {
  return `${n} ${n === 1 ? 'capítulo' : 'capítulos'}`
}

// Segundos → "4:05", "1:02:33", para la posición de un reproductor.
export function reloj(s) {
  if (!Number.isFinite(s)) return '–:–'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const seg = String(Math.floor(s % 60)).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${seg}` : `${m}:${seg}`
}

// Cómo se llama cada estado de un audiolibro en pantalla.
export const ESTADOS_AB = {
  borrador:  'Borrador',
  en_cola:   'En cola',
  generando: 'Generando',
  pausado:   'Pausado',
  listo:     'Listo',
  error:     'Con fallos',
}

// "hace 3 días", como en Actividad.
export function haceCuanto(iso) {
  if (!iso) return ''
  const min = Math.floor(Math.max(0, Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'ahora mismo'
  if (min < 60) return `hace ${min} min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  const semanas = Math.floor(dias / 7)
  if (semanas < 5) return `hace ${semanas} ${semanas === 1 ? 'semana' : 'semanas'}`
  const meses = Math.floor(dias / 30)
  return meses < 12 ? `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}` : 'hace más de un año'
}

// "Ana", "Ana y Luis", "Ana, Luis y 3 más".
export function nombres(lista) {
  if (lista.length <= 2) return lista.join(' y ')
  return `${lista.slice(0, 2).join(', ')} y ${lista.length - 2} más`
}
