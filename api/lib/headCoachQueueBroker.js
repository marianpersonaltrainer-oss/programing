import { createClient } from '@supabase/supabase-js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class HeadCoachQueueBrokerError extends Error {
  constructor(code) {
    super(code)
    this.name = 'HeadCoachQueueBrokerError'
    this.code = code
  }
}

function serverClient({ env, createClientImpl }) {
  const url = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim()
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url || !key) throw new HeadCoachQueueBrokerError('queue_not_configured')
  return createClientImpl(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

function oneRow(data) {
  return Array.isArray(data) ? data[0] || null : data || null
}

export function createHeadCoachQueueBroker({
  env = process.env,
  createClientImpl = createClient,
  now = () => new Date(),
} = {}) {
  return {
    async claim() {
      const { data, error } = await serverClient({ env, createClientImpl })
        .rpc('claim_head_coach_question')
      if (error) throw new HeadCoachQueueBrokerError('claim_unavailable')
      const row = oneRow(data)
      if (!row) return null
      return {
        ticket: row.id,
        question: row.question,
        classContext: row.class_context,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      }
    },

    async answer({ ticket, response } = {}) {
      const id = String(ticket || '').trim()
      const text = String(response || '').trim()
      if (!UUID_RE.test(id) || !text || text.length > 6000) {
        throw new HeadCoachQueueBrokerError('invalid_answer')
      }
      const { data, error } = await serverClient({ env, createClientImpl })
        .from('head_coach_questions')
        .update({ status: 'answered', response: text, answered_at: now().toISOString() })
        .eq('id', id)
        .eq('status', 'processing')
        .gt('expires_at', now().toISOString())
        .select('id,status,answered_at')
        .maybeSingle()
      if (error) throw new HeadCoachQueueBrokerError('answer_unavailable')
      if (!data?.id || data.status !== 'answered') {
        throw new HeadCoachQueueBrokerError('ticket_unavailable')
      }
      return { ticket: data.id, status: data.status, answeredAt: data.answered_at }
    },

    async status({ ticket, organizationId, requesterUserId } = {}) {
      const id = String(ticket || '').trim()
      if (!UUID_RE.test(id) || !organizationId || !requesterUserId) {
        throw new HeadCoachQueueBrokerError('invalid_ticket')
      }
      const { data, error } = await serverClient({ env, createClientImpl })
        .from('head_coach_questions')
        .select('id,status,response,created_at,answered_at,expires_at')
        .eq('id', id)
        .eq('organization_id', organizationId)
        .eq('requester_user_id', requesterUserId)
        .maybeSingle()
      if (error) throw new HeadCoachQueueBrokerError('status_unavailable')
      if (!data) return null
      return {
        ticket: data.id,
        status: data.status,
        response: data.response || null,
        createdAt: data.created_at,
        answeredAt: data.answered_at,
        expiresAt: data.expires_at,
      }
    },
  }
}
