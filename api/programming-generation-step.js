import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { EVO_SESSION_CLASS_DEFS } from '../src/constants/evoClasses.js'
import { EVO_DAY_OUTPUT_SCHEMA } from '../src/constants/evoDayOutputSchema.js'
import { DEFAULT_PROGRAMMING_MODEL } from '../src/constants/anthropicModels.js'
import {
  requestAnthropicStructuredOutput,
} from './lib/anthropicStructuredRequest.js'
import {
  getGenerationJobSnapshot,
  sanitizeGenerationJob,
  sanitizeGenerationStep,
} from './lib/programmingGenerationJobs.js'
import { getRequestOrigin, isEvoOriginAllowed } from './lib/evoAllowedOrigins.js'
import {
  adminSecretsMatch,
  checkAdminRateLimit,
} from './lib/evoAdminAuth.js'
import { startJsonStream } from './lib/jsonStreamResponse.js'

const STEP_TOTAL_BUDGET_MS = 86_000
const RATE_LIMIT_TIMEOUT_MS = 3_500
const RPC_TIMEOUT_MS = 5_000
const PERSISTENCE_RESERVE_MS = 12_000
const GENERATION_TIMEOUT_MS = 62_000
const GENERATION_MAX_TOKENS = 4_200
const GENERATION_LEASE_SECONDS = 90
const MAX_SYSTEM_PROMPT_CHARS = 80_000
const MAX_USER_PROMPT_CHARS = 40_000
const MAX_COMBINED_PROMPT_CHARS = 100_000
const NOT_PROGRAMMED = '(no programada esta semana)'
const VALID_DAYS = new Map([
  ['LUNES', 'LUNES'],
  ['MARTES', 'MARTES'],
  ['MIERCOLES', 'MIÉRCOLES'],
  ['MIÉRCOLES', 'MIÉRCOLES'],
  ['JUEVES', 'JUEVES'],
  ['VIERNES', 'VIERNES'],
  ['SABADO', 'SÁBADO'],
  ['SÁBADO', 'SÁBADO'],
])
const CLASS_BY_KEY = new Map(EVO_SESSION_CLASS_DEFS.map((entry) => [entry.key, entry]))
const DAY_FIELD_NAMES = [
  'nombre',
  ...EVO_SESSION_CLASS_DEFS.flatMap(({ key, feedbackKey }) => [key, feedbackKey]),
  'wodbuster',
]

class ProgrammingGenerationStepError extends Error {
  constructor(
    message,
    {
      code = 'generation_step_error',
      status = 500,
      retriable = false,
      providerRequestId = null,
      cause,
      details,
    } = {},
  ) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'ProgrammingGenerationStepError'
    this.code = code
    this.status = Number(status) || 500
    this.retriable = Boolean(retriable)
    this.providerRequestId = providerRequestId || null
    if (details !== undefined) this.details = details
  }
}

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
    supabaseUrl: String(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    ).trim(),
    serviceKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    adminSecret: String(process.env.COACH_GUIDE_ADMIN_SECRET || '').trim(),
    anthropicApiKey: String(
      process.env.ANTHROPIC_API_KEY || '',
    ).trim(),
  }
}

function newRequestId() {
  return `genstep_${randomUUID().replaceAll('-', '')}`
}

function cleanText(value, max) {
  return String(value || '').trim().slice(0, max)
}

function normalizeDayKey(value) {
  const raw = String(value || '')
    .trim()
    .toUpperCase()
  const slug = raw.normalize('NFD').replace(/\p{M}/gu, '')
  return VALID_DAYS.get(raw) || VALID_DAYS.get(slug) || ''
}

function normalizeSelectedClasses(value) {
  if (!Array.isArray(value)) return []
  const normalized = value
    .map((key) => cleanText(key, 50).toLowerCase())
    .filter((key, index, all) => CLASS_BY_KEY.has(key) && all.indexOf(key) === index)
  return normalized.length === value.length ? normalized : []
}

function exactObjectKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index])
}

function isMeaningfulSession(value) {
  const text = String(value || '').trim()
  if (text.length < 12) return false
  return !/^(?:[-—]|n\/?a|pendiente|sin programar|\(?no programad[ao].*\)?)$/i.test(text)
}

