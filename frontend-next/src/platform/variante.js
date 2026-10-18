// Qué Puchi es esta: la de siempre (raíz) o la de prueba de audiolibros
// (/kokito, `npm run build:kokito`). Mismo código; lo de audiolibros solo se
// enseña en /kokito hasta que esté listo para todos.
export const ES_KOKITO = import.meta.env.MODE === 'kokito'

// Los audiolibros (escuchar, pedir, leer el texto, avisos), en las dos desde
// el 2026-10-18, cuando pasaron a producción. ES_KOKITO queda solo para lo que
// distingue la app de prueba (su nombre y la etiqueta "Kokito" de arriba).
// Para volver atrás: false aquí, o desplegar el tag produccion-antes-audiolibros.
export const CON_AUDIOLIBROS = true
