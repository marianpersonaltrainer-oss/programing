import { buildGenerationRequestFingerprint } from './generationRequestFingerprint.js'

const STORAGE_PREFIX = 'programingevo_gen_job_v1:'

export function buildGenerationJobStorageKey(input) {
  const fingerprint = buildGenerationRequestFingerprint(input)
  return `${STORAGE_PREFIX}${fingerprint}`
}

/**
 * @typedef {object} ExcelGenerationJob
 * @property {string} jobId
 * @property {string|null} serverJobId
 * @property {number} serverRevision
 * @property {string} fingerprint
 * @property {'prep'|'generating'|'validating'|'complete'|'failed'|'interrupted'|'sync_pending'|'cancelled'} phase
 * @property {string[]} completedDays
 * @property {string|null} failedDay
 * @property {string|null} error
 * @property {number} retries
 * @property {object|null} partialWeek
 * @property {string} updatedAt
 * @property {string[]} requestIds
 * @property {string|null} idempotencyKey
 */

/** @returns {ExcelGenerationJob|null} */
export function loadGenerationJob(storageKey) {
  if (!storageKey || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !parsed.jobId) return null
    return parsed
  } catch {
    return null
  }
}

/** @param {string} storageKey @param {ExcelGenerationJob} job */
export function saveGenerationJob(storageKey, job) {
  if (!storageKey || typeof localStorage === 'undefined') return false
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...job,
        updatedAt: new Date().toISOString(),
      }),
    )
    return true
  } catch {
    return false
  }
}

export function clearGenerationJob(storageKey) {
  if (!storageKey || typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(storageKey)
  } catch {
    /* quota */
  }
}

export function createGenerationJob({ fingerprint, idempotencyKey = null }) {
  const jobId = `gen_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  return {
    jobId,
    serverJobId: null,
    serverRevision: 0,
    fingerprint,
    phase: 'prep',
    completedDays: [],
    failedDay: null,
    error: null,
    retries: 0,
    partialWeek: null,
    updatedAt: new Date().toISOString(),
    requestIds: [],
    idempotencyKey: idempotencyKey || jobId,
  }
}

export function jobHasResumableProgress(job) {
  if (!job) return false
  if (job.phase === 'complete' || job.phase === 'cancelled') return false
  if (
    job.serverJobId &&
    ['prep', 'generating', 'failed', 'interrupted', 'sync_pending'].includes(job.phase)
  ) {
    return true
  }
  return Array.isArray(job.completedDays) && job.completedDays.length > 0 && !!job.partialWeek
}

export function appendJobRequestId(job, requestId) {
  if (!job || !requestId) return job
  const requestIds = Array.isArray(job.requestIds) ? [...job.requestIds] : []
  if (!requestIds.includes(requestId)) requestIds.push(requestId)
  return { ...job, requestIds }
}
