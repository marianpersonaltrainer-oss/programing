import { createClient } from '@supabase/supabase-js'
import { buildEditHistoryEntry } from '../utils/publishedWeekEditLog.js'

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

/** Actualiza el JSON `data` de una fila publicada (requiere políticas RLS que permitan UPDATE). */
export async function updatePublishedWeekData(rowId, weekData) {
  const { data: row, error: fetchErr } = await supabase
    .from('published_weeks')
    .select('data, edit_history')
    .eq('id', rowId)
    .single()

  if (fetchErr) throw fetchErr

  const entry = buildEditHistoryEntry(row?.data, weekData, {
    actor: 'programador',
    source: 'generar_programacion',
  })
  const hist = Array.isArray(row?.edit_history) ? [...row.edit_history] : []
  if (entry) hist.push(entry)
  const edit_history = hist.slice(-150)

  const { error } = await supabase
    .from('published_weeks')
    .update({
      data: weekData,
      titulo: weekData.titulo,
      edit_history,
    })
    .eq('id', rowId)

  if (error) throw error
}

/** Listado para selectores (export admin, etc.). */
export async function listPublishedWeeksSummary(limit = 80) {
  const { data, error } = await supabase
    .from('published_weeks')
    .select('id, titulo, semana, mesociclo, published_at, is_active')
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

/** Fila completa por id (export, auditoría). */
export async function getPublishedWeekById(id) {
  if (id == null) return null
  const { data, error } = await supabase.from('published_weeks').select('*').eq('id', id).single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

/** Devuelve la última fila publicada para (mesociclo, semana), activa o no. */
export async function getPublishedWeekByMesocycleAndWeek(mesociclo, semana) {
  if (!mesociclo || semana == null) return null
  const { data, error } = await supabase
    .from('published_weeks')
    .select('id, mesociclo, semana, titulo, data, is_active, published_at')
    .eq('mesociclo', mesociclo)
    .eq('semana', semana)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data || null
}

/** Referencia compacta de semanas del último año (si existe tabla `weeks`). */
export async function listWeeksLastYear(limit = 40) {
  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('weeks')
    .select('title, resumen, start_date')
    .gte('start_date', since)
    .order('start_date', { ascending: false })
    .limit(limit)

  if (error) {
    if (error.code === 'PGRST116' || error.message?.includes('does not exist') || error.message?.includes('relation')) {
      return []
    }
    console.warn('listWeeksLastYear:', error.message)
    return []
  }
  return data || []
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
      'contact_channel, contact_response, material_override, active_notice, material_table, contact_person, contact_schedule, response_time, updated_at',
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

// ── Feedback de sesión (coaches → coach_session_feedback) ─────────────────────

/**
 * @param {object} row — columnas de `coach_session_feedback`
 */
export async function saveCoachSessionFeedback(row) {
  const { data, error } = await supabase.from('coach_session_feedback').insert(row).select('id').single()

  if (error) throw error
  return data
}

export async function listCoachSessionFeedback() {
  const { data, error } = await supabase
    .from('coach_session_feedback')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/** Feedback de coaches filtrado por semana publicada (pase de turno mañana ↔ tarde). */
export async function listCoachSessionFeedbackForWeek(weekId) {
  if (weekId == null) return []
  const { data, error } = await supabase
    .from('coach_session_feedback')
    .select('*')
    .eq('week_id', weekId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.warn('listCoachSessionFeedbackForWeek failed', {
      weekId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    return []
  }
  return data || []
}

/**
 * Misma fila que `listCoachSessionFeedbackForWeek`, pero para export admin: más filas y columnas explícitas.
 * `coach_session_feedback.week_id` referencia `published_weeks.id` (no existe `published_week_id` en la tabla).
 */
export async function fetchCoachSessionFeedbackForPublishedWeekExport(publishedWeekId) {
  if (publishedWeekId == null || publishedWeekId === '') return []
  const { data, error } = await supabase
    .from('coach_session_feedback')
    .select(
      'id, week_id, day_key, class_label, coach_name, session_how, time_for_explanation, changed_something, changed_details, group_feelings, notes_next_week, created_at',
    )
    .eq('week_id', publishedWeekId)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.warn('fetchCoachSessionFeedbackForPublishedWeekExport failed', {
      publishedWeekId,
      code: error.code,
      message: error.message,
    })
    return []
  }
  return data || []
}

/** ¿Este coach ya pulsó «Leído» en el pase de turno para esta semana? (RPC, persiste en Supabase). */
export async function coachHasReadHandoverForWeek(weekId, coachName) {
  if (weekId == null || !String(coachName || '').trim()) return false
  const { data, error } = await supabase.rpc('coach_has_read_handover', {
    p_week_id: weekId,
    p_coach_name: String(coachName).trim(),
  })
  if (error) {
    console.warn('coachHasReadHandoverForWeek', error.message)
    return false
  }
  return !!data
}

/** Marca el pase de turno como leído para coach + semana (tabla coach_handover_reads). */
export async function recordCoachHandoverRead(weekId, coachName) {
  if (weekId == null || !String(coachName || '').trim()) {
    throw new Error('Falta semana o nombre de coach')
  }
  const { error } = await supabase.rpc('record_coach_handover_read', {
    p_week_id: weekId,
    p_coach_name: String(coachName).trim(),
  })
  if (error) throw error
}

// ── Biblioteca de ejercicios EVO (coach_exercise_library) ─────────────────────

/** Ejercicios activos para ?coach (lectura pública RLS). Incluye video_url si existe. */
export async function getCoachExerciseLibrary() {
  const { data, error } = await supabase
    .from('coach_exercise_library')
    .select('id, name, category, classes, level, notes, is_new, active, video_url, created_at')
    .eq('active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    if (error.code === 'PGRST116' || error.message?.includes('does not exist') || error.message?.includes('relation')) {
      return []
    }
    throw error
  }
  return data || []
}

// ── Pase diario y check-in semanal ───────────────────────────────────────────

export async function listTodayHandoffs() {
  const madridNow = new Date().toLocaleString('en-CA', { timeZone: 'Europe/Madrid' }).slice(0, 10)
  const { data, error } = await supabase
    .from('daily_handoffs')
    .select('*')
    .gte('created_at', `${madridNow}T00:00:00+01:00`)
    .lt('created_at', `${madridNow}T23:59:59+01:00`)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createDailyHandoff(payload) {
  const { data: authData } = await supabase.auth.getUser()
  const coachId = authData?.user?.id || null
  const row = { ...payload, coach_id: coachId }
  const { data, error } = await supabase.from('daily_handoffs').insert(row).select('*').single()
  if (error) throw error
  return data
}

export async function listDailyHandoffsHistory(filters = {}) {
  let q = supabase.from('daily_handoffs').select('*').order('created_at', { ascending: false }).limit(filters.limit || 25)
  if (filters.fromDate) q = q.gte('created_at', `${filters.fromDate}T00:00:00`)
  if (filters.toDate) q = q.lte('created_at', `${filters.toDate}T23:59:59`)
  if (filters.coachName) q = q.eq('coach_name', filters.coachName)
  if (filters.classType) q = q.eq('class_type', filters.classType)
  if (filters.onlyIncident) q = q.eq('had_incident', true)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function getCurrentCoachWeeklyCheckin(weekIso) {
  const { data: authData } = await supabase.auth.getUser()
  const coachId = authData?.user?.id || null
  if (!coachId || !weekIso) return null
  const { data, error } = await supabase
    .from('weekly_checkins')
    .select('*')
    .eq('coach_id', coachId)
    .eq('week_iso', weekIso)
    .maybeSingle()
  if (error) throw error
  return data || null
}

export async function createWeeklyCheckin(payload) {
  const { data: authData } = await supabase.auth.getUser()
  const coachId = authData?.user?.id || null
  const row = { ...payload, coach_id: coachId }
  const { data, error } = await supabase
    .from('weekly_checkins')
    .upsert(row, { onConflict: 'coach_id,week_iso' })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function listWeeklyCheckinsByWeek(weekIso) {
  let q = supabase.from('weekly_checkins').select('*').order('created_at', { ascending: false })
  if (weekIso) q = q.eq('week_iso', weekIso)
  const { data, error } = await q
  if (error) throw error
  return data || []
}
