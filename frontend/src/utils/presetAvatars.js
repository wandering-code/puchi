// Galería de avatares de prueba (ilustraciones originales, sin fotos de
// terceros) — usada tanto en el registro de cuenta como en Ajustes, para no
// duplicar la lista en dos sitios como pasaba antes con los emojis.
//
// `url` es lo que se GUARDA como avatar_url: siempre absoluto desde la raíz,
// porque así están las cuentas que ya existen y así lo sirve nginx para las
// dos Puchis (la nueva vive en la raíz y también trae su propia copia de
// estos SVG). Como esta app vive bajo /v1/, para ENSEÑARLOS aquí hace falta
// la copia local de esta app — de ahí `verLocal`, con BASE_URL. Mismo patrón
// que frontend-next/src/screens/Registro.jsx (guardar/ver), por el mismo
// motivo.
const IDS = [
  ['cat-surprised',  'Gato sorprendido'],
  ['dog-happy',      'Perro feliz'],
  ['panda-sleepy',   'Panda dormido'],
  ['octopus-cool',   'Pulpo con gafas'],
  ['owl-drowsy',     'Búho despistado'],
  ['frog-nervous',   'Rana nerviosa'],
  ['potato-happy',   'Patata feliz'],
  ['ghost-cheeky',   'Fantasma burlón'],
  ['cactus-cool',    'Cactus con gafas'],
  ['egg-happy',      'Huevo frito feliz'],
]

export const PRESET_AVATARS = IDS.map(([id, label]) => ({
  id,
  label,
  url: `/avatars/${id}.svg`,
  verLocal: `${import.meta.env.BASE_URL}avatars/${id}.svg`,
}))
