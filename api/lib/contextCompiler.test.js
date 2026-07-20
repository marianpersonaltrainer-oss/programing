import { describe, expect, it } from 'vitest'
import { compileMethodRules, compileMethodRulesDegraded, isRuleEligible } from './contextCompiler.js'
import { buildShadowCompilerLog } from './shadowCompilerLog.js'

const baseCtx = {
  task: 'briefing',
  orgId: 'org-evo',
  mesocycleKey: 'fuerza',
  weekNumber: 3,
  date: '2026-07-15',
  dayOfWeek: 3,
  classType: 'evofuncional',
  roomKey: 'sala_a',
}

function rule(overrides) {
  return {
    id: overrides.id ?? 1,
    rule_text: overrides.rule_text ?? 'Texto de regla de prueba.',
    rule_status: 'active',
    rule_validity: 'permanent',
    rule_strength: 'required',
    rule_origin: 'manual',
    rule_key: overrides.rule_key ?? 'warmup_visibility',
    org_id: 'org-evo',
    ...overrides,
  }
}

describe('contextCompiler', () => {
  it('excluye regla temporal fuera de fecha', () => {
    const rules = [
      rule({
        id: 1,
        rule_validity: 'temporary',
        valid_from: '2026-08-01',
        valid_to: '2026-08-31',
        rule_key: 'summer_schedule',
      }),
    ]
    const result = compileMethodRules(rules, baseCtx)
    expect(result.applicableRules).toHaveLength(0)
  })

  it('weekly_exception prevalece sobre permanent en mismo rule_key', () => {
    const rules = [
      rule({
        id: 1,
        rule_key: 'warmup_visibility',
        rule_validity: 'permanent',
        rule_strength: 'preferred',
        rule_text: 'Calentamiento opcional.',
      }),
      rule({
        id: 2,
        rule_key: 'warmup_visibility',
        rule_validity: 'weekly_exception',
        week_number: 3,
        day_of_week: [3],
        rule_strength: 'required',
        rule_text: 'Esta semana calentamiento obligatorio.',
      }),
    ]
    const result = compileMethodRules(rules, baseCtx)
    expect(result.applicableRules).toHaveLength(1)
    expect(result.applicableRules[0].id).toBe(2)
  })

  it('regla Basics no aplica a Fit', () => {
    const rules = [
      rule({
        id: 1,
        rule_key: 'basics_skill_progression',
        class_types: ['evobasics'],
        rule_text: 'Solo Basics.',
      }),
    ]
    const result = compileMethodRules(rules, { ...baseCtx, classType: 'evofit' })
    expect(result.applicableRules).toHaveLength(0)
  })

  it('restricción de sala solo aplica en esa sala', () => {
    const rules = [
      rule({
        id: 1,
        rule_key: 'room_capacity',
        room_key: 'sala_a',
        rule_text: 'Máximo 8 personas.',
      }),
    ]
    const miss = compileMethodRules(rules, { ...baseCtx, roomKey: 'sala_b' })
    expect(miss.applicableRules).toHaveLength(0)
    const hit = compileMethodRules(rules, baseCtx)
    expect(hit.applicableRules).toHaveLength(1)
  })

  it('legacy_unreviewed nunca se aplica', () => {
    const rules = [
      rule({
        id: 99,
        rule_status: 'legacy_unreviewed',
        rule_key: null,
        rule_text: 'Regla legacy sin revisar.',
      }),
    ]
    expect(isRuleEligible(rules[0], baseCtx, rules)).toBe(false)
    const result = compileMethodRules(rules, baseCtx)
    expect(result.applicableRules).toHaveLength(0)
    expect(result.excluded.some((e) => e.reason === 'legacy_unreviewed')).toBe(true)
  })

  it('pending_review y rejected no entran en el prompt', () => {
    for (const status of ['pending_review', 'rejected']) {
      const rules = [rule({ id: 10, rule_status: status, rule_key: 'landmine_frequency' })]
      const result = compileMethodRules(rules, baseCtx)
      expect(result.applicableRules).toHaveLength(0)
    }
  })

  it('regla active necesita rule_key', () => {
    const rules = [rule({ id: 11, rule_key: null })]
    const result = compileMethodRules(rules, baseCtx)
    expect(result.applicableRules).toHaveLength(0)
    expect(result.excluded.some((e) => e.reason === 'active_missing_rule_key')).toBe(true)
  })

  it('corrección aprobada (active) sí puede activarse', () => {
    const rules = [
      rule({
        id: 12,
        rule_status: 'active',
        rule_origin: 'correction',
        rule_key: 'feedback_format',
        rule_text: 'Feedback en prosa corrida.',
      }),
    ]
    const result = compileMethodRules(rules, baseCtx)
    expect(result.applicableRules).toHaveLength(1)
    expect(result.compactPromptText).toContain('feedback_format')
  })

  it('regla archivada no se aplica', () => {
    const rules = [rule({ id: 13, rule_status: 'archived', rule_key: 'landmine_frequency' })]
    const result = compileMethodRules(rules, baseCtx)
    expect(result.applicableRules).toHaveLength(0)
  })

  it('preferencia global no anula prohibición activa', () => {
    const rules = [
      rule({
        id: 20,
        rule_key: 'landmine_frequency',
        rule_strength: 'preferred',
        rule_text: 'Landmine opcional.',
      }),
      rule({
        id: 21,
        rule_key: 'landmine_frequency',
        rule_strength: 'prohibited',
        rule_text: 'No usar landmine esta semana.',
      }),
    ]
    const result = compileMethodRules(rules, baseCtx)
    expect(result.conflicts).toHaveLength(0)
    expect(result.applicableRules).toHaveLength(1)
    expect(result.applicableRules[0].rule_strength).toBe('prohibited')
  })

  it('supersedes_id desactiva la versión anterior', () => {
    const rules = [
      rule({
        id: 30,
        rule_key: 'effective_duration',
        version: 1,
        rule_text: '30 minutos.',
      }),
      rule({
        id: 31,
        rule_key: 'effective_duration',
        version: 2,
        supersedes_id: 30,
        rule_text: '32 minutos en verano.',
        rule_validity: 'temporary',
        valid_from: '2026-07-01',
        valid_to: '2026-08-31',
      }),
    ]
    const result = compileMethodRules(rules, baseCtx)
    expect(result.applicableRules.map((r) => r.id)).toEqual([31])
  })

  it('dos reglas format distinto rule_key no generan conflicto', () => {
    const rules = [
      rule({
        id: 40,
        rule_type: 'format',
        rule_key: 'feedback_format',
        rule_strength: 'required',
        rule_text: 'Prosa corrida.',
      }),
      rule({
        id: 41,
        rule_type: 'format',
        rule_key: 'warmup_purpose',
        rule_strength: 'required',
        rule_text: 'Ensayo del día.',
      }),
    ]
    const result = compileMethodRules(rules, baseCtx)
    expect(result.conflicts).toHaveLength(0)
    expect(result.applicableRules).toHaveLength(2)
  })

  it('dos reglas activas incompatibles mismo rule_key generan conflicto', () => {
    const rules = [
      rule({
        id: 50,
        rule_key: 'warmup_visibility',
        rule_strength: 'required',
        rule_text: 'Calentamiento obligatorio.',
      }),
      rule({
        id: 51,
        rule_key: 'warmup_visibility',
        rule_strength: 'prohibited',
        rule_text: 'Sin bloque calentamiento.',
      }),
    ]
    const result = compileMethodRules(rules, baseCtx)
    expect(result.conflicts).toHaveLength(1)
    expect(result.applicableRules).toHaveLength(0)
  })

  it('fallback degradado si Supabase no responde', () => {
    const result = compileMethodRulesDegraded(new Error('timeout'))
    expect(result.degraded).toBe(true)
    expect(result.applicableRules).toHaveLength(0)
    expect(result.compactPromptText).toBe('')
  })
})

describe('shadowCompilerLog', () => {
  it('no incluye texto completo del método en logs', () => {
    const longText = 'X'.repeat(500)
    const compileResult = compileMethodRules(
      [
        rule({
          id: 1,
          rule_text: longText,
        }),
      ],
      baseCtx,
    )
    const log = buildShadowCompilerLog(compileResult, baseCtx)
    const serialized = JSON.stringify(log)
    expect(serialized).not.toContain(longText)
    expect(log.applicable[0].textPreview.length).toBeLessThanOrEqual(49)
    expect(log.compactPromptCharCount).toBeGreaterThan(0)
    expect(serialized).not.toContain('REGLAS MÉTODO')
  })
})
