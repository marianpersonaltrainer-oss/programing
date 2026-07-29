import { describe, expect, it, vi } from 'vitest'
import { EVO_DAY_OUTPUT_SCHEMA } from '../src/constants/evoDayOutputSchema.js'
import { DEFAULT_PROGRAMMING_MODEL } from '../src/constants/anthropicModels.js'
import {
  ANTHROPIC_STRUCTURED_ERROR_CODES,
  AnthropicStructuredRequestError,
} from './lib/anthropicStructuredRequest.js'
import {
  AI_CHECK_CLASS_KEY,
  AI_CHECK_DAY,
  AI_CHECK_MAX_TOKENS,
  AI_CHECK_PERSISTENCE_TIMEOUT_MS,
  AI_CHECK_UPSTREAM_TIMEOUT_MS,
  createProgrammingAiCheckHandler,
} from './programming-ai-check.js'

function makeRepresentativeOutput() {
  const dia = Object.fromEntries(
    EVO_DAY_OUTPUT_SCHEMA.properties.dia.required.map((field) => [field, '']),
  )
  dia.nombre = AI_CHECK_DAY
  dia[AI_CHECK_CLASS_KEY] = 'Sentadilla frontal: 2 series de 5 repeticiones técnicas.'
  dia.feedback_fuerza = 'Escalar carga para mantener técnica.'
  return { dia }
}

function makeRequest(overrides = {}) {
  return {
    method: 'POST',
    headers: {
      origin: 'http://localhost:5173',
      'x-forwarded-for': '127.0.0.1',
    },
    body: {
      secret: 'admin-secret',
      ...overrides,
    },
  }
}

function makeResponse() {
  return {
    statusCode: null,
    headers: null,
    chunks: [],
    body: null,
    status: vi.fn(function status(code) {
      this.statusCode = code
      return this
    }),
    json: vi.fn(function json(body) {
      this.body = body
      return this
    }),
    writeHead: vi.fn(function writeHead(code, headers) {
      this.statusCode = code
      this.headers = headers
      return this
    }),
    flushHeaders: vi.fn(),
    write: vi.fn(function write(chunk) {
      this.chunks.push(String(chunk))
      return true
    }),
    end: vi.fn(function end(chunk = '') {
      this.chunks.push(String(chunk))
      this.body = JSON.parse(this.chunks.join('').trim())
      return this
    }),
  }
}

function makeHandler({
  requestStructuredImpl = vi.fn().mockResolvedValue({
    output: makeRepresentativeOutput(),
    providerRequestId: 'provider-check-1',
    model: DEFAULT_PROGRAMMING_MODEL,
  }),
  checkRateLimitImpl = vi.fn().mockResolvedValue(false),
  checkGenerationPersistenceImpl = vi.fn().mockResolvedValue(true),
  createClientImpl = vi.fn(() => ({ rpc: vi.fn() })),
  nowValues = [1_000, 1_123],
  logger = { info: vi.fn(), warn: vi.fn() },
} = {}) {
  const nowImpl = vi.fn()
  for (const value of nowValues) nowImpl.mockReturnValueOnce(value)
  nowImpl.mockReturnValue(nowValues.at(-1) || 0)

  const handler = createProgrammingAiCheckHandler({
    createClientImpl,
    checkRateLimitImpl,
    checkGenerationPersistenceImpl,
    requestStructuredImpl,
    getServerConfigImpl: () => ({
      apiKey: 'anthropic-key',
      adminSecret: 'admin-secret',
      serviceKey: 'service-role',
      supabaseUrl: 'https://supabase.test',
    }),
    newRequestIdImpl: () => 'ai-check-request-1',
    nowImpl,
    logger,
  })
  return {
    handler,
    requestStructuredImpl,
    checkRateLimitImpl,
    checkGenerationPersistenceImpl,
    createClientImpl,
    logger,
  }
}

