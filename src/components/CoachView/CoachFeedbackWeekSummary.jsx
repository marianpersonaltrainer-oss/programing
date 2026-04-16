import { useMemo } from 'react'
import { summarizeFeedbackForWeek } from '../../utils/coachFeedbackLocalLog.js'
import { DAYS_ES } from '../../constants/evoColors.js'
import { coachBg, coachBorder, coachText } from './coachTheme.js'

const HOW_LABEL = {
  muy_bien: 'Muy bien',
  bien: 'Bien',
  regular: 'Regular',
  mal: 'Mal',
}

export default function CoachFeedbackWeekSummary({ weekRow, refreshKey = 0, peerCount = 0 }) {
  const summary = useMemo(() => {
    if (!weekRow) return null
    return summarizeFeedbackForWeek(weekRow.id ?? null)
  }, [weekRow?.id, refreshKey, peerCount])

  if (!summary || summary.count === 0) return null

  const { how, timeSi, timeNo, timeJusto, recentNotes, recentChanges } = summary
  const totalHow = how.muy_bien + how.bien + how.regular + how.mal
  const timeTotal = timeSi + timeNo + timeJusto

  return (
    <section
      className={`mb-8 ${coachBg.card} border ${coachBorder} rounded-2xl p-5 shadow-sm space-y-4`}
      aria-label="Resumen de feedback de la semana"
    >
      <h3 className={`text-sm font-extrabold uppercase tracking-widest ${coachText.primary}`}>
        Resumen de feedback (esta semana, este dispositivo)
      </h3>
      <p className={`text-xs ${coachText.muted} leading-relaxed`}>
        Agregado desde datos guardados en localStorage (tus envíos y sincronización de la lista del servidor al abrir
        Feedback). {summary.count} registro{summary.count === 1 ? '' : 's'}.
      </p>

      {totalHow > 0 ? (
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>
            ¿Cómo fue la sesión?
          </p>
          <ul className="flex flex-wrap gap-3 text-sm">
            {Object.entries(how).map(([k, v]) => (
              <li key={k} className={`rounded-xl px-3 py-2 border ${coachBorder} ${coachBg.cardMuted}`}>
                <span className={`font-bold ${coachText.primary}`}>{HOW_LABEL[k] || k}:</span> {v}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {timeTotal > 0 ? (
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>
            ¿Tiempo para explicar?
          </p>
          <ul className="flex flex-wrap gap-3 text-sm">
            <li className={`rounded-xl px-3 py-2 border ${coachBorder} ${coachBg.cardMuted}`}>
              <span className="font-bold text-emerald-800">Sí, sobró</span> · {timeSi}
            </li>
            <li className={`rounded-xl px-3 py-2 border ${coachBorder} ${coachBg.cardMuted}`}>
              <span className="font-bold text-amber-900">Justo</span> · {timeJusto}
            </li>
            <li className={`rounded-xl px-3 py-2 border ${coachBorder} ${coachBg.cardMuted}`}>
              <span className="font-bold text-rose-900">Corto / faltó</span> · {timeNo}
            </li>
          </ul>
        </div>
      ) : null}

      {recentChanges?.length > 0 ? (
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>
            Cambios en sesión (detalle)
          </p>
          <ul className="space-y-2 text-sm">
            {recentChanges.map((c, i) => (
              <li key={i} className={`rounded-xl border border-orange-300/60 bg-orange-50/90 px-3 py-2 text-orange-950`}>
                <p className={`text-[10px] font-bold uppercase tracking-wide`}>
                  {DAYS_ES[c.day_key] || c.day_key || '—'} · {c.class_label || '—'}
                </p>
                <p className="font-semibold leading-snug mt-1 whitespace-pre-wrap">{c.text}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {recentNotes.length > 0 ? (
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>
            Sensaciones y notas para el siguiente coach
          </p>
          <ul className="space-y-2 text-sm">
            {recentNotes.map((n, i) => (
              <li key={i} className={`rounded-xl border ${coachBorder} px-3 py-2 ${coachBg.cardAlt}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wide ${coachText.accent}`}>
                  {DAYS_ES[n.day_key] || n.day_key || '—'} · {n.class_label || '—'}
                </p>
                {n.group_feelings ? (
                  <p className={`${coachText.muted} leading-snug mt-1 whitespace-pre-wrap`}>
                    <span className="font-bold text-[#1A0A1A]/75">Sensaciones:</span> {n.group_feelings}
                  </p>
                ) : null}
                {n.notes_next_week ? (
                  <p className={`${coachText.primary} leading-snug mt-1 whitespace-pre-wrap`}>
                    <span className="font-bold">Siguiente coach:</span> {n.notes_next_week}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
