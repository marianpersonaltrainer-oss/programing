/**
 * Orígenes permitidos para las funciones `/api/anthropic` y `/api/programming-week-briefing`.
 * - Producción usa los orígenes exactos de los dos proyectos conectados a
 *   `main`: `programing-evo.vercel.app` y `programing.vercel.app`.
 * - Preview: el despliegue actual expone su hostname exacto en `VERCEL_URL`
 *   (y opcionalmente `VERCEL_BRANCH_URL`). Solo se acepta coincidencia exacta
 *   de `origin`, sin comodines ni subdominios parecidos.
 * - Dominio propio, staging o preview adicional: lista su origen exacto en
 *   `EVO_ALLOWED_ORIGIN_PREFIXES` (coma, punto y coma o salto de línea).
 */

const EXTRA_ORIGINS = String(process.env.EVO_ALLOWED_ORIGIN_PREFIXES || '')
  .split(/[,;\n]/)
  .map((s) => s.trim())
  .filter(Boolean)
  .map((value) => parseExactOrigin(value))
  .filter(Boolean)

const STATIC_ORIGINS = [
  'https://programing-evo.vercel.app',
  'https://programing.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...EXTRA_ORIGINS,
]

/** @param {string} value Hostname u origen completo. */
export function parseExactOrigin(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    return new URL(href).origin
  } catch {
    return ''
  }
}

/** Orígenes exactos del despliegue Vercel actual (preview o prod branch). */
export function getVercelDeploymentOrigins() {
  const keys = ['VERCEL_URL', 'VERCEL_BRANCH_URL']
  const origins = keys.map((key) => parseExactOrigin(process.env[key])).filter(Boolean)
  return [...new Set(origins)]
}

function getAllowedOrigins() {
  return [...new Set([...STATIC_ORIGINS, ...getVercelDeploymentOrigins()])]
}

export function getRequestOrigin(req) {
  const origin = String(req.headers?.origin || '').trim()
  if (origin) return origin
  const referer = String(req.headers?.referer || '').trim()
  return referer
}

export function isEvoOriginAllowed(originValue) {
  const v = String(originValue || '').trim()
  if (!v) return false
  let origin
  try {
    origin = new URL(v).origin
  } catch {
    return false
  }
  return getAllowedOrigins().includes(origin)
}
