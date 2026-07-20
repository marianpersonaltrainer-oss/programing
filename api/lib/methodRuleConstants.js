/** Valores permitidos para las dimensiones de method_rules (Sprint 1). */

export const RULE_STATUSES = Object.freeze([
  'legacy_unreviewed',
  'pending_review',
  'active',
  'rejected',
  'archived',
  'superseded',
])

export const RULE_VALIDITIES = Object.freeze(['permanent', 'temporary', 'weekly_exception'])

export const RULE_STRENGTHS = Object.freeze(['required', 'preferred', 'avoid', 'prohibited'])

export const RULE_ORIGINS = Object.freeze([
  'manual',
  'correction',
  'system_prompt',
  'method_panel',
  'migrated',
  'coach_feedback',
])

/** Estados excluidos del Context Compiler. */
export const COMPILER_EXCLUDED_STATUSES = Object.freeze([
  'legacy_unreviewed',
  'pending_review',
  'rejected',
  'archived',
  'superseded',
])

/** Claves temáticas conocidas (referencia; no exhaustivo). */
export const KNOWN_RULE_KEYS = Object.freeze([
  'warmup_visibility',
  'warmup_purpose',
  'landmine_frequency',
  'feedback_format',
  'effective_duration',
  'basics_skill_progression',
  'room_capacity',
  'summer_schedule',
  'muscle_pattern_rotation',
  'cross_class_harmony',
  'exercise_variety',
])

/** Orden de fuerza: mayor número gana en empate de especificidad. */
export const STRENGTH_RANK = Object.freeze({
  prohibited: 4,
  required: 3,
  avoid: 2,
  preferred: 1,
})

/** Pares de fuerzas incompatibles al mismo nivel de especificidad. */
export const INCOMPATIBLE_STRENGTH_PAIRS = Object.freeze([
  ['required', 'prohibited'],
  ['required', 'avoid'],
])
