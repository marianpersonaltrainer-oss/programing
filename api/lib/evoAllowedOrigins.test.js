import { describe, expect, it } from 'vitest'
import { isEvoOriginAllowed } from './evoAllowedOrigins.js'

describe('isEvoOriginAllowed', () => {
  it('acepta producción y referer con ruta del mismo origen', () => {
    expect(isEvoOriginAllowed('https://programing-evo.vercel.app')).toBe(true)
    expect(isEvoOriginAllowed('https://programing-evo.vercel.app/programador')).toBe(true)
    expect(isEvoOriginAllowed('https://programing.vercel.app')).toBe(true)
  })

  it('no confunde un dominio atacante que empieza igual', () => {
    expect(isEvoOriginAllowed('https://programing-evo.vercel.app.evil.example')).toBe(false)
    expect(isEvoOriginAllowed('https://programing-evo.evil.vercel.app')).toBe(false)
    expect(isEvoOriginAllowed('https://programing-evo-unlisted-preview.vercel.app')).toBe(false)
    expect(isEvoOriginAllowed('not-a-url')).toBe(false)
  })
})
