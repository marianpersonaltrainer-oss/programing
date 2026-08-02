import { describe, expect, it } from 'vitest'
import { getAiProviderConfig, hasConfiguredAiProvider } from './provider.js'

describe('configuración neutral de proveedores', () => {
  it('elige OpenAI como proveedor principal y nunca lee una clave VITE_', () => {
    const config = getAiProviderConfig({ OPENAI_API_KEY: 'server-only', VITE_OPENAI_API_KEY: 'forbidden' })
    expect(config).toMatchObject({ provider: 'openai', openaiApiKey: 'server-only', anthropicFallback: false })
    expect(JSON.stringify(config)).not.toContain('forbidden')
    expect(hasConfiguredAiProvider(config)).toBe(true)
  })

  it('Claude queda desactivado salvo configuración explícita', () => {
    const disabled = getAiProviderConfig({ ANTHROPIC_API_KEY: 'backup' })
    const enabled = getAiProviderConfig({ OPENAI_API_KEY: 'primary', ANTHROPIC_API_KEY: 'backup', AI_ANTHROPIC_FALLBACK: 'true' })
    expect(disabled.anthropicFallback).toBe(false)
    expect(hasConfiguredAiProvider(disabled)).toBe(false)
    expect(enabled.anthropicFallback).toBe(true)
    expect(enabled.anthropicFallbackModel).toBe('claude-sonnet-4-6')
  })
})
