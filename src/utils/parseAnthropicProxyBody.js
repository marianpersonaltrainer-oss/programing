/**
 * Respuestas de `/api/anthropic` pueden ir precedidas de espacios (keep-alive durante
 * la espera a Anthropic) para evitar que proxies/redes corten la conexión por inactividad.
 */

/**
 * @param {string} raw — cuerpo completo de la respuesta
 * @returns {object}
 */
export function parseAnthropicProxyBody(raw) {
  const s = String(raw ?? '')
  const start = s.search(/\{/)
  if (start < 0) {
    throw new Error('La respuesta del servidor no contiene JSON reconocible.')
  }
  return JSON.parse(s.slice(start))
}

/**
 * @param {object} data — JSON ya parseado del proxy
 * @returns {boolean} true si es error de API / proxy (no hay mensaje del asistente usable)
 */
export function isAnthropicProxyFailure(data) {
  if (!data || typeof data !== 'object') return true
  if (data.type === 'error') return true
  if (data.error && !Array.isArray(data.content)) return true
  return false
}

/**
 * Extrae el mejor mensaje de error posible del proxy Anthropic.
 * Evita mostrar solo "Error 500" cuando el backend sí devolvió detalle útil.
 */
export function getAnthropicProxyErrorMessage(data, rawText, status) {
  const objMsg =
    (typeof data?.error === 'object' && data?.error?.message) ||
    (typeof data?.error === 'string' && data.error) ||
    (typeof data?.message === 'string' && data.message) ||
    ''
  if (String(objMsg || '').trim()) return String(objMsg).trim()

  const txt = String(rawText || '').trim()
  if (txt) return txt.slice(0, 500)

  return `Error ${status}`
}