describe('POST /api/programming-ai-check', () => {
  it('prueba Sonnet con el mismo schema y cliente estructurado que la generación por día', async () => {
    const {
      handler,
      requestStructuredImpl,
      checkRateLimitImpl,
      checkGenerationPersistenceImpl,
      createClientImpl,
      logger,
    } = makeHandler()
    const res = makeResponse()

    await handler(makeRequest(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      requestId: 'ai-check-request-1',
      ok: true,
      status: 'connected',
      model: DEFAULT_PROGRAMMING_MODEL,
      latencyMs: 123,
      providerRequestId: 'provider-check-1',
      structuredOutputs: true,
      sample: {
        day: AI_CHECK_DAY,
        classKey: AI_CHECK_CLASS_KEY,
        hasRepresentativeContent: true,
      },
    })
    expect(res.headers).toMatchObject({
      'Content-Type': 'application/json; charset=utf-8',
      'X-Request-Id': 'ai-check-request-1',
    })
    expect(requestStructuredImpl).toHaveBeenCalledTimes(1)
    expect(requestStructuredImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'anthropic-key',
        model: DEFAULT_PROGRAMMING_MODEL,
        schema: EVO_DAY_OUTPUT_SCHEMA,
        maxTokens: AI_CHECK_MAX_TOKENS,
        timeoutMs: AI_CHECK_UPSTREAM_TIMEOUT_MS,
      }),
    )
    expect(requestStructuredImpl.mock.calls[0][0].messages[0].content).toContain('evofuerza')
    expect(AI_CHECK_UPSTREAM_TIMEOUT_MS).toBe(45_000)
    expect(AI_CHECK_PERSISTENCE_TIMEOUT_MS).toBe(5_000)
    expect(createClientImpl).toHaveBeenCalledWith(
      'https://supabase.test',
      'service-role',
      { auth: { persistSession: false } },
    )
    expect(checkRateLimitImpl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      {
        endpoint: '/api/programming-ai-check',
        limit: 10,
        windowMinutes: 10,
      },
    )
    expect(checkGenerationPersistenceImpl).toHaveBeenCalledWith(
      expect.anything(),
    )
    expect(logger.info).toHaveBeenCalledWith(
      'programming_ai_check_succeeded',
      expect.objectContaining({
        requestId: 'ai-check-request-1',
        providerRequestId: 'provider-check-1',
        model: DEFAULT_PROGRAMMING_MODEL,
        latencyMs: 123,
      }),
    )
  })

  it('conserva HTTP lógico y observabilidad en el contrato JSON transmitido', async () => {
    const requestStructuredImpl = vi.fn().mockRejectedValue(
      new AnthropicStructuredRequestError('Anthropic saturado', {
        code: ANTHROPIC_STRUCTURED_ERROR_CODES.PROVIDER_HTTP,
        status: 529,
        providerRequestId: 'provider-overloaded',
        retriable: true,
      }),
    )
    const { handler, logger } = makeHandler({ requestStructuredImpl })
    const res = makeResponse()

    await handler(makeRequest(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      requestId: 'ai-check-request-1',
      ok: false,
      errorStatus: 529,
      error: 'Anthropic saturado',
      errorCode: ANTHROPIC_STRUCTURED_ERROR_CODES.PROVIDER_HTTP,
      model: DEFAULT_PROGRAMMING_MODEL,
      latencyMs: 123,
      providerRequestId: 'provider-overloaded',
      structuredOutputs: true,
      retriable: true,
    })
    expect(logger.warn).toHaveBeenCalledWith(
      'programming_ai_check_failed',
      expect.objectContaining({
        requestId: 'ai-check-request-1',
        providerRequestId: 'provider-overloaded',
        model: DEFAULT_PROGRAMMING_MODEL,
        latencyMs: 123,
        errorStatus: 529,
      }),
    )
  })

  it('devuelve timeout 504 del helper compartido con el límite duro de 45 segundos', async () => {
    const requestStructuredImpl = vi.fn().mockRejectedValue(
      new AnthropicStructuredRequestError('Anthropic no respondió en 45000 ms.', {
        code: ANTHROPIC_STRUCTURED_ERROR_CODES.TIMEOUT,
        status: 504,
        retriable: true,
      }),
    )
    const { handler } = makeHandler({ requestStructuredImpl })
    const res = makeResponse()

    await handler(makeRequest(), res)

    expect(requestStructuredImpl).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 45_000 }),
    )
    expect(res.body).toMatchObject({
      ok: false,
      errorStatus: 504,
      errorCode: ANTHROPIC_STRUCTURED_ERROR_CODES.TIMEOUT,
      model: DEFAULT_PROGRAMMING_MODEL,
      latencyMs: 123,
      providerRequestId: null,
    })
  })

  it('rechaza como salida inválida una respuesta sin muestra representativa de EvoFuerza', async () => {
    const output = makeRepresentativeOutput()
    output.dia[AI_CHECK_CLASS_KEY] = ''
    const requestStructuredImpl = vi.fn().mockResolvedValue({
      output,
      providerRequestId: 'provider-invalid',
      model: DEFAULT_PROGRAMMING_MODEL,
    })
    const { handler } = makeHandler({ requestStructuredImpl })
    const res = makeResponse()

    await handler(makeRequest(), res)

    expect(res.body).toMatchObject({
      ok: false,
      errorStatus: 502,
      errorCode: ANTHROPIC_STRUCTURED_ERROR_CODES.INVALID_OUTPUT,
      providerRequestId: 'provider-invalid',
      model: DEFAULT_PROGRAMMING_MODEL,
    })
  })

  it('conserva las barreras de origen y secreto antes de llamar a Anthropic', async () => {
    const { handler, requestStructuredImpl, checkRateLimitImpl } = makeHandler()
    const badOrigin = makeResponse()
    const badSecret = makeResponse()

    await handler(
      {
        ...makeRequest(),
        headers: { origin: 'https://example.invalid' },
      },
      badOrigin,
    )
    await handler(makeRequest({ secret: 'incorrecto' }), badSecret)

    expect(badOrigin.statusCode).toBe(403)
    expect(badOrigin.body).toMatchObject({
      error: 'origin_not_allowed',
      requestId: 'ai-check-request-1',
    })
    expect(badSecret.statusCode).toBe(401)
    expect(badSecret.body).toMatchObject({
      error: 'unauthorized',
      requestId: 'ai-check-request-1',
    })
    expect(checkRateLimitImpl).not.toHaveBeenCalled()
    expect(requestStructuredImpl).not.toHaveBeenCalled()
  })

  it('mantiene el rate-limit administrativo antes de iniciar la respuesta transmitida', async () => {
    const checkRateLimitImpl = vi.fn().mockResolvedValue(true)
    const { handler, requestStructuredImpl } = makeHandler({ checkRateLimitImpl })
    const res = makeResponse()

    await handler(makeRequest(), res)

    expect(res.statusCode).toBe(429)
    expect(res.body).toMatchObject({
      error: 'rate_limit_exceeded',
      retry_after_seconds: 600,
      requestId: 'ai-check-request-1',
    })
    expect(res.writeHead).not.toHaveBeenCalled()
    expect(requestStructuredImpl).not.toHaveBeenCalled()
  })

  it('falla cerrado si el almacenamiento recuperable no está disponible', async () => {
    const checkGenerationPersistenceImpl = vi
      .fn()
      .mockRejectedValue(new Error('relation does not exist'))
    const { handler, requestStructuredImpl, logger } = makeHandler({
      checkGenerationPersistenceImpl,
    })
    const res = makeResponse()

    await handler(makeRequest(), res)

    expect(res.statusCode).toBe(503)
    expect(res.body).toMatchObject({
      error: 'generation_persistence_unavailable',
      requestId: 'ai-check-request-1',
    })
    expect(requestStructuredImpl).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      'programming_ai_check_persistence_unavailable',
      expect.objectContaining({ requestId: 'ai-check-request-1' }),
    )
  })
})
