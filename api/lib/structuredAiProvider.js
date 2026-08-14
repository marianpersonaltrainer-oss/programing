import {
  ANTHROPIC_STRUCTURED_ERROR_CODES,
  AnthropicStructuredRequestError,
  isAnthropicStructuredRequestError,
  requestAnthropicStructuredOutput,
} from './anthropicStructuredRequest.js'

export const STRUCTURED_AI_PROVIDERS = Object.freeze({
  ANTHROPIC: 'anthropic',
})

export const DEFAULT_STRUCTURED_AI_PROVIDER = STRUCTURED_AI_PROVIDERS.ANTHROPIC

// Alias neutrales para que handlers, validadores y tests no dependan del
// proveedor. Conservan exactamente las clases y códigos actuales mientras el
// adaptador efectivo siga siendo Anthropic.
export const STRUCTURED_AI_ERROR_CODES = ANTHROPIC_STRUCTURED_ERROR_CODES
export const StructuredAiRequestError = AnthropicStructuredRequestError

export class StructuredAiProviderConfigurationError extends Error {
  constructor(provider) {
    super(`Proveedor de IA estructurada no configurado: ${String(provider || 'vacío')}.`)
    this.name = 'StructuredAiProviderConfigurationError'
    this.code = 'structured_ai_provider_not_configured'
    this.status = 500
    this.retriable = false
    this.provider = String(provider || '')
  }
}

export function isStructuredAiRequestError(error) {
  return (
    isAnthropicStructuredRequestError(error)
    || error instanceof StructuredAiProviderConfigurationError
  )
}

export function createStructuredAiRequester({
  provider = DEFAULT_STRUCTURED_AI_PROVIDER,
  adapters = {
    [STRUCTURED_AI_PROVIDERS.ANTHROPIC]: requestAnthropicStructuredOutput,
  },
} = {}) {
  const normalizedProvider = String(provider || '').trim().toLowerCase()
  const adapter = adapters?.[normalizedProvider]
  if (typeof adapter !== 'function') {
    throw new StructuredAiProviderConfigurationError(normalizedProvider)
  }

  return async function requestStructuredAiOutput(request) {
    const result = await adapter(request)
    return {
      ...result,
      provider: normalizedProvider,
    }
  }
}

export const requestStructuredAiOutput = createStructuredAiRequester()
