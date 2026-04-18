import { coachBg, coachBorder, coachText, classBadgeClass } from './coachTheme.js'
import {
  sessionText,
  previewText,
  buildDayQuickSummary,
  dayFocusLine,
  isFestivoDay,
  dayNombreToFeedbackKey,
} from './coachViewUtils.js'
import { SESSION_BLOCKS } from './coachViewConstants.js'
import { coachHasFeedbackForDay } from '../../utils/coachFeedbackLocalLog.js'

/**
 * Tab «Semana»: tarjetas resumidas Lun–Vie (sin WOD completo en esta pantalla).
 */
export default function CoachWeekOverviewPanel({
  weekData,
  weekRow,
  coachName,
  onSelectDay,
}) {
  const dias = weekData?.dias || []

  return (
    <div className={`px-4 py-5 space-y-5 ${coachBg.app} min-h-0`}>
      <p className={`text-[11px] font-bold uppercase tracking-widest ${coachText.muted}`}>
        Toca un día para abrirlo en Hoy
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {dias.map((dia) => {
          const festivo = isFestivoDay(dia)
          const { labels, preview } = buildDayQuickSummary(dia, SESSION_BLOCKS)
          const focus = dayFocusLine(dia, SESSION_BLOCKS)
          const dayKey = dayNombreToFeedbackKey(dia.nombre)
          const hasDayFeedback =
            dayKey && weekRow?.id && coachName?.trim() && coachHasFeedbackForDay(weekRow.id, dayKey, coachName)

          if (festivo) {
            return (
              <div
                key={dia.nombre}
                className={`rounded-xl p-5 border ${coachBorder} opacity-50 ${coachBg.card}`}
              >
                <p className={`text-sm font-bold ${coachText.primary} uppercase`}>{dia.nombre}</p>
                <p className={`text-xs ${coachText.muted} mt-2`}>Festivo · sin sesión</p>
              </div>
            )
          }

          return (
            <button
              key={dia.nombre}
              type="button"
              onClick={() => onSelectDay(dia.nombre)}
              className={`text-left rounded-xl p-5 border ${coachBorder} ${coachBg.card} hover:border-[#A729AD]/50 transition-colors active:scale-[0.99]`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <p className={`text-base font-black ${coachText.primary} uppercase tracking-tight`}>{dia.nombre}</p>
                {hasDayFeedback ? (
                  <span className="text-emerald-400 text-lg font-black" title="Feedback registrado" aria-hidden>
                    ✓
                  </span>
                ) : null}
              </div>
              {focus ? (
                <p className={`text-xs ${coachText.muted} line-clamp-3 mb-3`}>{focus}</p>
              ) : null}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {labels.length ? (
                  labels.map((lb) => (
                    <span key={lb} className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border ${classBadgeClass(lb)}`}>
                      {lb}
                    </span>
                  ))
                ) : (
                  <span className={`text-[10px] ${coachText.muted}`}>Sin bloques</span>
                )}
              </div>
              {preview && preview !== focus ? (
                <pre className={`text-xs ${coachText.muted} whitespace-pre-wrap line-clamp-4 font-sans leading-relaxed`}>
                  {preview}
                </pre>
              ) : null}
              {!preview && sessionText(dia.wodbuster) ? (
                <pre className={`text-xs ${coachText.muted} whitespace-pre-wrap line-clamp-4 font-sans`}>
                  {previewText(dia.wodbuster, 6, 280)}
                </pre>
              ) : null}
              <p className={`text-[10px] font-bold uppercase tracking-widest ${coachText.accent} mt-3`}>Abrir en Hoy →</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
