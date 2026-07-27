import { createClient } from '@supabase/supabase-js'
import { getRequestOrigin, isEvoOriginAllowed } from './lib/evoAllowedOrigins.js'
import {
  adminSecretsMatch,
  checkAdminRateLimit,
} from './lib/evoAdminAuth.js'

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
  if (typeof raw === 'object') return raw
  return null
}

export default async function handler(req, res) {
  const originValue = getRequestOrigin(req)
  const isDev = process.env.NODE_ENV === 'development'
  if (!(isDev && !originValue) && !isEvoOriginAllowed(originValue)) {
    return res.status(403).json({ error: 'origin_not_allowed' })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const body = parseBody(req)
  if (body === null) return res.status(400).json({ error: 'JSON inválido' })

  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const adminSecret = String(process.env.COACH_GUIDE_ADMIN_SECRET || '').trim()
  if (!serviceKey || !supabaseUrl || !adminSecret) {
    return res.status(500).json({
      error:
        'Falta SUPABASE_SERVICE_ROLE_KEY, URL de Supabase o COACH_GUIDE_ADMIN_SECRET.',
    })
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  try {
    const exceeded = await checkAdminRateLimit(supabase, req, {
      endpoint: '/api/programming-reference-context',
      limit: 30,
      windowMinutes: 10,
    })
    if (exceeded) {
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        retry_after_seconds: 600,
      })
    }
  } catch (error) {
    console.error('[programming-reference-context] rate limit unavailable:', error?.message || error)
    return res.status(503).json({ error: 'rate_limit_unavailable' })
  }

  if (!adminSecretsMatch(body.secret, adminSecret)) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const action = String(body.action || (Object.hasOwn(body, 'contextText') ? 'set' : 'get'))
  if (action === 'get') {
    const { data, error } = await supabase
      .from('programming_reference_context')
      .select('context_text, source, updated_at')
      .eq('id', 'default')
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({
      contextText: String(data?.context_text || ''),
      source: data?.source || null,
      updatedAt: data?.updated_at || null,
    })
  }

  if (action === 'set') {
    const contextText = String(body.contextText || '').trim()
    const source = String(body.source || 'manual').trim().slice(0, 120) || 'manual'

    const { error } = await supabase.from('programming_reference_context').upsert(
      {
        id: 'default',
        context_text: contextText,
        source,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(400).json({ error: 'invalid_action' })
}
