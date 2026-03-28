/**
 * Modelos y techos de salida para cada flujo que llama a `/api/anthropic`.
 * Resumen de llamadas y costes orientativos: ver `API_COSTS.md` en la raíz del repo.
 *
 * Sonnet por defecto: Claude 4 (el 3.5-sonnet 20241022 está retirado en la API).
 */
export const AI_CONFIG = {
  /** Programación semanal + agente Marian (useAgent). */
  model: import.meta.env.VITE_CLAUDE_MODEL || 'claude-sonnet-4-20250514',
  /** Chat soporte coach (?coach). */
  supportModel: import.meta.env.VITE_CLAUDE_SUPPORT_MODEL || 'claude-haiku-4-5-20251001',
  /** Regenerar solo feedback (modal Excel, una clase). */
  feedbackRegenerateMaxTokens: 1024,
  anthropicVersion: '2023-06-01',
  maxTokens: 8000,
  coachMaxTokens: 1024,
}
