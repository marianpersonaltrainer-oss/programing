const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TYPE_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/
const SOURCE_PATTERN = /^[a-z][a-z0-9_-]+$/
const EVIDENCE_KIND_PATTERN = /^[a-z][a-z0-9_]*$/

export const EVO_TASK_STATUSES = Object.freeze({
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  BLOCKED: 'blocked',
  CLOSED_WITH_INCIDENT: 'closed_with_incident',
})

export const EVO_DATA_CLASSES = Object.freeze(['P0', 'P1', 'P2', 'P3', 'P4'])

const TASK_FIELDS = new Set([
  'task_id',
  'task_type',
  'source',
  'organization_id',
  'subject_person_id',
  'assignee_id',
  'status',
  'summary',
  'data_class',
  'due_at',
  'completed_at',
  'evidence',
  'schema_version',
  'idempotency_key',
  'correlation_id',
  'causation_event_id',
  'created_at',
  'updated_at',
])

const EVIDENCE_FIELDS = new Set([
  'evidence_id',
  'kind',
  'reference_id',
  'data_class',
  'recorded_at',
  'recorded_by_id',
])

const TASK_STATUS_SET = new Set(Object.values(EVO_TASK_STATUSES))
const DATA_CLASS_RANK = new Map(EVO_DATA_CLASSES.map((value, index) => [value, index]))
const STATUSES_REQUIRING_ASSIGNMENT = new Set([
  EVO_TASK_STATUSES.ASSIGNED,
  EVO_TASK_STATUSES.IN_PROGRESS,
  EVO_TASK_STATUSES.COMPLETED,
  EVO_TASK_STATUSES.BLOCKED,
  EVO_TASK_STATUSES.CLOSED_WITH_INCIDENT,
])
const STATUSES_REQUIRING_EVIDENCE = new Set([
  EVO_TASK_STATUSES.COMPLETED,
  EVO_TASK_STATUSES.CLOSED_WITH_INCIDENT,
])

export class EvoTaskContractError extends Error {
  constructor(errors) {
    super(`invalid_evo_task: ${errors.join(', ')}`)
    this.name = 'EvoTaskContractError'
    this.code = 'invalid_evo_task'
    this.errors = [...errors]
  }
}

