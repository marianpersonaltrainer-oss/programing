function asText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function blockTitle(label, fallbackIndex) {
  const normalized = asText(label).toUpperCase()
  if (normalized === 'A') return 'Parte A'
  if (normalized === 'B') return 'Parte B'
  return fallbackIndex === 0 ? 'Sesión' : `Parte ${fallbackIndex + 1}`
}

/**
 * Keeps imported Programming content intact while preparing it for the Coach layout.
 * It deliberately does not infer prescriptions or change training content.
 */
export function splitLegacyProgrammingIntoBlocks(programming) {
  const raw = asText(programming)
  if (!raw) return []

  const parts = raw
    .split(/(?:^|\n)\s*PARTE\s+([A-Z])\s*:?[\t ]*/gi)
    .map(asText)

  if (parts.length === 1) {
    return [{ title: 'Sesión', rawText: raw }]
  }

  const blocks = []
  if (parts[0]) blocks.push({ title: 'Sesión', rawText: parts[0] })

  for (let index = 1; index < parts.length; index += 2) {
    const label = parts[index]
    const rawText = parts[index + 1]
    if (rawText) blocks.push({ title: blockTitle(label, blocks.length), rawText })
  }

  return blocks.length ? blocks : [{ title: 'Sesión', rawText: raw }]
}

export function projectImportedSessionForCoach(session) {
  return {
    id: session.sourceId,
    title: session.title,
    classType: session.classType,
    weekday: session.weekday,
    feedback: asText(session.feedback),
    blocks: splitLegacyProgrammingIntoBlocks(session.programming),
  }
}
