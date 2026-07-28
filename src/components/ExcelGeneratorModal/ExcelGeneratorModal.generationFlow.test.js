import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const modalSrc = readFileSync(
  join(root, 'src/components/ExcelGeneratorModal/ExcelGeneratorModal.jsx'),
  'utf8',
)

describe('ExcelGeneratorModal generation flow contract', () => {
  it('permite generar con contexto verificado aunque falle la propuesta IA', () => {
    expect(modalSrc).toContain('const contextReady = publicationContextVerified && !!pack')
    expect(modalSrc).not.toContain("briefingStatus !== 'ready' || !pack || !publicationContextVerified")
    expect(modalSrc).toContain('buildDeterministicBriefingProposal')
    expect(modalSrc).toContain('Continuar generación')
  })

  it('usa timeout de propuesta coherente con dos llamadas upstream', () => {
    expect(modalSrc).toContain('BRIEFING_PROPOSAL_CLIENT_TIMEOUT_MS')
    expect(modalSrc).toContain('classifyJsonApiResponse')
  })

  it('expone comprobación de IA y job id', () => {
    expect(modalSrc).toContain('/api/programming-ai-check')
    expect(modalSrc).toContain('Comprobar conexión con la IA')
    expect(modalSrc).toContain('saveGenerationJob')
    expect(modalSrc).toContain('generationJobId')
  })

  it('verifica contexto antes de llamar a la propuesta IA', () => {
    const verifyIdx = modalSrc.indexOf('verifyPublicationContextFromSelection')
    const proposalIdx = modalSrc.indexOf("action: 'proposal'")
    expect(verifyIdx).toBeGreaterThan(0)
    expect(proposalIdx).toBeGreaterThan(verifyIdx)
  })
})
