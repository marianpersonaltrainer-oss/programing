import { describe, expect, it } from 'vitest'
import {
  buildEvoAiContextPrompt,
  getWeekEvoAiContext,
  mergeWeekEvoAiContext,
  normalizeEvoAiContext,
} from './evoAiContext.js'

describe('EVO AI context contract', () => {
  it('uses the weekly brief as initial objective without overwriting an explicit context', () => {
    expect(getWeekEvoAiContext({ proposal: 'Consolidar fuerza', data: {} }).objective)
      .toBe('Consolidar fuerza')

    expect(getWeekEvoAiContext({
      proposal: 'Consolidar fuerza',
      data: { ai_context: { objective: 'Priorizar técnica' } },
    }).objective).toBe('Priorizar técnica')
  })

  it('preserves unrelated draft data while saving the AI context', () => {
    expect(mergeWeekEvoAiContext(
      { proposal: 'Semana de fuerza', data: { imported_from: 'excel' } },
      { constraints: 'Sin barra el viernes' },
    )).toEqual({
      imported_from: 'excel',
      ai_context: {
        objective: 'Semana de fuerza',
        approvedRules: '',
        constraints: 'Sin barra el viernes',
        language: '',
        references: '',
      },
    })
  })

  it('builds a clear instruction block and omits empty sections', () => {
    const prompt = buildEvoAiContextPrompt({
      objective: 'Progresar clean',
      approvedRules: 'No usar landmine en WOD.',
    })

    expect(prompt).toContain('Objetivo y foco de esta semana')
    expect(prompt).toContain('Progresar clean')
    expect(prompt).toContain('No usar landmine en WOD.')
    expect(prompt).not.toContain('Material, calendario o restricciones reales')
  })
})
