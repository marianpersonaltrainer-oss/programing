import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  capabilityAuthErrorResponse,
  requireEvoCapability,
} from './lib/evoCapabilityAuth.js'
import { checkAdminRateLimit } from './lib/evoAdminAuth.js'
import { getRequestOrigin, isEvoOriginAllowed } from './lib/evoAllowedOrigins.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ALLOWED_ACTIONS = new Set(['list', 'invite', 'set_status'])

function parseBody(req) {
  try {
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8') || '{}')
    if (typeof req.body === 'string') return JSON.parse(req.body || '{}')
    return req.body && typeof req.body === 'object' ? req.body : {}
  } catch {
    return null
  }
}

function readConfig(env) {
  return {
    serviceKey: String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    supabaseUrl: String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim(),
  }
}

function normalizeInvite(body) {
  const email = String(body?.email || '').trim().toLowerCase()
  const fullName = String(body?.fullName || '').trim().replace(/\s+/g, ' ')
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return null
  if (fullName.length < 2 || fullName.length > 120) return null
  return { email, fullName }
}

function normalizeStatusChange(body) {
  const userId = String(body?.userId || '').trim()
  const status = String(body?.status || '').trim().toLowerCase()
  if (!UUID_PATTERN.test(userId) || !['active', 'inactive'].includes(status)) return null
  return { userId, status }
}

async function listCoachMemberships(supabase, organizationId) {
  const { data: memberships, error: membershipError } = await supabase
    .from('evo_memberships')
    .select('user_id, status, source, created_at, updated_at')
    .eq('organization_id', organizationId)
    .eq('role_key', 'coach')
    .order('created_at', { ascending: true })
  if (membershipError) throw new Error('membership_read_failed')

  const userIds = [...new Set((memberships || []).map((row) => row.user_id).filter(Boolean))]
  let profiles = []
  if (userIds.length) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds)
    if (error) throw new Error('profile_read_failed')
    profiles = data || []
  }

  const profileById = new Map(profiles.map((row) => [row.id, row]))
  const authUsers = await Promise.all(userIds.map(async (userId) => {
    const { data, error } = await supabase.auth.admin.getUserById(userId)
    if (error) return [userId, null]
    return [userId, data?.user || null]
  }))
  const authById = new Map(authUsers)

  return (memberships || []).map((membership) => ({
    userId: membership.user_id,
    fullName: profileById.get(membership.user_id)?.full_name || '',
    email: authById.get(membership.user_id)?.email || '',
    status: membership.status,
    source: membership.source,
    createdAt: membership.created_at,
    updatedAt: membership.updated_at,
  }))
}

async function findAuthUserByEmail(supabase, email) {
  const perPage = 1000
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error('identity_user_lookup_failed')
    const users = data?.users || []
    const match = users.find((user) => String(user?.email || '').trim().toLowerCase() === email)
    if (match?.id) return match
    if (users.length < perPage) return null
  }
  throw new Error('identity_user_lookup_failed')
}

async function inviteCoach(supabase, identity, invite, redirectTo) {
  const { data: invitation, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
    invite.email,
    {
      redirectTo,
      data: { full_name: invite.fullName },
    },
  )
  let userId = invitation?.user?.id
  let invited = Boolean(userId && !inviteError)
  if (inviteError || !userId) {
    const normalizedMessage = String(inviteError?.message || '').toLowerCase()
    if (normalizedMessage.includes('already') || normalizedMessage.includes('registered')) {
      const existingUser = await findAuthUserByEmail(supabase, invite.email)
      if (!existingUser?.id) throw new Error('user_already_registered')
      userId = existingUser.id
      invited = false
    } else {
      throw new Error('invite_failed')
    }
  }

  try {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      full_name: invite.fullName,
    }, { onConflict: 'id' })
    if (profileError) throw new Error('profile_write_failed')

    const { error: membershipError } = await supabase.from('evo_memberships').upsert({
      user_id: userId,
      organization_id: identity.organizationId,
      role_key: 'coach',
      status: 'active',
      source: 'admin_invitation',
      assigned_by: identity.user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,organization_id,role_key' })
    if (membershipError) throw new Error('membership_write_failed')
  } catch (error) {
    // Compensación segura: solo elimina el usuario recién creado por esta
    // invitación si no fue posible concederle una membership válida.
    if (invited) await supabase.auth.admin.deleteUser(userId).catch(() => {})
    throw error
  }

  return { userId, invited }
}

