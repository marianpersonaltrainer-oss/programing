import { describe, expect, it, vi } from 'vitest'
import { createHeadCoachWorkerAnswerHandler } from './head-coach-worker-answer.js'

function response() {
  return {
    statusCode: null, body: null,
    setHeader: vi.fn(),
    status: vi.fn(function status(code) { this.statusCode = code; return this }),
    json: vi.fn(function json(body) { this.body = body; return this }),
  }
}

describe('POST /api/head-coach-worker-answer', () => {
  it('rechaza una respuesta sin el secreto del worker', async () => {
    const answer = vi.fn()
    const handler = createHeadCoachWorkerAnswerHandler({
      authorizeImpl: () => false,
      broker: { answer },
      requestIdImpl: () => 'request-one',
    })
    const res = response()
    await handler({ method: 'POST', headers: {}, body: {} }, res)
    expect(res.statusCode).toBe(401)
    expect(answer).not.toHaveBeenCalled()
  })

  it('acepta solo el ticket y la respuesta del worker autorizado', async () => {
    const answer = vi.fn().mockResolvedValue({ ticket: 'private-ticket', status: 'answered' })
    const handler = createHeadCoachWorkerAnswerHandler({
      authorizeImpl: () => true,
      broker: { answer },
      requestIdImpl: () => 'request-two',
    })
    const res = response()
    const body = { ticket: '11111111-1111-4111-8111-111111111111', response: 'Explica el objetivo.' }
    await handler({ method: 'POST', headers: {}, body }, res)
    expect(res.statusCode).toBe(200)
    expect(answer).toHaveBeenCalledWith(body)
  })
})
