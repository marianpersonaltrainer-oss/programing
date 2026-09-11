import { describe, expect, it, vi } from 'vitest'
import { probeWodBuster } from './wodBusterReadProbe.js'

const options = { env: { WODBUSTER_API_USER: 'fictional-user', WODBUSTER_API_PASSWORD: 'fictional-secret', WODBUSTER_BOX: 'evolution' }, from: '2026-09-10T00:00:00Z', to: '2026-09-11T00:00:00Z' }
describe('WodBuster minimal read probe', () => {
  it('returns schema and count, never row contents', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [{ Nombre: 'Fictional Person', Clases: 3 }] })
    const result = await probeWodBuster({ ...options, fetchImpl })
    expect(result).toEqual({ ok: true, status: 200, records: 1, fields: ['Nombre', 'Clases'] })
    const [url, request] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://evolution.wodbuster.com/api/box/CuantoEntrenan')
    expect(request.redirect).toBe('error')
    expect(request.method).toBe('POST')
    expect(JSON.stringify(result)).not.toContain('fictional-secret')
    expect(JSON.stringify(result)).not.toContain('Fictional Person')
  })
  it.each([
    [{ env: {} }, 'missing_configuration'],
    [{ env: { ...options.env, WODBUSTER_BOX: 'elsewhere' } }, 'unexpected_box'],
    [{ to: '2026-09-12T00:00:00Z' }, 'invalid_window'],
    [{ from: 'bad-date' }, 'invalid_window'],
  ])('fails closed before network access', async (overrides, error) => {
    const fetchImpl = vi.fn()
    expect(await probeWodBuster({ ...options, ...overrides, fetchImpl })).toEqual({ ok: false, error })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('does not expose upstream errors or response bodies', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('fictional-secret'))
    expect(await probeWodBuster({ ...options, fetchImpl })).toEqual({ ok: false, error: 'request_failed', reason: 'network_or_redirect' })
  })
  it('does not interpret a non-array as a successful report', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ error: 'Private upstream message' }) })
    expect(await probeWodBuster({ ...options, fetchImpl })).toEqual({ ok: false, status: 200, error: 'unexpected_response_shape' })
  })
})
