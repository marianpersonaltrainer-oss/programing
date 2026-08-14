function finiteNonNegative(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

export function normalizeStructuredAiUsage(usage) {
  return {
    inputTokens: finiteNonNegative(usage?.input_tokens ?? usage?.inputTokens),
    outputTokens: finiteNonNegative(usage?.output_tokens ?? usage?.outputTokens),
  }
}

export function estimateStructuredAiCostUsd(usage, pricing) {
  if (!pricing || typeof pricing !== 'object') return null
  const inputPerMillion = Number(pricing.inputPerMillionUsd)
  const outputPerMillion = Number(pricing.outputPerMillionUsd)
  if (!Number.isFinite(inputPerMillion) || !Number.isFinite(outputPerMillion)) return null
  const normalized = normalizeStructuredAiUsage(usage)
  return (
    (normalized.inputTokens * inputPerMillion) / 1_000_000
    + (normalized.outputTokens * outputPerMillion) / 1_000_000
  )
}

function normalizeEvaluation(value) {
  if (typeof value === 'boolean') {
    return { passed: value, score: value ? 1 : 0 }
  }
  const score = Math.max(0, Math.min(1, Number(value?.score) || 0))
  return {
    passed: value?.passed === undefined ? score >= 1 : Boolean(value.passed),
    score,
  }
}

function summarize(records) {
  const grouped = new Map()
  for (const record of records) {
    const current = grouped.get(record.provider) || {
      provider: record.provider,
      cases: 0,
      succeeded: 0,
      contractPasses: 0,
      totalLatencyMs: 0,
      scoredCases: 0,
      qualityScoreTotal: 0,
      estimatedCostUsd: 0,
      hasCostEstimate: false,
    }
    current.cases += 1
    current.succeeded += record.ok ? 1 : 0
    current.contractPasses += record.qualityPassed ? 1 : 0
    current.totalLatencyMs += record.latencyMs
    if (record.qualityScore !== null) {
      current.scoredCases += 1
      current.qualityScoreTotal += record.qualityScore
    }
    if (record.estimatedCostUsd !== null) {
      current.hasCostEstimate = true
      current.estimatedCostUsd += record.estimatedCostUsd
    }
    grouped.set(record.provider, current)
  }

  return [...grouped.values()].map((entry) => ({
    provider: entry.provider,
    cases: entry.cases,
    succeeded: entry.succeeded,
    contractPasses: entry.contractPasses,
    averageLatencyMs: entry.cases ? entry.totalLatencyMs / entry.cases : 0,
    averageQualityScore: entry.scoredCases
      ? entry.qualityScoreTotal / entry.scoredCases
      : null,
    estimatedCostUsd: entry.hasCostEstimate ? entry.estimatedCostUsd : null,
  }))
}

/**
 * Ejecuta casos de comparación sin registrar prompts ni resultados del modelo.
 * Las tarifas se inyectan en el momento del benchmark para evitar precios
 * obsoletos y ninguna implementación se activa como proveedor del producto.
 */
export async function runStructuredAiComparison({
  cases,
  providers,
  evaluate,
  pricingByProvider = {},
  now = Date.now,
}) {
  if (!Array.isArray(cases) || !cases.length) {
    throw new TypeError('cases debe contener al menos un caso de comparación.')
  }
  if (!providers || typeof providers !== 'object' || !Object.keys(providers).length) {
    throw new TypeError('providers debe contener al menos un ejecutor.')
  }
  if (typeof evaluate !== 'function') {
    throw new TypeError('evaluate debe validar la calidad y el contrato.')
  }

  const records = []
  for (const testCase of cases) {
    const caseId = String(testCase?.id || '').trim()
    if (!caseId) throw new TypeError('Cada caso debe tener un id estable.')

    for (const [provider, request] of Object.entries(providers)) {
      if (typeof request !== 'function') {
        throw new TypeError(`El proveedor ${provider} no contiene un ejecutor válido.`)
      }
      const startedAt = Number(now())
      try {
        const result = await request(testCase.request)
        const evaluation = normalizeEvaluation(await evaluate(result?.output, testCase))
        const usage = normalizeStructuredAiUsage(result?.usage)
        records.push({
          caseId,
          provider,
          ok: true,
          qualityPassed: evaluation.passed,
          qualityScore: evaluation.score,
          latencyMs: Math.max(0, Number(now()) - startedAt),
          ...usage,
          estimatedCostUsd: estimateStructuredAiCostUsd(
            result?.usage,
            pricingByProvider?.[provider],
          ),
          errorCode: null,
          retriable: false,
        })
      } catch (error) {
        records.push({
          caseId,
          provider,
          ok: false,
          qualityPassed: false,
          qualityScore: null,
          latencyMs: Math.max(0, Number(now()) - startedAt),
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostUsd: null,
          errorCode: String(error?.code || 'comparison_request_failed').slice(0, 100),
          retriable: Boolean(error?.retriable),
        })
      }
    }
  }

  return {
    records,
    summary: summarize(records),
  }
}
