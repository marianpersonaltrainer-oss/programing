/**
 * Modelos y techos de salida para cada flujo que llama a `/api/anthropic`.
 * PROGRAMMING_MODEL: generación y edición de programación (Sonnet u homólogo).
 * SUPPORT_MODEL: chat coach Soporte y regeneración de feedback (Haiku u homólogo).
 */
export const PROGRAMMING_MODEL = import.meta.env.VITE_CLAUDE_MODEL || 'claude-sonnet-4-20250514'
export const SUPPORT_MODEL = import.meta.env.VITE_CLAUDE_SUPPORT_MODEL || 'claude-haiku-4-5-20251001'

export const AI_CONFIG = {
  /** @deprecated usar PROGRAMMING_MODEL */
  model: PROGRAMMING_MODEL,
  programmingModel: PROGRAMMING_MODEL,
  /** @deprecated usar SUPPORT_MODEL */
  supportModel: SUPPORT_MODEL,
  feedbackRegenerateMaxTokens: 1024,
  anthropicVersion: '2023-06-01',
  maxTokens: 8000,
  coachMaxTokens: 1024,
}
