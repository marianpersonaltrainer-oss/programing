import { createClient } from '@supabase/supabase-js'
import { adminSecretsMatch, checkAdminRateLimit } from './lib/evoAdminAuth.js'
import { feedbackPeriod, summarizeAtlasFeedback } from './lib/atlasFeedbackSummary.js'

async function loadRows({ supabase, start, end }) {
  const weekResult = await supabase.from('published_weeks')
    .select('id,week_start_date').gte('week_start_date', start).lte('week_start_date', end).limit(64)
  if (weekResult.error) throw new Error('week_read_failed')
  const weekRows = weekResult.data || []
  const weekIds = weekRows.map((row) => row.id).filter(Boolean)
  if (!weekIds.length) return { weekRows, feedbackRows: [] }
  const feedbackResult = await supabase.from('coach_session_feedback')
    .select('week_id,class_label,session_how,time_for_explanation,changed_something,changed_details,group_feelings,notes_next_week')
    .in('week_id', weekIds).order('created_at', { ascending: true }).limit(500)
  if (feedbackResult.error) throw new Error('feedback_read_failed')
  return { weekRows, feedbackRows: feedbackResult.data || [] }
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body)
  return {}
}

export function createAtlasFeedbackSummary({
  env = process.env,
  now = () => new Date(),
  createClientImpl = createClient,
  load = loadRows,
  rateLimit = checkAdminRateLimit,
} = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
    const expected = String(env.ATLAS_FEEDBACK_READ_SECRET || '')
    if (!adminSecretsMatch(req.headers?.['x-atlas-feedback-secret'], expected)) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'server_not_configured' })
    }
    let body
    try {
      body = parseBody(req)
    } catch {
      return res.status(400).json({ error: 'invalid_body' })
    }
    const weeks = body.weeks == null ? 6 : Number(body.weeks)
    let period
    try {
      period = feedbackPeriod(now(), weeks)
    } catch {
      return res.status(400).json({ error: 'invalid_window' })
    }
    try {
      const supabase = createClientImpl(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      if (await rateLimit(supabase, req, {
        endpoint: '/api/atlas-feedback-summary', limit: 12, windowMinutes: 10,
      })) return res.status(429).json({ error: 'retry_later' })
      const loaded = await load({ supabase, ...period })
      const summary = summarizeAtlasFeedback({ ...loaded, ...period })
      return res.status(200).json({ ok: true, summary })
    } catch {
      return res.status(503).json({ error: 'summary_unavailable' })
    }
  }
}

export default createAtlasFeedbackSummary()
