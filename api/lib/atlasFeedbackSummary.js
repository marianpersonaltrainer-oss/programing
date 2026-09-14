const CLASS_LABELS = new Map([
  ['evofuncional', 'EvoFuncional'],
  ['evobasics', 'EvoBasics'],
  ['evofit', 'EvoFit'],
  ['evohybrix', 'EvoHybrix'],
  ['evofuerza', 'EvoFuerza'],
  ['evogimnastica', 'EvoGimnástica'],
  ['evotodos', 'EvoTodos'],
])

const SENSITIVE_SIGNAL = /\b(dolor|lesi[oó]n|mareo|desmay(?:o|os|ada|adas|aron|arse)?|accidente|ca[ií]da|urgencia)\b/i
const MANY_CHANGES_THRESHOLD = {
  min_feedback: 5,
  min_change_rate_pct: 30,
  scope: 'per_week',
}

function normalized(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function canonicalClass(value) {
  return CLASS_LABELS.get(normalized(value)) || null
}

function safeWeek(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null
}

function isChanged(value) {
  return value === true || value === 'true' || value === 't' || value === 1 || value === '1'
}

function hasSensitiveSignal(row) {
  return ['changed_details', 'group_feelings', 'notes_next_week']
    .some((key) => SENSITIVE_SIGNAL.test(String(row?.[key] || '')))
}

function emptyWeek(date) {
  return {
    week_start_date: date,
    feedback_count: 0,
    changed_count: 0,
    low_rating_count: 0,
    timing_tight_count: 0,
    notes_next_week_count: 0,
    sensitive_review_count: 0,
  }
}

export function summarizeAtlasFeedback({ weekRows, feedbackRows, start, end }) {
  if (!Array.isArray(weekRows) || weekRows.length > 64) throw new Error('invalid_weeks')
  if (!Array.isArray(feedbackRows) || feedbackRows.length > 500) throw new Error('invalid_feedback')
  const weekById = new Map()
  const byWeek = new Map()
  for (const row of weekRows) {
    const id = String(row?.id || '')
    const week = safeWeek(row?.week_start_date)
    if (!id || !week || week < start || week > end) continue
    weekById.set(id, week)
    if (!byWeek.has(week)) byWeek.set(week, emptyWeek(week))
  }

  const classes = new Map()
  let unknownClassLabels = 0
  let accepted = 0
  for (const row of feedbackRows) {
    if (!row || typeof row !== 'object') continue
    const week = weekById.get(String(row.week_id || ''))
    if (!week) continue
    accepted += 1
    const target = byWeek.get(week)
    target.feedback_count += 1
    const changed = isChanged(row.changed_something)
    if (changed) target.changed_count += 1
    if (row.session_how === 'regular' || row.session_how === 'mal') target.low_rating_count += 1
    if (row.time_for_explanation === 'justo' || row.time_for_explanation === 'no') {
      target.timing_tight_count += 1
    }
    if (String(row.notes_next_week || '').trim()) target.notes_next_week_count += 1
    if (hasSensitiveSignal(row)) target.sensitive_review_count += 1

    const label = canonicalClass(row.class_label)
    if (!label) {
      unknownClassLabels += 1
      continue
    }
    const classTarget = classes.get(label) || { class_label: label, feedback_count: 0, changed_count: 0 }
    classTarget.feedback_count += 1
    if (changed) classTarget.changed_count += 1
    classes.set(label, classTarget)
  }

  const weeks = [...byWeek.values()].sort((a, b) => a.week_start_date.localeCompare(b.week_start_date))
  const manyChangeWeeks = weeks
    .map((row) => ({
      week_start_date: row.week_start_date,
      feedback_count: row.feedback_count,
      changed_count: row.changed_count,
      change_rate_pct: row.feedback_count
        ? Math.round((row.changed_count / row.feedback_count) * 1000) / 10
        : 0,
    }))
    .filter((row) => row.feedback_count >= MANY_CHANGES_THRESHOLD.min_feedback
      && row.change_rate_pct >= MANY_CHANGES_THRESHOLD.min_change_rate_pct)
  const totals = weeks.reduce((acc, row) => {
    for (const key of ['feedback_count', 'changed_count', 'low_rating_count', 'timing_tight_count',
      'notes_next_week_count', 'sensitive_review_count']) acc[key] += row[key]
    return acc
  }, emptyWeek(null))

  return {
    source: 'coach_session_feedback',
    period: { start, end },
    feedback_total: accepted,
    changed_total: totals.changed_count,
    change_rate_pct: accepted ? Math.round((totals.changed_count / accepted) * 1000) / 10 : null,
    low_rating_total: totals.low_rating_count,
    timing_tight_total: totals.timing_tight_count,
    notes_next_week_total: totals.notes_next_week_count,
    sensitive_review_total: totals.sensitive_review_count,
    unknown_class_labels: unknownClassLabels,
    weeks,
    changes_by_class: [...classes.values()].sort((a, b) =>
      b.changed_count - a.changed_count || a.class_label.localeCompare(b.class_label)),
    raw_text_returned: false,
    coach_names_returned: false,
    alert_thresholds: { many_changes: MANY_CHANGES_THRESHOLD },
    many_changes: {
      triggered: manyChangeWeeks.length > 0,
      weeks: manyChangeWeeks,
    },
  }
}

export function madridCurrentMonday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const date = new Date(`${values.year}-${values.month}-${values.day}T00:00:00Z`)
  const offset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - offset)
  return date.toISOString().slice(0, 10)
}

export function feedbackPeriod(now, weeks) {
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 8) throw new Error('invalid_weeks')
  const end = madridCurrentMonday(now)
  const startDate = new Date(`${end}T00:00:00Z`)
  startDate.setUTCDate(startDate.getUTCDate() - ((weeks - 1) * 7))
  return { start: startDate.toISOString().slice(0, 10), end }
}
