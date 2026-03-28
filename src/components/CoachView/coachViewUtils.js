import { FEEDBACK_BLOCKS } from './coachViewConstants.js'

export function sessionText(val) {
  if (val == null) return ''
  const s = String(val).trim()
  return s
}

export function findDia(dias, name) {
  if (!name || name === 'show') return null
  return dias.find(
    (d) =>
      d.nombre === name ||
      (d.nombre && name && String(d.nombre).trim().toUpperCase() === String(name).trim().toUpperCase()),
  )
}

export function previewText(text, maxLines = 4, maxChars = 320) {
  const t = sessionText(text)
  if (!t) return ''
  const lines = t.split('\n').filter((l) => l.trim())
  const chunk = lines.slice(0, maxLines).join('\n')
  return chunk.length > maxChars ? `${chunk.slice(0, maxChars)}…` : chunk
}

export function buildDayQuickSummary(dia, SESSION_BLOCKS) {
  if (!dia) return { labels: [], preview: '' }
  const labels = SESSION_BLOCKS.filter(({ key }) => sessionText(dia[key])).map(({ label }) => label)
  const firstBlock = SESSION_BLOCKS.map(({ key }) => dia[key]).find((v) => sessionText(v))
  const preview = previewText(firstBlock || dia.wodbuster || '', 5, 400)
  return { labels, preview }
}

/** Una línea para destacar “objetivo del día” en cards de semana. */
export function dayFocusLine(dia, SESSION_BLOCKS) {
  if (!dia) return null
  const { preview } = buildDayQuickSummary(dia, SESSION_BLOCKS)
  if (preview) {
    const line = preview.split('\n').find((l) => l.trim()) || preview
    return line.length > 200 ? `${line.slice(0, 197)}…` : line
  }
  for (const { key } of FEEDBACK_BLOCKS) {
    const t = sessionText(dia[key])
    if (t) {
      const line = t.split('\n').find((l) => l.trim()) || t
      return line.length > 200 ? `${line.slice(0, 197)}…` : line
    }
  }
  const wb = sessionText(dia.wodbuster)
  if (wb) return previewText(wb, 5, 220)
  return null
}
