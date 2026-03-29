/**
 * Normaliza texto que va en el prompt de generación Excel para reducir JSON roto en la respuesta:
 * comillas tipográficas, separadores de línea Unicode, NUL, NBSP (típico al pegar desde Excel/Word).
 */
export function sanitizePromptTextForLLM(s) {
  if (s == null) return ''
  if (typeof s !== 'string') return String(s)
  return (
    s
      .replace(/\u0000/g, '')
      .replace(/\uFEFF/g, '')
      .replace(/[\u2028\u2029]/g, '\n')
      .replace(/\u00A0/g, ' ')
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
  )
}
