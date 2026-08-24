import { describe, expect, it } from 'vitest'
import { projectLegacyWeekForStructuredImport } from './legacyWeekImportProjection.js'

describe('legacy week import projection', () => {
  it('only prepares programmed sessions and preserves their coaching feedback', () => {
    const projection = projectLegacyWeekForStructuredImport({
      titulo: 'S5 · Fuerza',
      dias: [
        {
          nombre: 'Lunes',
          evofuncional: 'A) Sentadilla\\nB) Remo',
          feedback_funcional: 'Vigila el ritmo.',
          evobasics: '(no programada esta semana)',
        },
      ],
    })

    expect(projection.sourceTitle).toBe('S5 · Fuerza')
    expect(projection.summary).toEqual({ totalSessions: 1, daysRecognized: 1, feedbackIncluded: 1 })
    expect(projection.sessions[0]).toMatchObject({
      weekday: 1,
      dayName: 'Lunes',
      classType: 'EvoFuncional',
      programming: 'A) Sentadilla\\nB) Remo',
      feedback: 'Vigila el ritmo.',
    })
    expect(projection.skipped).toContainEqual({
      dayName: 'Lunes',
      classType: 'EvoBasics',
      reason: 'not_programmed',
    })
  })
})
