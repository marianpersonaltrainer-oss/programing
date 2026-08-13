import { createClient } from '@supabase/supabase-js'
import {
  adminSecretsMatch,
  checkAdminRateLimit,
} from './lib/evoAdminAuth.js'
import {
  capabilityAuthErrorResponse,
  requireEvoCapability,
} from './lib/evoCapabilityAuth.js'

const COACH_ACTIONS = new Set([
  'create_coach_session',
  'touch_coach_session',
  'insert_coach_message',
  'get_assistant_context',
  'insert_assistant_history',
  'insert_feedback',
  'list_feedback_week',
  'handover_status',
  'mark_handover_read',
  'list_today_handoffs',
  'insert_daily_handoff',
  'get_weekly_checkin',
])

const ADMIN_ACTIONS = new Set([
  'get_assistant_context',
  'upsert_assistant_context',
  'list_assistant_history',
  'list_feedback_week',
  'list_feedback_all',
  'list_feedback_weeks',
  'list_daily_handoffs',
  'list_weekly_checkins',
  'list_missing_exercises',
  'upsert_missing_exercises',
  'update_missing_exercise',
  'list_coach_sessions',
  'list_session_messages',
])

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DAY_KEY_RE = /^[a-z0-9_-]{0,40}$/i

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body)
  return {}
}

function text(value, max, { required = false } = {}) {
  const normalized = String(value ?? '').trim()
  if (required && !normalized) throw new Error('required_field')
  if (normalized.length > max) throw new Error('field_too_long')
  return normalized || null
}

function uuid(value, { required = false } = {}) {
  const normalized = String(value ?? '').trim()
  if (!normalized && !required) return null
  if (!UUID_RE.test(normalized)) throw new Error('invalid_uuid')
  return normalized
}

function integer(value, min, max, { required = false } = {}) {
  if ((value == null || value === '') && !required) return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error('invalid_integer')
  }
  return parsed
}

function boolean(value) {
  return value === true
}

function array(value, maxItems = 100) {
  if (value == null) return []
  if (!Array.isArray(value) || value.length > maxItems) throw new Error('invalid_array')
  return value
}

function coachCodeMatches(provided, expected) {
  return adminSecretsMatch(
    String(provided || '').trim().toUpperCase(),
    String(expected || '').trim().toUpperCase(),
  )
}

function requireConfigured(action) {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim()
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const coachCode = String(process.env.COACH_ACCESS_CODE || '').trim()
  const adminSecret = String(process.env.COACH_GUIDE_ADMIN_SECRET || '').trim()
  const individualCoachAuthEnabled = String(
    process.env.COACH_INDIVIDUAL_AUTH_ENABLED || '',
  ).trim().toLowerCase() === 'true'
  const needsCoachCode = COACH_ACTIONS.has(action)
  const needsAdminSecret = ADMIN_ACTIONS.has(action)
  if (
    !supabaseUrl
    || !serviceKey
    || (needsCoachCode && !coachCode && !individualCoachAuthEnabled)
    || (needsAdminSecret && !adminSecret)
  ) {
    throw new Error('server_not_configured')
  }
  return {
    supabaseUrl,
    serviceKey,
    coachCode,
    adminSecret,
    individualCoachAuthEnabled,
  }
}

async function resolveAuthorization(
  req,
  action,
  body,
  config,
  requireCapabilityImpl,
) {
  const coachAllowed = COACH_ACTIONS.has(action)
    && coachCodeMatches(body.accessCode, config.coachCode)
  const adminAllowed = ADMIN_ACTIONS.has(action)
    && adminSecretsMatch(body.adminSecret, config.adminSecret)
  if (adminAllowed) return { method: 'admin_secret' }
  if (coachAllowed) return { method: 'coach_access_code' }
  if (!COACH_ACTIONS.has(action)) return null

  if (!config.individualCoachAuthEnabled) return null

  try {
    const identity = await requireCapabilityImpl(
      req,
      'coach.workspace.access',
    )
    return { method: 'individual_identity', identity }
  } catch (error) {
    if (['authentication_required', 'capability_denied'].includes(error?.code)) {
      return null
    }
    throw error
  }
}

