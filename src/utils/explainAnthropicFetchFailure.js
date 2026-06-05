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
      'Suele pasar cuando la petición tarda demasiado: en Vercel **Hobby** las funciones se cortan a ~10 s (hace falta **plan Pro** para generar semanas). ' +
      'También puede ser red/VPN, o un prompt demasiado grande en el primer día. ' +
      'Prueba sin VPN, recarga fuerte (Cmd+Shift+R) y vuelve a generar; el sistema reintenta con un prompt más ligero. ' +
      'Revisa ANTHROPIC_API_KEY en Production si persiste.'
    )
  }
  return m || 'Error de red desconocido.'
}
