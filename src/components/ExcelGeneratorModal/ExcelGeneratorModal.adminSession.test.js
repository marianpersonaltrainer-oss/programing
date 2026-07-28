import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  new URL('./ExcelGeneratorModal.jsx', import.meta.url),
  'utf8',
)

describe('ExcelGeneratorModal admin session recovery', () => {
  it('permite validar la clave desde el propio error sin escribir contexto', () => {
    expect(source).toContain("'/api/programming-reference-context'")
    expect(source).toContain("{ action: 'get', secret }")
    expect(source).toContain("sessionStorage.setItem('evo_coach_guide_admin_secret', secret)")
    expect(source).toContain('await prepareBriefing()')
  })

  it('distingue la clave ausente de una clave incorrecta', () => {
    expect(source).toContain("setBriefingErrorCode('missing_admin_secret')")
    expect(source).toContain("setBriefingErrorCode('invalid_admin_secret')")
    expect(source).toContain('No es el código EVO19')
  })

  it('no ofrece el modo manual cuando solo falta autenticación', () => {
    expect(source).toContain("briefingErrorCode !== 'missing_admin_secret'")
    expect(source).toContain("briefingErrorCode !== 'invalid_admin_secret'")
  })

  it('cierra las esperas de briefing, contexto y cuerpo de generación', () => {
    expect(source).toContain('BRIEFING_CLIENT_TIMEOUT_MS')
    expect(source).toContain('BRIEFING_CONTEXT_TIMEOUT_MS')
    expect(source).toContain('getPublishedWeekVersionsByIds([...expectedIds])')
    expect(source).toContain('responseText = await response.text()')
    expect(source).toContain('signal: requestAbort.signal')
    expect(source).toContain('pantalla no se quede bloqueada')
  })
})
