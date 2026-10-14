import { expect, it, vi } from 'vitest'
import { createWodBusterTrialShadowHandler } from './wodbuster-trial-shadow.js'

function response() { return { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } }
const env = { COACH_GUIDE_ADMIN_SECRET: 'test-secret', WODBUSTER_API_USER: 'user', WODBUSTER_API_PASSWORD: 'password', WODBUSTER_BOX: 'evolution' }
const booking = { Fecha: '2026-10-14', HoraComienzo: '19:00', NombreEntrenamiento: 'EVOBASICS', Invitado: true }
const schedule = { Fecha: '2026-10-14', Hora: '19:00', Entrenamiento: 'EVOBASICS', Coach: 'Dani' }

it('returns counts only for the next 24h in shadow mode', async () => {
  const read = vi.fn().mockImplementation(({ report }) => Promise.resolve({ ok: true, rows: report === 'CuantoEntrenan' ? [booking] : [schedule] }))
  const handler = createWodBusterTrialShadowHandler({ env, read, now: () => Date.parse('2026-10-14T08:00:00Z') })
  const res = response()
  await handler({ method: 'POST', headers: { 'x-evo-admin-secret': 'test-secret' } }, res)
  expect(res.status).toHaveBeenCalledWith(200)
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mode: 'shadow', uniquelyMatched: 1 }))
  expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('Dani')
  expect(read).toHaveBeenCalledWith(expect.objectContaining({ from: '2026-10-14T08:00:00.000Z', to: '2026-10-15T08:00:00.000Z' }))
})

it('does not call WodBuster without the admin secret', async () => {
  const read = vi.fn()
  const res = response()
  await createWodBusterTrialShadowHandler({ env, read })({ method: 'POST', headers: {} }, res)
  expect(res.status).toHaveBeenCalledWith(401)
  expect(read).not.toHaveBeenCalled()
})

it('fails closed when either source cannot be read', async () => {
  const read = vi.fn().mockResolvedValue({ ok: false, error: 'timeout' })
  const res = response()
  await createWodBusterTrialShadowHandler({ env, read, now: () => Date.parse('2026-10-14T08:00:00Z') })({ method: 'POST', headers: { 'x-evo-admin-secret': 'test-secret' } }, res)
  expect(res.status).toHaveBeenCalledWith(502)
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'wodbuster_trial_shadow_source_unavailable' }))
})
