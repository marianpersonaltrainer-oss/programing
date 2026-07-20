/**
 * Carga method_rules desde Supabase (service role) con filtros mínimos.
 * Uso interno del servidor — no expone endpoint público.
 */

import { createClient } from '@supabase/supabase-js'

const SELECT_COLUMNS = [
  'id',
  'rule_text',
  'rule_type',
  'trigger_context',
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
  'confidence',
  'active',
  'source',
  'created_at',
  'updated_at',
].join(',')

function getSupabaseAdmin() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * @param {{ orgId?: string|null, limit?: number }} [opts]
 * @returns {Promise<{ rules: object[], error: Error|null, fromCache: boolean }>}
 */
export async function loadMethodRules(opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 500, 1), 1000)
  const orgId = opts.orgId || null

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return {
      rules: [],
      error: new Error('missing_supabase_config'),
      fromCache: false,
    }
  }

  let query = supabase.from('method_rules').select(SELECT_COLUMNS).order('id', { ascending: true }).limit(limit)

  if (orgId) {
    query = query.or(`org_id.eq.${orgId},org_id.is.null`)
  }

  const { data, error } = await query

  if (error) {
    return { rules: [], error, fromCache: false }
  }

  return { rules: data || [], error: null, fromCache: false }
}

/** Resuelve org_id por defecto (EVO) desde env — sin query remota obligatoria. */
export function resolveDefaultOrgId() {
  return (process.env.EVO_DEFAULT_ORG_ID || '').trim() || null
}
