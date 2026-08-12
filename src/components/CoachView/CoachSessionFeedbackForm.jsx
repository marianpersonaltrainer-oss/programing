import { useState, useEffect, useMemo } from 'react'
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
import {
  getMadridCoachProgramDayKey,
  formatMadridDateShort,
  normalizeProgramDayKey,
  isMadridCalendarSunday,
} from '../../utils/coachMadridDay.js'
import { feedbackClassChrome, sortClassLabelsForFeedback } from '../../utils/coachFeedbackClassChrome.js'

const TIME_EXPLAIN = [
  { value: 'si', label: 'Bien de tiempo' },
  { value: 'justo', label: 'Justa' },
  { value: 'no', label: 'Se me fue de tiempo' },
]

const TIME_EXPLAIN_SHORT = {
  si: 'Bien de tiempo',
  justo: 'Justa',
  no: 'Se fue de tiempo',
}

const TIME_BADGE_CLASS = {
  si: 'bg-emerald-900/50 text-emerald-200 border-emerald-500/40',
  justo: 'bg-amber-900/50 text-amber-200 border-amber-500/40',
  no: 'bg-rose-900/50 text-rose-200 border-rose-500/40',
}

function buildTimeSummaryLine({ si, justo, no }) {
  const parts = []
  if (si > 0) parts.push(`${si} bien`)
  if (justo > 0) parts.push(`${justo} justa${justo === 1 ? '' : 's'}`)
  if (no > 0) parts.push(`${no} corta${no === 1 ? '' : 's'}`)
  return parts.join(' · ')
}

function peerRowVisible(row, selfNorm, readChangedIds) {
  const changed = coachFeedbackRowIndicatesChange(row)
  const isOwn = (row?.coach_name?.trim().toLowerCase() || '') === selfNorm
  const rowId = String(row?.id ?? '')
  const isRead = rowId ? readChangedIds.has(rowId) : false
  if (changed && !isOwn && isRead) return false
  return true
}

function normalizeFeedbackSnippet(text) {
  return String(text || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/** Evita repetir el mismo texto en «cambió», sensaciones y a vigilar. */
function buildFeedbackEntryContent(row) {
  const changed = coachFeedbackRowIndicatesChange(row)
  const changeText = row.changed_details?.trim() || ''
  let feelings = row.group_feelings?.trim() || ''
  let vigil = row.notes_next_week?.trim() || ''

  const unique = (value, others) => {
    const n = normalizeFeedbackSnippet(value)
    if (!n) return ''
    return others.some((o) => o && (o === n || o.includes(n) || n.includes(o))) ? '' : value
  }

  if (changed && changeText) {
    feelings = unique(feelings, [normalizeFeedbackSnippet(changeText)])
    vigil = unique(vigil, [normalizeFeedbackSnippet(changeText), normalizeFeedbackSnippet(feelings)])
  } else {
    vigil = unique(vigil, [normalizeFeedbackSnippet(feelings)])
  }

  return { changed, changeText, feelings, vigil }
}

function peerRowHasDisplayContent(row) {
  const { changed, changeText, feelings, vigil } = buildFeedbackEntryContent(row)
  return Boolean(changed || changeText || feelings || vigil || row.time_for_explanation)
}

function FeedbackEntryCard({
  row,
  selfNorm,
  readChangedIds,
  weekRow,
  coachName,
  onMarkRead,
}) {
  const changed = coachFeedbackRowIndicatesChange(row)
  const isOwn = (row?.coach_name?.trim().toLowerCase() || '') === selfNorm
  const rowId = String(row?.id ?? '')
  const isRead = rowId ? readChangedIds.has(rowId) : false
  const when = formatFeedbackTime(row.created_at)
  const unreadChange = changed && !isOwn && !isRead
  const { changeText, feelings, vigil } = buildFeedbackEntryContent(row)

  return (
    <article
      className={`rounded-xl border p-3.5 text-sm ${
        unreadChange
          ? 'border-amber-400/70 bg-amber-950/35 ring-1 ring-amber-400/25'
          : `border-white/10 ${coachBg.rowB}`
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {isOwn ? (
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#6A1F6D] text-white font-bold">
            Tú
          </span>
        ) : null}
        <span className="font-bold text-[#F3EAF8]">{row.coach_name?.trim() || 'Coach'}</span>
        {when ? <span className={`text-xs ${coachText.muted}`}>{when}</span> : null}
        {row.time_for_explanation && TIME_EXPLAIN_SHORT[row.time_for_explanation] ? (
          <span
            className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${
              TIME_BADGE_CLASS[row.time_for_explanation] || 'border-white/20 text-white/70'
            }`}
          >
            {TIME_EXPLAIN_SHORT[row.time_for_explanation]}
          </span>
        ) : null}
      </div>

      {changed ? (
        <div className="mt-2.5 rounded-lg border border-orange-400/35 bg-orange-950/30 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-orange-300/90 mb-1">Cambió en sesión</p>
          <p className="leading-snug whitespace-pre-wrap text-orange-50/95">
            {changeText || 'Indicó cambios sin detalle.'}
          </p>
        </div>
      ) : null}

      {feelings ? (
        <p className="mt-2.5 leading-relaxed whitespace-pre-wrap text-[#F3EAF8]/92">{feelings}</p>
      ) : null}

      {vigil ? (
        <div className="mt-2.5 rounded-lg border border-yellow-500/30 bg-yellow-950/25 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-300/80 mb-1">A vigilar</p>
          <p className="leading-snug whitespace-pre-wrap text-yellow-50/90">{vigil}</p>
        </div>
      ) : null}

      {unreadChange && rowId ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              const scope = feedbackReadScopeKey(weekRow?.id ?? null, coachName)
              markFeedbackRead(scope, rowId)
              onMarkRead(rowId)
            }}
            className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg border border-amber-400/60 bg-amber-900/40 text-amber-100 hover:bg-amber-900/60"
          >
            Marcar leído
          </button>
        </div>
      ) : null}
      {changed && !isOwn && isRead ? (
        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-emerald-400/90">Leído ✓</p>
      ) : null}
    </article>
  )
}

