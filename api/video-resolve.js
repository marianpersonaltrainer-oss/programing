/**
 * GET /api/video-resolve?exercise=<texto>
 * Busca en YouTube, prueba candidatos hasta que oembed confirme un vídeo válido, y redirige (302).
 * GET …&format=json → { ok, url? } sin redirección (para agente / enriquecimiento de biblioteca).
 */

import { youtubeWatchUrlOembedOk } from './lib/youtubeOembedOk.js'

const BLOCKED_IDS = new Set(['5ZT-GeYND9g', 'OiYhXnGncY8', 'i953czRec9Q'])

const YT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'

function buildSearchUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${query} exercise tutorial`)}`
}

async function scrapeYoutubeCandidateIds(query) {
  const searchUrl = buildSearchUrl(query)
  const scrapeSignal = AbortSignal.timeout(14000)
  const yt = await fetch(searchUrl, {
    signal: scrapeSignal,
    headers: {
      'User-Agent': YT_UA,
      Accept: 'text/html,application/xhtml+xml',
    },
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

async function firstVerifiedWatchUrl(ids, { maxAttempts = 12 } = {}) {
  const slice = ids.slice(0, maxAttempts)
  for (const id of slice) {
    if (BLOCKED_IDS.has(id)) continue
    const watch = `https://www.youtube.com/watch?v=${id}`
    try {
      const per = AbortSignal.timeout(5000)
      if (await youtubeWatchUrlOembedOk(watch, per)) return watch
    } catch {
      /* siguiente candidato */
    }
  }
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
  }

  const wantJson = req.query?.format === 'json' || req.query?.json === '1'
  const raw = String(req.query?.exercise || req.query?.q || '').trim()
  if (!raw) {
    return res.status(400).json({ ok: false, error: 'exercise requerido' })
  }

  const query = raw.replace(/\s+/g, ' ').slice(0, 180)
  const searchUrl = buildSearchUrl(query)

  try {
    const { ids } = await scrapeYoutubeCandidateIds(query)
    const verified = await firstVerifiedWatchUrl(ids, { maxAttempts: 12 })

    if (wantJson) {
      if (verified) {
        return res.status(200).json({ ok: true, url: verified, method: 'youtube_scrape+oembed' })
      }
      return res.status(200).json({
        ok: false,
        fallbackUrl: searchUrl,
        method: 'youtube_search_only',
        message:
          'No se obtuvo un vídeo de resultados que YouTube confirme (oembed). Se puede usar fallbackUrl como búsqueda manual.',
      })
    }

    if (verified) return res.redirect(302, verified)
    return res.redirect(302, searchUrl)
  } catch {
    if (wantJson) {
      return res.status(200).json({
        ok: false,
        fallbackUrl: searchUrl,
        method: 'error',
        message: 'Fallo de red o timeout al resolver el vídeo.',
      })
    }
    return res.redirect(302, searchUrl)
  }
}
