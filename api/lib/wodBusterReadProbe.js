// Read-only report probe. Never returns credentials or report row values.
export async function probeWodBuster({ env, fetchImpl = fetch, from, to, legacyEncoding = false, report = 'CuantoEntrenan' }) {
  const endpoints = { CuantoEntrenan: 'https://evolution.wodbuster.com/api/box/CuantoEntrenan', CuantoEnsenan: 'https://evolution.wodbuster.com/api/box/CuantoEnse%C3%B1an' }
  if (!Object.hasOwn(endpoints, report)) return { ok: false, error: 'invalid_report' }
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
    const response = await fetchImpl(endpoints[report], {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Basic ${Buffer.from(`${user}:${password}`, legacyEncoding ? 'latin1' : 'utf8').toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'EVO-ReadOnly-Probe',
      },
      body: new URLSearchParams({ Desde: String(Math.floor(start / 1000)), Hasta: String(Math.floor(end / 1000)) }).toString(),
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location') || ''
      let login = false
      try {
        const destination = new URL(location, 'https://evolution.wodbuster.com')
        login = destination.origin === 'https://evolution.wodbuster.com' && destination.pathname.toLowerCase() === '/login.aspx'
      } catch {}
      // The supplied Windows Excel macro uses vbFromUnicode (legacy codepage).
      // Retry once only for the safely representable Latin-1 subset, without
      // following the redirect or altering credentials. Never guess passwords.
      const credentials = `${user}:${password}`
      if (login && !legacyEncoding && /[\u00a0-\u00ff]/.test(credentials) && /^[\u0000-\u007f\u00a0-\u00ff]*$/.test(credentials)) {
        return probeWodBuster({ env, fetchImpl, from, to, legacyEncoding: true, report })
      }
      return { ok: false, error: login ? 'upstream_login_redirect' : 'upstream_redirect_blocked', status: response.status, legacyEncodingTried: legacyEncoding }
    }
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