export function validateAndNormalizeGeneratedDay(output, {
  expectedDay,
  selectedClasses,
}) {
  if (!exactObjectKeys(output, ['dia'])) {
    throw new ProgrammingGenerationStepError(
      'Structured Outputs debe contener únicamente el objeto "dia".',
      { code: 'invalid_generation_day_output', status: 422 },
    )
  }
  const day = output.dia
  if (!exactObjectKeys(day, DAY_FIELD_NAMES)) {
    throw new ProgrammingGenerationStepError(
      'El día generado no contiene exactamente todos los campos EVO.',
      { code: 'invalid_generation_day_output', status: 422 },
    )
  }
  for (const field of DAY_FIELD_NAMES) {
    if (typeof day[field] !== 'string') {
      throw new ProgrammingGenerationStepError(
        `El campo "${field}" del día generado debe ser texto.`,
        { code: 'invalid_generation_day_output', status: 422 },
      )
    }
  }

  const actualDay = normalizeDayKey(day.nombre)
  if (!actualDay || actualDay !== expectedDay) {
    throw new ProgrammingGenerationStepError(
      `La IA devolvió ${actualDay || 'un día inválido'}; se esperaba ${expectedDay}.`,
      {
        code: 'generation_day_mismatch',
        status: 422,
        details: { expectedDay, actualDay: actualDay || null },
      },
    )
  }

  const selected = new Set(selectedClasses)
  const normalizedDay = { nombre: expectedDay }
  for (const { key, feedbackKey } of EVO_SESSION_CLASS_DEFS) {
    if (selected.has(key)) {
      if (!isMeaningfulSession(day[key])) {
        throw new ProgrammingGenerationStepError(
          `La clase seleccionada "${key}" no contiene una programación real.`,
          {
            code: 'selected_class_content_missing',
            status: 422,
            details: { classKey: key },
          },
        )
      }
      normalizedDay[key] = day[key].trim()
      normalizedDay[feedbackKey] = day[feedbackKey].trim()
    } else {
      normalizedDay[key] = NOT_PROGRAMMED
      normalizedDay[feedbackKey] = ''
    }
  }
  normalizedDay.wodbuster = day.wodbuster.trim()
  return { dia: normalizedDay }
}

export function mergeGeneratedDayIntoPartialWeek(partialWeek, generatedOutput) {
  if (!partialWeek || typeof partialWeek !== 'object' || Array.isArray(partialWeek)) {
    throw new ProgrammingGenerationStepError(
      'partialWeek debe contener el acumulador semanal anterior.',
      { code: 'invalid_partial_week', status: 400 },
    )
  }
  if (!Array.isArray(partialWeek.dias)) {
    throw new ProgrammingGenerationStepError(
      'partialWeek.dias debe ser un array.',
      { code: 'invalid_partial_week', status: 400 },
    )
  }

  const generatedDay = generatedOutput.dia
  const expectedDay = normalizeDayKey(generatedDay.nombre)
  let replaced = false
  const dias = []
  for (const existingDay of partialWeek.dias) {
    if (normalizeDayKey(existingDay?.nombre) !== expectedDay) {
      dias.push(existingDay)
      continue
    }
    if (!replaced) {
      dias.push({
        ...existingDay,
        ...generatedDay,
        nombre: expectedDay,
      })
      replaced = true
    }
  }
  if (!replaced) dias.push(generatedDay)
  return { ...partialWeek, dias }
}

function classesForClaimedDay(rawJob, day) {
  const dayOffer = rawJob?.configuration?.weeklyOffer?.dias?.[day]
  const values = Array.isArray(dayOffer)
    ? dayOffer
    : dayOffer && typeof dayOffer === 'object'
      ? Object.entries(dayOffer)
          .filter(([, enabled]) => Boolean(enabled))
          .map(([key]) => key)
      : []
  return normalizeSelectedClasses(values)
}

function sameClassSelection(left, right) {
  if (left.length !== right.length) return false
  const expected = new Set(left)
  return right.every((key) => expected.has(key))
}

