import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  DEFAULT_METHOD,
  METHOD_PROMPT_HEADER,
  METHOD_PROMPT_MAX_CHARS,
  applyMethodPromptBudget,
  buildMethodBody,
  buildMethodPromptAppendix,
} from './methodPrompt.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

describe('methodPrompt — constructor compartido V1', () => {
  it('usa método por defecto cuando no hay base personalizada', () => {
    const body = buildMethodBody({
      baseMethod: DEFAULT_METHOD,
      learnedState: { manual: '', auto: [] },
    })
    expect(body).toContain('FILOSOFÍA EVO')
    expect(body).not.toContain('REGLAS APRENDIDAS')
  })

  it('incluye método personalizado guardado', () => {
    const body = buildMethodBody({
      baseMethod: 'MI MÉTODO PERSONALIZADO EVO',
      learnedState: { manual: '', auto: [] },
    })
    expect(body).toContain('MI MÉTODO PERSONALIZADO EVO')
  })

  it('incluye reglas manuales y automáticas', () => {
    const body = buildMethodBody({
      baseMethod: DEFAULT_METHOD,
      learnedState: {
        manual: 'Evitar thruster los viernes.',
        auto: [{ id: 'a1', at: '2026-06-01T10:00:00.000Z', text: 'Basics: máximo 2 juegos por semana.' }],
      },
    })
    expect(body).toContain('REGLAS APRENDIDAS')
    expect(body).toContain('Evitar thruster los viernes.')
    expect(body).toContain('[2026-06-01] Basics: máximo 2 juegos por semana.')
  })

  it('conserva regla manual aunque existan muchas automáticas', () => {
    const manual = 'REGLA MANUAL SAGRADA de Marian — no debe desaparecer.'
    const auto = Array.from({ length: 15 }, (_, i) => ({
      at: `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
      text: `Regla automática ${i} con texto largo para competir por espacio en el presupuesto.`,
    }))
    const body = applyMethodPromptBudget({
      base: 'BASE CORTA',
      manual,
      auto,
      maxChars: 900,
    })
    expect(body).toContain('REGLA MANUAL SAGRADA')
    expect(body.length).toBeLessThanOrEqual(900)
  })

  it('entre automáticas conserva primero las más recientes', () => {
    const body = applyMethodPromptBudget({
      base: 'X'.repeat(4200),
      manual: '',
      auto: [
        { at: '2026-01-01T10:00:00.000Z', text: 'AUTO_ANTIGUA_QUE_PUEDE_CAER' },
        { at: '2026-06-20T10:00:00.000Z', text: 'AUTO_RECIENTE_PRIORITARIA' },
        { at: '2026-06-19T10:00:00.000Z', text: 'AUTO_CASI_RECIENTE' },
      ],
      maxChars: METHOD_PROMPT_MAX_CHARS,
    })
    expect(body).toContain('AUTO_RECIENTE_PRIORITARIA')
    if (body.includes('AUTO_ANTIGUA_QUE_PUEDE_CAER')) {
      expect(body.indexOf('AUTO_RECIENTE_PRIORITARIA')).toBeLessThan(
        body.indexOf('AUTO_ANTIGUA_QUE_PUEDE_CAER'),
      )
    }
    expect(body.length).toBeLessThanOrEqual(METHOD_PROMPT_MAX_CHARS)
  })

  it('respeta el límite total de caracteres con base, manual y auto', () => {
    const body = applyMethodPromptBudget({
      base: DEFAULT_METHOD,
      manual: 'Manual '.repeat(200),
      auto: [{ at: '2026-06-01T10:00:00.000Z', text: 'Auto extra.' }],
      maxChars: METHOD_PROMPT_MAX_CHARS,
    })
    expect(body.length).toBeLessThanOrEqual(METHOD_PROMPT_MAX_CHARS)
  })

  it('buildMethodPromptAppendix usa encabezado único y sin undefined', () => {
    const block = buildMethodPromptAppendix({
      baseMethod: DEFAULT_METHOD,
      learnedState: { manual: 'Nota manual.', auto: [] },
    })
    expect(block.startsWith(METHOD_PROMPT_HEADER)).toBe(true)
    expect(block).not.toContain('undefined')
    expect(block.split(METHOD_PROMPT_HEADER).length - 1).toBe(1)
  })

  it('Chat, Excel y edición importan el mismo constructor', () => {
    const useAgent = readFileSync(join(root, 'src/hooks/useAgent.js'), 'utf8')
    const excel = readFileSync(join(root, 'src/components/ExcelGeneratorModal/ExcelGeneratorModal.jsx'), 'utf8')
    expect(useAgent).toContain('buildMethodPromptAppendix')
    expect(excel).toContain('buildMethodPromptAppendix')
    expect(useAgent).not.toContain('getMethodText')
    expect(excel).not.toContain('getMethodText')
  })

  it('Chat V1 no consulta method_rules directamente', () => {
    const useAgent = readFileSync(join(root, 'src/hooks/useAgent.js'), 'utf8')
    expect(useAgent).not.toContain(".from('method_rules')")
    expect(useAgent).not.toContain('SEÑALES DEL CENTRO')
  })

  it('EditModal no hace POST a /api/method-rule', () => {
    const editModal = readFileSync(join(root, 'src/components/EditModal/EditModal.jsx'), 'utf8')
    expect(editModal).not.toContain('/api/method-rule')
  })
})
