import { createClient } from '@supabase/supabase-js'
import {
  assertPublicationGateApproved,
} from '../utils/publicationQualityGate.js'
import {
  filterPublishedOrSupersededRows,
  isMissingPublishedWeeksV2ColumnError,
  withInferredPublicationStatus,
} from '../utils/publishedWeeksLegacy.js'
import { readCoachAdminSecret } from '../utils/coachAdminSecretStorage.js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Supabase: Missing environment variables! Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (Vercel: enable Preview too).',
  )
} else {
  console.log('Supabase: Client initialized with URL:', supabaseUrl.slice(0, 15) + '...')
}

/** false en previews de Vercel sin variables VITE_* → la app muestra pantalla de configuración. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null

const COACH_AUTH_STORAGE_KEY = 'evo_coach_auth'

function readCoachAccessCode() {
  try {
    return String(localStorage.getItem(COACH_AUTH_STORAGE_KEY) || '').trim()
  } catch {
    return ''
  }
}

async function callOperationalData(action, payload = {}, authorization = 'auto') {
  const body = { action, payload }
  if (authorization === 'coach' || authorization === 'auto') {
    body.accessCode = readCoachAccessCode()
  }
  if (authorization === 'admin' || authorization === 'auto') {
    body.adminSecret = readCoachAdminSecret()
  }

  const response = await fetch('/api/operational-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(json?.error || `Error ${response.status} en operación segura.`)
  }
  return json?.data ?? null
}

// ── Semanas publicadas ────────────────────────────────────────────────────────

export async function getActiveWeek() {
  let { data, error } = await supabase
    .from('published_weeks')
    .select('*')
    .eq('is_active', true)
    .eq('publication_status', 'published')
    .order('published_at', { ascending: false })
    .limit(1)
    .single()

  if (error && isMissingPublishedWeeksV2ColumnError(error)) {
    ;({ data, error } = await supabase
      .from('published_weeks')
      .select('*')
      .eq('is_active', true)
      .order('published_at', { ascending: false })
      .limit(1)
      .single())
    if (data) data = withInferredPublicationStatus(data)
  }

  if (error && error.code !== 'PGRST116') throw error
  return data || null
}

/** Listado para selectores (export admin, etc.). */
export async function listPublishedWeeksSummary(limit = 80) {
  let { data, error } = await supabase
    .from('published_weeks')
    .select('id, titulo, semana, mesociclo, cycle_id, cycle_start_date, week_start_date, published_at, is_active, publication_status, version_number')
    .in('publication_status', ['published', 'superseded'])
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error && isMissingPublishedWeeksV2ColumnError(error)) {
    ;({ data, error } = await supabase
      .from('published_weeks')
      .select('id, titulo, semana, mesociclo, published_at, is_active, data, edit_history')
      .order('published_at', { ascending: false })
      .limit(limit))
    data = filterPublishedOrSupersededRows(data)
  }

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
export async function getPublishedWeekByMesocycleAndWeek(mesociclo, semana, cycleId) {
  if (!mesociclo || semana == null) return null
  if (!cycleId) throw new Error('Falta cycleId para abrir una semana publicada exacta.')
  let { data, error } = await supabase
    .from('published_weeks')
    .select('*')
    .eq('mesociclo', mesociclo)
    .eq('semana', semana)
    .eq('cycle_id', cycleId)
    .in('publication_status', ['published', 'superseded'])
    .order('version_number', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error && isMissingPublishedWeeksV2ColumnError(error)) {
    ;({ data, error } = await supabase
      .from('published_weeks')
      .select('*')
      .eq('mesociclo', mesociclo)
      .eq('semana', semana)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle())
    data = data && withInferredPublicationStatus(data)
    if (data && !['published', 'superseded', 'legacy_unverified'].includes(data.publication_status)) {
      data = null
    }
  }

  if (error) throw error
  return data || null
}

/** Borrador mutable exacto del slot; nunca se usa como histórico de progresión. */
export async function getPublishedWeekDraftByMesocycleAndWeek(mesociclo, semana, cycleId) {
  if (!mesociclo || semana == null) return null
  if (!cycleId) throw new Error('Falta cycleId para abrir un borrador exacto.')
  const secret = publicationAdminSecret('')
  if (!secret) return null
  const json = await callPublishedWeekVersionsApi(
    {
      action: 'get_draft',
      secret,
      mesocycle: mesociclo,
      week: Number(semana),
      cycleId,
    },
    { allowEmptyRow: true },
  )
  return json?.row || null
}

