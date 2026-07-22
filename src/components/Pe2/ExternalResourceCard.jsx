import { useState } from 'react'
import { evoBrand } from '../../constants/evoBrand.js'

export default function ExternalResourceCard({ resource, compact = false }) {
  const [error, setError] = useState('')

  function handleOpen() {
    setError('')
    const opened = window.open(resource.url, '_blank')
    if (!opened) {
      setError('No se ha podido abrir. Permite las ventanas emergentes e inténtalo de nuevo.')
      return
    }
    opened.opener = null
  }

  return (
    <article
      className={`rounded-2xl border ${compact ? 'p-4' : 'p-5'} flex flex-col`}
      style={{ backgroundColor: evoBrand.card, borderColor: `${evoBrand.purple}33` }}
    >
      <div className="flex-1">
        {resource.status ? (
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: evoBrand.purple }}>
            {resource.status}
          </p>
        ) : null}
        <h2 className="font-evo-display text-lg font-bold" style={{ color: evoBrand.text }}>
          {resource.title}
        </h2>
        {resource.description ? (
          <p className="text-sm leading-relaxed mt-2" style={{ color: evoBrand.muted }}>
            {resource.description}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={handleOpen}
        className="mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors hover:bg-black/5"
        style={{ borderColor: `${evoBrand.purple}55`, color: evoBrand.purple }}
      >
        {resource.label} <span aria-hidden>↗</span>
      </button>

      {error ? (
        <p role="alert" className="mt-3 text-xs leading-relaxed" style={{ color: '#991B1B' }}>
          {error}
        </p>
      ) : null}
    </article>
  )
}
