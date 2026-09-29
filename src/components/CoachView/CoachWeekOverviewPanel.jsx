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
  const weekFeedback = dias.reduce(
    (summary, dia) => {
      if (isFestivoDay(dia)) return summary

      const { labels, preview } = buildDayQuickSummary(dia, SESSION_BLOCKS)
      const hasSession = labels.length > 0 || Boolean(preview) || Boolean(sessionText(dia.wodbuster))
      if (!hasSession) return summary

      const dayKey = dayNombreToFeedbackKey(dia.nombre)
      const hasDayFeedback =
        dayKey && weekRow?.id && coachName?.trim() && coachHasFeedbackForDay(weekRow.id, dayKey, coachName)

      summary.programmed += 1
      if (hasDayFeedback) summary.withFeedback += 1
      return summary
    },
    { programmed: 0, withFeedback: 0 },
  )

  return (
    <div className={`mx-auto w-full max-w-5xl px-5 py-6 space-y-5 ${coachBg.app} min-h-0`}>
      <section className={`coach-roster p-5 border ${coachBorder} ${coachBg.card}`} aria-label="Estado de la semana">
        <p className="coach-eyebrow">Esta semana</p>
        <p className={`text-lg font-bold ${coachText.primary} mt-2`}>
          Lo que tienes por delante, sin abrir cada sesión todavía.
        </p>
        <p className={`text-xs ${coachText.muted} mt-3`}>
          {weekFeedback.programmed
            ? `Feedback registrado: ${weekFeedback.withFeedback} de ${weekFeedback.programmed} día(s) con sesión.`
            : 'No hay sesiones programadas para esta semana.'}
        </p>
      </section>
      <p className={`text-[11px] font-bold uppercase tracking-widest ${coachText.muted}`}>
        Toca un día para ver sus clases
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
              className={`coach-roster p-5 border ${coachBorder} opacity-55 ${coachBg.card}`}
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
              className={`coach-roster text-left p-5 border ${coachBorder} ${coachBg.card} hover:border-[#6A1F6D]/45 hover:bg-[#F8F3ED] transition-colors active:scale-[0.99]`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <p className={`text-base font-black ${coachText.primary} uppercase tracking-tight`}>{dia.nombre}</p>
                {hasDayFeedback ? (
                  <span className="rounded-full bg-[#F6E8F9] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#6A1F6D]">Nota lista</span>
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
              <p className={`text-[10px] font-bold uppercase tracking-widest ${coachText.accent} mt-3`}>Ver clases de este día</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
