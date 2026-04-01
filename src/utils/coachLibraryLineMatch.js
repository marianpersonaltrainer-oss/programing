function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/**
 * Filas de biblioteca cuyo nombre aparece en la línea (prioriza nombres más largos).
 */
export function findLibraryRowsForLine(line, rows, { max = 4 } = {}) {
  const ln = norm(line)
  if (ln.length < 8) return []
  const active = (rows || []).filter((r) => r && r.active !== false && String(r.name || '').trim().length >= 4)
  const sorted = [...active].sort((a, b) => String(b.name || '').length - String(a.name || '').length)
  const out = []
  for (const r of sorted) {
    const n = norm(r.name)
    if (n.length < 4) continue
    if (ln.includes(n)) out.push(r)
    if (out.length >= max) break
  }
  return out
}
