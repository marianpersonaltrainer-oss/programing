// Read-only report probe. Never returns credentials or report row values.
export async function probeWodBuster({ env, fetchImpl = fetch, from, to }) {
  const user = env.WODBUSTER_API_USER
  const password = env.WODBUSTER_API_PASSWORD
  if (!user || !password || !env.WODBUSTER_BOX) return { ok: false, error: 'missing_configuration' }
  if (env.WODBUSTER_BOX !== 'evolution') return { ok: false, error: 'unexpected_box' }
  const start = Date.parse(from)
  const end = Date.parse(to)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 86400000) {
    return { ok: false, error: 'invalid_window' }
  }
  try {
    const response = await fetchImpl('https://evolution.wodbuster.com/api/box/CuantoEntrenan', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'EVO-ReadOnly-Probe',
      },
      body: new URLSearchParams({ Desde: String(Math.floor(start / 1000)), Hasta: String(Math.floor(end / 1000)) }).toString(),
    })
    if (!response.ok) return { ok: false, error: 'upstream_http_error', status: response.status }
    let data
    try { data = await response.json() } catch {
      return { ok: false, error: 'non_json_response', status: response.status }
    }
    if (!Array.isArray(data)) return { ok: false, error: 'unexpected_response_shape', status: response.status }
    // Report schema only; no names, identifiers, metrics, or row contents escape.
    const fields = [...new Set(data.slice(0, 10).flatMap(row => row && typeof row === 'object' && !Array.isArray(row) ? Object.keys(row) : []))]
      .filter(key => /^[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ_ 0-9?¿()-]{0,63}$/.test(key)).slice(0, 50)
    return { ok: true, status: response.status, records: data.length, fields }
  } catch (error) {
    const codes = new Set(['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_TLS_CERT_ALTNAME_INVALID'])
    const reason = error?.name === 'TimeoutError' ? 'timeout' : codes.has(error?.cause?.code) ? error.cause.code : 'network_or_redirect'
    return { ok: false, error: 'request_failed', reason }
  }
}
