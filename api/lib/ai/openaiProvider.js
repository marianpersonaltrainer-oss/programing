import OpenAI from 'openai'
import { AI_ERROR_CODES, AiProviderError, classifyOpenAiError, errorStatusForCode } from './providerErrors.js'

export const OPENAI_DEFAULT_TIMEOUT_MS = 75_000
export const OPENAI_MAX_TIMEOUT_MS = 90_000

const boundedTimeout = (value) => Math.min(Math.max(1, Number(value) || OPENAI_DEFAULT_TIMEOUT_MS), OPENAI_MAX_TIMEOUT_MS)

export async function requestOpenAiStructuredOutput({
  apiKey, model, messages, schema, system, maxTokens = 5_500,
  timeoutMs = OPENAI_DEFAULT_TIMEOUT_MS, signal, parseOutput = JSON.parse,
  schemaName = 'evo_response', client,
}) {
  const missing = []
  if (!String(apiKey || '').trim() && !client) missing.push('apiKey')
  if (!String(model || '').trim()) missing.push('model')
  if (!Array.isArray(messages) || !messages.length) missing.push('messages')
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) missing.push('schema')
  if (missing.length) throw new AiProviderError(`Petición Structured Outputs incompleta: ${missing.join(', ')}.`, { code: AI_ERROR_CODES.INVALID_REQUEST, status: 400, provider: 'openai' })

  const timeout = boundedTimeout(timeoutMs)
  const sdk = client || new OpenAI({ apiKey: String(apiKey).trim(), timeout, maxRetries: 0 })
  const startedAt = Date.now()
  try {
    const response = await sdk.responses.create({
      model: String(model).trim(),
      instructions: system === undefined ? undefined : String(system),
      input: messages,
      max_output_tokens: Math.max(1, Math.floor(Number(maxTokens) || 5_500)),
      text: { format: { type: 'json_schema', name: schemaName, strict: true, schema } },
    }, { signal, timeout })
    const assistantText = String(response?.output_text || '').trim()
    if (!assistantText) throw new AiProviderError('OpenAI no devolvió texto estructurado.', { code: AI_ERROR_CODES.INVALID_OUTPUT, status: 502, provider: 'openai', providerRequestId: response?._request_id || response?.id, retriable: false })
    let output
    try { output = parseOutput(assistantText) } catch (cause) {
      throw new AiProviderError('Structured Outputs de OpenAI no contiene JSON válido.', { code: AI_ERROR_CODES.INVALID_OUTPUT, status: 502, provider: 'openai', providerRequestId: response?._request_id || response?.id, cause })
    }
    return {
      output, assistantText, provider: 'openai',
      providerRequestId: response?._request_id || response?.id || null,
      model: response?.model || String(model).trim(), usage: response?.usage || null,
      stopReason: response?.status || null, durationMs: Date.now() - startedAt,
    }
  } catch (error) {
    if (error instanceof AiProviderError) throw error
    const code = classifyOpenAiError(error)
    throw new AiProviderError(error?.message || 'No se pudo contactar con OpenAI.', {
      code, status: errorStatusForCode(code), provider: 'openai',
      providerRequestId: error?.request_id || error?.headers?.get?.('x-request-id') || null,
      retriable: [AI_ERROR_CODES.TIMEOUT, AI_ERROR_CODES.RATE_LIMIT, AI_ERROR_CODES.NETWORK].includes(code), cause: error,
      details: { durationMs: Date.now() - startedAt, model: String(model).trim() },
    })
  }
}
