import { listWeeksLastYear } from '../lib/supabase.js'

const MAX_BLOCK_CHARS = 1200
const MAX_LINES = 12

function parseYearFocus(row) {
  const title = String(row?.title || 'Semana').replace(/\s+/g, ' ').trim()
  const resumen = row?.resumen
  const foco =
    typeof resumen === 'string'
      ? resumen.replace(/\s+/g, ' ').trim()
      : String(resumen?.foco || resumen?.focus || resumen?.estimulo || '')
          .replace(/\s+/g, ' ')
          .trim()
  const line = `${title}: ${foco || 'sin foco'}`
  return line.length > 130 ? `${line.slice(0, 129).trimEnd()}…` : line
}

/** Bloque compacto para el generador Excel (no duplicar si el briefing ya lo trae). */
export async function buildLastYearReferenceBlock() {
  const rows = await listWeeksLastYear(30)
  if (!rows.length) return ''

  const lines = []
  let used = 0
  for (const row of rows) {
    if (lines.length >= MAX_LINES) break
    const line = `• ${parseYearFocus(row)}`
    if (used + line.length + 1 > MAX_BLOCK_CHARS && lines.length > 0) break
    lines.push(line)
    used += line.length + 1
  }

  if (!lines.length) return ''
  return [
    'REFERENCIA ÚLTIMO AÑO (no repetir focos recientes; varía estímulo respecto a estas semanas):',
    lines.join('\n'),
  ].join('\n')
}

export function briefingPackIncludesLastYear(packText) {
  return /referencia\s+.*último\s+año|último\s+año|ultimo\s+ano|last\s+year/i.test(
    String(packText || ''),
  )
}
