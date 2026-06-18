/** Modelo por defecto para generación / briefing de programación (Anthropic, jun 2026). */
export const DEFAULT_PROGRAMMING_MODEL = 'claude-sonnet-4-6'

/** Modelo por defecto para soporte coach (Haiku). */
export const DEFAULT_SUPPORT_MODEL = 'claude-haiku-4-5-20251001'

/** IDs retirados por Anthropic → reemplazo activo. */
const DEPRECATED_PROGRAMMING_MODELS = {
  'claude-sonnet-4-20250514': DEFAULT_PROGRAMMING_MODEL,
  'claude-opus-4-20250514': 'claude-opus-4-8',
  'claude-3-5-sonnet-20241022': DEFAULT_PROGRAMMING_MODEL,
  'claude-3-5-sonnet-latest': DEFAULT_PROGRAMMING_MODEL,
}

/** Normaliza el modelo pedido (env, body o default) al ID vigente en la API. */
export function resolveProgrammingModel(requested) {
  const raw = String(requested || '').trim()
  if (!raw) return DEFAULT_PROGRAMMING_MODEL
  return DEPRECATED_PROGRAMMING_MODELS[raw] || raw
}
