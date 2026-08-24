import { describe, expect, it } from 'vitest'
import { projectImportedSessionForCoach, splitLegacyProgrammingIntoBlocks } from './legacySessionDraft.js'

describe('legacy session draft', () => {
  it('keeps the original content and exposes explicit parts as Coach blocks', () => {
    const blocks = splitLegacyProgrammingIntoBlocks('PARTE A\n5 rondas\n\nPARTE B\nCore técnico')

    expect(blocks).toEqual([
      { title: 'Parte A', rawText: '5 rondas' },
      { title: 'Parte B', rawText: 'Core técnico' },
    ])
  })

  it('does not invent blocks for a legacy session without explicit parts', () => {
    const draft = projectImportedSessionForCoach({
      sourceId: 'legacy:1:evofit',
      title: 'Lunes · EvoFit',
      classType: 'EvoFit',
      weekday: 1,
      programming: 'EMOM 12\nBike',
      feedback: 'Mantén margen.',
    })

    expect(draft.blocks).toEqual([{ title: 'Sesión', rawText: 'EMOM 12\nBike' }])
    expect(draft.feedback).toBe('Mantén margen.')
  })
})
