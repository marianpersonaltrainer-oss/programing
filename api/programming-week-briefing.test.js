import { describe, expect, it } from 'vitest'

describe('programming-week-briefing.js — método canónico', () => {
  it('no consulta ni permite reactivar method_rules legacy', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const { dirname, join } = await import('node:path')
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const src = readFileSync(join(root, 'api/programming-week-briefing.js'), 'utf8')
    expect(src).toContain("from '../src/domain/method/methodEvoV1.js'")
    expect(src).toContain('buildMethodEvoV1Prompt')
    expect(src).not.toContain('method_rules')
    expect(src).not.toContain('METHOD_RULE_LEGACY')
  })

  it('incorpora días, clases y contexto elegidos antes de preparar la propuesta', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const { dirname, join } = await import('node:path')
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const src = readFileSync(join(root, 'api/programming-week-briefing.js'), 'utf8')

    expect(src).toContain('body.generationDays')
    expect(src).toContain('body.weeklyOffer?.dias')
    expect(src).toContain('body.userInstructions')
    expect(src).toContain('DÍAS QUE MARIAN QUIERE DISEÑAR EN ESTA TANDA')
  })
})
