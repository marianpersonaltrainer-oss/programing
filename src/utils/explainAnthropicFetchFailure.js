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
      'En Vercel plan Hobby el tiempo máximo de /api suele ser ~10 s; la generación Excel con Sonnet y un contexto grande suele tardar más y el servidor corta la petición — el navegador muestra «Failed to fetch». ' +
      'Opciones: usar plan Pro (o superior) y redeploy con maxDuration 60 s en vercel.json, o ejecutar en local con `vercel dev` / preview donde el límite no aplica igual. ' +
      'También revisa ANTHROPIC_API_KEY en Production, red/VPN y extensiones que bloqueen solicitudes.'
    )
  }
  return m || 'Error de red desconocido.'
}
