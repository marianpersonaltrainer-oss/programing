const PUBLICATION_FINGERPRINT_VERSION = 1
export const PUBLICATION_GATE_VERSION = 1
export const PUBLICATION_MIN_SCORE = 80

function normalizeForStableJson(value) {
  if (value == null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (Array.isArray(value)) return value.map(normalizeForStableJson)
  if (typeof value !== 'object') return String(value)

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, normalizeForStableJson(value[key])]),
  )
}

export function stablePublicationJson(value) {
  return JSON.stringify(normalizeForStableJson(value))
}

/**
 * Synchronous, deterministic version stamp. This is not an authentication
 * primitive: it binds an evaluation to the exact editable document/context so
 * stale feedback or an old score cannot be reused after a change.
 */
export function hashPublicationValue(value) {
  const text = typeof value === 'string' ? value : stablePublicationJson(value)
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fp${PUBLICATION_FINGERPRINT_VERSION}-${(hash >>> 0).toString(16).padStart(8, '0')}-${text.length}`
}

function weekDocumentForFingerprint(weekData) {
  if (!weekData || typeof weekData !== 'object') return weekData
  const {
    sheetName: _sheetName,
    publication_meta: _publicationMeta,
    publicationMeta: _publicationMetaLegacy,
    ...document
  } = weekData
  return document
}

export function buildPublicationTargetFingerprint({
  weekData,
  mesocycle,
  week,
  phase = '',
  offer = null,
  contextFingerprint = '',
  methodVersion = '',
}) {
  return hashPublicationValue({
    target: {
      mesocycle: String(mesocycle || weekData?.mesociclo || '').trim(),
      week: Number(week ?? weekData?.semana ?? 0),
      phase: String(phase || weekData?.phase || '').trim(),
    },
    offer: offer || weekData?.oferta_semanal || null,
    contextFingerprint: String(contextFingerprint || ''),
    methodVersion: String(
      methodVersion ||
        weekData?.metodo_evo?.version ||
        weekData?.method_evo?.version ||
        weekData?.method_version ||
        '',
    ),
    document: weekDocumentForFingerprint(weekData),
  })
}

function nonEmptyList(value) {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : []
}

function analyzerStatus(evaluation) {
  return String(evaluation?.validationOutcome?.key || evaluation?.kpi?.status || '').trim().toLowerCase()
}

function analyzerScore(evaluation) {
  const raw = evaluation?.scoreDisplay ?? evaluation?.kpi?.scoreDisplay ?? evaluation?.score
  const score = Number(raw)
  return Number.isFinite(score) ? score : null
}

/**
 * The final gate deliberately requires more than a score:
 * - exact approved state (not "approved with alerts");
 * - no analyzer blockers or pending corrections;
 * - no Method EVO, offer, feedback or context blockers;
 * - evaluation fingerprint equal to the current target fingerprint.
 */
export function buildPublicationQualityGate({
  evaluation,
  evaluationFingerprint,
  targetFingerprint,
  methodErrors = [],
  offerPendingDays = [],
  staleFeedbackKeys = [],
  warmupIssues = [],
  contextReady = true,
  extraBlockers = [],
  validatedAt = new Date().toISOString(),
}) {
  const blockers = [
    ...nonEmptyList(evaluation?.blockingReasons),
    ...nonEmptyList(methodErrors),
    ...nonEmptyList(extraBlockers),
  ]
  const pending = [
    ...nonEmptyList(evaluation?.pendingCorrections),
    ...nonEmptyList(offerPendingDays).map((day) => `Oferta incompleta: ${day}`),
    ...nonEmptyList(staleFeedbackKeys).map((key) => `Feedback desactualizado: ${key}`),
    ...nonEmptyList(warmupIssues).map((issue) => `Sección visible no permitida: ${issue}`),
  ]
  const alerts = nonEmptyList(evaluation?.alerts)
  const score = analyzerScore(evaluation)
  const sourceStatus = analyzerStatus(evaluation)
  const fingerprintMatches =
    !!targetFingerprint && !!evaluationFingerprint && targetFingerprint === evaluationFingerprint

  if (!evaluation) blockers.push('La semana todavía no tiene una evaluación vigente.')
  if (score == null) blockers.push('La evaluación no contiene una puntuación válida.')
  else if (score < PUBLICATION_MIN_SCORE) {
    blockers.push(`La puntuación ${score}/100 está por debajo del mínimo ${PUBLICATION_MIN_SCORE}/100.`)
  }
  if (sourceStatus !== 'aprobado') {
    blockers.push(`El estado de la evaluación debe ser APROBADO; estado actual: ${sourceStatus || 'sin evaluar'}.`)
  }
  if (alerts.length) {
    blockers.push(`La evaluación mantiene ${alerts.length} alerta${alerts.length === 1 ? '' : 's'}.`)
  }
  if (!contextReady) blockers.push('El contexto exacto de ciclo e histórico no está listo.')
  if (!fingerprintMatches) {
    blockers.push('La evaluación no corresponde al contenido, ciclo, oferta o contexto actual.')
  }

  const uniqueBlockers = [...new Set(blockers)]
  const uniquePending = [...new Set(pending)]
  const approved = uniqueBlockers.length === 0 && uniquePending.length === 0

  return {
    version: PUBLICATION_GATE_VERSION,
    status: approved ? 'approved' : 'blocked',
    source_status: sourceStatus || null,
    score,
    blockers: uniqueBlockers,
    pending: uniquePending,
    content_fingerprint: String(targetFingerprint || ''),
    validation_fingerprint: String(evaluationFingerprint || ''),
    validated_at: approved ? validatedAt : null,
  }
}

export function publicationGateIsApproved(gate) {
  return (
    gate?.version === PUBLICATION_GATE_VERSION &&
    gate?.status === 'approved' &&
    Number(gate?.score) >= PUBLICATION_MIN_SCORE &&
    Array.isArray(gate?.blockers) &&
    gate.blockers.length === 0 &&
    Array.isArray(gate?.pending) &&
    gate.pending.length === 0 &&
    !!gate?.content_fingerprint &&
    gate.content_fingerprint === gate?.validation_fingerprint
  )
}

export function assertPublicationGateApproved(gate) {
  if (publicationGateIsApproved(gate)) return gate
  const reasons = [...nonEmptyList(gate?.blockers), ...nonEmptyList(gate?.pending)]
  throw new Error(
    reasons.length
      ? `Publicación bloqueada: ${reasons.slice(0, 8).join(' | ')}`
      : 'Publicación bloqueada: la evaluación vigente no está aprobada.',
  )
}

/** Puerta de publicación directa desde Contenido Coach (decisión admin explícita). */
export function buildAdminCoachDirectPublishGate({
  targetFingerprint,
  validatedAt = new Date().toISOString(),
}) {
  const fingerprint = String(targetFingerprint || '').trim()
  if (!fingerprint) {
    throw new Error('Falta la huella del contenido para publicar.')
  }
  return {
    version: PUBLICATION_GATE_VERSION,
    status: 'approved',
    source_status: 'aprobado',
    score: PUBLICATION_MIN_SCORE,
    blockers: [],
    pending: [],
    content_fingerprint: fingerprint,
    validation_fingerprint: fingerprint,
    validated_at: validatedAt,
  }
}
