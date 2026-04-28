/**
 * VERCEL SERVERLESS FUNCTION: api/anthropic.js
 * Puente seguro entre el front y https://api.anthropic.com/v1/messages .
 *
 * Importante: en Vercel `req.body` a veces llega como string JSON o vacío; hay que parsearlo
 * igual que en coach-exercise-library.js. Desestructurar `undefined` lanza TypeError → 500.
 *
 * Duración: `vercel.json` → functions maxDuration (300 s). El abort a Anthropic sigue
 * `ANTHROPIC_UPSTREAM_TIMEOUT_MS` (por defecto ~270 s, configurable por env).
 *
 * Keep-alive: mientras se espera a Anthropic se envían espacios en chunked encoding para que
 * la conexión navegador→Vercel no quede totalmente inactiva (evita «Failed to fetch» en redes
 * con timeout agresivo). El cliente ignora el prefijo y parsea el JSON final (ver parseAnthropicProxyBody).
 */

import { getRequestOrigin, isEvoOriginAllowed } from './lib/evoAllowedOrigins.js'

/** Traduce errores conocidos de Anthropic a mensaje útil en español. */
function userFacingMessage(data, httpStatus) {
  const raw =
    (data && typeof data.error === 'object' && data.error.message) ||
    (typeof data?.message === 'string' && data.message) ||
    ''
  const lower = String(raw).toLowerCase()
  const errType = (data?.error && data.error.type) || ''

  if (
    lower.includes('credit balance') ||
    lower.includes('too low to access') ||
    lower.includes('billing') ||
    errType === 'insufficient_quota'
  ) {
    return (
      'La cuenta de Anthropic asociada a tu clave API no tiene créditos suficientes. ' +
      'Entra en https://console.anthropic.com/settings/plans , recarga créditos o cambia de plan, y vuelve a intentarlo. ' +
      'En Vercel debe estar la misma clave que uses en esa cuenta (variable ANTHROPIC_API_KEY en Production).'
    )
  }

  if (httpStatus === 401 || lower.includes('invalid x-api-key') || lower.includes('authentication')) {
    return (
      'La clave API no es válida o fue revocada. Revisa ANTHROPIC_API_KEY en Vercel → Environment Variables (Production) y haz Redeploy.'
    )
  }

  if (httpStatus === 429 || lower.includes('rate limit')) {
    return 'Límite de uso de la API alcanzado. Espera unos minutos o revisa tu plan en Anthropic.'
  }

  return raw || 'Error al contactar con la API de Anthropic.'
}

function parseRequestBody(req) {
  const raw = req.body
  if (raw == null || raw === '') return {}
  if (Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString('utf8') || '{}')
    } catch {
      return null
    }
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (typeof raw === 'object') return raw
  return null
}

function getClientIp(req) {
  const xff = String(req.headers?.['x-forwarded-for'] || '')
  const firstForwarded = xff.split(',')[0]?.trim()
  const ipRaw =
    firstForwarded ||
    String(req.headers?.['x-real-ip'] || '').trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  return String(ipRaw).replace(/^::ffff:/, '')
}

function getSupabaseAdminConfig() {
  const url = String(process.env.VITE_SUPABASE_URL || '').trim()
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url || !serviceKey) return null
  return { url, serviceKey }
}

async function checkRateLimitViaSupabase({ ip, endpoint, limit, windowMinutes }) {
  const cfg = getSupabaseAdminConfig()
  if (!cfg) {
    console.warn('Rate-limit bypass: missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return { exceeded: false }
  }
  const rpcUrl = `${cfg.url.replace(/\/$/, '')}/rest/v1/rpc/check_rate_limit`
  const r = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: cfg.serviceKey,
      Authorization: `Bearer ${cfg.serviceKey}`,
    },
    body: JSON.stringify({
      p_ip: ip,
      p_endpoint: endpoint,
      p_limit: limit,
      p_window_minutes: windowMinutes,
    }),
  })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(`rate_limit_rpc_failed_${r.status}_${t.slice(0, 120)}`)
  }
  const payload = await r.json().catch(() => null)
  const exceeded =
    payload === true ||
    payload?.check_rate_limit === true ||
    (Array.isArray(payload) && payload[0]?.check_rate_limit === true)
  return { exceeded: !!exceeded }
}