function isPlainObject(value) {
  if (value == null || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function normalizeOptionalString(value) {
  if (value == null) return null
  return typeof value === 'string' ? value.trim() : value
}

function normalizeTimestamp(value) {
  if (value == null) return null
  if (typeof value !== 'string' || !value.trim()) return value
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? value : timestamp.toISOString()
}

function deepFreeze(value) {
  if (value == null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

function validateUuid(value, field, errors, { nullable = false } = {}) {
  if (nullable && value == null) return
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    errors.push(`${field}:invalid_uuid`)
  }
}

function validateTimestamp(value, field, errors, { nullable = false } = {}) {
  if (nullable && value == null) return
  if (
    typeof value !== 'string'
    || !value.trim()
    || Number.isNaN(new Date(value).getTime())
  ) {
    errors.push(`${field}:invalid_timestamp`)
  }
}

function validateText(value, field, errors, { min, max, pattern } = {}) {
  if (typeof value !== 'string') {
    errors.push(`${field}:must_be_string`)
    return
  }
  if (value.length < min || value.length > max) {
    errors.push(`${field}:invalid_length`)
  }
  if (pattern && !pattern.test(value)) errors.push(`${field}:invalid_format`)
}

function validateDataClass(value, field, errors) {
  if (!DATA_CLASS_RANK.has(value)) errors.push(`${field}:invalid_data_class`)
}

function validateEvidence(item, index, errors) {
  const path = `evidence[${index}]`
  if (!isPlainObject(item)) {
    errors.push(`${path}:must_be_plain_object`)
    return
  }
  for (const field of Object.keys(item)) {
    if (!EVIDENCE_FIELDS.has(field)) errors.push(`${path}.${field}:unknown_field`)
  }
  validateUuid(item.evidence_id, `${path}.evidence_id`, errors)
  validateText(item.kind, `${path}.kind`, errors, {
    min: 2,
    max: 64,
    pattern: EVIDENCE_KIND_PATTERN,
  })
  validateText(item.reference_id, `${path}.reference_id`, errors, {
    min: 1,
    max: 240,
  })
  validateDataClass(item.data_class, `${path}.data_class`, errors)
  validateTimestamp(item.recorded_at, `${path}.recorded_at`, errors)
  validateUuid(item.recorded_by_id, `${path}.recorded_by_id`, errors, {
    nullable: true,
  })
}

function normalizeEvidence(item, { dataClass, generateId, now }) {
  if (!isPlainObject(item)) return item
  return {
    ...item,
    evidence_id: normalizeOptionalString(item?.evidence_id) || generateId(),
    kind: normalizeOptionalString(item?.kind),
    reference_id: normalizeOptionalString(item?.reference_id),
    data_class: normalizeOptionalString(item?.data_class) || dataClass,
    recorded_at: normalizeTimestamp(item?.recorded_at) || now().toISOString(),
    recorded_by_id: normalizeOptionalString(item?.recorded_by_id),
  }
}

function timestampValue(value) {
  if (typeof value !== 'string') return Number.NaN
  return new Date(value).getTime()
}

export function validateEvoTaskEnvelope(input) {
  const errors = []
  if (!isPlainObject(input)) {
    return { ok: false, errors: ['task:must_be_plain_object'] }
  }

  for (const field of Object.keys(input)) {
    if (!TASK_FIELDS.has(field)) errors.push(`${field}:unknown_field`)
  }

  validateUuid(input.task_id, 'task_id', errors)
  validateText(input.task_type, 'task_type', errors, {
    min: 3,
    max: 160,
    pattern: TYPE_PATTERN,
  })
  validateText(input.source, 'source', errors, {
    min: 2,
    max: 64,
    pattern: SOURCE_PATTERN,
  })
  validateUuid(input.organization_id, 'organization_id', errors)
  validateUuid(input.subject_person_id, 'subject_person_id', errors, {
    nullable: true,
  })
  validateUuid(input.assignee_id, 'assignee_id', errors, { nullable: true })
  validateText(input.summary, 'summary', errors, { min: 1, max: 240 })
  validateDataClass(input.data_class, 'data_class', errors)
  validateTimestamp(input.due_at, 'due_at', errors, { nullable: true })
  validateTimestamp(input.completed_at, 'completed_at', errors, { nullable: true })
  validateTimestamp(input.created_at, 'created_at', errors)
  validateTimestamp(input.updated_at, 'updated_at', errors)
  validateText(input.idempotency_key, 'idempotency_key', errors, {
    min: 1,
    max: 240,
  })
  validateUuid(input.correlation_id, 'correlation_id', errors)
  validateUuid(input.causation_event_id, 'causation_event_id', errors, {
    nullable: true,
  })

  if (!TASK_STATUS_SET.has(input.status)) errors.push('status:invalid_status')
  if (
    !Number.isInteger(input.schema_version)
    || input.schema_version < 1
    || input.schema_version > 2147483647
  ) {
    errors.push('schema_version:invalid_version')
  }

  if (!Array.isArray(input.evidence)) {
    errors.push('evidence:must_be_array')
  } else {
    if (input.evidence.length > 20) errors.push('evidence:too_many_items')
    input.evidence.forEach((item, index) => validateEvidence(item, index, errors))
  }

  if (STATUSES_REQUIRING_ASSIGNMENT.has(input.status)) {
    if (input.assignee_id == null) errors.push('assignee_id:required_for_status')
    if (input.due_at == null) errors.push('due_at:required_for_status')
  }
  if (STATUSES_REQUIRING_EVIDENCE.has(input.status) && input.evidence?.length === 0) {
    errors.push('evidence:required_for_status')
  }
  if (input.status === EVO_TASK_STATUSES.COMPLETED) {
    if (input.completed_at == null) errors.push('completed_at:required_for_completed_status')
  } else if (input.completed_at != null) {
    errors.push('completed_at:only_for_completed_status')
  }

  const createdAt = timestampValue(input.created_at)
  const updatedAt = timestampValue(input.updated_at)
  const dueAt = timestampValue(input.due_at)
  const completedAt = timestampValue(input.completed_at)
  if (Number.isFinite(createdAt) && Number.isFinite(updatedAt) && updatedAt < createdAt) {
    errors.push('updated_at:before_created_at')
  }
  if (Number.isFinite(createdAt) && Number.isFinite(dueAt) && dueAt < createdAt) {
    errors.push('due_at:before_created_at')
  }
  if (Number.isFinite(createdAt) && Number.isFinite(completedAt) && completedAt < createdAt) {
    errors.push('completed_at:before_created_at')
  }

  const taskClassRank = DATA_CLASS_RANK.get(input.data_class)
  if (Number.isInteger(taskClassRank) && Array.isArray(input.evidence)) {
    const containsMoreSensitiveEvidence = input.evidence.some((item) => {
      const evidenceRank = DATA_CLASS_RANK.get(item?.data_class)
      return Number.isInteger(evidenceRank) && evidenceRank > taskClassRank
    })
    if (containsMoreSensitiveEvidence) errors.push('data_class:below_evidence')
  }

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, errors: [], value: input }
}

export function createEvoTaskEnvelope(input, options = {}) {
  const now = options.now ?? (() => new Date())
  const generateId = options.generateId ?? (() => globalThis.crypto.randomUUID())
  const taskId = normalizeOptionalString(input?.task_id) || generateId()
  const createdAt = normalizeTimestamp(input?.created_at) || now().toISOString()
  const dataClass = normalizeOptionalString(input?.data_class) || 'P1'
  const evidence = Array.isArray(input?.evidence)
    ? input.evidence.map((item) => normalizeEvidence(item, {
        dataClass,
        generateId,
        now,
      }))
    : input?.evidence ?? []

  const envelope = {
    task_id: taskId,
    task_type: normalizeOptionalString(input?.task_type),
    source: normalizeOptionalString(input?.source),
    organization_id: normalizeOptionalString(input?.organization_id),
    subject_person_id: normalizeOptionalString(input?.subject_person_id),
    assignee_id: normalizeOptionalString(input?.assignee_id),
    status: normalizeOptionalString(input?.status) || EVO_TASK_STATUSES.PENDING,
    summary: normalizeOptionalString(input?.summary),
    data_class: dataClass,
    due_at: normalizeTimestamp(input?.due_at),
    completed_at: normalizeTimestamp(input?.completed_at),
    evidence,
    schema_version: input?.schema_version ?? 1,
    idempotency_key: normalizeOptionalString(input?.idempotency_key),
    correlation_id: normalizeOptionalString(input?.correlation_id) || taskId,
    causation_event_id: normalizeOptionalString(input?.causation_event_id),
    created_at: createdAt,
    updated_at: normalizeTimestamp(input?.updated_at) || createdAt,
  }

  const validation = validateEvoTaskEnvelope(envelope)
  if (!validation.ok) throw new EvoTaskContractError(validation.errors)
  return deepFreeze(envelope)
}
