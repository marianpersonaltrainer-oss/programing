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
  const { error: deactivateErr } = await supabase
    .from('published_weeks')
    .update({ is_active: false })
    .eq('mesociclo', mesociclo)

  if (deactivateErr) throw deactivateErr

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

/**
 * Una sola semana visible en el Hub para coaches: desactiva el resto y activa la del slot (mesociclo + semana).
 * Debe ejecutarse tras guardar datos con `upsertPublishedWeekBySlot` si quieres que `getActiveWeek()` devuelva esta semana.
 */
export async function activatePublishedWeekForHub(mesociclo, semana) {
  if (!mesociclo || semana == null) throw new Error('Falta mesociclo o semana')
  const row = await getPublishedWeekByMesocycleAndWeek(mesociclo, semana)
  if (!row?.id) throw new Error('No se encontró la fila publicada para activar en el Hub')
  const { error: offErr } = await supabase
    .from('published_weeks')
    .update({ is_active: false })
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (offErr) {
    console.warn(
      'activatePublishedWeekForHub: no se pudieron desactivar todas las semanas (revisa RLS). Se activa solo esta fila con published_at reciente.',
      offErr.message,
    )
  }
  const now = new Date().toISOString()
  const { error: onErr } = await supabase
    .from('published_weeks')
    .update({ is_active: true, published_at: now })
    .eq('id', row.id)
  if (onErr) throw onErr
  return { id: row.id, mesociclo: row.mesociclo, semana: row.semana }
}

/**
 * Upsert idempotente por slot lógico (mesociclo + semana).
 * Si existe fila previa en ese slot, actualiza `data`; si no, inserta fila con `is_active: false` hasta que actives.
 *
 * @param {boolean} [options.activateForHub=true] — Si es false, solo guarda JSON: los coaches siguen viendo la semana activa actual.
 *   Pon false para preparar la siguiente semana sin cambiar el Hub; true cuando quieras que ?coach=1 pase a esta semana.
 */
export async function upsertPublishedWeekBySlot(weekData, mesociclo, semana, options = {}) {
  const { activateForHub = true } = options
  if (!mesociclo || semana == null) throw new Error('Falta mesociclo o semana')
  const prev = await getPublishedWeekByMesocycleAndWeek(mesociclo, semana)
  if (prev?.id) {
    await updatePublishedWeekData(prev.id, {
      ...weekData,
      mesociclo,
      semana: Number(semana),
    })
    if (activateForHub) {
      await activatePublishedWeekForHub(mesociclo, semana)
    }
    return { id: prev.id, mode: 'update', active: !!activateForHub }
  }
  const { data, error } = await supabase
    .from('published_weeks')
    .insert({
      mesociclo,
      semana: Number(semana),
      titulo: weekData?.titulo || `S${Number(semana)}`,
      data: {
        ...weekData,
        mesociclo,
        semana: Number(semana),
      },
      is_active: false,
    })
    .select('id')
    .single()
  if (error) throw error
  if (activateForHub) {
    await activatePublishedWeekForHub(mesociclo, semana)
  }
  return { id: data?.id || null, mode: 'insert', active: !!activateForHub }
}

/**
 * Todas las semanas publicadas de un mesociclo (una fila por número de semana, la más reciente por `published_at`).
 * Útil para sincronizar el historial local del generador con el Hub.
 */
export async function listPublishedWeeksForMesocycle(mesociclo) {
  if (!mesociclo) return []
  const { data, error } = await supabase
    .from('published_weeks')
    .select('semana, titulo, data, published_at')
    .eq('mesociclo', mesociclo)
    .order('published_at', { ascending: false })

  if (error) throw error
  const bySem = new Map()
  for (const row of data || []) {
    const s = Number(row.semana)
    if (!Number.isFinite(s)) continue
    if (!bySem.has(s)) bySem.set(s, row)
  }
  return [...bySem.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => row)
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

// ── Contexto asistente (Haiku) por semana ────────────────────────────────────

export async function getAssistantWeekContext(mesociclo, semana) {
  if (!mesociclo || semana == null) return null
  const { data, error } = await supabase
    .from('assistant_week_context')
    .select('*')
    .eq('mesociclo', String(mesociclo))
    .eq('semana', Number(semana))
    .maybeSingle()
  if (error) {
    if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
      return null
    }
    throw error
  }
  return data || null
}

