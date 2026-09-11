import { expect, it, vi } from 'vitest'
import { createReadCheck } from './wodbuster-read-check.js'
function response() {
  return { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() }
}
it('rejects unauthenticated requests without consulting WodBuster', async () => {
  const probe = vi.fn()
  const handler = createReadCheck({ env: { COACH_GUIDE_ADMIN_SECRET: 'test-secret' }, probe })
  const res = response()
  await handler({ method: 'POST', headers: {} }, res)
  expect(res.status).toHaveBeenCalledWith(401)
  expect(probe).not.toHaveBeenCalled()
})
it('limits the query to the preceding 24h and throttles repeat requests per instance', async () => {
  const probe = vi.fn().mockResolvedValue({ ok: true, records: 0, fields: [] })
  const handler = createReadCheck({ env: { COACH_GUIDE_ADMIN_SECRET: 'test-secret' }, probe, now: () => Date.parse('2026-09-11T08:00:00Z') })
  const req = { method: 'POST', headers: { 'x-evo-admin-secret': 'test-secret' } }
  const res = response()
  await handler(req, res)
  expect(probe.mock.calls[0][0]).toMatchObject({ from: '2026-09-10T08:00:00.000Z', to: '2026-09-11T08:00:00.000Z' })
  await handler(req, res)
  expect(probe).toHaveBeenCalledTimes(1)
  expect(res.status).toHaveBeenLastCalledWith(429)
})
