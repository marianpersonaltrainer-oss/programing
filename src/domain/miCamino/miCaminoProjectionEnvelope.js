const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const KEY_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/

export const MI_CAMINO_ENTRY_MODES = Object.freeze({
  NEW: 'new',
  VETERAN: 'veteran',
})

export const MI_CAMINO_FRESHNESS_STATUSES = Object.freeze({
  FRESH: 'fresh',
  STALE: 'stale',
  UNKNOWN: 'unknown',
})

const PROJECTION_FIELDS = new Set([
  'projection_id',
  'organization_id',
  'person_id',
  'entry_mode',
  'journey_day',
  'stage_key',
  'next_action',
  'progress',
  'freshness',
  'data_class',
  'schema_version',
  'updated_at',
])

const NEXT_ACTION_FIELDS = new Set([
  'action_id',
  'kind',
  'title',
  'status',
  'due_at',
  'reference_id',
])

const PROGRESS_FIELDS = new Set([
  'confirmed_attendance_count',
  'completed_action_count',
  'total_action_count',
  'next_milestone_key',
])

const FRESHNESS_FIELDS = new Set([
  'status',
  'source',
  'source_updated_at',
  'observed_at',
])

const ENTRY_MODES = new Set(Object.values(MI_CAMINO_ENTRY_MODES))
const FRESHNESS_STATUSES = new Set(Object.values(MI_CAMINO_FRESHNESS_STATUSES))

