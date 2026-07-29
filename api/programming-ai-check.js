/**
 * POST /api/programming-ai-check
 * Petición mínima pero representativa del mismo camino Anthropic Structured Outputs
 * que utiliza la generación real de un día EVO.
 */
import { createClient } from '@supabase/supabase-js'
import {
  DEFAULT_PROGRAMMING_MODEL,
  resolveProgrammingModel,
} from '../src/constants/anthropicModels.js'
import { EVO_DAY_OUTPUT_SCHEMA } from '../src/constants/evoDayOutputSchema.js'
import {
  ANTHROPIC_STRUCTURED_ERROR_CODES,
  AnthropicStructuredRequestError,
  isAnthropicStructuredRequestError,
  requestAnthropicStructuredOutput,
} from './lib/anthropicStructuredRequest.js'
import { getRequestOrigin, isEvoOriginAllowed } from './lib/evoAllowedOrigins.js'
import {
  adminSecretsMatch,
  checkAdminRateLimit,
} from './lib/evoAdminAuth.js'
import { startJsonStream } from './lib/jsonStreamResponse.js'

export const AI_CHECK_UPSTREAM_TIMEOUT_MS = 45_000
export const AI_CHECK_PERSISTENCE_TIMEOUT_MS = 5_000
export const AI_CHECK_MAX_TOKENS = 900
export const AI_CHECK_DAY = 'LUNES'
export const AI_CHECK_CLASS_KEY = 'evofuerza'

function parseBody(req) {
  try {
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8') || '{}')
    if (typeof req.body === 'string') return JSON.parse(req.body || '{}')
    return req.body && typeof req.body === 'object' ? req.body : {}
  } catch {
    return null
  }
}

function getServerConfig() {
  return {
    apiKey: String(
      process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY || '',
    ).trim(),
    adminSecret: String(process.env.COACH_GUIDE_ADMIN_SECRET || '').trim(),
    serviceKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    supabaseUrl: String(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    ).trim(),
  }
}

