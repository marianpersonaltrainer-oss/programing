import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  DEFAULT_METHOD,
  METHOD_PROMPT_HEADER,
  METHOD_PROMPT_MAX_CHARS,
  RUNTIME_METHOD_APPENDIX,
  applyMethodPromptBudget,
  buildMethodBody,
  buildMethodPromptAppendix,
} from './methodPrompt.js'
import { METHOD_LEARNED_KEY } from './methodLearnedStorage.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')

describe('methodPrompt — Método EVO versionado', () => {
  it('usa Método EVO 1.2.0 como base canónica', () => {
    expect(DEFAULT_METHOD).toContain('MÉTODO EVO 1.2.0')
    expect(DEFAULT_METHOD).toContain('EVOFIT')
    expect(DEFAULT_METHOD).toContain('menor complejidad técnica, no menor exigencia')
  })

  it('versiona también las decisiones manuales', () => {
    expect(METHOD_LEARNED_KEY).toBe('programingevo_method_learned_v1_2_0')
  })

  it('incluye decisiones manuales confirmadas', () => {
    const body = buildMethodBody({
      baseMethod: DEFAULT_METHOD,
      learnedState: { manual: 'Evitar thruster los viernes.', auto: [] },
    })
    expect(body).toContain('DECISIONES MANUALES CONFIRMADAS POR MARIAN')
    expect(body).toContain('Evitar thruster los viernes.')
  })

  it('no inyecta observaciones automáticas pendientes', () => {
    const body = buildMethodBody({
      baseMethod: DEFAULT_METHOD,
      learnedState: {
        manual: '',
        auto: [{ at: '2026-07-20T10:00:00.000Z', text: 'AUTO_NO_APROBADA' }],
      },
    })
    expect(body).not.toContain('AUTO_NO_APROBADA')
    expect(body).not.toContain('REGLAS APRENDIDAS')
  })

  it('protege el método base al aplicar presupuesto', () => {
    const body = applyMethodPromptBudget({
      base: DEFAULT_METHOD,
      manual: 'Manual '.repeat(2000),
      auto: [{ text: 'AUTO' }],
      maxChars: METHOD_PROMPT_MAX_CHARS,
    })
    expect(body).toContain('MÉTODO EVO 1.2.0')
    expect(body.length).toBeLessThanOrEqual(METHOD_PROMPT_MAX_CHARS)
  })

  it('buildMethodPromptAppendix usa encabezado único y sin undefined', () => {
    const block = buildMethodPromptAppendix({
      baseMethod: DEFAULT_METHOD,
      learnedState: { manual: 'Nota manual.', auto: [] },
    })
    expect(block.startsWith(METHOD_PROMPT_HEADER)).toBe(true)
    expect(block.split(METHOD_PROMPT_HEADER).length - 1).toBe(1)
    expect(block).not.toContain('undefined')
  })

  it('el apéndice runtime no repite contrato ni feedback ya incluidos en el núcleo', () => {
    expect(RUNTIME_METHOD_APPENDIX).toContain('IDENTIDAD DE MODALIDADES')
    expect(RUNTIME_METHOD_APPENDIX).not.toContain('CONTRATO DE SALIDA COMPARTIDO')
    expect(RUNTIME_METHOD_APPENDIX).not.toContain('FEEDBACK AL ENTRENADOR')
  })

  it('Chat, Excel y edición diaria importan el mismo constructor', () => {
    const useAgent = readFileSync(join(root, 'src/hooks/useAgent.js'), 'utf8')
    const excel = readFileSync(join(root, 'src/components/ExcelGeneratorModal/ExcelGeneratorModal.jsx'), 'utf8')
    expect(useAgent).toContain('buildMethodPromptAppendix')
    expect(excel).toContain('buildMethodPromptAppendix')
    expect(useAgent).not.toContain('buildInferredMethodFromReference')
    expect(excel).not.toContain('buildInferredMethodFromReference')
  })

  it('briefing importa la misma fuente estructurada', () => {
    const briefing = readFileSync(join(root, 'api/programming-week-briefing.js'), 'utf8')
    expect(briefing).toContain('getBriefingMethodContext')
    expect(briefing).toContain('methodEvoServerBundle')
  })

  it('Chat V1 y EditModal no reactivan method_rules legacy', () => {
    const useAgent = readFileSync(join(root, 'src/hooks/useAgent.js'), 'utf8')
    const editModal = readFileSync(join(root, 'src/components/EditModal/EditModal.jsx'), 'utf8')
    expect(useAgent).not.toContain(".from('method_rules')")
    expect(editModal).not.toContain('/api/method-rule')
  })

  it('los datos de arranque no reintroducen EvoFit básico ni preparación visible', () => {
    const pe2Seed = readFileSync(join(root, 'scripts/seed-pe2-phase1.mjs'), 'utf8')
    const librarySeed = readFileSync(join(root, 'scripts/seed-coach-exercise-library.mjs'), 'utf8')
    expect(pe2Seed).toContain('Fuerza real, accesorios y WOD sin bloque de skill')
    expect(pe2Seed).not.toContain('Alta intensidad breve')
    expect(pe2Seed).not.toContain("kind: 'warmup'")
    expect(librarySeed).toMatch(/Pull Up estricto[^\n]+evofit/)
    expect(librarySeed).toContain('2 bicicletas compartidas entre salas')
    expect(existsSync(join(root, 'supabase/seed_coach_exercise_library.sql'))).toBe(false)
  })

  it('separa las superficies y modales pesados de la carga inicial', () => {
    const app = readFileSync(join(root, 'src/App.jsx'), 'utf8')
    expect(app).toContain("lazy(() => import('./components/CoachView/CoachView.jsx'))")
    expect(app).toContain("lazy(() => import('./components/ExcelGeneratorModal/ExcelGeneratorModal.jsx'))")
    expect(app).not.toContain("import CoachView from './components/CoachView/CoachView.jsx'")
  })
})
