import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  capabilityAuthErrorResponse,
  requireEvoCapability,
} from './lib/evoCapabilityAuth.js'
import { checkAdminRateLimit } from './lib/evoAdminAuth.js'
import { getRequestOrigin, isEvoOriginAllowed } from './lib/evoAllowedOrigins.js'
import {
  nucleusRecorderErrorResponse,
  recordNucleusEvent,
} from './lib/nucleusEventRecorder.js'

const PILOT_KEY_PATTERN = /^[a-z0-9][a-z0-9._:-]{7,159}$/

function parseBody(req) {
  try {
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8') || '{}')
    if (typeof req.body === 'string') return JSON.parse(req.body || '{}')
    return req.body && typeof req.body === 'object' ? req.body : {}
  } catch {
    return null
  }
}

function readConfig(env) {
  return {
    enabled: String(env.NUCLEUS_EVENTS_ENABLED || '').trim().toLowerCase() === 'true',
    serviceKey: String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    supabaseUrl: String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim(),
  }
}

function normalizePilotInput(body) {
  const idempotencyKey = String(body?.idempotencyKey || '').trim().toLowerCase()
  const occurredAt = String(body?.occurredAt || '').trim()
  if (!PILOT_KEY_PATTERN.test(idempotencyKey)) return null
  const date = new Date(occurredAt)
  if (!occurredAt || Number.isNaN(date.getTime())) return null
  return { idempotencyKey, occurredAt: date.toISOString() }
}

export function createNucleusPilotEventHandler({
  createClientImpl = createClient,
  requireCapabilityImpl = requireEvoCapability,
  checkRateLimitImpl = checkAdminRateLimit,
  recordEventImpl = recordNucleusEvent,
  readConfigImpl = readConfig,
  nowImpl = () => new Date(),
  requestIdImpl = randomUUID,
  logger = console,
} = {}) {
  return async function nucleusPilotEventHandler(req, res) {
    const requestId = requestIdImpl()
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed', requestId })
    }

    const originValue = getRequestOrigin(req)
    const isDev = process.env.NODE_ENV === 'development'
    if (!(isDev && !originValue) && !isEvoOriginAllowed(originValue)) {
      return res.status(403).json({ error: 'origin_not_allowed', requestId })
    }

    const config = readConfigImpl(process.env)
    if (!config.enabled) {
      return res.status(404).json({ error: 'nucleus_pilot_disabled', requestId })
    }
    if (!config.supabaseUrl || !config.serviceKey) {
      return res.status(500).json({
        error: 'nucleus_event_store_not_configured',
        requestId,
      })
    }

    const body = parseBody(req)
    if (body === null) {
      return res.status(400).json({ error: 'invalid_json', requestId })
    }
    const pilot = normalizePilotInput(body)
    if (!pilot) {
      return res.status(400).json({ error: 'invalid_nucleus_pilot_input', requestId })
    }

    let identity
    try {
      identity = await requireCapabilityImpl(req, 'programming.manage')
    } catch (error) {
      const response = capabilityAuthErrorResponse(error)
      return res.status(response.status).json({ ...response.body, requestId })
    }

    const supabase = createClientImpl(config.supabaseUrl, config.serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })

    try {
      const exceeded = await checkRateLimitImpl(supabase, req, {
        endpoint: '/api/nucleus-pilot-event',
        limit: 20,
        windowMinutes: 10,
      })
      if (exceeded) {
        return res.status(429).json({
          error: 'rate_limit_exceeded',
          retry_after_seconds: 600,
          requestId,
        })
      }
    } catch {
      return res.status(503).json({ error: 'rate_limit_unavailable', requestId })
    }

    try {
      const result = await recordEventImpl(supabase, {
        event_type: 'nucleus.pilot.recorded',
        occurred_at: pilot.occurredAt,
        observed_at: nowImpl().toISOString(),
        source: 'programming',
        organization_id: identity.organizationId,
        person_id: null,
        external_id: pilot.idempotencyKey,
        schema_version: 1,
        payload: { pilot: true, contract_version: 1 },
        idempotency_key: `nucleus-pilot:${pilot.idempotencyKey}`,
        causation_id: null,
        source_updated_at: null,
        reconciled_at: null,
        sync_status: 'synced',
      })

      logger.info?.('nucleus_pilot_event_recorded', {
        requestId,
        created: result.created,
        eventId: result.event.event_id,
      })
      return res.status(result.created ? 201 : 200).json({
        ok: true,
        created: result.created,
        eventId: result.event.event_id,
        eventType: result.event.event_type,
        requestId,
      })
    } catch (error) {
      const response = nucleusRecorderErrorResponse(error)
      logger.warn?.('nucleus_pilot_event_failed', {
        requestId,
        code: response.body.error,
      })
      return res.status(response.status).json({ ...response.body, requestId })
    }
  }
}

export default createNucleusPilotEventHandler()