function madridDayBounds(now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const timeZoneName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    timeZoneName: 'longOffset',
  }).formatToParts(now).find((part) => part.type === 'timeZoneName')?.value
  const offset = timeZoneName?.match(/GMT([+-]\d{2}:\d{2})/)?.[1] || '+01:00'
  return [`${today}T00:00:00${offset}`, `${today}T23:59:59.999${offset}`]
}

function feedbackRow(payload = {}) {
  const dayKey = text(payload.day_key, 40, { required: true })
  if (!DAY_KEY_RE.test(dayKey)) throw new Error('invalid_day_key')
  const sessionHow = text(payload.session_how, 30, { required: true })
  const timeForExplanation = text(payload.time_for_explanation, 30, { required: true })
  const changedSomething = boolean(payload.changed_something)
  const changedDetails = text(payload.changed_details, 1000)
  if (changedSomething && !changedDetails) throw new Error('missing_change_details')
  return {
    coach_session_id: uuid(payload.coach_session_id),
    coach_name: text(payload.coach_name, 120, { required: true }),
    week_id: uuid(payload.week_id, { required: true }),
    mesociclo: text(payload.mesociclo, 80),
    semana: integer(payload.semana, 1, 99),
    day_key: dayKey,
    class_label: text(payload.class_label, 120, { required: true }),
    session_how: sessionHow,
    time_for_explanation: timeForExplanation,
    changed_something: changedSomething,
    changed_details: changedDetails,
    group_feelings: text(payload.group_feelings, 1000),
    notes_next_week: text(payload.notes_next_week, 1000),
  }
}

function assistantHistoryRow(payload = {}) {
  return {
    week_id: uuid(payload.week_id),
    mesociclo: text(payload.mesociclo, 80),
    semana: integer(payload.semana, 1, 99),
    day_key: text(payload.day_key, 40),
    class_label: text(payload.class_label, 120),
    coach_name: text(payload.coach_name, 120),
    question: text(payload.question, 4000, { required: true }),
    answer: text(payload.answer, 12000, { required: true }),
  }
}

function missingExerciseRow(payload = {}) {
  const dayKey = text(payload.day_key, 40, { required: true })
  if (!DAY_KEY_RE.test(dayKey)) throw new Error('invalid_day_key')
  return {
    mesociclo: text(payload.mesociclo, 80, { required: true }),
    semana: integer(payload.semana, 1, 99, { required: true }),
    day_key: dayKey,
    day_name: text(payload.day_name, 80),
    class_label: text(payload.class_label, 120, { required: true }),
    exercise_name: text(payload.exercise_name, 240, { required: true }),
    exercise_norm: text(payload.exercise_norm, 240, { required: true }),
    resolved: boolean(payload.resolved),
  }
}

