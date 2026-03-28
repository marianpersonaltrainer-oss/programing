import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase: Missing environment variables! Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env')
} else {
  console.log('Supabase: Client initialized with URL:', supabaseUrl.slice(0, 15) + '...')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// ── Semanas publicadas ────────────────────────────────────────────────────────

export async function publishWeek(weekData, mesociclo, semana) {
  // Desactivar semanas anteriores del mismo mesociclo
  await supabase
    .from('published_weeks')
    .update({ is_active: false })
    .eq('mesociclo', mesociclo)

  const { data, error } = await supabase
    .from('published_weeks')
    .insert({
      mesociclo,
      semana,
      titulo: weekData.titulo,
      data: weekData,
      is_active: true,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getActiveWeek() {
  const { data, error } = await supabase
    .from('published_weeks')
    .select('*')
    .eq('is_active', true)
    .order('published_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data || null
}

// ── Sesiones coach ────────────────────────────────────────────────────────────

export async function createCoachSession(weekId, coachName) {
  const { data, error } = await supabase
    .from('coach_sessions')
    .insert({ week_id: weekId, coach_name: coachName })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateSessionActivity(sessionId) {
  await supabase
    .from('coach_sessions')
    .update({ last_activity: new Date().toISOString() })
    .eq('id', sessionId)
}

export async function getAllSessions() {
  const { data, error } = await supabase
    .from('coach_sessions')
    .select(`
      *,
      published_weeks (titulo, semana, mesociclo),
      coach_messages (count)
    `)
    .order('last_activity', { ascending: false })

  if (error) throw error
  return data || []
}

// ── Mensajes ──────────────────────────────────────────────────────────────────

export async function saveMessage(sessionId, role, content) {
  const { error } = await supabase
    .from('coach_messages')
    .insert({ session_id: sessionId, role, content })

  if (error) throw error
}

export async function getSessionMessages(sessionId) {
  const { data, error } = await supabase
    .from('coach_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

/** Overrides de la guía coach (material, contacto). Tabla `coach_guide_settings` — ver supabase/migrations. */
export async function getCoachGuideSettings() {
  const { data, error } = await supabase
    .from('coach_guide_settings')
    .select(
      'contact_channel, contact_response, material_override, active_notice, material_table, contact_person, contact_schedule, response_time',
    )
    .eq('id', 'default')
    .maybeSingle()

  if (error) {
    if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
      return null
    }
    console.warn('getCoachGuideSettings:', error.message)
    return null
  }
  return data
}
