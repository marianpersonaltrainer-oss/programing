import { supabase } from './supabase.js'

export async function getPe2Session() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function getPe2Profile(userId) {
  if (!userId) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, org_id')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function signInPe2(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  const profile = await getPe2Profile(data.user?.id)
  return { session: data.session, user: data.user, profile }
}

export async function signOutPe2() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function onPe2AuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return () => data.subscription.unsubscribe()
}