async function executeAction(supabase, action, payload = {}) {
  if (action === 'create_coach_session') {
    return supabase.from('coach_sessions').insert({
      week_id: uuid(payload.weekId),
      coach_name: text(payload.coachName, 120, { required: true }),
    }).select('*').single()
  }

  if (action === 'touch_coach_session') {
    return supabase.from('coach_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', uuid(payload.sessionId, { required: true }))
      .select('id').maybeSingle()
  }

  if (action === 'insert_coach_message') {
    const role = text(payload.role, 20, { required: true })
    if (!['user', 'assistant'].includes(role)) throw new Error('invalid_role')
    return supabase.from('coach_messages').insert({
      session_id: uuid(payload.sessionId, { required: true }),
      role,
      content: text(payload.content, 20000, { required: true }),
    }).select('id').single()
  }

  if (action === 'get_assistant_context') {
    return supabase.from('assistant_week_context').select('*')
      .eq('mesociclo', text(payload.mesociclo, 80, { required: true }))
      .eq('semana', integer(payload.semana, 1, 99, { required: true }))
      .maybeSingle()
  }

  if (action === 'upsert_assistant_context') {
    return supabase.from('assistant_week_context').upsert({
      mesociclo: text(payload.mesociclo, 80, { required: true }),
      semana: integer(payload.semana, 1, 99, { required: true }),
      global_notes: text(payload.global_notes, 12000),
      qa_pairs: array(payload.qa_pairs, 200),
      adaptations: array(payload.adaptations, 200),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'mesociclo,semana', ignoreDuplicates: false }).select('*').single()
  }

  if (action === 'insert_assistant_history') {
    return supabase.from('assistant_question_history')
      .insert(assistantHistoryRow(payload)).select('id').single()
  }

  if (action === 'list_assistant_history') {
    let query = supabase.from('assistant_question_history').select('*')
      .order('created_at', { ascending: false })
      .limit(integer(payload.limit, 1, 500) || 400)
    if (payload.mesociclo) query = query.eq('mesociclo', text(payload.mesociclo, 80))
    if (payload.semana != null) query = query.eq('semana', integer(payload.semana, 1, 99))
    return query
  }

  if (action === 'insert_feedback') {
    return supabase.from('coach_session_feedback')
      .insert(feedbackRow(payload)).select('id').single()
  }

  if (action === 'list_feedback_week') {
    return supabase.from('coach_session_feedback').select('*')
      .eq('week_id', uuid(payload.weekId, { required: true }))
      .order('created_at', { ascending: false })
      .limit(integer(payload.limit, 1, 500) || 50)
  }

  if (action === 'list_feedback_all') {
    return supabase.from('coach_session_feedback').select('*')
      .order('created_at', { ascending: false })
      .limit(integer(payload.limit, 1, 500) || 500)
  }

  if (action === 'list_feedback_weeks') {
    const weekIds = array(payload.weekIds, 100).map((value) => uuid(value, { required: true }))
    if (!weekIds.length) return { data: [], error: null }
    return supabase.from('coach_session_feedback')
      .select('class_label, notes_next_week, created_at, week_id')
      .in('week_id', weekIds)
      .not('notes_next_week', 'is', null)
      .order('created_at', { ascending: false })
      .limit(integer(payload.limit, 1, 500) || 40)
  }

  if (action === 'handover_status') {
    return supabase.rpc('coach_has_read_handover', {
      p_week_id: uuid(payload.weekId, { required: true }),
      p_coach_name: text(payload.coachName, 120, { required: true }),
    })
  }

  if (action === 'mark_handover_read') {
    return supabase.rpc('record_coach_handover_read', {
      p_week_id: uuid(payload.weekId, { required: true }),
      p_coach_name: text(payload.coachName, 120, { required: true }),
    })
  }

  if (action === 'list_today_handoffs') {
    const [from, to] = madridDayBounds()
    return supabase.from('daily_handoffs').select('*')
      .gte('created_at', from).lte('created_at', to)
      .order('created_at', { ascending: false }).limit(200)
  }

  if (action === 'insert_daily_handoff') {
    return supabase.from('daily_handoffs').insert({
      coach_id: null,
      coach_name: text(payload.coach_name, 120, { required: true }),
      class_time: text(payload.class_time, 40, { required: true }),
      class_type: text(payload.class_type, 120, { required: true }),
      energy_level: integer(payload.energy_level, 1, 5),
      had_incident: boolean(payload.had_incident),
      note: text(payload.note, 2000),
    }).select('*').single()
  }

  if (action === 'list_daily_handoffs') {
    let query = supabase.from('daily_handoffs').select('*')
      .order('created_at', { ascending: false })
      .limit(integer(payload.limit, 1, 500) || 25)
    if (payload.fromDate) query = query.gte('created_at', `${text(payload.fromDate, 10)}T00:00:00`)
    if (payload.toDate) query = query.lte('created_at', `${text(payload.toDate, 10)}T23:59:59`)
    if (payload.coachName) query = query.eq('coach_name', text(payload.coachName, 120))
    if (payload.classType) query = query.eq('class_type', text(payload.classType, 120))
    if (payload.onlyIncident) query = query.eq('had_incident', true)
    return query
  }

  if (action === 'get_weekly_checkin') {
    return supabase.from('weekly_checkins').select('*')
      .eq('week_iso', text(payload.weekIso, 10, { required: true }))
      .eq('coach_name_norm', text(payload.coachName, 120, { required: true }).toLowerCase())
      .maybeSingle()
  }

  if (action === 'list_weekly_checkins') {
    let query = supabase.from('weekly_checkins').select('*')
      .order('created_at', { ascending: false }).limit(500)
    if (payload.weekIso) query = query.eq('week_iso', text(payload.weekIso, 10))
    return query
  }

  if (action === 'list_missing_exercises') {
    let query = supabase.from('ejercicios_sin_video').select('*')
      .order('created_at', { ascending: false })
      .limit(integer(payload.limit, 1, 500) || 300)
    if (payload.mesociclo) query = query.eq('mesociclo', text(payload.mesociclo, 80))
    if (payload.semana != null) query = query.eq('semana', integer(payload.semana, 1, 99))
    if (payload.onlyUnresolved !== false) query = query.eq('resolved', false)
    return query
  }

  if (action === 'upsert_missing_exercises') {
    const rows = array(payload.rows, 250).map(missingExerciseRow)
    if (!rows.length) return { data: [], error: null }
    return supabase.from('ejercicios_sin_video').upsert(rows, {
      onConflict: 'mesociclo,semana,day_key,class_label,exercise_norm',
      ignoreDuplicates: false,
    }).select('*')
  }

  if (action === 'update_missing_exercise') {
    return supabase.from('ejercicios_sin_video').update({
      suggested_url: text(payload.suggested_url, 2000),
      resolved: boolean(payload.resolved),
      notes: text(payload.notes, 2000),
      updated_at: new Date().toISOString(),
    }).eq('id', uuid(payload.id, { required: true })).select('*').single()
  }

  if (action === 'list_coach_sessions') {
    return supabase.from('coach_sessions').select(`
      *,
      published_weeks (titulo, semana, mesociclo),
      coach_messages (count)
    `).order('last_activity', { ascending: false }).limit(500)
  }

  if (action === 'list_session_messages') {
    return supabase.from('coach_messages').select('*')
      .eq('session_id', uuid(payload.sessionId, { required: true }))
      .order('created_at', { ascending: true }).limit(1000)
  }

  throw new Error('unsupported_action')
}

