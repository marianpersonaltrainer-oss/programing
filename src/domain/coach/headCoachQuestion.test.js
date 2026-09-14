import { describe, expect, it } from 'vitest'
import { createHeadCoachQuestion, HeadCoachQuestionError } from './headCoachQuestion.js'

const context = {
  dayName: 'Lunes',
  classLabel: 'EvoFuncional',
  sessionText: 'A) Fuerza\n6 Goblet Squats',
  sessionFeedbackText: 'Rango y técnica antes que carga.',
}

describe('head coach question contract', () => {
  it('solo entrega contexto publicado de la clase para una respuesta', () => {
    const envelope = createHeadCoachQuestion({ question: '¿Cómo explico el bloque A?', context })
    expect(envelope).toEqual(expect.objectContaining({
      kind: 'head_coach_class_question',
      permissions: expect.objectContaining({ responseOnly: true }),
      classContext: expect.objectContaining({ dayName: 'Lunes', classLabel: 'EvoFuncional' }),
    }))
    expect(envelope.classContext.feedbackText).toBe('')
  })

  it('rechaza una duda con una persona identificable', () => {
    expect(() => createHeadCoachQuestion({ question: '¿Qué hago con cliente Lara?', context }))
      .toThrow(new HeadCoachQuestionError('personal_context_not_allowed'))
  })

  it('rechaza acciones sobre la programación', () => {
    expect(() => createHeadCoachQuestion({ question: 'Publica esta clase ahora', context }))
      .toThrow(new HeadCoachQuestionError('mutation_not_allowed'))
  })

  it('no acepta datos de salud ni aunque no identifiquen a una persona', () => {
    expect(() => createHeadCoachQuestion({ question: '¿Cómo adapto para dolor lumbar?', context }))
      .toThrow(new HeadCoachQuestionError('personal_context_not_allowed'))
  })
})
