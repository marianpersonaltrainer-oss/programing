/**
 * Extrae bloques con cronología (minutos desde inicio de clase) desde texto de sesión.
 * Formato esperado: (0' - 5'), (12' - 24'), etc.
 */

/** Acepta guion ASCII o en-dash (como en Word / macOS). */
const RANGE_RE = /\(\s*(\d+)\s*['′']?\s*[-–—]\s*(\d+)\s*['′']?\s*\)/

export function parseTimedBlocks(sessionText) {
  const text = String(sessionText || '')
  const lines = text.split('\n')
  const blocks = []

  for (const line of lines) {
    const m = line.match(RANGE_RE)
    if (!m) continue
    const startMin = parseInt(m[1], 10)
    const endMin = parseInt(m[2], 10)
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) continue
    const title = line.replace(RANGE_RE, '').trim() || `Bloque ${startMin}′–${endMin}′`
    blocks.push({ title, startMin, endMin, rawLine: line.trim() })
  }

  blocks.sort((a, b) => a.startMin - b.startMin)
  return blocks
}

/** Minuto actual de clase (0–60) desde timestamp de inicio. */
export function classElapsedMinutes(startedAtMs) {
  if (!startedAtMs) return 0
  return Math.max(0, (Date.now() - startedAtMs) / 60000)
}

export function findActiveTimedBlock(blocks, elapsedMin) {
  if (!blocks?.length) return -1
  const i = blocks.findIndex((b) => elapsedMin >= b.startMin && elapsedMin < b.endMin)
  return i
}