export function createOperationalDataHandler({
  createClientImpl = createClient,
  checkRateLimitImpl = checkAdminRateLimit,
  executeActionImpl = executeAction,
  requireCapabilityImpl = requireEvoCapability,
} = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' })
    }

    let body
    try {
      body = parseBody(req)
    } catch {
      return res.status(400).json({ error: 'JSON inválido' })
    }

    const action = String(body?.action || '').trim()
    if (!COACH_ACTIONS.has(action) && !ADMIN_ACTIONS.has(action)) {
      return res.status(400).json({ error: 'Acción no permitida' })
    }

    let config
    try {
      config = requireConfigured(action)
    } catch {
      return res.status(500).json({ error: 'Servidor sin configurar' })
    }

    let authorization
    try {
      authorization = await resolveAuthorization(
        req,
        action,
        body,
        config,
        requireCapabilityImpl,
      )
    } catch (error) {
      const response = capabilityAuthErrorResponse(error)
      return res.status(response.status).json(response.body)
    }

    if (!authorization) {
      return res.status(401).json({ error: 'Credencial incorrecta o ausente' })
    }

    const supabase = createClientImpl(config.supabaseUrl, config.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    try {
      const exceeded = await checkRateLimitImpl(supabase, req, {
        endpoint: `/api/operational-data/${action}`,
        limit: 180,
        windowMinutes: 10,
      })
      if (exceeded) return res.status(429).json({ error: 'Demasiadas solicitudes' })

      const { data, error } = await executeActionImpl(supabase, action, body.payload || {})
      if (error) {
        console.error('[operational-data] database operation failed', {
          action,
          code: error.code || 'unknown',
        })
        return res.status(500).json({ error: 'No se pudo completar la operación' })
      }
      return res.status(200).json({ ok: true, data })
    } catch (error) {
      const clientError = [
        'required_field',
        'field_too_long',
        'invalid_uuid',
        'invalid_integer',
        'invalid_array',
        'invalid_day_key',
        'invalid_role',
        'missing_change_details',
      ].includes(error?.message)
      if (!clientError) {
        console.error('[operational-data] request failed', {
          action,
          code: error?.code || error?.name || 'unknown',
        })
      }
      return res.status(clientError ? 400 : 503).json({
        error: clientError ? 'Datos no válidos' : 'Servicio temporalmente no disponible',
      })
    }
  }
}

export default createOperationalDataHandler()
