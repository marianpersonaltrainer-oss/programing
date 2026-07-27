import { describe, expect, it } from 'vitest'
import {
  editorOpenTargetMatchesWeekState,
  publishedWeekMatchesExactTarget,
  resolveEditorOpenTarget,
  resolvePendingEditorOpen,
} from './weekEditorOpenTarget.js'

const current = {
  mesocycle: 'fuerza',
  week: 5,
  phase: null,
  cycleId: 'fuerza:2026-06-29',
  cycleStartDate: '2026-06-29',
}

describe('apertura exacta de semanas en el editor', () => {
  it('distingue una S5 antigua de la S5 del ciclo actual', () => {
    const oldCycle = resolveEditorOpenTarget({
      data: {
        mesociclo: 'fuerza',
        semana: 5,
        cycle_start_date: '2026-04-27',
      },
    })
    expect(editorOpenTargetMatchesWeekState(oldCycle, current)).toBe(false)
  })

  it('deriva el ciclo desde la fecha de semana y aplica solo tras el cambio exacto', () => {
    const target = resolveEditorOpenTarget({
      data: {
        mesociclo: 'fuerza',
        semana: 3,
        week_start_date: '2026-07-13',
      },
    })
    const pending = { target, sourceData: { titulo: 'S3' } }

    expect(target).toMatchObject({
      cycleId: 'fuerza:2026-06-29',
      cycleStartDate: '2026-06-29',
      weekStartDate: '2026-07-13',
    })
    expect(resolvePendingEditorOpen(pending, current).action).toBe('discard')
    expect(
      resolvePendingEditorOpen(pending, {
        ...current,
        week: 3,
      }),
    ).toEqual({ action: 'apply', payload: pending })
  })

  it('solo permite overlay publicado del mismo ciclo y fecha exactos', () => {
    const exactTarget = {
      mesocycle: 'fuerza',
      week: 5,
      cycleId: 'fuerza:2026-06-29',
      cycleStartDate: '2026-06-29',
    }
    const exactRow = {
      mesociclo: 'fuerza',
      semana: 5,
      cycle_id: 'fuerza:2026-06-29',
      cycle_start_date: '2026-06-29',
      data: { titulo: 'S5 exacta' },
    }

    expect(publishedWeekMatchesExactTarget(exactRow, exactTarget)).toBe(true)
    expect(
      publishedWeekMatchesExactTarget(
        {
          ...exactRow,
          cycle_id: 'fuerza:2026-04-27',
          cycle_start_date: '2026-04-27',
        },
        exactTarget,
      ),
    ).toBe(false)
    expect(
      publishedWeekMatchesExactTarget(
        {
          mesociclo: 'fuerza',
          semana: 5,
          data: { titulo: 'legacy sin ciclo' },
        },
        exactTarget,
      ),
    ).toBe(false)
  })
})
