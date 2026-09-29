import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { capabilityAuthErrorResponse, requireEvoCapability } from './lib/evoCapabilityAuth.js'
import { getRequestOrigin, isEvoOriginAllowed } from './lib/evoAllowedOrigins.js'
import { checkAdminRateLimit } from './lib/evoAdminAuth.js'

const MAX_SOURCE_EVENTS = 100
const WINDOW_PAST_MS = 24 * 60 * 60 * 1000
const WINDOW_FUTURE_MS = 7 * 24 * 60 * 60 * 1000

function readConfig(env) {
  return {
    serviceKey: String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    supabaseUrl: String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim(),
  }
}

function safeText(value, max = 500) {
  const text = String(value ?? '').trim()
  return text && text.length <= max ? text : ''
}

function inRosterWindow(sessionAt, now) {
  const time = new Date(sessionAt).getTime()
  if (Number.isNaN(time)) return false
  const current = now.getTime()
  return time >= current - WINDOW_PAST_MS && time <= current + WINDOW_FUTURE_MS
}

function operationalProfile(person) {
  const profile = {}
  for (const field of ['objective', 'experience', 'context', 'precaution', 'observe']) {
    const value = safeText(person?.[field], 500)
    if (value) profile[field] = value
  }
  return profile
}

function trialKey(coachId, reference, sessionAt) {
  const time = new Date(sessionAt).toISOString()
  return `${safeText(coachId, 120)}:${safeText(reference, 120)}:${time}`
}

function briefByTrial(rows) {
  const result = new Map()
  for (const row of rows || []) {
    if (row?.event_type !== 'trial.brief.prepared' || row?.source !== 'coachbrief') continue
    const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {}
    const reference = safeText(payload.trial_reference, 120)
    const sessionAt = safeText(payload.session_at, 80)
    const coachId = safeText(payload.coach_id, 120)
    if (!reference || !sessionAt || !coachId || Number.isNaN(new Date(sessionAt).getTime())) continue
    result.set(trialKey(coachId, reference, sessionAt), {
      source: safeText(payload.brief_source, 40),
      profile: operationalProfile(payload.profile),
    })
  }
  return result
}

/** Reduce eventos al mínimo que necesita el coach asignado; nunca infiere por nombre. */
export function toCoachTrialRosterItem(row, coachId, now = new Date(), briefs = new Map()) {
  if (row?.event_type !== 'trial.confirmed' || row?.source !== 'wodbuster') return null
  const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {}
  if (safeText(payload.coach_id, 120) !== safeText(coachId, 120)) return null
  const person = payload.person && typeof payload.person === 'object' ? payload.person : {}
  const personReference = safeText(person.reference, 120)
  const sessionAt = safeText(person.sessionAt, 80)
  if (!personReference || !sessionAt || !inRosterWindow(sessionAt, now)) return null
  const linkedBrief = briefs.get(trialKey(coachId, personReference, sessionAt))
  return {
    sourceEventId: safeText(row.event_id, 80),
    personReference,
    sessionAt: new Date(sessionAt).toISOString(),
    classLabel: safeText(person.classLabel, 120) || safeText(person.phase, 120) || 'Clase de prueba',
    profile: { ...operationalProfile(person), ...(linkedBrief?.profile || {}) },
    briefSource: linkedBrief?.source || '',
  }
}

/** Lectura privada: no marca asistencia, no altera reservas y no devuelve contacto ni notas. */
export function createCoachTrialRosterHandler({
  createClientImpl = createClient,
  requireCapabilityImpl = requireEvoCapability,
  checkRateLimitImpl = checkAdminRateLimit,
  readConfigImpl = readConfig,
  requestIdImpl = randomUUID,
  nowImpl = () => new Date(),
} = {}) {
  return async function coachTrialRosterHandler(req, res) {
    const requestId = requestIdImpl()
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed', requestId })
    const origin = getRequestOrigin(req)
    const isDev = process.env.NODE_ENV === 'development'
    if (!(isDev && !origin) && !isEvoOriginAllowed(origin)) return res.status(403).json({ error: 'origin_not_allowed', requestId })
    let identity
    try { identity = await requireCapabilityImpl(req, 'coach.workspace.access') } catch (error) {
      const response = capabilityAuthErrorResponse(error)
      return res.status(response.status).json({ ...response.body, requestId })
    }
    const config = readConfigImpl(process.env)
    if (!config.supabaseUrl || !config.serviceKey) return res.status(503).json({ error: 'trial_roster_not_configured', requestId })
    const supabase = createClientImpl(config.supabaseUrl, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    try {
      const exceeded = await checkRateLimitImpl(supabase, req, { endpoint: '/api/coach-trial-roster', limit: 30, windowMinutes: 10 })
      if (exceeded) return res.status(429).json({ error: 'rate_limit_exceeded', retry_after_seconds: 600, requestId })
    } catch { return res.status(503).json({ error: 'rate_limit_unavailable', requestId }) }
    try {
      const { data, error } = await supabase.from('evo_events')
        .select('event_id,event_type,occurred_at,source,organization_id,payload')
        .eq('organization_id', identity.organizationId)
        .in('event_type', ['trial.confirmed', 'trial.brief.prepared'])
        .order('occurred_at', { ascending: false })
        .limit(MAX_SOURCE_EVENTS)
      if (error || !Array.isArray(data)) throw error || new Error('invalid_event_response')
      const briefs = briefByTrial(data)
      const roster = data.map((row) => toCoachTrialRosterItem(row, identity.user.id, nowImpl(), briefs)).filter(Boolean)
        .sort((left, right) => new Date(left.sessionAt).getTime() - new Date(right.sessionAt).getTime())
      return res.status(200).json({ ok: true, roster, sent: false, requestId })
    } catch { return res.status(503).json({ error: 'trial_roster_unavailable', requestId }) }
  }
}

export default createCoachTrialRosterHandler()
