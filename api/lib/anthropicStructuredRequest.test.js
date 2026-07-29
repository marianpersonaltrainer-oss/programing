import { afterEach, describe, expect, it, vi } from 'vitest'
import { EVO_DAY_OUTPUT_SCHEMA } from '../../src/constants/evoDayOutputSchema.js'
import {
  ANTHROPIC_STRUCTURED_ERROR_CODES,
  ANTHROPIC_STRUCTURED_MAX_TIMEOUT_MS,
  AnthropicStructuredRequestError,
  normalizeAnthropicStructuredTimeoutMs,
  requestAnthropicStructuredOutput,
} from './anthropicStructuredRequest.js'

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

function response({
  status = 200,
  body,
  headers = {},
}) {
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
  return requestAnthropicStructuredOutput({
    apiKey: 'test-key',
    model: 'claude-sonnet-test',
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

describe('requestAnthropicStructuredOutput', () => {
  it('envía el schema strict y devuelve salida parseada con request id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        body: JSON.stringify({
          id: 'msg_123',
          model: 'claude-sonnet-test',
          stop_reason: 'end_turn',
          usage: { input_tokens: 12, output_tokens: 34 },
          content: [{ type: 'text', text: JSON.stringify(DAY_OUTPUT) }],
        }),
        headers: { 'request-id': 'req_provider_123' },
      }),
    )

    const result = await baseRequest(fetchImpl)

    expect(result.output).toEqual(DAY_OUTPUT)
    expect(result.providerRequestId).toBe('req_provider_123')
    expect(result.model).toBe('claude-sonnet-test')
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    const [url, options] = fetchImpl.mock.calls[0]
    const sent = JSON.parse(options.body)
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(sent.output_config).toEqual({
      format: {
        type: 'json_schema',
        schema: EVO_DAY_OUTPUT_SCHEMA,
      },
    })
    expect(options.headers['x-api-key']).toBe('test-key')
  })

  it('convierte un HTTP del proveedor en error tipado y conserva request id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        status: 429,
        body: JSON.stringify({
          error: { type: 'rate_limit_error', message: 'Demasiadas peticiones.' },
        }),
        headers: { 'request-id': 'req_rate_limit' },
      }),
    )

    await expect(baseRequest(fetchImpl)).rejects.toMatchObject({
      name: 'AnthropicStructuredRequestError',
      code: ANTHROPIC_STRUCTURED_ERROR_CODES.PROVIDER_HTTP,
      status: 429,
      providerRequestId: 'req_rate_limit',
      retriable: true,
      message: 'Demasiadas peticiones.',
    })
  })

  it('distingue un cuerpo HTTP inválido de un error de red', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        body: '<html>bad gateway</html>',
        headers: { 'request-id': 'req_invalid_body' },
      }),
    )

    await expect(baseRequest(fetchImpl)).rejects.toMatchObject({
      code: ANTHROPIC_STRUCTURED_ERROR_CODES.INVALID_PROVIDER_BODY,
      status: 502,
      providerRequestId: 'req_invalid_body',
      retriable: false,
    })
  })

  it('rechaza respuestas sin bloques de texto utilizables', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        body: JSON.stringify({
          id: 'msg_empty',
          content: [{ type: 'thinking', thinking: '...' }],
        }),
      }),
    )

    await expect(baseRequest(fetchImpl)).rejects.toMatchObject({
      code: ANTHROPIC_STRUCTURED_ERROR_CODES.EMPTY_TEXT,
      providerRequestId: 'msg_empty',
      retriable: true,
    })
  })

  it('distingue texto estructurado no parseable', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        body: JSON.stringify({
          id: 'msg_invalid_output',
          content: [{ type: 'text', text: '{"dia":' }],
        }),
      }),
    )

    await expect(baseRequest(fetchImpl)).rejects.toMatchObject({
      code: ANTHROPIC_STRUCTURED_ERROR_CODES.INVALID_OUTPUT,
      providerRequestId: 'msg_invalid_output',
      retriable: false,
    })
  })

  it('aborta al agotar el timeout acotado y devuelve error tipado', async () => {
    vi.useFakeTimers()
    // Incluso un fetch defectuoso que ignore AbortSignal no puede dejar el
    // cliente esperando: el presupuesto también se impone con Promise.race.
    const fetchImpl = vi.fn(() => new Promise(() => {}))

    const pending = baseRequest(fetchImpl, { timeoutMs: 25 })
    const assertion = expect(pending).rejects.toMatchObject({
      code: ANTHROPIC_STRUCTURED_ERROR_CODES.TIMEOUT,
      status: 504,
      retriable: true,
      details: { timeoutMs: 25 },
    })

    await vi.advanceTimersByTimeAsync(25)
    await assertion
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('limita cualquier configuración al máximo permitido', () => {
    expect(normalizeAnthropicStructuredTimeoutMs(999_999)).toBe(
      ANTHROPIC_STRUCTURED_MAX_TIMEOUT_MS,
    )
    expect(normalizeAnthropicStructuredTimeoutMs(0)).toBe(75_000)
    expect(
      new AnthropicStructuredRequestError('x', {
        code: ANTHROPIC_STRUCTURED_ERROR_CODES.TIMEOUT,
      }),
    ).toBeInstanceOf(Error)
  })
})
