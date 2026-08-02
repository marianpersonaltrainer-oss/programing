import { afterEach, describe, expect, it, vi } from 'vitest'
import { EVO_SESSION_CLASS_DEFS } from '../src/constants/evoClasses.js'
import { DEFAULT_PROGRAMMING_MODEL } from '../src/constants/anthropicModels.js'
import {
  ANTHROPIC_STRUCTURED_ERROR_CODES,
  AnthropicStructuredRequestError,
} from './lib/anthropicStructuredRequest.js'
import {
  GENERATION_MAX_TOKENS,
  GENERATION_TIMEOUT_MS,
  MAX_COMBINED_PROMPT_CHARS,
  RATE_LIMIT_TIMEOUT_MS,
  RPC_TIMEOUT_MS,
  STEP_TOTAL_BUDGET_MS,
  NOT_PROGRAMMED,
  createProgrammingGenerationStepHandler,
  getMissingGenerationStepConfig,
} from './programming-generation-step.js'

function makeGeneratedOutput(day = 'LUNES', selectedClasses = ['evofuncional']) {
  const dia = { nombre: day }
  for (const { key, feedbackKey } of EVO_SESSION_CLASS_DEFS) {
    dia[key] = selectedClasses.includes(key)
      ? `A) Programación completa para ${key}\nB) Metcon controlado de doce minutos`
      : 'La IA escribió algo que el servidor debe borrar.'
    dia[feedbackKey] = selectedClasses.includes(key)
      ? `Organización y escala de ${key}.`
      : 'Este feedback también debe borrarse.'
  }
  dia.wodbuster = ''
  return { dia }
}

function makePartialWeek() {
  return {
    titulo: 'Semana de prueba',
    semana: 5,
    mesociclo: 'FUERZA',
    resumen: { estimulo: '', intensidad: '', foco: '', nota: '' },
    dias: [
      {
        nombre: 'LUNES',
        evofuncional: 'anterior',
        fecha: '2026-08-03',
        etiqueta_operativa: 'inicio de bloque',
      },
      { nombre: 'MARTES', evofuncional: 'mantener martes' },
    ],
  }
}

function makeJobRow(overrides = {}) {
  return {
    id: 'job-1',
    idempotency_key: 'job-key-1',
    fingerprint: 'fingerprint-1',
    status: 'generating',
    target: {
      mesocycle: 'FUERZA',
      week: 5,
      phase: 'CARGA',
      weekStartDate: '2026-08-03',
    },
    configuration: {
      generationDays: ['LUNES', 'MARTES'],
      proposalTitle: 'Semana de prueba',
      weeklyOffer: {
        version: 1,
        dias: {
          LUNES: ['evofuncional', 'evofit'],
          MARTES: ['evofuncional'],
        },
      },
    },
    current_day: 'LUNES',
    completed_days: [],
    partial_week: makePartialWeek(),
    error: null,
    revision: 1,
    created_at: '2026-07-28T22:00:00.000Z',
    updated_at: '2026-07-28T22:00:01.000Z',
    completed_at: null,
    ...overrides,
  }
}

function makeStepRow(overrides = {}) {
  return {
    job_id: 'job-1',
    day_key: 'LUNES',
    status: 'running',
    attempt_count: 1,
    model: DEFAULT_PROGRAMMING_MODEL,
    request_id: 'step-request-1',
    provider_request_id: null,
    duration_ms: null,
    result: null,
    error: null,
    started_at: '2026-07-28T22:00:01.000Z',
    completed_at: null,
    updated_at: '2026-07-28T22:00:01.000Z',
    ...overrides,
  }
}

