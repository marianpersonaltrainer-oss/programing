import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('/api/anthropic compatibility endpoint', () => {
  const source = readFileSync(new URL('./anthropic.js', import.meta.url), 'utf8')

  it('mantiene OpenAI como principal y aplica el fallback Anthropic configurado', () => {
    expect(source).toContain("fetch('https://api.openai.com/v1/responses'")
    expect(source).toContain("fetch('https://api.anthropic.com/v1/messages'")
    expect(source).toContain('AI_ANTHROPIC_FALLBACK')
    expect(source).toContain('ANTHROPIC_FALLBACK_MODEL')
    expect(source).toContain('await requestAnthropicFallback()')
  })

  it('no envía el modelo OpenAI al fallback Claude', () => {
    expect(source).toContain('model: anthropicFallbackModel')
    expect(source).toContain("ANTHROPIC_FALLBACK_MODEL || 'claude-sonnet-4-6'")
  })
})
