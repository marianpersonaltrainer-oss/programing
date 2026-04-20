import { useState, useEffect } from 'react'
import { DAYS_ORDER, DAYS_ES } from '../../constants/evoColors.js'
import { ALL_CLASS_LABELS } from '../../constants/evoClasses.js'
import { saveCoachSessionFeedback } from '../../lib/supabase.js'
import { coachFeedbackRowIndicatesChange } from '../../utils/coachSessionFeedback.js'
import { appendFeedbackLogEntry } from '../../utils/coachFeedbackLocalLog.js'
import {
  feedbackReadScopeKey,
  getReadFeedbackIds,
  markFeedbackRead,
} from '../../utils/coachFeedbackLocalLog.js'
import { appendAutoLearnedLines } from '../../utils/methodLearnedStorage.js'
import { extractMainExerciseFromBlockB } from '../../utils/sessionBlockB.js'
import { coachBg, coachBorder, coachField, coachText, coachUi } from './coachTheme.js'
import CoachFeedbackWeekSummary from './CoachFeedbackWeekSummary.jsx'

const SESSION_HOW = [
  { value: 'muy_bien', label: 'Muy bien' },
  { value: 'bien', label: 'Bien' },
  { value: 'regular', label: 'Regular' },
  { value: 'mal', label: 'Mal' },
]

const TIME_EXPLAIN = [
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
  { value: 'justo', label: 'Justo' },
]

function formatFeedbackTime(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ''
  }
}

const DAY_KEY_TO_NAME = {
  monday: 'LUNES',
  tuesday: 'MARTES',
  wednesday: 'MIERCOLES',
  thursday: 'JUEVES',
  friday: 'VIERNES',
  saturday: 'SABADO',
}

function buildLearnedLinesFromCoachFeedback({
  dayKey,
  classLabel,
  changedSomething,
  changedDetails,
  timeExplain,
  sessionText,
}) {
  const day = DAYS_ES[dayKey] || dayKey || 'Día'
  const cls = classLabel || 'Clase'
  const main = extractMainExerciseFromBlockB(sessionText)
  const suffix = main ? ` después de ${main}` : ''
  const lines = []
  if (changedSomething) {
    const reason = String(changedDetails || '').trim() || 'cambios en sesión sin detalle'
    lines.push(`${day} ${cls} — ${reason}${suffix}`)
  }
  if (timeExplain === 'no') {
    lines.push(`${day} ${cls} — faltó tiempo para explicar${suffix}`)
  } else if (timeExplain === 'justo') {
    lines.push(`${day} ${cls} — tiempo de explicación muy justo${suffix}`)
  }
  return lines
}