function newRequestId() {
  return `aicheck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function exactObjectKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index])
}

function assertRepresentativeDay(output, providerRequestId) {
  const rootFields = EVO_DAY_OUTPUT_SCHEMA.required
  const daySchema = EVO_DAY_OUTPUT_SCHEMA.properties.dia
  const dayFields = daySchema.required

  const invalid = (message) => {
    throw new AnthropicStructuredRequestError(message, {
      code: ANTHROPIC_STRUCTURED_ERROR_CODES.INVALID_OUTPUT,
      status: 502,
      providerRequestId,
      retriable: false,
    })
  }

  if (!exactObjectKeys(output, rootFields)) {
    invalid('La comprobación no devolvió exactamente el objeto "dia" del contrato EVO.')
  }
  if (!exactObjectKeys(output.dia, dayFields)) {
    invalid('El día de comprobación no contiene exactamente todos los campos EVO.')
  }
  if (dayFields.some((field) => typeof output.dia[field] !== 'string')) {
    invalid('El día de comprobación contiene campos que no son texto.')
  }
  if (output.dia.nombre.trim().toUpperCase() !== AI_CHECK_DAY) {
    invalid(`La comprobación devolvió un día distinto de ${AI_CHECK_DAY}.`)
  }
  if (output.dia[AI_CHECK_CLASS_KEY].trim().length < 12) {
    invalid('La comprobación no devolvió una muestra real de EvoFuerza.')
  }

  return {
    day: AI_CHECK_DAY,
    classKey: AI_CHECK_CLASS_KEY,
    hasRepresentativeContent: true,
  }
}

function errorStatus(error) {
  const status = Number(error?.status)
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 502
}

function checkMessages() {
  return [
    {
      role: 'user',
      content: [
        `Genera una comprobación mínima para ${AI_CHECK_DAY}.`,
        'Devuelve exactamente el objeto "dia" que exige el schema.',
        'En "evofuerza" escribe una muestra breve pero real, por ejemplo un bloque de fuerza de dos series.',
        'En "feedback_fuerza" incluye una nota breve de escala.',
        'Mantén todos los demás campos como cadenas vacías y no redactes ningún otro día.',
      ].join('\n'),
    },
  ]
}

async function checkGenerationPersistence(supabase) {
  const { error } = await supabase
    .from('programming_generation_jobs')
    .select('id', { head: true, count: 'exact' })
    .limit(1)
  if (error) throw error
  return true
}

async function withAiCheckTimeout(promise, timeoutMs, message) {
  let timeoutId
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(message)),
          timeoutMs,
        )
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export function createProgrammingAiCheckHandler({
  createClientImpl = createClient,
  checkRateLimitImpl = checkAdminRateLimit,
  checkGenerationPersistenceImpl = checkGenerationPersistence,
  requestStructuredImpl = requestAnthropicStructuredOutput,
  startJsonStreamImpl = startJsonStream,
  getServerConfigImpl = getServerConfig,
  newRequestIdImpl = newRequestId,
  nowImpl = Date.now,
  model = DEFAULT_PROGRAMMING_MODEL,
  logger = console,
} = {}) {
  return async function programmingAiCheckHandler(req, res) {
    const requestId = newRequestIdImpl()
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed', requestId })
    }

    const originValue = getRequestOrigin(req)
    const isDev = process.env.NODE_ENV === 'development'
    if (!(isDev && !originValue) && !isEvoOriginAllowed(originValue)) {
      return res.status(403).json({ error: 'origin_not_allowed', requestId })
    }

    const body = parseBody(req)
    if (body === null) {
      return res.status(400).json({ error: 'JSON inválido', requestId })
    }

    const config = getServerConfigImpl()
    if (!config?.apiKey) {
      return res.status(500).json({
        error: 'Falta ANTHROPIC_API_KEY en el servidor.',
        requestId,
      })
    }

    if (!config?.adminSecret || !adminSecretsMatch(body.secret, config.adminSecret)) {
      return res.status(401).json({ error: 'unauthorized', requestId })
    }

    if (!config.serviceKey || !config.supabaseUrl) {
      return res.status(500).json({
        error: 'generation_job_server_not_configured',
        requestId,
      })
    }

    const supabase = createClientImpl(config.supabaseUrl, config.serviceKey, {
      auth: { persistSession: false },
    })
    try {
      const exceeded = await withAiCheckTimeout(
        checkRateLimitImpl(supabase, req, {
          endpoint: '/api/programming-ai-check',
          limit: 10,
          windowMinutes: 10,
        }),
        AI_CHECK_PERSISTENCE_TIMEOUT_MS,
        'El control de frecuencia no respondió a tiempo.',
      )
      if (exceeded) {
        return res.status(429).json({
          error: 'rate_limit_exceeded',
          retry_after_seconds: 600,
          requestId,
        })
      }
      await withAiCheckTimeout(
        checkGenerationPersistenceImpl(supabase),
        AI_CHECK_PERSISTENCE_TIMEOUT_MS,
        'El almacenamiento recuperable no respondió a tiempo.',
      )
    } catch (error) {
      logger.warn?.('programming_ai_check_persistence_unavailable', {
        requestId,
        message: String(error?.message || 'unknown').slice(0, 300),
      })
      return res.status(503).json({
        error: 'generation_persistence_unavailable',
        message:
          'La IA no se ha probado porque el almacenamiento recuperable no está disponible.',
        requestId,
      })
    }

    const resolvedModel = resolveProgrammingModel(model)
    const stream = startJsonStreamImpl(res, { requestId })
    const startedAt = nowImpl()
    let providerRequestId = null

    try {
      const result = await requestStructuredImpl({
        apiKey: config.apiKey,
        model: resolvedModel,
        system:
          'Comprobación de conectividad EVO. Responde únicamente con la salida estructurada solicitada.',
        messages: checkMessages(),
        schema: EVO_DAY_OUTPUT_SCHEMA,
        maxTokens: AI_CHECK_MAX_TOKENS,
        timeoutMs: AI_CHECK_UPSTREAM_TIMEOUT_MS,
      })

      providerRequestId = result?.providerRequestId || null
      const sample = assertRepresentativeDay(result?.output, providerRequestId)
      const latencyMs = Math.max(0, Number(nowImpl()) - Number(startedAt))
      const responseModel = result?.model || resolvedModel

      logger.info?.('programming_ai_check_succeeded', {
        requestId,
        providerRequestId,
        model: responseModel,
        latencyMs,
      })

      stream.finishSuccess({
        ok: true,
        status: 'connected',
        model: responseModel,
        latencyMs,
        providerRequestId,
        structuredOutputs: true,
        sample,
      })
      return
    } catch (error) {
      providerRequestId = providerRequestId || error?.providerRequestId || null
      const latencyMs = Math.max(0, Number(nowImpl()) - Number(startedAt))
      const status = isAnthropicStructuredRequestError(error)
        ? errorStatus(error)
        : 502

      logger.warn?.('programming_ai_check_failed', {
        requestId,
        providerRequestId,
        model: resolvedModel,
        latencyMs,
        errorCode: error?.code || 'ai_check_failed',
        errorStatus: status,
      })

      stream.finishError(status, {
        error: error?.message || 'No se pudo contactar con Anthropic.',
        errorCode: error?.code || 'ai_check_failed',
        model: resolvedModel,
        latencyMs,
        providerRequestId,
        structuredOutputs: true,
        retriable: Boolean(error?.retriable),
      })
    }
  }
}

export default createProgrammingAiCheckHandler()
