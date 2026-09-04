import { describe, expect, it } from 'vitest'
import { buildTrialCloseSummary } from './trialCloseSummary.js'

describe('buildTrialCloseSummary', () => {
  it('pide los datos mínimos para preparar una propuesta', () => {
    expect(buildTrialCloseSummary({ personReference: 'Alex' })).toEqual({
      ok: false,
      missing: [
        'asistencia',
        'punto de entrada',
        'prioridad',
        'motivo',
      ],
      summary: null,
    })
  })

  it('genera un cierre breve sin inventar adaptaciones', () => {
    const result = buildTrialCloseSummary({
      personReference: 'Alex',
      attendance: 'vino',
      entryPoint: 'EVO Basics',
      priority: 'Retomar y crear constancia',
      adaptations: 'ninguna',
      reason: 'Lleva tiempo sin entrenar y quiere volver a sentirse con energía.',
    })

    expect(result.ok).toBe(true)
    expect(result.nextStage).toBe('📄 Propuesta preparada')
    expect(result.summary).toContain('1. Asistencia: vino')
    expect(result.summary).toContain('2. Punto de entrada recomendado: EVO Basics')
    expect(result.summary).toContain('4. Adaptaciones relevantes: ninguna')
    expect(result.summary).not.toContain('Frecuencia sugerida')
  })
})
