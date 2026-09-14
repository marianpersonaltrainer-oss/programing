import { createClient } from '@supabase/supabase-js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const FINGERPRINT_RE = /^[a-z0-9:_-]{16,512}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const ERROR_CODE_RE = /^[a-z][a-z0-9_]{0,119}$/
const VALID_DAYS = new Set(['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'])

export class ProgrammingAgentVpsQueueError extends Error {
  constructor(code) {
    super(code)
    this.name = 'ProgrammingAgentVpsQueueError'
    this.code = code
  }
}

function cleanText(value, maximum) {
  return String(value || '').trim().slice(0, maximum)
}

function serverClient({ env, createClientImpl }) {
  const url = cleanText(env.SUPABASE_URL || env.VITE_SUPABASE_URL, 1000)
  const key = cleanText(env.SUPABASE_SERVICE_ROLE_KEY, 2000)
  if (!url || !key) throw new ProgrammingAgentVpsQueueError('queue_not_configured')
  return createClientImpl(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

function oneRow(data) {
  return Array.isArray(data) ? data[0] || null : data || null
}

function normalizedDays(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 6) {
    throw new ProgrammingAgentVpsQueueError('invalid_request')
  }
  const days = value.map((item) => cleanText(item, 20).toUpperCase())
  if (days.some((day) => !VALID_DAYS.has(day)) || new Set(days).size !== days.length) {
    throw new ProgrammingAgentVpsQueueError('invalid_request')
  }
  return days
}

export function createWeeklyBriefingRequest(input = {}) {
  const fingerprint = cleanText(input.fingerprint, 512)
  const target = input.target && typeof input.target === 'object' && !Array.isArray(input.target)
    ? input.target
    : null
  const mesocycle = cleanText(target?.mesocycle || target?.mesociclo, 100)
  const week = Number(target?.week || target?.semana)
  const cycleStartDate = cleanText(target?.cycleStartDate || target?.cycle_start_date, 10)
  const targetWeekStartDate = cleanText(target?.targetWeekStartDate || target?.week_start_date, 10)
  const contextPack = cleanText(input.contextPack, 48_000)
  const userInstructions = cleanText(input.userInstructions, 4_000)
  const generationDays = normalizedDays(input.generationDays)

  if (
    !FINGERPRINT_RE.test(fingerprint)
    || !mesocycle
    || !Number.isInteger(week)
    || week < 1
    || week > 52
    || !DATE_RE.test(cycleStartDate)
    || !DATE_RE.test(targetWeekStartDate)
    || !contextPack
  ) {
    throw new ProgrammingAgentVpsQueueError('invalid_request')
  }

  return {
    requestType: 'weekly_briefing',
    fingerprint,
    target: { mesocycle, week, cycleStartDate, targetWeekStartDate, generationDays },
    requestPayload: { contextPack, userInstructions },
  }
}

function snapshot(row) {
  if (!row || typeof row !== 'object') return null
  return {
    ticket: row.id,
    status: row.status,
    requestType: row.request_type,
    target: row.target || {},
    response: row.response_payload || null,
    errorCode: row.error_code || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    completedAt: row.completed_at || null,
  }
}

export function createProgrammingAgentVpsQueueBroker({
  env = process.env,
  createClientImpl = createClient,
} = {}) {
  const client = () => serverClient({ env, createClientImpl })
  return {
    async enqueue(input) {
      const request = createWeeklyBriefingRequest(input)
      const supabase = client()
      const inserted = await supabase
        .from('programming_agent_requests')
        .insert({
          request_type: request.requestType,
          fingerprint: request.fingerprint,
          target: request.target,
          request_payload: request.requestPayload,
        })
        .select('*')
        .single()
      if (!inserted.error) return { created: true, request: snapshot(inserted.data) }
      if (inserted.error.code !== '23505') {
        throw new ProgrammingAgentVpsQueueError('enqueue_unavailable')
      }
      const { data, error } = await supabase
        .from('programming_agent_requests')
        .select('*')
        .eq('fingerprint', request.fingerprint)
        .in('status', ['queued', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error || !data) throw new ProgrammingAgentVpsQueueError('enqueue_unavailable')
      return { created: false, request: snapshot(data) }
    },

    async claim() {
      const { data, error } = await client().rpc('claim_programming_agent_request')
      if (error) throw new ProgrammingAgentVpsQueueError('claim_unavailable')
      const row = oneRow(data)
      if (!row) return null
      return {
        ticket: row.id,
        requestType: row.request_type,
        fingerprint: row.fingerprint,
        target: row.target,
        requestPayload: row.request_payload,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      }
    },

    async answer({ ticket, draftMarkdown } = {}) {
      const id = cleanText(ticket, 100)
      const draft = cleanText(draftMarkdown, 24_000)
      if (!UUID_RE.test(id) || !draft) throw new ProgrammingAgentVpsQueueError('invalid_answer')
      const { data, error } = await client().rpc('complete_programming_agent_request', {
        p_request_id: id,
        p_response_payload: { draftMarkdown: draft },
      })
      if (error) throw new ProgrammingAgentVpsQueueError('answer_unavailable')
      if (data !== true) throw new ProgrammingAgentVpsQueueError('ticket_unavailable')
      return { ticket: id, status: 'completed' }
    },

    async fail({ ticket, errorCode } = {}) {
      const id = cleanText(ticket, 100)
      const code = cleanText(errorCode, 120)
      if (!UUID_RE.test(id) || !ERROR_CODE_RE.test(code)) {
        throw new ProgrammingAgentVpsQueueError('invalid_failure')
      }
      const { data, error } = await client().rpc('fail_programming_agent_request', {
        p_request_id: id,
        p_error_code: code,
      })
      if (error) throw new ProgrammingAgentVpsQueueError('failure_unavailable')
      if (data !== true) throw new ProgrammingAgentVpsQueueError('ticket_unavailable')
      return { ticket: id, status: 'failed', errorCode: code }
    },

    async status(ticket) {
      const id = cleanText(ticket, 100)
      if (!UUID_RE.test(id)) throw new ProgrammingAgentVpsQueueError('invalid_ticket')
      const { data, error } = await client()
        .from('programming_agent_requests')
        .select('id,status,request_type,target,response_payload,error_code,created_at,updated_at,completed_at')
        .eq('id', id)
        .maybeSingle()
      if (error) throw new ProgrammingAgentVpsQueueError('status_unavailable')
      return snapshot(data)
    },
  }
}
