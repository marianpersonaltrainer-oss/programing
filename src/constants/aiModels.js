/** Modelos de servidor. Nunca se leen claves desde variables VITE_ del cliente. */
export const DEFAULT_PROGRAMMING_MODEL = 'gpt-5.4'
export const DEFAULT_SUPPORT_MODEL = 'gpt-5.4-mini'

export function resolveProgrammingModel(value) {
  const candidate = String(value || DEFAULT_PROGRAMMING_MODEL).trim()
  return !candidate || candidate.toLowerCase().startsWith('claude-') ? DEFAULT_PROGRAMMING_MODEL : candidate
}