function makeSupabaseRpc({
  claim = {
    claimed: true,
    acquired: true,
    reused: false,
    alreadyComplete: false,
    leaseToken: 'lease-1',
    job: makeJobRow(),
    step: makeStepRow(),
  },
  complete = {
    completed: true,
    idempotent: false,
    allDaysComplete: false,
    job: makeJobRow({
      current_day: 'MARTES',
      completed_days: ['LUNES'],
      partial_week: {
        ...makePartialWeek(),
        dias: [
          makeGeneratedOutput('LUNES', ['evofuncional', 'evofit']).dia,
          { nombre: 'MARTES', evofuncional: 'mantener martes' },
        ],
      },
      revision: 2,
    }),
    step: makeStepRow({
      status: 'completed',
      provider_request_id: 'provider-1',
      duration_ms: 500,
      result: makeGeneratedOutput('LUNES', ['evofuncional', 'evofit']),
      completed_at: '2026-07-28T22:00:02.000Z',
    }),
  },
  fail = {
    failed: true,
    alreadyComplete: false,
    idempotent: false,
    job: makeJobRow({
      status: 'failed',
      error: {
        code: 'anthropic_timeout',
        message: 'timeout',
        httpStatus: 504,
      },
      revision: 2,
    }),
    step: makeStepRow({
      status: 'failed',
      error: {
        code: 'anthropic_timeout',
        message: 'timeout',
        httpStatus: 504,
      },
      completed_at: '2026-07-28T22:00:02.000Z',
    }),
  },
} = {}) {
  const rpc = vi.fn(async (name, params) => {
    if (name === 'claim_programming_generation_step') {
      return { data: claim, error: null }
    }
    if (name === 'complete_programming_generation_step') {
      return complete instanceof Error
        ? { data: null, error: { message: complete.message } }
        : {
            data: {
              ...complete,
              job: {
                ...complete.job,
                partial_week: params.p_partial_week,
              },
              step: {
                ...complete.step,
                result: params.p_result,
              },
            },
            error: null,
          }
    }
    if (name === 'fail_programming_generation_step') {
      return fail instanceof Error
        ? { data: null, error: { message: fail.message } }
        : { data: fail, error: null }
    }
    throw new Error(`RPC inesperado: ${name}`)
  })
  return { rpc }
}

function addSnapshotQueries(supabase, {
  job = makeJobRow(),
  steps = [makeStepRow()],
} = {}) {
  supabase.from = vi.fn((table) => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(async () => ({
        data: table === 'programming_generation_steps' ? steps : [],
        error: null,
      })),
      maybeSingle: vi.fn(async () => ({
        data: table === 'programming_generation_jobs' ? job : null,
        error: null,
      })),
    }
    return query
  })
  return supabase
}

function makeResponse() {
  return {
    statusCode: null,
    body: null,
    writes: [],
    headers: {},
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
      this.headers = headers || {}
      return this
    }),
    flushHeaders: vi.fn(),
    write: vi.fn(function write(chunk) {
      this.writes.push(String(chunk))
      return true
    }),
    end: vi.fn(function end(body) {
      this.body = JSON.parse(String(body || '').trim())
      return this
    }),
  }
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
      requestId: 'step-request-1',
      jobId: 'job-1',
      day: 'LUNES',
      selectedClasses: ['evofuncional', 'evofit'],
      systemPrompt: 'Método EVO y contrato del día.',
      userPrompt: 'Diseña un día coherente con las semanas anteriores.',
      partialWeek: makePartialWeek(),
      ...overrides,
    },
  }
}

