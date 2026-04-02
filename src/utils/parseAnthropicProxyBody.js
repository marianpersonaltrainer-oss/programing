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
