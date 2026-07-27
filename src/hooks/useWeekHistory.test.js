import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteWeekFromHistory,
  getHistoryForMesocycle,
  loadHistory,
  resolveLocalWeekCycleIdentity,
  saveWeekToHistory,
} from './useWeekHistory.js'

function createStorage() {
  const values = new Map()
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  }
}

function week(title, cycleStartDate = '') {
  return {
    titulo: title,
    resumen: null,
    cycle_start_date: cycleStartDate || undefined,
    dias: [],
  }
}

describe('historial local por ciclo exacto', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage())
  })

  it('separa dos S1 del mismo mesociclo y no mezcla legacy en una lectura automática', () => {
    saveWeekToHistory('fuerza', 1, week('ciclo A', '2026-06-29'))
    saveWeekToHistory('fuerza', 1, week('ciclo B', '2026-09-07'))
    saveWeekToHistory('fuerza', 1, week('legacy'))

    expect(
      getHistoryForMesocycle('fuerza', {
        cycleId: 'fuerza:2026-06-29',
      }).map((entry) => entry.titulo),
    ).toEqual(['ciclo A'])
    expect(
      getHistoryForMesocycle('fuerza', {
        cycleStartDate: '2026-09-07',
      }).map((entry) => entry.titulo),
    ).toEqual(['ciclo B'])
    expect(getHistoryForMesocycle('fuerza')).toEqual([])
  })

  it('solo muestra referencias legacy al pedir una vista histórica explícita', () => {
    saveWeekToHistory('fuerza', 1, week('exacta', '2026-06-29'))
    saveWeekToHistory('fuerza', 2, week('legacy'))

    expect(
      getHistoryForMesocycle('fuerza', { allCycles: true }).map((entry) => entry.titulo),
    ).toEqual(['exacta'])
    expect(
      new Set(
        getHistoryForMesocycle('fuerza', {
          allCycles: true,
          includeLegacy: true,
        }).map((entry) => entry.titulo),
      ),
    ).toEqual(new Set(['legacy', 'exacta']))
  })

  it('deriva y persiste ciclo e inicio de semana canónicos', () => {
    saveWeekToHistory('mixto', 3, {
      titulo: 'S3',
      week_start_date: '2026-08-24',
      dias: [],
    })
    const [entry] = getHistoryForMesocycle('mixto', {
      cycleId: 'mixto:2026-08-10',
    })

    expect(entry).toMatchObject({
      cycleId: 'mixto:2026-08-10',
      cycleStartDate: '2026-08-10',
      weekStartDate: '2026-08-24',
    })
    expect(entry.weekDataFull).toMatchObject({
      cycle_id: 'mixto:2026-08-10',
      cycle_start_date: '2026-08-10',
      week_start_date: '2026-08-24',
    })
  })

  it('limita ocho versiones por semana y ciclo, sin hacer competir ciclos distintos', () => {
    for (let index = 0; index < 9; index += 1) {
      saveWeekToHistory('fuerza', 2, week(`A${index}`, '2026-06-29'))
      saveWeekToHistory('fuerza', 2, week(`B${index}`, '2026-09-07'))
    }
    expect(
      getHistoryForMesocycle('fuerza', { cycleId: 'fuerza:2026-06-29' }),
    ).toHaveLength(8)
    expect(
      getHistoryForMesocycle('fuerza', { cycleId: 'fuerza:2026-09-07' }),
    ).toHaveLength(8)
  })

  it('el borrado por semana requiere y respeta la identidad exacta del ciclo', () => {
    saveWeekToHistory('fuerza', 4, week('A', '2026-06-29'))
    saveWeekToHistory('fuerza', 4, week('B', '2026-09-07'))

    deleteWeekFromHistory('fuerza', 4, null, {
      cycleId: 'fuerza:2026-06-29',
    })

    expect(
      getHistoryForMesocycle('fuerza', { cycleId: 'fuerza:2026-06-29' }),
    ).toEqual([])
    expect(
      getHistoryForMesocycle('fuerza', { cycleId: 'fuerza:2026-09-07' }),
    ).toHaveLength(1)
    expect(loadHistory().fuerza).toHaveLength(1)
  })

  it('prefiere el inicio del ciclo para corregir fechas internas incoherentes', () => {
    expect(
      resolveLocalWeekCycleIdentity('autocarga', 3, {
        cycle_id: 'otro-id',
        cycle_start_date: '2026-07-06',
        week_start_date: '2020-01-01',
      }),
    ).toEqual({
      cycleId: 'autocarga:2026-07-06',
      cycleStartDate: '2026-07-06',
      weekStartDate: '2026-07-20',
      isLegacy: false,
    })
  })
})
