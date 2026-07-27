import { describe, expect, it } from 'vitest'
import {
  StaleGenerationResponseError,
  assertGenerationRequestStillCurrent,
  buildGenerationRequestFingerprint,
} from './generationRequestFingerprint.js'

const base = {
  mesocycle: 'Fuerza',
  week: 5,
  phase: 'pico',
  generationDays: ['LUNES', 'MARTES'],
  weeklyOffer: { dias: { LUNES: ['evofuncional'], MARTES: ['evofit'] } },
  selectedContextWeekIds: ['s4', 's3'],
  weeklyArchitecture: [{ day: 'LUNES', intent: 'sentadilla' }],
  completedDays: { LUNES: 'Back Squat + AMRAP' },
}

describe('generation request fingerprint', () => {
  it('es estable ante el orden de claves e IDs de contexto', () => {
    const other = {
      ...base,
      selectedContextWeekIds: ['s3', 's4'],
      weeklyOffer: { dias: { MARTES: ['evofit'], LUNES: ['evofuncional'] } },
    }
    expect(buildGenerationRequestFingerprint(other)).toBe(buildGenerationRequestFingerprint(base))
  })

  it('caduca si cambia la semana, oferta, contexto, plan o días ya creados', () => {
    const captured = buildGenerationRequestFingerprint(base)
    for (const changed of [
      { ...base, week: 6 },
      { ...base, selectedContextWeekIds: ['s2', 's3'] },
      { ...base, weeklyArchitecture: [{ day: 'LUNES', intent: 'bisagra' }] },
      { ...base, completedDays: { LUNES: 'Deadlift + intervals' } },
    ]) {
      expect(() => assertGenerationRequestStillCurrent(captured, changed)).toThrow(
        StaleGenerationResponseError,
      )
    }
  })

  it('acepta únicamente la huella exacta capturada al iniciar la llamada', () => {
    const captured = buildGenerationRequestFingerprint(base)
    expect(assertGenerationRequestStillCurrent(captured, base)).toBe(true)
  })
})
