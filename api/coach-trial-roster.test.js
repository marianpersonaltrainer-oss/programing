import { describe, expect, it, vi } from 'vitest'
import { createCoachTrialRosterHandler, toCoachTrialRosterItem } from './coach-trial-roster.js'

const now = new Date('2026-09-26T08:00:00.000Z')
const identity = { user: { id: '00000000-0000-4000-8000-000000000001' }, organizationId: '00000000-0000-4000-8000-000000000002' }
const accepted = { event_id: '00000000-0000-4000-8000-000000000010', event_type: 'trial.confirmed', source: 'wodbuster', payload: { coach_id: identity.user.id, person: { reference: 'trial-001', sessionAt: '2026-09-27T08:00:00.000Z', classLabel: 'EVO Basics', objective: 'Ganar confianza', precaution: 'Evitar saltos al inicio' } } }
function response() { return { statusCode: null, body: null, status: vi.fn(function status(code) { this.statusCode = code; return this }), json: vi.fn(function json(body) { this.body = body; return this }) } }
function request() { return { method: 'GET', headers: { authorization: 'Bearer coach-token', origin: 'http://localhost:5173', 'x-forwarded-for': '127.0.0.1' } } }
function source(rows) { const chain = { select: vi.fn(() => chain), eq: vi.fn(() => chain), in: vi.fn(() => chain), order: vi.fn(() => chain), limit: vi.fn(async () => ({ data: rows, error: null })) }; return { from: vi.fn(() => chain) } }
describe('GET /api/coach-trial-roster', () => {
  it('solo devuelve la prueba futura asignada exactamente al coach autenticado', async () => {
    const handler = createCoachTrialRosterHandler({ createClientImpl: vi.fn(() => source([accepted, { ...accepted, event_id: 'other', payload: { coach_id: 'otro-coach', person: accepted.payload.person } }, { ...accepted, event_id: 'old', payload: { coach_id: identity.user.id, person: { ...accepted.payload.person, sessionAt: '2026-09-20T08:00:00.000Z' } } }])), requireCapabilityImpl: vi.fn().mockResolvedValue(identity), checkRateLimitImpl: vi.fn().mockResolvedValue(false), readConfigImpl: () => ({ serviceKey: 'service-role', supabaseUrl: 'https://staging.supabase.test' }), requestIdImpl: () => 'request-one', nowImpl: () => now })
    const res = response(); await handler(request(), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ ok: true, sent: false, roster: [{ sourceEventId: '00000000-0000-4000-8000-000000000010', personReference: 'trial-001', classLabel: 'EVO Basics', profile: { objective: 'Ganar confianza', precaution: 'Evitar saltos al inicio' } }] })
  })
  it('no convierte reserva en asistencia ni expone campos fuera del mínimo', () => {
    const item = toCoachTrialRosterItem({ ...accepted, payload: { coach_id: identity.user.id, person: { ...accepted.payload.person, email: 'blocked@example.test' } } }, identity.user.id, now)
    expect(item).toEqual({ sourceEventId: '00000000-0000-4000-8000-000000000010', personReference: 'trial-001', sessionAt: '2026-09-27T08:00:00.000Z', classLabel: 'EVO Basics', profile: { objective: 'Ganar confianza', precaution: 'Evitar saltos al inicio' }, briefSource: '' })
  })

  it('añade solo el resumen enlazado exactamente a la prueba y al coach', async () => {
    const brief = {
      event_id: '00000000-0000-4000-8000-000000000011',
      event_type: 'trial.brief.prepared',
      source: 'coachbrief',
      payload: {
        coach_id: identity.user.id,
        trial_reference: 'trial-001',
        session_at: '2026-09-27T08:00:00.000Z',
        brief_source: 'calendly',
        profile: { context: 'Quiere volver a moverse con constancia.', observe: 'Explicar la dinámica con calma.' },
      },
    }
    const handler = createCoachTrialRosterHandler({ createClientImpl: vi.fn(() => source([accepted, brief])), requireCapabilityImpl: vi.fn().mockResolvedValue(identity), checkRateLimitImpl: vi.fn().mockResolvedValue(false), readConfigImpl: () => ({ serviceKey: 'service-role', supabaseUrl: 'https://staging.supabase.test' }), requestIdImpl: () => 'request-brief', nowImpl: () => now })
    const res = response(); await handler(request(), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.roster).toEqual([expect.objectContaining({
      personReference: 'trial-001',
      briefSource: 'calendly',
      profile: expect.objectContaining({ context: 'Quiere volver a moverse con constancia.', observe: 'Explicar la dinámica con calma.' }),
    })])
  })
})
