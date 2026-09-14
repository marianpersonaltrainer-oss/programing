import { randomUUID } from 'node:crypto'
import { getRequestOrigin, isEvoOriginAllowed } from './lib/evoAllowedOrigins.js'
import { adminSecretsMatch, checkAdminRateLimit } from './lib/evoAdminAuth.js'
import {
  createProgrammingAgentVpsQueueBroker,
  ProgrammingAgentVpsQueueError,
} from './lib/programmingAgentVpsQueue.js'
import { createClient } from '@supabase/supabase-js'

function parseBody(req) {
  try {
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8') || '{}')
    if (typeof req.body === 'string') return JSON.parse(req.body || '{}')
    return req.body && typeof req.body === 'object' ? req.body : {}
  } catch {
    return null
  }
}

function serverConfig(env) {
  return {
    supabaseUrl: String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim(),
    serviceKey: String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    adminSecret: String(env.COACH_GUIDE_ADMIN_SECRET || '').trim(),
  }
}

export function createProgrammingAgentRequestHandler({
  env = process.env,
  createClientImpl = createClient,
  broker = createProgrammingAgentVpsQueueBroker({ env, createClientImpl }),
  checkRateLimitImpl = checkAdminRateLimit,
  requestIdImpl = randomUUID,
} = {}) {
  return async function programmingAgentRequestHandler(req, res) {
    const requestId = requestIdImpl()
    res.setHeader('Cache-Control', 'private, no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed', requestId })
    const origin = getRequestOrigin(req)
    const isDev = env.NODE_ENV === 'development'
    if (!(isDev && !origin) && !isEvoOriginAllowed(origin)) {
      return res.status(403).json({ error: 'origin_not_allowed', requestId })
    }
    const body = parseBody(req)
    if (!body) return res.status(400).json({ error: 'invalid_json', requestId })
    const config = serverConfig(env)
    if (!config.supabaseUrl || !config.serviceKey || !config.adminSecret) {
      return res.status(503).json({ error: 'programming_agent_gateway_not_configured', requestId })
    }
    if (!adminSecretsMatch(body.secret, config.adminSecret)) {
      return res.status(401).json({ error: 'unauthorized', requestId })
    }
    const supabase = createClientImpl(config.supabaseUrl, config.serviceKey, {
      auth: { persistSession: false },
    })
    try {
      const exceeded = await checkRateLimitImpl(supabase, req, {
        endpoint: '/api/programming-agent-request',
        limit: 6,
        windowMinutes: 10,
      })
      if (exceeded) {
        return res.status(429).json({ error: 'rate_limit_exceeded', retry_after_seconds: 600, requestId })
      }
    } catch {
      return res.status(503).json({ error: 'rate_limit_unavailable', requestId })
    }
    try {
      const action = String(body.action || '').trim()
      if (action === 'create') {
        const result = await broker.enqueue(body)
        return res.status(202).json({ ok: true, ...result, requestId })
      }
      if (action === 'status') {
        const request = await broker.status(body.ticket)
        if (!request) return res.status(404).json({ error: 'ticket_not_found', requestId })
        return res.status(200).json({ ok: true, request, requestId })
      }
      return res.status(400).json({ error: 'invalid_action', requestId })
    } catch (error) {
      const code = error instanceof ProgrammingAgentVpsQueueError
        ? error.code
        : 'gateway_unavailable'
      const status = code === 'invalid_request' || code === 'invalid_ticket'
        ? 400
        : 503
      return res.status(status).json({ error: code, requestId })
    }
  }
}

export default createProgrammingAgentRequestHandler()
