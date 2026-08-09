/* Server-only WodBuster Data API adapter. Never import this module from src/. */
export class WodBusterConfigurationError extends Error {
  constructor(message) { super(message); this.name = 'WodBusterConfigurationError' }
}

const required = (env, name) => {
  const value = String(env[name] || '').trim()
  if (!value) throw new WodBusterConfigurationError(`Falta configuración server-side: ${name}`)
  return value
}

export function getWodBusterServerConfig(env = process.env) {
  return {
    endpoints: {
      athletes: required(env, 'WODBUSTER_DATA_ATLETAS_URL'),
      training: required(env, 'WODBUSTER_DATA_CUANTO_ENTRENAN_URL'),
      coaching: required(env, 'WODBUSTER_DATA_CUANTO_ENSENAN_URL'),
    },
    accessKey: required(env, 'WODBUSTER_DATA_ACCESS_KEY'),
    authHeader: String(env.WODBUSTER_DATA_AUTH_HEADER || 'API_ACCESS_KEY').trim(),
    timeoutMs: Number(env.WODBUSTER_DATA_TIMEOUT_MS || 15000),
  }
}

export function createWodBusterAdapter({ config = getWodBusterServerConfig(), fetchImpl = fetch } = {}) {
  async function get(resource, params = {}) {
    const endpoint = config.endpoints[resource]
    const url = new URL(endpoint)
    for (const [key, value] of Object.entries(params)) if (value != null && value !== '') url.searchParams.set(key, value)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
    try {
      const response = await fetchImpl(url, {
        headers: { Accept: 'application/json', [config.authHeader]: config.accessKey },
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`WodBuster ${resource} respondió HTTP ${response.status}`)
      const body = await response.json()
      return Array.isArray(body) ? body : (body?.data || body?.result || body?.results || [])
    } finally { clearTimeout(timeout) }
  }
  return {
    listAthletes: () => get('athletes'),
    listTraining: ({ from, to }) => get('training', { FechaInicio: from, FechaFin: to }),
    listCoaching: ({ from, to }) => get('coaching', { FechaInicio: from, FechaFin: to }),
  }
}
