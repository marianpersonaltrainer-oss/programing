import { DEFAULT_PROGRAMMING_MODEL, DEFAULT_SUPPORT_MODEL, resolveProgrammingModel } from './anthropicModels.js'

/**
 * Modelos y techos de salida para cada flujo que llama a `/api/anthropic`.
 * PROGRAMMING_MODEL: generación y edición de programación (Sonnet u homólogo).
 * SUPPORT_MODEL: regeneración aislada de feedback (Haiku u homólogo).
 */
export const PROGRAMMING_MODEL = resolveProgrammingModel(import.meta.env.VITE_CLAUDE_MODEL)
export const SUPPORT_MODEL =
  import.meta.env.VITE_CLAUDE_SUPPORT_MODEL?.trim() || DEFAULT_SUPPORT_MODEL
/** Adaptaciones del WOD requieren el mismo razonamiento que la programación. */
export const COACH_ASSISTANT_MODEL =
  import.meta.env.VITE_CLAUDE_COACH_ASSISTANT_MODEL?.trim() || PROGRAMMING_MODEL

export const AI_CONFIG = {
  feedbackRegenerateMaxTokens: 1024,
  anthropicVersion: '2023-06-01',
  maxTokens: 8000,
  coachMaxTokens: 1600,
}
