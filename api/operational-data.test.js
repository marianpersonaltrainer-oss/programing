import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOperationalDataHandler } from './operational-data.js'
import { EvoCapabilityAuthError } from './lib/evoCapabilityAuth.js'

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
    checkRateLimitImpl: vi.fn().mockResolvedValue(false),
    executeActionImpl: vi.fn().mockResolvedValue({ data: { id: 'ok' }, error: null }),
    requireCapabilityImpl: vi.fn().mockRejectedValue(
      Object.assign(new Error('authentication_required'), {
        code: 'authentication_required',
        status: 401,
      }),
    ),
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

  it('permite una acción coach con identidad individual y capability', async () => {
    const requireCapabilityImpl = vi.fn().mockResolvedValue({
      user: { id: 'user-1' },
      capability: 'coach.workspace.access',
      organizationId: 'org-a',
    })
    const { handler, deps } = harness({ requireCapabilityImpl })
    const req = request({
      action: 'handover_status',
      payload: {
        weekId: '00000000-0000-4000-8000-000000000001',
        coachName: 'Coach',
      },
    })
    req.headers.authorization = 'Bearer individual-jwt'
    const res = response()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(requireCapabilityImpl).toHaveBeenCalledWith(
      req,
      'coach.workspace.access',
    )
    expect(deps.executeActionImpl).toHaveBeenCalledOnce()
  })

  it('no convierte una capability coach en permiso administrativo', async () => {
    const requireCapabilityImpl = vi.fn().mockResolvedValue({
      user: { id: 'user-1' },
      capability: 'coach.workspace.access',
      organizationId: 'org-a',
    })
    const { handler, deps } = harness({ requireCapabilityImpl })
    const req = request({ action: 'list_weekly_checkins', payload: {} })
    req.headers.authorization = 'Bearer individual-jwt'
    const res = response()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(requireCapabilityImpl).not.toHaveBeenCalled()
    expect(deps.executeActionImpl).not.toHaveBeenCalled()
  })

  it('falla cerrado si no puede resolver capabilities', async () => {
    const requireCapabilityImpl = vi.fn().mockRejectedValue(
      Object.assign(new Error('internal detail'), {
        code: 'identity_authorization_unavailable',
        status: 503,
      }),
    )
    const { handler, deps } = harness({ requireCapabilityImpl })
    const req = request({ action: 'handover_status', payload: {} })
    req.headers.authorization = 'Bearer individual-jwt'
    const res = response()

    await handler(req, res)

    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({ error: 'identity_authorization_unavailable' })
    expect(JSON.stringify(res.body)).not.toContain('internal detail')
    expect(deps.executeActionImpl).not.toHaveBeenCalled()
  })

  it('no ejecuta acciones coach si falta elegir organización', async () => {
    const requireCapabilityImpl = vi.fn().mockRejectedValue(
      new EvoCapabilityAuthError('organization_context_required', 409),
    )
    const { handler, deps } = harness({ requireCapabilityImpl })
    const req = request({ action: 'handover_status', payload: {} })
    req.headers.authorization = 'Bearer individual-jwt'
    const res = response()

    await handler(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ error: 'organization_context_required' })
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

  it('rechaza la petición cuando el bucket supera el límite', async () => {
    const { handler, deps } = harness({
      checkRateLimitImpl: vi.fn().mockResolvedValue(true),
    })
    const res = response()

    await handler(
      request({
        action: 'list_assistant_history',
        adminSecret: 'admin-secret',
        payload: {},
      }),
      res,
    )

    expect(res.statusCode).toBe(429)
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