function makeHandler({
  supabase = makeSupabaseRpc(),
  requestStructuredImpl = vi.fn().mockResolvedValue({
    output: makeGeneratedOutput('LUNES', ['evofuncional', 'evofit']),
    providerRequestId: 'provider-1',
    usage: { input_tokens: 120, output_tokens: 340 },
  }),
  checkRateLimitImpl = vi.fn().mockResolvedValue(false),
} = {}) {
  const handler = createProgrammingGenerationStepHandler({
    createClientImpl: vi.fn(() => supabase),
    checkRateLimitImpl,
    requestStructuredImpl,
    getServerConfigImpl: () => ({
      supabaseUrl: 'https://supabase.test',
      serviceKey: 'service-role',
      adminSecret: 'admin-secret',
      anthropicApiKey: 'anthropic-key',
    }),
    newRequestIdImpl: () => 'generated-request-id',
    model: DEFAULT_PROGRAMMING_MODEL,
  })
  return { handler, supabase, requestStructuredImpl, checkRateLimitImpl }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('POST /api/programming-generation-step', () => {
  it('identifica de forma segura las variables ausentes en Preview sin exponer valores', () => {
    expect(getMissingGenerationStepConfig({ provider: 'openai' })).toEqual([
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'COACH_GUIDE_ADMIN_SECRET',
      'OPENAI_API_KEY',
    ])
    expect(getMissingGenerationStepConfig({
      provider: 'openai',
      supabaseUrl: 'configured',
      serviceKey: 'configured',
      adminSecret: 'configured',
      openaiApiKey: 'configured',
    })).toEqual([])
  })

  it('reclama, genera una vez, normaliza, persiste el acumulador y después responde', async () => {
    const { handler, supabase, requestStructuredImpl } = makeHandler()
    const res = makeResponse()

    await handler(makeRequest(), res)

    expect(res.statusCode).toBe(200)
    expect(res.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({
        'X-Request-Id': 'step-request-1',
        'X-Accel-Buffering': 'no',
      }),
    )
    expect(res.body).toMatchObject({
      ok: true,
      status: 200,
      requestId: 'step-request-1',
      providerRequestId: 'provider-1',
      jobId: 'job-1',
      day: 'LUNES',
      snapshot: {
        job: {
          id: 'job-1',
          status: 'generating',
          currentDay: 'MARTES',
          completedDays: ['LUNES'],
          revision: 2,
        },
        steps: [
          {
            jobId: 'job-1',
            day: 'LUNES',
            status: 'completed',
            providerRequestId: 'provider-1',
          },
        ],
      },
    })
    expect(requestStructuredImpl).toHaveBeenCalledTimes(1)
    expect(requestStructuredImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        model: DEFAULT_PROGRAMMING_MODEL,
        timeoutMs: GENERATION_TIMEOUT_MS,
        maxTokens: GENERATION_MAX_TOKENS,
      }),
    )
    expect(GENERATION_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000)
    expect(GENERATION_TIMEOUT_MS).toBeLessThanOrEqual(65_000)
    expect(STEP_TOTAL_BUDGET_MS).toBeLessThan(90_000)
    expect(
      RATE_LIMIT_TIMEOUT_MS +
        RPC_TIMEOUT_MS +
        GENERATION_TIMEOUT_MS +
        RPC_TIMEOUT_MS * 2,
    ).toBeLessThan(STEP_TOTAL_BUDGET_MS)
    expect(GENERATION_MAX_TOKENS).toBeLessThanOrEqual(4_200)

    const claimCall = supabase.rpc.mock.calls[0]
    expect(claimCall).toEqual([
      'claim_programming_generation_step',
      {
        p_job_id: 'job-1',
        p_day_key: 'LUNES',
        p_request_id: 'step-request-1',
        p_lease_seconds: 90,
      },
    ])
    const completeCall = supabase.rpc.mock.calls[1]
    expect(completeCall[0]).toBe('complete_programming_generation_step')
    expect(completeCall[1]).toMatchObject({
      p_job_id: 'job-1',
      p_day_key: 'LUNES',
      p_lease_token: 'lease-1',
      p_request_id: 'step-request-1',
      p_provider_request_id: 'provider-1',
      p_model: DEFAULT_PROGRAMMING_MODEL,
      p_input_tokens: 120,
      p_output_tokens: 340,
    })

    const persisted = completeCall[1].p_result.dia
    expect(persisted.evofuncional).toMatch(/Programación completa/)
    expect(persisted.evofit).toMatch(/Programación completa/)
    expect(persisted.evobasics).toBe(NOT_PROGRAMMED)
    expect(persisted.feedback_basics).toBe('')
    expect(completeCall[1].p_partial_week.dias).toEqual([
      {
        ...completeCall[1].p_result.dia,
        fecha: '2026-08-03',
        etiqueta_operativa: 'inicio de bloque',
      },
      { nombre: 'MARTES', evofuncional: 'mantener martes' },
    ])
    expect(res.body.partialWeek).toEqual(completeCall[1].p_partial_week)
  })

  it('emite heartbeat mientras la única llamada Anthropic sigue pendiente', async () => {
    vi.useFakeTimers()
    let resolveStructured
    const requestStructuredImpl = vi.fn(
      () => new Promise((resolve) => {
        resolveStructured = resolve
      }),
    )
    const { handler } = makeHandler({ requestStructuredImpl })
    const res = makeResponse()

    const pending = handler(makeRequest(), res)
    await vi.advanceTimersByTimeAsync(0)
    expect(res.writeHead).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(2_500)
    expect(res.write).toHaveBeenCalledWith(' ')

    resolveStructured({
      output: makeGeneratedOutput('LUNES', ['evofuncional', 'evofit']),
      providerRequestId: 'provider-heartbeat',
      usage: {},
    })
    await pending
    expect(res.body).toMatchObject({
      ok: true,
      providerRequestId: 'provider-heartbeat',
    })
  })

  it('devuelve el resultado guardado sin llamar a Anthropic si ya estaba completo', async () => {
    const saved = makeGeneratedOutput('LUNES', ['evofuncional'])
    const supabase = makeSupabaseRpc({
      claim: {
        acquired: false,
        alreadyComplete: true,
        reason: 'day_already_completed',
        job: makeJobRow({
          completed_days: ['LUNES'],
          partial_week: makePartialWeek(),
        }),
        step: makeStepRow({
          status: 'completed',
          result: saved,
          provider_request_id: 'provider-saved',
          completed_at: '2026-07-28T22:00:02.000Z',
        }),
      },
    })
    const requestStructuredImpl = vi.fn()
    const { handler } = makeHandler({ supabase, requestStructuredImpl })
    const res = makeResponse()

    await handler(makeRequest(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      alreadyComplete: true,
      result: saved,
      providerRequestId: 'provider-saved',
      snapshot: {
        job: {
          id: 'job-1',
          completedDays: ['LUNES'],
        },
        steps: [
          {
            status: 'completed',
            providerRequestId: 'provider-saved',
          },
        ],
      },
    })
    expect(requestStructuredImpl).not.toHaveBeenCalled()
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
  })

  it('no duplica Anthropic si el mismo requestId ya conserva un lease activo', async () => {
    const supabase = makeSupabaseRpc({
      claim: {
        claimed: true,
        acquired: true,
        reused: true,
        alreadyComplete: false,
        leaseToken: 'lease-active',
        job: makeJobRow(),
        step: makeStepRow(),
      },
    })
    const requestStructuredImpl = vi.fn()
    const { handler } = makeHandler({ supabase, requestStructuredImpl })
    const res = makeResponse()

    await handler(makeRequest(), res)

    expect(res.statusCode).toBe(409)
    expect(res.body).toMatchObject({
      ok: false,
      errorStatus: 409,
      error: 'generation_step_already_running',
      requestId: 'step-request-1',
    })
    expect(res.writeHead).not.toHaveBeenCalled()
    expect(requestStructuredImpl).not.toHaveBeenCalled()
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
  })

  it('mantiene compatibilidad con el claim ya aplicado en staging sin job embebido', async () => {
    const supabase = addSnapshotQueries(
      makeSupabaseRpc({
        claim: {
          acquired: true,
          leaseToken: 'lease-1',
          day: 'LUNES',
          step: makeStepRow(),
        },
      }),
    )
    const { handler, requestStructuredImpl } = makeHandler({ supabase })
    const res = makeResponse()

    await handler(makeRequest(), res)

    expect(res.statusCode).toBe(200)
    expect(supabase.from).toHaveBeenCalledWith('programming_generation_jobs')
    expect(supabase.from).toHaveBeenCalledWith('programming_generation_steps')
    expect(requestStructuredImpl).toHaveBeenCalledTimes(1)
    expect(res.body.snapshot).toMatchObject({
      job: {
        id: 'job-1',
        completedDays: ['LUNES'],
      },
      steps: [
        {
          day: 'LUNES',
          status: 'completed',
        },
      ],
    })
  })

  it('persiste y devuelve un timeout 504 sin reintento automático', async () => {
    const timeout = new AnthropicStructuredRequestError('timeout', {
      code: ANTHROPIC_STRUCTURED_ERROR_CODES.TIMEOUT,
      status: 504,
      retriable: true,
    })
    const requestStructuredImpl = vi.fn().mockRejectedValue(timeout)
    const { handler, supabase } = makeHandler({ requestStructuredImpl })
    const res = makeResponse()

    await handler(makeRequest(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: false,
      status: 504,
      errorStatus: 504,
      error: ANTHROPIC_STRUCTURED_ERROR_CODES.TIMEOUT,
      requestId: 'step-request-1',
      retriable: true,
      snapshot: {
        job: {
          id: 'job-1',
          status: 'failed',
          error: {
            code: 'anthropic_timeout',
            httpStatus: 504,
          },
        },
        steps: [
          {
            jobId: 'job-1',
            day: 'LUNES',
            status: 'failed',
            error: {
              code: 'anthropic_timeout',
              httpStatus: 504,
            },
          },
        ],
      },
    })
    expect(requestStructuredImpl).toHaveBeenCalledTimes(1)
    expect(supabase.rpc.mock.calls.map(([name]) => name)).toEqual([
      'claim_programming_generation_step',
      'fail_programming_generation_step',
    ])
    expect(supabase.rpc.mock.calls[1][1].p_error).toMatchObject({
      code: ANTHROPIC_STRUCTURED_ERROR_CODES.TIMEOUT,
      httpStatus: 504,
      requestId: 'step-request-1',
    })
  })

  it('impone el timeout upstream aunque el cliente Anthropic inyectado no termine', async () => {
    vi.useFakeTimers()
    const requestStructuredImpl = vi.fn(() => new Promise(() => {}))
    const { handler, supabase } = makeHandler({ requestStructuredImpl })
    const res = makeResponse()

    const pending = handler(makeRequest(), res)
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(GENERATION_TIMEOUT_MS)
    await pending

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: false,
      errorStatus: 504,
      error: 'generation_step_upstream_timeout',
      retriable: true,
    })
    expect(supabase.rpc.mock.calls.map(([name]) => name)).toEqual([
      'claim_programming_generation_step',
      'fail_programming_generation_step',
    ])
  })

  it('conserva HTTP y providerRequestId de un error Anthropic', async () => {
    const providerError = new AnthropicStructuredRequestError('rate limit', {
      code: ANTHROPIC_STRUCTURED_ERROR_CODES.PROVIDER_HTTP,
      status: 429,
      providerRequestId: 'provider-rate',
      retriable: true,
    })
    const requestStructuredImpl = vi.fn().mockRejectedValue(providerError)
    const { handler, supabase } = makeHandler({ requestStructuredImpl })
    const res = makeResponse()

    await handler(makeRequest(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      errorStatus: 429,
      error: ANTHROPIC_STRUCTURED_ERROR_CODES.PROVIDER_HTTP,
      providerRequestId: 'provider-rate',
    })
    expect(requestStructuredImpl).toHaveBeenCalledTimes(1)
    expect(supabase.rpc.mock.calls[1][1].p_provider_request_id).toBe('provider-rate')
  })

  it('rechaza y persiste una salida sin contenido real en todas las clases elegidas', async () => {
    const invalid = makeGeneratedOutput('LUNES', ['evofuncional'])
    invalid.dia.evofit = NOT_PROGRAMMED
    const requestStructuredImpl = vi.fn().mockResolvedValue({
      output: invalid,
      providerRequestId: 'provider-invalid',
      usage: {},
    })
    const { handler, supabase } = makeHandler({ requestStructuredImpl })
    const res = makeResponse()

    await handler(makeRequest(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      errorStatus: 422,
      error: 'selected_class_content_missing',
      providerRequestId: 'provider-invalid',
    })
    expect(supabase.rpc.mock.calls.map(([name]) => name)).toEqual([
      'claim_programming_generation_step',
      'fail_programming_generation_step',
    ])
  })

  it('deriva la oferta del job y persiste un conflicto si el navegador pide otras clases', async () => {
    const requestStructuredImpl = vi.fn()
    const { handler, supabase } = makeHandler({ requestStructuredImpl })
    const res = makeResponse()

    await handler(
      makeRequest({ selectedClasses: ['evofuncional', 'evobasics'] }),
      res,
    )

    expect(res.statusCode).toBe(409)
    expect(res.body).toMatchObject({
      ok: false,
      error: 'generation_step_offer_mismatch',
      snapshot: {
        job: {
          id: 'job-1',
          status: 'failed',
        },
      },
    })
    expect(requestStructuredImpl).not.toHaveBeenCalled()
    expect(supabase.rpc.mock.calls.map(([name]) => name)).toEqual([
      'claim_programming_generation_step',
      'fail_programming_generation_step',
    ])
  })

  it('ignora partialWeek del navegador y fusiona sobre el acumulador persistido', async () => {
    const { handler, supabase } = makeHandler()
    const res = makeResponse()
    const forged = {
      titulo: 'METADATA INYECTADA POR EL CLIENTE',
      dias: [{ nombre: 'LUNES', evofuncional: 'contenido falso' }],
    }

    await handler(makeRequest({ partialWeek: forged }), res)

    expect(res.statusCode).toBe(200)
    const completeParams = supabase.rpc.mock.calls.find(
      ([name]) => name === 'complete_programming_generation_step',
    )[1]
    expect(completeParams.p_partial_week.titulo).toBe('Semana de prueba')
    expect(completeParams.p_partial_week.titulo).not.toBe(forged.titulo)
    expect(completeParams.p_partial_week.mesociclo).toBe('FUERZA')
    expect(completeParams.p_partial_week.dias[1]).toEqual({
      nombre: 'MARTES',
      evofuncional: 'mantener martes',
    })
  })

  it('crea el primer acumulador desde target/config y conserva metadata no generativa', async () => {
    const claimJob = makeJobRow({
      partial_week: null,
      target: {
        mesocycle: 'MIXTO',
        week: 3,
        phase: 'DESCARGA',
        weekStartDate: '2026-08-17',
      },
      configuration: {
        generationDays: ['LUNES'],
        proposalTitle: 'Semana regenerativa',
        weeklyOffer: {
          version: 1,
          dias: { LUNES: ['evofuncional', 'evofit'] },
        },
      },
    })
    const supabase = makeSupabaseRpc({
      claim: {
        acquired: true,
        leaseToken: 'lease-1',
        job: claimJob,
        step: makeStepRow(),
      },
    })
    const { handler } = makeHandler({ supabase })
    const res = makeResponse()

    await handler(makeRequest({ partialWeek: null }), res)

    const completeParams = supabase.rpc.mock.calls.find(
      ([name]) => name === 'complete_programming_generation_step',
    )[1]
    expect(completeParams.p_partial_week).toMatchObject({
      titulo: 'Semana regenerativa',
      semana: 3,
      mesociclo: 'MIXTO',
      fase: 'DESCARGA',
      fechaInicio: '2026-08-17',
      oferta_semanal: claimJob.configuration.weeklyOffer,
    })
    expect(completeParams.p_partial_week.dias).toHaveLength(1)
  })

  it('limita el payload antes de reclamar el job', async () => {
    const { handler, supabase, requestStructuredImpl } = makeHandler()
    const res = makeResponse()

    await handler(
      makeRequest({
        systemPrompt: 's'.repeat(MAX_COMBINED_PROMPT_CHARS),
        userPrompt: 'u',
      }),
      res,
    )

    expect(res.statusCode).toBe(413)
    expect(res.body).toMatchObject({
      error: 'generation_step_prompt_too_large',
    })
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(requestStructuredImpl).not.toHaveBeenCalled()
  })

  it('corta un claim RPC colgado dentro del presupuesto del step', async () => {
    vi.useFakeTimers()
    const supabase = {
      rpc: vi.fn(() => new Promise(() => {})),
    }
    const { handler, requestStructuredImpl } = makeHandler({ supabase })
    const res = makeResponse()

    const pending = handler(makeRequest(), res)
    await vi.advanceTimersByTimeAsync(RPC_TIMEOUT_MS)
    await pending

    expect(res.statusCode).toBe(504)
    expect(res.body).toMatchObject({
      error: 'generation_step_claim_failed_timeout',
      retriable: true,
    })
    expect(requestStructuredImpl).not.toHaveBeenCalled()
  })

  it('corta un rate-limit colgado antes de tocar los RPC', async () => {
    vi.useFakeTimers()
    const checkRateLimitImpl = vi.fn(() => new Promise(() => {}))
    const { handler, supabase, requestStructuredImpl } = makeHandler({
      checkRateLimitImpl,
    })
    const res = makeResponse()

    const pending = handler(makeRequest(), res)
    await vi.advanceTimersByTimeAsync(RATE_LIMIT_TIMEOUT_MS)
    await pending

    expect(res.statusCode).toBe(503)
    expect(res.body).toMatchObject({
      error: 'rate_limit_unavailable',
      message: expect.stringContaining('tiempo'),
    })
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(requestStructuredImpl).not.toHaveBeenCalled()
  })

  it('marca el step como fallido si guardar el resultado completo falla', async () => {
    const supabase = makeSupabaseRpc({
      complete: new Error('database unavailable'),
      fail: {
        failed: true,
        idempotent: false,
        job: makeJobRow({
          status: 'failed',
          error: {
            code: 'generation_step_complete_persistence_failed',
            message: 'database unavailable',
            httpStatus: 503,
          },
          revision: 2,
        }),
        step: makeStepRow({
          status: 'failed',
          error: {
            code: 'generation_step_complete_persistence_failed',
            message: 'database unavailable',
            httpStatus: 503,
          },
          completed_at: '2026-07-28T22:00:02.000Z',
        }),
      },
    })
    const { handler, requestStructuredImpl } = makeHandler({ supabase })
    const res = makeResponse()

    await handler(makeRequest(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      errorStatus: 503,
      error: 'generation_step_complete_persistence_failed',
      retriable: true,
    })
    expect(requestStructuredImpl).toHaveBeenCalledTimes(1)
    expect(supabase.rpc.mock.calls.map(([name]) => name)).toEqual([
      'claim_programming_generation_step',
      'complete_programming_generation_step',
      'fail_programming_generation_step',
    ])
  })

  it('falla cerrado antes de reclamar si el rate-limit no está disponible', async () => {
    const checkRateLimitImpl = vi.fn().mockRejectedValue(new Error('rpc down'))
    const { handler, supabase, requestStructuredImpl } = makeHandler({
      checkRateLimitImpl,
    })
    const res = makeResponse()

    await handler(makeRequest(), res)

    expect(res.statusCode).toBe(503)
    expect(res.body).toMatchObject({
      errorStatus: 503,
      error: 'rate_limit_unavailable',
    })
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(requestStructuredImpl).not.toHaveBeenCalled()
  })
})
