/* Shared server-only WodBuster Data API adapter.
 * Keep this module outside src/ so it is never bundled into either frontend.
 */
export class WodBusterConfigurationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'WodBusterConfigurationError'
  }
}

const required = (env, name) => {
  const value = String(env[name] || '').trim()
  if (!value) throw new WodBusterConfigurationError(`Falta configuración server-side: ${name}`)
  return value
}

export function getWodBusterServerConfig(env = process.env) {
  const timeoutMs = Number(env.WODBUSTER_DATA_TIMEOUT_MS || 15000)
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new WodBusterConfigurationError('WODBUSTER_DATA_TIMEOUT_MS debe ser un número positivo')
  }

  const username = String(env.WODBUSTER_DATA_USER || '').trim() || null
  const authMode = String(env.WODBUSTER_DATA_AUTH_MODE || (username ? 'basic' : 'header')).trim().toLowerCase()
  if (!['basic', 'header'].includes(authMode)) {
    throw new WodBusterConfigurationError('WODBUSTER_DATA_AUTH_MODE debe ser basic o header')
  }

  return {
    endpoints: {
      athletes: required(env, 'WODBUSTER_DATA_ATLETAS_URL'),
      training: required(env, 'WODBUSTER_DATA_CUANTO_ENTRENAN_URL'),
      coaching: required(env, 'WODBUSTER_DATA_CUANTO_ENSENAN_URL'),
    },
    username,
    accessKey: required(env, 'WODBUSTER_DATA_ACCESS_KEY'),
    authMode,
    authHeader: String(env.WODBUSTER_DATA_AUTH_HEADER || 'API_ACCESS_KEY').trim(),
    timeoutMs,
  }
}

function unwrapRows(body) {
  if (Array.isArray(body)) return body
  for (const key of ['data', 'result', 'results', 'items', 'rows']) {
    if (Array.isArray(body?.[key])) return body[key]
  }
  return []
}

function authHeaders(config) {
  if (config.authMode === 'basic') {
    if (!config.username) throw new WodBusterConfigurationError('WODBUSTER_DATA_USER es obligatorio con auth basic')
    const token = Buffer.from(`${config.username}:${config.accessKey}`, 'utf8').toString('base64')
    return { Authorization: `Basic ${token}` }
  }
  return { [config.authHeader]: config.accessKey }
}

function endpointCandidates(resource, endpoint) {
  const primary = new URL(endpoint)
  if (resource !== 'coaching' || !primary.pathname.endsWith('/CuantoEnsenan')) return [primary]

  // The WodBuster UI names this permission “CuantoEnseñan”. Some tenant
  // routes preserve the ñ while config/secrets commonly use ASCII-only names.
  // Try the literal UI route only after the configured route returns 404.
  const literalUiRoute = new URL(primary)
  literalUiRoute.pathname = literalUiRoute.pathname.replace(/CuantoEnsenan$/, 'CuantoEnseñan')
  return [primary, literalUiRoute]
}

export function createWodBusterAdapter({ config = getWodBusterServerConfig(), fetchImpl = fetch } = {}) {
  async function request(resource, params = {}) {
    const candidates = endpointCandidates(resource, config.endpoints[resource])
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
    const headers = {
      Accept: 'application/json',
      ...authHeaders(config),
    }

    try {
      let lastResponse = null

      for (const baseUrl of candidates) {
        const url = new URL(baseUrl)
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
        }

        let response = await fetchImpl(url, {
          method: 'GET',
          headers,
          signal: controller.signal,
        })

        // Live staging showed the Data API route rejects GET with 405. Retry
        // the exact same authenticated request as POST; do not mask auth errors.
        if (response.status === 405) {
          response = await fetchImpl(url, {
            method: 'POST',
            headers,
            signal: controller.signal,
          })
        }

        lastResponse = response
        if (response.ok) return unwrapRows(await response.json())

        // Only the coaching route has one verified naming ambiguity from the
        // WodBuster UI (Ensenan vs Enseñan). Continue solely on 404.
        if (resource === 'coaching' && response.status === 404) continue
        throw new Error(`WodBuster ${resource} respondió HTTP ${response.status}`)
      }

      throw new Error(`WodBuster ${resource} respondió HTTP ${lastResponse?.status || 'desconocido'}`)
    } finally {
      clearTimeout(timeout)
    }
  }

  return {
    listAthletes: () => request('athletes'),
    listTraining: ({ from, to }) => request('training', { FechaInicio: from, FechaFin: to }),
    listCoaching: ({ from, to }) => request('coaching', { FechaInicio: from, FechaFin: to }),
  }
}
