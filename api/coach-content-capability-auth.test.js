import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const apiSources = [
  'api/coach-guide-settings.js',
  'api/coach-exercise-library.js',
  'api/import-exercise-library-xlsx.js',
].map((path) => readFileSync(path, 'utf8'))

describe('autorización del contenido coach', () => {
  it.each(apiSources)('usa la sesión y la capability de programación', (source) => {
    expect(source).toContain("requireEvoCapability(req, 'programming.manage')")
    expect(source).toContain('readBearerToken(req)')
    expect(source).toContain('capabilityAuthErrorResponse')
  })

  it('no muestra ni envía una clave en el panel', () => {
    const panel = readFileSync(
      'src/components/CoachGuideContentPanel/CoachGuideContentPanel.jsx',
      'utf8',
    )
    const library = readFileSync(
      'src/components/CoachGuideContentPanel/CoachExerciseLibraryAdmin.jsx',
      'utf8',
    )
    expect(panel).not.toContain('Clave de administración')
    expect(panel).not.toContain('adminSecret')
    expect(library).not.toContain('adminSecret')
    expect(panel).toContain("callProgrammingManagerApi('/api/coach-guide-settings'")
  })
})
