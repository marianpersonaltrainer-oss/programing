import { describe, expect, it } from 'vitest'

describe('programming-week-briefing.js — método canónico', () => {
  it('no consulta ni permite reactivar method_rules legacy', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const { dirname, join } = await import('node:path')
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const src = readFileSync(join(root, 'api/programming-week-briefing.js'), 'utf8')
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
    expect(src).toContain('weeklyOffer?.dias')
    expect(src).toContain('body.userInstructions')
    expect(src).toContain('DÍAS QUE MARIAN QUIERE DISEÑAR EN ESTA TANDA')
  })

  it('selecciona contexto anterior verificado y separa referencias antiguas', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const { dirname, join } = await import('node:path')
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const src = readFileSync(join(root, 'api/programming-week-briefing.js'), 'utf8')

    expect(src).toContain('selectProgrammingContextWeeks')
    expect(src).toContain('filterFeedbackForSelectedWeekIds')
    expect(src).toContain('Progresión verificada del ciclo objetivo')
    expect(src).toContain('Referencias históricas separadas')
    expect(src).not.toContain('.eq(\'mesociclo\', mesociclo)')
  })

  it('obliga a cerrar el plan estructural semanal antes de generar días', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const { dirname, join } = await import('node:path')
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const src = readFileSync(join(root, 'api/programming-week-briefing.js'), 'utf8')

    expect(src).toContain('"weeklyArchitecture"')
    expect(src).toContain('normalizeWeeklyArchitecturePlan')
    expect(src).toContain('replaceWeeklyArchitectureBlock')
    expect(src).toContain('formatWeeklyStructuralFingerprints')
  })

  it('protege contexto interno y coste de IA con secreto y rate limit servidor', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const { dirname, join } = await import('node:path')
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const src = readFileSync(join(root, 'api/programming-week-briefing.js'), 'utf8')

    expect(src).toContain('COACH_GUIDE_ADMIN_SECRET')
    expect(src).toContain('adminSecretsMatch(body.secret, serverSecret)')
    expect(src).toContain('checkAdminRateLimit')
    expect(src).toContain("endpoint: '/api/programming-week-briefing'")
    expect(src.indexOf('adminSecretsMatch(body.secret, serverSecret)')).toBeLessThan(
      src.indexOf('fetchContextPack(supabase, targetCycle)'),
    )
  })

  it('cancela Anthropic antes del límite de Vercel para no dejar el briefing colgado', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const { dirname, join } = await import('node:path')
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const src = readFileSync(join(root, 'api/programming-week-briefing.js'), 'utf8')

    expect(src).toContain('BRIEFING_UPSTREAM_TIMEOUT_MS')
    expect(src).toContain('signal: upstreamAbort.signal')
    expect(src).toContain("error?.name === 'AbortError'")
    expect(src).toContain('pulsa «Reintentar»')
  })

  it('separa la carga de contexto de la propuesta IA y paraleliza notas auxiliares', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const { dirname, join } = await import('node:path')
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const src = readFileSync(join(root, 'api/programming-week-briefing.js'), 'utf8')

    expect(src).toContain("['prepare', 'context', 'proposal']")
    expect(src).toContain("if (action === 'context')")
    expect(src).toContain("if (action !== 'proposal')")
    expect(src).toContain('contextSelection = normalizeContextSelection(body.contextSelection)')
    expect(src).toContain('Promise.all([')
    expect(src).toContain('MAX_CONTEXT_PACK_CHARS')
  })
})