export class MiCaminoProjectionContractError extends Error {
  constructor(errors) {
    super(`invalid_mi_camino_projection: ${errors.join(', ')}`)
    this.name = 'MiCaminoProjectionContractError'
    this.code = 'invalid_mi_camino_projection'
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
  if (value == null || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

function validateKnownFields(value, allowed, path, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${path}:must_be_plain_object`)
    return false
  }
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) errors.push(`${path}.${field}:unknown_field`)
  }
  return true
}

function validateUuid(value, field, errors) {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    errors.push(`${field}:invalid_uuid`)
  }
}

function validateText(value, field, errors, { min, max, pattern, nullable = false } = {}) {
  if (nullable && value == null) return
  if (typeof value !== 'string') {
    errors.push(`${field}:must_be_string`)
    return
  }
  if (value.length < min || value.length > max) errors.push(`${field}:invalid_length`)
  if (pattern && !pattern.test(value)) errors.push(`${field}:invalid_format`)
}

function validateTimestamp(value, field, errors, { nullable = false } = {}) {
  if (nullable && value == null) return
  if (typeof value !== 'string' || !value.trim() || Number.isNaN(new Date(value).getTime())) {
    errors.push(`${field}:invalid_timestamp`)
  }
}

function validateCount(value, field, errors) {
  if (!Number.isInteger(value) || value < 0 || value > 1_000_000) {
    errors.push(`${field}:invalid_count`)
  }
}

function validateNextAction(value, errors) {
  if (!validateKnownFields(value, NEXT_ACTION_FIELDS, 'next_action', errors)) return
  validateUuid(value.action_id, 'next_action.action_id', errors)
  validateText(value.kind, 'next_action.kind', errors, { min: 2, max: 64, pattern: KEY_PATTERN })
  validateText(value.title, 'next_action.title', errors, { min: 1, max: 160 })
  validateText(value.status, 'next_action.status', errors, { min: 2, max: 48, pattern: KEY_PATTERN })
  validateTimestamp(value.due_at, 'next_action.due_at', errors, { nullable: true })
  validateText(value.reference_id, 'next_action.reference_id', errors, { min: 1, max: 240 })
}

function validateProgress(value, errors) {
  if (!validateKnownFields(value, PROGRESS_FIELDS, 'progress', errors)) return
  validateCount(value.confirmed_attendance_count, 'progress.confirmed_attendance_count', errors)
  validateCount(value.completed_action_count, 'progress.completed_action_count', errors)
  validateCount(value.total_action_count, 'progress.total_action_count', errors)
  validateText(value.next_milestone_key, 'progress.next_milestone_key', errors, {
    min: 1,
    max: 96,
    pattern: KEY_PATTERN,
    nullable: true,
  })
  if (
    Number.isInteger(value.completed_action_count)
    && Number.isInteger(value.total_action_count)
    && value.completed_action_count > value.total_action_count
  ) {
    errors.push('progress.completed_action_count:above_total')
  }
}

function validateFreshness(value, errors) {
  if (!validateKnownFields(value, FRESHNESS_FIELDS, 'freshness', errors)) return
  if (!FRESHNESS_STATUSES.has(value.status)) errors.push('freshness.status:invalid_status')
  validateText(value.source, 'freshness.source', errors, { min: 2, max: 64, pattern: KEY_PATTERN })
  validateTimestamp(value.source_updated_at, 'freshness.source_updated_at', errors, { nullable: true })
  validateTimestamp(value.observed_at, 'freshness.observed_at', errors)

  if (value.status === MI_CAMINO_FRESHNESS_STATUSES.FRESH && value.source_updated_at == null) {
    errors.push('freshness.source_updated_at:required_when_fresh')
  }
  const sourceUpdatedAt = new Date(value.source_updated_at).getTime()
  const observedAt = new Date(value.observed_at).getTime()
  if (Number.isFinite(sourceUpdatedAt) && Number.isFinite(observedAt) && sourceUpdatedAt > observedAt) {
    errors.push('freshness.observed_at:before_source_updated_at')
  }
}

export function validateMiCaminoProjectionEnvelope(input) {
  const errors = []
  if (!validateKnownFields(input, PROJECTION_FIELDS, 'projection', errors)) {
    return { ok: false, errors }
  }

  validateUuid(input.projection_id, 'projection_id', errors)
  validateUuid(input.organization_id, 'organization_id', errors)
  validateUuid(input.person_id, 'person_id', errors)
  if (!ENTRY_MODES.has(input.entry_mode)) errors.push('entry_mode:invalid_mode')
  validateText(input.stage_key, 'stage_key', errors, { min: 1, max: 96, pattern: KEY_PATTERN })
  validateNextAction(input.next_action, errors)
  validateProgress(input.progress, errors)
  validateFreshness(input.freshness, errors)
  validateTimestamp(input.updated_at, 'updated_at', errors)

  if (input.entry_mode === MI_CAMINO_ENTRY_MODES.NEW) {
    if (!Number.isInteger(input.journey_day) || input.journey_day < 0 || input.journey_day > 30) {
      errors.push('journey_day:outside_pilot_slice')
    }
  } else if (input.entry_mode === MI_CAMINO_ENTRY_MODES.VETERAN && input.journey_day != null) {
    errors.push('journey_day:must_be_null_for_veteran')
  }

  if (input.data_class !== 'P2') errors.push('data_class:must_be_p2')
  if (!Number.isInteger(input.schema_version) || input.schema_version < 1 || input.schema_version > 2147483647) {
    errors.push('schema_version:invalid_version')
  }

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, errors: [], value: input }
}

export function createMiCaminoProjectionEnvelope(input, options = {}) {
  const now = options.now ?? (() => new Date())
  const generateId = options.generateId ?? (() => globalThis.crypto.randomUUID())
  const envelope = {
    projection_id: normalizeOptionalString(input?.projection_id) || generateId(),
    organization_id: normalizeOptionalString(input?.organization_id),
    person_id: normalizeOptionalString(input?.person_id),
    entry_mode: normalizeOptionalString(input?.entry_mode),
    journey_day: input?.journey_day ?? null,
    stage_key: normalizeOptionalString(input?.stage_key),
    next_action: isPlainObject(input?.next_action) ? {
      ...input.next_action,
      action_id: normalizeOptionalString(input.next_action.action_id),
      kind: normalizeOptionalString(input.next_action.kind),
      title: normalizeOptionalString(input.next_action.title),
      status: normalizeOptionalString(input.next_action.status),
      due_at: normalizeTimestamp(input.next_action.due_at),
      reference_id: normalizeOptionalString(input.next_action.reference_id),
    } : input?.next_action,
    progress: isPlainObject(input?.progress) ? {
      ...input.progress,
      next_milestone_key: normalizeOptionalString(input.progress.next_milestone_key),
    } : input?.progress,
    freshness: isPlainObject(input?.freshness) ? {
      ...input.freshness,
      status: normalizeOptionalString(input.freshness.status),
      source: normalizeOptionalString(input.freshness.source),
      source_updated_at: normalizeTimestamp(input.freshness.source_updated_at),
      observed_at: normalizeTimestamp(input.freshness.observed_at),
    } : input?.freshness,
    data_class: 'P2',
    schema_version: input?.schema_version ?? 1,
    updated_at: normalizeTimestamp(input?.updated_at) || now().toISOString(),
  }

  const validation = validateMiCaminoProjectionEnvelope(envelope)
  if (!validation.ok) throw new MiCaminoProjectionContractError(validation.errors)
  return deepFreeze(envelope)
}
