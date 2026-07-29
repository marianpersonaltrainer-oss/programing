import { createClient } from '@supabase/supabase-js'
import { getRequestOrigin, isEvoOriginAllowed } from './lib/evoAllowedOrigins.js'
import {
  adminSecretsMatch,
  checkAdminRateLimit,
} from './lib/evoAdminAuth.js'
import {
  createOrGetGenerationJob,
  finalizeGenerationJob,
  findGenerationJobByFingerprint,
  findGenerationJobByTarget,
  getGenerationJobSnapshot,
} from './lib/programmingGenerationJobs.js'

const GENERATION_JOB_CONFLICT_CODES = new Set([
  'generation_job_revision_conflict',
  'generation_job_active_lease',
  'generation_job_incomplete',
  'generation_job_not_finalizable',
  'generation_job_ready_conflict',
  'idempotency_key_conflict',
])

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
  const supabaseUrl = String(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  ).trim()
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const adminSecret = String(process.env.COACH_GUIDE_ADMIN_SECRET || '').trim()
  return { supabaseUrl, serviceKey, adminSecret }
}

export function createProgrammingGenerationJobsHandler({
  createClientImpl = createClient,
  checkRateLimitImpl = checkAdminRateLimit,
  createOrGetGenerationJobImpl = createOrGetGenerationJob,
  finalizeGenerationJobImpl = finalizeGenerationJob,
  findGenerationJobByFingerprintImpl = findGenerationJobByFingerprint,
  findGenerationJobByTargetImpl = findGenerationJobByTarget,
  getGenerationJobSnapshotImpl = getGenerationJobSnapshot,
} = {}) {
  return async function programmingGenerationJobsHandler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const originValue = getRequestOrigin(req)
    const isDev = process.env.NODE_ENV === 'development'
    if (!(isDev && !originValue) && !isEvoOriginAllowed(originValue)) {
      return res.status(403).json({ error: 'origin_not_allowed' })
    }

    const body = parseBody(req)
    if (body === null) return res.status(400).json({ error: 'invalid_json' })

    const config = getServerConfig()
    if (!config.supabaseUrl || !config.serviceKey || !config.adminSecret) {
      return res.status(500).json({ error: 'generation_job_server_not_configured' })
    }
    if (!adminSecretsMatch(body.secret, config.adminSecret)) {
      return res.status(401).json({ error: 'unauthorized' })
    }

    const supabase = createClientImpl(config.supabaseUrl, config.serviceKey, {
      auth: { persistSession: false },
    })
    try {
      const exceeded = await checkRateLimitImpl(supabase, req, {
        endpoint: '/api/programming-generation-jobs',
        limit: 120,
        windowMinutes: 10,
      })
      if (exceeded) {
        return res.status(429).json({
          error: 'rate_limit_exceeded',
          retry_after_seconds: 600,
        })
      }
    } catch (error) {
      return res.status(503).json({
        error: 'rate_limit_unavailable',
        message: error?.message || 'No se pudo comprobar el límite.',
      })
    }

    const action = String(body.action || '').trim().toLowerCase()
    try {
      let snapshot
      if (action === 'create') {
        snapshot = await createOrGetGenerationJobImpl(supabase, {
          idempotencyKey: body.idempotencyKey,
          fingerprint: body.fingerprint,
          target: body.target,
          configuration: body.configuration,
          generationDays: body.generationDays,
        })
      } else if (action === 'get') {
        snapshot = await getGenerationJobSnapshotImpl(supabase, body.jobId)
      } else if (action === 'find') {
        snapshot = await findGenerationJobByFingerprintImpl(
          supabase,
          body.fingerprint,
        )
      } else if (action === 'find_target') {
        snapshot = await findGenerationJobByTargetImpl(supabase, body.target)
      } else if (action === 'finalize') {
        snapshot = await finalizeGenerationJobImpl(supabase, {
          jobId: body.jobId,
          expectedRevision: body.expectedRevision,
          partialWeek: body.partialWeek,
        })
      } else {
        return res.status(400).json({ error: 'invalid_action' })
      }

      if (!snapshot) return res.status(404).json({ error: 'generation_job_not_found' })
      return res.status(200).json({ ok: true, ...snapshot })
    } catch (error) {
      const code = String(error?.code || error?.message || 'generation_job_error')
      const status =
        code === 'generation_job_not_found'
          ? 404
          : GENERATION_JOB_CONFLICT_CODES.has(code)
            ? 409
            : code.startsWith('invalid_')
              ? 400
              : 500
      console.error('[programming-generation-jobs]', code)
      return res.status(status).json({ error: code })
    }
  }
}

export default createProgrammingGenerationJobsHandler()
