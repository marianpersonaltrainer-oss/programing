import { describe, expect, it } from 'vitest'
import { weekInstructionsStorageKey } from './weekInstructionsStorage.js'

describe('weekInstructionsStorageKey', () => {
  it('aísla las instrucciones de dos ciclos con el mismo mesociclo y semana', () => {
    const a = weekInstructionsStorageKey({
      mesocycle: 'fuerza',
      week: 5,
      cycleStartDate: '2026-06-29',
    })
    const b = weekInstructionsStorageKey({
      mesocycle: 'fuerza',
      week: 5,
      cycleStartDate: '2026-09-07',
    })

    expect(a).not.toBe(b)
    expect(a).toContain(encodeURIComponent('fuerza:2026-06-29'))
    expect(b).toContain(encodeURIComponent('fuerza:2026-09-07'))
  })

  it('no vuelve a la antigua clave mesociclo+semana si aún falta el ciclo', () => {
    expect(
      weekInstructionsStorageKey({ mesocycle: 'mixto', week: 2 }),
    ).toBe('programingevo_week_instructions:sin-ciclo:s2')
  })
})
