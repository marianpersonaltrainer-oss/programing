import { timingSafeEqual } from 'node:crypto'

export function adminSecretsMatch(provided, expected) {
  const a = Buffer.from(String(provided || '').trim())
  const b = Buffer.from(String(expected || '').trim())
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b)
}

export function getClientIp(req) {
  const forwarded = String(req?.headers?.['x-forwarded-for'] || '')
    .split(',')[0]
    ?.trim()
  const value =
    forwarded ||
    String(req?.headers?.['x-real-ip'] || '').trim() ||
    String(req?.socket?.remoteAddress || '').trim() ||
    'unknown'
  return value.replace(/^::ffff:/, '')
}

/**
 * Usa el bucket transaccional ya compartido por las APIs de EVO. Falla cerrado:
 * una ruta con datos internos o coste de IA no continúa si no puede comprobar
 * el límite.
 */
export async function checkAdminRateLimit(
  supabase,
  req,
  { endpoint, limit = 20, windowMinutes = 10 } = {},
) {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_ip: getClientIp(req),
    p_endpoint: String(endpoint || '/api/evo-admin'),
    p_limit: Number(limit),
    p_window_minutes: Number(windowMinutes),
  })
  if (error) throw new Error(`rate_limit_unavailable:${error.message || error.code || 'unknown'}`)
  return data === true || data?.check_rate_limit === true
}
