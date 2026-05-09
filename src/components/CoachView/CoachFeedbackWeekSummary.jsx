import { useMemo } from 'react'
import { summarizeFeedbackForWeek } from '../../utils/coachFeedbackLocalLog.js'
import { DAYS_ES } from '../../constants/evoColors.js'
import { coachBg, coachBorder, coachText } from './coachTheme.js'
import { feedbackClassChrome, sortClassLabelsForFeedback } from '../../utils/coachFeedbackClassChrome.js'
import {
  formatMadridDateShort,
  getMadridCoachProgramDayKey,
  isMadridCalendarSunday,
} from '../../utils/coachMadridDay.js'

function groupByClass(items) {
  const m = new Map()
  for (const it of items) {
    const label = String(it.class_label || '—').trim() || '—'
    if (!m.has(label)) m.set(label, [])
    m.get(label).push(it)
  }
  const keys = sortClassLabelsForFeedback([...m.keys()])
  return keys.map((k) => ({ classLabel: k, items: m.get(k) || [] }))
}

export default function CoachFeedbackWeekSummary({
  weekRow,
  refreshKey = 0,
  peerCount = 0,
  /** `monday`…`saturday` o `null` (domingo). Si se omite, se usa el día de programa en Madrid. */
  todayDayKey,
}) {
  const resolvedDayKey = todayDayKey === undefined ? getMadridCoachProgramDayKey() : todayDayKey

  const summary = useMemo(() => {
    if (!weekRow) return null
    if (resolvedDayKey === null && isMadridCalendarSunday()) {
      return {
        count: 0,
        timeSi: 0,
        timeNo: 0,
        timeJusto: 0,
        recentNotes: [],
        recentChanges: [],
        isSunday: true,
      }
    }
    if (resolvedDayKey === null && !isMadridCalendarSunday()) {
      return {
        ...summarizeFeedbackForWeek(weekRow.id ?? null, {}),
        detectionFailed: true,
      }
    }
    return summarizeFeedbackForWeek(weekRow.id ?? null, { dayKey: resolvedDayKey })
  }, [weekRow?.id, refreshKey, peerCount, resolvedDayKey])

  if (!summary) return null

  const dayTitle = resolvedDayKey ? DAYS_ES[resolvedDayKey] || resolvedDayKey : 'Hoy'
  const madridDate = formatMadridDateShort()

  if (summary.isSunday) {
    return (
      <section
        className={`mb-8 ${coachBg.card} border ${coachBorder} rounded-2xl p-5 shadow-sm space-y-3`}
        aria-label="Feedback de hoy"
      >
        <h3 className={`text-sm font-extrabold uppercase tracking-widest ${coachText.primary}`}>
          Feedback de hoy · {madridDate}
        </h3>
        <p className={`text-sm ${coachText.muted} leading-relaxed`}>
          Domingo: no hay día de programación en la plantilla semanal. El lunes volverás a ver aquí solo el feedback del
          día en curso; todo lo guardado sigue en el servidor para el equipo y la IA.
        </p>
      </section>
    )
  }

  if (
    !summary.detectionFailed &&
    summary.count === 0 &&
    !summary.timeSi &&
    !summary.timeNo &&
    !summary.timeJusto
  ) {
    return (
      <section
        className={`mb-8 ${coachBg.card} border ${coachBorder} rounded-2xl p-5 shadow-sm space-y-3`}
        aria-label="Feedback de hoy"
      >
        <h3 className={`text-sm font-extrabold uppercase tracking-widest ${coachText.primary}`}>
          Resumen de hoy · {dayTitle}
        </h3>
        <p className={`text-xs ${coachText.muted}`}>{madridDate} · Europa/Madrid</p>
        <p className={`text-sm ${coachText.muted} leading-relaxed`}>
          Aún no hay envíos de feedback registrados hoy para <span className="font-semibold text-[#F3EAF8]">{dayTitle}</span> en
          este dispositivo. Cuando envíes o se sincronice la lista, aparecerá aquí solo lo de hoy.
        </p>
        <p className={`text-xs ${coachText.muted} leading-relaxed border-t border-white/10 pt-3`}>
          Los datos de otros días no se borran: siguen en Supabase y en el log local (hasta {400} entradas) para
          informes y aprendizaje automático.
        </p>
      </section>
    )
  }

  const { timeSi, timeNo, timeJusto, recentNotes, recentChanges } = summary
  const timeParts = []
  if (timeSi > 0) timeParts.push({ key: 'si', label: 'Sí, sobró tiempo', count: timeSi, cls: 'text-emerald-800' })
  if (timeJusto > 0) timeParts.push({ key: 'justo', label: 'Justo', count: timeJusto, cls: 'text-amber-900' })
  if (timeNo > 0) timeParts.push({ key: 'no', label: 'Corto / faltó', count: timeNo, cls: 'text-rose-900' })

  const notesByClass = groupByClass(recentNotes)
  const changesByClass = groupByClass(recentChanges)

  return (
    <section
      className={`mb-8 ${coachBg.card} border ${coachBorder} rounded-2xl p-5 shadow-sm space-y-5`}
      aria-label="Resumen de feedback del día"
    >
      {summary.detectionFailed ? (
        <p className="text-xs text-amber-950 bg-amber-100/90 border border-amber-400/60 rounded-lg px-3 py-2 leading-relaxed">
          No se ha podido detectar el día en tu dispositivo; se muestra el agregado de toda la semana en este
          dispositivo. Actualiza la página o la app instalada para volver a la vista solo «hoy».
        </p>
      ) : null}
      <div>
        <h3 className={`text-sm font-extrabold uppercase tracking-widest ${coachText.primary}`}>
          Resumen de hoy · {dayTitle}
        </h3>
        <p className={`text-xs ${coachText.muted} mt-1`}>{madridDate} · solo este día de programación en pantalla</p>
        <p className={`text-xs ${coachText.muted} leading-relaxed mt-2`}>
          Agregado desde datos en este dispositivo (tus envíos + sincronización al abrir Feedback).{' '}
          <span className="font-semibold text-[#F3EAF8]/90">{summary.count}</span> registro
          {summary.count === 1 ? '' : 's'} hoy.
        </p>
      </div>

      {timeParts.length > 0 ? (
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>
            Tiempo para explicar (solo respuestas dadas hoy)
          </p>
          <ul className="flex flex-wrap gap-2 text-sm">
            {timeParts.map((p) => (
              <li
                key={p.key}
                className={`rounded-xl px-3 py-2 border ${coachBorder} ${coachBg.cardMuted}`}
              >
                <span className={`font-bold ${p.cls}`}>{p.label}</span>
                <span className={`${coachText.muted} font-semibold`}> · {p.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {changesByClass.length > 0 ? (
        <div className="space-y-3">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${coachText.muted}`}>
            Cambios en sesión (por clase)
          </p>
          {changesByClass.map(({ classLabel, items }) => {
            const chrome = feedbackClassChrome(classLabel)
            return (
              <div
                key={`ch-${classLabel}`}
                className="rounded-xl overflow-hidden border"
                style={{ borderColor: chrome.border, backgroundColor: chrome.softBg }}
              >
                <div
                  className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-widest flex items-center gap-2"
                  style={{ color: chrome.text, borderLeft: `4px solid ${chrome.bar}` }}
                >
                  <span>{classLabel}</span>
                  <span className={`font-normal opacity-80 ${coachText.muted}`}>· {dayTitle}</span>
                </div>
                <ul className="px-3 pb-3 space-y-2">
                  {items.map((c, i) => (
                    <li
                      key={`${classLabel}-ch-${i}`}
                      className="rounded-lg bg-white/90 px-3 py-2 text-sm text-orange-950 border border-orange-200/80"
                    >
                      <p className="font-semibold leading-snug whitespace-pre-wrap">{c.text}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      ) : null}

      {notesByClass.length > 0 ? (
        <div className="space-y-3">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${coachText.muted}`}>
            Sensaciones y notas para el siguiente coach (por clase)
          </p>
          {notesByClass.map(({ classLabel, items }) => {
            const chrome = feedbackClassChrome(classLabel)
            return (
              <div
                key={`n-${classLabel}`}
                className="rounded-xl overflow-hidden border"
                style={{ borderColor: chrome.border, backgroundColor: chrome.softBg }}
              >
                <div
                  className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-widest flex items-center gap-2"
                  style={{ color: chrome.text, borderLeft: `4px solid ${chrome.bar}` }}
                >
                  <span>{classLabel}</span>
                  <span className={`font-normal opacity-80 ${coachText.muted}`}>· {dayTitle}</span>
                </div>
                <ul className="px-3 pb-3 space-y-2">
                  {items.map((n, i) => (
                    <li key={`${classLabel}-n-${i}`} className="rounded-lg bg-white/95 px-3 py-2 text-sm border border-black/5">
                      {n.group_feelings ? (
                        <p className={`${coachText.muted} leading-snug whitespace-pre-wrap`}>
                          <span className="font-bold text-[#1A0A1A]/80">Sensaciones:</span> {n.group_feelings}
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
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
