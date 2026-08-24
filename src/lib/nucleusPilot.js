import { getPe2Session } from './pe2Auth.js'

export function isNucleusPilotVisible({ enabled, search }) {
  if (String(enabled || '').toLowerCase() !== 'true') return false
  return new URLSearchParams(String(search || '')).get('nucleusPilot') === '1'
}

export async function runNucleusPilotEvent(
  { idempotencyKey, occurredAt },
  {
    getSessionImpl = getPe2Session,
    fetchImpl = fetch,
  } = {},
) {
  const session = await getSessionImpl()
  const token = String(session?.access_token || '').trim()
  if (!token) throw new Error('authentication_required')

  const response = await fetchImpl('/api/nucleus-pilot-event', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ idempotencyKey, occurredAt }),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(json?.error || 'nucleus_pilot_failed')
  return json
}
