import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase.js', () => ({
  listCoachSessionFeedback: vi.fn(),
  listPublishedWeekVersionsForMesocycle: vi.fn(),
}))

import {
  buildWeekContext,
  buildWeekContextTarget,
  loadExactWeekContext,
  selectLocalProgrammingContextWeeks,
  weekContextTargetKey,
} from './buildWeekContext.js'

const targetState = {
  mesocycle: 'fuerza',
  week: 5,
  totalWeeks: 6,
  phase: 'pico controlado',
  cycleId: 'fuerza:2026-06-29',
  cycleStartDate: '2026-06-29',
}

function publishedWeek({
  id,
  week,
  weekStart,
  cycleId = 'fuerza:2026-06-29',
  cycleStart = '2026-06-29',
  status = 'published',
  note = '',
  publishedAt,
}) {
  return {
    id,
    mesociclo: 'fuerza',
    semana: week,
    publication_status: status,
    published_at:
      publishedAt || `${weekStart || '2026-06-29'}T08:00:00.000Z`,
    data: {
      mesociclo: 'fuerza',
      semana: week,
      cycle_id: cycleId,
      cycle_start_date: cycleStart,
      week_start_date: weekStart,
      titulo: `Semana ${week}`,
      resumen: { foco: note || `foco-${week}` },
      dias: [
        {
          nombre: 'Lunes',
          evofuncional: note || `sesión-${week}`,
          evofit: '',
          evobasics: '',
        },
      ],
    },
  }
}

describe('buildWeekContextTarget', () => {
  it('deriva la fecha de semana sin consultar otra semana y sella toda la identidad', () => {
    const target = buildWeekContextTarget(targetState)

    expect(target).toMatchObject({
      mesociclo: 'fuerza',
      semana: 5,
      cycle_id: 'fuerza:2026-06-29',
      cycle_start_date: '2026-06-29',
      week_start_date: '2026-07-27',
      exact: true,
    })
    expect(weekContextTargetKey(targetState)).toBe(
      'fuerza|5|fuerza:2026-06-29|2026-06-29|2026-07-27|6|pico controlado',
    )
  })

  it('cambia la huella al cambiar semana, ciclo o fase aunque el mesociclo se llame igual', () => {
    expect(
      weekContextTargetKey({ ...targetState, week: 4 }),
    ).not.toBe(weekContextTargetKey(targetState))
    expect(
      weekContextTargetKey({
        ...targetState,
        cycleId: 'fuerza:2026-09-07',
        cycleStartDate: '2026-09-07',
      }),
    ).not.toBe(weekContextTargetKey(targetState))
    expect(
      weekContextTargetKey({ ...targetState, phase: 'descarga' }),
    ).not.toBe(weekContextTargetKey(targetState))
  })

  it('falla cerrado si el id de ciclo o la fecha semanal contradicen el inicio real', () => {
    expect(
      buildWeekContextTarget({
        ...targetState,
        cycleId: 'fuerza:2026-09-07',
      }),
    ).toMatchObject({ exact: false, identity_consistent: false })
    expect(
      buildWeekContextTarget({
        ...targetState,
        weekStartDate: '2026-07-20',
      }),
    ).toMatchObject({ exact: false, identity_consistent: false })
  })
})

describe('selectLocalProgrammingContextWeeks', () => {
  it('no trata un borrador, otra edición del ciclo ni S objetivo/futura como progresión anterior', () => {
    const exactS4 = publishedWeek({
      id: 'exact-s4',
      week: 4,
      weekStart: '2026-07-20',
      status: 'superseded',
    })
    const wrongCycleS4 = publishedWeek({
      id: 'wrong-cycle-s4',
      week: 4,
      weekStart: '2026-09-28',
      cycleId: 'fuerza:2026-09-07',
      cycleStart: '2026-09-07',
    })
    const draftS3 = publishedWeek({
      id: 'draft-s3',
      week: 3,
      weekStart: '2026-07-13',
      status: 'draft',
    })
    const targetS5 = publishedWeek({
      id: 'target-s5',
      week: 5,
      weekStart: '2026-07-27',
    })
    const futureS6 = publishedWeek({
      id: 'future-s6',
      week: 6,
      weekStart: '2026-08-03',
    })
    const legacyS2 = {
      entryId: 'legacy-s2',
      semana: 2,
      savedAt: '2026-07-06T08:00:00.000Z',
      weekDataFull: { dias: [] },
    }
    const history = {
      fuerza: [
        {
          ...exactS4,
          published_week_id: exactS4.id,
          weekDataFull: exactS4.data,
        },
        {
          ...wrongCycleS4,
          published_week_id: wrongCycleS4.id,
          weekDataFull: wrongCycleS4.data,
        },
        {
          ...draftS3,
          published_week_id: draftS3.id,
          weekDataFull: draftS3.data,
        },
        {
          ...targetS5,
          published_week_id: targetS5.id,
          weekDataFull: targetS5.data,
        },
        {
          ...futureS6,
          published_week_id: futureS6.id,
          weekDataFull: futureS6.data,
        },
        legacyS2,
      ],
    }

    const selected = selectLocalProgrammingContextWeeks(history, targetState)

    expect(selected.progressionWeeks.map((row) => row.id)).toEqual(['exact-s4'])
    expect(selected.progressionWeeks.map((row) => row.id)).not.toContain(
      'legacy-s2',
    )
    expect(selected.selectedWeekIds).not.toContain('target-s5')
    expect(selected.selectedWeekIds).not.toContain('future-s6')
    expect(selected.selectedWeekIds).not.toContain('draft-s3')
  })
})

