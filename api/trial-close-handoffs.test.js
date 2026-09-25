import { describe, expect, it, vi } from 'vitest'
import { createTrialCloseHandoffsHandler } from './trial-close-handoffs.js'

function response() {
  return {
    statusCode: null, body: null,
    status: vi.fn(function status(code) { this.statusCode = code; return this }),
    json: vi.fn(function json(body) { this.body = body; return this }),
  }
}

function harness({ data = [], error = null } = {}) {
  const limit = vi.fn().mockResolvedValue({ data, error })
  const order = vi.fn(() => ({ limit }))
  const eqType = vi.fn(() => ({ order }))
  const eqOrganization = vi.fn(() => ({ eq: eqType }))
  const select = vi.fn(() => ({ eq: eqOrganization }))
  const from = vi.fn(() => ({ select }))
  return {
    from, limit,
    handler: createTrialCloseHandoffsHandler({
      createClientImpl: vi.fn(() => ({ from })),
      readConfigImpl: () => ({
        secret: 'a'.repeat(32), organizationId: 'org-001', serviceKey: 'service-key', supabaseUrl: 'https://db.test',
      }),
      requestIdImpl: () => 'request-one',
    }),
  }
}

const event = {
  event_id: 'cefe3d4a-4ef9-4b9d-95a9-70c05960c1dc', event_type: 'trial.close.recorded',
  occurred_at: '2026-09-25T11:30:00.000Z', organization_id: 'org-001', external_id: 'referencia-001',
  payload: { attendance: 'vino', entry_point: 'EVO Basics', priority: 'Coordinación y aprendizaje de movimientos', adaptations: 'privado', reason: 'privado' },
}

describe('GET /api/trial-close-handoffs', () => {
  it('entrega solo el contrato reducido con secreto válido', async () => {
    const unit = harness({ data: [event] }); const res = response()
    await unit.handler({ method: 'GET', headers: { authorization: `Bearer ${'a'.repeat(32)}` }, query: {} }, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.handoffs).toEqual([expect.objectContaining({
      personReference: 'referencia-001', attendance: 'vino', recommendedEntryPoint: 'EVO Basics',
      excludedFields: ['coach_id', 'adaptations', 'reason'],
    })])
    expect(JSON.stringify(res.body)).not.toContain('privado')
  })

  it('rechaza quien no conoce el secreto y no consulta eventos', async () => {
    const unit = harness(); const res = response()
    await unit.handler({ method: 'GET', headers: { authorization: 'Bearer incorrecto' }, query: {} }, res)
    expect(res.statusCode).toBe(401)
    expect(unit.from).not.toHaveBeenCalled()
  })

  it('limita la lectura a cien cierres', async () => {
    const unit = harness(); const res = response()
    await unit.handler({ method: 'GET', headers: { authorization: `Bearer ${'a'.repeat(32)}` }, query: { limit: '1000' } }, res)
    expect(unit.limit).toHaveBeenCalledWith(100)
  })
})
