import { describe, expect, it } from 'vitest'
import { buildTrialCloseSummary } from './trialCloseSummary.js'

describe('buildTrialCloseSummary', () => {
  it('pide los datos mínimos para preparar una propuesta', () => {
    expect(buildTrialCloseSummary({ personReference: 'Alex' })).toEqual({
      ok: false,
      missing: ['punto de entrada', 'frecuencia', 'prioridad', 'motivo'],
      summary: null,
    })
  })

  it('genera un cierre breve sin inventar adaptaciones', () => {
    const result = buildTrialCloseSummary({
      personReference: 'Alex',
      entryPoint: 'EVO Basics',
      frequency: '2 días',
      priority: 'Retomar y crear constancia',
      reason: 'Lleva tiempo sin entrenar y quiere volver a sentirse con energía.',
    })

    expect(result.ok).toBe(true)
    expect(result.nextStage).toBe('📄 Propuesta preparada')
    expect(result.summary).toContain('Punto de entrada recomendado: EVO Basics')
    expect(result.summary).not.toContain('Adaptaciones relevantes:')
  })
})
