import { describe, expect, it } from 'vitest'
import { isEvoOriginAllowed } from './lib/evoAllowedOrigins.js'
import { filterBriefingContextWeeks } from './lib/briefingContextFilter.js'

describe('evoAllowedOrigins', () => {
  it('permite previews Vercel de programing y programing-evo', () => {
    expect(isEvoOriginAllowed('https://programing-evo.vercel.app')).toBe(true)
    expect(isEvoOriginAllowed('https://programing-evo-git-main-marian.vercel.app')).toBe(true)
    expect(
      isEvoOriginAllowed('https://programing-cvuwkfn6q-marianpersonaltrainer-oss-projects.vercel.app'),
    ).toBe(true)
    expect(isEvoOriginAllowed('https://evil.example.com')).toBe(false)
  })
})

describe('briefingContextFilter', () => {
  it('excluye semanas futuras y de otro mesociclo', () => {
    const rows = [
      { mesociclo: 'fuerza', semana: 3, data: { dias: [{ nombre: 'LUNES', evofuncional: 'A) FUERZA — 10 MIN\nX' }] } },
      { mesociclo: 'resistencia', semana: 2, data: { dias: [{ nombre: 'LUNES', evofuncional: 'A) FUERZA — 10 MIN\nX' }] } },
      { mesociclo: 'fuerza', semana: 6, data: { dias: [{ nombre: 'LUNES', evofuncional: 'A) FUERZA — 10 MIN\nX' }] } },
    ]
    const kept = filterBriefingContextWeeks(rows, { mesociclo: 'fuerza', targetSemana: 5 })
    expect(kept.map((r) => r.semana)).toEqual([3])
  })
})

describe('programming-week-briefing.js — carga del módulo', () => {
  it('importa sin ReferenceError', async () => {
    await expect(import('./programming-week-briefing.js')).resolves.toBeTruthy()
  })
})
