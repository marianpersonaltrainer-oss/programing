import { supabase } from './supabase.js'

const LEGACY_ROLE_CAPABILITIES = Object.freeze({
  admin: ['identity.manage'],
  coach: ['coach.workspace.access', 'programming.read_published'],
  programmer: ['programming.read_published', 'programming.manage'],
})

const IDENTITY_FOUNDATION_MISSING_CODES = new Set([
  '42P01',
  '42883',
  'PGRST202',
  'PGRST205',
])

export function isMissingIdentityFoundationError(error) {
  return IDENTITY_FOUNDATION_MISSING_CODES.has(String(error?.code || ''))
}

// El bridge legacy sólo se activa de forma consciente. En Preview/staging la
// ausencia del flag prueba que la autorización real procede de memberships.
// Production puede conservar temporalmente el flag como rollback hasta que su
// esquema quede verificado, sin conceder permisos por un fallo ordinario.
export function isLegacyIdentityFallbackEnabled(value) {
  return String(value || '').trim().toLowerCase() === 'true'
}

function uniqueRows(rows, keyOf) {
  const seen = new Set()
  return (rows || []).filter((row) => {
    const key = keyOf(row)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function uniqueValues(values) {
  return [...new Set((values || []).filter(Boolean))]
}

export function buildPe2Identity(
  profile,
  memberships = [],
  capabilityRows = [],
  source = 'multirole',
) {
  const activeMemberships = uniqueRows(
    memberships.filter((membership) => membership?.status === 'active'),
    (membership) => [
      membership.user_id,
      membership.organization_id,
      membership.role_key,
    ].join(':'),
  )
  const activeCapabilities = uniqueRows(
    capabilityRows.filter(
      (row) => row?.organization_id && row?.capability_key,
    ),
    (row) => `${row.organization_id}:${row.capability_key}`,
  )
  const organizationIds = uniqueValues([
    ...activeCapabilities.map((row) => row.organization_id),
    ...activeMemberships.map((membership) => membership.organization_id),
  ])

  return {
    source,
    profile: profile || null,
    memberships: activeMemberships,
    capabilityRows: activeCapabilities,
    capabilities: uniqueValues(activeCapabilities.map((row) => row.capability_key)),
    roles: uniqueValues(activeMemberships.map((membership) => membership.role_key)),
    organizationIds,
    // No existe una organización primaria implícita cuando la identidad tiene
    // más de un contexto. El consumidor debe elegirla de forma explícita.
    primaryOrganizationId: organizationIds.length === 1
      ? organizationIds[0]
      : organizationIds.length === 0
        ? profile?.org_id || null
        : null,
  }
}

export function buildLegacyPe2Identity(profile) {
  const organizationId = profile?.org_id || null
  const role = profile?.role || null
  const capabilities = LEGACY_ROLE_CAPABILITIES[role] || []
  const memberships = organizationId && role
    ? [{
        user_id: profile.id,
        organization_id: organizationId,
        role_key: role,
        status: 'active',
        source: 'legacy_fallback',
      }]
    : []
  const capabilityRows = organizationId
    ? capabilities.map((capabilityKey) => ({
        organization_id: organizationId,
        capability_key: capabilityKey,
      }))
    : []

  return buildPe2Identity(
    profile,
    memberships,
    capabilityRows,
    'legacy-fallback',
  )
}

export function identityHasCapability(identity, capabilityKey, organizationId) {
  if (!capabilityKey) return false
  const matches = (identity?.capabilityRows || []).filter(
    (row) => row.capability_key === capabilityKey,
  )
  if (organizationId) {
    return matches.some((row) => row.organization_id === organizationId)
  }
  return uniqueValues(matches.map((row) => row.organization_id)).length === 1
}

export function getIdentityOrganizationId(identity, capabilityKey) {
  if (!capabilityKey) return identity?.primaryOrganizationId || null
  const organizationIds = uniqueValues(
    identity?.capabilityRows
      ?.filter((row) => row.capability_key === capabilityKey)
      .map((row) => row.organization_id),
  )
  return organizationIds.length === 1 ? organizationIds[0] : null
}

export async function getPe2Session() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export function pe2ProfileSelect({ includeLegacyRole = false } = {}) {
  // profiles.role deja de viajar al cliente en la ruta normal. Solo se pide
  // durante el rollback explícitamente habilitado para instalaciones antiguas.
  return includeLegacyRole
    ? 'id, full_name, role, org_id'
    : 'id, full_name, org_id'
}

export async function getPe2Profile(userId, { includeLegacyRole = false } = {}) {
  if (!userId) return null
  const { data, error } = await supabase
    .from('profiles')
    .select(pe2ProfileSelect({ includeLegacyRole }))
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getPe2Memberships(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('evo_memberships')
    .select('user_id, organization_id, role_key, status, source')
    .eq('user_id', userId)
    .eq('status', 'active')
  if (error) throw error
  return data || []
}

export async function getPe2Capabilities() {
  const { data, error } = await supabase.rpc('evo_my_capabilities')
  if (error) throw error
  return data || []
}

export async function resolvePe2Identity({
  profile,
  userId,
  allowLegacyFallback = false,
  loadMemberships = getPe2Memberships,
  loadCapabilities = getPe2Capabilities,
}) {
  if (!userId) return buildPe2Identity(profile)

  try {
    const [memberships, capabilityRows] = await Promise.all([
      loadMemberships(userId),
      loadCapabilities(),
    ])
    return buildPe2Identity(profile, memberships, capabilityRows)
  } catch (error) {
    // Un error de permisos, red o datos nunca se traduce en autorización.
    if (!allowLegacyFallback || !isMissingIdentityFoundationError(error)) {
      throw error
    }
    return buildLegacyPe2Identity(profile)
  }
}

export async function getPe2Identity(userId, options = {}) {
  const allowLegacyFallback = options.allowLegacyFallback
    ?? isLegacyIdentityFallbackEnabled(
      import.meta.env.VITE_EVO_LEGACY_IDENTITY_FALLBACK_ENABLED,
    )
  const profile = await getPe2Profile(userId, {
    includeLegacyRole: allowLegacyFallback,
  })
  return resolvePe2Identity({ profile, userId, allowLegacyFallback })
}

export async function signInPe2(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  const identity = await getPe2Identity(data.user?.id)
  return {
    session: data.session,
    user: data.user,
    profile: identity.profile,
    identity,
  }
}

export async function signOutPe2() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function requestPe2PasswordReset(email, redirectTo) {
  const normalizedEmail = String(email || '').trim()
  if (!normalizedEmail) throw new Error('Falta el correo electrónico')
  const options = redirectTo ? { redirectTo } : undefined
  const { error } = await supabase.auth.resetPasswordForEmail(
    normalizedEmail,
    options,
  )
  if (error) throw error
}

export async function updatePe2Password(password) {
  const normalizedPassword = String(password || '')
  if (normalizedPassword.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres')
  }
  const { error } = await supabase.auth.updateUser({
    password: normalizedPassword,
  })
  if (error) throw error
}

export function onPe2AuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session, event)
  })
  return () => data.subscription.unsubscribe()
}
