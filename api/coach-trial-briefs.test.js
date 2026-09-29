import { describe, expect, it, vi } from 'vitest'
import { createCoachTrialBriefsHandler } from './coach-trial-briefs.js'

const settings = { enabled: true, secret: 'brief-test-secret', organizationId: '00000000-0000-4000-8000-000000000002', serviceKey: 'service-role', supabaseUrl: 'https://staging.supabase.test' }
const body = { id: 'brief-001', coachId: '00000000-0000-4000-8000-000000000001', trialReference: 'trial-001', sessionAt: '2026-09-28T17:00:00.000Z', classLabel: 'EVO Basics', source: 'calendly', occurredAt: '2026-09-28T08:00:00.000Z', brief: { objective: 'Ganar seguridad al empezar.' } }
function response() { return { statusCode: null, body: null, status: vi.fn(function status(code) { this.statusCode = code; return this }), json: vi.fn(function json(body) { this.body = body; return this }) } }
function request(overrides = {}) { return { method: 'POST', headers: { 'x-evo-trial-brief-key': 'brief-test-secret' }, body, ...overrides } }
function unit(overrides = {}) { const recordEventImpl = overrides.recordEventImpl || vi.fn().mockResolvedValue({ created: true }); return { recordEventImpl, handler: createCoachTrialBriefsHandler({ createClientImpl: vi.fn(() => ({ kind: 'server-client' })), recordEventImpl, readConfigImpl: overrides.readConfigImpl || (() => settings), requestIdImpl: () => 'request-brief', nowImpl: () => new Date('2026-09-28T08:01:00.000Z') }) } }

describe('POST /api/coach-trial-briefs', () => {
  it('guarda solo el resumen mínimo y no expone ni envía una conversación', async () => {
    const app = unit(); const res = response(); await app.handler(request(), res)
    expect(res.statusCode).toBe(201)
    expect(res.body).toMatchObject({ ok: true, created: true })
    expect(app.recordEventImpl).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      event_type: 'trial.brief.prepared', source: 'coachbrief', idempotency_key: 'coach-trial-brief:brief-001',
      payload: expect.objectContaining({ coach_id: body.coachId, trial_reference: 'trial-001', brief_source: 'calendly', profile: body.brief }),
    }))
  })

  it('permanece cerrado hasta configurar su clave exclusiva de servidor', async () => {
    const app = unit({ readConfigImpl: () => ({ ...settings, enabled: false }) }); const res = response(); await app.handler(request(), res)
    expect(res.statusCode).toBe(404)
    expect(app.recordEventImpl).not.toHaveBeenCalled()
  })

  it('rechaza orígenes sin clave y cualquier chat crudo', async () => {
    const app = unit(); const unauthorized = response(); const rawChat = response()
    await app.handler(request({ headers: {} }), unauthorized)
    await app.handler(request({ body: { ...body, conversation: 'texto del chat' } }), rawChat)
    expect(unauthorized.statusCode).toBe(401)
    expect(rawChat.statusCode).toBe(400)
    expect(app.recordEventImpl).not.toHaveBeenCalled()
  })
})
