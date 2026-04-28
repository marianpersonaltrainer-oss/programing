function countMatches(text, regex) {
  const m = String(text || '').match(regex)
  return m ? m.length : 0
}

function topItems(items, max = 5) {
  return items
    .filter((it) => it.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, max)
}

/**
 * Convierte histórico importado (Drive + contexto añadido) en reglas prácticas
 * que se anexan al system del generador.
 * No sustituye al método base: aporta "aprendizaje" compacto y vivo.
 */
export function buildInferredMethodFromReference(referenceText) {
  const t = String(referenceText || '').toLowerCase()
  if (!t.trim()) return ''

  const formatSignals = topItems(
    [
      { label: 'EMOM / intervalos estructurados', count: countMatches(t, /\bemom\b/g) + countMatches(t, /\be\d:\d+\b/g) },
      { label: 'AMRAP', count: countMatches(t, /\bamrap\b/g) },
      { label: 'FOR TIME / chipper', count: countMatches(t, /\bfor time\b/g) + countMatches(t, /\bchipper\b/g) },
      { label: 'Trabajo por parejas/equipos', count: countMatches(t, /\bparejas?\b/g) + countMatches(t, /\bequipos?\b/g) },
      { label: 'Wave / ondas', count: countMatches(t, /\bwave\b/g) + countMatches(t, /\bondas?\b/g) },
    ],
    3,
  )

  const movementSignals = topItems(
    [
      { label: 'Tracción y dominadas/anillas', count: countMatches(t, /\bdominad|\bpull[- ]?up|\bring\b/g) },
      { label: 'Bisagra posterior (deadlift/RDL/swing)', count: countMatches(t, /\bdeadlift|\brdl\b|\bswing\b/g) },
      { label: 'Sentadilla/pierna', count: countMatches(t, /\bsquat|\bsentadilla|\blunge\b/g) },
      { label: 'Empuje (press/push)', count: countMatches(t, /\bpress\b|\bpush\b/g) },
      { label: 'Landmine (LM)', count: countMatches(t, /\blandmine\b|\blm\b/g) },
    ],
    4,
  )

  const hasPercentProgression = /@\s?\d{2,3}%|\b\d{2,3}%\b/g.test(t)
  const hasAscendingLoads = /\bsubir\b|\bascenden|\bprogres/i.test(t)

  const lines = [
    'REGLAS INFERIDAS AUTOMÁTICAMENTE DESDE HISTÓRICO (DRIVE + SUBIDAS RECIENTES):',
    '- Usa estas señales como aprendizaje de estilo real del centro. Si chocan con método fijo o mesociclo activo, prioriza método/mesociclo.',
  ]

  if (formatSignals.length) {
    lines.push(`- Formatos recurrentes detectados: ${formatSignals.map((s) => `${s.label} (${s.count})`).join(' · ')}`)
  }
  if (movementSignals.length) {
    lines.push(`- Patrones de movimiento más presentes: ${movementSignals.map((s) => `${s.label} (${s.count})`).join(' · ')}`)
  }
  if (hasPercentProgression || hasAscendingLoads) {
    lines.push(
      '- Se detectan progresiones de carga/volumen en el histórico: mantén progresión semanal explícita y evita sesiones aisladas sin continuidad.',
    )
  }

  lines.push(
    '- Regla de diseño semanal: prioriza variedad de variantes en básicos (sentadilla, bisagra, empuje, tracción y core). LM es opcional; úsalo solo cuando mejore la sesión.',
  )
  lines.push(
    '- Matriz operativa sugerida: mínimo 2 días skill + 2 días fuerza estructural (si se generan 4+ días), sin dominantes pesados consecutivos y con al menos 3 formatos de trabajo en la semana.',
  )

  return lines.join('\n')
}
