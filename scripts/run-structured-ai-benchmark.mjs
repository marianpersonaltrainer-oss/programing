import {
  STRUCTURED_AI_BENCHMARK_CASES,
  buildStructuredAiBenchmarkRequest,
  evaluateStructuredAiBenchmarkOutput,
} from '../api/lib/structuredAiBenchmarkPlan.js'
import { requestAnthropicStructuredOutput } from '../api/lib/anthropicStructuredRequest.js'
import { requestOpenAiStructuredOutput } from '../api/lib/openaiStructuredRequest.js'
import { runStructuredAiComparison } from '../api/lib/structuredAiComparison.js'

const CONFIRMATION = 'COMPARE_SYNTHETIC_OUTPUTS'

function required(name) {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new Error(`Falta ${name}.`)
  return value
}

function positiveNumber(name) {
  const parsed = Number(required(name))
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} debe ser un número positivo.`)
  }
  return parsed
}

if (!process.argv.includes('--execute')) {
  throw new Error('Benchmark bloqueado: falta --execute.')
}
if (process.env.EVO_AI_COMPARISON_CONFIRM !== CONFIRMATION) {
  throw new Error(`Benchmark bloqueado: falta EVO_AI_COMPARISON_CONFIRM=${CONFIRMATION}.`)
}

const requestedProviders = String(
  process.env.EVO_AI_COMPARISON_PROVIDERS || 'anthropic,openai',
)
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean)
const selectedProviders = [...new Set(requestedProviders)]
if (!selectedProviders.length || selectedProviders.some(
  (provider) => !['anthropic', 'openai'].includes(provider),
)) {
  throw new Error('EVO_AI_COMPARISON_PROVIDERS sólo admite anthropic y openai.')
}

const providers = {}
const pricingByProvider = {}

if (selectedProviders.includes('anthropic')) {
  const anthropicApiKey = required('ANTHROPIC_API_KEY')
  const anthropicModel = required('ANTHROPIC_COMPARISON_MODEL')
  providers.anthropic = (request) => requestAnthropicStructuredOutput({
    ...request,
    apiKey: anthropicApiKey,
    model: anthropicModel,
  })
  pricingByProvider.anthropic = {
    inputPerMillionUsd: positiveNumber('ANTHROPIC_INPUT_USD_PER_M'),
    outputPerMillionUsd: positiveNumber('ANTHROPIC_OUTPUT_USD_PER_M'),
  }
}

if (selectedProviders.includes('openai')) {
  const openAiApiKey = required('OPENAI_API_KEY')
  const openAiModel = required('OPENAI_COMPARISON_MODEL')
  providers.openai = (request) => requestOpenAiStructuredOutput({
    ...request,
    apiKey: openAiApiKey,
    model: openAiModel,
  })
  pricingByProvider.openai = {
    inputPerMillionUsd: positiveNumber('OPENAI_INPUT_USD_PER_M'),
    outputPerMillionUsd: positiveNumber('OPENAI_OUTPUT_USD_PER_M'),
  }
}

const cases = STRUCTURED_AI_BENCHMARK_CASES.map((testCase) => ({
  ...testCase,
  request: buildStructuredAiBenchmarkRequest(testCase),
}))

const comparison = await runStructuredAiComparison({
  cases,
  providers,
  evaluate: evaluateStructuredAiBenchmarkOutput,
  pricingByProvider,
})

// El informe excluye deliberadamente prompts, respuestas y secretos.
process.stdout.write(`${JSON.stringify(comparison, null, 2)}\n`)
