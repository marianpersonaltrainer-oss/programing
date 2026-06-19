const CATEGORY_TO_PATTERN = {
  squat: 'squat',
  Squat: 'squat',
  bisagra: 'hinge',
  Bisagra: 'hinge',
  empuje_vertical: 'pushV',
  'Empuje vertical': 'pushV',
  empuje_horizontal: 'pushH',
  'Empuje horizontal': 'pushH',
  jalon: 'pull',
  'Jalón / tirón': 'pull',
  core: 'core',
  Core: 'core',
  metabolico: 'metabólico',
  Metabólico: 'metabólico',
  landmine: 'landmine',
  Landmine: 'landmine',
  olimpico: 'olímpico',
  Olímpico: 'olímpico',
  rotacion: 'rotación',
  Rotación: 'rotación',
}

let exerciseLibraryRowsCache = []

export function setExerciseLibraryRowsCache(rows) {
  exerciseLibraryRowsCache = Array.isArray(rows) ? rows : []
}

export function getExerciseLibraryRowsCache() {
  return exerciseLibraryRowsCache
}

function categoryToPattern(category) {
  const key = String(category || '').trim()
  return CATEGORY_TO_PATTERN[key] || null
}

/**
 * @param {string} sessionText
 * @param {object[]} exerciseLibraryRows — filas con `name`/`nombre` y `category`/`categoria`
 * @returns {{ exercises: string[], patterns: string[], dominantPattern: string }}
 */
export function extractPatternFromSession(sessionText, exerciseLibraryRows) {
  const text = String(sessionText || '').toLowerCase()
  const exercises = []
  const patternCounts = new Map()

  const rows = [...(exerciseLibraryRows || [])].sort(
    (a, b) => String(b?.name || b?.nombre || '').length - String(a?.name || a?.nombre || '').length,
  )

  for (const row of rows) {
    const name = String(row?.name || row?.nombre || '').trim()
    if (!name || name.length < 2) continue
    if (!text.includes(name.toLowerCase())) continue

    exercises.push(name)
    const pattern = categoryToPattern(row?.category || row?.categoria)
    if (pattern) {
      patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1)
    }
  }

  const patterns = [...new Set([...patternCounts.keys()])]

  let dominantPattern = ''
  let maxCount = 0
  for (const [pattern, count] of patternCounts) {
    if (count > maxCount) {
      maxCount = count
      dominantPattern = pattern
    }
  }

  return { exercises, patterns, dominantPattern }
}
