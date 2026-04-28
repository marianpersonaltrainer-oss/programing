import { sanitizePromptTextForLLM } from './sanitizePromptTextForLLM.js'

export const REFERENCE_MESOCYCLE_CONTEXT_STORAGE_KEY = 'programingevo_reference_mesocycles_context'

/** Límite al pegar en el system para no disparar timeouts; el textarea del panel puede ser más largo. */
export const REFERENCE_MESOCYCLE_CONTEXT_PROMPT_MAX_CHARS = 18000

export function loadReferenceMesocycleContextRaw() {
  try {
    return String(localStorage.getItem(REFERENCE_MESOCYCLE_CONTEXT_STORAGE_KEY) || '')
  } catch {
    return ''
  }
}

export function saveReferenceMesocycleContextRaw(text) {
  try {
    localStorage.setItem(REFERENCE_MESOCYCLE_CONTEXT_STORAGE_KEY, String(text ?? ''))
  } catch {
    /* quota */
  }
}

/**
 * Texto listo para prompts: saneado y recortado.
 * @param {number} [maxChars]
 * @returns {string}
 */
export function getReferenceMesocycleContextForLLM(maxChars = REFERENCE_MESOCYCLE_CONTEXT_PROMPT_MAX_CHARS) {
  const t = sanitizePromptTextForLLM(loadReferenceMesocycleContextRaw()).trim()
  if (!t) return ''
  if (t.length <= maxChars) return t
  return `${t.slice(0, maxChars).trimEnd()}\n\n[…contexto de referencia truncado por límite técnico]`
}

/**
 * Igual que getReferenceMesocycleContextForLLM, pero partiendo de texto ya combinado externo.
 * @param {string} rawText
 * @param {number} [maxChars]
 * @returns {string}
 */
export function getReferenceMesocycleContextForLLMFromRaw(
  rawText,
  maxChars = REFERENCE_MESOCYCLE_CONTEXT_PROMPT_MAX_CHARS,
) {
  const t = sanitizePromptTextForLLM(String(rawText || '')).trim()
  if (!t) return ''
  if (t.length <= maxChars) return t
  return `${t.slice(0, maxChars).trimEnd()}\n\n[…contexto de referencia truncado por límite técnico]`
}

/**
 * Une contexto local + remoto evitando duplicados simples por bloque.
 * @param {string} localText
 * @param {string} remoteText
 */
export function mergeReferenceMesocycleContexts(localText, remoteText) {
  const parts = [String(localText || '').trim(), String(remoteText || '').trim()].filter(Boolean)
  if (!parts.length) return ''
  if (parts.length === 1) return parts[0]
  if (parts[0] === parts[1]) return parts[0]
  return `${parts[0]}\n\n${parts[1]}`
}

/**
 * Apéndice al system: extractos de otros mesociclos / Drive; instrucción explícita de no copiar.
 * @param {string} bodyForPrompt — ya saneado y acotado (p. ej. salida de getReferenceMesocycleContextForLLM)
 */
export function buildReferenceMesocycleSystemAppendix(bodyForPrompt) {
  const body = String(bodyForPrompt || '').trim()
  if (!body) return ''
  return `\n\n════════════════════════════════════════\nCONTEXTO DE REFERENCIA (OTROS MESOCICLOS / ARCHIVO — NO COPIAR)\n════════════════════════════════════════\n\nEste bloque son extractos o resúmenes de programación real previa del centro (Hub, Drive, notas). Úsalo solo como guía de ritmo en sala, timings y descansos realistas, rotación de formatos de fuerza/WOD y variedad que os han funcionado.\n\nPROHIBIDO devolver la misma sesión palabra por palabra ni copiar un día entero de aquí. Cada semana nueva debe ser original y alineada al mesociclo y al briefing actual; esto aporta “sabor EVO” y decisiones que sí os han ido bien, sin sustituir las reglas del método ni del mesociclo.\n\n---\n\n${body}`
}
