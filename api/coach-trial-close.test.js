import { describe, expect, it, vi } from 'vitest'
import { EvoCapabilityAuthError } from './lib/evoCapabilityAuth.js'
import { createCoachTrialCloseHandler } from './coach-trial-close.js'

const validBody = {
  person_reference: 'lead-001',
  attendance: 'vino',
  entry_point: 'EVO Basics',
  priority: 'Retomar y crear constancia',
  adaptations: 'ninguna',
  reason: 'Buena experiencia inicial; necesita empezar poco a poco.',
  submission_id: '00000000-0000-4000-8000-000000000001',
  source_event_id: '00000000-0000-4000-8000-000000000010',
}

function request(body = validBody) {
  return {
    method: 'POST',
    headers: {
      authorization: 'Bearer individual-token',
      origin: 'http://localhost:5173',
      'x-forwarded-for': '127.0.0.1',
    },
    body,
  }
}

function response() {
  return {
    statusCode: null,
    body: null,
    status: vi.fn(function status(code) { this.statusCode = code; return this }),
    json: vi.fn(function json(body) { this.body = body; return this }),
  }
}

function harness(overrides = {}) {
  const serviceClient = { kind: 'service-client' }
  const recordEventImpl = vi.fn().mockResolvedValue({
    created: true,
    event: { event_id: '00000000-0000-4000-8000-000000000999' },
  })
  const requireCapabilityImpl = vi.fn().mockResolvedValue({
    user: { id: '00000000-0000-4000-8000-000000000002' },
    capability: 'coach.workspace.access',
    organizationId: '00000000-0000-4000-8000-000000000003',
  })
  return {
    recordEventImpl,
    requireCapabilityImpl,
    handler: createCoachTrialCloseHandler({
      createClientImpl: vi.fn(() => serviceClient),
      requireCapabilityImpl,
      checkRateLimitImpl: vi.fn().mockResolvedValue(false),
      recordEventImpl,
      readConfigImpl: () => ({
        serviceKey: 'service-role',
        supabaseUrl: 'https://staging.supabase.test',
      }),
      requestIdImpl: () => 'request-one',
      nowImpl: () => new Date('2026-09-25T10:00:00.000Z'),
      logger: { info: vi.fn(), warn: vi.fn() },
      ...overrides,
    }),
  }
}

describe('POST /api/coach-trial-close', () => {
  it('solo persiste el cierre mediante identidad Coach individual', async () => {
    const unit = harness()
    const res = response()

    await unit.handler(request(), res)

    expect(res.statusCode).toBe(201)
    expect(unit.requireCapabilityImpl).toHaveBeenCalledWith(
      expect.anything(), 'coach.workspace.access',
    )
    expect(unit.recordEventImpl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event_type: 'trial.close.recorded',
        source: 'coach',
        organization_id: '00000000-0000-4000-8000-000000000003',
        person_id: null,
        external_id: 'lead-001',
        sync_status: 'pending',
        payload: expect.objectContaining({
          coach_id: '00000000-0000-4000-8000-000000000002',
          source_event_id: '00000000-0000-4000-8000-000000000010',
          attendance: 'vino',
        }),
        causation_id: '00000000-0000-4000-8000-000000000010',
      }),
    )
  })

  it('rechaza el código compartido o cualquier sesión sin capability', async () => {
    const unit = harness({
      requireCapabilityImpl: vi.fn().mockRejectedValue(
        new EvoCapabilityAuthError('authentication_required', 401),
      ),
    })
    const res = response()

    await unit.handler(request({ ...validBody, accessCode: 'legacy-code' }), res)

    expect(res.statusCode).toBe(401)
    expect(unit.recordEventImpl).not.toHaveBeenCalled()
  })

  it('rechaza valores fuera del contrato antes de escribir', async () => {
    const unit = harness()
    const res = response()

    await unit.handler(request({ ...validBody, attendance: 'quizá' }), res)

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('invalid_trial_close_input')
    expect(unit.recordEventImpl).not.toHaveBeenCalled()
  })

  it('falla cerrado ante un origen ajeno', async () => {
    const unit = harness()
    const res = response()
    const req = request()
    req.headers.origin = 'https://attacker.example'

    await unit.handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(unit.recordEventImpl).not.toHaveBeenCalled()
  })
})
