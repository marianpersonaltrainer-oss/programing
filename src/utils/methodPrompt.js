/**
 * Constructor compartido del bloque de método para Chat V1, Excel y edición diaria.
 * Capas: método canónico versionado + decisiones manuales confirmadas.
 * Las observaciones automáticas permanecen fuera del prompt hasta aprobación.
 */
import {
  METHOD_EVO_V1_PROMPT,
  METHOD_EVO_V1_VERSION,
  buildMethodEvoV1Prompt,
} from '../domain/method/methodEvoV1.js'
import { sanitizePromptTextForLLM } from './sanitizePromptTextForLLM.js'
import { loadLearnedState } from './methodLearnedStorage.js'

export const DEFAULT_METHOD = METHOD_EVO_V1_PROMPT

/**
 * Los prompts V1 ya incluyen el contrato de salida y la política de feedback en
 * su núcleo compartido. Esta proyección evita enviarlos una segunda vez.
 */
export const RUNTIME_METHOD_APPENDIX = buildMethodEvoV1Prompt({
  includeOutputContract: false,
  includeFeedbackPolicy: false,
})

/** Presupuesto compartido suficiente para el contrato completo y decisiones manuales. */
export const METHOD_PROMPT_MAX_CHARS = 32000

export const METHOD_PROMPT_HEADER = `════════════════════════════════════════
MÉTODO EVO ${METHOD_EVO_V1_VERSION} Y DECISIONES CONFIRMADAS
════════════════════════════════════════`

const MANUAL_SECTION_HEADER = `════════════════════════════════════════
DECISIONES MANUALES CONFIRMADAS POR MARIAN
════════════════════════════════════════
Estas decisiones pueden concretar preferencias y posibilidades. No modifican un no negociable ni una regla operativa hard sin una nueva versión aprobada del método; si hay contradicción, aplica el contrato versionado y señálala.`

/** Recorta texto al final con elipsis si hace falta. */
function truncateTail(text, maxLen) {
  const value = String(text || '').trim()
  if (maxLen <= 0 || !value) return ''
  if (value.length <= maxLen) return value
  if (maxLen <= 1) return '…'
  return `${value.slice(0, maxLen - 1).trim()}…`
}

/**
 * Aplica presupuesto con prioridad estricta:
 * 1. Método base versionado.
 * 2. Decisiones manuales confirmadas.
 *
 * `auto` se acepta para compatibilidad de llamada, pero no se inyecta: sigue siendo
 * propuesta pendiente en localStorage hasta aprobación explícita.
 */
export function applyMethodPromptBudget({ base, manual, auto: _auto, maxChars }) {
  const baseClean = sanitizePromptTextForLLM(base).trim()
  if (!baseClean) return ''

  if (baseClean.length >= maxChars) return truncateTail(baseClean, maxChars)

  const manualClean = sanitizePromptTextForLLM(manual).trim()
  if (!manualClean) return baseClean

  const prefix = `\n\n${MANUAL_SECTION_HEADER}\n\n`
  const remaining = maxChars - baseClean.length - prefix.length
  if (remaining <= 0) return baseClean

  return `${baseClean}${prefix}${truncateTail(manualClean, remaining)}`
}

/**
 * Cuerpo del método sin encabezado externo.
 * @param {{ baseMethod?: string, learnedState?: { manual?: string, auto?: Array<object> }, maxChars?: number }} [options]
 */
export function buildMethodBody(options = {}) {
  const base = options.baseMethod ?? DEFAULT_METHOD
  const learnedState = options.learnedState ?? loadLearnedState()
  const maxChars = options.maxChars ?? METHOD_PROMPT_MAX_CHARS

  return applyMethodPromptBudget({
    base,
    manual: learnedState.manual ?? '',
    auto: learnedState.auto ?? [],
    maxChars,
  })
}

/** Bloque completo listo para anexar al system prompt de cualquier flujo V1. */
export function buildMethodPromptAppendix(options = {}) {
  const body = buildMethodBody({
    ...options,
    baseMethod: options.baseMethod ?? RUNTIME_METHOD_APPENDIX,
  })
  if (!body || !body.trim()) return ''
  return `${METHOD_PROMPT_HEADER}\n\n${body}`.trim()
}
