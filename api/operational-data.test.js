import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOperationalDataHandler } from './operational-data.js'

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

function request(body) {
  return {
    method: 'POST',
    headers: { 'x-forwarded-for': '127.0.0.1' },
    body,
  }
}

function harness(overrides = {}) {
  const deps = {
    createClientImpl: vi.fn(() => ({ kind: 'service-client' })),
    checkRateLimitImpl: vi.fn().mockResolvedValue(true),
    executeActionImpl: vi.fn().mockResolvedValue({ data: { id: 'ok' }, error: null }),
    ...overrides,
  }
  return { handler: createOperationalDataHandler(deps), deps }
}

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://staging.supabase.test'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
  process.env.COACH_ACCESS_CODE = 'COACH-CODE'
  process.env.COACH_GUIDE_ADMIN_SECRET = 'admin-secret'
})

afterEach(() => {
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.COACH_ACCESS_CODE
  delete process.env.COACH_GUIDE_ADMIN_SECRET
  vi.restoreAllMocks()
})

describe('POST /api/operational-data', () => {
  it('permite una acción coach con comparación normalizada y rate limit', async () => {
    const { handler, deps } = harness()
    const res = response()

    await handler(request({
      action: 'handover_status',
      accessCode: ' coach-code ',
      payload: { weekId: '00000000-0000-4000-8000-000000000001', coachName: 'Coach' },
    }), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, data: { id: 'ok' } })
    expect(deps.checkRateLimitImpl).toHaveBeenCalledWith(
      { kind: 'service-client' },
      expect.any(Object),
      expect.objectContaining({ endpoint: '/api/operational-data/handover_status' }),
    )
  })

  it('no permite una acción administrativa con el código coach', async () => {
    const { handler, deps } = harness()
    const res = response()

    await handler(request({
      action: 'list_weekly_checkins',
      accessCode: 'COACH-CODE',
      payload: {},
    }), res)

    expect(res.statusCode).toBe(401)
    expect(deps.executeActionImpl).not.toHaveBeenCalled()
  })

  it('permite una acción administrativa solo con el secreto privado', async () => {
    const { handler, deps } = harness()
    const res = response()

    await handler(request({
      action: 'list_weekly_checkins',
      adminSecret: 'admin-secret',
      payload: {},
    }), res)

    expect(res.statusCode).toBe(200)
    expect(deps.executeActionImpl).toHaveBeenCalledOnce()
  })

  it('falla cerrado si el rate limit no está disponible', async () => {
    const { handler, deps } = harness({
      checkRateLimitImpl: vi.fn().mockRejectedValue(new Error('unavailable')),
    })
    const res = response()

    await handler(request({
      action: 'list_assistant_history',
      adminSecret: 'admin-secret',
      payload: {},
    }), res)

    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({ error: 'Servicio temporalmente no disponible' })
    expect(deps.executeActionImpl).not.toHaveBeenCalled()
  })

  it('no devuelve mensajes internos de Supabase al cliente', async () => {
    const { handler } = harness({
      executeActionImpl: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'sensitive database detail' },
      }),
    })
    const res = response()

    await handler(request({
      action: 'get_assistant_context',
      accessCode: 'COACH-CODE',
      payload: { mesociclo: 'fuerza', semana: 1 },
    }), res)

    expect(res.statusCode).toBe(500)
    expect(JSON.stringify(res.body)).not.toContain('sensitive database detail')
  })
})
