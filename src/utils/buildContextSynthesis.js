import { DAYS_ES, DAYS_ORDER } from '../constants/evoColors.js'
import { dayNombreToFeedbackKey } from '../components/CoachView/coachViewUtils.js'
import { extractPatternFromSession } from './extractPatternFromSession.js'

const FREQ_EXERCISES = [
  { label: 'Wall Ball', re: /\bwall\s*ball\b/i },
  { label: 'KB Swing', re: /\bkb\s*swing\b|\bkettlebell\s*swing\b/i },
  { label: 'Push-up', re: /\bpush[\s-]?up\b|\bpushup\b/i },
  { label: 'Burpee', re: /\bburpee?s?\b/i },
  { label: 'Box Jump', re: /\bbox\s*jump\b/i },
]

function safeWeekText(day, keys) {
  for (const k of keys) {
    const val = day?.[k]
    if (String(val || '').trim()) return val
  }
  return ''
}

function getPreviousDayKeys(targetDay) {
  if (!targetDay) return []
  const idx = DAYS_ORDER.indexOf(targetDay)
  if (idx <= 0) return []
  const keys = []
  if (idx >= 1) keys.push(DAYS_ORDER[idx - 1])
  if (idx >= 2) keys.push(DAYS_ORDER[idx - 2])
  return keys
}

function countFrequencyInText(text, re) {
  const matches = String(text || '').match(re)
  return matches ? matches.length : 0
}

function buildConfirmedSessionsBlock(weekState, exerciseLibraryRows) {
  const sessions = weekState?.sessions || {}
  const lines = []

  for (const day of DAYS_ORDER) {
    const session = sessions[day]
    if (!session?.confirmed) continue

    const content = String(session.content || '')
    const { patterns, exercises } = extractPatternFromSession(content, exerciseLibraryRows)
    const classes = Array.isArray(session.classes) && session.classes.length
      ? session.classes.join(', ')
      : '—'
    const dayLabel = (DAYS_ES[day] || day).toUpperCase()
    const patternList = patterns.length ? patterns.join(', ') : '—'
    const exerciseList = exercises.length ? exercises.join(', ') : '—'

    lines.push(`${dayLabel}: ${classes} — patrones: ${patternList} — ejercicios: ${exerciseList}`)
  }

  return lines.length ? lines.join('\n') : '(Ninguna sesión confirmada aún)'
}

function buildNoRepeatBlock(weekState, exerciseLibraryRows, targetDay) {
  const prevKeys = getPreviousDayKeys(targetDay)
  if (!prevKeys.length) {
    return '(Sin día objetivo — no aplica)'
  }

  const sessions = weekState?.sessions || {}
  const avoidExercises = new Set()
  const avoidPatterns = new Set()

  for (const dayKey of prevKeys) {
    const session = sessions[dayKey]
    if (!session?.confirmed) continue
    const { exercises, patterns } = extractPatternFromSession(session.content, exerciseLibraryRows)
    exercises.forEach((e) => avoidExercises.add(e))
    patterns.forEach((p) => avoidPatterns.add(p))
  }

  const parts = []
  if (avoidExercises.size) {
    parts.push(`Ejercicios: ${[...avoidExercises].join(', ')}`)
  }
  if (avoidPatterns.size) {
    parts.push(`Patrones: ${[...avoidPatterns].join(', ')}`)
  }

  return parts.length ? parts.join('\n') : '(Nada confirmado ayer ni anteayer)'
}

function buildFrequencyBlock(weekState) {
  const sessions = weekState?.sessions || {}
  let weekText = ''

  for (const day of DAYS_ORDER) {
    const session = sessions[day]
    if (!session?.confirmed) continue
    weekText += `\n${session.content || ''}`
  }

  return FREQ_EXERCISES.map(({ label, re }) => {
    const count = countFrequencyInText(weekText, re)
    return `${label}: ${Math.min(count, 2)}/2`
  }).join('\n')
}

