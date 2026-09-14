import { describe, expect, it, vi } from 'vitest'
import { createHeadCoachProgrammingInboxHandler } from './head-coach-programming-inbox.js'

const validPacket = {
  source: 'head_coach_to_programming_agent',
  status: 'context_ready',
  week_start_date: '2026-09-14',
  period: { start: '2026-09-07', end: '2026-09-11' },
  feedback: {
    feedback_total: 1,
    changed_total: 0,
    notes_next_week_total: 0,
    changes_by_class: [],
  },
  review_items: [],
  wodbuster_reconciliation: {
    status: 'coverage_observed',
    unexpected_observed_modality_count: 0,
  },
  automatic_programming_changes: false,
  automatic_publication: false,
  external_actions: false,
}

function response() {
  return {
    statusCode: 0,
    payload: null,
    setHeader: vi.fn(),
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.payload = payload
      return this
    },
  }
}

describe('head coach programming inbox endpoint', () => {
  it('requiere una clave de ingestión y almacena solo el paquete normalizado', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const handler = createHeadCoachProgrammingInboxHandler({
      env: {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service',
        HEAD_COACH_INBOX_INGEST_SECRET: 'shared-secret',
      },
      createClientImpl: vi.fn(() => ({
        from: vi.fn(() => ({ upsert })),
      })),
      checkRateLimitImpl: vi.fn().mockResolvedValue(false),
    })
    const res = response()
    await handler({
      method: 'POST',
      headers: { 'x-head-coach-inbox-secret': 'shared-secret' },
      body: { ...validPacket, coach_name: 'No se guarda' },
    }, res)
    expect(res.statusCode).toBe(200)
    expect(upsert.mock.calls[0][0]).not.toHaveProperty('coach_name')
    expect(upsert.mock.calls[0][0].payload).not.toHaveProperty('coach_name')
  })

  it('rechaza el paquete antes de consultar Supabase si activa publicación', async () => {
    const createClientImpl = vi.fn()
    const handler = createHeadCoachProgrammingInboxHandler({
      env: {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service',
        HEAD_COACH_INBOX_INGEST_SECRET: 'shared-secret',
      },
      createClientImpl,
    })
    const res = response()
    await handler({
      method: 'POST',
      headers: { 'x-head-coach-inbox-secret': 'shared-secret' },
      body: { ...validPacket, automatic_publication: true },
    }, res)
    expect(res.statusCode).toBe(400)
    expect(createClientImpl).not.toHaveBeenCalled()
  })
})
