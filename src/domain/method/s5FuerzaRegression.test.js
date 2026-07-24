import { describe, expect, it } from 'vitest'
import { validateEvoWeek } from './validators/validateEvoWeek.js'
import fixture from './fixtures/s5FuerzaRegressionWeek.json'

const REQUIRED_CODES = [
  'VAL-TIME-003',
  'VAL-INTERVAL-001',
  'VAL-VARIETY-003',
  'VAL-TIME-004',
  'VAL-IDENTITY-001',
  'VAL-LOAD-001',
  'VAL-LOGISTICS-001',
  'VAL-SUMMARY-001',
]

describe('S5 fuerza — regresión PR #6 (semana adjunta inválida)', () => {
  it('bloquea la semana completa del Excel de regresión', () => {
    const result = validateEvoWeek(fixture.week, {
      offer: fixture.offer,
      validateOfferCompleteness: false,
    })
    expect(result.valid).toBe(false)
    for (const code of REQUIRED_CODES) {
      expect(result.errors.some((entry) => entry.code === code), `falta ${code}`).toBe(true)
    }
  })

  it('detecta EvoFuncional demasiado corto (lunes 18 min)', () => {
    const result = validateEvoWeek(fixture.week, {
      offer: fixture.offer,
      validateOfferCompleteness: false,
    })
    expect(
      result.errors.some(
        (entry) =>
          entry.code === 'VAL-TIME-003' &&
          entry.classKey === 'evofuncional' &&
          /lunes/i.test(entry.message),
      ),
    ).toBe(true)
  })

  it('detecta exceso de días interválicos en EvoFit (4 días)', () => {
    const result = validateEvoWeek(fixture.week, {
      offer: fixture.offer,
      validateOfferCompleteness: false,
    })
    expect(result.errors.some((entry) => entry.code === 'VAL-INTERVAL-001' && entry.classKey === 'evofit')).toBe(
      true,
    )
  })

  it('detecta repetición de KB Swing en EvoFit', () => {
    const result = validateEvoWeek(fixture.week, {
      offer: fixture.offer,
      validateOfferCompleteness: false,
    })
    expect(
      result.errors.some(
        (entry) => entry.code === 'VAL-VARIETY-003' && entry.classKey === 'evofit' && /KB Swing/i.test(entry.message),
      ),
    ).toBe(true)
  })
})