export async function upsertAssistantWeekContext(payload) {
  const row = {
    mesociclo: String(payload?.mesociclo || '').trim(),
    semana: Number(payload?.semana),
    global_notes: payload?.global_notes?.trim() || null,
    qa_pairs: Array.isArray(payload?.qa_pairs) ? payload.qa_pairs : [],
    adaptations: Array.isArray(payload?.adaptations) ? payload.adaptations : [],
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('assistant_week_context')
    .upsert(row, { onConflict: 'mesociclo,semana', ignoreDuplicates: false })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function insertAssistantQuestionHistory(payload) {
  const row = {
    week_id: payload?.week_id || null,
    mesociclo: payload?.mesociclo || null,
    semana: payload?.semana != null ? Number(payload.semana) : null,
    day_key: payload?.day_key || null,
    class_label: payload?.class_label || null,
    coach_name: payload?.coach_name || null,
    question: String(payload?.question || '').trim(),
    answer: String(payload?.answer || '').trim(),
  }
  if (!row.question || !row.answer) return null
  const { data, error } = await supabase.from('assistant_question_history').insert(row).select('id').single()
  if (error) throw error
  return data || null
}

export async function listAssistantQuestionHistory(filters = {}) {
  let q = supabase.from('assistant_question_history').select('*').order('created_at', { ascending: false }).limit(filters.limit || 400)
  if (filters.mesociclo) q = q.eq('mesociclo', String(filters.mesociclo))
  if (filters.semana != null) q = q.eq('semana', Number(filters.semana))
  const { data, error } = await q
  if (error) {
    if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
      return []
    }
    throw error
  }
  return data || []
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
    .select('id, name, category, classes, level, notes, is_new, active, video_url, video_url_verified, created_at')
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
  if (error) {
    const msg = String(error?.message || '').toLowerCase()
    const missingTable =
      error?.code === 'PGRST205' ||
      msg.includes('could not find the table') ||
      msg.includes('daily_handoffs') && msg.includes('schema cache')
    if (missingTable) {
      throw new Error(
        'No existe la tabla daily_handoffs en este proyecto Supabase. Ejecuta la migración `20260417145500_coach_handoffs_and_weekly_checkins.sql` y vuelve a cargar.',
      )
    }
    throw error
  }
  return data || []
}

// ── Ejercicios sin vídeo (pendientes de revisión manual) ─────────────────────

/**
 * Inserta o actualiza faltantes detectados al importar Excel.
 * Idempotente por (mesociclo, semana, day_key, class_label, exercise_norm).
 */
export async function upsertMissingExerciseVideos(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return []
  const { data, error } = await supabase
    .from('ejercicios_sin_video')
    .upsert(rows, {
      onConflict: 'mesociclo,semana,day_key,class_label,exercise_norm',
      ignoreDuplicates: false,
    })
    .select('*')
  if (error) throw error
  return data || []
}

export async function listMissingExerciseVideos(filters = {}) {
  let q = supabase
    .from('ejercicios_sin_video')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(filters.limit || 300)
  if (filters.mesociclo) q = q.eq('mesociclo', filters.mesociclo)
  if (filters.semana != null) q = q.eq('semana', Number(filters.semana))
  if (filters.onlyUnresolved !== false) q = q.eq('resolved', false)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function updateMissingExerciseVideo(id, patch) {
  if (!id) throw new Error('Falta id')
  const { data, error } = await supabase
    .from('ejercicios_sin_video')
    .update({
      suggested_url: patch?.suggested_url ?? null,
      resolved: patch?.resolved === true,
      notes: patch?.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function getCurrentCoachWeeklyCheckin(weekIso, coachName) {
  if (!weekIso) return null
  const { data: authData } = await supabase.auth.getUser()
  const coachId = authData?.user?.id || null
  if (coachId) {
    const { data, error } = await supabase
      .from('weekly_checkins')
      .select('*')
      .eq('coach_id', coachId)
      .eq('week_iso', weekIso)
      .maybeSingle()
    if (error) throw error
    return data || null
  }
  const nameNorm = String(coachName ?? '')
    .trim()
    .toLowerCase()
  if (!nameNorm) return null
  const { data, error } = await supabase
    .from('weekly_checkins')
    .select('*')
    .eq('week_iso', weekIso)
    .eq('coach_name_norm', nameNorm)
    .maybeSingle()
  if (error) throw error
  return data || null
}

function formatWeeklyCheckinWriteError(error) {
  if (!error) return 'Error desconocido (sin detalle de Supabase)'
  const bits = [
    error.message,
    error.code != null && `code=${error.code}`,
    error.details,
    error.hint,
  ].filter(Boolean)
  return bits.join(' | ') || String(error)
}

const SESSION_EXPIRED_MSG = 'Sesión expirada. Recarga la página e inicia sesión de nuevo.'

const COACH_AUTH_STORAGE_KEY = 'evo_coach_auth'

async function createWeeklyCheckinViaServer(payload, accessCode) {
  const trimmed = String(accessCode ?? '').trim()
  let desdeLocalStorage = '(sin window)'
  try {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(COACH_AUTH_STORAGE_KEY)
      desdeLocalStorage = raw == null || raw === '' ? '(vacío en localStorage)' : raw
    }
  } catch {
    desdeLocalStorage = '(error leyendo localStorage)'
  }

  console.log('[weekly_checkins] accessCode antes de fetch API', {
    accessCodeDesdeOptions: accessCode,
    accessCodeTrimmed: trimmed,
    longitudTrimmed: trimmed.length,
    evo_coach_auth_en_localStorage: desdeLocalStorage,
    coincideConLS: trimmed !== '' && trimmed === String(desdeLocalStorage).trim(),
  })

  if (!trimmed) {
    throw new Error(SESSION_EXPIRED_MSG)
  }

  const apiPath = '/api/coach-weekly-checkin'
  const origin = typeof window !== 'undefined' ? window.location.origin : null
  const urlResuelta = origin ? `${origin}${apiPath}` : apiPath

  console.log('[weekly_checkins] fetch URL (path relativo; origen = página actual)', {
    fetchArgumento: apiPath,
    windowLocationOrigin: origin,
    urlResueltaPorElNavegador: urlResuelta,
    nota: 'fetch("/api/...") nunca fuerza localhost salvo que la página esté en localhost',
  })

  const res = await fetch(apiPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accessCode: trimmed,
      coach_name: payload.coach_name,
      week_iso: payload.week_iso,
      mood_score: Number(payload.mood_score),
      feedback_text: payload.feedback_text ?? null,
      highlights: payload.highlights ?? null,
      improvements: payload.improvements ?? null,
    }),
  })

  let json = {}
  try {
    json = await res.json()
  } catch {
    /* noop */
  }

  console.log('[weekly_checkins] after server /api/coach-weekly-checkin', {
    status: res.status,
    ok: res.ok,
    body: json,
  })

  if (!res.ok) {
    const msg = json?.error || res.statusText || `HTTP ${res.status}`
    throw new Error(typeof msg === 'string' ? msg : SESSION_EXPIRED_MSG)
  }
  return json.data
}

/**
 * @param {object} payload — coach_name, week_iso, mood_score, feedback_text?, highlights?, improvements?
 * @param {{ accessCode?: string }} [options] — código coach (localStorage evo_coach_auth) si no hay sesión Supabase
 */
export async function createWeeklyCheckin(payload, options = {}) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  console.log('[weekly_checkins] supabase.auth.getSession()', {
    hasSession: !!session?.access_token,
    userId: session?.user?.id ?? null,
    expires_at: session?.expires_at ?? null,
    sessionError: sessionError?.message ?? null,
  })

  const row = {
    coach_name: payload.coach_name,
    week_iso: payload.week_iso,
    mood_score: Number(payload.mood_score),
    feedback_text: payload.feedback_text ?? null,
    highlights: payload.highlights ?? null,
    improvements: payload.improvements ?? null,
  }

  if (session?.user) {
    const coachId = session.user.id
    row.coach_id = coachId

    console.log('[weekly_checkins] before insert (cliente, sesión Supabase activa)', {
      row,
      coach_id: row.coach_id,
      mood_score: row.mood_score,
      mood_type: typeof row.mood_score,
    })

    const { data, error } = await supabase.from('weekly_checkins').insert(row).select('*').single()

    console.log('[weekly_checkins] after insert (cliente)', {
      data,
      error: error
        ? {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          }
        : null,
    })

    if (error) {
      console.error('[weekly_checkins] Supabase error (exacto)', error)
      throw new Error(formatWeeklyCheckinWriteError(error))
    }
    return data
  }

  const accessCode = options.accessCode ?? options.coachAccessCode
  console.log('[weekly_checkins] accessCode recibido en createWeeklyCheckin (desde CoachView / localStorage)', {
    accessCode,
    longitud: String(accessCode ?? '').trim().length,
    vacio: !String(accessCode ?? '').trim(),
  })

  if (!String(accessCode ?? '').trim()) {
    console.warn('[weekly_checkins] sin sesión Supabase y sin accessCode — no se llama al insert del cliente')
    throw new Error(SESSION_EXPIRED_MSG)
  }

  console.log('[weekly_checkins] sin sesión Supabase: envío vía /api/coach-weekly-checkin (service role)')
  return createWeeklyCheckinViaServer(payload, accessCode)
}

export async function listWeeklyCheckinsByWeek(weekIso) {
  let q = supabase.from('weekly_checkins').select('*').order('created_at', { ascending: false })
  if (weekIso) q = q.eq('week_iso', weekIso)
  const { data, error } = await q
  if (error) throw error
  return data || []
}
