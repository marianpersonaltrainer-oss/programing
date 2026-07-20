/**
 * Autenticación para POST /api/method-rule en modo seguro (V2 programmer/admin).
 */

import { createClient } from '@supabase/supabase-js'

const PROGRAMMER_ROLES = new Set(['programmer', 'admin', 'head_coach'])

export function isMethodRuleSecureModeEnabled() {
  const v = String(process.env.METHOD_RULE_SECURE_MODE || '')
    .trim()
    .toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

function getSupabaseAnon() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const anon = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim()
  if (!url || !anon) return null
  return createClient(url, anon, { auth: { persistSession: false } })
}

function getSupabaseService() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<{ ok: true, userId: string, orgId: string|null, role: string } | { ok: false, status: number, error: string }>}
 */
export async function verifyMethodRuleCaller(req) {
  const authHeader = String(req.headers?.authorization || '').trim()
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) {
    return { ok: false, status: 401, error: 'missing_bearer_token' }
  }

  const anonClient = getSupabaseAnon()
  if (!anonClient) {
    return { ok: false, status: 500, error: 'supabase_not_configured' }
  }

  const { data: userData, error: userError } = await anonClient.auth.getUser(token)
  if (userError || !userData?.user?.id) {
    return { ok: false, status: 401, error: 'invalid_token' }
  }

  const userId = userData.user.id
  const service = getSupabaseService()
  if (!service) {
    return { ok: false, status: 500, error: 'supabase_service_not_configured' }
  }

  const { data: profile, error: profileError } = await service
    .from('profiles')
    .select('role, org_id')
    .eq('id', userId)
    .maybeSingle()

  if (profileError || !profile) {
    return { ok: false, status: 403, error: 'profile_not_found' }
  }

  const role = String(profile.role || '').trim()
  if (!PROGRAMMER_ROLES.has(role)) {
    return { ok: false, status: 403, error: 'insufficient_role' }
  }

  return {
    ok: true,
    userId,
    orgId: profile.org_id || null,
    role,
  }
}

/**
 * Llamadas internas server-to-server (p. ej. futuro worker) con service role header.
 * No expone secreto al frontend.
 */
export function isInternalServiceCall(req) {
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const auth = String(req.headers?.authorization || '').trim()
  if (!serviceKey || !auth.startsWith('Bearer ')) return false
  return auth.slice(7).trim() === serviceKey
}
