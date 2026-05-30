/**
 * Resolución de vídeos de YouTube reutilizable (scrape de resultados + verificación oembed).
 * Lo usan /api/video-resolve y /api/import-exercise-library-xlsx.
 */

import { youtubeWatchUrlOembedOk } from './youtubeOembedOk.js'

const BLOCKED_IDS = new Set(['5ZT-GeYND9g', 'OiYhXnGncY8', 'i953czRec9Q'])

const YT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'

export function buildYoutubeSearchUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${query} exercise tutorial`)}`
}

export async function scrapeYoutubeCandidateIds(query, { timeoutMs = 14000 } = {}) {
  const searchUrl = buildYoutubeSearchUrl(query)
  const yt = await fetch(searchUrl, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'User-Agent': YT_UA, Accept: 'text/html,application/xhtml+xml' },
  })
  const html = await yt.text()
  const all = [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map((m) => m[1])
  const seen = new Set()
  const ids = []
  for (const id of all) {
    if (seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return { ids, searchUrl }
}

export async function firstVerifiedWatchUrl(ids, { maxAttempts = 12, perTimeoutMs = 5000 } = {}) {
  const slice = ids.slice(0, maxAttempts)
  for (const id of slice) {
    if (BLOCKED_IDS.has(id)) continue
    const watch = `https://www.youtube.com/watch?v=${id}`
    try {
      if (await youtubeWatchUrlOembedOk(watch, AbortSignal.timeout(perTimeoutMs))) return watch
    } catch {
      /* siguiente candidato */
    }
  }
  return null
}

/**
 * Devuelve un watch URL verificado por oembed para `query`, o null si no se encontró.
 * @param {string} query
 * @returns {Promise<{ url: string | null, searchUrl: string }>}
 */
export async function resolveVerifiedWatchUrl(query, { maxAttempts = 12 } = {}) {
  const clean = String(query || '').replace(/\s+/g, ' ').slice(0, 180)
  const searchUrl = buildYoutubeSearchUrl(clean)
  try {
    const { ids } = await scrapeYoutubeCandidateIds(clean)
    const url = await firstVerifiedWatchUrl(ids, { maxAttempts })
    return { url, searchUrl }
  } catch {
    return { url: null, searchUrl }
  }
}
