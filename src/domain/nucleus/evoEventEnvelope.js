const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/
const SOURCE_PATTERN = /^[a-z][a-z0-9_-]+$/

const EVENT_FIELDS = new Set([
  'event_id',
  'event_type',
  'occurred_at',
  'observed_at',
  'source',
  'organization_id',
  'person_id',
  'external_id',
  'schema_version',
  'payload',
  'idempotency_key',
  'correlation_id',
  'causation_id',
  'source_updated_at',
  'reconciled_at',
  'sync_status',
])

const SYNC_STATUSES = new Set(['pending', 'synced', 'error', 'reconciled'])
const FORBIDDEN_PAYLOAD_KEYS = new Set([
  'api_key',
  'apikey',
  'access_token',
  'authorization',
  'cookie',
  'password',
  'passphrase',
  'private_key',
  'refresh_token',
  'secret',
  'service_role',
])

const MAX_PAYLOAD_DEPTH = 12
const MAX_PAYLOAD_BYTES = 64 * 1024

export class EvoEventContractError extends Error {
  constructor(errors) {
    super(`invalid_evo_event: ${errors.join(', ')}`)
    this.name = 'EvoEventContractError'
    this.code = 'invalid_evo_event'
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

function normalizePayloadKey(key) {
  return key
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

function isForbiddenPayloadKey(key) {
  const normalized = normalizePayloadKey(key)
  return FORBIDDEN_PAYLOAD_KEYS.has(normalized)
    || normalized.endsWith('_api_key')
    || normalized.endsWith('_access_token')
    || normalized.endsWith('_refresh_token')
    || normalized.endsWith('_private_key')
    || normalized.endsWith('_password')
    || normalized.endsWith('_secret')
    || normalized.startsWith('service_role_')
}

function cloneAndValidateJson(value, path, errors, depth = 0) {
  if (depth > MAX_PAYLOAD_DEPTH) {
    errors.push(`${path}:max_depth`)
    return null
  }

  if (value == null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) errors.push(`${path}:non_finite_number`)
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => (
      cloneAndValidateJson(item, `${path}[${index}]`, errors, depth + 1)
    ))
  }

  if (!isPlainObject(value)) {
    errors.push(`${path}:not_json_compatible`)
    return null
  }

  const cloned = {}
  for (const [key, item] of Object.entries(value)) {
    if (isForbiddenPayloadKey(key)) {
      errors.push(`${path}.${key}:secret_key_forbidden`)
    }
    cloned[key] = cloneAndValidateJson(
      item,
      `${path}.${key}`,
      errors,
      depth + 1,
    )
  }
  return cloned
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

export function validateEvoEventEnvelope(input) {
  const errors = []
  if (!isPlainObject(input)) {
    return { ok: false, errors: ['event:must_be_plain_object'] }
  }

  for (const field of Object.keys(input)) {
    if (!EVENT_FIELDS.has(field)) errors.push(`${field}:unknown_field`)
  }

  validateUuid(input.event_id, 'event_id', errors)
  validateText(input.event_type, 'event_type', errors, {
    min: 3,
    max: 160,
    pattern: EVENT_TYPE_PATTERN,
  })
  validateTimestamp(input.occurred_at, 'occurred_at', errors)
  validateTimestamp(input.observed_at, 'observed_at', errors)
  validateText(input.source, 'source', errors, {
    min: 2,
    max: 64,
    pattern: SOURCE_PATTERN,
  })
  validateUuid(input.organization_id, 'organization_id', errors)
  validateUuid(input.person_id, 'person_id', errors, { nullable: true })

  if (input.external_id != null) {
    validateText(input.external_id, 'external_id', errors, { min: 1, max: 240 })
  }

  if (
    !Number.isInteger(input.schema_version)
    || input.schema_version < 1
    || input.schema_version > 2147483647
  ) {
    errors.push('schema_version:invalid_version')
  }

  if (!isPlainObject(input.payload)) errors.push('payload:must_be_plain_object')
  validateText(input.idempotency_key, 'idempotency_key', errors, {
    min: 1,
    max: 240,
  })
  validateUuid(input.correlation_id, 'correlation_id', errors)
  validateUuid(input.causation_id, 'causation_id', errors, { nullable: true })
  validateTimestamp(input.source_updated_at, 'source_updated_at', errors, {
    nullable: true,
  })
  validateTimestamp(input.reconciled_at, 'reconciled_at', errors, {
    nullable: true,
  })

  if (!SYNC_STATUSES.has(input.sync_status)) {
    errors.push('sync_status:invalid_status')
  }
  if (input.sync_status === 'reconciled' && input.reconciled_at == null) {
    errors.push('reconciled_at:required_for_reconciled_status')
  }
  if (input.causation_id != null && input.causation_id === input.event_id) {
    errors.push('causation_id:self_reference')
  }

  const occurredAt = new Date(input.occurred_at).getTime()
  const observedAt = new Date(input.observed_at).getTime()
  if (
    Number.isFinite(occurredAt)
    && Number.isFinite(observedAt)
    && occurredAt > observedAt
  ) {
    errors.push('observed_at:before_occurred_at')
  }

  const payloadErrors = []
  const clonedPayload = isPlainObject(input.payload)
    ? cloneAndValidateJson(input.payload, 'payload', payloadErrors)
    : null
  errors.push(...payloadErrors)

  if (clonedPayload != null && payloadErrors.length === 0) {
    const payloadBytes = new TextEncoder().encode(JSON.stringify(clonedPayload)).length
    if (payloadBytes > MAX_PAYLOAD_BYTES) errors.push('payload:too_large')
  }

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, errors: [], value: input }
}

export function createEvoEventEnvelope(input, options = {}) {
  const now = options.now ?? (() => new Date())
  const generateId = options.generateId ?? (() => globalThis.crypto.randomUUID())
  const eventId = normalizeOptionalString(input?.event_id) || generateId()
  const observedAt = normalizeTimestamp(input?.observed_at)
    || now().toISOString()

  const payloadErrors = []
  const payload = cloneAndValidateJson(input?.payload ?? {}, 'payload', payloadErrors)

  if (payloadErrors.length > 0) {
    throw new EvoEventContractError(payloadErrors)
  }

  const envelope = {
    event_id: eventId,
    event_type: normalizeOptionalString(input?.event_type),
    occurred_at: normalizeTimestamp(input?.occurred_at),
    observed_at: observedAt,
    source: normalizeOptionalString(input?.source),
    organization_id: normalizeOptionalString(input?.organization_id),
    person_id: normalizeOptionalString(input?.person_id),
    external_id: normalizeOptionalString(input?.external_id),
    schema_version: input?.schema_version ?? 1,
    payload,
    idempotency_key: normalizeOptionalString(input?.idempotency_key),
    correlation_id: normalizeOptionalString(input?.correlation_id) || eventId,
    causation_id: normalizeOptionalString(input?.causation_id),
    source_updated_at: normalizeTimestamp(input?.source_updated_at),
    reconciled_at: normalizeTimestamp(input?.reconciled_at),
    sync_status: normalizeOptionalString(input?.sync_status) || 'pending',
  }

  const validation = validateEvoEventEnvelope(envelope)
  if (!validation.ok) throw new EvoEventContractError(validation.errors)
  return deepFreeze(envelope)
}
