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
      'Si la respuesta tarda demasiado, la plataforma o la red puede cortar la solicitud y el navegador muestra «Failed to fetch». ' +
      'Usa plan Pro (o superior), mantén `maxDuration` alto en `vercel.json` y reduce contexto/adjuntos muy largos en esa generación. ' +
      'También revisa ANTHROPIC_API_KEY en Production, red/VPN y extensiones que bloqueen solicitudes.'
    )
  }
  return m || 'Error de red desconocido.'
}
