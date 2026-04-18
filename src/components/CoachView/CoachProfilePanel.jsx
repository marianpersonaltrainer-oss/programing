import { coachBg, coachBorder, coachText, coachUi } from './coachTheme.js'

/**
 * Tab «Perfil»: datos coach + accesos secundarios (sin nav inferior extra).
 */
export default function CoachProfilePanel({
  coachName,
  onOpenWeeklyCheckin,
  onNavigateLibrary,
  onNavigateMesociclos,
  onNavigateMaterial,
  onNavigateCentro,
}) {
  return (
    <div className={`px-4 py-6 space-y-6 ${coachBg.app} max-w-lg mx-auto`}>
      <div className={`rounded-xl border ${coachBorder} ${coachUi.card} p-5`}>
        <p className={`text-[10px] font-bold uppercase tracking-widest ${coachText.muted}`}>Coach</p>
        <p className={`text-xl font-evo-display font-bold text-white mt-1`}>{coachName || '—'}</p>
      </div>

      <button
        type="button"
        onClick={onOpenWeeklyCheckin}
        className="w-full text-left rounded-xl border border-[#6A1F6D]/50 bg-[#1a0f1b] px-4 py-4 font-evo-display text-sm font-bold uppercase tracking-wide text-[#FFFF4C] hover:bg-[#221427] transition-colors"
      >
        Check-in semanal
      </button>

      <div className={`rounded-xl border ${coachBorder} overflow-hidden`}>
        <p className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest ${coachText.muted} border-b ${coachBorder}`}>
          Más recursos
        </p>
        <button
          type="button"
          onClick={onNavigateLibrary}
          className={`w-full text-left px-4 py-3.5 text-sm font-semibold ${coachText.primary} border-b ${coachBorder} hover:bg-white/5`}
        >
          Biblioteca de ejercicios
        </button>
        <button
          type="button"
          onClick={onNavigateMesociclos}
          className={`w-full text-left px-4 py-3.5 text-sm font-semibold ${coachText.primary} border-b ${coachBorder} hover:bg-white/5`}
        >
          Mesociclos
        </button>
        <button
          type="button"
          onClick={onNavigateMaterial}
          className={`w-full text-left px-4 py-3.5 text-sm font-semibold ${coachText.primary} border-b ${coachBorder} hover:bg-white/5`}
        >
          Material y contacto
        </button>
        <button
          type="button"
          onClick={onNavigateCentro}
          className={`w-full text-left px-4 py-3.5 text-sm font-semibold ${coachText.primary} hover:bg-white/5`}
        >
          Guía del centro
        </button>
      </div>
    </div>
  )
}
