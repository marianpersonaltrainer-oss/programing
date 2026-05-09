/**
 * Comprueba si YouTube expone metadatos oembed para un watch URL (vídeo público / existente).
 * @param {string} watchUrl https://www.youtube.com/watch?v=VIDEO_ID
 * @param {AbortSignal} [signal]
 */
export async function youtubeWatchUrlOembedOk(watchUrl, signal) {
  const oembed = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`
  const r = await fetch(oembed, {
    method: 'GET',
    signal,
    headers: { Accept: 'application/json' },
  })
  return r.ok
}
