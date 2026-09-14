import { describe, expect, it, vi } from 'vitest'
import { createHeadCoachWorkerFailHandler } from './head-coach-worker-fail.js'

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
}

describe('POST /api/head-coach-worker-fail', () => {
  it('requires the private worker secret', async () => {
    const fail = vi.fn()
    const handler = createHeadCoachWorkerFailHandler({ authorizeImpl: () => false, broker: { fail } })
    const res = response()
    await handler({ method: 'POST', headers: {} }, res)
    expect(res.statusCode).toBe(401)
    expect(fail).not.toHaveBeenCalled()
  })

  it('stores only the worker-safe failure code for an authorized worker', async () => {
    const fail = vi.fn().mockResolvedValue({ ticket: 'private-ticket', status: 'failed', errorCode: 'personal_context_rejected' })
    const handler = createHeadCoachWorkerFailHandler({
      authorizeImpl: () => true,
      broker: { fail },
      requestIdImpl: () => 'request-one',
    })
    const res = response()
    await handler({ method: 'POST', body: { ticket: 'private-ticket', errorCode: 'personal_context_rejected' } }, res)
    expect(fail).toHaveBeenCalledWith({ ticket: 'private-ticket', errorCode: 'personal_context_rejected' })
    expect(res.body).toEqual(expect.objectContaining({ ok: true, requestId: 'request-one' }))
  })
})
