import { describe, expect, it, vi } from 'vitest'
import { createOfficeReadCheck } from './wodbuster-office-read-check.js'

function response() {
  return {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  }
}

const env = {
  COACH_GUIDE_ADMIN_SECRET: 'private-admin-token',
  WODBUSTER_OFFICE_READ_USER: 'office-reader',
  WODBUSTER_OFFICE_READ_PASSWORD: 'office-secret',
}

describe('Office WodBuster source check', () => {
  it('fails closed without the private admin secret', async () => {
    const probe = vi.fn()
    const handler = createOfficeReadCheck({ env, probe })
    const res = response()
    await handler({ method: 'POST', headers: {} }, res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(probe).not.toHaveBeenCalled()
  })

  it('uses only the dedicated credential for a past-day activity schema check', async () => {
    const probe = vi.fn().mockResolvedValue({ ok: true, status: 200, records: 4, fields: ['Fecha'] })
    const handler = createOfficeReadCheck({ env, probe, now: () => Date.parse('2026-10-12T12:00:00Z') })
    const res = response()
    await handler({ method: 'POST', headers: { 'x-evo-admin-secret': 'private-admin-token' }, query: {} }, res)
    expect(probe).toHaveBeenCalledWith(expect.objectContaining({
      report: 'CuantoEntrenan',
      env: expect.objectContaining({
        WODBUSTER_API_USER: 'office-reader',
        WODBUSTER_API_PASSWORD: 'office-secret',
        WODBUSTER_BOX: 'evolution',
      }),
    }))
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mode: 'schema_only', check: 'activity-past', records: 4 }))
  })

  it('reads active-athlete schema without dates or row data', async () => {
    const probe = vi.fn().mockResolvedValue({ ok: true, status: 200, records: 8, fields: ['Nombre'] })
    const handler = createOfficeReadCheck({ env, probe, now: () => Date.parse('2026-10-12T12:00:00Z') })
    const res = response()
    await handler({ method: 'POST', headers: { 'x-evo-admin-secret': 'private-admin-token' }, query: { check: 'active-athletes' } }, res)
    expect(probe).toHaveBeenCalledWith(expect.objectContaining({ report: 'Atletas' }))
    expect(probe.mock.calls[0][0]).not.toHaveProperty('from')
    expect(probe.mock.calls[0][0]).not.toHaveProperty('to')
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ check: 'active-athletes', records: 8 }))
  })
})
