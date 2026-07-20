/**
 * Context Compiler — selección de reglas method_rules para contexto IA.
 * Solo incluye rule_status = active. Módulo interno de servidor (Sprint 1).
 */

import {
  COMPILER_EXCLUDED_STATUSES,
  INCOMPATIBLE_STRENGTH_PAIRS,
  STRENGTH_RANK,
} from './methodRuleConstants.js'

/** @typedef {import('./methodRuleConstants.js').RULE_STATUSES[number]} RuleStatus */

/**
 * @typedef {Object} MethodRuleRow
 * @property {number|string} id
 * @property {string} rule_text
 * @property {RuleStatus} [rule_status]
 * @property {string|null} [rule_validity]
 * @property {string|null} [rule_strength]
 * @property {string|null} [rule_origin]
 * @property {string|null} [rule_key]
 * @property {string|null} [org_id]
 * @property {string|null} [season_key]
 * @property {string|null} [mesocycle_key]
 * @property {number|null} [week_number]
 * @property {string|null} [valid_from]
 * @property {string|null} [valid_to]
 * @property {number[]|null} [day_of_week]
 * @property {string[]|null} [class_types]
 * @property {string|null} [room_key]
 * @property {string|null} [time_slot]
 * @property {number|null} [priority]
 * @property {number|null} [version]
 * @property {number|string|null} [supersedes_id]
 * @property {string|null} [rule_type]
 * @property {boolean} [active]
 */

/**
 * @typedef {Object} CompileContext
 * @property {string} [task]
 * @property {string|null} [orgId]
 * @property {string|null} [mesocycleKey]
 * @property {number|null} [weekNumber]
 * @property {string|null} [date]
 * @property {number|null} [dayOfWeek]
 * @property {string|null} [classType]
 * @property {string|null} [roomKey]
 * @property {string|null} [timeSlot]
 * @property {string|null} [seasonKey]
 * @property {string|null} [phase]
 */

const DAY_NAMES = Object.freeze({
  1: 'lunes',
  2: 'martes',
  3: 'miercoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sabado',
  7: 'domingo',
})