export function publicationAdminSecret(explicitSecret = '') {
  const direct = String(explicitSecret || '').trim()
  if (direct) return direct
  return readCoachAdminSecret()
}

async function callPublishedWeekVersionsApi(payload, { allowEmptyRow = false } = {}) {
  const response = await fetch('/api/published-week-versions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(json?.error || `Error ${response.status} al guardar la semana.`)
    error.code = json?.code || response.status
    throw error
  }
  if (!allowEmptyRow && !json?.row?.id) {
    throw new Error('El servidor no devolvió una versión de semana válida.')
  }
  return json
}

/**
 * Guarda siempre una versión borrador. Si `activateForHub` es true, invalida
 * primero cualquier evaluación almacenada, vuelve a sellar el contenido con la
 * puerta exacta recibida y solo entonces ejecuta la publicación atómica.
 */
export async function upsertPublishedWeekBySlot(weekData, mesociclo, semana, options = {}) {
  const {
    activateForHub = false,
    qualityGate = null,
    sourceWeekId = null,
    adminSecret = '',
    draftId = null,
    expectedRevision = draftId ? null : 0,
    adminDirectPublish = false,
    contextFingerprint = '',
    selectedWeekIds = [],
  } = options
  if (!mesociclo || semana == null) throw new Error('Falta mesociclo o semana')
  if (!weekData || typeof weekData !== 'object') throw new Error('Falta el JSON de la semana')
  if (activateForHub) assertPublicationGateApproved(qualityGate)
  if (draftId && (!Number.isInteger(Number(expectedRevision)) || Number(expectedRevision) < 1)) {
    throw new Error('Falta la revisión exacta del borrador que se intenta guardar o publicar.')
  }
  if (!draftId && Number(expectedRevision) !== 0) {
    throw new Error('Un borrador nuevo debe comenzar con revisión esperada 0.')
  }
  const secret = publicationAdminSecret(adminSecret)
  if (!secret) {
    throw new Error(
      'Falta la clave de administración. Introdúcela en Contenido Coach o Tu método antes de guardar/publicar.',
    )
  }

  const normalized = {
    ...weekData,
    mesociclo,
    semana: Number(semana),
  }
  const { row, active } = await callPublishedWeekVersionsApi({
    action: activateForHub ? 'publish' : 'save_draft',
    secret,
    mesocycle: mesociclo,
    week: Number(semana),
    weekData: normalized,
    qualityGate: activateForHub ? qualityGate : null,
    sourceWeekId,
    draftId: draftId || null,
    expectedRevision: Number(expectedRevision),
    adminDirectPublish: activateForHub && adminDirectPublish,
    contextFingerprint,
    selectedWeekIds,
  })
  return {
    ...row,
    mode: activateForHub ? 'publish-version' : 'save-draft',
    active: !!active,
  }
}

const PUBLISHED_WEEK_VERSION_SELECT_MODERN =
  'id, mesociclo, semana, cycle_id, cycle_start_date, week_start_date, titulo, data, published_at, publication_status, version_number, content_fingerprint'
const PUBLISHED_WEEK_VERSION_SELECT_LEGACY =
  'id, mesociclo, semana, titulo, data, published_at, is_active, edit_history'

/**
 * Semanas publicadas por id (solo las necesarias para generación / contexto).
 * @param {string[]} ids
 */
export async function getPublishedWeekVersionsByIds(ids) {
  const cleanIds = [...new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean))]
  if (!cleanIds.length) return []

  let { data, error } = await supabase
    .from('published_weeks')
    .select(PUBLISHED_WEEK_VERSION_SELECT_MODERN)
    .in('id', cleanIds)

  if (error && isMissingPublishedWeeksV2ColumnError(error)) {
    ;({ data, error } = await supabase
      .from('published_weeks')
      .select(PUBLISHED_WEEK_VERSION_SELECT_LEGACY)
      .in('id', cleanIds))
    data = filterPublishedOrSupersededRows(data)
  }

  if (error) throw error
  const byId = new Map((data || []).map((row) => [String(row.id), row]))
  return cleanIds.map((id) => byId.get(id)).filter(Boolean)
}

