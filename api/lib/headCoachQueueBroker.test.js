import { describe, expect, it, vi } from 'vitest'
import { createHeadCoachQueueBroker, HeadCoachQueueBrokerError } from './headCoachQueueBroker.js'

const ticket = '11111111-1111-4111-8111-111111111111'

function harness() {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { id: ticket, status: 'answered', answered_at: '2026-09-14T12:00:00.000Z' },
    error: null,
  })
  const query = { update: vi.fn(), eq: vi.fn(), gt: vi.fn(), select: vi.fn(), maybeSingle }
  query.update.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.gt.mockReturnValue(query)
  query.select.mockReturnValue(query)
  const client = {
    rpc: vi.fn().mockResolvedValue({
      data: [{
        id: ticket,
        question: 'Como explico el bloque A?',
        class_context: { classLabel: 'EvoFuncional' },
        created_at: '2026-09-14T10:00:00.000Z',
        expires_at: '2026-09-15T10:00:00.000Z',
      }],
      error: null,
    }),
    from: vi.fn(() => query),
  }
  const broker = createHeadCoachQueueBroker({
    env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-role' },
    createClientImpl: vi.fn(() => client),
    now: () => new Date('2026-09-14T12:00:00.000Z'),
  })
  return { broker, client, query, maybeSingle }
}

describe('Head Coach queue broker', () => {
  it('reclama solo una pregunta privada mediante la funcion atomica', async () => {
    const unit = harness()
    await expect(unit.broker.claim()).resolves.toEqual({
      ticket,
      question: 'Como explico el bloque A?',
      classContext: { classLabel: 'EvoFuncional' },
      createdAt: '2026-09-14T10:00:00.000Z',
      expiresAt: '2026-09-15T10:00:00.000Z',
    })
    expect(unit.client.rpc).toHaveBeenCalledWith('claim_head_coach_question')
  })

  it('solo acepta una respuesta para una pregunta ya reclamada y no expirada', async () => {
    const unit = harness()
    await expect(unit.broker.answer({ ticket, response: 'Explica primero el objetivo.' })).resolves.toEqual({
      ticket, status: 'answered', answeredAt: '2026-09-14T12:00:00.000Z',
    })
    expect(unit.query.eq).toHaveBeenCalledWith('status', 'processing')
    expect(unit.query.gt).toHaveBeenCalledWith('expires_at', '2026-09-14T12:00:00.000Z')
  })

  it('cierra de forma segura una pregunta reclamada que el worker rechaza', async () => {
    const unit = harness()
    unit.query.maybeSingle.mockResolvedValue({ data: {
      id: '11111111-1111-4111-8111-111111111111',
      status: 'failed',
      error_code: 'personal_context_rejected',
    }, error: null })

    await expect(unit.broker.fail({
      ticket: '11111111-1111-4111-8111-111111111111',
      errorCode: 'personal_context_rejected',
    })).resolves.toEqual({
      ticket: '11111111-1111-4111-8111-111111111111',
      status: 'failed',
      errorCode: 'personal_context_rejected',
    })
    expect(unit.query.update).toHaveBeenCalledWith({ status: 'failed', error_code: 'personal_context_rejected' })
  })

  it('rejects an unsafe worker failure code before querying Supabase', async () => {
    const unit = harness()
    await expect(unit.broker.fail({
      ticket: '11111111-1111-4111-8111-111111111111',
      errorCode: 'includes personal details',
    })).rejects.toMatchObject({ code: 'invalid_failure' })
    expect(unit.client.from).not.toHaveBeenCalled()
  })

  it('rechaza tickets o respuestas que no cumplen el contrato', async () => {
    const unit = harness()
    await expect(unit.broker.answer({ ticket: 'no-es-un-ticket', response: 'hola' }))
      .rejects.toBeInstanceOf(HeadCoachQueueBrokerError)
    await expect(unit.broker.answer({ ticket, response: 'x'.repeat(6001) }))
      .rejects.toBeInstanceOf(HeadCoachQueueBrokerError)
  })
})
