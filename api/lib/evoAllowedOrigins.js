/**
 * Orígenes permitidos para las funciones `/api/anthropic` y `/api/programming-week-briefing`.
 * - Producción usa los orígenes exactos de los dos proyectos conectados a
 *   `main`: `programing-evo.vercel.app` y `programing.vercel.app`.
 * - Dominio propio, staging o preview: lista su origen exacto en
 *   `EVO_ALLOWED_ORIGIN_PREFIXES` (coma, punto y coma o salto de línea).
 */

const EXTRA_ORIGINS = String(process.env.EVO_ALLOWED_ORIGIN_PREFIXES || '')
  .split(/[,;\n]/)
  .map((s) => s.trim())
  .filter(Boolean)
  .map((value) => {
    try {
      return new URL(value).origin
    } catch {
      return ''
    }
  })
  .filter(Boolean)

const STATIC_ORIGINS = [
  'https://programing-evo.vercel.app',
  'https://programing.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...EXTRA_ORIGINS,
]

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
  if (STATIC_ORIGINS.includes(origin)) return true
  return false
}
