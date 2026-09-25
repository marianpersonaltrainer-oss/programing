const ATTENDANCE = new Set(['vino', 'canceló', 'cambió fecha', 'no vino'])

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function isTimestamp(value) {
  return Boolean(text(value)) && !Number.isNaN(new Date(value).getTime())
}

/**
 * Reduce un cierre protegido al mínimo que Ventas podría revisar en el futuro.
 *
 * Esta función no lee ni escribe una base de datos, no vincula leads y no
 * transmite información. Su propósito es fijar el contrato previo a cualquier
 * conexión entre ProgrammingEVO y la mesa privada de Ventas.
 */
export function toCommercialTrialHandoff(event) {
  const payload = event?.payload
  if (!event || typeof event !== 'object' || !payload || typeof payload !== 'object') return null

  const sourceEventId = text(event.event_id)
  const organizationId = text(event.organization_id)
  const personReference = text(event.external_id)
  const attendance = text(payload.attendance)

  if (
    event.event_type !== 'trial.close.recorded'
    || !sourceEventId
    || !organizationId
    || !personReference
    || !ATTENDANCE.has(attendance)
    || !isTimestamp(event.occurred_at)
  ) return null

  const completed = attendance === 'vino'
  const entryPoint = text(payload.entry_point)
  const priority = text(payload.priority)

  if (completed && (!entryPoint || !priority)) return null

  return {
    schema_version: 1,
    source_event_id: sourceEventId,
    source_occurred_at: new Date(event.occurred_at).toISOString(),
    organization_id: organizationId,
    person_reference: personReference,
    attendance,
    commercial_state: completed ? 'trial_completed_requires_review' : 'trial_not_completed_requires_review',
    manual_lead_link_required: true,
    recommended_entry_point: completed ? entryPoint : null,
    initial_priority: completed ? priority : null,
    excluded_fields: ['coach_id', 'adaptations', 'reason'],
  }
}
