/*
 * WodBuster adapter boundary for Mi Camino EVO.
 *
 * IMPORTANT:
 * - Do not add guessed endpoints here.
 * - Credentials are server-side env vars only.
 * - The live implementation is activated only after official account/API access is verified.
 * - Business rules consume normalized records, never raw WodBuster responses.
 */

export class WodBusterConfigurationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'WodBusterConfigurationError'
  }
}

function requiredServerEnv(name) {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new WodBusterConfigurationError(`Falta configuración server-side: ${name}`)
  return value
}

export function getWodBusterServerConfig() {
  return {
    baseUrl: requiredServerEnv('WODBUSTER_API_BASE_URL'),
    apiKey: requiredServerEnv('WODBUSTER_API_KEY'),
    // Exact header/auth format must be mapped from verified official WodBuster documentation/account access.
    authMode: String(process.env.WODBUSTER_AUTH_MODE || '').trim(),
    organizationExternalId: String(process.env.WODBUSTER_ORG_ID || '').trim(),
  }
}

export function createWodBusterAdapter({ transport, config } = {}) {
  const resolvedConfig = config || getWodBusterServerConfig()
  const resolvedTransport = transport || defaultTransport

  return {
    async listUsers(params = {}) {
      return resolvedTransport({ resource: 'users', params, config: resolvedConfig })
    },
    async listReservations(params = {}) {
      return resolvedTransport({ resource: 'reservations', params, config: resolvedConfig })
    },
    async listAttendance(params = {}) {
      return resolvedTransport({ resource: 'attendance', params, config: resolvedConfig })
    },
  }
}

async function defaultTransport() {
  throw new WodBusterConfigurationError(
    'El transporte WodBuster live todavía no está activado. Verifica endpoints y autenticación oficiales antes de implementarlo.',
  )
}
