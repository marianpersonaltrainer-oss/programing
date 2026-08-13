import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { adminSecretsMatch, checkAdminRateLimit } from './lib/evoAdminAuth.js'
import {
  capabilityAuthErrorResponse,
  requireEvoCapability,
} from './lib/evoCapabilityAuth.js'
import { getRequestOrigin, isEvoOriginAllowed } from './lib/evoAllowedOrigins.js'

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
    coachCode: String(env.COACH_ACCESS_CODE || '').trim(),
    individualAuthEnabled: String(
      env.COACH_INDIVIDUAL_AUTH_ENABLED || '',
    ).trim().toLowerCase() === 'true',
    serviceKey: String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    supabaseUrl: String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim(),
  }
}

function coachCodesMatch(input, expected) {
  return adminSecretsMatch(
    String(input || '').trim().toUpperCase(),
    String(expected || '').trim().toUpperCase(),
  )
}

function optionalText(value, max) {
  const normalized = String(value ?? '').trim()
  if (!normalized) return null
  if (normalized.length > max) throw new Error('invalid_input')
  return normalized
}

function checkinRow(body, coachId) {
  const coachName = optionalText(body?.coach_name, 120)
  const weekIso = optionalText(body?.week_iso, 20)
  const moodScore = Number(body?.mood_score)
  if (!coachName || !weekIso || !Number.isInteger(moodScore)) {
    throw new Error('invalid_input')
  }
  if (moodScore < 1 || moodScore > 5) throw new Error('invalid_input')

  return {
    coach_name: coachName,
    week_iso: weekIso,
    mood_score: moodScore,
    feedback_text: optionalText(body?.feedback_text, 4000),
    highlights: optionalText(body?.highlights, 4000),
    improvements: optionalText(body?.improvements, 4000),
    coach_id: coachId,
  }
}

async function resolveCoachAuthorization(
  req,
  body,
  config,
  requireCapabilityImpl,
) {
  if (config.individualAuthEnabled) {
    try {
      const identity = await requireCapabilityImpl(req, 'coach.workspace.access')
      return { method: 'individual_identity', identity }
    } catch (error) {
      if (!['authentication_required', 'capability_denied'].includes(error?.code)) {
        throw error
      }
    }
  }

  if (config.coachCode && coachCodesMatch(body?.accessCode, config.coachCode)) {
    return { method: 'coach_access_code', identity: null }
  }
  return null
}

export function createCoachWeeklyCheckinHandler({
  createClientImpl = createClient,
  requireCapabilityImpl = requireEvoCapability,
  checkRateLimitImpl = checkAdminRateLimit,
  readConfigImpl = readConfig,
  requestIdImpl = randomUUID,
  logger = console,
} = {}) {
  return async function coachWeeklyCheckinHandler(req, res) {
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
    if (
      !config.serviceKey
      || !config.supabaseUrl
      || (!config.coachCode && !config.individualAuthEnabled)
    ) {
      return res.status(500).json({ error: 'server_not_configured', requestId })
    }

    const body = parseBody(req)
    if (body === null) {
      return res.status(400).json({ error: 'invalid_json', requestId })
    }

    let authorization
    try {
      authorization = await resolveCoachAuthorization(
        req,
        body,
        config,
        requireCapabilityImpl,
      )
    } catch (error) {
      const response = capabilityAuthErrorResponse(error)
      return res.status(response.status).json({ ...response.body, requestId })
    }
    if (!authorization) {
      return res.status(401).json({ error: 'coach_authentication_required', requestId })
    }

    let row
    try {
      row = checkinRow(body, authorization.identity?.user?.id || null)
    } catch {
      return res.status(400).json({ error: 'invalid_checkin_input', requestId })
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
        endpoint: '/api/coach-weekly-checkin',
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

    const { data, error } = await supabase
      .from('weekly_checkins')
      .upsert(row, { onConflict: 'week_iso,coach_name_norm' })
      .select('*')
      .single()

    if (error) {
      logger.error?.('coach_weekly_checkin_write_failed', {
        requestId,
        code: error.code || 'unknown',
      })
      return res.status(503).json({ error: 'checkin_write_unavailable', requestId })
    }

    logger.info?.('coach_weekly_checkin_recorded', {
      requestId,
      method: authorization.method,
    })
    return res.status(200).json({ ok: true, data, requestId })
  }
}

export default createCoachWeeklyCheckinHandler()
