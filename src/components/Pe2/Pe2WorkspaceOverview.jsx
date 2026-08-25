import { evoBrand } from '../../constants/evoBrand.js'

function WorkspaceCard({ eyebrow, title, children, action, muted = false }) {
  return (
    <section
      className={`rounded-3xl border p-6 sm:p-7 ${muted ? 'opacity-75' : ''}`}
      style={{ backgroundColor: evoBrand.surface, borderColor: `${evoBrand.purple}33` }}
    >
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8B388F]">{eyebrow}</p>
      <h2 className="mt-2 font-evo-display text-3xl font-black tracking-tight text-[#1A0A1A]">{title}</h2>
      <div className="mt-3 text-sm leading-6 text-[#5C4D5C]">{children}</div>
      {action ? <div className="mt-6">{action}</div> : null}
    </section>
  )
}

const primaryButton =
  'inline-flex items-center justify-center rounded-xl bg-[#A729AD] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#6A1F6D]'

const secondaryButton =
  'inline-flex items-center justify-center rounded-xl border border-[#6A1F6D]/30 bg-white px-5 py-3 text-sm font-bold text-[#6A1F6D] transition-colors hover:border-[#6A1F6D]'

export default function Pe2WorkspaceOverview({
  canManageProgramming,
  canManageIdentity,
  canAccessCoachWorkspace,
  onOpenPlanning,
  onOpenReview,
  onOpenTeam,
}) {
  return (
    <div className="mx-auto max-w-6xl pb-12">
      <header className="max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8B388F]">Programación EVO · espacio de trabajo</p>
        <h1 className="mt-3 font-evo-display text-4xl font-black tracking-tight text-[#1A0A1A] sm:text-5xl">
          Todo en su sitio, sin tocar lo publicado
        </h1>
        <p className="mt-4 text-base leading-7 text-[#5C4D5C]">
          Desde aquí eliges qué quieres hacer. La programación que ya está publicada permanece protegida: esta pantalla no la edita,
          no la reenvía y no cambia ninguna sesión.
        </p>
      </header>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {canManageProgramming ? (
          <WorkspaceCard
            eyebrow="Administración · próxima semana"
            title="Preparar con contexto"
            action={
              <button type="button" onClick={onOpenPlanning} className={primaryButton}>
                Preparar próxima semana
              </button>
            }
          >
            Crea o continúa un borrador semanal con el objetivo del ciclo, normas, material, referencias y notas para el equipo.
            Nada se publica desde este paso.
          </WorkspaceCard>
        ) : null}

        {canManageProgramming ? (
          <WorkspaceCard
            eyebrow="Administración · revisión"
            title="Revisar antes de compartir"
            action={
              <button type="button" onClick={onOpenReview} className={secondaryButton}>
                Abrir revisión semanal
              </button>
            }
          >
            Comprueba la vista estructurada y cómo se leería para los entrenadores. Confirmar o compartir seguirá siendo una decisión
            separada y visible.
          </WorkspaceCard>
        ) : null}

        {canManageIdentity ? (
          <WorkspaceCard
            eyebrow="Administración · equipo"
            title="Altas cuando estés lista"
            action={
              <button type="button" onClick={onOpenTeam} className={secondaryButton}>
                Gestionar equipo
              </button>
            }
          >
            Aquí podrás dar de alta, desactivar y reactivar entrenadores. No se envía ninguna invitación ni se cambia ningún acceso
            hasta que tú lo decidas.
          </WorkspaceCard>
        ) : null}

        {canAccessCoachWorkspace ? (
          <WorkspaceCard
            eyebrow="Coach · lectura operativa"
            title="Ver el turno del equipo"
            action={
              <a href="/?coach" className={secondaryButton}>
                Abrir espacio Coach
              </a>
            }
          >
            Consulta el trabajo que el equipo recibe. La vista Coach no muestra borradores: sólo programación confirmada por
            Administración.
          </WorkspaceCard>
        ) : null}
      </div>

      <section
        className="mt-8 rounded-3xl border px-6 py-5"
        style={{ backgroundColor: '#FFFBE7', borderColor: '#E5D687' }}
      >
        <p className="text-sm font-black text-[#4D3A00]">Semana publicada: protegida</p>
        <p className="mt-1 text-sm leading-6 text-[#66531A]">
          Durante esta semana trabajaremos únicamente con borradores y vistas de consulta. La semana visible para el equipo no se
          modifica desde aquí.
        </p>
      </section>
    </div>
  )
}
