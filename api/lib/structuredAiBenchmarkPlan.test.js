import { describe, expect, it } from 'vitest'
import { EVO_DAY_OUTPUT_SCHEMA } from '../../src/constants/evoDayOutputSchema.js'
import {
  STRUCTURED_AI_BENCHMARK_CASES,
  STRUCTURED_AI_BENCHMARK_MAX_TOKENS,
  buildStructuredAiBenchmarkRequest,
  evaluateStructuredAiBenchmarkOutput,
} from './structuredAiBenchmarkPlan.js'

describe('structured AI benchmark plan', () => {
  it('usa sólo casos sintéticos acotados y el schema real de un día', () => {
    expect(STRUCTURED_AI_BENCHMARK_CASES).toHaveLength(3)
    expect(STRUCTURED_AI_BENCHMARK_MAX_TOKENS).toBe(2_200)
    for (const testCase of STRUCTURED_AI_BENCHMARK_CASES) {
      expect(testCase.id).toMatch(/^[a-z0-9-]+$/)
      expect(testCase.selectedClasses.length).toBeGreaterThan(0)
      const request = buildStructuredAiBenchmarkRequest(testCase)
      expect(request.schema).toBe(EVO_DAY_OUTPUT_SCHEMA)
      expect(request.maxTokens).toBe(2_200)
      expect(request.messages[0].content).not.toMatch(/@|\bcliente\b|\bemail\b/i)
    }
  })

  it('falla cerrado ante una salida que no cumple el contrato EVO', () => {
    expect(evaluateStructuredAiBenchmarkOutput(
      { dia: { nombre: 'LUNES' } },
      STRUCTURED_AI_BENCHMARK_CASES[0],
    )).toEqual({ passed: false, score: 0 })
  })
})
