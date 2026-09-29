import { coachBg, coachBorder, coachText, coachUi } from './coachTheme.js'

const TEAM_RESOURCES = [
  {
    title: 'Contenido y redes',
    detail: 'Ideas, guiones y materiales para preparar lo que te toque.',
    url: 'https://drive.google.com/drive/folders/1vfWNTdqdZ0U5w1UKLjf0B-SF7DjtFeep',
  },
  {
    title: 'Eventos y actividades',
    detail: 'Documentos y propuestas de las actividades del centro.',
    url: 'https://drive.google.com/drive/folders/1Yu-nguKmeOB8zSNF3gEp2ExTZPLtGwPr',
  },
]

/**
 * Tab «Perfil»: datos coach + accesos secundarios (sin nav inferior extra).
 */
export default function CoachProfilePanel({
  coachName,
  onOpenWeeklyCheckin,
  onNavigateLibrary,
  onNavigateAdaptations,
  onNavigateMesociclos,
  onNavigateMaterial,
  onNavigateCentro,
}) {
  return (
    <div className={`px-5 py-6 space-y-5 ${coachBg.app} max-w-2xl mx-auto`}>
      <div className={`coach-roster border ${coachBorder} ${coachUi.card} p-5`}>
        <p className={`text-[10px] font-bold uppercase tracking-widest ${coachText.muted}`}>Coach</p>
        <p className={`text-xl font-evo-display font-bold ${coachText.primary} mt-1`}>{coachName || '—'}</p>
      </div>

      <button
        type="button"
        onClick={onOpenWeeklyCheckin}
        className="coach-primary-button w-full text-left px-4 py-4 uppercase tracking-wide transition-colors"
      >
        Check-in semanal
      </button>

      <section className="coach-resource-hub border p-5" aria-label="Espacio de Dani">
        <p className="coach-eyebrow">Espacio de Dani</p>
        <h2 className={`mt-1 text-xl font-bold ${coachText.primary}`}>Todo en un mismo sitio</h2>
        <p className={`mt-2 text-sm leading-relaxed ${coachText.muted}`}>Tu programación vive en «Semana». Aquí tienes el resto de recursos del centro sin buscarlos por Drive.</p>
        <div className="mt-4 grid gap-3">
          {TEAM_RESOURCES.map((resource) => (
            <a key={resource.title} href={resource.url} target="_blank" rel="noreferrer" className="coach-resource-link">
              <span>
                <strong>{resource.title}</strong>
                <small>{resource.detail}</small>
              </span>
              <b aria-hidden>↗</b>
            </a>
          ))}
        </div>
        <p className={`mt-3 text-xs leading-relaxed ${coachText.muted}`}>Los enlaces respetan los permisos de Drive de cada cuenta.</p>
      </section>

      <div className={`rounded-xl border ${coachBorder} overflow-hidden`}>
        <p className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest ${coachText.muted} border-b ${coachBorder}`}>
          Más recursos
        </p>
        <button
          type="button"
          onClick={onNavigateLibrary}
        className={`w-full text-left px-4 py-3.5 text-sm font-semibold ${coachText.primary} border-b ${coachBorder} hover:bg-[#F6E8F9]`}
        >
          Biblioteca de ejercicios
        </button>
        <button
          type="button"
          onClick={onNavigateAdaptations}
        className={`w-full text-left px-4 py-3.5 text-sm font-semibold ${coachText.primary} border-b ${coachBorder} hover:bg-[#F6E8F9]`}
        >
          Método y adaptaciones
        </button>
        <button
          type="button"
          onClick={onNavigateMesociclos}
        className={`w-full text-left px-4 py-3.5 text-sm font-semibold ${coachText.primary} border-b ${coachBorder} hover:bg-[#F6E8F9]`}
        >
          Mesociclos
        </button>
        <button
          type="button"
          onClick={onNavigateMaterial}
        className={`w-full text-left px-4 py-3.5 text-sm font-semibold ${coachText.primary} border-b ${coachBorder} hover:bg-[#F6E8F9]`}
        >
          Material y contacto
        </button>
        <button
          type="button"
          onClick={onNavigateCentro}
        className={`w-full text-left px-4 py-3.5 text-sm font-semibold ${coachText.primary} hover:bg-[#F6E8F9]`}
        >
          Guía del centro
        </button>
      </div>
    </div>
  )
}
