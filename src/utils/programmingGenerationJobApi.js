import {
  classifyJsonApiResponse,
  extractApiErrorMessage,
} from './parseJsonApiResponse.js'
import {
  buildWeekSkeleton,
  EXCEL_DAY_ORDER,
} from './excelGenerationPlan.js'

const JOB_API_TIMEOUT_MS = 15_000
export const GENERATION_STEP_CLIENT_TIMEOUT_MS = 89_000

function createApiError(message, { status = 500, code = '', payload = null } = {}) {
  const error = new Error(message)
  error.httpStatus = Number(status) || 500
  error.code = code || payload?.error || 'generation_api_error'
  error.payload = payload
  return error
}

async function postJson(url, payload, { timeoutMs = JOB_API_TIMEOUT_MS, signal } = {}) {
  const controller = new AbortController()
  let didTimeout = false
  const abortFromParent = () => controller.abort()
  if (signal?.aborted) controller.abort()
  signal?.addEventListener?.('abort', abortFromParent, { once: true })
  const timeoutId = setTimeout(() => {
    didTimeout = true
    controller.abort()
  }, timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const rawText = await response.text()
    const classified = classifyJsonApiResponse(response, rawText)
    if (!classified.ok) {
      throw createApiError(
        classified.errorMessage ||
          extractApiErrorMessage(classified.json, `Error ${classified.httpStatus}`),
        {
          status: classified.httpStatus,
          code: classified.json?.error || classified.json?.code,
          payload: classified.json,
        },
      )
    }
    return classified.json
  } catch (error) {
    if (didTimeout) {
      throw createApiError(
        'La operación superó el tiempo máximo. El progreso ya guardado se conserva.',
        { status: 504, code: 'client_timeout' },
      )
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener?.('abort', abortFromParent)
  }
}

export function createRemoteGenerationJob(input, options) {
  return postJson(
    '/api/programming-generation-jobs',
    { action: 'create', ...input },
    options,
  )
}

export function findRemoteGenerationJob({ secret, fingerprint }, options) {
  return postJson(
    '/api/programming-generation-jobs',
    { action: 'find', secret, fingerprint },
    options,
  )
}

export function findRemoteGenerationJobByTarget({ secret, target }, options) {
  return postJson(
    '/api/programming-generation-jobs',
    { action: 'find_target', secret, target },
    options,
  )
}

export function getRemoteGenerationJob({ secret, jobId }, options) {
  return postJson(
    '/api/programming-generation-jobs',
    { action: 'get', secret, jobId },
    options,
  )
}

export function finishRemoteGenerationJob(input, options) {
  const {
    secret,
    jobId,
    expectedRevision,
    partialWeek,
  } = input || {}
  return postJson(
    '/api/programming-generation-jobs',
    {
      action: 'finalize',
      secret,
      jobId,
      expectedRevision,
      partialWeek,
    },
    options,
  )
}

export function generateRemoteDayStep(input, options = {}) {
  return postJson('/api/programming-generation-step', input, {
    ...options,
    timeoutMs: options.timeoutMs || GENERATION_STEP_CLIENT_TIMEOUT_MS,
  })
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
}

function cloneJsonValue(value) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value))
}

function hasMeaningfulScalar(value) {
  return value !== null && value !== undefined && (
    typeof value !== 'string' || value.trim() !== ''
  )
}

function deepMergePreservingFallback(fallback, incoming) {
  if (isPlainObject(fallback) && isPlainObject(incoming)) {
    const merged = cloneJsonValue(fallback)
    for (const [key, value] of Object.entries(incoming)) {
      merged[key] = deepMergePreservingFallback(fallback[key], value)
    }
    return merged
  }
  if (Array.isArray(incoming)) {
    return incoming.length ? cloneJsonValue(incoming) : cloneJsonValue(fallback || [])
  }
  if (!hasMeaningfulScalar(incoming) && hasMeaningfulScalar(fallback)) {
    return cloneJsonValue(fallback)
  }
  return cloneJsonValue(incoming)
}

