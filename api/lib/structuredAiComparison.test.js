import { describe, expect, it, vi } from 'vitest'
import {
  estimateStructuredAiCostUsd,
  runStructuredAiComparison,
} from './structuredAiComparison.js'

describe('structured AI comparison', () => {
  it('calcula métricas comparables sin incluir prompts ni outputs', async () => {
    const timeline = [0, 120, 120, 200]
    const now = vi.fn(() => timeline.shift())
    const result = await runStructuredAiComparison({
      cases: [{ id: 'lunes-fuerza', request: { prompt: 'sensible' } }],
      providers: {
        anthropic: vi.fn().mockResolvedValue({
          output: { dia: { nombre: 'LUNES' } },
          usage: { input_tokens: 1_000, output_tokens: 500 },
        }),
        openai: vi.fn().mockResolvedValue({
          output: { dia: { nombre: 'LUNES' } },
          usage: { input_tokens: 900, output_tokens: 400 },
        }),
      },
      evaluate: (output) => ({
        passed: output?.dia?.nombre === 'LUNES',
        score: 0.9,
        issueCodes: ['VAL-TEST-001', 'VAL-TEST-001'],
      }),
      pricingByProvider: {
        anthropic: { inputPerMillionUsd: 3, outputPerMillionUsd: 15 },
        openai: { inputPerMillionUsd: 2, outputPerMillionUsd: 8 },
      },
      now,
    })

    expect(result.records).toHaveLength(2)
    expect(result.records[0]).toMatchObject({
      caseId: 'lunes-fuerza',
      provider: 'anthropic',
      ok: true,
      qualityPassed: true,
      qualityScore: 0.9,
      latencyMs: 120,
      inputTokens: 1_000,
      outputTokens: 500,
      qualityIssueCodes: ['VAL-TEST-001'],
    })
    expect(result.records[0].estimatedCostUsd).toBeCloseTo(0.0105, 8)
    expect(result.records[0]).not.toHaveProperty('request')
    expect(result.records[0]).not.toHaveProperty('output')
    expect(result.summary).toEqual([
      expect.objectContaining({ provider: 'anthropic', contractPasses: 1 }),
      expect.objectContaining({ provider: 'openai', contractPasses: 1 }),
    ])
  })

  it('registra fallos normalizados y continúa con el resto del benchmark', async () => {
    const result = await runStructuredAiComparison({
      cases: [{ id: 'case-1', request: {} }],
      providers: {
        anthropic: vi.fn().mockRejectedValue(
          Object.assign(new Error('timeout'), {
            code: 'upstream_timeout',
            retriable: true,
          }),
        ),
        openai: vi.fn().mockResolvedValue({ output: { ok: true }, usage: null }),
      },
      evaluate: () => true,
      now: () => 10,
    })

    expect(result.records[0]).toMatchObject({
      provider: 'anthropic',
      ok: false,
      errorCode: 'upstream_timeout',
      retriable: true,
    })
    expect(result.records[1]).toMatchObject({
      provider: 'openai',
      ok: true,
      qualityPassed: true,
      qualityIssueCodes: [],
    })
  })

  it('no inventa costes cuando no se proporcionan tarifas actuales', () => {
    expect(estimateStructuredAiCostUsd({ input_tokens: 10 }, null)).toBeNull()
  })
})
