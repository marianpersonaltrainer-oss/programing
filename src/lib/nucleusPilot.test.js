import { describe, expect, it, vi } from 'vitest'
import {
  isNucleusPilotVisible,
  runNucleusPilotEvent,
} from './nucleusPilot.js'

describe('Nucleus pilot client', () => {
  it('solo es visible con flag y query param explícitos', () => {
    expect(isNucleusPilotVisible({ enabled: 'true', search: '?nucleusPilot=1' })).toBe(true)
    expect(isNucleusPilotVisible({ enabled: 'false', search: '?nucleusPilot=1' })).toBe(false)
    expect(isNucleusPilotVisible({ enabled: 'true', search: '' })).toBe(false)
  })

  it('usa la sesión individual y nunca envía service_role o secretos compartidos', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true, created: true }),
    })

    await runNucleusPilotEvent({
      idempotencyKey: 'pilot-key-0001',
      occurredAt: '2026-08-13T15:30:00.000Z',
    }, {
      getSessionImpl: vi.fn().mockResolvedValue({ access_token: 'user-jwt' }),
      fetchImpl,
    })

    expect(fetchImpl).toHaveBeenCalledWith('/api/nucleus-pilot-event', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer user-jwt',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idempotencyKey: 'pilot-key-0001',
        occurredAt: '2026-08-13T15:30:00.000Z',
      }),
    })
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toContain('service-role')
  })

  it('falla antes del fetch sin una sesión válida', async () => {
    const fetchImpl = vi.fn()
    await expect(runNucleusPilotEvent({
      idempotencyKey: 'pilot-key-0001',
      occurredAt: '2026-08-13T15:30:00.000Z',
    }, {
      getSessionImpl: vi.fn().mockResolvedValue(null),
      fetchImpl,
    })).rejects.toThrow('authentication_required')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
