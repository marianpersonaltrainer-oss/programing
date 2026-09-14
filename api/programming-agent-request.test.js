import { describe, expect, it, vi } from 'vitest'
import { createProgrammingAgentRequestHandler } from './programming-agent-request.js'

function response() {
  return {
    statusCode: null,
    body: null,
    setHeader: vi.fn(),
    status: vi.fn(function status(code) { this.statusCode = code; return this }),
    json: vi.fn(function json(body) { this.body = body; return this }),
  }
}

const body = {
  action: 'create',
  secret: 'admin-secret',
  fingerprint: 'weekly-briefing-2026-09-14-abc123',
  target: {
    mesocycle: 'Base', week: 2, cycleStartDate: '2026-09-07', targetWeekStartDate: '2026-09-14',
  },
  contextPack: 'Contexto verificado.',
  generationDays: ['LUNES'],
}

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-secret',
  COACH_GUIDE_ADMIN_SECRET: 'admin-secret',
}

describe('POST /api/programming-agent-request', () => {
  it('solo crea la solicitud privada con la sesión de administración válida', async () => {
    const enqueue = vi.fn().mockResolvedValue({
      created: true, request: { ticket: 'private-ticket', status: 'queued' },
    })
    const handler = createProgrammingAgentRequestHandler({
      env,
      broker: { enqueue, status: vi.fn() },
      createClientImpl: vi.fn(() => ({})),
      checkRateLimitImpl: vi.fn().mockResolvedValue(false),
      requestIdImpl: () => 'request-1',
    })
    const res = response()
    await handler({ method: 'POST', headers: { origin: 'https://programing-evo.vercel.app' }, body }, res)
    expect(res.statusCode).toBe(202)
    expect(enqueue).toHaveBeenCalledWith(body)
    expect(res.body).toMatchObject({ ok: true, created: true, requestId: 'request-1' })
  })

  it('no crea solicitudes sin la clave administrativa', async () => {
    const enqueue = vi.fn()
    const handler = createProgrammingAgentRequestHandler({
      env,
      broker: { enqueue, status: vi.fn() },
      createClientImpl: vi.fn(() => ({})),
      checkRateLimitImpl: vi.fn(),
      requestIdImpl: () => 'request-2',
    })
    const res = response()
    await handler({
      method: 'POST', headers: { origin: 'https://programing-evo.vercel.app' }, body: { ...body, secret: 'wrong' },
    }, res)
    expect(res.statusCode).toBe(401)
    expect(enqueue).not.toHaveBeenCalled()
  })
})
