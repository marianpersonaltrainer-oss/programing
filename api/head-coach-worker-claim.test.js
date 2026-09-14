import { describe, expect, it, vi } from 'vitest'
import { createHeadCoachWorkerClaimHandler } from './head-coach-worker-claim.js'

function response() {
  return {
    statusCode: null, body: null,
    setHeader: vi.fn(),
    status: vi.fn(function status(code) { this.statusCode = code; return this }),
    json: vi.fn(function json(body) { this.body = body; return this }),
  }
}

describe('POST /api/head-coach-worker-claim', () => {
  it('no revela la cola sin el secreto del worker', async () => {
    const claim = vi.fn()
    const handler = createHeadCoachWorkerClaimHandler({
      authorizeImpl: () => false,
      broker: { claim },
      requestIdImpl: () => 'request-one',
    })
    const res = response()
    await handler({ method: 'POST', headers: {} }, res)
    expect(res.statusCode).toBe(401)
    expect(claim).not.toHaveBeenCalled()
  })

  it('entrega una unica pregunta al worker autorizado', async () => {
    const handler = createHeadCoachWorkerClaimHandler({
      authorizeImpl: () => true,
      broker: { claim: vi.fn().mockResolvedValue({ ticket: 'private-ticket' }) },
      requestIdImpl: () => 'request-two',
    })
    const res = response()
    await handler({ method: 'POST', headers: {} }, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, question: { ticket: 'private-ticket' }, requestId: 'request-two' })
  })
})
