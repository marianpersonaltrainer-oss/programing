import { describe, expect, it, vi } from 'vitest'
import {
  resolveBriefingProposal,
  BRIEFING_OUTPUT_SCHEMA,
} from './programming-week-briefing.js'
import { canRetryBriefingAnthropic } from './lib/briefingTimeBudget.js'

describe('programming-week-briefing handler logic', () => {
  const parseOptions = {
    generationDays: ['LUNES'],
    weeklyOffer: { dias: { LUNES: ['evofuncional'] } },
  }
  const fallbackOptions = {
    mesociclo: 'FUERZA',
    semana: 6,
    generationDays: ['LUNES'],
    weeklyOffer: { dias: { LUNES: ['evofuncional'] } },
    userInstructions: 'Más bisagra',
  }

  it('parsea propuesta válida en una sola pasada', () => {
    const text = JSON.stringify({
      title: 'PROPUESTA S6',
      narrative: 'Semana de consolidación.',
      suggestedFocus: 'Bisagra',
      weeklyArchitecture: [
        {
          day: 'LUNES',
          intent: 'Base técnica',
          classPlans: [{ classKey: 'evofuncional', plan: 'Fuerza + AMRAP corto' }],
          sharedFatigue: 'Lumbar',
          antiRepetition: 'Distinto al martes',
        },
      ],
    })
    const result = resolveBriefingProposal({
      assistantText: text,
      parseOptions,
      fallbackOptions,
      startedAtMs: Date.now(),
      allowAnthropicRetry: true,
    })
    expect(result.source).toBe('anthropic')
    expect(result.proposal.title).toBe('PROPUESTA S6')
  })

  it('usa fallback determinista si no queda presupuesto para retry', () => {
    const startedAt = Date.now() - 120_000
    expect(canRetryBriefingAnthropic(startedAt)).toBe(false)
    const result = resolveBriefingProposal({
      assistantText: 'no-json',
      parseOptions,
      fallbackOptions,
      startedAtMs: startedAt,
      allowAnthropicRetry: true,
    })
    expect(result.source).toBe('deterministic_fallback')
    expect(result.proposal.title).toMatch(/PROPUESTA MANUAL/)
  })

  it('pide retry cuando falla parseo y hay presupuesto', () => {
    const result = resolveBriefingProposal({
      assistantText: '{invalid',
      parseOptions,
      fallbackOptions,
      startedAtMs: Date.now(),
      allowAnthropicRetry: true,
    })
    expect(result.needsRetry).toBe(true)
  })

  it('schema de salida mantiene objetos cerrados', () => {
    expect(BRIEFING_OUTPUT_SCHEMA.additionalProperties).toBe(false)
    expect(BRIEFING_OUTPUT_SCHEMA.required).toContain('weeklyArchitecture')
  })
})
