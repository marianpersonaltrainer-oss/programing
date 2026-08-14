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

const anthropicApiKey = required('ANTHROPIC_API_KEY')
const openAiApiKey = required('OPENAI_API_KEY')
const anthropicModel = required('ANTHROPIC_COMPARISON_MODEL')
const openAiModel = required('OPENAI_COMPARISON_MODEL')

const cases = STRUCTURED_AI_BENCHMARK_CASES.map((testCase) => ({
  ...testCase,
  request: buildStructuredAiBenchmarkRequest(testCase),
}))

const comparison = await runStructuredAiComparison({
  cases,
  providers: {
    anthropic: (request) => requestAnthropicStructuredOutput({
      ...request,
      apiKey: anthropicApiKey,
      model: anthropicModel,
    }),
    openai: (request) => requestOpenAiStructuredOutput({
      ...request,
      apiKey: openAiApiKey,
      model: openAiModel,
    }),
  },
  evaluate: evaluateStructuredAiBenchmarkOutput,
  pricingByProvider: {
    anthropic: {
      inputPerMillionUsd: positiveNumber('ANTHROPIC_INPUT_USD_PER_M'),
      outputPerMillionUsd: positiveNumber('ANTHROPIC_OUTPUT_USD_PER_M'),
    },
    openai: {
      inputPerMillionUsd: positiveNumber('OPENAI_INPUT_USD_PER_M'),
      outputPerMillionUsd: positiveNumber('OPENAI_OUTPUT_USD_PER_M'),
    },
  },
})

// El informe excluye deliberadamente prompts, respuestas y secretos.
process.stdout.write(`${JSON.stringify(comparison, null, 2)}\n`)
