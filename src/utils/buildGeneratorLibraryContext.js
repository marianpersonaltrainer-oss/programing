/**
 * Texto para anexar al system prompt del generador (chat + Excel).
 * `rows` = filas activas de getCoachExerciseLibrary().
 */

import { getTrustedLibraryVideoUrl } from './coachLibraryVideoMatch.js'

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
 * @param {Array<{ name: string, category?: string, classes?: string[], level?: string, notes?: string | null, is_new?: boolean, video_url?: string | null, video_url_verified?: boolean }>} rows
 * @param {Map<string, string> | null} [autoVideoByName] URLs ya resueltas (mapa estático o búsqueda + oembed en servidor) por nombre de ejercicio
 * @param {{ maxExercises?: number }} [options] tope de ejercicios listados (reduce tokens en generación)
 * @returns {string}
 */
export function buildGeneratorLibraryBlock(rows, autoVideoByName = null, options = {}) {
  const maxExercises =
    typeof options.maxExercises === 'number' && options.maxExercises > 0
      ? Math.floor(options.maxExercises)
      : Infinity
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
    'Cuando aparezca «vídeo (automático, comprobado)», el enlace ha sido validado en servidor (YouTube oembed); puedes citarlo tal cual en respuestas.',
    '',
  ]

  const sortedCats = [...byCat.keys()].sort((a, b) => String(a).localeCompare(String(b)))
  let listed = 0
  for (const cat of sortedCats) {
    if (listed >= maxExercises) break
    const label = GENERATOR_CATEGORY_LABELS[cat] || cat
    lines.push(`── ${label} ──`)
    const items = byCat.get(cat) || []
    items.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    for (const r of items) {
      if (listed >= maxExercises) break
      const cls = (r.classes || []).map((k) => GENERATOR_CLASS_LABELS[k] || k).join(', ')
      const lv = GENERATOR_LEVEL_LABELS[r.level] || r.level || ''
      const nu = r.is_new ? ' [NUEVO]' : ''
      const note = r.notes?.trim() ? ` — ${String(r.notes).trim().slice(0, 120)}${String(r.notes).length > 120 ? '…' : ''}` : ''
      const trustedVid = getTrustedLibraryVideoUrl(r)
      const nameKey = String(r.name || '').trim()
      const autoVid =
        !trustedVid && autoVideoByName && typeof autoVideoByName.get === 'function'
          ? autoVideoByName.get(nameKey)
          : null
      const vid = trustedVid
        ? ` | vídeo: ${trustedVid}`
        : autoVid
          ? ` | vídeo (automático, comprobado): ${autoVid}`
          : ''
      lines.push(`• ${r.name}${nu} (${lv}; clases: ${cls || '—'})${note}${vid}`)
      listed += 1
    }
    lines.push('')
  }
  if (listed < rows.length && Number.isFinite(maxExercises)) {
    lines.push(`[…${rows.length - listed} ejercicios más en Supabase; usa nombres alineados con la biblioteca.]`)
  }

  return lines.join('\n').trimEnd()
}
