/** Presupuesto coherente briefing: 1 llamada Anthropic = 75 s; retry solo si queda margen. */
export const BRIEFING_UPSTREAM_CALL_MS = 75_000
/** Techo total servidor (Vercel function = 180 s). */
export const BRIEFING_SERVER_TOTAL_BUDGET_MS = 170_000
/** Margen mínimo restante para permitir un segundo intento Anthropic. */
export const BRIEFING_RETRY_MIN_REMAINING_MS = 82_000
/** Cliente: contexto Supabase (sin IA). */
export const BRIEFING_CONTEXT_CLIENT_TIMEOUT_MS = 45_000
/** Cliente: propuesta IA (hasta 2×75 s + overhead). */
export const BRIEFING_PROPOSAL_CLIENT_TIMEOUT_MS = 175_000

export function briefingBudgetRemainingMs(startedAtMs, nowMs = Date.now()) {
  return Math.max(0, BRIEFING_SERVER_TOTAL_BUDGET_MS - (nowMs - startedAtMs))
}

export function canRetryBriefingAnthropic(startedAtMs, nowMs = Date.now()) {
  return briefingBudgetRemainingMs(startedAtMs, nowMs) >= BRIEFING_RETRY_MIN_REMAINING_MS
}
