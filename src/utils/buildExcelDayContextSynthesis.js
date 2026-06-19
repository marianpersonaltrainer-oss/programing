import { dayNombreToFeedbackKey } from '../components/CoachView/coachViewUtils.js'
import { EVO_SESSION_CLASS_DEFS } from '../constants/evoClasses.js'
import { buildContextSynthesis } from './buildContextSynthesis.js'

const MAX_SYNTHESIS_CHARS = 2800

function isPlaceholderSession(text) {
  const t = String(text || '').trim()
  return !t || /^\(no programada esta semana\)\s*$/i.test(t) || /^FESTIVO\b/i.test(t)
}

/** Acumulador Excel (`acc.dias`) → `weekState.sessions` con `confirmed: true`. */
export function excelAccumulatorToWeekState(acc) {
  const sessions = {}
  for (const dia of acc?.dias || []) {
    const dayKey = dayNombreToFeedbackKey(dia?.nombre)
    if (!dayKey) continue

    const parts = []
    const classes = []
    for (const { key, label } of EVO_SESSION_CLASS_DEFS) {
      const t = String(dia[key] || '').trim()
      if (isPlaceholderSession(t)) continue
      parts.push(`${label}:\n${t}`)
      classes.push(label)
    }

    const content = parts.join('\n\n')
    if (!content.trim()) continue
    sessions[dayKey] = { content, classes, confirmed: true }
  }

  return { sessions }
}

/**
 * Síntesis de contexto para un día del generador Excel (balance intra-semana + mesociclo).
 *
 * @param {object} opts
 * @param {object} opts.acc — acumulador de la semana en generación
 * @param {string|null} opts.targetDay — clave DAYS_ORDER (p. ej. `wednesday`)
 * @param {object[]} opts.exerciseLibraryRows
 * @param {object[]} opts.previousWeeks
 * @param {object[]} opts.coachFeedback
 */
export function buildExcelDayContextSynthesis({
  acc,
  targetDay,
  exerciseLibraryRows,
  previousWeeks,
  coachFeedback,
}) {
  if (!targetDay) return ''

  const weekState = excelAccumulatorToWeekState(acc)
  let out = buildContextSynthesis({
    weekState,
    exerciseLibraryRows,
    previousWeeks,
    coachFeedback,
    targetDay,
  })

  if (!out) return ''
  if (out.length > MAX_SYNTHESIS_CHARS) {
    out = `${out.slice(0, MAX_SYNTHESIS_CHARS).trimEnd()}…\n[Síntesis recortada por límite técnico]`
  }
  return out
}

/** `LUNES` / `MIÉRCOLES` → clave `monday` / `wednesday`. */
export function excelCanonDayToTargetDay(canonDayName) {
  return dayNombreToFeedbackKey(canonDayName)
}
