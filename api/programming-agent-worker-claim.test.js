import { describe, expect, it, vi } from 'vitest'
import { createProgrammingAgentWorkerClaimHandler } from './programming-agent-worker-claim.js'

function response() {
  return {
    statusCode: null,
    body: null,
    setHeader: vi.fn(),
    status: vi.fn(function status(code) { this.statusCode = code; return this }),
    json: vi.fn(function json(body) { this.body = body; return this }),
  }
}

describe('POST /api/programming-agent-worker-claim', () => {
  it('no revela la cola a un worker no autenticado', async () => {
    const claim = vi.fn()
    const handler = createProgrammingAgentWorkerClaimHandler({
      authorizeImpl: () => false,
      broker: { claim },
      requestIdImpl: () => 'request-1',
    })
    const res = response()
    await handler({ method: 'POST', headers: {} }, res)
    expect(res.statusCode).toBe(401)
    expect(claim).not.toHaveBeenCalled()
  })

  it('entrega una sola solicitud al worker autorizado', async () => {
    const handler = createProgrammingAgentWorkerClaimHandler({
      authorizeImpl: () => true,
      broker: { claim: vi.fn().mockResolvedValue({ ticket: 'private-ticket' }) },
      requestIdImpl: () => 'request-2',
    })
    const res = response()
    await handler({ method: 'POST', headers: {} }, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, request: { ticket: 'private-ticket' }, requestId: 'request-2' })
  })
})
