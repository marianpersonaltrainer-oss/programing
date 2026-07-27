import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = readFileSync(
  fileURLToPath(new URL('./programming-reference-context.js', import.meta.url)),
  'utf8',
)

describe('programming-reference-context protegido', () => {
  it('no permite lecturas GET ni usa Origin como autenticación', () => {
    expect(source).toContain("req.method !== 'POST'")
    expect(source).toContain('adminSecretsMatch(body.secret, adminSecret)')
    expect(source).not.toContain('providedSecret !== adminSecret')
  })

  it('limita tanto lecturas como escrituras antes de consultar datos', () => {
    expect(source).toContain('checkAdminRateLimit')
    expect(source).toContain("endpoint: '/api/programming-reference-context'")
    expect(source.indexOf('checkAdminRateLimit')).toBeLessThan(
      source.indexOf(".from('programming_reference_context')"),
    )
    expect(source.indexOf('adminSecretsMatch(body.secret, adminSecret)')).toBeLessThan(
      source.indexOf(".from('programming_reference_context')"),
    )
  })
})
