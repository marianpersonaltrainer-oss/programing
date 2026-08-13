import { createHash } from 'node:crypto'
import {
  createEvoEventEnvelope,
  EvoEventContractError,
} from '../../src/domain/nucleus/evoEventEnvelope.js'

const EVENT_SELECT = [
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
].join(',')

const SEMANTIC_FIELDS = [
  'event_type',
  'occurred_at',
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
]

const TIMESTAMP_FIELDS = new Set([
  'occurred_at',
  'source_updated_at',
  'reconciled_at',
])

export class NucleusEventRecorderError extends Error {
  constructor(code, status = 503, cause = null) {
    super(code)
    this.name = 'NucleusEventRecorderError'
    this.code = code
    this.status = status
    this.cause = cause
  }
}

function deterministicEventId(organizationId, source, idempotencyKey) {
  const bytes = createHash('sha256')
    .update(`${organizationId}\u0000${source}\u0000${idempotencyKey}`)
    .digest()
    .subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x80
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    )
  }
  return value
}

function semanticFingerprint(event) {
  return JSON.stringify(canonicalize(Object.fromEntries(
    SEMANTIC_FIELDS.map((field) => {
      const value = event?.[field] ?? null
      if (!TIMESTAMP_FIELDS.has(field) || value === null) {
        return [field, value]
      }
      const timestamp = new Date(value)
      return [field, Number.isNaN(timestamp.getTime()) ? value : timestamp.toISOString()]
    }),
  )))
}

function sanitizeRecordedEvent(row) {
  if (!row || typeof row !== 'object') return null
  return Object.fromEntries(
    EVENT_SELECT.split(',').map((field) => [field, row[field] ?? null]),
  )
}

function normalizeRecorderInput(input) {
  const organizationId = String(input?.organization_id || '').trim()
  const source = String(input?.source || '').trim()
  const idempotencyKey = String(input?.idempotency_key || '').trim()
  const eventId = deterministicEventId(organizationId, source, idempotencyKey)

  return createEvoEventEnvelope({
    ...input,
    event_id: eventId,
    correlation_id: input?.correlation_id || eventId,
  })
}

async function findExistingEvent(supabase, envelope) {
  const { data, error } = await supabase
    .from('evo_events')
    .select(EVENT_SELECT)
    .eq('organization_id', envelope.organization_id)
    .eq('source', envelope.source)
    .eq('idempotency_key', envelope.idempotency_key)
    .maybeSingle()

  if (error) {
    throw new NucleusEventRecorderError(
      'nucleus_event_lookup_unavailable',
      503,
      error,
    )
  }
  if (!data) {
    throw new NucleusEventRecorderError(
      'nucleus_event_duplicate_not_found',
      503,
    )
  }
  return sanitizeRecordedEvent(data)
}

/**
 * Registra un hecho canónico una sola vez. Los reintentos idénticos devuelven
 * el evento existente; reutilizar la misma clave con otro contenido falla con
 * conflicto. El cliente recibido debe ser exclusivamente server-side.
 */
export async function recordNucleusEvent(supabase, input) {
  if (!supabase?.from) {
    throw new NucleusEventRecorderError('nucleus_event_store_not_configured', 500)
  }

  let envelope
  try {
    envelope = normalizeRecorderInput(input)
  } catch (error) {
    if (error instanceof EvoEventContractError) {
      throw new NucleusEventRecorderError(
        'invalid_nucleus_event',
        400,
        error,
      )
    }
    throw error
  }

  const created = await supabase
    .from('evo_events')
    .insert(envelope)
    .select(EVENT_SELECT)
    .single()

  if (!created.error) {
    return {
      created: true,
      event: sanitizeRecordedEvent(created.data),
    }
  }

  if (created.error.code !== '23505') {
    throw new NucleusEventRecorderError(
      'nucleus_event_write_unavailable',
      503,
      created.error,
    )
  }

  const existing = await findExistingEvent(supabase, envelope)
  if (semanticFingerprint(existing) !== semanticFingerprint(envelope)) {
    throw new NucleusEventRecorderError(
      'nucleus_event_idempotency_conflict',
      409,
    )
  }

  return { created: false, event: existing }
}

export function nucleusRecorderErrorResponse(error) {
  if (error instanceof NucleusEventRecorderError) {
    return { status: error.status, body: { error: error.code } }
  }
  return { status: 503, body: { error: 'nucleus_event_write_unavailable' } }
}
