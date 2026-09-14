import { describe, expect, it, vi } from 'vitest'
import {
  explainHeadCoachGatewayError,
  getHeadCoachQuestionStatus,
  isHeadCoachGatewayEnabled,
  submitHeadCoachQuestion,
} from './headCoachGateway.js'

const context = { dayName: 'Lunes', classLabel: 'EvoFuncional', sessionText: 'Bloque A' }

describe('Head Coach gateway client', () => {
  it('permanece apagado por defecto', () => {
    expect(isHeadCoachGatewayEnabled()).toBe(false)
    expect(isHeadCoachGatewayEnabled('true')).toBe(true)
  })

  it('manda solo la consulta y el contexto de clase con una identidad individual', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { ticket: 'ticket-1' } }),
    })
    await expect(submitHeadCoachQuestion({
      question: '¿Cómo explico el bloque A?',
      context,
      fetchImpl,
      getAccessTokenImpl: async () => 'coach-token',
    })).resolves.toBe('ticket-1')
    expect(fetchImpl).toHaveBeenCalledWith('/api/head-coach-question', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer coach-token' }),
      body: JSON.stringify({ question: '¿Cómo explico el bloque A?', context }),
    }))
  })

  it('no intenta enviar una consulta si falta identidad individual', async () => {
    await expect(submitHeadCoachQuestion({
      question: '¿Cómo explico el bloque A?',
      context,
      getAccessTokenImpl: async () => '',
    })).rejects.toMatchObject({ code: 'identity_required' })
  })

  it('consulta el estado con el mismo token privado', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { status: 'answered', response: 'Respuesta ficticia.' } }),
    })
    await expect(getHeadCoachQuestionStatus({
      ticket: 'ticket-1',
      fetchImpl,
      getAccessTokenImpl: async () => 'coach-token',
    })).resolves.toEqual({ status: 'answered', response: 'Respuesta ficticia.' })
  })

  it('muestra un error comprensible sin revelar el backend', () => {
    expect(explainHeadCoachGatewayError('personal_context_not_allowed'))
      .toContain('sin personas ni salud')
  })
})
