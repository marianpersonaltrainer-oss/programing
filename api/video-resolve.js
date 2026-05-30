/**
 * GET /api/video-resolve?exercise=<texto>
 * Busca en YouTube, prueba candidatos hasta que oembed confirme un vídeo válido, y redirige (302).
 * GET …&format=json → { ok, url? } sin redirección (para agente / enriquecimiento de biblioteca).
 */

import { buildYoutubeSearchUrl, resolveVerifiedWatchUrl } from './lib/youtubeResolve.js'

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
  const searchUrl = buildYoutubeSearchUrl(query)

  try {
    const { url: verified } = await resolveVerifiedWatchUrl(query, { maxAttempts: 12 })

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
