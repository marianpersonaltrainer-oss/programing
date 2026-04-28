/**
 * GET /api/video-resolve?exercise=<texto>
 * Resuelve un video directo de YouTube para el ejercicio y redirige (302).
 * Evita enviar al buscador general y centraliza la lógica para todos los coaches.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
  }

  const raw = String(req.query?.exercise || req.query?.q || '').trim()
  if (!raw) {
    return res.status(400).json({ ok: false, error: 'exercise requerido' })
  }

  const query = raw.replace(/\s+/g, ' ').slice(0, 180)
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${query} exercise tutorial`,
  )}`

  try {
    const yt = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    const html = await yt.text()
    const ids = [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map((m) => m[1])
    const blocked = new Set(['5ZT-GeYND9g', 'OiYhXnGncY8', 'i953czRec9Q'])
    const picked = ids.find((id) => !blocked.has(id))
    // Si no conseguimos vídeo directo (cambios de YouTube / rate-limit), mandamos al buscador
    // para que el coach no se quede sin recurso durante la clase.
    if (!picked) return res.redirect(302, searchUrl)

    const target = `https://www.youtube.com/watch?v=${picked}`
    return res.redirect(302, target)
  } catch (e) {
    // Fallback seguro: siempre redirigir al buscador aunque falle el scraping.
    return res.redirect(302, searchUrl)
  }
}

