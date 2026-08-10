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

export function createWodBusterAdapter({ config = getWodBusterServerConfig(), fetchImpl = fetch } = {}) {
  async function request(resource, params = {}) {
    const endpoint = config.endpoints[resource]
    const url = new URL(endpoint)
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
    const headers = {
      Accept: 'application/json',
      ...authHeaders(config),
    }

    try {
      // WodBuster's Data API documentation exposes the resource URL but not a
      // stable method contract for every tenant. Probe GET first; if the route
      // explicitly rejects that method (405), retry the same authenticated
      // request as POST. We do not retry other HTTP errors, so auth/permission
      // failures remain visible instead of being masked.
      let response = await fetchImpl(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      })

      if (response.status === 405) {
        response = await fetchImpl(url, {
          method: 'POST',
          headers,
          signal: controller.signal,
        })
      }

      if (!response.ok) throw new Error(`WodBuster ${resource} respondió HTTP ${response.status}`)
      return unwrapRows(await response.json())
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
