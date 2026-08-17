import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  capabilityAuthErrorResponse,
  requireEvoCapability,
} from './lib/evoCapabilityAuth.js'
import { checkAdminRateLimit } from './lib/evoAdminAuth.js'
import { getRequestOrigin, isEvoOriginAllowed } from './lib/evoAllowedOrigins.js'
import {
  createMiCaminoProjectionEnvelope,
  MiCaminoProjectionContractError,
} from '../src/domain/miCamino/miCaminoProjectionEnvelope.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ACTIONS = new Set(['provision', 'deactivate'])

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
    enabled: String(env.MI_CAMINO_ADMIN_ENABLED || '').trim().toLowerCase() === 'true',
    serviceKey: String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    supabaseUrl: String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim(),
  }
}

function normalizeUserId(body) {
  const userId = String(body?.userId || '').trim()
  return UUID_PATTERN.test(userId) ? userId : null
}

async function provisionAccess(supabase, identity, userId, projection) {
  const { error } = await supabase.rpc('evo_provision_mi_camino_access', {
    target_user_id: userId,
    target_organization_id: identity.organizationId,
    projection,
    actor_user_id: identity.user.id,
  })
  if (error) {
    if (error.code === 'P0001') throw new Error('mi_camino_person_access_conflict')
    throw new Error('mi_camino_access_write_failed')
  }
}

async function deactivateAccess(supabase, identity, userId) {
  const { error } = await supabase.rpc('evo_set_mi_camino_access_status', {
    target_user_id: userId,
    target_organization_id: identity.organizationId,
    next_status: 'inactive',
    actor_user_id: identity.user.id,
  })
  if (error) throw new Error('mi_camino_access_write_failed')
}

function operationError(error) {
  if (error instanceof MiCaminoProjectionContractError) return { status: 400, code: 'invalid_mi_camino_projection' }
  if (String(error?.message) === 'mi_camino_person_access_conflict') return { status: 409, code: 'mi_camino_person_access_conflict' }
  return { status: 503, code: 'mi_camino_access_unavailable' }
}

export function createMiCaminoAccessHandler({
  createClientImpl = createClient,
  requireCapabilityImpl = requireEvoCapability,
  checkRateLimitImpl = checkAdminRateLimit,
  readConfigImpl = readConfig,
  requestIdImpl = randomUUID,
  logger = console,
} = {}) {
  return async function miCaminoAccessHandler(req, res) {
    const requestId = requestIdImpl()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed', requestId })

    const originValue = getRequestOrigin(req)
    const isDev = process.env.NODE_ENV === 'development'
    if (!(isDev && !originValue) && !isEvoOriginAllowed(originValue)) {
      return res.status(403).json({ error: 'origin_not_allowed', requestId })
    }

    const config = readConfigImpl(process.env)
    if (!config.enabled) return res.status(404).json({ error: 'mi_camino_admin_disabled', requestId })
    if (!config.supabaseUrl || !config.serviceKey) {
      return res.status(500).json({ error: 'mi_camino_admin_not_configured', requestId })
    }

    const body = parseBody(req)
    if (body === null) return res.status(400).json({ error: 'invalid_json', requestId })
    const action = String(body.action || '').trim()
    const userId = normalizeUserId(body)
    if (!ACTIONS.has(action) || !userId) return res.status(400).json({ error: 'invalid_mi_camino_access_request', requestId })

    let identity
    try {
      identity = await requireCapabilityImpl(req, 'mi_camino.manage')
    } catch (error) {
      const response = capabilityAuthErrorResponse(error)
      return res.status(response.status).json({ ...response.body, requestId })
    }

    const supabase = createClientImpl(config.supabaseUrl, config.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    try {
      const exceeded = await checkRateLimitImpl(supabase, req, {
        endpoint: '/api/mi-camino-access', limit: 20, windowMinutes: 10,
      })
      if (exceeded) return res.status(429).json({ error: 'rate_limit_exceeded', retry_after_seconds: 600, requestId })
    } catch {
      return res.status(503).json({ error: 'rate_limit_unavailable', requestId })
    }

    try {
      if (action === 'provision') {
        const projection = createMiCaminoProjectionEnvelope(body.projection)
        if (projection.organization_id !== identity.organizationId) {
          return res.status(403).json({ error: 'organization_mismatch', requestId })
        }
        await provisionAccess(supabase, identity, userId, projection)
      } else {
        await deactivateAccess(supabase, identity, userId)
      }
      logger.info?.('mi_camino_access_changed', { requestId, action, organizationId: identity.organizationId })
      return res.status(200).json({ ok: true, action, requestId })
    } catch (error) {
      const response = operationError(error)
      logger.warn?.('mi_camino_access_change_failed', { requestId, action, code: response.code })
      return res.status(response.status).json({ error: response.code, requestId })
    }
  }
}

export default createMiCaminoAccessHandler()
