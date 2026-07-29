import { DEFAULT_PROGRAMMING_MODEL, DEFAULT_SUPPORT_MODEL, resolveProgrammingModel } from './aiModels.js'

/**
 * Modelos y techos de salida para cada flujo que llama a `/api/anthropic`.
 * PROGRAMMING_MODEL: generación y edición de programación.
 * SUPPORT_MODEL: regeneración aislada de feedback y soporte.
 */
export const PROGRAMMING_MODEL = resolveProgrammingModel(import.meta.env.VITE_OPENAI_MODEL)
export const SUPPORT_MODEL =
  import.meta.env.VITE_OPENAI_SUPPORT_MODEL?.trim() || DEFAULT_SUPPORT_MODEL
/** Adaptaciones del WOD requieren el mismo razonamiento que la programación. */
export const COACH_ASSISTANT_MODEL =
  import.meta.env.VITE_OPENAI_COACH_ASSISTANT_MODEL?.trim() || PROGRAMMING_MODEL

export const AI_CONFIG = {
  feedbackRegenerateMaxTokens: 1024,
  maxTokens: 8000,
  coachMaxTokens: 1600,
}
