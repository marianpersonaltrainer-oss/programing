/**
 * Acepta ID de carpeta o URL de Drive tipo …/drive/folders/XXXX
 * @param {string} raw
 * @returns {string} id o cadena vacía si no se reconoce
 */
export function extractDriveFolderId(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  const fromUrl = s.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (fromUrl) return fromUrl[1]
  if (/^[a-zA-Z0-9_-]{15,}$/.test(s)) return s
  if (/^[a-zA-Z0-9_-]{10,14}$/.test(s)) return s
  return ''
}
