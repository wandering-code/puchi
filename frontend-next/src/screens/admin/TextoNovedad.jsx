import { Fragment } from 'react'

// El texto de un aviso de novedades (#72), con lo justo de formato para que
// el admin lo escriba desde el móvil sin herramientas: una línea en blanco
// separa párrafos, las líneas que empiezan por "- " son una lista y
// **así** va en negrita. Nada más: ni HTML ni enlaces.

function enLinea(texto) {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((trozo, i) => (
    trozo.startsWith('**') && trozo.endsWith('**') && trozo.length > 4
      ? <strong key={i} className="font-semibold text-ink">{trozo.slice(2, -2)}</strong>
      : <Fragment key={i}>{trozo}</Fragment>
  ))
}

export default function TextoNovedad({ texto, className = '' }) {
  const bloques = (texto || '').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)
  return (
    <div className={`space-y-2.5 ${className}`}>
      {bloques.map((b, i) => {
        const lineas = b.split('\n')
        if (lineas.every(l => /^\s*[-•]\s+/.test(l))) {
          return (
            <ul key={i} className="space-y-1.5">
              {lineas.map((l, j) => (
                <li key={j} className="flex gap-2">
                  <span className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                  <span>{enLinea(l.replace(/^\s*[-•]\s+/, ''))}</span>
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i}>
            {lineas.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{enLinea(l)}</Fragment>)}
          </p>
        )
      })}
    </div>
  )
}
