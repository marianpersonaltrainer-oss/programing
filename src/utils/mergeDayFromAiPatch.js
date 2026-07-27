import { EVO_SESSION_CLASS_DEFS } from '../constants/evoClasses.js'

const DAY_MERGE_KEYS = new Set([
  'nombre',
  'wodbuster',
  ...EVO_SESSION_CLASS_DEFS.flatMap(({ key, feedbackKey }) => [key, feedbackKey]),
])

/**
 * Fusiona la salida del modelo sobre un día ya existente (solo claves conocidas).
 * @param {Record<string, unknown>} prevDia
 * @param {Record<string, unknown>} aiDia
 * @param {{allowHolidayCreation?: boolean}} options
 */
export function mergeDayFromAiPatch(
  prevDia,
  aiDia,
  { allowHolidayCreation = false } = {},
) {
  if (!prevDia || typeof prevDia !== 'object') return prevDia
  if (!aiDia || typeof aiDia !== 'object') return { ...prevDia }
  const next = { ...prevDia }
  const blockedHolidayFeedbackKeys = new Set()
  for (const { key, feedbackKey } of EVO_SESSION_CLASS_DEFS) {
    const previous = String(prevDia[key] ?? '').trim()
    const proposed = String(aiDia[key] ?? '').trim()
    if (
      !allowHolidayCreation &&
      /^FESTIVO\b/i.test(proposed) &&
      !/^FESTIVO\b/i.test(previous)
    ) {
      blockedHolidayFeedbackKeys.add(feedbackKey)
    }
  }
  for (const k of DAY_MERGE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(aiDia, k)) continue
    const classDef = EVO_SESSION_CLASS_DEFS.find(({ key }) => key === k)
    if (
      !allowHolidayCreation &&
      classDef &&
      /^FESTIVO\b/i.test(String(aiDia[k] ?? '').trim()) &&
      !/^FESTIVO\b/i.test(String(prevDia[k] ?? '').trim())
    ) {
      continue
    }
    if (blockedHolidayFeedbackKeys.has(k)) continue
    const v = aiDia[k]
    if (
      k === 'wodbuster' &&
      !allowHolidayCreation &&
      /^FESTIVO\b/i.test(String(v ?? '').trim())
    ) {
      continue
    }
    next[k] = v == null ? '' : typeof v === 'string' ? v : String(v)
  }
  return next
}

/** Clases cuyo texto de sesión (no feedback) ha cambiado entre dos snapshots del mismo día. */
export function listSessionFieldsChanged(prevDia, nextDia) {
  if (!prevDia || !nextDia) return []
  const out = []
  for (const { key, feedbackKey, label } of EVO_SESSION_CLASS_DEFS) {
    if (String(prevDia[key] ?? '') !== String(nextDia[key] ?? '')) {
      out.push({ key, feedbackKey, label })
    }
  }
  return out
}
