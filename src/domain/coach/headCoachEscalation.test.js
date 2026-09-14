import { describe, expect, it } from 'vitest'
import {
  createHeadCoachEscalation,
  HeadCoachEscalationError,
} from './headCoachEscalation.js'

const base = {
  classContext: { dayName: 'Jueves', classLabel: 'EvoFuncional' },
  summary: 'El montaje de estaciones impidió mantener el ritmo previsto.',
}

describe('Head Coach escalation contract', () => {
  it('prepara un patrón de programación para el agente programador, sin envío', () => {
    expect(createHeadCoachEscalation({ ...base, destination: 'programmer_review' })).toEqual(expect.objectContaining({
      destination: 'programmer_review',
      intent: 'revisar_patron_de_programacion',
      notifyImmediately: false,
      requiresHumanReview: true,
      delivery: 'not_configured',
    }))
  })

  it('identifica una incidencia operativa destinada a Sara, sin enviarla', () => {
    expect(createHeadCoachEscalation({
      ...base,
      destination: 'sara_incident',
      summary: 'Faltó material esencial para montar la clase publicada.',
    })).toEqual(expect.objectContaining({
      intent: 'revisar_incidencia_operativa',
      notifyImmediately: true,
      delivery: 'not_configured',
    }))
  })

  it('rechaza personas y salud antes de crear una escalada', () => {
    expect(() => createHeadCoachEscalation({
      ...base,
      destination: 'head_coach_library',
      summary: 'La alumna tuvo dolor de rodilla.',
    })).toThrow(new HeadCoachEscalationError('personal_context_not_allowed'))
  })

  it('no permite destinos inventados', () => {
    expect(() => createHeadCoachEscalation({ ...base, destination: 'whatsapp' }))
      .toThrow(new HeadCoachEscalationError('destination_not_allowed'))
  })
})
