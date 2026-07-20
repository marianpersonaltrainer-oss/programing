/**
 * POST /api/method-rule
 * Persiste una regla aprendida en Supabase `method_rules` (service role).
 *
 * Body JSON: { rule_text, trigger_context?, rule_type?, confidence?, rule_key? }
 *
 * Modo legacy (default): sin auth — riesgo documentado; V1 EditModal sigue funcionando.
 * Modo seguro (METHOD_RULE_SECURE_MODE=true): JWT programador/admin V2;
 *   inserta rule_status=pending_review, rule_origin=correction, org_id del perfil.
 */
import { createClient } from '@supabase/supabase-js'
import { checkRateLimitViaSupabase, getClientIp } from './lib/checkRateLimit.js'
import {
  isInternalServiceCall,
  isMethodRuleSecureModeEnabled,
  verifyMethodRuleCaller,
} from './lib/methodRuleAuth.js'
import { RULE_STATUSES } from './lib/methodRuleConstants.js'

const VALID_RULE_TYPES = new Set(['timing', 'load', 'exercise', 'format', 'rest'])
const MAX_RULE_TEXT = 4000
const MAX_TRIGGER = 120

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  try {
    return JSON.parse(String(req.body || '{}'))
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
  }

  const ip = getClientIp(req)
  try {
    const { exceeded } = await checkRateLimitViaSupabase({
      ip,
      endpoint: 'method-rule',
      limit: 40,
      windowMinutes: 10,
    })
    if (exceeded) {
      return res.status(429).json({ ok: false, error: 'rate_limit_exceeded' })
    }
  } catch (e) {
    console.warn('[method-rule] rate limit check failed:', e.message)
  }

  const body = parseBody(req)
  if (!body) {
    return res.status(400).json({ ok: false, error: 'invalid_json' })
  }

  const text = String(body.rule_text || '').trim()
  if (!text) return res.status(400).json({ ok: false, error: 'rule_text requerido' })
  if (text.length > MAX_RULE_TEXT) {
    return res.status(400).json({ ok: false, error: 'rule_text demasiado largo' })
  }

  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  if (!serviceKey || !supabaseUrl) {
    return res.status(500).json({ ok: false, error: 'Servidor sin configurar: SUPABASE_SERVICE_ROLE_KEY y URL de Supabase.' })
  }

  const resolvedRuleType = VALID_RULE_TYPES.has(String(body.rule_type)) ? String(body.rule_type) : 'exercise'
  const triggerContext = String(body.trigger_context || 'edicion').slice(0, MAX_TRIGGER)
  const confidence = Math.min(100, Math.max(0, Number(body.confidence) || 70))

  const secureMode = isMethodRuleSecureModeEnabled()
  const internalCall = isInternalServiceCall(req)

  /** @type {{ userId?: string, orgId?: string|null }} */
  let caller = {}

  if (secureMode && !internalCall) {
    const auth = await verifyMethodRuleCaller(req)
    if (!auth.ok) {
      return res.status(auth.status).json({ ok: false, error: auth.error })
    }
    caller = { userId: auth.userId, orgId: auth.orgId }
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  /** @type {Record<string, unknown>} */
  let row

  if (secureMode) {
    const ruleKey = String(body.rule_key || '').trim() || null
    row = {
      rule_text: text,
      trigger_context: triggerContext,
      rule_type: resolvedRuleType,
      source: 'manual_edit',
      confidence,
      active: false,
      rule_status: 'pending_review',
      rule_origin: 'correction',
      rule_validity: 'permanent',
      rule_strength: 'preferred',
      rule_key: ruleKey,
      org_id: caller.orgId || (process.env.EVO_DEFAULT_ORG_ID || '').trim() || null,
      created_by: caller.userId || null,
      change_reason: String(body.change_reason || 'correccion_sesion').slice(0, 500),
    }
  } else {
    row = {
      rule_text: text,
      trigger_context: triggerContext,
      rule_type: resolvedRuleType,
      source: 'manual_edit',
      confidence,
      active: true,
    }
  }

  const { error } = await supabase.from('method_rules').insert(row)

  if (error) {
    if (secureMode && /column|schema cache/i.test(error.message)) {
      return res.status(503).json({
        ok: false,
        error: 'migration_required',
        detail: 'Aplica la migración method_rules_scope antes de METHOD_RULE_SECURE_MODE.',
      })
    }
    return res.status(500).json({ ok: false, error: error.message })
  }

  return res.status(200).json({
    ok: true,
    mode: secureMode ? 'secure' : 'legacy',
    status: secureMode ? RULE_STATUSES[1] : 'legacy_insert',
  })
}
