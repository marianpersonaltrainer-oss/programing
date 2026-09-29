import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  capabilityAuthErrorResponse,
  requireEvoCapability,
} from './lib/evoCapabilityAuth.js'
import { getRequestOrigin, isEvoOriginAllowed } from './lib/evoAllowedOrigins.js'
import { checkAdminRateLimit } from './lib/evoAdminAuth.js'
import {
  nucleusRecorderErrorResponse,
  recordNucleusEvent,
} from './lib/nucleusEventRecorder.js'

const ATTENDANCE_OPTIONS = new Set(['vino', 'canceló', 'cambió fecha', 'no vino'])
const ENTRY_OPTIONS = new Set([
  'EVO Basics',
  'EVO Intermedio',
  'EVO Funcional',
  'Revisar con Marian',
])
const PRIORITY_OPTIONS = new Set([
  'Retomar y crear constancia',
  'Moverse con seguridad y confianza',
  'Mejorar técnica y fuerza',
  'Coordinación y aprendizaje de movimientos',
  'Otro objetivo inicial',
])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
    serviceKey: String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    supabaseUrl: String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim(),
  }
}

function optionalText(value, max) {
  const normalized = String(value ?? '').trim()
  if (!normalized) return null
  if (normalized.length > max) throw new Error('invalid_trial_close_input')
  return normalized
}

function requiredText(value, max) {
  const normalized = optionalText(value, max)
  if (!normalized) throw new Error('invalid_trial_close_input')
  return normalized
}

function trialCloseInput(body = {}) {
  const personReference = requiredText(body.person_reference, 120)
  const attendance = requiredText(body.attendance, 32)
  const entryPoint = requiredText(body.entry_point, 80)
  const priority = requiredText(body.priority, 120)
  const reason = requiredText(body.reason, 1000)
  const adaptations = optionalText(body.adaptations, 1000)
  const submissionId = requiredText(body.submission_id, 80)
  const sourceEventId = optionalText(body.source_event_id, 80)

  if (!UUID_RE.test(submissionId)) throw new Error('invalid_trial_close_input')
  if (sourceEventId && !UUID_RE.test(sourceEventId)) throw new Error('invalid_trial_close_input')
  if (!ATTENDANCE_OPTIONS.has(attendance)) throw new Error('invalid_trial_close_input')
  if (!ENTRY_OPTIONS.has(entryPoint)) throw new Error('invalid_trial_close_input')
  if (!PRIORITY_OPTIONS.has(priority)) throw new Error('invalid_trial_close_input')

  return {
    personReference,
    attendance,
    entryPoint,
    priority,
    adaptations,
    reason,
    submissionId,
    sourceEventId,
  }
}

/**
 * Cierre de una primera clase. Solo acepta identidad individual con la
 * capability Coach: el código compartido nunca puede escribir esta evidencia.
 * Los eventos quedan append-only y no se exponen al cliente por la Data API.
 */
export function createCoachTrialCloseHandler({
  createClientImpl = createClient,
  requireCapabilityImpl = requireEvoCapability,
  checkRateLimitImpl = checkAdminRateLimit,
  recordEventImpl = recordNucleusEvent,
  readConfigImpl = readConfig,
  requestIdImpl = randomUUID,
  nowImpl = () => new Date(),
  logger = console,
} = {}) {
  return async function coachTrialCloseHandler(req, res) {
    const requestId = requestIdImpl()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed', requestId })

    const origin = getRequestOrigin(req)
    const isDev = process.env.NODE_ENV === 'development'
    if (!(isDev && !origin) && !isEvoOriginAllowed(origin)) {
      return res.status(403).json({ error: 'origin_not_allowed', requestId })
    }

    const config = readConfigImpl(process.env)
    if (!config.serviceKey || !config.supabaseUrl) {
      return res.status(503).json({ error: 'trial_close_not_configured', requestId })
    }

    let identity
    try {
      identity = await requireCapabilityImpl(req, 'coach.workspace.access')
    } catch (error) {
      const response = capabilityAuthErrorResponse(error)
      return res.status(response.status).json({ ...response.body, requestId })
    }

    const body = parseBody(req)
    if (body === null) return res.status(400).json({ error: 'invalid_json', requestId })

    let input
    try {
      input = trialCloseInput(body)
    } catch {
      return res.status(400).json({ error: 'invalid_trial_close_input', requestId })
    }

    const supabase = createClientImpl(config.supabaseUrl, config.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    try {
      const exceeded = await checkRateLimitImpl(supabase, req, {
        endpoint: '/api/coach-trial-close',
        limit: 20,
        windowMinutes: 10,
      })
      if (exceeded) {
        return res.status(429).json({
          error: 'rate_limit_exceeded', retry_after_seconds: 600, requestId,
        })
      }
    } catch {
      return res.status(503).json({ error: 'rate_limit_unavailable', requestId })
    }

    const timestamp = nowImpl().toISOString()
    try {
      const recorded = await recordEventImpl(supabase, {
        event_type: 'trial.close.recorded',
        occurred_at: timestamp,
        observed_at: timestamp,
        source: 'coach',
        organization_id: identity.organizationId,
        person_id: null,
        external_id: input.personReference,
        schema_version: 1,
        payload: {
          coach_id: identity.user.id,
          source_event_id: input.sourceEventId,
          attendance: input.attendance,
          entry_point: input.entryPoint,
          priority: input.priority,
          adaptations: input.adaptations,
          reason: input.reason,
        },
        idempotency_key: `coach-trial-close:${identity.user.id}:${input.submissionId}`,
        causation_id: input.sourceEventId,
        source_updated_at: null,
        reconciled_at: null,
        sync_status: 'pending',
      })
      logger.info?.('coach_trial_close_recorded', {
        requestId,
        created: recorded.created,
        coachId: identity.user.id,
      })
      return res.status(recorded.created ? 201 : 200).json({
        ok: true,
        created: recorded.created,
        eventId: recorded.event.event_id,
        requestId,
      })
    } catch (error) {
      const response = nucleusRecorderErrorResponse(error)
      logger.warn?.('coach_trial_close_failed', { requestId, code: response.body.error })
      return res.status(response.status).json({ ...response.body, requestId })
    }
  }
}

export default createCoachTrialCloseHandler()
