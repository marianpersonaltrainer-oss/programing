import { supabase } from './supabase.js'

async function authHeaders() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('Inicia sesión de nuevo para revisar el método.')
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function request(path, options = {}) {
  const headers = await authHeaders()
  const response = await fetch(path, { ...options, headers: { ...headers, ...options.headers } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.ok) {
    const error = new Error(payload.detail || payload.error || 'No se pudo revisar el método.')
    error.code = payload.error || 'request_failed'
    error.status = response.status
    throw error
  }
  return payload
}

export async function getMethodRuleReview() {
  const payload = await request('/api/method-rules-review')
  return payload.review
}

export async function submitMethodRuleReview(command) {
  const payload = await request('/api/method-rules-review', {
    method: 'POST',
    body: JSON.stringify(command),
  })
  return payload.result
}