async function setCoachStatus(supabase, identity, change) {
  const { data, error } = await supabase
    .from('evo_memberships')
    .update({
      status: change.status,
      assigned_by: identity.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', change.userId)
    .eq('organization_id', identity.organizationId)
    .eq('role_key', 'coach')
    .select('user_id, status')
    .maybeSingle()
  if (error) throw new Error('membership_write_failed')
  if (!data) throw new Error('coach_membership_not_found')
  return data
}

function operationError(error) {
  const code = String(error?.message || '')
  if (code === 'user_already_registered') return { status: 409, code }
  if (code === 'coach_membership_not_found') return { status: 404, code }
  if (code === 'membership_read_failed' || code === 'profile_read_failed' || code === 'identity_user_lookup_failed') {
    return { status: 503, code: 'identity_read_unavailable' }
  }
  if (code === 'invite_failed') return { status: 502, code }
  return { status: 503, code: 'identity_write_unavailable' }
}

export function createIdentityCoachesHandler({
  createClientImpl = createClient,
  requireCapabilityImpl = requireEvoCapability,
  checkRateLimitImpl = checkAdminRateLimit,
  readConfigImpl = readConfig,
  requestIdImpl = randomUUID,
  logger = console,
} = {}) {
  return async function identityCoachesHandler(req, res) {
    const requestId = requestIdImpl()
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed', requestId })
    }

    const originValue = getRequestOrigin(req)
    const isDev = process.env.NODE_ENV === 'development'
    if (!(isDev && !originValue) && !isEvoOriginAllowed(originValue)) {
      return res.status(403).json({ error: 'origin_not_allowed', requestId })
    }
    const trustedOrigin = originValue || 'http://localhost:5173'

    const body = parseBody(req)
    if (body === null) return res.status(400).json({ error: 'invalid_json', requestId })
    const action = String(body.action || '').trim()
    if (!ALLOWED_ACTIONS.has(action)) {
      return res.status(400).json({ error: 'invalid_action', requestId })
    }

    let identity
    try {
      identity = await requireCapabilityImpl(req, 'identity.manage')
    } catch (error) {
      const response = capabilityAuthErrorResponse(error)
      return res.status(response.status).json({ ...response.body, requestId })
    }

    const config = readConfigImpl(process.env)
    if (!config.supabaseUrl || !config.serviceKey) {
      return res.status(500).json({ error: 'identity_admin_not_configured', requestId })
    }
    const supabase = createClientImpl(config.supabaseUrl, config.serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })

    try {
      const exceeded = await checkRateLimitImpl(supabase, req, {
        endpoint: '/api/identity-coaches',
        limit: 30,
        windowMinutes: 10,
      })
      if (exceeded) {
        return res.status(429).json({
          error: 'rate_limit_exceeded',
          retry_after_seconds: 600,
          requestId,
        })
      }
    } catch {
      return res.status(503).json({ error: 'rate_limit_unavailable', requestId })
    }

    try {
      if (action === 'list') {
        const coaches = await listCoachMemberships(supabase, identity.organizationId)
        return res.status(200).json({ coaches, requestId })
      }

      if (action === 'invite') {
        const invite = normalizeInvite(body)
        if (!invite) return res.status(400).json({ error: 'invalid_invite', requestId })
        const redirectTo = `${new URL(trustedOrigin).origin}/?v2&reset-password=1`
        const result = await inviteCoach(supabase, identity, invite, redirectTo)
        logger.info?.('identity_coach_invited', { requestId, organizationId: identity.organizationId })
        return res.status(201).json({ ok: true, userId: result.userId, invited: result.invited, requestId })
      }

      const change = normalizeStatusChange(body)
      if (!change) return res.status(400).json({ error: 'invalid_status_change', requestId })
      const membership = await setCoachStatus(supabase, identity, change)
      logger.info?.('identity_coach_status_changed', {
        requestId,
        organizationId: identity.organizationId,
        status: membership.status,
      })
      return res.status(200).json({ ok: true, membership, requestId })
    } catch (error) {
      const response = operationError(error)
      logger.warn?.('identity_coach_operation_failed', { requestId, code: response.code })
      return res.status(response.status).json({ error: response.code, requestId })
    }
  }
}

export default createIdentityCoachesHandler()
