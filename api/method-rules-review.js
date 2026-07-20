/**
 * GET/POST /api/method-rules-review
 *
 * Centro V2 de revisión del método. Siempre exige JWT y rol autorizado.
 * No depende de METHOD_RULE_SECURE_MODE y no expone service_role al cliente.
 */
import { createClient } from '@supabase/supabase-js'
import { checkRateLimitViaSupabase, getClientIp } from './lib/checkRateLimit.js'
import { verifyMethodRuleCaller } from './lib/methodRuleAuth.js'
import {
  groupMethodRulesForReview,
  validateMethodRuleReviewCommand,
} from './lib/methodRuleReview.js'

const SELECT_COLUMNS = [
  'id',
  'created_at',
  'updated_at',
  'rule_type',
  'trigger_context',
  'rule_text',
  'source',
  'confidence',
  'active',
  'rule_status',
  'rule_validity',
  'rule_strength',
  'rule_origin',
  'rule_key',
  'org_id',
  'season_key',
  'mesocycle_key',
  'week_number',
  'valid_from',
  'valid_to',
  'day_of_week',
  'class_types',
  'room_key',
  'time_slot',
  'priority',
  'version',
  'supersedes_id',
  'change_reason',
  'metadata',
].join(',')

function getServiceClient() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  try {
    return JSON.parse(String(req.body || '{}'))
  } catch {
    return null
  }
}

function looksLikeMissingMigration(error) {
  return /column|schema cache|function .* does not exist|pe2_review_method_rule_group/i.test(
    String(error?.message || ''),
  )
}

async function canReviewUnscopedRules(service, orgId) {
  const configured = String(process.env.EVO_DEFAULT_ORG_ID || '').trim()
  if (configured) return configured === String(orgId)

  const { count, error } = await service
    .from('organizations')
    .select('id', { count: 'exact', head: true })
  return !error && count === 1
}

async function loadReviewData(service, caller) {
  const includeUnscoped = await canReviewUnscopedRules(service, caller.orgId)
  let query = service
    .from('method_rules')
    .select(SELECT_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(500)

  query = includeUnscoped
    ? query.or(`org_id.eq.${caller.orgId},org_id.is.null`)
    : query.eq('org_id', caller.orgId)

  const { data, error } = await query
  if (error) throw error

  return {
    ...groupMethodRulesForReview(data || []),
    access: {
      orgId: caller.orgId,
      includesUnscopedLegacy: includeUnscoped,
      unscopedReason: includeUnscoped
        ? 'single_or_default_org'
        : 'hidden_until_default_org_is_configured',
    },
  }
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
  }

  const ip = getClientIp(req)
  try {
    const { exceeded } = await checkRateLimitViaSupabase({
      ip,
      endpoint: 'method-rules-review',
      limit: req.method === 'GET' ? 80 : 30,
      windowMinutes: 10,
    })
    if (exceeded) return res.status(429).json({ ok: false, error: 'rate_limit_exceeded' })
  } catch (error) {
    console.warn('[method-rules-review] rate limit check failed:', error.message)
  }

  const caller = await verifyMethodRuleCaller(req)
  if (!caller.ok) return res.status(caller.status).json({ ok: false, error: caller.error })
  if (!caller.orgId) return res.status(403).json({ ok: false, error: 'organization_required' })

  const service = getServiceClient()
  if (!service) return res.status(500).json({ ok: false, error: 'supabase_service_not_configured' })

  if (req.method === 'GET') {
    try {
      const review = await loadReviewData(service, caller)
      return res.status(200).json({ ok: true, review })
    } catch (error) {
      if (looksLikeMissingMigration(error)) {
        return res.status(503).json({
          ok: false,
          error: 'migration_required',
          detail: 'El Centro de revisión está listo, pero falta aplicar las migraciones de method_rules.',
        })
      }
      return res.status(500).json({ ok: false, error: 'review_load_failed' })
    }
  }

  const body = parseBody(req)
  if (!body) return res.status(400).json({ ok: false, error: 'invalid_json' })
  const validation = validateMethodRuleReviewCommand(body)
  if (!validation.ok) {
    return res.status(validation.status).json({ ok: false, error: validation.error })
  }

  const command = validation.value
  const payload = {
    action: command.action,
    orgId: caller.orgId,
    reviewerId: caller.userId,
    sourceIds: command.sourceIds,
    canonicalId: command.canonicalId,
    ruleKey: command.ruleKey || null,
    ruleText: command.ruleText || null,
    ruleType: command.ruleType || null,
    validity: command.validity || null,
    strength: command.strength || null,
    validFrom: command.validFrom || null,
    validTo: command.validTo || null,
    mesocycleKey: command.mesocycleKey || null,
    weekNumber: command.weekNumber,
    dayOfWeek: command.dayOfWeek || [],
    classTypes: command.classTypes || [],
    roomKey: command.roomKey || null,
    timeSlot: command.timeSlot || null,
    changeReason: command.changeReason || 'revision_centro_metodo',
  }

  const { data, error } = await service.rpc('pe2_review_method_rule_group', { payload })
  if (error) {
    if (looksLikeMissingMigration(error)) {
      return res.status(503).json({ ok: false, error: 'migration_required' })
    }
    console.warn('[method-rules-review] review command failed:', {
      code: error.code || null,
      action: command.action,
      sourceCount: command.sourceIds.length,
    })
    return res.status(400).json({ ok: false, error: 'review_command_failed' })
  }

  return res.status(200).json({ ok: true, result: data })
}
