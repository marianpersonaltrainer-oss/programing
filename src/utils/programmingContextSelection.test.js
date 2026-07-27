import { describe, expect, it } from 'vitest'
import {
  filterFeedbackForSelectedWeekIds,
  isExactEarlierProgressionWeek,
  selectProgrammingContextWeeks,
} from './programmingContextSelection.js'

function week({
  id,
  mesociclo = 'fuerza',
  semana,
  weekStart,
  cycleId = 'fuerza-2026-06-29',
  publishedAt,
  status,
}) {
  return {
    id,
    mesociclo,
    semana,
    published_at: publishedAt || `${weekStart || '2026-07-01'}T12:00:00Z`,
    status,
    data: {
      cycle_id: cycleId,
      week_start_date: weekStart,
      dias: [],
    },
  }
}

const target = {
  mesociclo: 'fuerza',
  semana: 5,
  cycle_id: 'fuerza-2026-06-29',
  week_start_date: '2026-07-27',
}

describe('programming context selection', () => {
  it('usa solo semanas estrictamente anteriores del ciclo y fecha exactos', () => {
    const rows = [
      week({ id: 's1', semana: 1, weekStart: '2026-06-29' }),
      week({ id: 's2', semana: 2, weekStart: '2026-07-06' }),
      week({ id: 's3-wrong-date', semana: 3, weekStart: '2026-07-20' }),
      week({ id: 's4-other-cycle', semana: 4, weekStart: '2026-06-02', cycleId: 'old-cycle' }),
      week({ id: 'target', semana: 5, weekStart: '2026-07-27' }),
      week({ id: 'future', semana: 6, weekStart: '2026-08-03' }),
    ]

    const selected = selectProgrammingContextWeeks(rows, target)

    expect(selected.mode).toBe('exact-cycle-date')
    expect(selected.progressionWeeks.map((row) => row.id)).toEqual(['s1', 's2'])
    expect(selected.progressionWeeks.map((row) => row.id)).not.toContain('target')
    expect(selected.historicalReferenceWeeks.map((row) => row.id)).not.toContain('s3-wrong-date')
    expect(selected.historicalReferenceWeeks.map((row) => row.id)).not.toContain('future')
  })

  it('excluye borradores aunque tengan el mesociclo, semana y fecha correctos', () => {
    const draft = week({
      id: 'draft-s4',
      semana: 4,
      weekStart: '2026-07-20',
      status: 'draft',
    })

    expect(isExactEarlierProgressionWeek(draft, target)).toBe(false)
    expect(selectProgrammingContextWeeks([draft], target).selectedWeekIds).toEqual([])
  })

  it('separa otros ciclos como referencia histórica sin llamarlos progresión', () => {
    const current = week({ id: 'current-s4', semana: 4, weekStart: '2026-07-20' })
    const old = week({
      id: 'old-s4',
      semana: 4,
      weekStart: '2026-05-18',
      cycleId: 'fuerza-2026-04-27',
      publishedAt: '2026-05-18T08:00:00Z',
    })

    const selected = selectProgrammingContextWeeks([old, current], target)

    expect(selected.progressionWeeks.map((row) => row.id)).toEqual(['current-s4'])
    expect(selected.historicalReferenceWeeks.map((row) => row.id)).toEqual(['old-s4'])
  })

  it('respeta historicalLimit 0 sin reintroducir referencias antiguas', () => {
    const old = week({
      id: 'old-s4',
      semana: 4,
      weekStart: '2026-05-18',
      cycleId: 'fuerza-2026-04-27',
      publishedAt: '2026-05-18T08:00:00Z',
    })

    const selected = selectProgrammingContextWeeks([old], target, {
      historicalLimit: 0,
    })

    expect(selected.historicalReferenceWeeks).toEqual([])
    expect(selected.selectedWeekIds).toEqual([])
  })

  it('en datos legacy sigue excluyendo la semana objetivo y las futuras', () => {
    const rows = [1, 2, 5, 6].map((semana) => ({
      id: `legacy-${semana}`,
      mesociclo: 'fuerza',
      semana,
      published_at: `2026-07-${String(semana).padStart(2, '0')}T10:00:00Z`,
      data: { dias: [] },
    }))

    const selected = selectProgrammingContextWeeks(rows, {
      mesociclo: 'fuerza',
      semana: 5,
    })

    expect(selected.mode).toBe('legacy-slot')
    expect(selected.progressionWeeks.map((row) => row.semana)).toEqual([1, 2])
    expect(selected.selectedWeekIds).toEqual(['legacy-1', 'legacy-2'])
  })

  it('no usa un cycle_id legacy para reintroducir la semana objetivo como referencia', () => {
    const legacyTarget = {
      id: 'old-active',
      mesociclo: 'fuerza',
      semana: 5,
      cycle_id: 'legacy:old-active',
      publication_status: 'published',
      published_at: '2026-05-01T10:00:00Z',
      data: { dias: [] },
    }

    const selected = selectProgrammingContextWeeks([legacyTarget], target)
    expect(selected.selectedWeekIds).toEqual([])
    expect(selected.historicalReferenceWeeks).toEqual([])
  })

  it('excluye filas legacy en cuarentena aunque tengan published_at', () => {
    const quarantined = {
      id: 'legacy-draft',
      mesociclo: 'fuerza',
      semana: 2,
      cycle_id: 'legacy:legacy-draft',
      publication_status: 'legacy_unverified',
      published_at: '2026-05-01T10:00:00Z',
      data: { dias: [] },
    }

    expect(selectProgrammingContextWeeks([quarantined], target).selectedWeekIds).toEqual([])
    expect(
      selectProgrammingContextWeeks(
        [{ ...quarantined, id: 'consumed-draft', publication_status: 'consumed' }],
        target,
      ).selectedWeekIds,
    ).toEqual([])
  })

  it('no considera anterior una referencia legacy sin fecha ante un objetivo fechado', () => {
    const undatedOtherMesocycle = {
      id: 'legacy-other-cycle',
      mesociclo: 'mixto',
      semana: 2,
      cycle_id: 'legacy:legacy-other-cycle',
      publication_status: 'published',
      published_at: '2026-05-01T10:00:00Z',
      data: { dias: [] },
    }

    expect(
      selectProgrammingContextWeeks([undatedOtherMesocycle], target).selectedWeekIds,
    ).toEqual([])
  })

  it('filtra feedback únicamente por los IDs seleccionados', () => {
    const rows = [
      { week_id: 's1', notes_next_week: 'válido' },
      { week_id: 'target', notes_next_week: 'contamina' },
      { week_id: null, mesociclo: 'fuerza', semana: 1, notes_next_week: 'fallback prohibido' },
    ]

    expect(filterFeedbackForSelectedWeekIds(rows, ['s1'])).toEqual([rows[0]])
  })
})
