import { getTrustedLibraryVideoUrl } from './coachLibraryVideoMatch.js'
import { findStaticVideoUrlForExerciseLabel } from '../constants/exerciseVideos.js'

const DEFAULT_MAX_YT_RESOLVE = 22
const CONCURRENCY = 3

/**
 * Para filas sin vídeo verificado en Supabase: mapa nombre → URL directa.
 * Usa el mapa estático de vídeos EVO si hay coincidencia; si no, `/api/video-resolve` (JSON)
 * que solo devuelve enlaces pasados por comprobación oembed en servidor.
 *
 * @param {Array<{ name?: string, video_url?: string | null, video_url_verified?: boolean }>} rows
 * @param {{ signal?: AbortSignal, maxResolve?: number }} [opts]
 * @returns {Promise<Map<string, string>>}
 */
export async function fetchLibraryAutoVideoMap(rows, opts = {}) {
  const { signal, maxResolve = DEFAULT_MAX_YT_RESOLVE } = opts
  const map = new Map()
  if (!Array.isArray(rows) || rows.length === 0) return map

  const toResolve = []
  for (const r of rows) {
    const name = String(r?.name || '').trim()
    if (!name || getTrustedLibraryVideoUrl(r)) continue
    if (map.has(name)) continue
    const staticUrl = findStaticVideoUrlForExerciseLabel(name)
    if (staticUrl) {
      map.set(name, staticUrl)
      continue
    }
    toResolve.push(name)
  }

  const unique = [...new Set(toResolve)].slice(0, Math.max(1, Math.min(40, maxResolve)))

  async function resolveOne(exerciseName) {
    const url = `/api/video-resolve?exercise=${encodeURIComponent(exerciseName)}&format=json`
    try {
      const res = await fetch(url, { signal })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j.ok && typeof j.url === 'string' && j.url.startsWith('https://')) {
        return { name: exerciseName, url: j.url }
      }
    } catch {
      /* red / abort */
    }
    return { name: exerciseName, url: null }
  }

  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    if (signal?.aborted) break
    const chunk = unique.slice(i, i + CONCURRENCY)
    const results = await Promise.all(chunk.map(resolveOne))
    for (const { name, url } of results) {
      if (url) map.set(name, url)
    }
  }

  return map
}
