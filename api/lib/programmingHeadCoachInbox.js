const CLASS_LABELS = new Set([
  'EvoBasics',
  'EvoFit',
  'EvoFuncional',
  'EvoFuerza',
  'EvoGimnástica',
  'EvoHybrix',
  'EvoTodos',
])

const REVIEW_TYPES = new Set([
  'many_programming_changes_review',
  'programming_structure_review',
  'programming_wodbuster_unexpected_modality_review',
])

const REVIEW_SOURCES = new Set([
  'trainer_feedback',
  'atlas_programming_wodbuster_reconciliation',
])

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function nonNegativeInteger(value, maximum = 500) {
  return Number.isInteger(value) && value >= 0 && value <= maximum
}

function date(value) {
  const normalized = String(value || '').trim()
  if (!DATE_RE.test(normalized)) throw new Error('invalid_date')
  return normalized
}

function object(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(code)
  }
  return value
}

function normalizedClasses(rows, feedbackTotal) {
  if (!Array.isArray(rows) || rows.length > CLASS_LABELS.size) {
    throw new Error('invalid_changes_by_class')
  }
  const seen = new Set()
  return rows.map((row) => {
    const item = object(row, 'invalid_changes_by_class')
    const label = String(item.class_label || '').trim()
    if (
      !CLASS_LABELS.has(label)
      || seen.has(label)
      || !nonNegativeInteger(item.feedback_count)
      || !nonNegativeInteger(item.changed_count)
      || item.feedback_count > feedbackTotal
      || item.changed_count > item.feedback_count
    ) {
      throw new Error('invalid_changes_by_class')
    }
    seen.add(label)
    return {
      class_label: label,
      feedback_count: item.feedback_count,
      changed_count: item.changed_count,
    }
  })
}

function normalizedReviewItems(rows) {
  if (!Array.isArray(rows) || rows.length > REVIEW_TYPES.size) {
    throw new Error('invalid_review_items')
  }
  const seen = new Set()
  return rows.map((row) => {
    const item = object(row, 'invalid_review_items')
    const type = String(item.type || '').trim()
    const source = String(item.source || '').trim()
    const priority = String(item.priority || '').trim()
    if (
      !REVIEW_TYPES.has(type)
      || !REVIEW_SOURCES.has(source)
      || seen.has(type)
      || !nonNegativeInteger(item.count)
      || item.count < 1
      || !['normal', 'high'].includes(priority)
    ) {
      throw new Error('invalid_review_items')
    }
    seen.add(type)
    return { type, source, count: item.count, priority }
  })
}

/**
 * Normaliza el único contrato que puede cruzar el límite Head Coach →
 * Programación. Ignora campos extra y guarda únicamente agregados sin texto
 * libre, nombres, WODs ni datos de clientes.
 */
export function normalizeProgrammingHeadCoachInbox(input) {
  const packet = object(input, 'invalid_packet')
  if (packet.source !== 'head_coach_to_programming_agent') {
    throw new Error('invalid_source')
  }
  const status = String(packet.status || '').trim()
  if (!['review_required', 'context_ready'].includes(status)) {
    throw new Error('invalid_status')
  }
  if (
    packet.automatic_programming_changes !== false
    || packet.automatic_publication !== false
    || packet.external_actions !== false
  ) {
    throw new Error('unsafe_automation_flags')
  }

  const period = object(packet.period, 'invalid_period')
  const feedback = object(packet.feedback, 'invalid_feedback')
  const feedbackTotal = feedback.feedback_total
  const changedTotal = feedback.changed_total
  const notesNextWeekTotal = feedback.notes_next_week_total
  if (
    !nonNegativeInteger(feedbackTotal)
    || !nonNegativeInteger(changedTotal)
    || !nonNegativeInteger(notesNextWeekTotal)
    || changedTotal > feedbackTotal
    || notesNextWeekTotal > feedbackTotal
  ) {
    throw new Error('invalid_feedback')
  }

  const reconciliation = object(
    packet.wodbuster_reconciliation,
    'invalid_wodbuster_reconciliation',
  )
  const reconciliationStatus = String(reconciliation.status || '').trim()
  const unexpectedCount = reconciliation.unexpected_observed_modality_count
  if (
    !['coverage_observed', 'review_required'].includes(reconciliationStatus)
    || !nonNegativeInteger(unexpectedCount, 100)
    || (reconciliationStatus === 'review_required') !== (unexpectedCount > 0)
  ) {
    throw new Error('invalid_wodbuster_reconciliation')
  }

  return {
    source: 'head_coach_to_programming_agent',
    status,
    week_start_date: date(packet.week_start_date),
    period: { start: date(period.start), end: date(period.end) },
    feedback: {
      feedback_total: feedbackTotal,
      changed_total: changedTotal,
      notes_next_week_total: notesNextWeekTotal,
      changes_by_class: normalizedClasses(
        feedback.changes_by_class,
        feedbackTotal,
      ),
    },
    review_items: normalizedReviewItems(packet.review_items),
    wodbuster_reconciliation: {
      status: reconciliationStatus,
      unexpected_observed_modality_count: unexpectedCount,
    },
    automatic_programming_changes: false,
    automatic_publication: false,
    external_actions: false,
  }
}