describe('loadExactWeekContext', () => {
  it('selecciona solo versiones publicadas anteriores exactas y filtra feedback por sus IDs', async () => {
    const exactS3 = publishedWeek({
      id: 'exact-s3',
      week: 3,
      weekStart: '2026-07-13',
      note: 'válido-s3',
    })
    const exactS4 = publishedWeek({
      id: 'exact-s4',
      week: 4,
      weekStart: '2026-07-20',
      status: 'superseded',
      note: 'válido-s4',
    })
    const targetS5 = publishedWeek({
      id: 'target-s5',
      week: 5,
      weekStart: '2026-07-27',
      note: 'NO-TARGET',
    })
    const futureS6 = publishedWeek({
      id: 'future-s6',
      week: 6,
      weekStart: '2026-08-03',
      note: 'NO-FUTURE',
    })
    const draftS2 = publishedWeek({
      id: 'draft-s2',
      week: 2,
      weekStart: '2026-07-06',
      status: 'draft',
      note: 'NO-DRAFT',
    })
    const oldCycle = publishedWeek({
      id: 'old-cycle-s4',
      week: 4,
      weekStart: '2026-05-18',
      cycleId: 'fuerza:2026-04-27',
      cycleStart: '2026-04-27',
      note: 'referencia-antigua',
      publishedAt: '2026-05-18T08:00:00.000Z',
    })
    const listVersions = vi.fn().mockResolvedValue([
      targetS5,
      futureS6,
      draftS2,
      exactS4,
      exactS3,
      oldCycle,
    ])
    const validFeedback = {
      id: 'feedback-valid',
      week_id: 'exact-s4',
      day_key: 'monday',
      notes_next_week: 'feedback-válido',
      created_at: '2026-07-21T08:00:00.000Z',
    }
    const listFeedback = vi.fn().mockResolvedValue([
      validFeedback,
      {
        id: 'feedback-target',
        week_id: 'target-s5',
        notes_next_week: 'NO-FEEDBACK-TARGET',
      },
      {
        id: 'feedback-draft',
        week_id: 'draft-s2',
        notes_next_week: 'NO-FEEDBACK-DRAFT',
      },
    ])

    const result = await loadExactWeekContext(targetState, {
      listPublishedWeekVersionsForMesocycle: listVersions,
      listCoachSessionFeedback: listFeedback,
      localHistory: {},
    })

    expect(listVersions).toHaveBeenCalledWith('fuerza')
    expect(result.progressionWeeks.map((row) => row.id)).toEqual([
      'exact-s3',
      'exact-s4',
    ])
    expect(result.historicalReferenceWeeks.map((row) => row.id)).toEqual([
      'old-cycle-s4',
    ])
    expect(result.coachFeedback).toEqual([validFeedback])
    expect(result.selectedWeekIds).toEqual([
      'exact-s3',
      'exact-s4',
      'old-cycle-s4',
    ])
    expect(result.text).toContain('feedback-válido')
    expect(result.text).not.toContain('NO-TARGET')
    expect(result.text).not.toContain('NO-FUTURE')
    expect(result.text).not.toContain('NO-DRAFT')
    expect(result.text).not.toContain('NO-FEEDBACK-TARGET')
  })

  it('incluye las siete modalidades publicadas en el contexto de progresión', async () => {
    const s4 = publishedWeek({
      id: 'all-classes-s4',
      week: 4,
      weekStart: '2026-07-20',
    })
    s4.data.dias[0] = {
      nombre: 'Lunes',
      evofuncional: 'funcional-visible',
      evobasics: 'basics-visible',
      evofit: 'fit-visible',
      evohybrix: 'hybrix-visible',
      evofuerza: 'fuerza-visible',
      evogimnastica: 'gimnastica-visible',
      evotodos: 'todos-visible',
    }

    const result = await loadExactWeekContext(targetState, {
      listPublishedWeekVersionsForMesocycle: async () => [s4],
      listCoachSessionFeedback: async () => [],
      localHistory: {},
    })

    for (const marker of [
      'funcional-visible',
      'basics-visible',
      'fit-visible',
      'hybrix-visible',
      'fuerza-visible',
      'gimnastica-visible',
      'todos-visible',
    ]) {
      expect(result.text).toContain(marker)
    }
  })

  it('espera una identidad exacta antes de consultar cualquier histórico', async () => {
    const listVersions = vi.fn()
    const listFeedback = vi.fn()

    await expect(
      loadExactWeekContext(
        { mesocycle: 'fuerza', week: 5 },
        {
          listPublishedWeekVersionsForMesocycle: listVersions,
          listCoachSessionFeedback: listFeedback,
          localHistory: {},
        },
      ),
    ).rejects.toThrow(/inicio real del ciclo/i)
    expect(listVersions).not.toHaveBeenCalled()
    expect(listFeedback).not.toHaveBeenCalled()
  })

  it('rechaza reutilizar un snapshot cargado para otra semana', async () => {
    const snapshot = await loadExactWeekContext(targetState, {
      listPublishedWeekVersionsForMesocycle: async () => [],
      listCoachSessionFeedback: async () => [],
      localHistory: {},
    })

    await expect(
      buildWeekContext({ ...targetState, week: 4 }, snapshot),
    ).rejects.toThrow(/otra semana o ciclo/i)
  })
})
