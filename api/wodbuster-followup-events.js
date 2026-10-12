import { timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  normalizeWodBusterFollowupEvent,
  reduceNativeWodBusterInactivitySignal,
  WodBusterFollowupEventError,
} from '../src/domain/operations/wodBusterFollowupEventIntake.js'
import { nucleusRecorderErrorResponse, recordNucleusEvent } from './lib/nucleusEventRecorder.js'

function parseBody(req) {
  try {
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8') || '{}')
    if (typeof req.body === 'string') return JSON.parse(req.body || '{}')
    return req.body && typeof req.body === 'object' ? req.body : {}
  } catch { return null }
}

function config(env) {
  return {
    enabled: String(env.WODBUSTER_FOLLOWUPS_ENABLED || '').trim().toLowerCase() === 'true',
    diagnosticMode: String(env.WODBUSTER_FOLLOWUPS_DIAGNOSTIC_MODE || '').trim().toLowerCase() === 'true',
    secret: String(env.WODBUSTER_FOLLOWUPS_SECRET || '').trim(),
    organizationId: String(env.EVO_ORGANIZATION_ID || '').trim(),
    serviceKey: String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    supabaseUrl: String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim(),
  }
}

// Durante la única prueba de compatibilidad con WodBuster no retenemos el
// cuerpo recibido: solo describimos los nombres de campos y sus tipos. Así se
// puede construir un reductor seguro sin escribir nombres, contacto, pagos ni
// respuestas de campos personalizados en los logs o la base de datos.
function payloadShape(value, depth = 0) {
  if (depth > 4) return '[depth-limited]'
  if (value == null) return 'null'
  if (Array.isArray(value)) {
    return { type: 'array', item: value.length ? payloadShape(value[0], depth + 1) : 'empty' }
  }
  if (typeof value !== 'object') return typeof value
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, payloadShape(nested, depth + 1)]))
}

function validSecret(received, expected) {
  const actual = Buffer.from(String(received || ''))
  const configured = Buffer.from(String(expected || ''))
  return actual.length > 0 && actual.length === configured.length && timingSafeEqual(actual, configured)
}

export function createWodBusterFollowupEventsHandler({
  createClientImpl = createClient,
  recordEventImpl = recordNucleusEvent,
  readConfigImpl = config,
  nowImpl = () => new Date(),
  requestIdImpl = () => crypto.randomUUID(),
  logger = console,
} = {}) {
  return async function handler(req, res) {
    const requestId = requestIdImpl()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed', requestId })
    const settings = readConfigImpl(process.env)
    if (!settings.enabled) return res.status(404).json({ error: 'wodbuster_followups_disabled', requestId })
    if (!settings.secret || !settings.organizationId || !settings.supabaseUrl || !settings.serviceKey) {
      return res.status(503).json({ error: 'wodbuster_followups_not_configured', requestId })
    }
    if (!validSecret(req.headers?.['x-evo-followups-key'], settings.secret)) {
      return res.status(401).json({ error: 'wodbuster_source_unauthorized', requestId })
    }

    const body = parseBody(req)
    if (body === null) return res.status(400).json({ error: 'invalid_json', requestId })
    let event
    try {
      event = normalizeWodBusterFollowupEvent(body)
    } catch (error) {
      const isNativeWodBusterPayload = !Object.prototype.hasOwnProperty.call(body, 'type')
      if (isNativeWodBusterPayload) {
        try {
          event = reduceNativeWodBusterInactivitySignal(body, { observedAt: nowImpl() })
        } catch (nativeError) {
          if (settings.diagnosticMode) {
            logger.info?.('wodbuster_followup_native_shape', {
              requestId,
              shape: payloadShape(body),
            })
            return res.status(202).json({ ok: true, diagnostic: true, requestId })
          }
          return res.status(400).json({
            error: nativeError instanceof WodBusterFollowupEventError ? nativeError.code : 'invalid_wodbuster_followup_event',
            requestId,
          })
        }
      }
      if (!event) {
        return res.status(400).json({
          error: error instanceof WodBusterFollowupEventError ? error.code : 'invalid_wodbuster_followup_event',
          requestId,
        })
      }
    }

    const supabase = createClientImpl(settings.supabaseUrl, settings.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    try {
      const result = await recordEventImpl(supabase, {
        event_type: event.type,
        occurred_at: event.observedAt,
        observed_at: nowImpl().toISOString(),
        source: 'wodbuster',
        organization_id: settings.organizationId,
        person_id: null,
        external_id: event.id,
        schema_version: 1,
        payload: event.payload
          ? { ...event.payload, mode: 'shadow' }
          : { member: event.member, mode: 'shadow' },
        idempotency_key: `wodbuster-followup:${event.id}`,
        causation_id: null,
        source_updated_at: event.observedAt,
        reconciled_at: null,
        sync_status: 'synced',
      })
      logger.info?.('wodbuster_followup_event_recorded', {
        requestId,
        type: event.type,
        created: result.created,
      })
      return res.status(result.created ? 201 : 200).json({
        ok: true,
        created: result.created,
        eventType: event.type,
        requestId,
      })
    } catch (error) {
      const response = nucleusRecorderErrorResponse(error)
      logger.warn?.('wodbuster_followup_event_failed', { requestId, code: response.body.error })
      return res.status(response.status).json({ ...response.body, requestId })
    }
  }
}

export default createWodBusterFollowupEventsHandler()