/**
 * Todas las semanas publicadas de un mesociclo (una fila por número de semana, la más reciente por `published_at`).
 * Útil para sincronizar el historial local del generador con el Hub.
 * @param {string} mesociclo
 * @param {{ limit?: number }} [opts]
 */
export async function listPublishedWeekVersionsForMesocycle(mesociclo, opts = {}) {
  if (!mesociclo) return []
  const limit =
    typeof opts.limit === 'number' && opts.limit > 0 ? Math.floor(opts.limit) : null

  let query = supabase
    .from('published_weeks')
    .select(PUBLISHED_WEEK_VERSION_SELECT_MODERN)
    .eq('mesociclo', mesociclo)
    .in('publication_status', ['published', 'superseded'])
    .order('published_at', { ascending: false })
  if (limit) query = query.limit(limit)

  let { data, error } = await query

  if (error && isMissingPublishedWeeksV2ColumnError(error)) {
    let legacyQuery = supabase
      .from('published_weeks')
      .select(PUBLISHED_WEEK_VERSION_SELECT_LEGACY)
      .eq('mesociclo', mesociclo)
      .order('published_at', { ascending: false })
    if (limit) legacyQuery = legacyQuery.limit(limit)
    ;({ data, error } = await legacyQuery)
    data = filterPublishedOrSupersededRows(data)
  }

  if (error) throw error
  return data || []
}

export async function listPublishedWeeksForMesocycle(mesociclo, cycleId = '') {
  const data = await listPublishedWeekVersionsForMesocycle(mesociclo)
  const exactRows = cycleId
    ? data.filter((row) => String(row?.cycle_id || row?.data?.cycle_id || '') === cycleId)
    : data
  const bySem = new Map()
  for (const row of exactRows) {
    const s = Number(row.semana)
    if (!Number.isFinite(s)) continue
    if (!bySem.has(s)) bySem.set(s, row)
  }
  return [...bySem.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => row)
}

/** Referencia compacta de semanas del último año (si existe tabla `weeks`). */
export async function listWeeksLastYear(limit = 40, { signal } = {}) {
  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
  let query = supabase
    .from('weeks')
    .select('title, resumen, start_date')
    .gte('start_date', since)
    .order('start_date', { ascending: false })
    .limit(limit)
  if (signal) query = query.abortSignal(signal)

  const { data, error } = await query

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
  return callOperationalData('create_coach_session', { weekId, coachName }, 'coach')
}

export async function updateSessionActivity(sessionId) {
  await callOperationalData('touch_coach_session', { sessionId }, 'coach')
}

export async function getAllSessions() {
  const data = await callOperationalData('list_coach_sessions', {}, 'admin')
  return data || []
}

// ── Mensajes ──────────────────────────────────────────────────────────────────

export async function saveMessage(sessionId, role, content) {
  await callOperationalData('insert_coach_message', { sessionId, role, content }, 'coach')
}

export async function getSessionMessages(sessionId) {
  const data = await callOperationalData('list_session_messages', { sessionId }, 'admin')
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
  return callOperationalData('get_assistant_context', {
    mesociclo: String(mesociclo),
    semana: Number(semana),
  }, 'auto')
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
  return callOperationalData('upsert_assistant_context', row, 'admin')
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
  return callOperationalData('insert_assistant_history', row, 'coach')
}

export async function listAssistantQuestionHistory(filters = {}) {
  const data = await callOperationalData('list_assistant_history', filters, 'admin')
  return data || []
}

// ── Feedback de sesión (coaches → coach_session_feedback) ─────────────────────

/**
 * @param {object} row — columnas de `coach_session_feedback`
 */
export async function saveCoachSessionFeedback(row) {
  return callOperationalData('insert_feedback', row, 'coach')
}

export async function listCoachSessionFeedback() {
  const data = await callOperationalData('list_feedback_all', {}, 'admin')
  return data || []
}

