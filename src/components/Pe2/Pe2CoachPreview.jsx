import { evoBrand } from '../../constants/evoBrand.js'
import { projectConfirmedSessionsForCoach } from '../../domain/programming/coachSessionProjection.js'

function CoachSession({ session }) {
  return (
    <article className="rounded-xl border p-4" style={{ backgroundColor: '#FFFFFF', borderColor: evoBrand.border }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: evoBrand.accent }}>
            Día {session.weekday ?? '—'} · {session.classType}
          </p>
          <h3 className="mt-1 text-lg font-bold" style={{ color: evoBrand.text }}>{session.title}</h3>
        </div>
        <span className="rounded-full px-2 py-1 text-[10px] font-bold uppercase" style={{ backgroundColor: '#E9F8EF', color: '#18794E' }}>
          Confirmada
        </span>
      </div>

      {session.objective ? <p className="mt-3 text-sm font-semibold" style={{ color: evoBrand.text }}>{session.objective}</p> : null}
      {session.briefing ? <p className="mt-2 text-sm leading-6" style={{ color: evoBrand.muted }}>{session.briefing}</p> : null}

      <div className="mt-4 grid gap-3">
        {session.blocks.map((block) => (
          <div key={block.id} className="rounded-lg px-3 py-2" style={{ backgroundColor: '#FAF7FC' }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: evoBrand.text }}>
              {block.title}
            </p>
            {block.items.map((item) => (
              <p key={item.id} className="mt-1 text-sm" style={{ color: evoBrand.muted }}>
                {item.exerciseName}{item.prescription ? ` · ${item.prescription}` : ''}
              </p>
            ))}
          </div>
        ))}
      </div>
    </article>
  )
}

export default function Pe2CoachPreview({ sessions = [] }) {
  const confirmed = projectConfirmedSessionsForCoach(sessions)

  return (
    <section className="rounded-2xl border p-5" style={{ backgroundColor: '#F8F4FA', borderColor: evoBrand.border }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: evoBrand.accent }}>
        Revisar antes de compartir
      </p>
      <h2 className="mt-1 font-evo-display text-xl font-bold" style={{ color: evoBrand.text }}>
        Vista del entrenador
      </h2>
      <p className="mt-1 text-sm" style={{ color: evoBrand.muted }}>
        Esta es la lectura limpia de las sesiones confirmadas. Los borradores no aparecen para el equipo.
      </p>

      {confirmed.length ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {confirmed.map((session) => <CoachSession key={session.id} session={session} />)}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed px-4 py-5 text-sm" style={{ borderColor: evoBrand.border, color: evoBrand.muted }}>
          Aún no hay sesiones confirmadas. Cuando confirmes una sesión estructurada, aquí podrás revisar cómo se leerá para el entrenador antes de conectarla al espacio Coach.
        </div>
      )}
    </section>
  )
}