function mergeWeekDays(fallbackDays, incomingDays) {
  const result = []
  const indexByName = new Map()
  const addOrMerge = (day) => {
    if (!isPlainObject(day)) return
    const dayName = String(day.nombre || '').trim().toUpperCase()
    if (!dayName) return
    const normalized = { ...day, nombre: dayName }
    const existingIndex = indexByName.get(dayName)
    if (existingIndex === undefined) {
      indexByName.set(dayName, result.length)
      result.push(cloneJsonValue(normalized))
      return
    }
    result[existingIndex] = deepMergePreservingFallback(
      result[existingIndex],
      normalized,
    )
  }
  ;(Array.isArray(fallbackDays) ? fallbackDays : []).forEach(addOrMerge)
  ;(Array.isArray(incomingDays) ? incomingDays : []).forEach(addOrMerge)
  return result
}

function mergePartialWeekValues(fallback, incoming) {
  if (!isPlainObject(fallback)) return cloneJsonValue(incoming)
  if (!isPlainObject(incoming)) return cloneJsonValue(fallback)
  const merged = deepMergePreservingFallback(fallback, incoming)
  merged.dias = mergeWeekDays(fallback.dias, incoming.dias)
  return merged
}

export function rebuildPartialWeek(snapshot, fallback) {
  const remote = snapshot?.job || {}
  let partial = mergePartialWeekValues(
    fallback?.partialWeek,
    remote.partialWeek,
  )
  if (!isPlainObject(partial)) {
    const target = remote.target || {}
    partial = buildWeekSkeleton(
      Number(target.week || target.semana || 1),
      target.mesocycle || target.mesociclo || '',
    )
  }
  if (!Array.isArray(partial?.dias)) return null

  for (const step of snapshot?.steps || []) {
    if (step?.status !== 'completed') continue
    const day = step?.result?.dia || step?.result
    const dayName = String(day?.nombre || step?.day || '').trim().toUpperCase()
    if (!dayName || !day || typeof day !== 'object') continue
    const index = partial.dias.findIndex(
      (row) => String(row?.nombre || '').trim().toUpperCase() === dayName,
    )
    if (index >= 0) {
      partial.dias[index] = deepMergePreservingFallback(
        partial.dias[index],
        { ...day, nombre: dayName },
      )
    } else if (EXCEL_DAY_ORDER.includes(dayName)) {
      partial.dias.push({ ...day, nombre: dayName })
    }
  }
  return partial
}

export function remoteSnapshotToLocalJob(snapshot, fallback = {}) {
  const remote = snapshot?.job
  if (!remote?.id) return null
  const completedFromSteps = (snapshot.steps || [])
    .filter((step) => step?.status === 'completed')
    .map((step) => String(step?.day || '').trim().toUpperCase())
    .filter(Boolean)
  const completedDays =
    Array.isArray(remote.completedDays) && remote.completedDays.length
      ? remote.completedDays
      : completedFromSteps.length
        ? completedFromSteps
        : Array.isArray(fallback.completedDays)
          ? fallback.completedDays
          : []
  const partialWeek = rebuildPartialWeek(snapshot, fallback)
  const phase =
    remote.status === 'cancelled'
      ? 'cancelled'
      : fallback.phase === 'sync_pending' || remote.status === 'sync_pending'
        ? 'sync_pending'
        : remote.status === 'ready' || remote.status === 'completed'
          ? 'complete'
          : remote.status === 'failed'
            ? 'failed'
            : 'generating'
  return {
    ...fallback,
    jobId: remote.id,
    serverJobId: remote.id,
    serverRevision: Number(remote.revision) || 0,
    fingerprint: remote.fingerprint || fallback.fingerprint || '',
    phase,
    target: deepMergePreservingFallback(fallback.target || {}, remote.target || {}),
    configuration: deepMergePreservingFallback(
      fallback.configuration || {},
      remote.configuration || {},
    ),
    completedDays,
    partialWeek,
    failedDay: remote.error?.day || remote.currentDay || null,
    error: remote.error?.message || null,
    retries: (snapshot.steps || []).reduce(
      (total, step) => total + Math.max(0, Number(step?.attemptCount || 0) - 1),
      0,
    ),
    requestIds: (snapshot.steps || [])
      .flatMap((step) => [step?.requestId, step?.providerRequestId])
      .filter(Boolean),
    idempotencyKey: remote.idempotencyKey || fallback.idempotencyKey || remote.id,
    updatedAt: remote.updatedAt || new Date().toISOString(),
  }
}
