import { createClient } from '@supabase/supabase-js'

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

export const isMiCaminoSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

export const miCaminoSupabase = isMiCaminoSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null

export async function getMiCaminoSession() {
  if (!miCaminoSupabase) return null
  const { data, error } = await miCaminoSupabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function getMiCaminoCapabilities() {
  if (!miCaminoSupabase) return []
  const { data, error } = await miCaminoSupabase.rpc('evo_my_capabilities')
  if (error) return []
  return [...new Set((data || []).map((row) => row?.capability_key).filter(Boolean))]
}

export async function getMiCaminoProjection() {
  if (!miCaminoSupabase) return null
  const { data, error } = await miCaminoSupabase
    .from('mi_camino_projections')
    .select('id, organization_id, person_id, entry_mode, journey_day, stage_key, next_action, progress, freshness, schema_version, updated_at')
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return {
    projection_id: data.id,
    organization_id: data.organization_id,
    person_id: data.person_id,
    entry_mode: data.entry_mode,
    journey_day: data.journey_day,
    stage_key: data.stage_key,
    next_action: data.next_action,
    progress: data.progress,
    freshness: data.freshness,
    data_class: 'P2',
    schema_version: data.schema_version,
    updated_at: data.updated_at,
  }
}

export async function signInMiCamino(email, password) {
  if (!miCaminoSupabase) throw new Error('Mi Camino no está configurado todavía.')
  const { error } = await miCaminoSupabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function requestMiCaminoMagicLink(email) {
  if (!miCaminoSupabase) throw new Error('Mi Camino no está configurado todavía.')
  const origin = String(globalThis.location?.origin || '').trim()
  const pathname = String(globalThis.location?.pathname || '')
  const redirectPath = pathname.startsWith('/mi-camino') ? '/mi-camino' : '/'
  const { error } = await miCaminoSupabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}${redirectPath}`,
      // Nunca crea una cuenta al solicitar un enlace: solo sirve para identidades EVO existentes.
      shouldCreateUser: false,
    },
  })
  if (error) throw error
}

export async function signOutMiCamino() {
  if (!miCaminoSupabase) return
  const { error } = await miCaminoSupabase.auth.signOut()
  if (error) throw error
}

export async function requestMiCaminoPasswordReset(email) {
  if (!miCaminoSupabase) throw new Error('Mi Camino no está configurado todavía.')
  const origin = String(globalThis.location?.origin || '').trim()
  const pathname = String(globalThis.location?.pathname || '')
  // La recuperación debe volver a esta superficie privada, no a la pantalla
  // histórica de Programming. Supabase conserva el token en la URL y App
  // detecta `recovery=1` sin exponerlo a otra aplicación.
  const redirectPath = pathname.startsWith('/mi-camino')
    ? '/mi-camino?recovery=1'
    : '/?recovery=1'
  const redirectTo = `${origin}${redirectPath}`
  const { error } = await miCaminoSupabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw error
}

export async function updateMiCaminoPassword(password) {
  if (!miCaminoSupabase) throw new Error('Mi Camino no está configurado todavía.')
  const { error } = await miCaminoSupabase.auth.updateUser({ password })
  if (error) throw error
}

export function isMiCaminoRecoveryLocation(location = globalThis.location) {
  const search = String(location?.search || '')
  const hash = String(location?.hash || '')
  return search.includes('recovery=1') || hash.includes('type=recovery')
}
