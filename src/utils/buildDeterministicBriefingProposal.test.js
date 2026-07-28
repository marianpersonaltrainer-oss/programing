import { describe, expect, it } from 'vitest'
import { buildDeterministicBriefingProposal } from './buildDeterministicBriefingProposal.js'

describe('buildDeterministicBriefingProposal', () => {
  it('genera arquitectura válida para días y clases seleccionados', () => {
    const proposal = buildDeterministicBriefingProposal({
      mesociclo: 'FUERZA',
      semana: 6,
      generationDays: ['LUNES', 'MIÉRCOLES'],
      weeklyOffer: {
        dias: {
          LUNES: ['evofuncional', 'evofuerza'],
          MIÉRCOLES: ['evofit'],
        },
      },
      userInstructions: 'Más bisagra esta semana.',
      suggestedFocus: 'Consolidación',
    })
    expect(proposal.title).toMatch(/PROPUESTA MANUAL/)
    expect(proposal.weeklyArchitecture).toHaveLength(2)
    expect(proposal.weeklyArchitecture[0].day).toBe('LUNES')
  })
})
