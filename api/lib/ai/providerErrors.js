export const AI_ERROR_CODES = Object.freeze({
  INVALID_REQUEST: 'invalid_request',
  INSUFFICIENT_CREDIT: 'insufficient_credit',
  INVALID_API_KEY: 'invalid_api_key',
  TIMEOUT: 'upstream_timeout',
  RATE_LIMIT: 'rate_limit',
  MODEL_UNAVAILABLE: 'model_unavailable',
  INVALID_OUTPUT: 'invalid_structured_output',
  NETWORK: 'provider_network_error',
  ABORTED: 'request_aborted',
  PROVIDER_HTTP: 'provider_http_error',
})

export class AiProviderError extends Error {
  constructor(message, { code, status = 502, provider = null, providerRequestId = null, retriable = false, cause, details } = {}) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'AiProviderError'
    this.code = code || AI_ERROR_CODES.NETWORK
    this.status = Number(status) || 502
    this.provider = provider
    this.providerRequestId = providerRequestId
    this.retriable = Boolean(retriable)
    if (details !== undefined) this.details = details
  }
}

export const isAiProviderError = (error) => error instanceof AiProviderError

export function classifyOpenAiError(error) {
  const status = Number(error?.status) || 502
  const type = String(error?.error?.type || error?.type || '').toLowerCase()
  const code = String(error?.error?.code || error?.code || '').toLowerCase()
  const message = String(error?.message || '').toLowerCase()
  if (status === 401) return AI_ERROR_CODES.INVALID_API_KEY
  if (code.includes('insufficient_quota') || type.includes('insufficient_quota') || message.includes('billing') || message.includes('credit')) return AI_ERROR_CODES.INSUFFICIENT_CREDIT
  if (status === 429) return AI_ERROR_CODES.RATE_LIMIT
  if (status === 404 || code.includes('model_not_found') || message.includes('model') && message.includes('not found')) return AI_ERROR_CODES.MODEL_UNAVAILABLE
  if (error?.name === 'AbortError' || code === 'upstream_timeout') return AI_ERROR_CODES.TIMEOUT
  if (status >= 400 && status < 500) return AI_ERROR_CODES.PROVIDER_HTTP
  return AI_ERROR_CODES.NETWORK
}

export const errorStatusForCode = (code) => ({
  [AI_ERROR_CODES.INVALID_API_KEY]: 401,
  [AI_ERROR_CODES.INSUFFICIENT_CREDIT]: 402,
  [AI_ERROR_CODES.RATE_LIMIT]: 429,
  [AI_ERROR_CODES.MODEL_UNAVAILABLE]: 503,
  [AI_ERROR_CODES.TIMEOUT]: 504,
  [AI_ERROR_CODES.INVALID_OUTPUT]: 502,
  [AI_ERROR_CODES.ABORTED]: 499,
}[code] || 502)