/** La valoración (columna session_how) se deriva del tiempo para mantener el informe del admin. */
const SESSION_HOW_FROM_TIME = { si: 'bien', justo: 'regular', no: 'mal' }

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
  const [showWeekArchive, setShowWeekArchive] = useState(false)
  const [showFeedbackForm, setShowFeedbackForm] = useState(false)

  const madridProgramDayKey = useMemo(
    () => getMadridCoachProgramDayKey(),
    [summaryRefreshKey, peerEntries.length],
  )

  useEffect(() => {
    const scope = feedbackReadScopeKey(weekRow?.id ?? null, coachName)
    setReadChangedIds(getReadFeedbackIds(scope))
  }, [weekRow?.id, coachName, peerEntries.length])

  useEffect(() => {
    if (!weekRow?.id) return
    if (prefill?.token != null) {
      if (prefill.dayKey && DAYS_ORDER.includes(prefill.dayKey)) setDayKey(prefill.dayKey)
      if (prefill.classLabel && ALL_CLASS_LABELS.includes(prefill.classLabel)) setClassLabel(prefill.classLabel)
      setShowFeedbackForm(true)
      return
    }
    const t = getMadridCoachProgramDayKey()
    if (t && DAYS_ORDER.includes(t)) setDayKey(t)
  }, [weekRow?.id, prefill?.token, prefill?.dayKey, prefill?.classLabel])

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
        session_how: SESSION_HOW_FROM_TIME[timeExplain] || 'bien',
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
        session_how: SESSION_HOW_FROM_TIME[timeExplain] || 'bien',
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
      if (learnedLines.length) appendAutoLearnedLines(learnedLines, { highImpactOnly: true })
      setSummaryRefreshKey((k) => k + 1)
      setMessage('Guardado correctamente.')
      setChangedDetails('')
      setGroupFeelings('')
      setNotesNextWeek('')
      setChangedSomething(false)
      await onAfterSave?.()
    } catch (err) {
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

  const todayPeerSorted = useMemo(() => {
    if (!madridProgramDayKey) return []
    return weekPeerSorted.filter((r) => normalizeProgramDayKey(r.day_key) === madridProgramDayKey)
  }, [weekPeerSorted, madridProgramDayKey])

  const archivePeerSorted = useMemo(() => {
    if (!madridProgramDayKey) return []
    return weekPeerSorted.filter((r) => normalizeProgramDayKey(r.day_key) !== madridProgramDayKey)
  }, [weekPeerSorted, madridProgramDayKey])

  /** Lista principal: solo hoy (día de programación en Madrid); domingo = vacía en “hoy”. */
  const primaryPeerList = madridProgramDayKey ? todayPeerSorted : weekPeerSorted

  const anyWithChange = primaryPeerList.some((r) => coachFeedbackRowIndicatesChange(r))
  const othersWithChange = primaryPeerList.filter(
    (r) =>
      coachFeedbackRowIndicatesChange(r) &&
      (r?.coach_name?.trim().toLowerCase() || '') !== selfNorm,
  )
  const unreadOthersWithChange = othersWithChange.filter((r) => !readChangedIds.has(String(r.id ?? '')))

  const visibleTodayPeers = useMemo(
    () =>
      primaryPeerList.filter(
        (row) => peerRowVisible(row, selfNorm, readChangedIds) && peerRowHasDisplayContent(row),
      ),
    [primaryPeerList, selfNorm, readChangedIds],
  )

  const timeStats = useMemo(() => {
    let si = 0
    let justo = 0
    let no = 0
    for (const row of primaryPeerList) {
      if (row.time_for_explanation === 'si') si += 1
      else if (row.time_for_explanation === 'justo') justo += 1
      else if (row.time_for_explanation === 'no') no += 1
    }
    return { si, justo, no }
  }, [primaryPeerList])

  const todayByClass = useMemo(() => {
    const m = new Map()
    for (const row of visibleTodayPeers) {
      const label = String(row.class_label || '—').trim() || '—'
      if (!m.has(label)) m.set(label, [])
      m.get(label).push(row)
    }
    return sortClassLabelsForFeedback([...m.keys()]).map((classLabel) => ({
      classLabel,
      rows: (m.get(classLabel) || []).sort((a, b) => {
        const ta = a?.created_at ? new Date(a.created_at).getTime() : 0
        const tb = b?.created_at ? new Date(b.created_at).getTime() : 0
        return tb - ta
      }),
    }))
  }, [visibleTodayPeers])

  const timeSummaryLine = buildTimeSummaryLine(timeStats)
  const dayTitle = madridProgramDayKey ? DAYS_ES[madridProgramDayKey] || madridProgramDayKey : 'Semana'

  return (
    <div className={`${coachUi.scroll} pb-24 px-6 py-8 max-w-2xl mx-auto`}>
      <h2 className={coachUi.h2}>Feedback</h2>
      <p className={`text-sm ${coachText.muted} mb-6 leading-relaxed`}>
        {madridProgramDayKey ? (
          <>
            <span className="font-semibold text-[#F3EAF8]">{dayTitle}</span> · {formatMadridDateShort()}
          </>
        ) : (
          <>Semana · {formatMadridDateShort()}</>
        )}
      </p>
      {!madridProgramDayKey && !isMadridCalendarSunday() ? (
        <p className="text-xs text-amber-100 bg-amber-900/35 border border-amber-400/40 rounded-xl px-3 py-2 mb-8 leading-relaxed">
          No se detectó el día en tu dispositivo. Recarga la página si la vista no coincide con hoy.
        </p>
      ) : null}

      <section
        className={`mb-8 ${coachBg.card} border ${coachBorder} rounded-2xl p-5 shadow-sm space-y-4`}
        aria-label="Feedback del equipo hoy"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className={`text-sm font-extrabold uppercase tracking-widest ${coachText.primary}`}>
              {madridProgramDayKey ? `Hoy · ${dayTitle}` : 'Esta semana'}
            </h3>
            {visibleTodayPeers.length > 0 ? (
              <p className={`text-xs ${coachText.muted} mt-1`}>
                {visibleTodayPeers.length} envío{visibleTodayPeers.length === 1 ? '' : 's'}
                {timeSummaryLine ? ` · Tiempo: ${timeSummaryLine}` : ''}
              </p>
            ) : (
              <p className={`text-xs ${coachText.muted} mt-1`}>
                {madridProgramDayKey ? 'Aún no hay feedback de hoy.' : 'Sin envíos esta semana.'}
              </p>
            )}
          </div>
          {unreadOthersWithChange.length > 0 ? (
            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border border-amber-400/50 bg-amber-950/40 text-amber-200">
              {unreadOthersWithChange.length} cambio{unreadOthersWithChange.length === 1 ? '' : 's'} sin leer
            </span>
          ) : null}
        </div>

        {todayByClass.length > 0 ? (
          <div className="space-y-4">
            {todayByClass.map(({ classLabel, rows }) => {
              const chrome = feedbackClassChrome(classLabel)
              return (
                <div
                  key={classLabel}
                  className="rounded-xl overflow-hidden border"
                  style={{ borderColor: chrome.border, backgroundColor: chrome.softBg }}
                >
                  <div
                    className="px-3 py-2.5 text-xs font-extrabold uppercase tracking-widest flex items-center gap-2"
                    style={{ color: chrome.bar, borderLeft: `4px solid ${chrome.bar}` }}
                  >
                    {classLabel}
                    <span className={`font-normal normal-case tracking-normal text-[11px] ${coachText.muted}`}>
                      {rows.length} nota{rows.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="px-3 pb-3 space-y-2.5">
                    {rows.map((row) => (
                      <FeedbackEntryCard
                        key={row.id ?? `${row.day_key}-${row.class_label}-${row.created_at}`}
                        row={row}
                        selfNorm={selfNorm}
                        readChangedIds={readChangedIds}
                        weekRow={weekRow}
                        coachName={coachName}
                        onMarkRead={(rowId) => setReadChangedIds((prev) => new Set([...prev, rowId]))}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}

        {othersWithChange.length === 0 && anyWithChange && visibleTodayPeers.length > 0 ? (
          <p className={`text-xs ${coachText.muted}`}>
            Solo hay cambios tuyos por ahora; los de otros coaches se resaltan aquí cuando lleguen.
          </p>
        ) : null}

        {madridProgramDayKey && archivePeerSorted.length > 0 ? (
          <div className="pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShowWeekArchive((v) => !v)}
              className={`w-full text-left text-xs font-bold uppercase tracking-widest px-3 py-2 rounded-xl border ${coachBorder} ${coachBg.cardMuted} ${coachText.primary} hover:opacity-95`}
            >
              {showWeekArchive ? '▼' : '▶'} Otros días ({archivePeerSorted.length})
            </button>
            {showWeekArchive ? (
              <ul className="mt-3 space-y-2 opacity-95">
                {archivePeerSorted.map((row) => {
                  const dayLabel = DAYS_ES[row.day_key] || row.day_key || '—'
                  const when = formatFeedbackTime(row.created_at)
                  const ch = feedbackClassChrome(row.class_label)
                  const snippet =
                    row.changed_details?.trim() ||
                    row.group_feelings?.trim() ||
                    row.notes_next_week?.trim() ||
                    ''
                  return (
                    <li
                      key={`arc-${row.id ?? `${row.day_key}-${row.class_label}-${row.created_at}`}`}
                      className={`rounded-lg border p-2.5 text-xs ${coachBorder} ${coachBg.cardAlt}`}
                      style={{ borderLeftWidth: 3, borderLeftColor: ch.bar }}
                    >
                      <span className="font-bold text-[#F3EAF8]/90">
                        {dayLabel} · {row.class_label || '—'} · {row.coach_name?.trim() || 'Coach'}
                      </span>
                      {when ? <span className={`${coachText.muted}`}> · {when}</span> : null}
                      {snippet ? (
                        <p className={`mt-1 ${coachText.muted} whitespace-pre-wrap line-clamp-3`}>{snippet}</p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="mb-8">
        <button
          type="button"
          onClick={() => setShowFeedbackForm((v) => !v)}
          className={`w-full text-left flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border ${coachBorder} ${coachBg.card} ${coachText.primary} hover:opacity-95`}
        >
          <span className="text-sm font-extrabold uppercase tracking-widest">Enviar tu feedback</span>
          <span className={`text-xs font-bold ${coachText.muted}`}>{showFeedbackForm ? '▼' : '▶'}</span>
        </button>
      </div>

      {showFeedbackForm ? (
      <form onSubmit={handleSubmit} className={`space-y-6 ${coachBg.card} border ${coachBorder} rounded-2xl p-6 shadow-sm -mt-4`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </div>

        <div>
          <label className={`block text-xs font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>
            ¿Cómo ha ido?
          </label>
          <textarea
            value={groupFeelings}
            onChange={(e) => setGroupFeelings(e.target.value)}
            rows={3}
            className={coachField}
            placeholder="Cómo fue la clase: energía del grupo, qué tal salió, sensaciones…"
          />
        </div>

        <div>
          <label className={`block text-xs font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>
            ¿Qué tal de tiempo?
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
          <label className={`block text-xs font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>¿Modificaste algo?</label>
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
                ¿Qué modificaste?
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
            ¿Algo a vigilar?
          </label>
          <textarea
            value={notesNextWeek}
            onChange={(e) => setNotesNextWeek(e.target.value)}
            rows={2}
            className={coachField}
            placeholder="Para el siguiente coach que dé esta clase…"
          />
        </div>

        {error && (
          <p className="text-sm text-red-200 bg-red-950/50 border border-red-400/40 rounded-xl px-4 py-3 font-medium">
            {error}
          </p>
        )}
        {message && (
          <p
            className="text-sm text-emerald-200 bg-emerald-950/40 border border-emerald-400/35 rounded-xl px-4 py-3 font-medium"
            role="status"
            aria-live="polite"
          >
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
      ) : null}
    </div>
  )
}
