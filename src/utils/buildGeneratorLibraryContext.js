/**
 * Texto para anexar al system prompt del generador (chat + Excel).
 * `rows` = filas activas de getCoachExerciseLibrary().
 */

export const GENERATOR_CATEGORY_LABELS = {
  bisagra: 'Bisagra',
  squat: 'Squat',
  empuje_horizontal: 'Empuje horizontal',
  empuje_vertical: 'Empuje vertical',
  jalon: 'Jalón / tirón',
  rotacion: 'Rotación',
  metabolico: 'Metabólico',
  core: 'Core',
  olimpico: 'Olímpico',
  landmine: 'Landmine',
}

export const GENERATOR_LEVEL_LABELS = {
  basico: 'básico',
  intermedio: 'intermedio',
  avanzado: 'avanzado',
}

export const GENERATOR_CLASS_LABELS = {
  evofuncional: 'EvoFuncional',
  evobasics: 'EvoBasics',
  evofit: 'EvoFit',
  evohybrix: 'EvoHybrix',
  evofuerza: 'EvoFuerza',
  evogimnastica: 'EvoGimnástica',
  evotodos: 'EvoTodos',
}

/**
 * @param {Array<{ name: string, category?: string, classes?: string[], level?: string, notes?: string | null, is_new?: boolean, video_url?: string | null }>} rows
 * @returns {string}
 */
export function buildGeneratorLibraryBlock(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return ''

  const byCat = new Map()
  for (const r of rows) {
    const cat = r.category || 'otro'
    if (!byCat.has(cat)) byCat.set(cat, [])
    byCat.get(cat).push(r)
  }

  const lines = [
    '════════════════════════════════════════',
    'BIBLIOTECA OFICIAL DE EJERCICIOS EVO (Documento Maestro — Supabase)',
    '════════════════════════════════════════',
    'Al nombrar ejercicios en la programación, USA EXACTAMENTE el nombre oficial de la lista cuando exista coincidencia.',
    'Puedes combinar con variaciones claras (carga, %RM, equipamiento) pero el nombre base debe alinearse con la biblioteca.',
    'Si necesitas un movimiento que no está en la lista, descríbelo con claridad; la head coach puede añadirlo después a la biblioteca.',
    '',
  ]

  const sortedCats = [...byCat.keys()].sort((a, b) => String(a).localeCompare(String(b)))
  for (const cat of sortedCats) {
    const label = GENERATOR_CATEGORY_LABELS[cat] || cat
    lines.push(`── ${label} ──`)
    const items = byCat.get(cat) || []
    items.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    for (const r of items) {
      const cls = (r.classes || []).map((k) => GENERATOR_CLASS_LABELS[k] || k).join(', ')
      const lv = GENERATOR_LEVEL_LABELS[r.level] || r.level || ''
      const nu = r.is_new ? ' [NUEVO]' : ''
      const note = r.notes?.trim() ? ` — ${String(r.notes).trim().slice(0, 120)}${String(r.notes).length > 120 ? '…' : ''}` : ''
      const vid = r.video_url?.trim() ? ` | vídeo: ${r.video_url.trim()}` : ''
      lines.push(`• ${r.name}${nu} (${lv}; clases: ${cls || '—'})${note}${vid}`)
    }
    lines.push('')
  }

  return lines.join('\n').trimEnd()
}
