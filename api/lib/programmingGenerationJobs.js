const VALID_DAYS = new Set([
  'LUNES',
  'MARTES',
  'MIÉRCOLES',
  'JUEVES',
  'VIERNES',
  'SÁBADO',
])

function cleanText(value, max = 500) {
  return String(value || '').trim().slice(0, max)
}

export function normalizeGenerationDays(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((day) => cleanText(day, 20).toUpperCase())
    .filter((day, index, all) => VALID_DAYS.has(day) && all.indexOf(day) === index)
}

export function sanitizeGenerationJob(row) {
  if (!row || typeof row !== 'object') return null
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    fingerprint: row.fingerprint,
    status: row.status,
    target: row.target || {},
    configuration: row.configuration || {},
    currentDay: row.current_day || null,
    completedDays: normalizeGenerationDays(row.completed_days),
    partialWeek: row.partial_week || null,
    error: row.error || null,
    revision: Number(row.revision) || 0,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    completedAt: row.completed_at || null,
  }
}

export function sanitizeGenerationStep(row) {
  if (!row || typeof row !== 'object') return null
  return {
    jobId: row.job_id,
    day: cleanText(row.day_key, 20).toUpperCase(),
    status: row.status,
    attemptCount: Number(row.attempt_count) || 0,
    model: row.model || null,
    requestId: row.request_id || null,
    providerRequestId: row.provider_request_id || null,
    durationMs: Number(row.duration_ms) || null,
    result: row.result || null,
    error: row.error || null,
    startedAt: row.started_at || null,
    completedAt: row.completed_at || null,
    updatedAt: row.updated_at || null,
  }
}

async function selectJobById(supabase, jobId) {
  const { data, error } = await supabase
    .from('programming_generation_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle()
  if (error) throw error
  return data || null
}

async function selectStepsForJob(supabase, jobId) {
  const { data, error } = await supabase
    .from('programming_generation_steps')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map(sanitizeGenerationStep)
}

export async function getGenerationJobSnapshot(supabase, jobId) {
  const row = await selectJobById(supabase, jobId)
  if (!row) return null
  const steps = await selectStepsForJob(supabase, jobId)
  return { job: sanitizeGenerationJob(row), steps }
}

export async function createOrGetGenerationJob(
  supabase,
  {
    idempotencyKey,
    fingerprint,
    target,
    configuration,
    generationDays,
  },
) {
  const cleanIdempotencyKey = cleanText(idempotencyKey, 220)
  const cleanFingerprint = cleanText(fingerprint, 24_000)
  const days = normalizeGenerationDays(generationDays)
  if (!cleanIdempotencyKey || !cleanFingerprint || !days.length) {
    const error = new Error('invalid_generation_job_input')
    error.code = 'invalid_generation_job_input'
    throw error
  }

  const insert = {
    idempotency_key: cleanIdempotencyKey,
    fingerprint: cleanFingerprint,
    status: 'queued',
    target: target && typeof target === 'object' ? target : {},
    configuration: {
      ...(configuration && typeof configuration === 'object' ? configuration : {}),
      generationDays: days,
    },
    current_day: days[0],
    completed_days: [],
  }

  let row = null
  const created = await supabase
    .from('programming_generation_jobs')
    .insert(insert)
    .select('*')
    .single()
  if (!created.error) {
    row = created.data
  } else if (created.error.code === '23505') {
    const existing = await supabase
      .from('programming_generation_jobs')
      .select('*')
      .eq('idempotency_key', cleanIdempotencyKey)
      .maybeSingle()
    if (existing.error) throw existing.error
    row = existing.data
  } else {
    throw created.error
  }

  if (!row || row.fingerprint !== cleanFingerprint) {
    const error = new Error('idempotency_key_conflict')
    error.code = 'idempotency_key_conflict'
    throw error
  }
  return getGenerationJobSnapshot(supabase, row.id)
}

export async function findGenerationJobByFingerprint(supabase, fingerprint) {
  const cleanFingerprint = cleanText(fingerprint, 24_000)
  if (!cleanFingerprint) return null
  const { data, error } = await supabase
    .from('programming_generation_jobs')
    .select('*')
    .eq('fingerprint', cleanFingerprint)
    .in('status', ['queued', 'preparing', 'generating', 'failed', 'ready'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return getGenerationJobSnapshot(supabase, data.id)
}

function normalizeStableGenerationTarget(target) {
  const source = target && typeof target === 'object' ? target : {}
  const mesocycle = cleanText(source.mesocycle || source.mesociclo, 100)
  const week = Number(source.week || source.semana)
  const cycleId = cleanText(source.cycleId || source.cycle_id, 220)
  const weekStartDate = cleanText(
    source.weekStartDate || source.week_start_date,
    40,
  )

  if (
    !mesocycle ||
    !Number.isInteger(week) ||
    week < 1 ||
    (!cycleId && !weekStartDate)
  ) {
    const error = new Error('invalid_generation_job_target')
    error.code = 'invalid_generation_job_target'
    throw error
  }

  return {
    mesocycle,
    week,
    ...(cycleId ? { cycleId } : {}),
    ...(weekStartDate ? { weekStartDate } : {}),
  }
}

export async function findGenerationJobByTarget(supabase, target) {
  const stableTarget = normalizeStableGenerationTarget(target)
  const { data, error } = await supabase
    .from('programming_generation_jobs')
    .select('*')
    .contains('target', stableTarget)
    .in('status', ['queued', 'preparing', 'generating', 'failed', 'ready'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return getGenerationJobSnapshot(supabase, data.id)
}

function normalizeGenerationRpcError(error) {
  const source = [
    error?.message,
    error?.details,
    error?.hint,
  ]
    .filter(Boolean)
    .join(' ')
  const knownCode = source.match(/\bgeneration_[a-z0-9_]+\b/i)?.[0]
  if (knownCode) {
    error.code = knownCode.toLowerCase()
    error.message = error.code
  }
  return error
}

export async function finalizeGenerationJob(
  supabase,
  {
    jobId,
    expectedRevision,
    partialWeek,
  },
) {
  const cleanJobId = cleanText(jobId, 100)
  const revision = Number(expectedRevision)
  if (
    !cleanJobId ||
    !Number.isInteger(revision) ||
    revision < 0 ||
    !partialWeek ||
    typeof partialWeek !== 'object' ||
    Array.isArray(partialWeek)
  ) {
    const inputError = new Error('invalid_generation_job_finalize_input')
    inputError.code = 'invalid_generation_job_finalize_input'
    throw inputError
  }

  const { data, error } = await supabase.rpc(
    'finalize_programming_generation_job',
    {
      p_job_id: cleanJobId,
      p_expected_revision: revision,
      p_partial_week: partialWeek,
    },
  )
  if (error) throw normalizeGenerationRpcError(error)
  if (!data?.job?.id) {
    const responseError = new Error('generation_job_finalize_response_invalid')
    responseError.code = 'generation_job_finalize_response_invalid'
    throw responseError
  }

  const snapshot = await getGenerationJobSnapshot(supabase, data.job.id)
  if (!snapshot) return null
  return {
    ...snapshot,
    finalization: {
      finalized: data.finalized !== false,
      idempotent: data.idempotent === true,
    },
  }
}
