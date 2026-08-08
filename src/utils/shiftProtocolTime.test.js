import { describe, expect, it } from 'vitest'
import {
  formatMadridDayHeading,
  formatShiftLogMadrid,
  madridDayUtcRange,
  madridTodayYmd,
} from './shiftProtocolTime.js'

describe('día operativo en Europe/Madrid', () => {
  it('convierte un día de invierno a su intervalo UTC', () => {
    expect(madridDayUtcRange('2026-01-15')).toEqual({
      start: '2026-01-14T23:00:00.000Z',
      end: '2026-01-15T23:00:00.000Z',
    })
  })

  it('convierte un día de verano a su intervalo UTC', () => {
    expect(madridDayUtcRange('2026-07-22')).toEqual({
      start: '2026-07-21T22:00:00.000Z',
      end: '2026-07-22T22:00:00.000Z',
    })
  })

  it('respeta los días de 23 y 25 horas por cambio horario', () => {
    const spring = madridDayUtcRange('2026-03-29')
    const autumn = madridDayUtcRange('2026-10-25')
    expect(new Date(spring.end) - new Date(spring.start)).toBe(23 * 60 * 60 * 1000)
    expect(new Date(autumn.end) - new Date(autumn.start)).toBe(25 * 60 * 60 * 1000)
  })

  it('agrupa y muestra según Madrid aunque el instante sea UTC', () => {
    const instant = new Date('2026-07-21T22:30:00.000Z')
    expect(madridTodayYmd(instant)).toBe('2026-07-22')
    expect(formatShiftLogMadrid(instant)).toBe('22 de julio · 00:30')
    expect(formatMadridDayHeading('2026-07-22')).toBe('miércoles, 22 de julio')
  })
})