function norm(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function parseIsoDate(iso) {
  if (!iso) return null
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function contextDayOfWeek(ctx) {
  if (Number.isFinite(ctx.dayOfWeek)) return ctx.dayOfWeek
  const d = parseIsoDate(ctx.date)
  if (!d) return null
  const js = d.getDay()
  return js === 0 ? 7 : js
}

function matchesOrg(rule, ctx) {
  if (!rule.org_id) return true
  if (!ctx.orgId) return false
  return String(rule.org_id) === String(ctx.orgId)
}

function matchesSeason(rule, ctx) {
  if (!rule.season_key) return true
  if (!ctx.seasonKey) return false
  return norm(rule.season_key) === norm(ctx.seasonKey)
}

function matchesMesocycle(rule, ctx) {
  if (!rule.mesocycle_key) return true
  if (!ctx.mesocycleKey) return false
  return norm(rule.mesocycle_key) === norm(ctx.mesocycleKey)
}

function matchesWeek(rule, ctx) {
  if (rule.week_number == null) return true
  if (!Number.isFinite(ctx.weekNumber)) return false
  return Number(rule.week_number) === Number(ctx.weekNumber)
}

function matchesDay(rule, ctx) {
  if (!Array.isArray(rule.day_of_week) || !rule.day_of_week.length) return true
  const dow = contextDayOfWeek(ctx)
  if (!Number.isFinite(dow)) return false
  return rule.day_of_week.includes(dow)
}

function matchesClass(rule, ctx) {
  if (!Array.isArray(rule.class_types) || !rule.class_types.length) return true
  if (!ctx.classType) return false
  const c = norm(ctx.classType)
  return rule.class_types.some((t) => norm(t) === c)
}

function matchesRoom(rule, ctx) {
  if (!rule.room_key) return true
  if (!ctx.roomKey) return false
  return norm(rule.room_key) === norm(ctx.roomKey)
}

function matchesTimeSlot(rule, ctx) {
  if (!rule.time_slot) return true
  if (!ctx.timeSlot) return false
  return norm(rule.time_slot) === norm(ctx.timeSlot)
}

function matchesValidityWindow(rule, ctx) {
  const validity = rule.rule_validity || 'permanent'
  const ctxDate = parseIsoDate(ctx.date)
  const dow = contextDayOfWeek(ctx)

  if (validity === 'permanent') return true

  if (validity === 'temporary') {
    const from = rule.valid_from ? parseIsoDate(rule.valid_from) : null
    const to = rule.valid_to ? parseIsoDate(rule.valid_to) : null
    if (!ctxDate) return from == null && to == null
    if (from && ctxDate < from) return false
    if (to && ctxDate > to) return false
    return true
  }

  if (validity === 'weekly_exception') {
    const from = rule.valid_from ? parseIsoDate(rule.valid_from) : null
    const to = rule.valid_to ? parseIsoDate(rule.valid_to) : null
    if ((from || to) && !ctxDate) return false
    if (from && ctxDate < from) return false
    if (to && ctxDate > to) return false
    if (!matchesWeek(rule, ctx)) return false
    if (Array.isArray(rule.day_of_week) && rule.day_of_week.length && Number.isFinite(dow)) {
      return rule.day_of_week.includes(dow)
    }
    return true
  }

  return true
}

/** Regla activa que coincide con el contexto, sin resolver supersesión. */
function isRuleBaseEligible(rule, ctx) {
  if (!rule || typeof rule !== 'object') return false
  if (rule.rule_status !== 'active') return false
  if (COMPILER_EXCLUDED_STATUSES.includes(rule.rule_status)) return false
  if (!rule.rule_key) return false

  if (!matchesOrg(rule, ctx)) return false
  if (!matchesSeason(rule, ctx)) return false
  if (!matchesMesocycle(rule, ctx)) return false
  if (!matchesWeek(rule, ctx)) return false
  if (!matchesDay(rule, ctx)) return false
  if (!matchesClass(rule, ctx)) return false
  if (!matchesRoom(rule, ctx)) return false
  if (!matchesTimeSlot(rule, ctx)) return false
  if (!matchesValidityWindow(rule, ctx)) return false

  return true
}

function isSupersededTarget(rule, eligibleRules) {
  const id = rule.id
  return eligibleRules.some(
    (r) => r.supersedes_id != null && String(r.supersedes_id) === String(id),
  )
}

/** Regla activa elegible para el contexto (incluye supersesión vigente). */
export function isRuleEligible(rule, ctx, allRules = []) {
  if (!isRuleBaseEligible(rule, ctx)) return false
  const eligibleRules = allRules.filter((candidate) => isRuleBaseEligible(candidate, ctx))
  return !isSupersededTarget(rule, eligibleRules)
}

function validityTier(rule) {
  const v = rule.rule_validity || 'permanent'
  if (v === 'weekly_exception') return 3
  if (v === 'temporary') return 2
  return 1
}

function specificityScore(rule, ctx) {
  let score = 0
  if (rule.time_slot) score += 128
  if (rule.room_key) score += 64
  if (Array.isArray(rule.class_types) && rule.class_types.length) score += 32
  if (Array.isArray(rule.day_of_week) && rule.day_of_week.length) score += 16
  if (rule.week_number != null) score += 8
  if (rule.mesocycle_key) score += 4
  if (rule.season_key) score += 2
  if (rule.org_id) score += 1
  void ctx
  return score
}

function strengthRank(rule) {
  return STRENGTH_RANK[rule.rule_strength] || 0
}

function compareRules(a, b, ctx) {
  const vtA = validityTier(a)
  const vtB = validityTier(b)
  if (vtA !== vtB) return vtB - vtA

  const spA = specificityScore(a, ctx)
  const spB = specificityScore(b, ctx)
  if (spA !== spB) return spB - spA

  const stA = strengthRank(a)
  const stB = strengthRank(b)
  if (stA !== stB) return stB - stA

  const prA = Number(a.priority) || 100
  const prB = Number(b.priority) || 100
  if (prA !== prB) return prA - prB

  const verA = Number(a.version) || 1
  const verB = Number(b.version) || 1
  return verB - verA
}

function strengthsIncompatible(a, b) {
  const sa = a.rule_strength
  const sb = b.rule_strength
  if (!sa || !sb) return false
  return INCOMPATIBLE_STRENGTH_PAIRS.some(
    ([x, y]) => (sa === x && sb === y) || (sa === y && sb === x),
  )
}

/**
 * @param {MethodRuleRow[]} rules
 * @param {CompileContext} ctx
 */
export function compileMethodRules(rules, ctx) {
  const input = Array.isArray(rules) ? rules : []
  const eligibleBeforeSupersession = input.filter((r) => isRuleBaseEligible(r, ctx))
  const eligible = eligibleBeforeSupersession.filter(
    (rule) => !isSupersededTarget(rule, eligibleBeforeSupersession),
  )

  /** @type {Map<string, MethodRuleRow[]>} */
  const byKey = new Map()
  for (const r of eligible) {
    const k = norm(r.rule_key)
    if (!byKey.has(k)) byKey.set(k, [])
    byKey.get(k).push(r)
  }

  /** @type {MethodRuleRow[]} */
  const applicableRules = []
  /** @type {Array<{ ruleKey: string, ruleIds: (number|string)[], strengths: string[], reason: string }>} */
  const conflicts = []
  /** @type {Array<{ id: number|string, ruleKey: string|null, reason: string }>} */
  const excluded = []

  for (const rule of input) {
    if (rule.rule_status === 'legacy_unreviewed') {
      excluded.push({ id: rule.id, ruleKey: rule.rule_key || null, reason: 'legacy_unreviewed' })
    } else if (COMPILER_EXCLUDED_STATUSES.includes(rule.rule_status)) {
      excluded.push({ id: rule.id, ruleKey: rule.rule_key || null, reason: rule.rule_status })
    } else if (rule.rule_status === 'active' && !rule.rule_key) {
      excluded.push({ id: rule.id, ruleKey: null, reason: 'active_missing_rule_key' })
    }
  }

  for (const [ruleKey, group] of byKey) {
    const sorted = [...group].sort((a, b) => compareRules(a, b, ctx))
    const top = sorted[0]
    const second = sorted[1]

    if (
      second &&
      validityTier(top) === validityTier(second) &&
      specificityScore(top, ctx) === specificityScore(second, ctx) &&
      strengthsIncompatible(top, second)
    ) {
      conflicts.push({
        ruleKey,
        ruleIds: [top.id, second.id],
        strengths: [top.rule_strength, second.rule_strength].filter(Boolean),
        reason: 'incompatible_strength_same_specificity',
      })
      continue
    }

    applicableRules.push(top)
  }

  applicableRules.sort((a, b) => compareRules(a, b, ctx))

  const provenance = applicableRules.map((r) => ({
    ruleId: r.id,
    ruleKey: r.rule_key,
    origin: r.rule_origin || null,
    version: r.version ?? 1,
    strength: r.rule_strength || null,
    validity: r.rule_validity || 'permanent',
    specificity: specificityScore(r, ctx),
  }))

  const compactPromptText = buildCompactPrompt(applicableRules)

  return {
    applicableRules,
    provenance,
    conflicts,
    compactPromptText,
    excluded,
    metrics: {
      inputCount: input.length,
      eligibleCount: eligible.length,
      applicableCount: applicableRules.length,
      conflictCount: conflicts.length,
      excludedCount: excluded.length,
    },
    degraded: false,
  }
}

function buildCompactPrompt(rules) {
  if (!rules.length) return ''
  const lines = rules.map((r) => {
    const strength = r.rule_strength ? `[${r.rule_strength}]` : ''
    const validity = r.rule_validity && r.rule_validity !== 'permanent' ? `(${r.rule_validity})` : ''
    return `- ${strength}${validity} ${r.rule_key}: ${String(r.rule_text || '').trim()}`
  })
  return ['REGLAS MÉTODO (compiladas):', ...lines].join('\n')
}

/**
 * Fallback seguro si Supabase no responde.
 */
export function compileMethodRulesDegraded(error) {
  return {
    applicableRules: [],
    provenance: [],
    conflicts: [],
    compactPromptText: '',
    excluded: [],
    metrics: {
      inputCount: 0,
      eligibleCount: 0,
      applicableCount: 0,
      conflictCount: 0,
      excludedCount: 0,
    },
    degraded: true,
    error: error ? String(error.message || error) : 'unknown',
  }
}

export { DAY_NAMES, specificityScore, compareRules, validityTier }
