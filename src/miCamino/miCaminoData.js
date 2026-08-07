import { supabase } from '../lib/supabase.js'

function requireSupabase() {
  if (!supabase) throw new Error('Mi Camino necesita la configuración de Supabase.')
  return supabase
}

export async function getMiCaminoSession() {
  const client = requireSupabase()
  const { data, error } = await client.auth.getSession()
  if (error) throw error
  return data?.session || null
}

export function onMiCaminoAuthChange(handler) {
  const client = requireSupabase()
  const { data } = client.auth.onAuthStateChange((_event, session) => handler(session || null))
  return () => data?.subscription?.unsubscribe?.()
}

export async function signInMiCamino(email, password) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data?.session || null
}

export async function sendMiCaminoMagicLink(email, redirectTo) {
  const client = requireSupabase()
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: false,
    },
  })
  if (error) throw error
}

export async function signOutMiCamino() {
  const client = requireSupabase()
  const { error } = await client.auth.signOut()
  if (error) throw error
}

export async function getMiCaminoPerson() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('mc_people')
    .select('id, org_id, full_name, email, joined_at, status, agreed_weekly_frequency, last_attended_at, next_reserved_at, metadata')
    .maybeSingle()
  if (error) throw error
  return data || null
}

export async function getMiCaminoCurrentState() {
  const client = requireSupabase()
  const { data, error } = await client.from('mc_my_current_state').select('*').maybeSingle()
  if (error) throw error
  return data || null
}

export async function getMiCaminoMilestones(limit = 12) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('mc_milestone_awards')
    .select(`
      id,
      status,
      earned_at,
      validated_at,
      celebrated_at,
      evidence,
      mc_milestone_definitions (
        id,
        milestone_key,
        name,
        category,
        trigger_type,
        trigger_config,
        badge_art_key,
        customer_copy
      )
    `)
    .order('earned_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function getMiCaminoActivePlanB() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('mc_plan_b_activations')
    .select(`
      id,
      trigger_reason,
      status,
      offered_at,
      accepted_at,
      mc_plan_b_catalog (
        id,
        plan_b_key,
        name,
        family,
        duration_min,
        instructions
      )
    `)
    .in('status', ['offered', 'accepted'])
    .order('offered_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data || null
}

export async function updateMiCaminoPlanB(id, status) {
  if (!id || !['accepted', 'completed', 'dismissed'].includes(status)) {
    throw new Error('Cambio de Plan B no válido.')
  }
  const client = requireSupabase()
  const patch = { status }
  if (status === 'accepted') patch.accepted_at = new Date().toISOString()
  if (status === 'completed') patch.completed_at = new Date().toISOString()
  const { data, error } = await client
    .from('mc_plan_b_activations')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function getMiCaminoPendingCheckin() {
  // V1 domain engine will later compute due state server-side. Until then, callers can
  // use enrollment state. This function intentionally does not invent a due date.
  return null
}

export async function submitMiCaminoCheckin(payload) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('mc_checkins')
    .insert({
      person_id: payload.personId,
      org_id: payload.orgId,
      enrollment_id: payload.enrollmentId || null,
      period_key: payload.periodKey,
      difficulty: payload.difficulty,
      energy: payload.energy,
      maintain_next_week: payload.maintainNextWeek,
      extra: payload.extra || {},
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function getMiCaminoResourceDeliveries(limit = 8) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('mc_resource_deliveries')
    .select(`
      id,
      status,
      delivered_at,
      opened_at,
      completed_at,
      mc_resources (
        id,
        resource_key,
        title,
        resource_type,
        body
      )
    `)
    .in('status', ['available', 'opened'])
    .order('delivered_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function getMiCaminoChallenges() {
  const client = requireSupabase()
  const [{ data: challenges, error: cError }, { data: progress, error: pError }] = await Promise.all([
    client
      .from('mc_challenges')
      .select('id, challenge_key, name, challenge_type, start_at, end_at, rules')
      .eq('status', 'active')
      .order('start_at', { ascending: false }),
    client
      .from('mc_challenge_progress')
      .select('id, challenge_id, team_key, progress, contribution, updated_at'),
  ])
  if (cError) throw cError
  if (pError) throw pError
  const byChallenge = new Map()
  for (const row of progress || []) {
    const list = byChallenge.get(row.challenge_id) || []
    list.push(row)
    byChallenge.set(row.challenge_id, list)
  }
  return (challenges || []).map((challenge) => ({
    ...challenge,
    progressRows: byChallenge.get(challenge.id) || [],
  }))
}