/** Feedback de coaches filtrado por semana publicada (pase de turno mañana ↔ tarde). */
export async function listCoachSessionFeedbackForWeek(weekId) {
  if (weekId == null) return []
  const data = await callOperationalData('list_feedback_week', { weekId, limit: 50 }, 'auto')
  return data || []
}

export async function listCoachSessionFeedbackForWeeks(weekIds, limit = 40) {
  const ids = [...new Set((weekIds || []).map((id) => String(id || '').trim()).filter(Boolean))]
  if (!ids.length) return []
  const data = await callOperationalData('list_feedback_weeks', {
    weekIds: ids,
    limit,
  }, 'admin')
  return data || []
}

/**
 * Misma fila que `listCoachSessionFeedbackForWeek`, pero para export admin: más filas y columnas explícitas.
 * `coach_session_feedback.week_id` referencia `published_weeks.id` (no existe `published_week_id` en la tabla).
 */
export async function fetchCoachSessionFeedbackForPublishedWeekExport(publishedWeekId) {
  if (publishedWeekId == null || publishedWeekId === '') return []
  const data = await callOperationalData('list_feedback_week', {
    weekId: publishedWeekId,
    limit: 500,
  }, 'admin')
  return data || []
}

/** ¿Este coach ya pulsó «Leído» en el pase de turno para esta semana? (RPC, persiste en Supabase). */
export async function coachHasReadHandoverForWeek(weekId, coachName) {
  if (weekId == null || !String(coachName || '').trim()) return false
  const data = await callOperationalData('handover_status', {
    weekId,
    coachName: String(coachName).trim(),
  }, 'coach')
  return Boolean(data)
}

/** Marca el pase de turno como leído para coach + semana (tabla coach_handover_reads). */
export async function recordCoachHandoverRead(weekId, coachName) {
  if (weekId == null || !String(coachName || '').trim()) {
    throw new Error('Falta semana o nombre de coach')
  }
  await callOperationalData('mark_handover_read', {
    weekId,
    coachName: String(coachName).trim(),
  }, 'coach')
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
  const data = await callOperationalData('list_today_handoffs', {}, 'coach')
  return data || []
}

export async function createDailyHandoff(payload) {
  return callOperationalData('insert_daily_handoff', payload, 'coach')
}

export async function listDailyHandoffsHistory(filters = {}) {
  const data = await callOperationalData('list_daily_handoffs', filters, 'admin')
  return data || []
}

// ── Ejercicios sin vídeo (pendientes de revisión manual) ─────────────────────

/**
 * Inserta o actualiza faltantes detectados al importar Excel.
 * Idempotente por (mesociclo, semana, day_key, class_label, exercise_norm).
 */
export async function upsertMissingExerciseVideos(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return []
  const data = await callOperationalData('upsert_missing_exercises', { rows }, 'admin')
  return data || []
}

export async function listMissingExerciseVideos(filters = {}) {
  const data = await callOperationalData('list_missing_exercises', filters, 'admin')
  return data || []
}

export async function updateMissingExerciseVideo(id, patch) {
  if (!id) throw new Error('Falta id')
  return callOperationalData('update_missing_exercise', { id, ...patch }, 'admin')
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
  const name = String(coachName ?? '').trim()
  if (!name) return null
  return callOperationalData('get_weekly_checkin', { weekIso, coachName: name }, 'coach')
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

async function createWeeklyCheckinViaServer(payload, accessCode) {
  const trimmed = String(accessCode ?? '').trim()

  if (!trimmed) {
    throw new Error(SESSION_EXPIRED_MSG)
  }

  const apiPath = '/api/coach-weekly-checkin'

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

    const { data, error } = await supabase.from('weekly_checkins').insert(row).select('*').single()

    if (error) {
      throw new Error(formatWeeklyCheckinWriteError(error))
    }
    return data
  }

  const accessCode = options.accessCode ?? options.coachAccessCode

  if (!String(accessCode ?? '').trim()) {
    console.warn('[weekly_checkins] sin sesión Supabase y sin accessCode — no se llama al insert del cliente')
    throw new Error(SESSION_EXPIRED_MSG)
  }

  return createWeeklyCheckinViaServer(payload, accessCode)
}

export async function listWeeklyCheckinsByWeek(weekIso) {
  const data = await callOperationalData('list_weekly_checkins', { weekIso }, 'admin')
  return data || []
}
