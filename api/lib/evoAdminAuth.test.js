import { describe, expect, it, vi } from 'vitest'
import {
  adminSecretsMatch,
  checkAdminRateLimit,
  getClientIp,
} from './evoAdminAuth.js'

describe('evoAdminAuth', () => {
  it('compara secretos sin aceptar valores vacíos', () => {
    expect(adminSecretsMatch('correcta', 'correcta')).toBe(true)
    expect(adminSecretsMatch('incorrecta', 'correcta')).toBe(false)
    expect(adminSecretsMatch('', '')).toBe(false)
  })

  it('normaliza la primera IP reenviada', () => {
    expect(
      getClientIp({
        headers: { 'x-forwarded-for': '::ffff:203.0.113.8, 10.0.0.1' },
      }),
    ).toBe('203.0.113.8')
  })

  it('consulta el bucket servidor y propaga su indisponibilidad', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: true, error: null })
    await expect(
      checkAdminRateLimit({ rpc }, { headers: {} }, { endpoint: '/api/test' }),
    ).resolves.toBe(true)
    expect(rpc).toHaveBeenCalledWith(
      'check_rate_limit',
      expect.objectContaining({ p_endpoint: '/api/test' }),
    )

    rpc.mockResolvedValueOnce({ data: null, error: { message: 'offline' } })
    await expect(
      checkAdminRateLimit({ rpc }, { headers: {} }, { endpoint: '/api/test' }),
    ).rejects.toThrow('rate_limit_unavailable')
  })
})
