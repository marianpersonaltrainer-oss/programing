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
 */
export function mergeDayFromAiPatch(prevDia, aiDia) {
  if (!prevDia || typeof prevDia !== 'object') return prevDia
  if (!aiDia || typeof aiDia !== 'object') return { ...prevDia }
  const next = { ...prevDia }
  for (const k of DAY_MERGE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(aiDia, k)) continue
    const v = aiDia[k]
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
