import { describe, expect, it, vi } from 'vitest'
import { createWodBusterFollowupInboxHandler } from './wodbuster-followup-inbox.js'

const settings = { secret: 'a'.repeat(32), organizationId: '018f1f4d-7b6c-7d8e-9f10-111213141517', serviceKey: 'service-role', supabaseUrl: 'https://example.supabase.test' }
function response() { return { statusCode: 0, body: null, status: vi.fn(function set(code) { this.statusCode = code; return this }), json: vi.fn(function send(body) { this.body = body; return this }) } }
function query(rows = []) { const chain = { select: vi.fn(() => chain), eq: vi.fn(() => chain), order: vi.fn(() => chain), limit: vi.fn(() => Promise.resolve({ data: rows, error: null })) }; return { from: vi.fn(() => chain) } }

describe('GET /api/wodbuster-followup-inbox', () => {
  it('returns only the minimum follow-up signal', async () => {
    const client = query([{ event_id: 'event-1', event_type: 'member.followup_signal', occurred_at: '2026-10-07T09:00:00.000Z', payload: { member: { reference: 'athlete-123', firstName: 'Lucía' }, signal: { code: 'inactive_no_next_booking', inactiveDays: 7, nextBookingDays: null }, ignored: 'never returned' } }])
    const handler = createWodBusterFollowupInboxHandler({ createClientImpl: vi.fn(() => client), readConfigImpl: () => settings })
    const res = response(); await handler({ method: 'GET', headers: { authorization: `Bearer ${settings.secret}` } }, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, followups: [{ sourceEventId: 'event-1', occurredAt: '2026-10-07T09:00:00.000Z', memberReference: 'athlete-123', memberFirstName: 'Lucía', memberFullName: 'Lucía', signal: 'inactive_no_next_booking', inactiveDays: 7, nextBookingDays: null }] })
  })
  it('rejects unauthorised reads', async () => {
    const handler = createWodBusterFollowupInboxHandler({ createClientImpl: vi.fn(), readConfigImpl: () => settings })
    const res = response(); await handler({ method: 'GET', headers: {} }, res)
    expect(res.statusCode).toBe(401)
  })

  it('keeps an earlier signal visible without revealing an identifier as a name', async () => {
    const client = query([{ event_id: 'event-legacy', event_type: 'member.followup_signal', occurred_at: '2026-10-06T09:00:00.000Z', payload: { member: { reference: 'athlete-legacy' }, signal: { code: 'inactive_no_next_booking', inactiveDays: 7, nextBookingDays: null } } }])
    const handler = createWodBusterFollowupInboxHandler({ createClientImpl: vi.fn(() => client), readConfigImpl: () => settings })
    const res = response(); await handler({ method: 'GET', headers: { authorization: `Bearer ${settings.secret}` } }, res)
    expect(res.body.followups[0]).toMatchObject({ memberReference: 'athlete-legacy', memberFirstName: null, memberFullName: null })
  })

  it('uses the dedicated Office reader for current inactivity, returning only the minimal signal', async () => {
    const currentSettings = { ...settings, officeReaderUser: 'office-reader', officeReaderPassword: 'office-password' }
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [
      { Dni: 'private-identity', Nombre: 'Lucía', Apellido1: 'Apellido', Apellido2: 'Segundo', 'Nombre para mostrar': 'legacy-handle', 'Días sin entrenar': 7, Email: 'private@example.test' },
      { Dni: 'recent-identity', Nombre: 'Ana Apellido', 'Días sin entrenar': 2 },
    ] })
    const handler = createWodBusterFollowupInboxHandler({ createClientImpl: vi.fn(), readConfigImpl: () => currentSettings, fetchImpl, nowImpl: () => new Date('2026-10-12T12:00:00.000Z') })
    const res = response(); await handler({ method: 'GET', headers: { authorization: `Bearer ${settings.secret}` } }, res)
    expect(res.statusCode).toBe(200)
    expect(fetchImpl.mock.calls[0][0]).toBe('https://evolution.wodbuster.com/api/box/Atletas')
    expect(fetchImpl.mock.calls[0][1].body).toBe('SoloActivos=true')
    expect(res.body).toEqual({
      ok: true,
      source: 'wodbuster_active_athletes',
      followups: [expect.objectContaining({ memberFirstName: 'Lucía', memberFullName: 'Lucía Apellido Segundo', signal: 'inactive_needs_check', inactiveDays: 7, nextBookingDays: null })],
    })
    expect(JSON.stringify(res.body)).not.toContain('private-identity')
    expect(JSON.stringify(res.body)).not.toContain('private@example.test')
  })
})
