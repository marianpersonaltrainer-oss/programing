/**
 * Anthropic puede devolver varios bloques en `content` y no siempre el primero es texto.
 * Unimos solo bloques textuales y devolvemos un string utilizable por la UI.
 */
export function extractAnthropicTextBlocks(data) {
  const blocks = Array.isArray(data?.content) ? data.content : []
  const text = blocks
    .map((block) => {
      if (!block || typeof block !== 'object') return ''
      if (block.type && block.type !== 'text') return ''
      return typeof block.text === 'string' ? block.text : ''
    })
    .filter(Boolean)
    .join('\n')
    .trim()

  if (text) return text
  if (typeof data?.content === 'string') return data.content.trim()
  return ''
}
