import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_STRUCTURED_AI_PROVIDER,
  STRUCTURED_AI_ERROR_CODES,
  StructuredAiProviderConfigurationError,
  StructuredAiRequestError,
  createStructuredAiRequester,
  isStructuredAiRequestError,
} from './structuredAiProvider.js'

describe('structured AI provider contract', () => {
  it('mantiene Anthropic como proveedor efectivo por defecto', async () => {
    const adapter = vi.fn().mockResolvedValue({
      output: { ok: true },
      model: 'claude-test',
      providerRequestId: 'req-one',
    })
    const request = createStructuredAiRequester({
      adapters: { anthropic: adapter },
    })

    const input = { model: 'claude-test', messages: [{ role: 'user', content: 'hola' }] }
    const result = await request(input)

    expect(DEFAULT_STRUCTURED_AI_PROVIDER).toBe('anthropic')
    expect(adapter).toHaveBeenCalledWith(input)
    expect(result).toEqual({
      output: { ok: true },
      model: 'claude-test',
      providerRequestId: 'req-one',
      provider: 'anthropic',
    })
  })

  it('permite inyectar otro adaptador sin cambiar el contrato del consumidor', async () => {
    const adapter = vi.fn().mockResolvedValue({ output: { dia: {} }, usage: null })
    const request = createStructuredAiRequester({
      provider: 'openai-test',
      adapters: { 'openai-test': adapter },
    })

    await expect(request({ schema: { type: 'object' } })).resolves.toMatchObject({
      output: { dia: {} },
      provider: 'openai-test',
    })
  })

  it('falla cerrado si el proveedor no tiene adaptador registrado', () => {
    expect(() => createStructuredAiRequester({ provider: 'unknown', adapters: {} }))
      .toThrow(StructuredAiProviderConfigurationError)
  })

  it('expone errores neutrales compatibles con el adaptador actual', () => {
    const error = new StructuredAiRequestError('timeout', {
      code: STRUCTURED_AI_ERROR_CODES.TIMEOUT,
      status: 504,
      retriable: true,
    })
    expect(isStructuredAiRequestError(error)).toBe(true)
    expect(error).toMatchObject({
      name: 'AnthropicStructuredRequestError',
      code: 'upstream_timeout',
      status: 504,
      retriable: true,
    })
  })
})
