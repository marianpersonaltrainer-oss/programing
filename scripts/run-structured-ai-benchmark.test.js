import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const scriptPath = fileURLToPath(
  new URL('./run-structured-ai-benchmark.mjs', import.meta.url),
)

describe('structured AI benchmark execution gate', () => {
  it('se bloquea antes de usar claves si falta --execute', () => {
    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      env: {},
    })

    expect(result.status).not.toBe(0)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('Benchmark bloqueado: falta --execute.')
    expect(result.stderr).not.toMatch(/sk-[A-Za-z0-9_-]+/)
  })

  it('también exige la frase de confirmación exacta', () => {
    const result = spawnSync(process.execPath, [scriptPath, '--execute'], {
      encoding: 'utf8',
      env: {},
    })

    expect(result.status).not.toBe(0)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('falta EVO_AI_COMPARISON_CONFIRM=COMPARE_SYNTHETIC_OUTPUTS')
  })
})