async function insertApiUsageLogViaSupabase({ endpoint, model, usage, ip }) {
  const cfg = getSupabaseAdminConfig()
  if (!cfg) return
  const inputTokens = Number(usage?.input_tokens || 0) || 0
  const outputTokens = Number(usage?.output_tokens || 0) || 0
  const totalTokens = Number(usage?.total_tokens || inputTokens + outputTokens) || 0
  const url = `${cfg.url.replace(/\/$/, '')}/rest/v1/api_usage_log`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: cfg.serviceKey,
      Authorization: `Bearer ${cfg.serviceKey}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      endpoint: String(endpoint || ''),
      model: String(model || ''),
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      ip: String(ip || ''),
    }),
  })
  if (!response.ok) {
    const txt = await response.text().catch(() => '')
    throw new Error(`api_usage_log_insert_failed_${response.status}_${txt.slice(0, 120)}`)
  }
}

function injectWeekContext(system, weekContext) {
  const baseSystem = typeof system === 'string' ? system : ''
  const ctx = String(weekContext || '').trim()
  if (!ctx) return baseSystem
  const replacement = `CONTEXTO DE LA SEMANA
════════════════════════════════════════

${ctx}

════════════════════════════════════════
`

  // Reemplazo delimitado entre la sección de memoria semanal y la siguiente sección de vídeos.
  const sectionRe =
    /CONTEXTO DE LA SEMANA \(MEMORIA ACUMULADA\)[\s\S]*?(?=REGLAS DE V[IÍ]DEOS Y MATERIAL MULTIMEDIA)/m
  if (sectionRe.test(baseSystem)) {
    return baseSystem.replace(sectionRe, replacement)
  }

  // Fallback: prompts que no tienen esta sección (p.ej. algunos flows de Excel).
  return `${baseSystem}\n\n${replacement}`
}

/**
 * Tiempo máximo de espera a api.anthropic.com por petición.
 * Debe ser algo menor que `vercel.json` → functions.maxDuration (300s) para dejar margen
 * a rate-limit, logs y serialización. Antes 110s cortaba generaciones válidas con
 * prompt largo (briefing + método + ejemplos) + max_tokens altos.
 */
const ANTHROPIC_UPSTREAM_TIMEOUT_MS = (() => {
  const raw = Number(process.env.ANTHROPIC_UPSTREAM_TIMEOUT_MS)
  // Máx. ~298s: debe quedar por debajo de vercel.json → maxDuration (300s) con margen para rate-limit y logs.
  if (Number.isFinite(raw) && raw >= 60_000 && raw <= 298_000) return Math.floor(raw)
  return 293_000
})()
/** Bytes periódicos en el cuerpo de respuesta para que proxies no corten por inactividad (p. ej. Vercel). */
const CLIENT_HEARTBEAT_MS = 5000

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const originValue = getRequestOrigin(req)
  const isDev = process.env.NODE_ENV === 'development'
  if (!(isDev && !originValue) && !isEvoOriginAllowed(originValue)) {
    return res.status(403).json({ error: 'origin_not_allowed' })
  }

  const body = parseRequestBody(req)
  if (body === null) {
    return res.status(400).json({
      error: { message: 'Cuerpo de la petición no es JSON válido.' },
    })
  }

  const { model, max_tokens, system, weekContext, messages, supportMode } = body
  const ip = getClientIp(req)
  const endpoint = supportMode ? '/api/anthropic:support' : '/api/anthropic'
  const rateLimit = supportMode ? 10 : 30
  const rateWindowMinutes = 10

  try {
    const { exceeded } = await checkRateLimitViaSupabase({
      ip,
      endpoint,
      limit: rateLimit,
      windowMinutes: rateWindowMinutes,
    })
    if (exceeded) {
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        retry_after_seconds: rateWindowMinutes * 60,
      })
    }
  } catch (e) {
    console.error('Rate limit check failed:', e)
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: {
        message:
          'Falta "messages" (array con al menos un mensaje). Revisa que el cliente envíe JSON con Content-Type application/json.',
      },
    })
  }

  const apiKey = (
    process.env.ANTHROPIC_API_KEY ||
    process.env.VITE_ANTHROPIC_API_KEY ||
    ''
  ).trim()

  if (!apiKey) {
    return res.status(500).json({
      error: {
        message:
          'Falta clave de Anthropic en el servidor. En Vercel: Settings → Environment Variables → añade ANTHROPIC_API_KEY para Production y Redeploy.',
      },
    })
  }

  let upstreamTimeoutId = null
  const upstreamAbort = new AbortController()
  let heartbeat = null
  let streamStarted = false

  const clearHeartbeat = () => {
    if (heartbeat) {
      clearInterval(heartbeat)
      heartbeat = null
    }
  }

  try {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    })
    streamStarted = true
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders()
    }
    heartbeat = setInterval(() => {
      try {
        res.write(' ')
      } catch {
        /* cliente cerró */
      }
    }, CLIENT_HEARTBEAT_MS)

    upstreamTimeoutId = setTimeout(() => {
      upstreamAbort.abort()
    }, ANTHROPIC_UPSTREAM_TIMEOUT_MS)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: max_tokens || 8000,
        system: system === undefined ? undefined : injectWeekContext(system, weekContext),
        messages,
      }),
      signal: upstreamAbort.signal,
    })

    const rawText = await response.text()
    let data
    try {
      data = rawText ? JSON.parse(rawText) : {}
    } catch {
      console.error('Anthropic no-JSON body:', rawText?.slice(0, 500))
      clearHeartbeat()
      return res.end(
        JSON.stringify({
          error: {
            message:
              'La API de Anthropic devolvió un cuerpo que no es JSON. Revisa el modelo y los logs de Vercel (Functions → anthropic).',
            preview: String(rawText || '').slice(0, 200),
          },
        }),
      )
    }

    if (!response.ok) {
      console.error('Anthropic API Error:', response.status, data)
      const message = userFacingMessage(data, response.status)
      const baseError =
        data && typeof data.error === 'object' && !Array.isArray(data.error)
          ? { ...data.error, message }
          : { type: 'api_error', message }
      clearHeartbeat()
      return res.end(
        JSON.stringify({
          ...data,
          error: baseError,
        }),
      )
    }

    try {
      await insertApiUsageLogViaSupabase({
        endpoint,
        model: data?.model || model || 'claude-sonnet-4-20250514',
        usage: data?.usage || {},
        ip,
      })
    } catch (e) {
      console.error('api_usage_log insert failed:', e)
    }

    clearHeartbeat()
    return res.end(JSON.stringify(data))
  } catch (error) {
    clearHeartbeat()
    if (error?.name === 'AbortError') {
      if (streamStarted && !res.writableEnded) {
        return res.end(
          JSON.stringify({
            error: {
              type: 'upstream_timeout',
              message:
                'La API de Anthropic tardó demasiado en responder y se canceló la llamada para evitar corte brusco de la función. Reintenta: el cliente divide y reintenta automáticamente.',
            },
          }),
        )
      }
      return res.status(504).json({
        error: {
          type: 'upstream_timeout',
          message:
            'La API de Anthropic tardó demasiado en responder y se canceló la llamada para evitar corte brusco de la función. Reintenta: el cliente divide y reintenta automáticamente.',
        },
      })
    }
    const msg = error?.message ? String(error.message).slice(0, 500) : 'unknown'
    console.error('Serverless Function Error:', error)
    if (streamStarted && !res.writableEnded) {
      return res.end(
        JSON.stringify({
          error: {
            message:
              'Error interno al llamar a Anthropic. Si es la primera vez tras redeploy, revisa ANTHROPIC_API_KEY y que el proyecto use Node 20. Detalle técnico (sin claves): ' +
              msg,
          },
        }),
      )
    }
    return res.status(500).json({
      error: {
        message:
          'Error interno al llamar a Anthropic. Si es la primera vez tras redeploy, revisa ANTHROPIC_API_KEY y que el proyecto use Node 20. Detalle técnico (sin claves): ' +
          msg,
      },
    })
  } finally {
    if (upstreamTimeoutId) clearTimeout(upstreamTimeoutId)
  }
}
