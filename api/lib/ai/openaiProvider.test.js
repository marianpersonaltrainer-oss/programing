import { describe, expect, it, vi } from 'vitest'
import { requestOpenAiStructuredOutput } from './openaiProvider.js'
import { AI_ERROR_CODES } from './providerErrors.js'

const base = { apiKey: 'test-key', model: 'gpt-test', messages: [{ role: 'user', content: 'ok' }], schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false } }
const clientFor = (implementation) => ({ responses: { create: vi.fn(implementation) } })

describe('OpenAI provider Structured Outputs', () => {
  it('conecta con Responses API y exige JSON Schema estricto', async () => {
    const client = clientFor(async () => ({ id: 'resp_1', model: 'gpt-test', output_text: '{"ok":true}', usage: { input_tokens: 2, output_tokens: 3 } }))
    const result = await requestOpenAiStructuredOutput({ ...base, client })
    expect(result.output).toEqual({ ok: true })
    expect(result.provider).toBe('openai')
    expect(client.responses.create).toHaveBeenCalledWith(expect.objectContaining({ text: { format: expect.objectContaining({ type: 'json_schema', strict: true, schema: base.schema }) } }), expect.anything())
  })

  it.each([
    [401, 'invalid_api_key', AI_ERROR_CODES.INVALID_API_KEY],
    [429, 'insufficient_quota', AI_ERROR_CODES.INSUFFICIENT_CREDIT],
    [429, 'rate_limit_exceeded', AI_ERROR_CODES.RATE_LIMIT],
    [404, 'model_not_found', AI_ERROR_CODES.MODEL_UNAVAILABLE],
  ])('clasifica HTTP %s/%s', async (status, code, expected) => {
    const error = Object.assign(new Error(code), { status, error: { code } })
    await expect(requestOpenAiStructuredOutput({ ...base, client: clientFor(async () => { throw error }) })).rejects.toMatchObject({ code: expected, provider: 'openai' })
  })

  it('clasifica timeout y red sin filtrar la clave', async () => {
    const timeout = Object.assign(new Error('request timed out'), { name: 'AbortError' })
    await expect(requestOpenAiStructuredOutput({ ...base, client: clientFor(async () => { throw timeout }) })).rejects.toMatchObject({ code: AI_ERROR_CODES.TIMEOUT, status: 504 })
    await expect(requestOpenAiStructuredOutput({ ...base, client: clientFor(async () => { throw new Error('socket closed') }) })).rejects.toMatchObject({ code: AI_ERROR_CODES.NETWORK })
  })

  it('rechaza Structured Output inválido', async () => {
    const client = clientFor(async () => ({ id: 'resp_bad', output_text: '{bad' }))
    await expect(requestOpenAiStructuredOutput({ ...base, client })).rejects.toMatchObject({ code: AI_ERROR_CODES.INVALID_OUTPUT })
  })
})
