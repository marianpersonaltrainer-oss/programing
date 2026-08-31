import { describe, expect, it } from 'vitest'
import { buildStructuredCoachFeedback } from './coachFeedbackStructuredText.js'

describe('buildStructuredCoachFeedback', () => {
  it('guarda etiquetas útiles sin cambiar el esquema de feedback', () => {
    expect(
      buildStructuredCoachFeedback({
        stimulus: 'hard',
        timeExplain: 'justo',
        timeCause: 'technique',
        classNote: 'Las progresiones necesitaron calma.',
        nextFocus: 'load_scale',
        nextNote: 'Bajar una escala si se pierde la posición.',
      }),
    ).toEqual({
      groupFeelings: 'Estímulo: Demasiado duro\nTiempo: Técnica\nLas progresiones necesitaron calma.',
      notesNextWeek: 'Foco: Carga / escala\nBajar una escala si se pierde la posición.',
    })
  })

  it('no añade causa de tiempo cuando la clase fue bien de tiempo', () => {
    expect(
      buildStructuredCoachFeedback({
        stimulus: 'achieved',
        timeExplain: 'si',
        timeCause: 'setup',
      }),
    ).toEqual({ groupFeelings: 'Estímulo: Se logró', notesNextWeek: null })
  })
})
