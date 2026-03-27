export const AI_CONFIG = {
  model: import.meta.env.VITE_CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
  anthropicVersion: '2023-06-01',
  maxTokens: 8000,
  coachMaxTokens: 2048,
}
