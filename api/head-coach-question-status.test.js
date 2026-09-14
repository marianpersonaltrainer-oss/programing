import { describe, expect, it, vi } from 'vitest'
import { createHeadCoachQuestionStatusHandler } from './head-coach-question-status.js'

function response() {
  return {
    statusCode: null, body: null,
    setHeader: vi.fn(),
    status: vi.fn(function status(code) { this.statusCode = code; return this }),
    json: vi.fn(function json(body) { this.body = body; return this }),
  }
}

function request(ticket) {
  return {
    method: 'GET',
    headers: { origin: 'https://programing-evo.vercel.app' },
    query: { ticket },
  }
}

describe('GET /api/head-coach-question-status', () => {
  it('resuelve el estado solo dentro de la identidad del entrenador', async () => {
    const status = vi.fn().mockResolvedValue({ ticket: 'private-ticket', status: 'answered', response: 'Respuesta' })
    const handler = createHeadCoachQuestionStatusHandler({
      requireCapabilityImpl: vi.fn().mockResolvedValue({ organizationId: 'org-one', user: { id: 'coach-one' } }),
      broker: { status },
      requestIdImpl: () => 'request-one',
    })
    const res = response()
    await handler(request('11111111-1111-4111-8111-111111111111'), res)
    expect(res.statusCode).toBe(200)
    expect(status).toHaveBeenCalledWith({
      ticket: '11111111-1111-4111-8111-111111111111',
      organizationId: 'org-one', requesterUserId: 'coach-one',
    })
  })

  it('no consulta nada si la identidad no tiene la capability', async () => {
    const status = vi.fn()
    const handler = createHeadCoachQuestionStatusHandler({
      requireCapabilityImpl: vi.fn().mockRejectedValue({ code: 'capability_denied', status: 403 }),
      broker: { status },
      requestIdImpl: () => 'request-two',
    })
    const res = response()
    await handler(request('11111111-1111-4111-8111-111111111111'), res)
    expect(res.statusCode).toBe(503)
    expect(status).not.toHaveBeenCalled()
  })
})
