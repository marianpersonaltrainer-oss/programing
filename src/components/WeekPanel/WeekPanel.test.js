import { describe, expect, it } from 'vitest'
import { resolveWeekPanelFormValues } from './WeekPanel.jsx'

describe('WeekPanel form sync', () => {
  it('proyecta el objetivo externo completo, incluido el ciclo', () => {
    expect(
      resolveWeekPanelFormValues({
        mesocycle: 'autocarga',
        week: 4,
        phase: 'Control',
        cycleStartDate: '2026-07-06',
      }),
    ).toEqual({
      mesocycle: 'autocarga',
      week: 4,
      phase: 'Control',
      cycleStartDate: '2026-07-06',
    })
  })
})
