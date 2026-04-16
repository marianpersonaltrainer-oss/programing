import { DAYS_ES, DAYS_ORDER } from '../constants/evoColors.js'
import { coachFeedbackRowIndicatesChange } from './coachSessionFeedback.js'
import { sanitizePromptTextForLLM } from './sanitizePromptTextForLLM.js'

const HOW_LABEL = {
  muy_bien: 'Muy bien',
  bien: 'Bien',
  regular: 'Regular',
  mal: 'Mal',
}

const MAX_BLOCK_CHARS = 1000
const MAX_NOTE_LINE_CHARS = 180

/**
 * Texto para inyectar en el prompt del generador Excel (semana publicada inmediatamente anterior).
 * @param {object[]} rows — filas `coach_session_feedback`
 * @returns {string} vacío si no hay filas
 */
export function formatPreviousWeekCoachFeedbackForPrompt(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return ''

  const orderIdx = Object.fromEntries(DAYS_ORDER.map((d, i) => [d, i]))
  const sorted = [...rows].sort((a, b) => {
    const da = orderIdx[a.day_key] ?? 99
    const db = orderIdx[b.day_key] ?? 99
    if (da !== db) return da - db
    return String(a.class_label || '').localeCompare(String(b.class_label || ''))
  })

  const lines = ['FEEDBACK REAL DE COACHES — SEMANA ANTERIOR:']

  for (const r of sorted) {
    const day = DAYS_ES[r.day_key] || r.day_key || '—'
    const cls = String(r.class_label || '—').trim()
    const coach = String(r.coach_name || 'Coach').trim()
    const how = HOW_LABEL[r.session_how] || String(r.session_how || '—').trim()
    lines.push(`- ${day} ${cls} (${coach}): ${how}`)
  }

  const adaptCount = sorted.filter((r) => coachFeedbackRowIndicatesChange(r)).length
  if (adaptCount > 0) {
    lines.push(
      `- ${adaptCount} sesión${adaptCount === 1 ? '' : 'es'} requirieron adaptación en sala`,
    )
  }

  for (const r of sorted) {
    const note = String(r.notes_next_week || '').trim()
    if (!note) continue
    const day = DAYS_ES[r.day_key] || r.day_key
    const cls = String(r.class_label || '').trim()
    const clipped = note.length > MAX_NOTE_LINE_CHARS ? `${note.slice(0, MAX_NOTE_LINE_CHARS)}…` : note
    lines.push(`- Nota (${day} ${cls}): ${clipped}`)
  }

  for (const r of sorted) {
    if (!coachFeedbackRowIndicatesChange(r)) continue
    const det = String(r.changed_details || '').trim()
    if (!det) continue
    const day = DAYS_ES[r.day_key] || r.day_key
    const cls = String(r.class_label || '').trim()
    const clipped = det.length > MAX_NOTE_LINE_CHARS ? `${det.slice(0, MAX_NOTE_LINE_CHARS)}…` : det
    lines.push(`- Adaptación (${day} ${cls}): ${clipped}`)
  }

  let raw = lines.join('\n')
  raw = sanitizePromptTextForLLM(raw).trim()
  if (raw.length > MAX_BLOCK_CHARS) {
    raw = `${raw.slice(0, MAX_BLOCK_CHARS - 40).trim()}\n[…truncado por límite de tamaño]`
  }
  return raw
}
