import { describe, expect, it, vi } from 'vitest'
import { createWodBusterAdapter } from './adapter.js'
import { evaluateFreshness } from './freshness.js'
import { normalizeTraining } from './normalize.js'
import { findRecoveryCandidates } from './recovery.js'
import { reconcileWodBuster } from './reconcile.js'

const raw = (patch = {}) => ({ IdReserva: 8, IdAtleta: 3, IdClase: 10, FechaClase: '2026-08-01T10:00:00Z', Entrenamiento: 'EVO', ...patch })
const now = new Date('2026-08-03T12:00:00Z')

describe('WodBuster normalization', () => {
  it.each([
    ['reserved', { FechaClase: '2026-08-04T10:00:00Z' }],
    ['cancelled', { FechaCancelacion: '2026-08-01T08:00:00Z' }],
    ['late_cancelled', { FechaCancelacion: '2026-08-01T09:55:00Z', BorradoFueraHora: true }],
    ['attended', { FechaLecturaTorno: '2026-08-01T09:59:00Z' }],
    ['no_show', {}],
  ])('normalizes %s without equating reservation and attendance', (status, patch) => {
    expect(normalizeTraining(raw(patch), { now }).status).toBe(status)
  })

  it('crosses one session with every coach', () => {
    const coaches = new Map([['10', [{ externalCoachId: 'a' }, { externalCoachId: 'b' }]]])
    expect(normalizeTraining(raw({ FechaLecturaTorno: '2026-08-01T10:00:00Z' }), { now, coaches }).coaches).toHaveLength(2)
  })
})

describe('transport', () => {
  it('keeps credentials in the configured server-side header', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })
    const adapter = createWodBusterAdapter({ config: { endpoints: { athletes: 'https://example.test/a', training: 'https://example.test/t', coaching: 'https://example.test/c' }, accessKey: 'secret', authHeader: 'API_ACCESS_KEY', timeoutMs: 20 }, fetchImpl })
    await adapter.listTraining({ from: '2026-08-01', to: '2026-08-02' })
    expect(fetchImpl.mock.calls[0][1].headers.API_ACCESS_KEY).toBe('secret')
    expect(String(fetchImpl.mock.calls[0][0])).toContain('FechaInicio=2026-08-01')
  })
})

describe('freshness and Plan B reconciliation', () => {
  const healthy = { last_status: 'ok', last_completed_at: '2026-08-03T11:30:00Z' }
  const missed = { external_reservation_id: 'r1', wodbuster_user_id: 'p1', status: 'no_show', starts_at: '2026-08-01T10:00:00Z' }
  it('waits 24h and suppresses a candidate that relocated', () => {
    const relocated = { external_reservation_id: 'r2', wodbuster_user_id: 'p1', status: 'reserved', starts_at: '2026-08-02T09:00:00Z' }
    expect(findRecoveryCandidates([missed, relocated], [], healthy, { now }).candidates).toEqual([])
  })
  it('creates one candidate after 24h and never duplicates input effects', () => {
    const result = findRecoveryCandidates([missed, missed], [], healthy, { now })
    expect(new Set(result.candidates.map((x) => x.externalReservationId)).size).toBe(1)
  })
  it('suppresses negative actions when stale/degraded', () => {
    expect(findRecoveryCandidates([missed], [], { last_status: 'error' }, { now }).candidates).toEqual([])
    expect(evaluateFreshness(healthy, { now }).healthy).toBe(true)
  })
})

describe('idempotent reconciliation', () => {
  it('uses stable conflict keys on retries and persists confirmed attendance only', async () => {
    const writes = []
    const db = { from: (table) => ({ upsert: async (rows, options) => { writes.push({ table, rows, options }); return { error: null } } }) }
    const adapter = { listAthletes: async () => [{ IdAtleta: 3, Nombre: 'Eva' }], listTraining: async () => [raw({ FechaLecturaTorno: '2026-08-01T10:00:00Z' })], listCoaching: async () => [{ IdClase: 10, IdCoach: 2, Coach: 'Ana' }, { IdClase: 10, IdCoach: 4, Coach: 'Leo' }] }
    await reconcileWodBuster({ adapter, db, orgId: 'org', from: '2026-08-01', to: '2026-08-03', now })
    const attendance = writes.find((x) => x.table === 'mc_wodbuster_attendance')
    expect(attendance.rows[0].confirmed).toBe(true)
    expect(attendance.options.onConflict).toBe('org_id,external_attendance_id')
    expect(writes.find((x) => x.table === 'mc_wodbuster_coach_sessions').rows).toHaveLength(2)
  })
})
