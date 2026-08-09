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

  return {
    endpoints: {
      athletes: required(env, 'WODBUSTER_DATA_ATLETAS_URL'),
      training: required(env, 'WODBUSTER_DATA_CUANTO_ENTRENAN_URL'),
      coaching: required(env, 'WODBUSTER_DATA_CUANTO_ENSENAN_URL'),
    },
    accessKey: required(env, 'WODBUSTER_DATA_ACCESS_KEY'),
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

export function createWodBusterAdapter({ config = getWodBusterServerConfig(), fetchImpl = fetch } = {}) {
  async function get(resource, params = {}) {
    const endpoint = config.endpoints[resource]
    const url = new URL(endpoint)
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          [config.authHeader]: config.accessKey,
        },
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`WodBuster ${resource} respondió HTTP ${response.status}`)
      return unwrapRows(await response.json())
    } finally {
      clearTimeout(timeout)
    }
  }

  return {
    listAthletes: () => get('athletes'),
    listTraining: ({ from, to }) => get('training', { FechaInicio: from, FechaFin: to }),
    listCoaching: ({ from, to }) => get('coaching', { FechaInicio: from, FechaFin: to }),
  }
}
