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

  it('mantiene visible la acción de publicar antes del análisis', () => {
    const upload = readFileSync(
      'src/components/CoachGuideContentPanel/AdminWeeklyProgramUpload.jsx',
      'utf8',
    )
    const primaryActions = upload.slice(
      upload.indexOf('<div className="flex flex-wrap gap-2">'),
      upload.indexOf('Laboratorio real (lote de semanas)'),
    )
    expect(primaryActions).toContain("'Publicar para coaches'")
    expect(primaryActions.indexOf("'Publicar para coaches'")).toBeLessThan(
      primaryActions.indexOf('{showSubirHubButton ? ('),
    )
    expect(upload).toContain('Primero pulsa «Analizar antes de importar»')
  })
})
