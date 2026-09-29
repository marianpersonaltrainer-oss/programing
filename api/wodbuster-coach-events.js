import { timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { normalizeWodBusterCoachEvent, WodBusterCoachEventError } from '../src/domain/operations/wodBusterCoachEventIntake.js'
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
    enabled: String(env.WODBUSTER_COACH_EVENTS_ENABLED || '').trim().toLowerCase() === 'true',
    individualCoachAccess: String(env.COACH_INDIVIDUAL_AUTH_ENABLED || '').trim().toLowerCase() === 'true',
    secret: String(env.WODBUSTER_COACH_EVENTS_SECRET || '').trim(),
    organizationId: String(env.EVO_ORGANIZATION_ID || '').trim(),
    serviceKey: String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    supabaseUrl: String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim(),
  }
}

function validSecret(received, expected) {
  const actual = Buffer.from(String(received || ''))
  const configured = Buffer.from(String(expected || ''))
  return actual.length > 0 && actual.length === configured.length && timingSafeEqual(actual, configured)
}

function normalizeCoachName(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('es-ES')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
}

function firstName(value) {
  const name = normalizeCoachName(value).split(' ')[0] || ''
  // Alias explícito y limitado al nombre real de Dani; la ambigüedad se sigue
  // bloqueando más abajo si hubiese dos entrenadores con el mismo nombre.
  return name === 'dani' ? 'daniel' : name
}

/**
 * Resuelve el nombre que llega desde WodBuster contra una membership activa.
 * No aceptamos un id arbitrario del origen: el id persistido es siempre la
 * identidad individual EVO. Ante una coincidencia dudosa, se bloquea el
 * evento para que una prueba no aparezca en el panel de otra persona.
 */
export function resolveWodBusterCoachAssignment(rows, sourceCoachName) {
  const needle = firstName(sourceCoachName)
  if (!needle) return { error: 'coach_assignment_missing' }
  const matches = (rows || []).filter((row) => {
    if (String(row?.status || '').toLowerCase() !== 'active') return false
    if (String(row?.role_key || '').toLowerCase() !== 'coach') return false
    const profile = Array.isArray(row?.profiles) ? row.profiles[0] : row?.profiles
    return firstName(profile?.full_name) === needle
  })
  if (matches.length !== 1) return { error: matches.length ? 'coach_assignment_ambiguous' : 'coach_assignment_not_found' }
  return { coachId: String(matches[0].user_id || '').trim() || null }
}

async function resolveCoachAssignment(supabase, organizationId, sourceCoachName) {
  const { data: memberships, error: membershipError } = await supabase
    .from('evo_memberships')
    .select('user_id,role_key,status')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .eq('role_key', 'coach')
    .limit(20)
  if (membershipError || !Array.isArray(memberships)) return { error: 'coach_assignment_unavailable' }
  const userIds = memberships.map((row) => row?.user_id).filter(Boolean)
  if (!userIds.length) return { error: 'coach_assignment_not_found' }
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id,full_name')
    .in('id', userIds)
  if (profileError || !Array.isArray(profiles)) return { error: 'coach_assignment_unavailable' }
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  return resolveWodBusterCoachAssignment(
    memberships.map((membership) => ({ ...membership, profiles: profileById.get(membership.user_id) || null })),
    sourceCoachName,
  )
}

export function createWodBusterCoachEventsHandler({
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
    if (!settings.enabled || !settings.individualCoachAccess) return res.status(404).json({ error: 'wodbuster_coach_events_disabled', requestId })
    if (!settings.secret || !settings.organizationId || !settings.supabaseUrl || !settings.serviceKey) return res.status(503).json({ error: 'wodbuster_coach_events_not_configured', requestId })
    if (!validSecret(req.headers?.['x-evo-wodbuster-key'], settings.secret)) return res.status(401).json({ error: 'wodbuster_source_unauthorized', requestId })
    const body = parseBody(req)
    if (body === null) return res.status(400).json({ error: 'invalid_json', requestId })
    let event
    try { event = normalizeWodBusterCoachEvent(body) } catch (error) {
      return res.status(400).json({ error: error instanceof WodBusterCoachEventError ? error.code : 'invalid_wodbuster_coach_event', requestId })
    }
    const supabase = createClientImpl(settings.supabaseUrl, settings.serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    try {
      const assignment = await resolveCoachAssignment(supabase, settings.organizationId, event.coachName)
      if (!assignment.coachId) return res.status(422).json({ error: assignment.error || 'coach_assignment_unavailable', requestId })
      const result = await recordEventImpl(supabase, {
        event_type: event.type,
        occurred_at: event.occurredAt,
        observed_at: nowImpl().toISOString(),
        source: 'wodbuster',
        organization_id: settings.organizationId,
        person_id: null,
        external_id: event.id,
        schema_version: 1,
        payload: { coach_id: assignment.coachId, coach_name: event.coachName || null, person: event.person, observation: event.observation || null, adaptation: event.adaptation || null, note: event.note || null },
        idempotency_key: `wodbuster-coach:${event.id}`,
        causation_id: null,
        source_updated_at: event.occurredAt,
        reconciled_at: null,
        sync_status: 'synced',
      })
      logger.info?.('wodbuster_coach_event_recorded', { requestId, type: event.type, created: result.created })
      return res.status(result.created ? 201 : 200).json({ ok: true, created: result.created, eventType: result.event.event_type, requestId })
    } catch (error) {
      const response = nucleusRecorderErrorResponse(error)
      logger.warn?.('wodbuster_coach_event_failed', { requestId, code: response.body.error })
      return res.status(response.status).json({ ...response.body, requestId })
    }
  }
}

export default createWodBusterCoachEventsHandler()
