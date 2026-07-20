/**
 * Rate limit compartido para endpoints serverless (Supabase RPC check_rate_limit).
 */

function getSupabaseAdminConfig() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url || !serviceKey) return null
  return { url, serviceKey }
}

export function getClientIp(req) {
  const xff = String(req.headers?.['x-forwarded-for'] || '')
  const firstForwarded = xff.split(',')[0]?.trim()
  const ipRaw =
    firstForwarded ||
    String(req.headers?.['x-real-ip'] || '').trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  return String(ipRaw).replace(/^::ffff:/, '')
}

/**
 * @returns {Promise<{ exceeded: boolean, skipped?: boolean }>}
 */
export async function checkRateLimitViaSupabase({ ip, endpoint, limit = 30, windowMinutes = 10 }) {
  const cfg = getSupabaseAdminConfig()
  if (!cfg) {
    return { exceeded: false, skipped: true }
  }
  const rpcUrl = `${cfg.url.replace(/\/$/, '')}/rest/v1/rpc/check_rate_limit`
  const r = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: cfg.serviceKey,
      Authorization: `Bearer ${cfg.serviceKey}`,
    },
    body: JSON.stringify({
      p_ip: ip,
      p_endpoint: endpoint,
      p_limit: limit,
      p_window_minutes: windowMinutes,
    }),
  })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(`rate_limit_rpc_failed_${r.status}_${t.slice(0, 120)}`)
  }
  const payload = await r.json().catch(() => null)
  const exceeded =
    payload === true ||
    payload?.check_rate_limit === true ||
    (Array.isArray(payload) && payload[0]?.check_rate_limit === true)
  return { exceeded: !!exceeded }
}
