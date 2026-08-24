import { useMemo } from 'react'
import { evoBrand } from '../../constants/evoBrand.js'

function sessionsForReview(plan) {
  return Array.isArray(plan?.sessions) ? [...plan.sessions] : []
}

function groupByDay(sessions) {
  const groups = new Map()
  for (const session of sessions) {
    const key = `${session.weekday || 99}-${session.dayName || 'Sin día'}`
    const group = groups.get(key) || { weekday: session.weekday, dayName: session.dayName || 'Sin día', sessions: [] }
    group.sessions.push(session)
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => Number(a.weekday || 99) - Number(b.weekday || 99))
}

export default function Pe2WeeklyTeamReview({
  plan,
  prepared = false,
  saving = false,
  onPrepare,
  onReturnToDraft,
}) {
  const days = useMemo(() => groupByDay(sessionsForReview(plan)), [plan])

  if (!plan) return null

  return (
    <section className="rounded-2xl border p-5" style={{ backgroundColor: '#F8F4FA', borderColor: evoBrand.border }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: evoBrand.accent }}>
            Revisión del equipo
          </p>
          <h2 className="mt-1 font-evo-display text-xl font-bold" style={{ color: evoBrand.text }}>
            Vista limpia para entrenadores
          </h2>
          <p className="mt-1 max-w-2xl text-sm" style={{ color: evoBrand.muted }}>
            Revisa exactamente el contenido semanal que recibirá el equipo: programación y notas de cada clase.
            {prepared
              ? ' Está preparada para el siguiente paso de conexión, pero todavía no se ha publicado ni enviado.'
              : ' Aún es privada: prepararla no avisa ni da acceso a ningún entrenador.'}
          </p>
        </div>
        {prepared ? (
          <button
            type="button"
            onClick={onReturnToDraft}
            disabled={saving}
            className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-60"
            style={{ borderColor: evoBrand.accent, color: evoBrand.accent }}
          >
            Volver a edición privada
          </button>
        ) : (
          <button
            type="button"
            onClick={onPrepare}
            disabled={saving}
            className="rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            style={{ backgroundColor: evoBrand.accent }}
          >
            {saving ? 'Preparando…' : 'Preparar revisión del equipo'}
          </button>
        )}
      </div>

      {prepared ? (
        <span className="mt-4 inline-flex rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: '#E9F8EF', color: '#18794E' }}>
          Revisión preparada · aún privada
        </span>
      ) : null}

      <div className="mt-5 grid gap-4">
        {days.map((day) => (
          <div key={`${day.weekday}-${day.dayName}`} className="rounded-xl border p-4" style={{ backgroundColor: '#FFFFFF', borderColor: evoBrand.border }}>
            <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: evoBrand.accent }}>
              {day.dayName}
            </p>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {day.sessions.map((session) => (
                <article key={session.sourceId} className="rounded-lg p-3" style={{ backgroundColor: '#FAF7FC' }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: evoBrand.accent }}>
                    {session.classType}
                  </p>
                  <h3 className="mt-1 text-base font-bold" style={{ color: evoBrand.text }}>{session.title || 'Clase sin título'}</h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6" style={{ color: evoBrand.muted }}>
                    {session.programming || 'Programación pendiente.'}
                  </p>
                  {session.feedback ? (
                    <div className="mt-3 border-t pt-3" style={{ borderColor: evoBrand.border }}>
                      <p className="text-xs font-bold" style={{ color: evoBrand.text }}>Nota para el entrenador</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6" style={{ color: evoBrand.muted }}>{session.feedback}</p>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
