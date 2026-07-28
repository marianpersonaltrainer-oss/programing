/**
 * POST /api/programming-ai-check
 * Petición mínima a Anthropic con Structured Outputs para validar clave, modelo y conectividad.
 */
import {
  DEFAULT_SUPPORT_MODEL,
  resolveProgrammingModel,
} from '../src/constants/anthropicModels.js'
import { getRequestOrigin, isEvoOriginAllowed } from './lib/evoAllowedOrigins.js'
import {
  adminSecretsMatch,
  checkAdminRateLimit,
} from './lib/evoAdminAuth.js'
import { createClient } from '@supabase/supabase-js'
import { startJsonStream } from './lib/jsonStreamResponse.js'

const CHECK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string' },
    model: { type: 'string' },
  },
  required: ['status', 'model'],
}

const CHECK_UPSTREAM_MS = 25_000

function parseBody(req) {
  try {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return null
  }
}

function newRequestId() {
  return `aicheck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const requestId = newRequestId()
  const originValue = getRequestOrigin(req)
  const isDev = process.env.NODE_ENV === 'development'
  if (!(isDev && !originValue) && !isEvoOriginAllowed(originValue)) {
    return res.status(403).json({ error: 'origin_not_allowed', requestId })
  }

  const body = parseBody(req)
  if (body === null) {
    return res.status(400).json({ error: 'JSON inválido', requestId })
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY || '').trim()
  if (!apiKey) {
    return res.status(500).json({ error: 'Falta ANTHROPIC_API_KEY en el servidor.', requestId })
  }

  const serverSecret = String(process.env.COACH_GUIDE_ADMIN_SECRET || '').trim()
  if (!serverSecret || !adminSecretsMatch(body.secret, serverSecret)) {
    return res.status(401).json({ error: 'unauthorized', requestId })
  }

  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  if (serviceKey && supabaseUrl) {
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    try {
      const exceeded = await checkAdminRateLimit(supabase, req, {
        endpoint: '/api/programming-ai-check',
        limit: 10,
        windowMinutes: 10,
      })
      if (exceeded) {
        return res.status(429).json({
          error: 'rate_limit_exceeded',
          retry_after_seconds: 600,
          requestId,
        })
      }
    } catch {
      /* continuar sin rate limit */
    }
  }

  const model = resolveProgrammingModel(
    process.env.PROGRAMMING_AI_CHECK_MODEL || DEFAULT_SUPPORT_MODEL,
  )
  const stream = startJsonStream(res, { requestId })
  const startedAt = Date.now()
  const upstreamAbort = new AbortController()
  const timeoutId = setTimeout(() => upstreamAbort.abort(), CHECK_UPSTREAM_MS)

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 120,
        system: 'Responde SOLO con JSON válido según el schema.',
        messages: [{ role: 'user', content: 'Responde {"status":"ok","model":"ping"} adaptando model al modelo real usado.' }],
        output_config: {
          format: { type: 'json_schema', schema: CHECK_SCHEMA },
        },
      }),
      signal: upstreamAbort.signal,
    })

    const rawText = await upstream.text()
    let data = {}
    try {
      data = rawText ? JSON.parse(rawText) : {}
    } catch {
      data = {}
    }

    const providerRequestId = data?.id || upstream.headers?.get?.('request-id') || null
    const latencyMs = Date.now() - startedAt

    if (!upstream.ok) {
      stream.finishError(upstream.status, {
        error: data?.error?.message || `Anthropic HTTP ${upstream.status}`,
        model,
        latencyMs,
        providerRequestId,
        structuredOutputs: true,
      })
      return
    }

    stream.finishSuccess({
      ok: true,
      status: 'connected',
      model: data?.model || model,
      latencyMs,
      providerRequestId,
      structuredOutputs: true,
      anthropicType: data?.type || null,
    })
  } catch (error) {
    const latencyMs = Date.now() - startedAt
    const isTimeout = error?.name === 'AbortError'
    stream.finishError(isTimeout ? 504 : 502, {
      error: isTimeout
        ? 'La comprobación tardó demasiado (timeout upstream).'
        : error?.message || 'No se pudo contactar con Anthropic.',
      model,
      latencyMs,
      structuredOutputs: true,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}
