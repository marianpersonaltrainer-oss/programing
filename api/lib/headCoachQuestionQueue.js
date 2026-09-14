import { createClient } from '@supabase/supabase-js'

export class HeadCoachQuestionQueueError extends Error {
  constructor(code) {
    super(code)
    this.name = 'HeadCoachQuestionQueueError'
    this.code = code
  }
}

function readConfig(env) {
  const supabaseUrl = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim()
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!supabaseUrl || !serviceKey) {
    throw new HeadCoachQuestionQueueError('queue_not_configured')
  }
  return { supabaseUrl, serviceKey }
}

/**
 * Guarda únicamente una pregunta de clase ya validada.
 * La clave de servicio nunca sale de Vercel y el navegador no recibe el
 * contexto completo ni puede leer directamente esta tabla.
 */
export function createHeadCoachQueueDispatcher({
  env = process.env,
  createClientImpl = createClient,
} = {}) {
  return async function enqueueHeadCoachQuestion({ envelope, authorization } = {}) {
    const organizationId = String(authorization?.organizationId || '').trim()
    const requesterUserId = String(authorization?.user?.id || '').trim()
    if (!organizationId || !requesterUserId || !envelope?.question || !envelope?.classContext) {
      throw new HeadCoachQuestionQueueError('queue_input_invalid')
    }

    const { supabaseUrl, serviceKey } = readConfig(env)
    const supabase = createClientImpl(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const { data, error } = await supabase
      .from('head_coach_questions')
      .insert({
        organization_id: organizationId,
        requester_user_id: requesterUserId,
        class_context: envelope.classContext,
        question: envelope.question,
      })
      .select('id,status,expires_at')
      .single()

    if (error || !data?.id || data.status !== 'queued') {
      throw new HeadCoachQuestionQueueError('queue_unavailable')
    }

    return {
      ticket: data.id,
      status: data.status,
      expiresAt: data.expires_at,
    }
  }
}
