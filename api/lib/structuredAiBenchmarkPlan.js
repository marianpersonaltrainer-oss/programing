import { EVO_DAY_OUTPUT_SCHEMA } from '../../src/constants/evoDayOutputSchema.js'
import { SYSTEM_PROMPT_SHARED_CORE } from '../../src/constants/systemPromptCore.js'
import { METHOD_EVO_V1_PROMPT } from '../../src/domain/method/methodEvoV1.js'
import { validateEvoSessionContract } from '../../src/domain/method/validators/validateEvoSession.js'
import { buildDayGenerationSystemPrompt } from '../../src/utils/dayGenerationSystemPrompt.js'
import { validateAndNormalizeGeneratedDay } from '../programming-generation-step.js'

export const STRUCTURED_AI_BENCHMARK_MAX_TOKENS = 2_200

export const STRUCTURED_AI_BENCHMARK_CASES = Object.freeze([
  Object.freeze({
    id: 'fuerza-funcional-lunes',
    day: 'LUNES',
    selectedClasses: Object.freeze(['evofuncional']),
    instruction: [
      'Programa una sesión de EvoFuncional para un lunes del mesociclo de fuerza, semana 3.',
      'Incluye un bloque de fuerza submáxima y un bloque metabólico compatible con el Método EVO.',
      'La sesión debe ser viable para una clase colectiva y respetar el formato visible oficial.',
    ].join(' '),
  }),
  Object.freeze({
    id: 'tecnica-basics-miercoles',
    day: 'MIÉRCOLES',
    selectedClasses: Object.freeze(['evobasics']),
    instruction: [
      'Programa una sesión de EvoBasics para un miércoles del mesociclo de fuerza, semana 3.',
      'Prioriza una habilidad técnica accesible, progresiones claras y acondicionamiento sencillo.',
      'Evita movimientos complejos dentro del bloque metabólico y respeta el formato visible oficial.',
    ].join(' '),
  }),
  Object.freeze({
    id: 'acondicionamiento-fit-viernes',
    day: 'VIERNES',
    selectedClasses: Object.freeze(['evofit']),
    instruction: [
      'Programa una sesión de EvoFit para un viernes del mesociclo de fuerza, semana 3.',
      'Busca acondicionamiento general sostenible, cargas sencillas y una organización eficiente.',
      'Los tiempos de trabajo y descanso deben cuadrar y respetar el formato visible oficial.',
    ].join(' '),
  }),
])

export function buildStructuredAiBenchmarkSystemPrompt() {
  return buildDayGenerationSystemPrompt(
    `${SYSTEM_PROMPT_SHARED_CORE}\n\n${METHOD_EVO_V1_PROMPT}`,
  )
}

export function buildStructuredAiBenchmarkRequest(testCase) {
  const selected = testCase.selectedClasses.join(', ')
  return {
    system: buildStructuredAiBenchmarkSystemPrompt(),
    messages: [{
      role: 'user',
      content: [
        testCase.instruction,
        `Devuelve únicamente ${testCase.day}.`,
        `Clases seleccionadas: ${selected}.`,
        'Rellena las clases seleccionadas con contenido real y su feedback.',
        'Mantén todas las clases no seleccionadas como cadenas vacías.',
        'Antes de responder, comprueba que cada bloque visible empieza por A), B) o C) y que su título contiene «— N MIN».',
        'Si un bloque de fuerza usa una cadencia de 3 minutos o más, incluye un segundo movimiento o accesorio; para un único movimiento usa una cadencia menor.',
        'Reutiliza el material de montaje alto en otro movimiento o bloque, o explica en el feedback por qué no se reutiliza.',
        'Devuelve sólo el objeto raíz "dia" exigido por el schema.',
      ].join('\n'),
    }],
    schema: EVO_DAY_OUTPUT_SCHEMA,
    schemaName: 'evo_day_benchmark',
    maxTokens: STRUCTURED_AI_BENCHMARK_MAX_TOKENS,
  }
}

export function evaluateStructuredAiBenchmarkOutput(output, testCase) {
  try {
    const normalized = validateAndNormalizeGeneratedDay(output, {
      expectedDay: testCase.day,
      selectedClasses: testCase.selectedClasses,
    })
    const findings = testCase.selectedClasses.flatMap((classKey) => {
      const result = validateEvoSessionContract(normalized.dia[classKey], {
        classKey,
        mesocycle: 'fuerza',
        mesocycleWeek: 3,
        organizationText: normalized.dia[`feedback_${classKey.replace(/^evo/, '')}`] || '',
      })
      return [
        ...result.errors.map((entry) => ({ ...entry, kind: 'error' })),
        ...result.warnings.map((entry) => ({ ...entry, kind: 'warning' })),
      ]
    })
    const errors = findings.filter((entry) => entry.kind === 'error').length
    const warnings = findings.filter((entry) => entry.kind === 'warning').length
    return {
      passed: errors === 0,
      score: errors ? 0 : Math.max(0, 1 - warnings * 0.05),
      issueCodes: [...new Set(findings.map((entry) => entry.code).filter(Boolean))],
    }
  } catch {
    return {
      passed: false,
      score: 0,
      issueCodes: ['BENCHMARK-CONTRACT-001'],
    }
  }
}