function buildAuthoritativePartialWeek(rawJob) {
  const persisted = rawJob?.partial_week || rawJob?.partialWeek
  if (
    persisted &&
    typeof persisted === 'object' &&
    !Array.isArray(persisted) &&
    Array.isArray(persisted.dias)
  ) {
    return persisted
  }

  const target =
    rawJob?.target && typeof rawJob.target === 'object' && !Array.isArray(rawJob.target)
      ? rawJob.target
      : {}
  const configuration =
    rawJob?.configuration &&
    typeof rawJob.configuration === 'object' &&
    !Array.isArray(rawJob.configuration)
      ? rawJob.configuration
      : {}
  const weekNumber = Number(target.week)

  return {
    titulo: cleanText(configuration.proposalTitle, 300),
    ...(Number.isFinite(weekNumber) ? { semana: weekNumber } : {}),
    ...(cleanText(target.mesocycle, 120)
      ? { mesociclo: cleanText(target.mesocycle, 120) }
      : {}),
    ...(cleanText(target.phase, 120)
      ? { fase: cleanText(target.phase, 120) }
      : {}),
    ...(cleanText(target.weekStartDate, 40)
      ? { fechaInicio: cleanText(target.weekStartDate, 40) }
      : {}),
    ...(configuration.weeklyOffer &&
    typeof configuration.weeklyOffer === 'object' &&
    !Array.isArray(configuration.weeklyOffer)
      ? { oferta_semanal: configuration.weeklyOffer }
      : {}),
    dias: [],
  }
}

function canonicalRpcSnapshot(payload) {
  const rawJob = payload?.job || payload?.snapshot?.job || null
  const rawStep = payload?.step || payload?.snapshot?.step || null
  const job = sanitizeGenerationJob(rawJob)
  const step = sanitizeGenerationStep(rawStep)
  if (!job) {
    throw new ProgrammingGenerationStepError(
      'La RPC no devolvió el job persistido.',
      {
        code: 'generation_step_snapshot_contract_invalid',
        status: 503,
        retriable: true,
      },
    )
  }
  return {
    job,
    steps: step ? [step] : [],
  }
}

async function resolveClaimSnapshot(supabase, claim, jobId, timeoutMs) {
  if (claim?.job || claim?.snapshot?.job) {
    return canonicalRpcSnapshot(claim)
  }
  const snapshot = await withTimeout(
    getGenerationJobSnapshot(supabase, jobId),
    timeoutMs,
    {
      code: 'generation_step_snapshot_lookup_timeout',
      message: 'No se pudo recuperar a tiempo el estado autoritativo del job.',
    },
  )
  if (!snapshot?.job) {
    throw new ProgrammingGenerationStepError(
      'No se encontró el job reclamado.',
      {
        code: 'generation_step_snapshot_not_found',
        status: 404,
      },
    )
  }
  return snapshot
}

function buildUserMessage(userPrompt, day, selectedClasses) {
  return [
    `DÍA OBJETIVO ÚNICO: ${day}.`,
    `CLASES QUE DEBEN CONTENER PROGRAMACIÓN REAL: ${selectedClasses.join(', ')}.`,
    `Para cualquier clase no seleccionada devuelve exactamente "${NOT_PROGRAMMED}" y feedback vacío.`,
    'No redactes ningún otro día.',
    '',
    userPrompt,
  ].join('\n')
}

function errorStatus(error) {
  const status = Number(error?.status || error?.httpStatus)
  if (Number.isInteger(status) && status >= 400 && status <= 599) return status
  return 500
}

function errorCode(error) {
  return cleanText(error?.code || error?.message || 'generation_step_error', 160)
}

function normalizeErrorForPersistence(error, {
  requestId,
  providerRequestId,
}) {
  return {
    code: errorCode(error),
    type: cleanText(error?.name || 'Error', 120),
    message: cleanText(error?.message || 'Error de generación.', 1_000),
    httpStatus: errorStatus(error),
    requestId,
    providerRequestId: providerRequestId || error?.providerRequestId || null,
    retriable: Boolean(error?.retriable),
  }
}

function timeoutError(message, {
  code,
  status = 504,
} = {}) {
  return new ProgrammingGenerationStepError(message, {
    code,
    status,
    retriable: true,
  })
}

async function withTimeout(promise, timeoutMs, {
  code,
  message,
  status = 504,
} = {}) {
  const waitMs = Math.max(1, Math.floor(Number(timeoutMs) || 0))
  let timeoutId
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(timeoutError(message || 'La operación superó su tiempo máximo.', {
            code: code || 'generation_step_operation_timeout',
            status,
          }))
        }, waitMs)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

