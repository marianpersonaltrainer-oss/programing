export const AI_CONFIG = {
  model: import.meta.env.VITE_CLAUDE_MODEL || 'claude-3-haiku-20240307',
  anthropicVersion: '2023-06-01',
  maxTokens: 4000,
  coachMaxTokens: 2048,
}
