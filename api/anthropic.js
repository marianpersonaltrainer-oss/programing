/**
 * VERCEL SERVERLESS FUNCTION: api/anthropic.js
 * Puente seguro entre el front y https://api.anthropic.com/v1/messages .
 *
 * Importante: en Vercel `req.body` a veces llega como string JSON o vacío; hay que parsearlo
 * igual que en coach-exercise-library.js. Desestructurar `undefined` lanza TypeError → 500.
 *
 * Duración: `vercel.json` → functions maxDuration (300 s). Plan Pro + redeploy.
 *
 * Keep-alive: mientras se espera a Anthropic se envían espacios en chunked encoding para que
 * la conexión navegador→Vercel no quede totalmente inactiva (evita «Failed to fetch» en redes
 * con timeout agresivo). El cliente ignora el prefijo y parsea el JSON final (ver parseAnthropicProxyBody).
 */

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

const ANTHROPIC_UPSTREAM_TIMEOUT_MS = 110000
const CLIENT_HEARTBEAT_MS = 10000

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const body = parseRequestBody(req)
  if (body === null) {
    return res.status(400).json({
      error: { message: 'Cuerpo de la petición no es JSON válido.' },
    })
  }

  const { model, max_tokens, system, weekContext, messages } = body

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
