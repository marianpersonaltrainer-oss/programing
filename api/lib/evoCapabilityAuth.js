import { createClient } from '@supabase/supabase-js'

const BEARER_TOKEN_RE = /^Bearer\s+([^\s]+)$/i

export class EvoCapabilityAuthError extends Error {
  constructor(code, status) {
    super(code)
    this.name = 'EvoCapabilityAuthError'
    this.code = code
    this.status = status
  }
}

export function readBearerToken(req) {
  const authorization = String(req?.headers?.authorization || '').trim()
  const match = authorization.match(BEARER_TOKEN_RE)
  const token = match?.[1] || ''
  return token.length <= 8192 ? token : ''
}

function readAuthConfig(env) {
  const url = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim()
  const anonKey = String(
    env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '',
  ).trim()
  if (!url || !anonKey) {
    throw new EvoCapabilityAuthError('identity_server_not_configured', 500)
  }
  return { url, anonKey }
}

/**
 * Valida el JWT contra Supabase Auth y resuelve la capability desde la RPC
 * protegida por auth.uid(). Nunca interpreta user_metadata ni usa
 * profiles.role como autorización server-side.
 */
export async function requireEvoCapability(
  req,
  capabilityKey,
  {
    organizationId = null,
    createClientImpl = createClient,
    env = process.env,
  } = {},
) {
  const token = readBearerToken(req)
  if (!token) {
    throw new EvoCapabilityAuthError('authentication_required', 401)
  }

  const capability = String(capabilityKey || '').trim()
  if (!capability) {
    throw new EvoCapabilityAuthError('capability_required', 500)
  }

  const { url, anonKey } = readAuthConfig(env)
  const supabase = createClientImpl(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user?.id) {
    throw new EvoCapabilityAuthError('authentication_required', 401)
  }

  const { data: rows, error: capabilityError } = await supabase.rpc(
    'evo_my_capabilities',
  )
  if (capabilityError) {
    throw new EvoCapabilityAuthError('identity_authorization_unavailable', 503)
  }

  const matches = (rows || []).filter((row) => (
    row?.capability_key === capability
    && row?.organization_id
    && (!organizationId || row.organization_id === organizationId)
  ))
  const organizationIds = [...new Set(
    matches.map((row) => row.organization_id),
  )]
  if (!organizationIds.length) {
    throw new EvoCapabilityAuthError('capability_denied', 403)
  }
  if (!organizationId && organizationIds.length > 1) {
    throw new EvoCapabilityAuthError('organization_context_required', 409)
  }

  return {
    user: userData.user,
    capability,
    organizationId: organizationId || organizationIds[0],
  }
}

export function capabilityAuthErrorResponse(error) {
  if (error instanceof EvoCapabilityAuthError) {
    return { status: error.status, body: { error: error.code } }
  }
  return {
    status: 503,
    body: { error: 'identity_authorization_unavailable' },
  }
}