function buildCoachFeedbackBlock(coachFeedback) {
  const entries = Array.isArray(coachFeedback) ? coachFeedback : []
  const withNotes = entries.filter((e) => String(e?.notes_next_week || '').trim())

  if (!withNotes.length) {
    return '(Sin feedback aplicable)'
  }

  const byClass = new Map()
  for (const row of withNotes) {
    const klass = String(row?.class_label || 'Clase').trim()
    const semana = Number(row?.semana || 0)
    const note = String(row.notes_next_week).trim()
    const line = semana ? `Semana ${semana}: ${note}` : note
    if (!byClass.has(klass)) byClass.set(klass, [])
    byClass.get(klass).push(line)
  }

  const lines = []
  for (const [klass, notes] of byClass) {
    lines.push(`${klass}:`)
    notes.forEach((n) => lines.push(`  ${n}`))
  }

  return lines.join('\n')
}

function buildSameDayPreviousWeeksBlock(previousWeeks, targetDay, exerciseLibraryRows) {
  if (!targetDay) {
    return '(Sin día objetivo — no aplica)'
  }

  const weeks = Array.isArray(previousWeeks) ? previousWeeks : []
  if (!weeks.length) {
    return '(Sin semanas previas conectadas)'
  }

  const lines = []
  for (const week of weeks) {
    const semana = Number(week?.semana || 0)
    const dias = Array.isArray(week?.dias) ? week.dias : []
    const dia = dias.find((d) => dayNombreToFeedbackKey(d?.nombre) === targetDay)
    if (!dia) continue

    const ef = safeWeekText(dia, ['wodFuncional', 'evofuncional'])
    const fit = safeWeekText(dia, ['wodFit', 'evofit'])
    const basics = safeWeekText(dia, ['wodBasics', 'evobasics'])
    const chunks = [ef, fit, basics].filter(Boolean)

    if (!chunks.length) continue

    const combined = chunks.join('\n')
    const { patterns } = extractPatternFromSession(combined, exerciseLibraryRows)
    const patternNote = patterns.length ? ` [patrones: ${patterns.join(', ')}]` : ''
    const preview = combined.replace(/\s+/g, ' ').trim().slice(0, 120)
    lines.push(`Semana ${semana}: ${preview}${patternNote}`)
  }

  if (!lines.length) {
    return '(Sin programación previa para este día)'
  }

  return `${lines.join('\n')}\n→ Varía respecto a lo anterior.`
}

/**
 * @param {object} opts
 * @param {object} opts.weekState
 * @param {object[]} opts.exerciseLibraryRows
 * @param {object[]} opts.previousWeeks
 * @param {object[]} opts.coachFeedback
 * @param {string|null} opts.targetDay
 * @returns {string}
 */
export function buildContextSynthesis({
  weekState,
  exerciseLibraryRows,
  previousWeeks,
  coachFeedback,
  targetDay,
}) {
  if (!weekState) return ''

  const headerDay = targetDay
    ? (DAYS_ES[targetDay] || targetDay).toUpperCase()
    : null

  const header = headerDay
    ? `════════════════════════════════════════\nSÍNTESIS DE CONTEXTO — ${headerDay}\n════════════════════════════════════════`
    : `════════════════════════════════════════\nSÍNTESIS DE CONTEXTO\n════════════════════════════════════════`

  const sections = [
    header,
    '',
    'SESIONES CONFIRMADAS ESTA SEMANA:',
    buildConfirmedSessionsBlock(weekState, exerciseLibraryRows),
    '',
    '⛔ NO REPETIR HOY (trabajados ayer o anteayer):',
    buildNoRepeatBlock(weekState, exerciseLibraryRows, targetDay),
    '',
    '📊 FRECUENCIA SEMANAL (máx. 2 veces):',
    buildFrequencyBlock(weekState),
    '',
    '💬 FEEDBACK DE COACHES (semanas anteriores, aplicable ahora):',
    buildCoachFeedbackBlock(coachFeedback),
    '',
    '📅 MISMO DÍA EN SEMANAS PREVIAS DEL MESOCICLO:',
    buildSameDayPreviousWeeksBlock(previousWeeks, targetDay, exerciseLibraryRows),
  ]

  return sections.join('\n')
}
