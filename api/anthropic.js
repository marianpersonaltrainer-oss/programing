/**
 * VERCEL SERVERLESS FUNCTION: api/anthropic.js
 * Puente seguro entre el front y https://api.anthropic.com/v1/messages .
 *
 * Quién llama (el body incluye `model`, `system`, `messages`, `max_tokens`):
 * | Origen | Modelo típico | Motivo |
 * |--------|----------------|--------|
 * | ExcelGeneratorModal → callApi | Sonnet (`AI_CONFIG.model`) | JSON semanal, SYSTEM_PROMPT_EXCEL |
 * | useAgent → sendMessage | Sonnet | Chat programador, SYSTEM_PROMPT + semana |
 * | CoachView → soporte | Haiku (`AI_CONFIG.supportModel`) | Chat coach, COACH_SUPPORT_SYSTEM_PROMPT |
 *
 * Si el cliente no envía `model`, el fallback aquí abajo es Sonnet (programación).
 */

/** Traduce errores conocidos de Anthropic a mensaje útil en español (el cliente muestra error.message). */
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

export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { model, max_tokens, system, messages } = req.body
  const apiKey = (
    process.env.ANTHROPIC_API_KEY ||
    process.env.VITE_ANTHROPIC_API_KEY ||
    ''
  ).trim()

  if (!apiKey) {
    return res.status(500).json({
      error: {
        message:
          'Falta clave de Anthropic en el servidor. En Vercel: Settings → Environment Variables → añade ANTHROPIC_API_KEY (recomendado) para Production y Redeploy. No uses solo el nombre en español ni variables sin asignar a Production.',
      },
    })
  }

  try {
    // Reenvío tal cual: modelo y tokens los fija cada caller (ver cabecera del archivo).
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
        system,
        messages,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Anthropic API Error:', data)
      const message = userFacingMessage(data, response.status)
      const baseError =
        data && typeof data.error === 'object' && !Array.isArray(data.error)
          ? { ...data.error, message }
          : { type: 'api_error', message }
      return res.status(response.status).json({
        ...data,
        error: baseError,
      })
    }

    return res.status(200).json(data)
  } catch (error) {
    console.error('Serverless Function Error:', error)
    return res.status(500).json({ 
      error: { message: 'Error interno del servidor al conectar con la IA.' } 
    })
  }
}
