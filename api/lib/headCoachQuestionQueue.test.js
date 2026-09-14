import { describe, expect, it, vi } from 'vitest'
import {
  createHeadCoachQueueDispatcher,
  HeadCoachQuestionQueueError,
} from './headCoachQuestionQueue.js'

const payload = {
  authorization: {
    organizationId: 'org-one',
    user: { id: 'coach-one' },
  },
  envelope: {
    question: 'Como explico el bloque A?',
    classContext: { dayName: 'Lunes', classLabel: 'EvoFuncional', sessionText: 'A) Fuerza' },
    permissions: { excludes: ['personas'] },
  },
}

function harness() {
  const single = vi.fn().mockResolvedValue({
    data: { id: 'ticket-one', status: 'queued', expires_at: '2026-09-15T10:00:00.000Z' },
    error: null,
  })
  const query = { insert: vi.fn(), select: vi.fn(), single }
  query.insert.mockReturnValue(query)
  query.select.mockReturnValue(query)
  const client = { from: vi.fn(() => query) }
  const createClientImpl = vi.fn(() => client)
  return {
    dispatch: createHeadCoachQueueDispatcher({
      env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-role' },
      createClientImpl,
    }),
    query,
    client,
  }
}

describe('Head Coach private queue', () => {
  it('guarda solo el contexto de clase validado y devuelve un ticket', async () => {
    const unit = harness()

    await expect(unit.dispatch(payload)).resolves.toEqual({
      ticket: 'ticket-one', status: 'queued', expiresAt: '2026-09-15T10:00:00.000Z',
    })
    expect(unit.client.from).toHaveBeenCalledWith('head_coach_questions')
    expect(unit.query.insert).toHaveBeenCalledWith({
      organization_id: 'org-one',
      requester_user_id: 'coach-one',
      class_context: payload.envelope.classContext,
      question: payload.envelope.question,
    })
    expect(unit.query.insert.mock.calls[0][0]).not.toHaveProperty('permissions')
  })

  it('falla cerrado cuando faltan las claves solo de servidor', async () => {
    const dispatch = createHeadCoachQueueDispatcher({ env: {} })
    await expect(dispatch(payload)).rejects.toEqual(
      expect.objectContaining({ code: 'queue_not_configured' }),
    )
  })

  it('no acepta una respuesta de escritura ambigua', async () => {
    const unit = harness()
    unit.query.single.mockResolvedValue({ data: { id: 'ticket-one', status: 'answered' }, error: null })
    await expect(unit.dispatch(payload)).rejects.toBeInstanceOf(HeadCoachQuestionQueueError)
  })
})
