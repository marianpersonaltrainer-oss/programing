import { createClient } from '@supabase/supabase-js'
import {
  adminSecretsMatch,
  checkAdminRateLimit,
} from './lib/evoAdminAuth.js'
import { normalizeProgrammingHeadCoachInbox } from './lib/programmingHeadCoachInbox.js'

function parseBody(req) {
  const raw = req.body
  if (raw == null || raw === '') return {}
  if (Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString('utf8') || '{}')
    } catch {
      return null
    }
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return typeof raw === 'object' ? raw : null
}

function configFromEnv(env) {
  const supabaseUrl = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim()
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const ingestSecret = String(env.HEAD_COACH_INBOX_INGEST_SECRET || '').trim()
  if (!supabaseUrl || !serviceKey || !ingestSecret) return null
  return { supabaseUrl, serviceKey, ingestSecret }
}

export function createHeadCoachProgrammingInboxHandler({
  createClientImpl = createClient,
  checkRateLimitImpl = checkAdminRateLimit,
  env = process.env,
} = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ error: 'method_not_allowed' })
    }

    const config = configFromEnv(env)
    if (!config) return res.status(503).json({ error: 'inbox_not_configured' })

    const provided = String(req.headers?.['x-head-coach-inbox-secret'] || '').trim()
    if (!adminSecretsMatch(provided, config.ingestSecret)) {
      return res.status(401).json({ error: 'unauthorized' })
    }

    const body = parseBody(req)
    if (body === null) return res.status(400).json({ error: 'invalid_json' })
    if (Buffer.byteLength(JSON.stringify(body), 'utf8') > 16_384) {
      return res.status(413).json({ error: 'payload_too_large' })
    }

    let payload
    try {
      payload = normalizeProgrammingHeadCoachInbox(body)
    } catch {
      return res.status(400).json({ error: 'invalid_inbox_packet' })
    }

    const supabase = createClientImpl(config.supabaseUrl, config.serviceKey, {
      auth: { persistSession: false },
    })
    try {
      const exceeded = await checkRateLimitImpl(supabase, req, {
        endpoint: '/api/head-coach-programming-inbox',
        limit: 12,
        windowMinutes: 10,
      })
      if (exceeded) {
        return res.status(429).json({
          error: 'rate_limit_exceeded',
          retry_after_seconds: 600,
        })
      }
    } catch {
      return res.status(503).json({ error: 'rate_limit_unavailable' })
    }

    const { error } = await supabase.from('programming_agent_inbox').upsert(
      {
        week_start_date: payload.week_start_date,
        source: payload.source,
        payload,
        received_at: new Date().toISOString(),
      },
      { onConflict: 'week_start_date' },
    )
    if (error) return res.status(503).json({ error: 'inbox_storage_unavailable' })

    return res.status(200).json({
      ok: true,
      stored: true,
      week_start_date: payload.week_start_date,
    })
  }
}

export default createHeadCoachProgrammingInboxHandler()
