import { describe, expect, it, vi } from 'vitest'
import { createWodBusterCoachEventsHandler, resolveWodBusterCoachAssignment } from './wodbuster-coach-events.js'

const config = { enabled: true, individualCoachAccess: true, secret: 'local-test-secret', organizationId: '018f1f4d-7b6c-7d8e-9f10-111213141517', serviceKey: 'service-role', supabaseUrl: 'https://staging.supabase.test' }
function request(body = {}) { return { method: 'POST', headers: { 'x-evo-wodbuster-key': 'local-test-secret' }, body: { id: 'wodbuster-demo-001', type: 'trial.confirmed', coachId: 'javi', occurredAt: '2026-09-08T09:30:00+02:00', person: { reference: 'Caso de prueba A', phase: 'Clase de prueba' }, ...body } } }
function response() { return { statusCode: null, body: null, status: vi.fn(function set(code) { this.statusCode = code; return this }), json: vi.fn(function send(body) { this.body = body; return this }) } }
function members(rows = [{ user_id: 'coach-dani-uuid', role_key: 'coach', status: 'active', profiles: { full_name: 'Dani EVO' } }]) {
  const memberships = rows.map(({ profiles, ...membership }) => membership)
  const profiles = rows.map((row) => ({ id: row.user_id, ...(Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) }))
  const membershipChain = { eq: vi.fn(), limit: vi.fn() }
  membershipChain.eq.mockReturnValue(membershipChain)
  membershipChain.limit.mockResolvedValue({ data: memberships, error: null })
  const profileChain = { in: vi.fn() }
  profileChain.in.mockResolvedValue({ data: profiles, error: null })
  return { from: vi.fn((table) => ({ select: vi.fn(() => table === 'evo_memberships' ? membershipChain : profileChain) })) }
}
function unit(options = {}) { const recordEventImpl = options.recordEventImpl || vi.fn().mockResolvedValue({ created: true, event: { event_type: 'trial.confirmed' } }); return { recordEventImpl, handler: createWodBusterCoachEventsHandler({ createClientImpl: vi.fn(() => options.supabase || members()), recordEventImpl, readConfigImpl: options.readConfigImpl || (() => config), requestIdImpl: () => 'request-one', nowImpl: () => new Date('2026-09-08T08:00:00.000Z'), logger: { info: vi.fn(), warn: vi.fn() } }) } }

describe('POST /api/wodbuster-coach-events', () => {
  it('registra solo un evento operativo autorizado y lo asigna a la identidad EVO', async () => { const app = unit(); const res = response(); await app.handler(request({ coachName: 'Dani' }), res); expect(res.statusCode).toBe(201); expect(res.body).toMatchObject({ ok: true, eventType: 'trial.confirmed' }); expect(app.recordEventImpl).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ source: 'wodbuster', person_id: null, idempotency_key: 'wodbuster-coach:wodbuster-demo-001', payload: expect.objectContaining({ coach_id: 'coach-dani-uuid' }) })) })
  it('permanece oculto hasta activar el acceso individual de entrenadores', async () => { const app = unit({ readConfigImpl: () => ({ ...config, individualCoachAccess: false }) }); const res = response(); await app.handler(request(), res); expect(res.statusCode).toBe(404); expect(app.recordEventImpl).not.toHaveBeenCalled() })
  it('rechaza orígenes sin clave, datos personales y pagos', async () => { const app = unit(); const withoutKey = response(); const personal = response(); const payment = response(); await app.handler({ ...request(), headers: {} }, withoutKey); await app.handler(request({ person: { reference: 'Caso A', email: 'persona@example.test' } }), personal); await app.handler(request({ type: 'payment.completed' }), payment); expect(withoutKey.statusCode).toBe(401); expect(personal.body.error).toContain('forbidden'); expect(payment.body.error).toBe('event_type_not_allowed'); expect(app.recordEventImpl).not.toHaveBeenCalled() })
  it('rechaza campos que no pertenezcan al relevo minimo', async () => {
    const app = unit()
    const extraEventField = response()
    const extraPersonField = response()
    await app.handler(request({ rawPayload: 'no se conserva' }), extraEventField)
    await app.handler(request({ person: { reference: 'Caso A', internalNote: 'no se conserva' } }), extraPersonField)
    expect(extraEventField.statusCode).toBe(400)
    expect(extraEventField.body.error).toBe('event.rawPayload_not_allowed')
    expect(extraPersonField.statusCode).toBe(400)
    expect(extraPersonField.body.error).toBe('person.internalNote_not_allowed')
    expect(app.recordEventImpl).not.toHaveBeenCalled()
  })

  it('no registra una prueba si WodBuster no identifica de forma inequívoca al coach', async () => {
    const noMatch = unit()
    const ambiguous = unit({ supabase: members([
      { user_id: 'one', role_key: 'coach', status: 'active', profiles: { full_name: 'Dani Primera' } },
      { user_id: 'two', role_key: 'coach', status: 'active', profiles: { full_name: 'Dani Segunda' } },
    ]) })
    const missingRes = response()
    const ambiguousRes = response()
    await noMatch.handler(request({ coachName: 'Otra persona' }), missingRes)
    await ambiguous.handler(request({ coachName: 'Dani' }), ambiguousRes)
    expect(missingRes.statusCode).toBe(422)
    expect(missingRes.body.error).toBe('coach_assignment_not_found')
    expect(ambiguousRes.statusCode).toBe(422)
    expect(ambiguousRes.body.error).toBe('coach_assignment_ambiguous')
    expect(noMatch.recordEventImpl).not.toHaveBeenCalled()
    expect(ambiguous.recordEventImpl).not.toHaveBeenCalled()
  })

  it('normaliza acentos, el alias de Dani y bloquea resultados sin una sola coincidencia', () => {
    expect(resolveWodBusterCoachAssignment([{ user_id: 'dani', role_key: 'coach', status: 'active', profiles: { full_name: 'Daniel García' } }], 'DÁNI')).toEqual({ coachId: 'dani' })
    expect(resolveWodBusterCoachAssignment([], 'Dani')).toEqual({ error: 'coach_assignment_not_found' })
  })
})
