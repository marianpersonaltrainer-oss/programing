import { requestAnthropicStructuredOutput } from '../anthropicStructuredRequest.js'
import { requestOpenAiStructuredOutput } from './openaiProvider.js'
import { AiProviderError, AI_ERROR_CODES } from './providerErrors.js'

export function getAiProviderConfig(env = process.env) {
  return {
    provider: String(env.AI_PROVIDER || 'openai').trim().toLowerCase(),
    openaiApiKey: String(env.OPENAI_API_KEY || '').trim(),
    anthropicApiKey: String(env.ANTHROPIC_API_KEY || '').trim(),
    anthropicFallback: String(env.AI_ANTHROPIC_FALLBACK || '').toLowerCase() === 'true',
  }
}

export const hasConfiguredAiProvider = (config) => Boolean(
  config?.openaiApiKey || ((!config?.provider || config?.provider === 'anthropic') && config?.anthropicApiKey),
)

/** Punto común de acceso: OpenAI es principal; Claude solo se usa si se habilita explícitamente. */
export async function requestAiStructuredOutput(options) {
  const config = options.providerConfig || getAiProviderConfig()
  const useAnthropic = config.provider === 'anthropic'
  if (useAnthropic) return requestAnthropicStructuredOutput({ ...options, apiKey: config.anthropicApiKey })
  if (!config.openaiApiKey) throw new AiProviderError('Falta OPENAI_API_KEY en el servidor.', { code: AI_ERROR_CODES.INVALID_API_KEY, status: 500, provider: 'openai' })
  try {
    return await requestOpenAiStructuredOutput({ ...options, apiKey: config.openaiApiKey })
  } catch (error) {
    if (!config.anthropicFallback || !config.anthropicApiKey || error?.code === AI_ERROR_CODES.INVALID_OUTPUT) throw error
    return requestAnthropicStructuredOutput({ ...options, apiKey: config.anthropicApiKey })
  }
}
