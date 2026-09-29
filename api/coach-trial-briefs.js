import { timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { normalizeCoachTrialBrief, CoachTrialBriefError } from '../src/domain/operations/coachTrialBriefIntake.js'
import { nucleusRecorderErrorResponse, recordNucleusEvent } from './lib/nucleusEventRecorder.js'

function parse(req) { try { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {} } catch { return null } }
function config(env) { return { enabled: String(env.COACH_TRIAL_BRIEF_ENABLED || '').toLowerCase() === 'true', secret: String(env.COACH_TRIAL_BRIEF_SECRET || ''), organizationId: String(env.EVO_ORGANIZATION_ID || ''), serviceKey: String(env.SUPABASE_SERVICE_ROLE_KEY || ''), supabaseUrl: String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '') } }
function matches(received, expected) { const a = Buffer.from(String(received || '')); const b = Buffer.from(String(expected || '')); return a.length > 0 && a.length === b.length && timingSafeEqual(a, b) }

export function createCoachTrialBriefsHandler({ createClientImpl = createClient, recordEventImpl = recordNucleusEvent, readConfigImpl = config, nowImpl = () => new Date(), requestIdImpl = () => crypto.randomUUID() } = {}) {
  return async function handler(req, res) {
    const requestId = requestIdImpl()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed', requestId })
    const settings = readConfigImpl(process.env)
    if (!settings.enabled || !settings.secret || !settings.organizationId || !settings.serviceKey || !settings.supabaseUrl) return res.status(404).json({ error: 'coach_trial_briefs_disabled', requestId })
    if (!matches(req.headers?.['x-evo-trial-brief-key'], settings.secret)) return res.status(401).json({ error: 'brief_source_unauthorized', requestId })
    const body = parse(req); if (!body) return res.status(400).json({ error: 'invalid_json', requestId })
    let brief; try { brief = normalizeCoachTrialBrief(body) } catch (error) { return res.status(400).json({ error: error instanceof CoachTrialBriefError ? error.code : 'invalid_trial_brief', requestId }) }
    const supabase = createClientImpl(settings.supabaseUrl, settings.serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
    try {
      const result = await recordEventImpl(supabase, { event_type: 'trial.brief.prepared', occurred_at: brief.occurredAt, observed_at: nowImpl().toISOString(), source: 'coachbrief', organization_id: settings.organizationId, person_id: null, external_id: brief.id, schema_version: 1, payload: { coach_id: brief.coachId, trial_reference: brief.trialReference, session_at: brief.sessionAt, class_label: brief.classLabel || null, brief_source: brief.source, profile: brief.brief }, idempotency_key: `coach-trial-brief:${brief.id}`, causation_id: null, source_updated_at: brief.occurredAt, reconciled_at: null, sync_status: 'synced' })
      return res.status(result.created ? 201 : 200).json({ ok: true, created: result.created, requestId })
    } catch (error) { const response = nucleusRecorderErrorResponse(error); return res.status(response.status).json({ ...response.body, requestId }) }
  }
}
export default createCoachTrialBriefsHandler()
