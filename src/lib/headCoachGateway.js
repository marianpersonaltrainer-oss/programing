import { supabase } from './supabase.js'

const HEAD_COACH_FEATURE_FLAG = 'true'

export function isHeadCoachGatewayEnabled(value = import.meta.env.VITE_HEAD_COACH_GATEWAY_ENABLED) {
  return String(value || '').trim().toLowerCase() === HEAD_COACH_FEATURE_FLAG
}

export function explainHeadCoachGatewayError(code) {
  const messages = {
    identity_required: 'Entra con tu cuenta individual de EVO para consultar al Head Coach.',
    auth_missing: 'Tu sesión no está disponible. Cierra sesión y vuelve a entrar.',
    personal_context_not_allowed: 'Esta primera versión solo responde dudas generales de la clase, sin personas ni salud.',
    mutation_not_allowed: 'Head Coach puede orientar; no publica ni modifica la programación.',
    invalid_question: 'Escribe una duda breve sobre esta clase.',
    invalid_class_context: 'No se ha encontrado el contexto publicado de la clase.',
    head_coach_gateway_not_configured: 'Head Coach todavía no está conectado en este entorno.',
    head_coach_gateway_unavailable: 'Head Coach no está disponible ahora. Prueba más tarde.',
    ticket_not_found: 'No se encontró esta consulta. Vuelve a intentarlo.',
    status_unavailable: 'No se pudo comprobar la respuesta todavía.',
  }
  return messages[code] || 'No se pudo completar la consulta. Inténtalo de nuevo.'
}

export async function getHeadCoachAccessToken({ supabaseClient = supabase } = {}) {
  if (!supabaseClient) return ''
  const { data, error } = await supabaseClient.auth.getSession()
  if (error) throw Object.assign(new Error('auth_missing'), { code: 'auth_missing' })
  return String(data?.session?.access_token || '').trim()
}

async function parseResponse(response) {
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    const code = String(json?.error || 'head_coach_gateway_unavailable')
    throw Object.assign(new Error(code), { code })
  }
  return json
}

export async function submitHeadCoachQuestion({
  question,
  context,
  fetchImpl = fetch,
  getAccessTokenImpl = getHeadCoachAccessToken,
} = {}) {
  const token = await getAccessTokenImpl()
  if (!token) throw Object.assign(new Error('identity_required'), { code: 'identity_required' })

  const response = await fetchImpl('/api/head-coach-question', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question, context }),
  })
  const json = await parseResponse(response)
  const ticket = String(json?.result?.ticket || '').trim()
  if (!ticket) throw Object.assign(new Error('head_coach_gateway_unavailable'), { code: 'head_coach_gateway_unavailable' })
  return ticket
}

export async function getHeadCoachQuestionStatus({
  ticket,
  fetchImpl = fetch,
  getAccessTokenImpl = getHeadCoachAccessToken,
} = {}) {
  const token = await getAccessTokenImpl()
  if (!token) throw Object.assign(new Error('identity_required'), { code: 'identity_required' })
  const response = await fetchImpl(`/api/head-coach-question-status?ticket=${encodeURIComponent(ticket || '')}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await parseResponse(response)
  return json?.result || null
}
