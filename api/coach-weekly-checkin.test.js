import { describe, expect, it, vi } from 'vitest'
import { EvoCapabilityAuthError } from './lib/evoCapabilityAuth.js'
import { createCoachWeeklyCheckinHandler } from './coach-weekly-checkin.js'

function request(body = {}) {
  return {
    method: 'POST',
    headers: {
      authorization: 'Bearer individual-token',
      origin: 'http://localhost:5173',
      'x-forwarded-for': '127.0.0.1',
    },
    body: {
      coach_name: 'Coach EVO',
      week_iso: '2026-W33',
      mood_score: 4,
      feedback_text: 'Semana estable',
      ...body,
    },
  }
}

function response() {
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

function harness(options = {}) {
  const single = vi.fn().mockResolvedValue({
    data: { id: 'checkin-one', coach_id: 'user-one' },
    error: null,
  })
  const query = {
    upsert: vi.fn(),
    select: vi.fn(),
    single,
  }
  query.upsert.mockReturnValue(query)
  query.select.mockReturnValue(query)
  const serviceClient = { from: vi.fn(() => query) }
  const createClientImpl = vi.fn(() => serviceClient)
  const requireCapabilityImpl = options.requireCapabilityImpl || vi.fn().mockResolvedValue({
    user: { id: 'user-one' },
    capability: 'coach.workspace.access',
    organizationId: 'org-one',
  })
  const checkRateLimitImpl = options.checkRateLimitImpl || vi.fn().mockResolvedValue(false)
  const logger = { info: vi.fn(), error: vi.fn() }
  const config = options.config || {
    coachCode: 'LEGACY-CODE',
    individualAuthEnabled: true,
    serviceKey: 'service-role',
    supabaseUrl: 'https://staging.supabase.test',
  }

  return {
    handler: createCoachWeeklyCheckinHandler({
      createClientImpl,
      requireCapabilityImpl,
      checkRateLimitImpl,
      readConfigImpl: () => config,
      requestIdImpl: () => 'request-one',
      logger,
    }),
    query,
    single,
    serviceClient,
    createClientImpl,
    requireCapabilityImpl,
    checkRateLimitImpl,
    logger,
  }
}

describe('POST /api/coach-weekly-checkin', () => {
  it('usa Auth individual y fija coach_id desde la identidad autorizada', async () => {
    const unit = harness()
    const res = response()

    await unit.handler(request(), res)

    expect(res.statusCode).toBe(200)
    expect(unit.requireCapabilityImpl).toHaveBeenCalledWith(
      expect.anything(),
      'coach.workspace.access',
    )
    expect(unit.query.upsert).toHaveBeenCalledWith(expect.objectContaining({
      coach_name: 'Coach EVO',
      coach_id: 'user-one',
      week_iso: '2026-W33',
      mood_score: 4,
    }), { onConflict: 'week_iso,coach_name_norm' })
    expect(unit.logger.info).toHaveBeenCalledWith(
      'coach_weekly_checkin_recorded',
      { requestId: 'request-one', method: 'individual_identity' },
    )
  })

  it('no intenta Auth individual cuando el flag está apagado', async () => {
    const unit = harness({
      config: {
        coachCode: 'LEGACY-CODE',
        individualAuthEnabled: false,
        serviceKey: 'service-role',
        supabaseUrl: 'https://staging.supabase.test',
      },
    })
    const res = response()

    await unit.handler(request(), res)

    expect(res.statusCode).toBe(401)
    expect(res.body.error).toBe('coach_authentication_required')
    expect(unit.requireCapabilityImpl).not.toHaveBeenCalled()
    expect(unit.query.upsert).not.toHaveBeenCalled()
  })

  it('conserva el código compartido como rollback temporal', async () => {
    const unit = harness({
      config: {
        coachCode: 'LEGACY-CODE',
        individualAuthEnabled: false,
        serviceKey: 'service-role',
        supabaseUrl: 'https://staging.supabase.test',
      },
    })
    const res = response()

    await unit.handler(request({ accessCode: ' legacy-code ' }), res)

    expect(res.statusCode).toBe(200)
    expect(unit.requireCapabilityImpl).not.toHaveBeenCalled()
    expect(unit.query.upsert).toHaveBeenCalledWith(expect.objectContaining({
      coach_id: null,
    }), { onConflict: 'week_iso,coach_name_norm' })
  })

  it('propaga un fallo cerrado de autorización sin filtrar detalles', async () => {
    const unit = harness({
      requireCapabilityImpl: vi.fn().mockRejectedValue(
        new EvoCapabilityAuthError('identity_authorization_unavailable', 503),
      ),
    })
    const res = response()

    await unit.handler(request(), res)

    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({
      error: 'identity_authorization_unavailable',
      requestId: 'request-one',
    })
    expect(unit.query.upsert).not.toHaveBeenCalled()
  })

  it('rechaza origen y payload inválidos antes de escribir', async () => {
    const unit = harness()
    const badOrigin = response()
    const badPayload = response()

    await unit.handler({
      ...request(),
      headers: { origin: 'https://attacker.example' },
    }, badOrigin)
    await unit.handler(request({ mood_score: 9 }), badPayload)

    expect(badOrigin.statusCode).toBe(403)
    expect(badPayload.statusCode).toBe(400)
    expect(unit.query.upsert).not.toHaveBeenCalled()
  })

  it('falla cerrado cuando el rate limit no está disponible', async () => {
    const unit = harness({
      checkRateLimitImpl: vi.fn().mockRejectedValue(new Error('database detail')),
    })
    const res = response()

    await unit.handler(request(), res)

    expect(res.statusCode).toBe(503)
    expect(res.body.error).toBe('rate_limit_unavailable')
    expect(unit.query.upsert).not.toHaveBeenCalled()
  })

  it('sanea errores de escritura y solo registra el código técnico', async () => {
    const unit = harness()
    unit.single.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'sensitive database detail' },
    })
    const res = response()

    await unit.handler(request(), res)

    expect(res.statusCode).toBe(503)
    expect(res.body.error).toBe('checkin_write_unavailable')
    expect(JSON.stringify(res.body)).not.toContain('sensitive database detail')
    expect(unit.logger.error).toHaveBeenCalledWith(
      'coach_weekly_checkin_write_failed',
      { requestId: 'request-one', code: '42501' },
    )
  })
})