async function callRpc(supabase, name, params, {
  code = `${name}_failed`,
  requireData = true,
  timeoutMs = RPC_TIMEOUT_MS,
} = {}) {
  const response = await withTimeout(
    supabase.rpc(name, params),
    timeoutMs,
    {
      code: `${code}_timeout`,
      message: `${name} no respondió a tiempo.`,
    },
  )
  if (response?.error || (requireData && response?.data == null)) {
    throw new ProgrammingGenerationStepError(
      response?.error?.message || `${name} no devolvió estado persistido.`,
      {
        code,
        status: 503,
        retriable: true,
        cause: response?.error,
      },
    )
  }
  return response?.data
}

function sendJson(res, status, payload, {
  requestId,
  providerRequestId = null,
  startedAt,
  now,
  stream = null,
}) {
  const numericStatus = Number(status) || 500
  const durationMs = Math.max(0, Number(now()) - Number(startedAt))
  const contract = {
    ...payload,
    status: numericStatus,
    providerRequestId: providerRequestId || null,
    durationMs,
  }
  if (stream) {
    return numericStatus >= 400
      ? stream.finishError(numericStatus, contract)
      : stream.finishSuccess(contract)
  }
  return res.status(numericStatus).json({
    ...contract,
    ok: numericStatus < 400,
    ...(numericStatus >= 400 ? { errorStatus: numericStatus } : {}),
    requestId,
  })
}

