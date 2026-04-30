/**
 * Orígenes permitidos para las funciones `/api/anthropic` y `/api/programming-week-briefing`.
 * - Producción y previews de Vercel del mismo proyecto suelen ser `https://programing-evo*.vercel.app`.
 * - Dominio propio o staging: lista en `EVO_ALLOWED_ORIGIN_PREFIXES` (coma, punto y coma o salto de línea).
 */

const EXTRA_PREFIXES = String(process.env.EVO_ALLOWED_ORIGIN_PREFIXES || '')
  .split(/[,;\n]/)
  .map((s) => s.trim())
  .filter(Boolean)

const STATIC_PREFIXES = [
  'https://programing-evo.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...EXTRA_PREFIXES,
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
  if (STATIC_PREFIXES.some((p) => v.startsWith(p))) return true
  if (/^https:\/\/programing-evo[\w.-]*\.vercel\.app$/i.test(v)) return true
  return false
}
