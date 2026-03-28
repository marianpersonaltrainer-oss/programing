/** Default: Claude Sonnet 4 (3.5 Sonnet 20241022 retired Oct 2025 — see Anthropic model deprecations). */
export const AI_CONFIG = {
  model: import.meta.env.VITE_CLAUDE_MODEL || 'claude-sonnet-4-20250514',
  anthropicVersion: '2023-06-01',
  maxTokens: 8000,
  coachMaxTokens: 2048,
}
