import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProgrammingGenerationJobsHandler } from './programming-generation-jobs.js'

function makeResponse() {
  return {
    statusCode: null,
    body: null,
    status: vi.fn(function status(code) {
      this.statusCode = code
      return this
    }),
    json: vi.fn(function json(body) {
      this.body = body
      return this
    }),
  }
}

function makeRequest(body, overrides = {}) {
  return {
    method: 'POST',
    headers: {
      origin: 'http://localhost:5173',
      'x-forwarded-for': '127.0.0.1',
    },
    body: { secret: 'admin-secret', ...body },
    ...overrides,
  }
}

function makeHandler(overrides = {}) {
  const snapshot = {
    job: {
      id: 'job-1',
      status: 'queued',
      completedDays: [],
      revision: 0,
    },
    steps: [],
  }
  const deps = {
    createClientImpl: vi.fn(() => ({ kind: 'supabase' })),
    checkRateLimitImpl: vi.fn().mockResolvedValue(false),
    createOrGetGenerationJobImpl: vi.fn().mockResolvedValue(snapshot),
    finalizeGenerationJobImpl: vi.fn().mockResolvedValue(snapshot),
    findGenerationJobByFingerprintImpl: vi.fn().mockResolvedValue(snapshot),
    findGenerationJobByTargetImpl: vi.fn().mockResolvedValue(snapshot),
    getGenerationJobSnapshotImpl: vi.fn().mockResolvedValue(snapshot),
    ...overrides,
  }
  return {
    handler: createProgrammingGenerationJobsHandler(deps),
    deps,
    snapshot,
  }
}

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://supabase.test'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
  process.env.COACH_GUIDE_ADMIN_SECRET = 'admin-secret'
})

afterEach(() => {
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.COACH_GUIDE_ADMIN_SECRET
  vi.restoreAllMocks()
})

describe('POST /api/programming-generation-jobs', () => {
  it('crea un job idempotente antes de iniciar la IA', async () => {
    const { handler, deps } = makeHandler()
    const res = makeResponse()

    await handler(
      makeRequest({
        action: 'create',
        idempotencyKey: 'idem-1',
        fingerprint: 'fp-1',
        generationDays: ['LUNES', 'MARTES'],
        target: { mesocycle: 'FUERZA', week: 3 },
        configuration: { buildId: 'test' },
      }),
      res,
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      job: { id: 'job-1' },
      steps: [],
    })
    expect(deps.createOrGetGenerationJobImpl).toHaveBeenCalledWith(
      { kind: 'supabase' },
      expect.objectContaining({
        idempotencyKey: 'idem-1',
        fingerprint: 'fp-1',
        generationDays: ['LUNES', 'MARTES'],
      }),
    )
  })

  it('recupera un job por fingerprint para continuar tras recargar', async () => {
    const { handler, deps } = makeHandler()
    const res = makeResponse()

    await handler(
      makeRequest({ action: 'find', fingerprint: 'fp-1' }),
      res,
    )

    expect(res.statusCode).toBe(200)
    expect(deps.findGenerationJobByFingerprintImpl).toHaveBeenCalledWith(
      { kind: 'supabase' },
      'fp-1',
    )
  })

  it('recupera el último job por target estable aunque cambie el fingerprint local', async () => {
    const { handler, deps } = makeHandler()
    const res = makeResponse()
    const target = {
      mesocycle: 'FUERZA',
      week: 3,
      cycleId: 'FUERZA:2026-07-13',
      weekStartDate: '2026-07-27',
    }

    await handler(
      makeRequest({ action: 'find_target', target }),
      res,
    )

    expect(res.statusCode).toBe(200)
    expect(deps.findGenerationJobByTargetImpl).toHaveBeenCalledWith(
      { kind: 'supabase' },
      target,
    )
  })

  it('finaliza únicamente mediante la operación autoritativa', async () => {
    const readySnapshot = {
      job: {
        id: 'job-1',
        status: 'ready',
        completedDays: ['LUNES', 'MARTES'],
        revision: 4,
      },
      steps: [],
      finalization: { finalized: true, idempotent: false },
    }
    const { handler, deps } = makeHandler({
      finalizeGenerationJobImpl: vi.fn().mockResolvedValue(readySnapshot),
    })
    const res = makeResponse()
    const partialWeek = {
      titulo: 'Semana completa',
      dias: [{ nombre: 'LUNES' }, { nombre: 'MARTES' }],
    }

    await handler(
      makeRequest({
        action: 'finalize',
        jobId: 'job-1',
        expectedRevision: 3,
        partialWeek,
      }),
      res,
    )

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      job: { id: 'job-1', status: 'ready' },
      finalization: { finalized: true, idempotent: false },
    })
    expect(deps.finalizeGenerationJobImpl).toHaveBeenCalledWith(
      { kind: 'supabase' },
      {
        jobId: 'job-1',
        expectedRevision: 3,
        partialWeek,
      },
    )
  })

  it('expone un conflicto de revisión sin sobrescribir progreso remoto', async () => {
    const conflict = Object.assign(new Error('generation_job_revision_conflict'), {
      code: 'generation_job_revision_conflict',
    })
    const { handler } = makeHandler({
      finalizeGenerationJobImpl: vi.fn().mockRejectedValue(conflict),
    })
    const res = makeResponse()

    await handler(
      makeRequest({
        action: 'finalize',
        jobId: 'job-1',
        expectedRevision: 1,
        partialWeek: { titulo: 'Semana', dias: [] },
      }),
      res,
    )

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ error: 'generation_job_revision_conflict' })
  })

  it('expone un job incompleto como conflicto recuperable', async () => {
    const incomplete = Object.assign(new Error('generation_job_incomplete'), {
      code: 'generation_job_incomplete',
    })
    const { handler } = makeHandler({
      finalizeGenerationJobImpl: vi.fn().mockRejectedValue(incomplete),
    })
    const res = makeResponse()

    await handler(
      makeRequest({
        action: 'finalize',
        jobId: 'job-1',
        expectedRevision: 2,
        partialWeek: { titulo: 'Semana incompleta', dias: [] },
      }),
      res,
    )

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ error: 'generation_job_incomplete' })
  })

  it.each(['ready', 'checkpoint', 'failed', 'cancelled'])(
    'rechaza la antigua acción de escritura %s',
    async (action) => {
      const { handler, deps } = makeHandler()
      const res = makeResponse()

      await handler(
        makeRequest({
          action,
          jobId: 'job-1',
          expectedRevision: 1,
          partialWeek: { titulo: 'No debe escribirse', dias: [] },
        }),
        res,
      )

      expect(res.statusCode).toBe(400)
      expect(res.body).toEqual({ error: 'invalid_action' })
      expect(deps.finalizeGenerationJobImpl).not.toHaveBeenCalled()
    },
  )

  it('rechaza la clave incorrecta antes de consultar Supabase', async () => {
    const { handler, deps } = makeHandler()
    const res = makeResponse()

    await handler(
      makeRequest({ action: 'get', jobId: 'job-1' }, {
        body: { secret: 'incorrecta', action: 'get', jobId: 'job-1' },
      }),
      res,
    )

    expect(res.statusCode).toBe(401)
    expect(deps.checkRateLimitImpl).not.toHaveBeenCalled()
    expect(deps.getGenerationJobSnapshotImpl).not.toHaveBeenCalled()
  })
})
