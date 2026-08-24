import { describe, expect, it, vi } from 'vitest'
import { EvoCapabilityAuthError } from './lib/evoCapabilityAuth.js'
import { NucleusEventRecorderError } from './lib/nucleusEventRecorder.js'
import { createNucleusPilotEventHandler } from './nucleus-pilot-event.js'

function request(body = {}) {
  return {
    method: 'POST',
    headers: {
      authorization: 'Bearer valid-token',
      origin: 'http://localhost:5173',
      'x-forwarded-for': '127.0.0.1',
    },
    body: {
      idempotencyKey: 'pilot-2026-08-13-001',
      occurredAt: '2026-08-13T15:30:00.000Z',
      ...body,
    },
  }
}

function response() {
  return {
    statusCode: null,
    body: null,
    status: vi.fn(function status(code) {
      this.statusCode = code
      return this
    }),
    json: vi.fn(function json(body) {
      this.body = body
      return this
    }),
  }
}

function handler(options = {}) {
  const recordEventImpl = options.recordEventImpl || vi.fn().mockResolvedValue({
    created: true,
    event: {
      event_id: '018f1f4d-7b6c-8d8e-9f10-111213141520',
      event_type: 'nucleus.pilot.recorded',
    },
  })
  const requireCapabilityImpl = options.requireCapabilityImpl || vi.fn().mockResolvedValue({
    user: { id: 'user-one' },
    organizationId: '018f1f4d-7b6c-7d8e-9f10-111213141517',
    capability: 'programming.manage',
  })
  const checkRateLimitImpl = options.checkRateLimitImpl || vi.fn().mockResolvedValue(false)
  const createClientImpl = vi.fn(() => ({ kind: 'service-client' }))
  const logger = { info: vi.fn(), warn: vi.fn() }

  return {
    handler: createNucleusPilotEventHandler({
      createClientImpl,
      requireCapabilityImpl,
      checkRateLimitImpl,
      recordEventImpl,
      readConfigImpl: options.readConfigImpl || (() => ({
        enabled: true,
        serviceKey: 'service-role',
        supabaseUrl: 'https://staging.supabase.test',
      })),
      nowImpl: () => new Date('2026-08-13T15:30:01.000Z'),
      requestIdImpl: () => 'request-one',
      logger,
    }),
    recordEventImpl,
    requireCapabilityImpl,
    checkRateLimitImpl,
    createClientImpl,
    logger,
  }
}

describe('POST /api/nucleus-pilot-event', () => {
  it('registra el piloto con organización resuelta por capability', async () => {
    const unit = handler()
    const res = response()

    await unit.handler(request(), res)

    expect(res.statusCode).toBe(201)
    expect(res.body).toEqual({
      ok: true,
      created: true,
      eventId: '018f1f4d-7b6c-8d8e-9f10-111213141520',
      eventType: 'nucleus.pilot.recorded',
      requestId: 'request-one',
    })
    expect(unit.requireCapabilityImpl).toHaveBeenCalledWith(
      expect.anything(),
      'programming.manage',
    )
    expect(unit.recordEventImpl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organization_id: '018f1f4d-7b6c-7d8e-9f10-111213141517',
        event_type: 'nucleus.pilot.recorded',
        payload: { pilot: true, contract_version: 1 },
        idempotency_key: 'nucleus-pilot:pilot-2026-08-13-001',
      }),
    )
    expect(unit.createClientImpl).toHaveBeenCalledWith(
      'https://staging.supabase.test',
      'service-role',
      expect.objectContaining({ auth: expect.any(Object) }),
    )
  })

  it('devuelve 200 al repetir el mismo evento', async () => {
    const unit = handler({
      recordEventImpl: vi.fn().mockResolvedValue({
        created: false,
        event: {
          event_id: '018f1f4d-7b6c-8d8e-9f10-111213141520',
          event_type: 'nucleus.pilot.recorded',
        },
      }),
    })
    const res = response()

    await unit.handler(request(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ ok: true, created: false })
  })

  it('oculta la ruta cuando la feature flag está apagada', async () => {
    const unit = handler({
      readConfigImpl: () => ({ enabled: false, serviceKey: '', supabaseUrl: '' }),
    })
    const res = response()

    await unit.handler(request(), res)

    expect(res.statusCode).toBe(404)
    expect(res.body.error).toBe('nucleus_pilot_disabled')
    expect(unit.requireCapabilityImpl).not.toHaveBeenCalled()
  })

  it('exige programming.manage y no acepta organización desde el body', async () => {
    const requireCapabilityImpl = vi.fn().mockRejectedValue(
      new EvoCapabilityAuthError('capability_denied', 403),
    )
    const unit = handler({ requireCapabilityImpl })
    const res = response()

    await unit.handler(request({ organizationId: 'attacker-org' }), res)

    expect(res.statusCode).toBe(403)
    expect(res.body.error).toBe('capability_denied')
    expect(unit.recordEventImpl).not.toHaveBeenCalled()
  })

  it('rechaza origen, JSON e idempotencia inválidos antes de escribir', async () => {
    const unit = handler()
    const badOrigin = response()
    const badJson = response()
    const badKey = response()

    await unit.handler({ ...request(), headers: { origin: 'https://invalid.example' } }, badOrigin)
    await unit.handler({ ...request(), body: '{' }, badJson)
    await unit.handler(request({ idempotencyKey: 'short' }), badKey)

    expect(badOrigin.statusCode).toBe(403)
    expect(badJson.statusCode).toBe(400)
    expect(badKey.statusCode).toBe(400)
    expect(unit.recordEventImpl).not.toHaveBeenCalled()
  })

  it('falla cerrado si el rate limit o el almacén no están disponibles', async () => {
    const rateLimited = handler({
      checkRateLimitImpl: vi.fn().mockRejectedValue(new Error('db detail')),
    })
    const storeFailed = handler({
      recordEventImpl: vi.fn().mockRejectedValue(
        new NucleusEventRecorderError('nucleus_event_write_unavailable', 503),
      ),
    })
    const rateRes = response()
    const storeRes = response()

    await rateLimited.handler(request(), rateRes)
    await storeFailed.handler(request(), storeRes)

    expect(rateRes.statusCode).toBe(503)
    expect(rateRes.body).toEqual({
      error: 'rate_limit_unavailable',
      requestId: 'request-one',
    })
    expect(storeRes.statusCode).toBe(503)
    expect(storeRes.body).toEqual({
      error: 'nucleus_event_write_unavailable',
      requestId: 'request-one',
    })
  })
})
