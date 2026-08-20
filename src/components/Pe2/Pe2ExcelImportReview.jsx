import { useState } from 'react'
import { evoBrand } from '../../constants/evoBrand.js'

export default function Pe2ExcelImportReview({ review }) {
  const [selectedId, setSelectedId] = useState(() => review?.sessions?.[0]?.sourceId || null)
  const selected = review?.sessions?.find((session) => session.sourceId === selectedId) || review?.sessions?.[0]

  if (!review) return null

  return (
    <div className="mt-4 rounded-xl border p-4" style={{ borderColor: evoBrand.border, backgroundColor: '#FAF7FC' }}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="text-sm font-bold" style={{ color: evoBrand.text }}>Resultado de la revisión</p>
        <p className="text-xs" style={{ color: evoBrand.muted }}>{review.fileName}</p>
      </div>
      <p className="mt-2 text-sm" style={{ color: evoBrand.text }}>
        <strong>{review.summary.totalSessions}</strong> sesiones detectadas en <strong>{review.summary.daysRecognized}</strong> días · <strong>{review.summary.feedbackIncluded}</strong> con feedback.
      </p>
      <p className="mt-1 text-xs" style={{ color: evoBrand.muted }}>
        Este es solo un control de lectura. Aún no hay cambios guardados ni publicaciones.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="grid max-h-72 gap-2 overflow-auto pr-1">
          {review.sessions.map((session) => {
            const active = session.sourceId === selected?.sourceId
            return (
              <button
                key={session.sourceId}
                type="button"
                onClick={() => setSelectedId(session.sourceId)}
                className="rounded-lg border px-3 py-2 text-left text-sm"
                style={{
                  borderColor: active ? evoBrand.accent : evoBrand.border,
                  backgroundColor: active ? '#FFFFFF' : 'transparent',
                  color: evoBrand.text,
                }}
              >
                <strong className="block">{session.title}</strong>
                <span className="text-xs" style={{ color: evoBrand.muted }}>{session.feedback ? 'Incluye feedback' : 'Sin feedback'}</span>
              </button>
            )
          })}
        </div>

        {selected ? (
          <article className="rounded-lg border bg-white p-3" style={{ borderColor: evoBrand.border }}>
            <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: evoBrand.accent }}>{selected.classType}</p>
            <h3 className="mt-1 text-base font-bold" style={{ color: evoBrand.text }}>{selected.title}</h3>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em]" style={{ color: evoBrand.muted }}>Programación</p>
            <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap font-sans text-sm leading-6" style={{ color: evoBrand.text }}>{selected.programming}</pre>
            {selected.feedback ? (
              <>
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em]" style={{ color: evoBrand.muted }}>Feedback del entrenador</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6" style={{ color: evoBrand.text }}>{selected.feedback}</p>
              </>
            ) : null}
          </article>
        ) : null}
      </div>

      {review.warnings.length ? (
        <p className="mt-3 text-xs" style={{ color: '#B54708' }}>{review.warnings.length} aviso(s) de lectura. Se revisarán antes de una importación definitiva.</p>
      ) : null}
    </div>
  )
}
