import { createClient } from '@supabase/supabase-js'
import { adminSecretsMatch, checkAdminRateLimit } from './lib/evoAdminAuth.js'
import { isMissingPublicationStatusError, withInferredPublicationStatus } from '../src/utils/publishedWeeksLegacy.js'

const MAX_RESPONSE_BYTES = 256_000

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body)
  return {}
}

function isMondayIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value && date.getUTCDay() === 1
}

async function loadPublishedWeek({ supabase, weekStartDate, activeOnly = false }) {
  const select = 'week_start_date, mesociclo, semana, titulo, published_at, publication_status, is_active, data'
  let query = supabase.from('published_weeks')
    .select(select)
    .eq('publication_status', 'published')
  query = activeOnly ? query.eq('is_active', true) : query.eq('week_start_date', weekStartDate)
  let result = await query.limit(2)

  if (result.error && isMissingPublicationStatusError(result.error)) {
    let legacyQuery = supabase.from('published_weeks')
      .select('week_start_date, mesociclo, semana, titulo, published_at, is_active, data')
    legacyQuery = activeOnly ? legacyQuery.eq('is_active', true) : legacyQuery
      .eq('week_start_date', weekStartDate).eq('is_active', true)
    result = await legacyQuery.limit(2)
  }
  if (result.error) throw new Error('week_read_failed')
  const rows = (result.data || []).map(withInferredPublicationStatus)
  if (rows.length !== 1 || rows[0].publication_status !== 'published') {
    throw new Error('week_not_found_or_ambiguous')
  }
  const { week_start_date, mesociclo, semana, titulo, published_at, data } = rows[0]
  return { week_start_date, mesociclo, semana, titulo, published_at, data }
}

export function createAtlasPublishedWeek({
  env = process.env,
  createClientImpl = createClient,
  load = loadPublishedWeek,
  rateLimit = checkAdminRateLimit,
} = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
    const expected = String(env.ATLAS_PROGRAMMING_READ_SECRET || '')
    if (!adminSecretsMatch(req.headers?.['x-atlas-programming-secret'], expected)) {
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
    const weekStartDate = String(body.week_start_date || '')
    const activeOnly = body.selection === 'active'
    if ((activeOnly && weekStartDate) || (!activeOnly && !isMondayIsoDate(weekStartDate))) {
      return res.status(400).json({ error: 'invalid_week_start_date' })
    }
    try {
      const supabase = createClientImpl(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      if (await rateLimit(supabase, req, {
        endpoint: '/api/atlas-published-week', limit: 8, windowMinutes: 10,
      })) return res.status(429).json({ error: 'retry_later' })
      const week = await load({ supabase, weekStartDate, activeOnly })
      if (Buffer.byteLength(JSON.stringify(week), 'utf8') > MAX_RESPONSE_BYTES) {
        return res.status(413).json({ error: 'week_payload_too_large' })
      }
      return res.status(200).json({ ok: true, week })
    } catch (error) {
      if (error?.message === 'week_not_found_or_ambiguous') {
        return res.status(404).json({ error: 'week_not_found_or_ambiguous' })
      }
      return res.status(503).json({ error: 'week_unavailable' })
    }
  }
}

export default createAtlasPublishedWeek()