const reviewLabels = {
  many_programming_changes_review: 'Revisar el patrón de cambios antes del borrador.',
  programming_structure_review: 'Revisar la estructura con el Método EVO antes del borrador.',
  programming_wodbuster_unexpected_modality_review:
    'Contrastar la modalidad observada antes de usarla como referencia.',
}

/** Contexto de servidor para el agente de Programing EVO. */
export function buildProgrammingHeadCoachPrompt(packet) {
  const normalized = normalizeProgrammingHeadCoachInbox(packet)
  const feedback = normalized.feedback
  const changes = feedback.changes_by_class
    .filter((row) => row.changed_count > 0)
    .map((row) => `${row.class_label}: ${row.changed_count}/${row.feedback_count}`)
  const reviewLines = normalized.review_items.map((item) => {
    const label = reviewLabels[item.type] || 'Revisar antes del borrador.'
    return `- ${label} Prioridad: ${item.priority}.`
  })
  if (normalized.wodbuster_reconciliation.status === 'review_required') {
    reviewLines.push(
      `- WodBuster requiere contraste: ${normalized.wodbuster_reconciliation.unexpected_observed_modality_count} modalidad(es) observada(s) fuera de cobertura.`,
    )
  }

  return `
CONTEXTO OPERATIVO VALIDADO — HEAD COACH
Este contexto es agregado y solo sirve para preparar el próximo borrador revisado por una persona. No contiene nombres, comentarios, cuerpos de WOD ni datos de clientes.
Semana de origen: ${normalized.week_start_date}. Periodo agregado: ${normalized.period.start} a ${normalized.period.end}.
Feedback agregado: ${feedback.feedback_total} registros; ${feedback.changed_total} con cambios; ${feedback.notes_next_week_total} con nota para la próxima semana.
Cambios por modalidad: ${changes.length ? changes.join('; ') : 'sin cambios agregados por modalidad.'}
Revisiones pendientes:
${reviewLines.length ? reviewLines.join('\n') : '- Ninguna señal adicional; conserva la revisión humana habitual.'}

REGLAS OBLIGATORIAS PARA ESTE CONTEXTO
- Úsalo como pregunta de revisión, no como una orden de cambiar la programación.
- No inventes causas, personas, detalles ni entrenamientos no incluidos.
- No apliques cambios, no publiques y no des por aprobada una semana.
- Explica qué comprobarías con el Método EVO y presenta cualquier propuesta para aprobación expresa de Marian.
`.trim()
}

export async function loadProgrammingHeadCoachPrompt(supabase) {
  const { data, error } = await supabase
    .from('programming_agent_inbox')
    .select('payload')
    .order('received_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error('programming_head_coach_inbox_unavailable')
  if (!data?.payload) return ''
  return buildProgrammingHeadCoachPrompt(data.payload)
}

export function appendProgrammingHeadCoachPrompt(system, prompt) {
  const base = typeof system === 'string' ? system : ''
  const context = String(prompt || '').trim()
  return context ? `${base}\n\n${context}` : base
}