export function createProgrammingGenerationStepHandler({
  createClientImpl = createClient,
  checkRateLimitImpl = checkAdminRateLimit,
  requestStructuredImpl = requestAnthropicStructuredOutput,
  getServerConfigImpl = getServerConfig,
  newRequestIdImpl = newRequestId,
  nowImpl = Date.now,
  model = DEFAULT_PROGRAMMING_MODEL,
  startJsonStreamImpl = startJsonStream,
} = {}) {
  return async function programmingGenerationStepHandler(req, res) {
    const startedAt = nowImpl()
    let requestId = newRequestIdImpl()
    let providerRequestId = null
    let leaseToken = null
    let jobId = ''
    let day = ''
    let supabase = null
    let responseStream = null
    let persistedFailureSnapshot = null

    const remainingBudgetMs = () =>
      Math.max(0, STEP_TOTAL_BUDGET_MS - Math.max(0, nowImpl() - startedAt))

    const respond = (status, payload) =>
      sendJson(res, status, payload, {
        requestId,
        providerRequestId,
        startedAt,
        now: nowImpl,
        stream: responseStream,
      })

    if (req.method !== 'POST') {
      return respond(405, { error: 'method_not_allowed' })
    }

    const originValue = getRequestOrigin(req)
    const isDev = process.env.NODE_ENV === 'development'
    if (!(isDev && !originValue) && !isEvoOriginAllowed(originValue)) {
      return respond(403, { error: 'origin_not_allowed' })
    }

    const body = parseBody(req)
    if (body === null) return respond(400, { error: 'invalid_json' })
    requestId = cleanText(body.requestId, 200) || requestId

    const config = getServerConfigImpl()
    if (
      !config?.supabaseUrl ||
      !config?.serviceKey ||
      !config?.adminSecret ||
      !config?.anthropicApiKey
    ) {
      return respond(500, { error: 'generation_step_server_not_configured' })
    }
    if (!adminSecretsMatch(body.secret, config.adminSecret)) {
      return respond(401, { error: 'unauthorized' })
    }

    jobId = cleanText(body.jobId, 100)
    day = normalizeDayKey(body.dayKey || body.day)
    const selectedClasses = normalizeSelectedClasses(body.selectedClasses)
    const systemPrompt = String(body.systemPrompt || body.system || '').trim()
    const userPrompt = String(body.userPrompt || body.prompt || '').trim()
    if (!jobId || !day || !selectedClasses.length || !systemPrompt || !userPrompt) {
      return respond(400, { error: 'invalid_generation_step_input' })
    }
    if (
      systemPrompt.length > MAX_SYSTEM_PROMPT_CHARS ||
      userPrompt.length > MAX_USER_PROMPT_CHARS ||
      systemPrompt.length + userPrompt.length > MAX_COMBINED_PROMPT_CHARS
    ) {
      return respond(413, { error: 'generation_step_prompt_too_large' })
    }

    supabase = createClientImpl(config.supabaseUrl, config.serviceKey, {
      auth: { persistSession: false },
    })
    try {
      const exceeded = await withTimeout(
        checkRateLimitImpl(supabase, req, {
          endpoint: '/api/programming-generation-step',
          limit: 30,
          windowMinutes: 10,
        }),
        Math.min(RATE_LIMIT_TIMEOUT_MS, remainingBudgetMs()),
        {
          code: 'rate_limit_timeout',
          message: 'El control de frecuencia no respondió a tiempo.',
          status: 503,
        },
      )
      if (exceeded) {
        return respond(429, {
          error: 'rate_limit_exceeded',
          retry_after_seconds: 600,
        })
      }
    } catch (error) {
      return respond(503, {
        error: 'rate_limit_unavailable',
        message: cleanText(error?.message, 500),
      })
    }

    try {
      const claim = await callRpc(
        supabase,
        'claim_programming_generation_step',
        {
          p_job_id: jobId,
          p_day_key: day,
          p_request_id: requestId,
          p_lease_seconds: GENERATION_LEASE_SECONDS,
        },
        {
          code: 'generation_step_claim_failed',
          timeoutMs: Math.min(RPC_TIMEOUT_MS, remainingBudgetMs()),
        },
      )
      const claimSnapshot = await resolveClaimSnapshot(
        supabase,
        claim,
        jobId,
        Math.min(RPC_TIMEOUT_MS, remainingBudgetMs()),
      )
      const rawClaimJob =
        claim?.job ||
        claim?.snapshot?.job ||
        claimSnapshot.job

      const alreadyComplete =
        claim?.alreadyComplete === true ||
        claim?.already_complete === true ||
        claim?.reason === 'day_already_completed'
      if (alreadyComplete) {
        providerRequestId =
          claim?.providerRequestId ||
          claim?.provider_request_id ||
          claim?.step?.providerRequestId ||
          claim?.step?.provider_request_id ||
          null
        const savedResult =
          claimSnapshot.steps[0]?.result ||
          claim?.result ||
          claim?.step?.result ||
          null
        return respond(200, {
          alreadyComplete: true,
          jobId,
          day,
          result: savedResult,
          partialWeek: claimSnapshot.job.partialWeek,
          snapshot: claimSnapshot,
        })
      }
      const acquired = claim?.acquired === true || claim?.claimed === true
      if (!acquired) {
        return respond(409, {
          error: cleanText(claim?.reason, 160) || 'generation_step_not_claimed',
          jobId,
          day,
          snapshot: claimSnapshot,
        })
      }
      if (claim?.reused === true) {
        return respond(409, {
          error: 'generation_step_already_running',
          jobId,
          day,
          snapshot: claimSnapshot,
        })
      }

      leaseToken = claim?.leaseToken || claim?.lease_token || ''
      if (!leaseToken) {
        throw new ProgrammingGenerationStepError(
          'El claim no devolvió leaseToken.',
          {
            code: 'generation_step_claim_contract_invalid',
            status: 500,
          },
        )
      }
      const configuredClasses = classesForClaimedDay(rawClaimJob, day)
      if (
        !configuredClasses.length ||
        !sameClassSelection(configuredClasses, selectedClasses)
      ) {
        throw new ProgrammingGenerationStepError(
          'Las clases solicitadas no coinciden con la oferta semanal guardada en el job.',
          {
            code: 'generation_step_offer_mismatch',
            status: 409,
            details: {
              configuredClasses,
              requestedClasses: selectedClasses,
            },
          },
        )
      }

      // El stream empieza solo después de preflight + claim, justo antes de la
      // única operación que puede permanecer en silencio durante decenas de segundos.
      responseStream = startJsonStreamImpl(res, { requestId })
      const upstreamBudgetMs = Math.min(
        GENERATION_TIMEOUT_MS,
        remainingBudgetMs() - PERSISTENCE_RESERVE_MS,
      )
      if (upstreamBudgetMs < 1_000) {
        throw timeoutError(
          'No queda presupuesto seguro para iniciar la generación.',
          {
            code: 'generation_step_budget_exhausted',
          },
        )
      }
      const ai = await withTimeout(
        requestStructuredImpl({
          apiKey: config.anthropicApiKey,
          model,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: buildUserMessage(userPrompt, day, configuredClasses),
            },
          ],
          schema: EVO_DAY_OUTPUT_SCHEMA,
          maxTokens: GENERATION_MAX_TOKENS,
          timeoutMs: upstreamBudgetMs,
        }),
        upstreamBudgetMs,
        {
          code: 'generation_step_upstream_timeout',
          message: 'Anthropic no respondió dentro del presupuesto del día.',
        },
      )
      providerRequestId = ai?.providerRequestId || null

      const result = validateAndNormalizeGeneratedDay(ai?.output, {
        expectedDay: day,
        selectedClasses: configuredClasses,
      })
      const partialWeek = mergeGeneratedDayIntoPartialWeek(
        buildAuthoritativePartialWeek(rawClaimJob),
        result,
      )
      const durationMs = Math.max(0, nowImpl() - startedAt)
      const inputTokens = Math.max(0, Number(ai?.usage?.input_tokens) || 0)
      const outputTokens = Math.max(0, Number(ai?.usage?.output_tokens) || 0)

      let completion
      try {
        completion = await callRpc(
          supabase,
          'complete_programming_generation_step',
          {
            p_job_id: jobId,
            p_day_key: day,
            p_lease_token: leaseToken,
            p_result: result,
            p_partial_week: partialWeek,
            p_model: model,
            p_request_id: requestId,
            p_provider_request_id: providerRequestId,
            p_duration_ms: durationMs,
            p_input_tokens: inputTokens,
            p_output_tokens: outputTokens,
          },
          {
            code: 'generation_step_complete_persistence_failed',
            timeoutMs: Math.min(RPC_TIMEOUT_MS, remainingBudgetMs()),
          },
        )
      } catch (error) {
        throw error
      }

      // El RPC complete ya guardó resultado + acumulador de forma atómica.
      const completionSnapshot = canonicalRpcSnapshot(completion)
      return respond(200, {
        alreadyComplete: false,
        jobId,
        day,
        result,
        partialWeek: completionSnapshot.job.partialWeek,
        snapshot: completionSnapshot,
      })
    } catch (error) {
      providerRequestId =
        providerRequestId || error?.providerRequestId || null
      let effectiveError = error

      if (leaseToken && supabase) {
        const persistedError = normalizeErrorForPersistence(error, {
          requestId,
          providerRequestId,
        })
        try {
          const failure = await callRpc(
            supabase,
            'fail_programming_generation_step',
            {
              p_job_id: jobId,
              p_day_key: day,
              p_lease_token: leaseToken,
              p_error: persistedError,
              p_model: model,
              p_request_id: requestId,
              p_provider_request_id: providerRequestId,
              p_duration_ms: Math.max(0, nowImpl() - startedAt),
            },
            {
              code: 'generation_step_failure_persistence_failed',
              timeoutMs: Math.min(RPC_TIMEOUT_MS, remainingBudgetMs()),
            },
          )
          persistedFailureSnapshot = canonicalRpcSnapshot(failure)
          if (
            failure?.alreadyComplete === true ||
            persistedFailureSnapshot.steps[0]?.status === 'completed'
          ) {
            const savedResult = persistedFailureSnapshot.steps[0]?.result || null
            return respond(200, {
              alreadyComplete: true,
              jobId,
              day,
              result: savedResult,
              partialWeek: persistedFailureSnapshot.job.partialWeek,
              snapshot: persistedFailureSnapshot,
            })
          }
        } catch (persistenceError) {
          effectiveError = new ProgrammingGenerationStepError(
            'Falló la generación y tampoco se pudo persistir su estado.',
            {
              code: 'generation_step_failure_persistence_failed',
              status: 503,
              retriable: true,
              providerRequestId,
              cause: persistenceError,
              details: { originalError: persistedError },
            },
          )
        }
      }

      const status = errorStatus(effectiveError)
      return respond(status, {
        error: errorCode(effectiveError),
        message: cleanText(effectiveError?.message, 1_000),
        retriable: Boolean(effectiveError?.retriable),
        jobId: jobId || null,
        day: day || null,
        snapshot: persistedFailureSnapshot,
      })
    }
  }
}

export default createProgrammingGenerationStepHandler()

export {
  GENERATION_MAX_TOKENS,
  GENERATION_TIMEOUT_MS,
  MAX_COMBINED_PROMPT_CHARS,
  MAX_SYSTEM_PROMPT_CHARS,
  MAX_USER_PROMPT_CHARS,
  NOT_PROGRAMMED,
  RATE_LIMIT_TIMEOUT_MS,
  RPC_TIMEOUT_MS,
  STEP_TOTAL_BUDGET_MS,
  ProgrammingGenerationStepError,
}
