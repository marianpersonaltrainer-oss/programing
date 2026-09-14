import { normalizeProgrammingHeadCoachInbox } from './programmingHeadCoachInbox.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function validDate(value, code) {
  const date = String(value || '').trim()
  if (!DATE_RE.test(date)) throw new Error(code)
  return date
}

function nonNegativeInteger(value, code) {
  if (!Number.isInteger(value) || value < 0) throw new Error(code)
  return value
}

function safeChangesByClass(rows, feedbackTotal) {
  if (!Array.isArray(rows)) throw new Error('invalid_changes_by_class')
  const normalized = rows.map((row) => ({
    class_label: String(row?.class_label || '').trim(),
    feedback_count: nonNegativeInteger(row?.feedback_count, 'invalid_changes_by_class'),
    changed_count: nonNegativeInteger(row?.changed_count, 'invalid_changes_by_class'),
  }))
  if (normalized.some((row) => row.feedback_count > feedbackTotal || row.changed_count > row.feedback_count)) {
    throw new Error('invalid_changes_by_class')
  }
  return normalized
}

function safeReconciliation(value) {
  const status = String(value?.status || '').trim()
  const unexpectedCount = nonNegativeInteger(
    value?.unexpected_observed_modality_count,
    'invalid_wodbuster_reconciliation',
  )
  if (!['coverage_observed', 'review_required'].includes(status)) {
    throw new Error('invalid_wodbuster_reconciliation')
  }
  if ((status === 'review_required') !== (unexpectedCount > 0)) {
    throw new Error('invalid_wodbuster_reconciliation')
  }
  return { status, unexpected_observed_modality_count: unexpectedCount }
}

/**
 * Construye el único paquete que Head Coach puede poner a disposición del
 * agente programador. Recibe exclusivamente agregados ya filtrados por Atlas;
 * omite texto libre, nombres, señales sensibles y cualquier dato de personas.
 * No almacena ni transmite el resultado.
 */
export function buildHeadCoachProgrammingPacket({
  weekStartDate,
  atlasSummary,
  wodbusterReconciliation,
} = {}) {
  const summary = atlasSummary && typeof atlasSummary === 'object' ? atlasSummary : null
  if (!summary) throw new Error('invalid_atlas_summary')

  const feedbackTotal = nonNegativeInteger(summary.feedback_total, 'invalid_atlas_summary')
  const changedTotal = nonNegativeInteger(summary.changed_total, 'invalid_atlas_summary')
  const notesNextWeekTotal = nonNegativeInteger(summary.notes_next_week_total, 'invalid_atlas_summary')
  if (changedTotal > feedbackTotal || notesNextWeekTotal > feedbackTotal) {
    throw new Error('invalid_atlas_summary')
  }

  const reconciliation = safeReconciliation(wodbusterReconciliation)
  const reviewItems = []
  const manyChanges = summary.many_changes
  if (manyChanges?.triggered === true && Array.isArray(manyChanges.weeks) && manyChanges.weeks.length > 0) {
    reviewItems.push({
      type: 'many_programming_changes_review',
      source: 'trainer_feedback',
      count: manyChanges.weeks.length,
      priority: 'normal',
    })
  }
  if (reconciliation.status === 'review_required') {
    reviewItems.push({
      type: 'programming_wodbuster_unexpected_modality_review',
      source: 'atlas_programming_wodbuster_reconciliation',
      count: reconciliation.unexpected_observed_modality_count,
      priority: 'high',
    })
  }

  return normalizeProgrammingHeadCoachInbox({
    source: 'head_coach_to_programming_agent',
    status: reviewItems.length ? 'review_required' : 'context_ready',
    week_start_date: validDate(weekStartDate, 'invalid_week_start_date'),
    period: {
      start: validDate(summary.period?.start, 'invalid_period'),
      end: validDate(summary.period?.end, 'invalid_period'),
    },
    feedback: {
      feedback_total: feedbackTotal,
      changed_total: changedTotal,
      notes_next_week_total: notesNextWeekTotal,
      changes_by_class: safeChangesByClass(summary.changes_by_class, feedbackTotal),
    },
    review_items: reviewItems,
    wodbuster_reconciliation: reconciliation,
    automatic_programming_changes: false,
    automatic_publication: false,
    external_actions: false,
  })
}
