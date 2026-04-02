/**
 * Cuando `fetch('/api/anthropic')` falla a nivel de red, `err.message` suele ser "Failed to fetch"
 * (timeout del edge, función serverless cortada, bloqueo, etc.). Anthropic no llega a responder JSON.
 */
export function explainAnthropicFetchFailure(err) {
  const m = String(err?.message || '')
  const name = err?.name || ''
  const lower = m.toLowerCase()

  const isLikelyNetworkAbort =
    m === 'Failed to fetch' ||
    m === 'Load failed' ||
    m === 'NetworkError when attempting to fetch resource.' ||
    (name === 'TypeError' && (lower.includes('fetch') || lower.includes('failed')))

  if (isLikelyNetworkAbort) {
    return (
      'No se pudo completar la llamada a la IA (conexión cortada antes de respuesta). ' +
      'Si la respuesta tarda mucho, algunas redes o proxies cortan conexiones «en silencio» y el navegador muestra «Failed to fetch». ' +
      'Tras el último deploy el servidor envía keep-alive durante la espera; prueba en otra red o sin VPN. ' +
      'Mantén plan Pro, `maxDuration` alto en `vercel.json` y evita contextos enormes en una sola generación. ' +
      'Revisa ANTHROPIC_API_KEY en Production y extensiones que bloqueen solicitudes.'
    )
  }
  return m || 'Error de red desconocido.'
}
