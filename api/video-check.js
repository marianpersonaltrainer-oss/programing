/**
 * GET /api/video-check?url=<https...>
 * Comprueba si una URL de vídeo responde (YouTube vía oembed; otros con HEAD).
 * Sin secret: solo hosts permitidos (evita SSRF).
 */

import { youtubeWatchUrlOembedOk } from './lib/youtubeOembedOk.js'

const ALLOWED_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'youtu.be',
  'm.youtube.com',
  'www.vimeo.com',
  'vimeo.com',
  'player.vimeo.com',
  'www.instagram.com',
  'instagram.com',
  'drive.google.com',
  'docs.google.com',
])

function parseUrl(raw) {
  try {
    return new URL(String(raw || '').trim())
  } catch {
    return null
  }
}

function hostAllowed(hostname) {
  const h = String(hostname || '').toLowerCase()
  return ALLOWED_HOSTS.has(h)
}

function youtubeWatchOrShort(u) {
  const p = u.pathname || ''
  const idParam = u.searchParams.get('v')
  if (idParam && /^[a-zA-Z0-9_-]{11}$/.test(idParam)) return idParam
  const mShort = p.match(/^\/shorts\/([a-zA-Z0-9_-]{11})/)
  if (mShort) return mShort[1]
  if (u.hostname.replace(/^www\./, '') === 'youtu.be') {
    const id = p.replace(/^\//, '').slice(0, 11)
    if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id
  }
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
  }

  const raw = String(req.query?.url || '').trim()
  if (!raw || raw.length > 2000) {
    return res.status(400).json({ ok: false, error: 'Parámetro url requerido (máx. 2000 caracteres).' })
  }

  const u = parseUrl(raw)
  if (!u || u.protocol !== 'https:') {
    return res.status(400).json({ ok: false, error: 'Solo URLs https válidas.' })
  }
  if (!hostAllowed(u.hostname)) {
    return res.status(400).json({ ok: false, error: 'Host no permitido para comprobación.' })
  }

  const timeoutMs = 9000
  const signal = AbortSignal.timeout(timeoutMs)

  try {
    const ytId = youtubeWatchOrShort(u)
    if (ytId) {
      const watch = `https://www.youtube.com/watch?v=${ytId}`
      const ok = await youtubeWatchUrlOembedOk(watch, signal)
      return res.status(200).json({
        ok,
        method: 'youtube_oembed',
        message: ok ? 'YouTube reconoce el vídeo.' : 'YouTube no devolvió metadatos (¿privado o eliminado?).',
      })
    }

    const head = await fetch(raw, { method: 'HEAD', redirect: 'follow', signal })
    const ok = head.ok || head.status === 405 || head.status === 403
    return res.status(200).json({
      ok: head.ok,
      status: head.status,
      method: 'head',
      message: head.ok
        ? 'El servidor respondió OK.'
        : `Respuesta HTTP ${head.status}. Prueba a abrir el enlace manualmente.`,
    })
  } catch (e) {
    return res.status(200).json({
      ok: false,
      method: 'error',
      message: String(e?.message || e || 'Timeout o red'),
    })
  }
}
