import { describe, expect, it, vi } from 'vitest'
import { createHeadCoachQuestionHandler } from './head-coach-question.js'
import { HeadCoachQuestionQueueError } from './lib/headCoachQuestionQueue.js'

function response() {
  return {
    statusCode: null,
    body: null,
    status: vi.fn(function status(code) { this.statusCode = code; return this }),
    json: vi.fn(function json(body) { this.body = body; return this }),
  }
}

function request(body) {
  return {
    method: 'POST',
    headers: { origin: 'https://programing-evo.vercel.app' },
    body,
  }
}

const body = {
  question: '¿Cómo explico el bloque A?',
  context: {
    dayName: 'Lunes',
    classLabel: 'EvoFuncional',
    sessionText: 'A) Fuerza',
    sessionFeedbackText: 'Rango y técnica.',
  },
}

describe('POST /api/head-coach-question', () => {
  it('no responde mediante un proveedor externo si el gateway propio no existe', async () => {
    const handler = createHeadCoachQuestionHandler({
      requireCapabilityImpl: vi.fn().mockResolvedValue({ user: { id: 'coach-1' } }),
      dispatchImpl: vi.fn().mockRejectedValue(new HeadCoachQuestionQueueError('queue_not_configured')),
      requestIdImpl: () => 'request-1',
    })
    const res = response()

    await handler(request(body), res)

    expect(res.statusCode).toBe(503)
    expect(res.body).toEqual({ error: 'head_coach_gateway_not_configured', requestId: 'request-1' })
  })

  it('no permite una persona identificable aunque el coach tenga acceso', async () => {
    const handler = createHeadCoachQuestionHandler({
      requireCapabilityImpl: vi.fn().mockResolvedValue({ user: { id: 'coach-1' } }),
      requestIdImpl: () => 'request-2',
    })
    const res = response()

    await handler(request({ ...body, question: '¿Cómo adapto para alumna Lara?' }), res)

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('personal_context_not_allowed')
  })

  it('solo entrega el sobre validado al gateway propio', async () => {
    const dispatchImpl = vi.fn().mockResolvedValue({ ticket: 'private-1' })
    const handler = createHeadCoachQuestionHandler({
      requireCapabilityImpl: vi.fn().mockResolvedValue({ user: { id: 'coach-1' } }),
      dispatchImpl,
      requestIdImpl: () => 'request-3',
    })
    const res = response()

    await handler(request(body), res)

    expect(res.statusCode).toBe(202)
    expect(dispatchImpl).toHaveBeenCalledWith(expect.objectContaining({
      envelope: expect.objectContaining({
        kind: 'head_coach_class_question',
        permissions: expect.objectContaining({ responseOnly: true }),
      }),
      authorization: expect.objectContaining({ user: { id: 'coach-1' } }),
    }))
  })
})
