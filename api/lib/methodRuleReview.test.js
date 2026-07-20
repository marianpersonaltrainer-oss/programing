import { describe, expect, it } from 'vitest'
import {
  groupMethodRulesForReview,
  validateMethodRuleReviewCommand,
} from './methodRuleReview.js'

function legacy(id, ruleText, overrides = {}) {
  return {
    id,
    rule_text: ruleText,
    rule_type: 'format',
    trigger_context: 'edicion_sesion',
    rule_status: 'legacy_unreviewed',
    confidence: 80,
    ...overrides,
  }
}

describe('Centro de revisión — agrupación', () => {
  it('agrupa 53 legacy sin activar ninguna', () => {
    const rows = Array.from({ length: 53 }, (_, index) =>
      legacy(index + 1, `Usar landmine con intención ${index + 1}`),
    )
    const result = groupMethodRulesForReview(rows)

    expect(result.summary.total).toBe(53)
    expect(result.summary.legacy_unreviewed).toBe(53)
    expect(result.summary.active).toBe(0)
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].ruleKey).toBe('landmine_frequency')
    expect(result.groups[0].sourceIds).toHaveLength(53)
  })

  it('separa temas conocidos y deja lo desconocido sin rule_key propuesto', () => {
    const result = groupMethodRulesForReview([
      legacy(1, 'No mostrar el calentamiento en la programación'),
      legacy(2, 'Hacer 4-5 barras en sala II'),
      legacy(3, 'Una preferencia muy específica sin palabras conocidas', {
        rule_type: 'load',
        trigger_context: 'carga_especial',
      }),
    ])

    expect(result.groups.map((group) => group.ruleKey)).toContain('warmup_visibility')
    expect(result.groups.map((group) => group.ruleKey)).toContain('room_capacity')
    const unclassified = result.groups.find((group) => group.ruleKey === null)
    expect(unclassified.defaultDraft.ruleKey).toBe('')
  })

  it('mantiene pending_review excluida del recuento active', () => {
    const result = groupMethodRulesForReview([
      legacy(1, 'Tiempo efectivo de 30-32 minutos'),
      legacy(2, 'Propuesta canónica', {
        rule_status: 'pending_review',
        rule_key: 'effective_duration',
        rule_validity: 'permanent',
        rule_strength: 'required',
      }),
    ])

    expect(result.summary.pending_review).toBe(1)
    expect(result.summary.active).toBe(0)
    expect(result.groups[0].defaultDraft.canonicalId).toBe(2)
  })

  it('permite revisar una corrección pending sin fuentes legacy', () => {
    const result = groupMethodRulesForReview([
      legacy(9, 'Feedback operativo', {
        rule_status: 'pending_review',
        rule_key: 'feedback_format',
        rule_validity: 'permanent',
        rule_strength: 'required',
      }),
    ])

    expect(result.groups[0].defaultDraft.canonicalId).toBe(9)
    expect(result.groups[0].sourceIds).toEqual([9])
  })

  it('marca contradicciones conocidas sin resolverlas automáticamente', () => {
    const result = groupMethodRulesForReview([
      legacy(1, 'Landmine obligatorio'),
      legacy(2, 'Landmine opcional'),
    ])
    expect(result.summary.conflicts).toBe(1)
    expect(result.groups[0].conflict).toMatch(/discrepan/i)
    expect(result.summary.active).toBe(0)
  })
})

describe('Centro de revisión — órdenes', () => {
  const valid = {
    action: 'approve',
    sourceIds: [1, 2],
    confirmation: 'ACTIVAR_REGLA',
    ruleKey: 'effective_duration',
    ruleText: 'Programar 30–32 minutos efectivos.',
    ruleType: 'timing',
    validity: 'permanent',
    strength: 'required',
  }

  it('exige confirmación explícita para activar', () => {
    expect(validateMethodRuleReviewCommand({ ...valid, confirmation: '' })).toMatchObject({
      ok: false,
      error: 'approval_confirmation_required',
    })
  })

  it('normaliza una aprobación válida', () => {
    const result = validateMethodRuleReviewCommand(valid)
    expect(result.ok).toBe(true)
    expect(result.value).toMatchObject({
      action: 'approve',
      sourceIds: [1, 2],
      ruleKey: 'effective_duration',
      validity: 'permanent',
    })
  })

  it('rechaza una regla temporal sin fechas', () => {
    expect(validateMethodRuleReviewCommand({ ...valid, validity: 'temporary' })).toMatchObject({
      ok: false,
      error: 'temporary_window_required',
    })
  })

  it('rechaza un rule_key inválido', () => {
    expect(validateMethodRuleReviewCommand({ ...valid, ruleKey: 'Con espacios' })).toMatchObject({
      ok: false,
      error: 'invalid_rule_key',
    })
  })

  it('exige confirmación separada para rechazar', () => {
    expect(
      validateMethodRuleReviewCommand({ action: 'reject', sourceIds: [1], confirmation: 'ACTIVAR_REGLA' }),
    ).toMatchObject({ ok: false, error: 'rejection_confirmation_required' })
  })

  it('no admite órdenes sin fuentes', () => {
    expect(validateMethodRuleReviewCommand({ ...valid, sourceIds: [] })).toMatchObject({
      ok: false,
      error: 'invalid_source_ids',
    })
  })
})
