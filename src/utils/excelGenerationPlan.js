import { EVO_SESSION_CLASS_DEFS } from '../constants/evoClasses.js'

/** Orden fijo del JSON semanal (coincide con el prompt Excel). */
export const EXCEL_DAY_ORDER = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO']

/** Slugs sin acentos para regex. */
const DAY_SLUGS = [
  { canon: 'LUNES', slug: 'lunes' },
  { canon: 'MARTES', slug: 'martes' },
  { canon: 'MIÉRCOLES', slug: 'miercoles' },
  { canon: 'JUEVES', slug: 'jueves' },
  { canon: 'VIERNES', slug: 'viernes' },
  { canon: 'SÁBADO', slug: 'sabado' },
]

function normalizeForMatch(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export function emptyDay(nombre) {
  const o = { nombre }
  for (const { key, feedbackKey } of EVO_SESSION_CLASS_DEFS) {
    o[key] = ''
    o[feedbackKey] = ''
  }
  o.wodbuster = ''
  return o
}

export function buildWeekSkeleton(semana, mesociclo) {
  return {
    titulo: '',
    semana: semana ?? null,
    mesociclo: mesociclo ?? '',
    resumen: { estimulo: '', intensidad: '', foco: '', nota: '' },
    dias: EXCEL_DAY_ORDER.map((nombre) => emptyDay(nombre)),
  }
}

/** Días cuyo nombre aparece como palabra en el texto. */
function extractMentionedDays(normalized) {
  const found = new Set()
  for (const { canon, slug } of DAY_SLUGS) {
    const re = new RegExp(`\\b${slug}\\b`, 'i')
    if (re.test(normalized)) found.add(canon)
  }
  return found
}

/** Días que el usuario marca como ya terminados o que no deben regenerarse. */
function extractPreservedDays(normalized) {
  const preserved = new Set()
  for (const { canon, slug } of DAY_SLUGS) {
    const doneRe = new RegExp(
      `(?:\\b${slug}\\b\\s+ya\\s+(?:esta\\s+)?(?:hecho|hecha|lista|listo|completo|completa)\\b)|(?:\\b(?:ya\\s+)?(?:esta\\s+)?(?:hecho|hecha|lista)\\b\\s+(?:el\\s+)?\\b${slug}\\b)`,
      'i',
    )
    const noTouchRe = new RegExp(
      `\\bno\\s+(?:toques|generes|modifiques|regeneres|cambies)\\s+(?:el\\s+)?\\b${slug}\\b`,
      'i',
    )
    if (doneRe.test(normalized) || noTouchRe.test(normalized)) preserved.add(canon)
  }
  return preserved
}

/** Días que el usuario pide no generar. */
function extractExcludedDays(normalized) {
  const excluded = new Set()
  for (const { canon, slug } of DAY_SLUGS) {
    const re = new RegExp(`\\bno\\s+generes\\s+(?:el\\s+)?\\b${slug}\\b`, 'i')
    if (re.test(normalized)) excluded.add(canon)
  }
  return excluded
}

function hasFullWeekIntent(normalized) {
  return (
    /\b(toda la semana|semana completa|los seis dias|6 dias|seis dias)\b/i.test(normalized) ||
    /\b(de lunes a sabado|lunes a sabado|desde lunes hasta sabado)\b/i.test(normalized) ||
    /\b(todos los dias|todos los días)\b/i.test(normalized)
  )
}

/**
 * @param {string} instructions
 * @returns {{
 *   daysToGenerate: Set<string>,
 *   daysPreserved: Set<string>,
 *   daysExcluded: Set<string>,
 *   mentionedDays: Set<string>,
 *   strictSubset: boolean,
 * }}
 */
export function parseExcelGenerationPlan(instructions) {
  const normalized = normalizeForMatch(instructions)
  const mentioned = extractMentionedDays(normalized)
  const preserved = extractPreservedDays(normalized)
  const excluded = extractExcludedDays(normalized)
  const fullWeek = hasFullWeekIntent(normalized)

  const soloKeyword = /\bsolo\b|\bunicamente\b|\búnicamente\b/i.test(instructions || '')
  /** Solo aparecen días en frases tipo "no generes X" (misma lista que mentioned y excluded) → la intención es el resto de la semana, no "solo esos días". */
  const mentionedOnlyAsExcluded =
    excluded.size > 0 &&
    mentioned.size > 0 &&
    [...mentioned].every((d) => excluded.has(d))

  let baseDays
  if (fullWeek) {
    baseDays = new Set(EXCEL_DAY_ORDER)
  } else if (mentioned.size === 0 || mentionedOnlyAsExcluded) {
    baseDays = new Set(EXCEL_DAY_ORDER)
  } else if (soloKeyword) {
    baseDays = new Set(mentioned)
  } else {
    baseDays = new Set(mentioned)
  }

  const daysToGenerate = new Set(
    [...baseDays].filter((d) => !preserved.has(d) && !excluded.has(d)),
  )

  return {
    daysToGenerate,
    daysPreserved: preserved,
    daysExcluded: excluded,
    mentionedDays: mentioned,
    strictSubset: mentioned.size > 0 && !fullWeek && !mentionedOnlyAsExcluded,
  }
}

export function dayChunkForHalfWeek(dayCanon) {
  const i = EXCEL_DAY_ORDER.indexOf(dayCanon)
  if (i < 0) return null
  return i <= 2 ? 'first' : 'second'
}

/** Une respuesta parcial del modelo solo en los días permitidos; no pisa cadenas no vacías con vacío del modelo salvo que forceEmpty. */
export function mergeGeneratedDaysIntoAccumulator(accumulator, partialJson, allowedDayNames) {
  const allowed = allowedDayNames instanceof Set ? allowedDayNames : new Set(allowedDayNames)
  const partialDias = partialJson?.dias
  if (!Array.isArray(partialDias)) return accumulator

  for (let i = 0; i < EXCEL_DAY_ORDER.length; i++) {
    const name = EXCEL_DAY_ORDER[i]
    if (!allowed.has(name)) continue
    const src = partialDias[i]
    if (!src || typeof src !== 'object') continue
    const target = accumulator.dias[i] || emptyDay(name)
    const merged = { ...target }
    for (const k of Object.keys(src)) {
      if (k === 'nombre') {
        merged.nombre = src.nombre || name
        continue
      }
      const v = src[k]
      if (typeof v === 'string' && v.trim() !== '') merged[k] = v
    }
    accumulator.dias[i] = merged
  }

  if (partialJson.titulo && String(partialJson.titulo).trim()) {
    accumulator.titulo = partialJson.titulo
  }
  if (partialJson.resumen && typeof partialJson.resumen === 'object') {
    const r = partialJson.resumen
    accumulator.resumen = {
      estimulo: r.estimulo ?? accumulator.resumen.estimulo ?? '',
      intensidad: r.intensidad ?? accumulator.resumen.intensidad ?? '',
      foco: r.foco ?? accumulator.resumen.foco ?? '',
      nota: r.nota ?? accumulator.resumen.nota ?? '',
    }
    for (const key of Object.keys(r)) {
      if (r[key] != null && String(r[key]).trim() !== '') {
        accumulator.resumen[key] = r[key]
      }
    }
  }

  return accumulator
}

/**
 * Copia al acumulador solo los días marcados como preservados (p. ej. "lunes ya hecho")
 * desde la semana activa en Supabase, si existe coincidencia por nombre.
 */
export function applyPreservedFromOverlay(accumulator, overlayWeekData, preservedDayNames) {
  const pres = preservedDayNames instanceof Set ? preservedDayNames : new Set(preservedDayNames)
  if (!pres.size || !overlayWeekData?.dias || !Array.isArray(overlayWeekData.dias)) return accumulator

  for (const canon of pres) {
    const i = EXCEL_DAY_ORDER.indexOf(canon)
    if (i < 0) continue
    const match = overlayWeekData.dias.find(
      (d) => normalizeForMatch(d?.nombre || '') === normalizeForMatch(canon),
    )
    if (match) accumulator.dias[i] = { ...emptyDay(canon), ...match, nombre: canon }
  }
  return accumulator
}
