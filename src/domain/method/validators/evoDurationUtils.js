import { splitEvoSessionBlocks } from '../evoBasicsSkills.js'

/** Lee minutos del título de bloque (—/·/TC N MIN, «N MIN POR TIEMPO», etc.). */
export function readDurationMinutes(header) {
  const text = String(header || '')
  const patterns = [
    /[—–\-·]\s*(?:TC\s*)?(\d+(?:[.,]\d+)?)\s*MIN(?:\s+POR\s+TIEMPO)?\b/i,
    /\bTC\s*(\d+(?:[.,]\d+)?)\s*MIN\b/i,
    /\b(\d+(?:[.,]\d+)?)\s*MIN\s+POR\s+TIEMPO\b/i,
    /\bPARTE\s+[UÚ]NICA\b[\s\S]*?\b(\d+(?:[.,]\d+)?)\s*MIN\b/i,
    /\b(?:AMRAP|INTERVALOS|FUERZA|WOD|EMOM|IGYG)\b[\s\S]*?\b(\d+(?:[.,]\d+)?)\s*MIN\b/i,
  ]
  for (const re of patterns) {
    const match = text.match(re)
    if (match) return Number(match[1].replace(',', '.'))
  }
  return null
}

export function readTimeCapMinutes(header) {
  const tc = String(header || '').match(/\bTC\s*(\d+(?:[.,]\d+)?)\s*MIN\b/i)
  if (tc) return Number(tc[1].replace(',', '.'))
  const porTiempo = readDurationMinutes(header)
  if (porTiempo != null && /\bPOR\s+TIEMPO\b/i.test(header)) return porTiempo
  return null
}

export function sumSessionBlockDurations(session) {
  const blocks = splitEvoSessionBlocks(session)
  if (!blocks.length) {
    const firstLine = String(session || '').split('\n')[0] || ''
    return readDurationMinutes(firstLine) || 0
  }
  return blocks.reduce((sum, block) => sum + (readDurationMinutes(block.header) || 0), 0)
}
