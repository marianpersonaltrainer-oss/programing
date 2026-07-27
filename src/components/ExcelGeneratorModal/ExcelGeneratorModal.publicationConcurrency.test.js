import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  new URL('./ExcelGeneratorModal.jsx', import.meta.url),
  'utf8',
)

describe('ExcelGeneratorModal publication mutation mutex', () => {
  it('comparte un único busy entre publicación, borradores, edición e importación', () => {
    expect(source).toMatch(
      /const publicationMutationBusy\s*=\s*publishing\s*\|\|\s*savingHubDraft\s*\|\|\s*savingPublishedEdit\s*\|\|\s*importingExcel/,
    )
  })

  it('reclama el mutex al entrar en cada mutación remota', () => {
    expect(source).toContain('if (!claimPublicationMutation(setPublishing)) return')
    expect(source).toContain('if (!claimPublicationMutation(setSavingHubDraft)) return')
    expect(source).toContain('if (!claimPublicationMutation(setSavingPublishedEdit)) return')
    expect(source).toContain('if (!claimPublicationMutation(setImportingExcel)) return')
  })

  it('bloquea en cliente tanto errores como avisos del Método EVO', () => {
    expect(source.match(/\.\.\.\(gateMethodReview\?\.warnings \|\| \[\]\)/g)).toHaveLength(1)
    expect(source.match(/\.\.\.\(methodValidation\.warnings \|\| \[\]\)/g)).toHaveLength(1)
  })

  it('no adopta IDs de otra semana y bloquea aperturas mientras muta', () => {
    expect(source).toContain('publicationMutationTargetStillCurrent(mutationSnapshot)')
    expect(source).toContain('publicationMutationTargetStillCurrent(importedMutationSnapshot)')
    expect(source.match(/disabled=\{publicationMutationBusy\}/g)?.length).toBeGreaterThanOrEqual(7)
  })
})