export default function CoachSessionFeedbackForm({
  coachName,
  sessionId,
  weekRow,
  weekData = null,
  peerEntries = [],
  onAfterSave,
  /** { token: number, dayKey: string, classLabel: string } — se aplica al cambiar token (desde Semana). */
  prefill = null,
}) {
  const [dayKey, setDayKey] = useState('monday')
  const [classLabel, setClassLabel] = useState(ALL_CLASS_LABELS[0] || 'EvoFuncional')
  const [sessionHow, setSessionHow] = useState('bien')
  const [timeExplain, setTimeExplain] = useState('si')
  const [changedSomething, setChangedSomething] = useState(false)
  const [changedDetails, setChangedDetails] = useState('')
  const [groupFeelings, setGroupFeelings] = useState('')
  const [notesNextWeek, setNotesNextWeek] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0)
  const [readChangedIds, setReadChangedIds] = useState(() => new Set())

  useEffect(() => {
    const scope = feedbackReadScopeKey(weekRow?.id ?? null, coachName)
    setReadChangedIds(getReadFeedbackIds(scope))
  }, [weekRow?.id, coachName, peerEntries.length])

  useEffect(() => {
    if (!prefill || prefill.token == null) return
    if (prefill.dayKey && DAYS_ORDER.includes(prefill.dayKey)) setDayKey(prefill.dayKey)
    if (prefill.classLabel && ALL_CLASS_LABELS.includes(prefill.classLabel)) setClassLabel(prefill.classLabel)
  }, [prefill?.token])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!sessionId || !coachName?.trim() || !weekRow?.id) {
      setError('Falta sesión o semana activa. Recarga la página.')
      return
    }
    setError('')
    setMessage('')
    if (changedSomething && !changedDetails.trim()) {
      setError('Si marcaste que cambiaste algo, describe qué cambiaste.')
      return
    }

    setSaving(true)
    try {
      await saveCoachSessionFeedback({
        coach_session_id: sessionId,
        coach_name: coachName.trim(),
        week_id: weekRow.id,
        mesociclo: weekRow.mesociclo ?? null,
        semana: weekRow.semana != null ? Number(weekRow.semana) : null,
        day_key: dayKey,
        class_label: classLabel,
        session_how: sessionHow,
        time_for_explanation: timeExplain,
        changed_something: changedSomething,
        changed_details: changedSomething ? changedDetails.trim() || null : null,
        group_feelings: groupFeelings.trim() || null,
        notes_next_week: notesNextWeek.trim() || null,
      })
      appendFeedbackLogEntry({
        week_id: weekRow.id,
        mesociclo: weekRow.mesociclo ?? null,
        semana: weekRow.semana != null ? Number(weekRow.semana) : null,
        day_key: dayKey,
        class_label: classLabel,
        coach_name: coachName.trim(),
        session_how: sessionHow,
        time_for_explanation: timeExplain,
        changed_something: changedSomething,
        changed_details: changedSomething ? changedDetails.trim() : null,
        group_feelings: groupFeelings.trim() || null,
        notes_next_week: notesNextWeek.trim() || null,
        source: 'local_save',
      })
      const dayName = DAY_KEY_TO_NAME[dayKey] || ''
      const dia = weekData?.dias?.find((d) => String(d?.nombre || '').trim().toUpperCase() === dayName)
      const classKey = (dia &&
        Object.keys(dia).find((k) => {
          const v = String(dia[k] || '')
          if (!v) return false
          if (!/^evo/i.test(k)) return false
          return String(classLabel || '').toLowerCase().includes(k.replace(/^evo/, '').toLowerCase())
        })) ||
        null
      const learnedLines = buildLearnedLinesFromCoachFeedback({
        dayKey,
        classLabel,
        changedSomething,
        changedDetails: changedSomething ? changedDetails : '',
        timeExplain,
        sessionText: classKey ? dia?.[classKey] || '' : '',
      })
      if (learnedLines.length) appendAutoLearnedLines(learnedLines)
      setSummaryRefreshKey((k) => k + 1)
      setMessage('Guardado correctamente.')
      setChangedDetails('')
      setGroupFeelings('')
      setNotesNextWeek('')
      setChangedSomething(false)
      await onAfterSave?.()
    } catch (err) {
      console.error(err)
      setError(err?.message || 'No se pudo guardar. Revisa conexión y permisos en Supabase.')
    } finally {
      setSaving(false)
    }
  }

  const selfNorm = coachName?.trim().toLowerCase() || ''
  const weekPeerSorted = [...peerEntries].sort((a, b) => {
    const ta = a?.created_at ? new Date(a.created_at).getTime() : 0
    const tb = b?.created_at ? new Date(b.created_at).getTime() : 0
    return tb - ta
  })
  const anyWithChange = weekPeerSorted.some((r) => coachFeedbackRowIndicatesChange(r))
  const othersWithChange = weekPeerSorted.filter(
    (r) =>
      coachFeedbackRowIndicatesChange(r) &&
      (r?.coach_name?.trim().toLowerCase() || '') !== selfNorm,
  )
  const unreadOthersWithChange = othersWithChange.filter((r) => !readChangedIds.has(String(r.id ?? '')))

  return (
    <div className={`${coachUi.scroll} pb-24 px-6 py-8 max-w-xl mx-auto`}>
      <h2 className={coachUi.h2}>Feedback de clase</h2>
      <p className={`text-sm ${coachText.muted} mb-8 leading-relaxed`}>
        Una entrada por día y clase. La nota para el siguiente coach aparece en el detalle de esa clase la próxima vez que la des.
      </p>

      <CoachFeedbackWeekSummary weekRow={weekRow} refreshKey={summaryRefreshKey} peerCount={peerEntries.length} />

      {weekPeerSorted.length > 0 ? (
        <section
          className={`mb-8 ${coachBg.card} border ${coachBorder} rounded-2xl p-5 shadow-sm space-y-3`}
          aria-label="Feedback de coaches esta semana"
        >
          <h3 className={`text-sm font-extrabold uppercase tracking-widest ${coachText.primary}`}>Esta semana (feedback)</h3>
          <p className={`text-xs ${coachText.muted} leading-relaxed`}>
            Incluye tus envíos y los del resto del equipo. Los cambios no leídos aparecen resaltados para feedback.
          </p>
          {unreadOthersWithChange.length > 0 ? (
            <div className="rounded-xl border border-orange-300 bg-orange-50 px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-orange-900">
                Pendientes de leer: {unreadOthersWithChange.length}
              </p>
            </div>
          ) : null}
          <ul className="space-y-3">
            {weekPeerSorted.map((row) => {
              const changed = coachFeedbackRowIndicatesChange(row)
              const isOwn = (row?.coach_name?.trim().toLowerCase() || '') === selfNorm
              const rowId = String(row?.id ?? '')
              const isRead = rowId ? readChangedIds.has(rowId) : false
              if (changed && !isOwn && isRead) return null
              const dayLabel = DAYS_ES[row.day_key] || row.day_key || '—'
              const when = formatFeedbackTime(row.created_at)
              return (
                <li
                  key={row.id ?? `${row.day_key}-${row.class_label}-${row.created_at}`}
                  className={`rounded-xl border p-3 text-sm ${
                    changed
                      ? isRead
                        ? `border-[#6A1F6D]/15 ${coachBg.cardAlt}`
                        : 'border-orange-400/80 bg-orange-100 text-orange-950 ring-2 ring-orange-300/60'
                      : `border-[#6A1F6D]/15 ${coachBg.cardAlt}`
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bold">
                    {isOwn ? (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#6A1F6D] text-white">
                        Tú
                      </span>
                    ) : null}
                    <span>{dayLabel}</span>
                    <span className={coachText.muted}>·</span>
                    <span>{row.class_label || '—'}</span>
                    <span className={`font-semibold ${coachText.muted}`}>
                      · {row.coach_name?.trim() || 'Coach'}
                      {when ? ` · ${when}` : ''}
                    </span>
                  </div>
                  {changed && row.changed_details?.trim() ? (
                    <p className="mt-2 font-semibold leading-snug whitespace-pre-wrap">{row.changed_details.trim()}</p>
                  ) : changed ? (
                    <p className="mt-2 font-medium opacity-90">Indicó cambios sin detalle.</p>
                  ) : null}
                  {changed && !isOwn && rowId ? (
                    <div className="mt-2">
                      {isRead ? (
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Leído ✓</p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const scope = feedbackReadScopeKey(weekRow?.id ?? null, coachName)
                            markFeedbackRead(scope, rowId)
                            setReadChangedIds((prev) => new Set([...prev, rowId]))
                          }}
                          className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg border border-orange-400 bg-white text-orange-900 hover:bg-orange-50"
                        >
                          Marcar leído
                        </button>
                      )}
                    </div>
                  ) : null}
                  {!changed && row.group_feelings?.trim() ? (
                    <p className={`mt-2 leading-snug whitespace-pre-wrap ${coachText.muted}`}>
                      <span className="font-semibold text-[#1A0A1A]/80">Sensaciones:</span>{' '}
                      {row.group_feelings.trim()}
                    </p>
                  ) : null}
                  {!changed && row.notes_next_week?.trim() ? (
                    <p className={`mt-2 leading-snug whitespace-pre-wrap ${coachText.muted}`}>
                      <span className="font-semibold text-[#1A0A1A]/80">Nota siguiente coach:</span>{' '}
                      {row.notes_next_week.trim()}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
          {othersWithChange.length === 0 && anyWithChange ? (
            <p className={`text-xs ${coachText.muted}`}>
              Solo constan tus avisos con cambios; cuando otro coach envíe feedback, aparecerá aquí.
            </p>
          ) : null}
        </section>
      ) : null}

      <form onSubmit={handleSubmit} className={`space-y-6 ${coachBg.card} border ${coachBorder} rounded-2xl p-6 shadow-sm`}>
        <div>
          <label className={`block text-xs font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>Día</label>
          <select value={dayKey} onChange={(e) => setDayKey(e.target.value)} className={coachField}>
            {DAYS_ORDER.map((d) => (
              <option key={d} value={d}>
                {DAYS_ES[d]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={`block text-xs font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>Clase</label>
          <select value={classLabel} onChange={(e) => setClassLabel(e.target.value)} className={coachField}>
            {ALL_CLASS_LABELS.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={`block text-xs font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>
            ¿Cómo fue la sesión?
          </label>
          <div className="flex flex-wrap gap-2">
            {SESSION_HOW.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setSessionHow(value)}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                  sessionHow === value
                    ? 'bg-[#6A1F6D] text-white border-[#6A1F6D]'
                    : `${coachBg.cardAlt} border-[#6A1F6D]/30 ${coachText.primary} hover:border-[#A729AD]/50`
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={`block text-xs font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>
            ¿Dio tiempo a explicar todo?
          </label>
          <div className="flex flex-wrap gap-2">
            {TIME_EXPLAIN.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTimeExplain(value)}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                  timeExplain === value
                    ? 'bg-[#6A1F6D] text-white border-[#6A1F6D]'
                    : `${coachBg.cardAlt} border-[#6A1F6D]/30 ${coachText.primary} hover:border-[#A729AD]/50`
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={`block text-xs font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>¿Cambiaste algo?</label>
          <div className="flex gap-3 mb-3">
            <button
              type="button"
              onClick={() => setChangedSomething(true)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border ${
                changedSomething ? 'bg-[#A729AD] text-white border-[#A729AD]' : `${coachBorder} ${coachText.primary}`
              }`}
            >
              Sí
            </button>
            <button
              type="button"
              onClick={() => {
                setChangedSomething(false)
                setChangedDetails('')
              }}
              className={`px-4 py-2 rounded-xl text-sm font-bold border ${
                !changedSomething ? 'bg-[#6A1F6D] text-white border-[#6A1F6D]' : `${coachBorder} ${coachText.primary}`
              }`}
            >
              No
            </button>
          </div>
          {changedSomething ? (
            <div>
              <label className={`block text-xs font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>
                ¿Qué cambiaste?
              </label>
              <textarea
                value={changedDetails}
                onChange={(e) => setChangedDetails(e.target.value)}
                placeholder="Ej.: sustituí X por Y, bajé cargas en el bisagra, acorté el WOD…"
                rows={3}
                className={coachField}
              />
            </div>
          ) : null}
        </div>

        <div>
          <label className={`block text-xs font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>
            Sensaciones del grupo
          </label>
          <textarea
            value={groupFeelings}
            onChange={(e) => setGroupFeelings(e.target.value)}
            rows={3}
            className={coachField}
            placeholder="Energía, dudas recurrentes, nivel general…"
          />
        </div>

        <div>
          <label className={`block text-xs font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>
            Nota para el siguiente coach
          </label>
          <p className={`text-xs ${coachText.muted} mb-2 leading-relaxed`}>
            Visible en el detalle de esta clase el próximo día que la impartas (día + tipo de clase).
          </p>
          <textarea
            value={notesNextWeek}
            onChange={(e) => setNotesNextWeek(e.target.value)}
            rows={3}
            className={coachField}
            placeholder="Ej.: el AMRAP se quedó corto, quitar una ronda la próxima vez…"
          />
        </div>

        {error && (
          <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl px-4 py-3 font-medium">{error}</p>
        )}
        {message && (
          <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 font-medium">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 rounded-xl bg-[#A729AD] hover:bg-[#6A1F6D] disabled:opacity-40 text-white font-bold text-sm uppercase tracking-widest transition-colors"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
    </div>
  )
}
