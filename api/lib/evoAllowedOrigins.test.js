import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadOriginModule() {
  vi.resetModules()
  return import('./evoAllowedOrigins.js')
}

describe('isEvoOriginAllowed', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('acepta producción y referer con ruta del mismo origen', async () => {
    const { isEvoOriginAllowed } = await loadOriginModule()
    expect(isEvoOriginAllowed('https://programing-evo.vercel.app')).toBe(true)
    expect(isEvoOriginAllowed('https://programing-evo.vercel.app/programador')).toBe(true)
    expect(isEvoOriginAllowed('https://programing.vercel.app')).toBe(true)
  })

  it('autoriza la preview exacta expuesta por VERCEL_URL', async () => {
    vi.stubEnv(
      'VERCEL_URL',
      'programing-evo-git-agent-programmer-engine-v1-marianpersonaltrainer-oss.vercel.app',
    )
    const { isEvoOriginAllowed } = await loadOriginModule()
    expect(
      isEvoOriginAllowed(
        'https://programing-evo-git-agent-programmer-engine-v1-marianpersonaltrainer-oss.vercel.app',
      ),
    ).toBe(true)
    expect(
      isEvoOriginAllowed(
        'https://programing-evo-git-agent-programmer-engine-v1-marianpersonaltrainer-oss.vercel.app/?v2',
      ),
    ).toBe(true)
  })

  it('autoriza VERCEL_BRANCH_URL cuando difiere del despliegue puntual', async () => {
    vi.stubEnv('VERCEL_URL', 'programing-evo-abc123-marianpersonaltrainer-oss.vercel.app')
    vi.stubEnv(
      'VERCEL_BRANCH_URL',
      'programing-evo-git-agent-programmer-engine-v1-marianpersonaltrainer-oss.vercel.app',
    )
    const { isEvoOriginAllowed } = await loadOriginModule()
    expect(isEvoOriginAllowed('https://programing-evo-abc123-marianpersonaltrainer-oss.vercel.app')).toBe(
      true,
    )
    expect(
      isEvoOriginAllowed(
        'https://programing-evo-git-agent-programmer-engine-v1-marianpersonaltrainer-oss.vercel.app',
      ),
    ).toBe(true)
  })

  it('no confunde un dominio atacante que empieza igual ni otras previews', async () => {
    vi.stubEnv('VERCEL_URL', 'programing-evo-abc123-marianpersonaltrainer-oss.vercel.app')
    const { isEvoOriginAllowed } = await loadOriginModule()
    expect(isEvoOriginAllowed('https://programing-evo.vercel.app.evil.example')).toBe(false)
    expect(isEvoOriginAllowed('https://programing-evo.evil.vercel.app')).toBe(false)
    expect(isEvoOriginAllowed('https://programing-evo-unlisted-preview.vercel.app')).toBe(false)
    expect(isEvoOriginAllowed('https://programing-evo-abc124-marianpersonaltrainer-oss.vercel.app')).toBe(
      false,
    )
    expect(isEvoOriginAllowed('not-a-url')).toBe(false)
  })

  it('sin VERCEL_URL no abre previews no listadas', async () => {
    vi.stubEnv('VERCEL_URL', '')
    const { isEvoOriginAllowed } = await loadOriginModule()
    expect(isEvoOriginAllowed('https://programing-evo-random-preview.vercel.app')).toBe(false)
    expect(isEvoOriginAllowed('https://programing-evo.vercel.app')).toBe(true)
  })
})
