/**
 * Parsea respuestas JSON de APIs EVO (puede incluir espacios de heartbeat al inicio).
 * Interpreta contrato transmitido: ok=false + errorStatus.
 */
export function parseJsonApiResponseText(rawText) {
  const trimmed = String(rawText || '').trim()
  if (!trimmed) return { json: {}, parseError: 'empty_body' }
  try {
    return { json: JSON.parse(trimmed), parseError: null }
  } catch {
    return { json: {}, parseError: 'invalid_json' }
  }
}

export function extractApiErrorMessage(json, fallback = 'Error desconocido') {
  if (!json || typeof json !== 'object') return fallback
  if (typeof json.error?.message === 'string' && json.error.message.trim()) {
    return json.error.message.trim()
  }
  if (typeof json.message === 'string' && json.message.trim()) return json.message.trim()
  if (typeof json.error === 'string' && json.error.trim()) return json.error.trim()
  return fallback
}

/**
 * @returns {{ ok: boolean, httpStatus: number, errorMessage: string, json: object }}
 */
export function classifyJsonApiResponse(res, rawText) {
  const { json, parseError } = parseJsonApiResponseText(rawText)
  const streamedErrorStatus = Number(json?.errorStatus)
  const hasStreamedError = json?.ok === false && Number.isFinite(streamedErrorStatus) && streamedErrorStatus >= 400
  const httpStatus = hasStreamedError ? streamedErrorStatus : Number(res?.status) || 500
  const ok = !hasStreamedError && res?.ok === true && json?.ok !== false
  const errorMessage = ok
    ? ''
    : extractApiErrorMessage(
        json,
        parseError === 'invalid_json'
          ? 'La respuesta del servidor no es JSON válido.'
          : `Error ${httpStatus}`,
      )
  return { ok, httpStatus, errorMessage, json }
}

export function isRetriableApiHttpStatus(status) {
  return [429, 502, 503, 504, 529].includes(Number(status))
}
