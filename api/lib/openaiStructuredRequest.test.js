import { afterEach, describe, expect, it, vi } from 'vitest'
import { EVO_DAY_OUTPUT_SCHEMA } from '../../src/constants/evoDayOutputSchema.js'
import {
  OPENAI_STRUCTURED_ERROR_CODES,
  OPENAI_STRUCTURED_MAX_TIMEOUT_MS,
  normalizeOpenAiStructuredTimeoutMs,
  requestOpenAiStructuredOutput,
} from './openaiStructuredRequest.js'

const DAY_OUTPUT = {
  dia: {
    nombre: 'LUNES',
    evofuncional: 'A) Fuerza\nB) Metcon',
    feedback_funcional: 'Controlar la carga.',
    evobasics: '',
    feedback_basics: '',
    evofit: '',
    feedback_fit: '',
    evohybrix: '',
    feedback_hybrix: '',
    evofuerza: '',
    feedback_fuerza: '',
    evogimnastica: '',
    feedback_gimnastica: '',
    evotodos: '',
    feedback_evotodos: '',
    wodbuster: '',
  },
}

function response({ status = 200, body, headers = {} }) {
  const normalizedHeaders = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  )
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (key) => normalizedHeaders.get(String(key).toLowerCase()) || null,
    },
    text: vi.fn().mockResolvedValue(body),
  }
}

function baseRequest(fetchImpl, overrides = {}) {
  return requestOpenAiStructuredOutput({
    apiKey: 'test-key',
    model: 'gpt-test',
    system: 'Devuelve el contrato EVO.',
    messages: [{ role: 'user', content: 'Genera el lunes.' }],
    schema: EVO_DAY_OUTPUT_SCHEMA,
    timeoutMs: 5_000,
    fetchImpl,
    ...overrides,
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('requestOpenAiStructuredOutput', () => {
  it('envía JSON Schema estricto y devuelve el mismo contrato neutral', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        body: JSON.stringify({
          id: 'resp_123',
          model: 'gpt-test-snapshot',
          status: 'completed',
          usage: { input_tokens: 21, output_tokens: 43, total_tokens: 64 },
          output: [{
            type: 'message',
            content: [{ type: 'output_text', text: JSON.stringify(DAY_OUTPUT) }],
          }],
        }),
        headers: { 'x-request-id': 'req_openai_123' },
      }),
    )

    const result = await baseRequest(fetchImpl)

    expect(result).toMatchObject({
      output: DAY_OUTPUT,
      providerRequestId: 'req_openai_123',
      model: 'gpt-test-snapshot',
      stopReason: 'completed',
    })
    const [url, options] = fetchImpl.mock.calls[0]
    const sent = JSON.parse(options.body)
    expect(url).toBe('https://api.openai.com/v1/responses')
    expect(options.headers.Authorization).toBe('Bearer test-key')
    expect(sent).toMatchObject({
      model: 'gpt-test',
      max_output_tokens: 5_500,
      store: false,
      text: {
        format: {
          type: 'json_schema',
          name: 'evo_structured_output',
          strict: true,
          schema: EVO_DAY_OUTPUT_SCHEMA,
        },
      },
    })
    expect(sent.input[0]).toEqual({
      role: 'system',
      content: 'Devuelve el contrato EVO.',
    })
  })

  it('convierte errores HTTP en el error neutral esperado', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        status: 429,
        body: JSON.stringify({
          error: { type: 'rate_limit_error', message: 'Demasiadas peticiones.' },
        }),
        headers: { 'x-request-id': 'req_rate_limit' },
      }),
    )

    await expect(baseRequest(fetchImpl)).rejects.toMatchObject({
      name: 'OpenAiStructuredRequestError',
      code: OPENAI_STRUCTURED_ERROR_CODES.PROVIDER_HTTP,
      status: 429,
      providerRequestId: 'req_rate_limit',
      retriable: true,
    })
  })

  it('distingue un cuerpo HTTP inválido', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        body: '<html>bad gateway</html>',
        headers: { 'x-request-id': 'req_invalid_body' },
      }),
    )

    await expect(baseRequest(fetchImpl)).rejects.toMatchObject({
      code: OPENAI_STRUCTURED_ERROR_CODES.INVALID_PROVIDER_BODY,
      providerRequestId: 'req_invalid_body',
      retriable: false,
    })
  })

  it('trata un refusal como salida inválida no reintentable', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        body: JSON.stringify({
          id: 'resp_refusal',
          status: 'completed',
          output: [{
            type: 'message',
            content: [{ type: 'refusal', refusal: 'No puedo ayudar.' }],
          }],
        }),
      }),
    )

    await expect(baseRequest(fetchImpl)).rejects.toMatchObject({
      code: OPENAI_STRUCTURED_ERROR_CODES.INVALID_OUTPUT,
      status: 422,
      providerRequestId: 'resp_refusal',
      retriable: false,
      details: { providerType: 'refusal' },
    })
  })

  it('conserva una respuesta incompleta sin texto como reintentable', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        body: JSON.stringify({
          id: 'resp_incomplete',
          status: 'incomplete',
          incomplete_details: { reason: 'max_output_tokens' },
          output: [],
        }),
      }),
    )

    await expect(baseRequest(fetchImpl)).rejects.toMatchObject({
      code: OPENAI_STRUCTURED_ERROR_CODES.EMPTY_TEXT,
      providerRequestId: 'resp_incomplete',
      retriable: true,
      details: { providerType: 'max_output_tokens' },
    })
  })

  it('distingue texto estructurado no parseable', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        body: JSON.stringify({
          id: 'resp_invalid_output',
          output_text: '{"dia":',
        }),
      }),
    )

    await expect(baseRequest(fetchImpl)).rejects.toMatchObject({
      code: OPENAI_STRUCTURED_ERROR_CODES.INVALID_OUTPUT,
      providerRequestId: 'resp_invalid_output',
      retriable: false,
    })
  })

  it('aborta al agotar el timeout acotado', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn(() => new Promise(() => {}))

    const pending = baseRequest(fetchImpl, { timeoutMs: 25 })
    const assertion = expect(pending).rejects.toMatchObject({
      code: OPENAI_STRUCTURED_ERROR_CODES.TIMEOUT,
      status: 504,
      retriable: true,
      details: { timeoutMs: 25 },
    })

    await vi.advanceTimersByTimeAsync(25)
    await assertion
  })

  it('limita la configuración al máximo permitido', () => {
    expect(normalizeOpenAiStructuredTimeoutMs(999_999)).toBe(
      OPENAI_STRUCTURED_MAX_TIMEOUT_MS,
    )
    expect(normalizeOpenAiStructuredTimeoutMs(0)).toBe(75_000)
  })
})
