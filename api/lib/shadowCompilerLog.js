/**
 * Logging seguro para modo sombra del Context Compiler.
 * No registra rule_text completo ni bloques del Método Evolution.
 */

const MAX_PREVIEW = 48

function preview(text) {
  const s = String(text || '').trim()
  if (!s) return ''
  if (s.length <= MAX_PREVIEW) return s
  return `${s.slice(0, MAX_PREVIEW)}…`
}

/**
 * @param {object} compileResult — salida de compileMethodRules
 * @param {object} ctx — contexto de compilación (sin datos sensibles extra)
 */
export function buildShadowCompilerLog(compileResult, ctx = {}) {
  const r = compileResult || {}
  return {
    mode: 'shadow',
    task: ctx.task || null,
    orgId: ctx.orgId || null,
    mesocycleKey: ctx.mesocycleKey || null,
    weekNumber: ctx.weekNumber ?? null,
    classType: ctx.classType || null,
    degraded: !!r.degraded,
    metrics: r.metrics || {},
    applicable: (r.applicableRules || []).map((rule) => ({
      id: rule.id,
      ruleKey: rule.rule_key || null,
      strength: rule.rule_strength || null,
      validity: rule.rule_validity || null,
      version: rule.version ?? 1,
      textPreview: preview(rule.rule_text),
    })),
    conflicts: (r.conflicts || []).map((c) => ({
      ruleKey: c.ruleKey,
      ruleIds: c.ruleIds,
      strengths: c.strengths,
      reason: c.reason,
    })),
    excludedSummary: summarizeExcluded(r.excluded || []),
    compactPromptCharCount: String(r.compactPromptText || '').length,
  }
}

function summarizeExcluded(excluded) {
  /** @type {Record<string, number>} */
  const counts = {}
  for (const e of excluded) {
    const reason = e.reason || 'unknown'
    counts[reason] = (counts[reason] || 0) + 1
  }
  return counts
}

export function logShadowCompilerComparison(logPayload) {
  console.info('[ProgramingEvo][ContextCompiler][shadow]', JSON.stringify(logPayload))
}

export function isShadowCompilerEnabled() {
  const v = String(process.env.CONTEXT_COMPILER_SHADOW_MODE || '')
    .trim()
    .toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}
