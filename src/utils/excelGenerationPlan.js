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

const SLUG_TO_CANON = Object.fromEntries(DAY_SLUGS.map(({ canon, slug }) => [slug, canon]))

const DAY_INDEX = Object.fromEntries(EXCEL_DAY_ORDER.map((d, i) => [d, i]))

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

/**
 * Rangos tipo "lunes a miércoles", "de lunes a viernes", "entre martes y jueves"
 * (incluye todos los días entre extremos en orden de semana).
 */
function extractDaysFromRangePhrases(normalized) {
  const found = new Set()
  const re =
    /\b(?:de\s+|entre\s+)?(lunes|martes|miercoles|jueves|viernes|sabado)\s+(?:a|hasta|al|y)\s+(lunes|martes|miercoles|jueves|viernes|sabado)\b/gi
  let m
  while ((m = re.exec(normalized)) !== null) {
    const a = SLUG_TO_CANON[m[1].toLowerCase()]
    const b = SLUG_TO_CANON[m[2].toLowerCase()]
    if (!a || !b) continue
    let i0 = DAY_INDEX[a]
    let i1 = DAY_INDEX[b]
    if (i0 === undefined || i1 === undefined) continue
    if (i0 > i1) [i0, i1] = [i1, i0]
    for (let i = i0; i <= i1; i++) found.add(EXCEL_DAY_ORDER[i])
  }
  return found
}

/** "primeros N días", "primera mitad de la semana", etc. */
function extractDaysFromWeekPartPhrases(normalized) {
  const found = new Set()
  if (/\bsegunda\s+mitad\s+(?:de\s+la\s+)?semana\b/i.test(normalized)) {
    ;['JUEVES', 'VIERNES', 'SÁBADO'].forEach((d) => found.add(d))
    return found
  }
  if (/\bprimera\s+mitad\s+(?:de\s+la\s+)?semana\b/i.test(normalized)) {
    ;['LUNES', 'MARTES', 'MIÉRCOLES'].forEach((d) => found.add(d))
    return found
  }

  const nDayPatterns = [
    [/\b(?:solo\s+)?(?:los\s+)?(?:primeros?|primer)\s+2\s+d[ií]as\b/i, 2],
    [/\b(?:dos|2)\s+primeros?\s+d[ií]as\b/i, 2],
    [/\b(?:solo\s+)?(?:los\s+)?(?:primeros?|primer)\s+3\s+d[ií]as\b/i, 3],
    [/\b(?:tres|3)\s+primeros?\s+d[ií]as\b/i, 3],
    [/\b(?:solo\s+)?(?:los\s+)?(?:primeros?|primer)\s+4\s+d[ií]as\b/i, 4],
    [/\b(?:cuatro|4)\s+primeros?\s+d[ií]as\b/i, 4],
    [/\b(?:solo\s+)?(?:los\s+)?(?:primeros?|primer)\s+5\s+d[ií]as\b/i, 5],
    [/\b(?:cinco|5)\s+primeros?\s+d[ií]as\b/i, 5],
  ]
  for (const [re, n] of nDayPatterns) {
    if (re.test(normalized)) {
      for (let i = 0; i < n && i < EXCEL_DAY_ORDER.length; i++) found.add(EXCEL_DAY_ORDER[i])
      return found
    }
  }
  return found
}

/** Unión de todas las señales de días citados (palabras sueltas + rangos + mitad de semana). */
function collectAllMentionedDayTokens(normalized) {
  const fromWords = extractMentionedDays(normalized)
  const fromRanges = extractDaysFromRangePhrases(normalized)
  const fromPart = extractDaysFromWeekPartPhrases(normalized)
  return new Set([...fromWords, ...fromRanges, ...fromPart])
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
    /\b(toda la semana|semana completa|los seis dias|los 6 dias|6 dias|seis dias)\b/i.test(
      normalized,
    ) ||
    /\b(de lunes a sabado|lunes a sabado|desde lunes hasta sabado|lunes al sabado)\b/i.test(
      normalized,
    ) ||
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
/**
 * @param {string} instructions Texto donde el usuario describe la semana (conviven instrucciones + contexto subido).
 */
export function parseExcelGenerationPlan(instructions) {
  const normalized = normalizeForMatch(instructions)
  const mentioned = collectAllMentionedDayTokens(normalized)
  const preserved = extractPreservedDays(normalized)
  const excluded = extractExcludedDays(normalized)
  const fullWeek = hasFullWeekIntent(normalized)

  /** Solo aparecen días en frases tipo "no generes X" → intención: el resto de la semana, no "solo esos días". */
  const mentionedOnlyAsExcluded =
    excluded.size > 0 &&
    mentioned.size > 0 &&
    [...mentioned].every((d) => excluded.has(d))

  /**
   * Subconjunto explícito: hay al menos un día citado y no se pide semana completa.
   * Si no hay ninguna mención (ni rango ni "primeros N días"), se asume semana completa salvo exclusiones.
   */
  let baseDays
  if (fullWeek) {
    baseDays = new Set(EXCEL_DAY_ORDER)
  } else if (mentioned.size === 0 || mentionedOnlyAsExcluded) {
    baseDays = new Set(EXCEL_DAY_ORDER)
  } else {
    baseDays = new Set(mentioned)
  }

  const daysToGenerate = new Set(
    [...baseDays].filter((d) => !preserved.has(d) && !excluded.has(d)),
  )

  const strictSubset =
    mentioned.size > 0 && mentioned.size < EXCEL_DAY_ORDER.length && !fullWeek && !mentionedOnlyAsExcluded

  return {
    daysToGenerate,
    daysPreserved: preserved,
    daysExcluded: excluded,
    mentionedDays: mentioned,
    strictSubset,
  }
}

/**
 * Reglas solo desde texto (preservados / excluidos). El selector visual de días manda en qué días hay programa.
 */
export function parseExcelDayRulesFromText(instructions) {
  const normalized = normalizeForMatch(instructions || '')
  return {
    daysPreserved: extractPreservedDays(normalized),
    daysExcluded: extractExcludedDays(normalized),
  }
}

/**
 * Días que la IA debe rellenar: marcados en UI ∩ ¬preservados ∩ ¬excluidos (texto).
 * @param {Set<string>|string[]} selectedCanon — subconjunto de EXCEL_DAY_ORDER
 * @param {string} instructionsAndContext — instrucciones + contexto para "ya hecho" / no generes
 */
export function resolveDaysToGenerateFromSelection(selectedCanon, instructionsAndContext) {
  const selected = selectedCanon instanceof Set ? selectedCanon : new Set(selectedCanon)
  const { daysPreserved, daysExcluded } = parseExcelDayRulesFromText(instructionsAndContext)
  // El selector de días manda: no quitamos días por «no generes X» en el texto (evita falsos
  // positivos cuando el contexto menciona jueves u otros días). Para no generar un día: desmárcalo.
  const daysToGenerate = new Set(
    [...selected].filter((d) => EXCEL_DAY_ORDER.includes(d) && !daysPreserved.has(d)),
  )

  const desdeSelector = EXCEL_DAY_ORDER.filter((d) => selected.has(d))
  const decisiónFinal = EXCEL_DAY_ORDER.filter((d) => daysToGenerate.has(d))
  console.log('[ProgramingEvo][Excel plan] resolveDaysToGenerateFromSelection', {
    desdeSelectorOrdenLunesASab: desdeSelector,
    preservadosDelTexto: [...daysPreserved].sort(),
    excluidosDetectadosEnTexto_noAfectanSelector: [...daysExcluded].sort(),
    diasQueSeMandaranALaIA: decisiónFinal,
    juevesEnSelector: selected.has('JUEVES'),
    juevesPreservadoPorTexto: daysPreserved.has('JUEVES'),
    juevesEnDiasToGenerate: daysToGenerate.has('JUEVES'),
  })

  return { daysToGenerate, daysPreserved, daysExcluded, selectedDays: selected }
}

/** Clase no impartida esta semana (día laborable, sin cierre festivo). */
export const NO_PROGRAMADA_SESSION_LINE = '(no programada esta semana)'

/** Cierre real del gimnasio / festivo (solo cuando aplique explícitamente). */
export const FESTIVO_SESSION_LINE =
  'FESTIVO — Sin sesión en este día (no incluido en esta generación).'

/**
 * Rellena días no generados ni preservados con «no programada»; no usar FESTIVO salvo cierre festivo real.
 */
export function applyFestivoToNonGeneratedDays(accumulator, daysToGenerate, daysPreserved) {
  const gen = daysToGenerate instanceof Set ? daysToGenerate : new Set(daysToGenerate)
  const pres = daysPreserved instanceof Set ? daysPreserved : new Set(daysPreserved)
  if (!accumulator?.dias?.length) return accumulator

  for (let i = 0; i < EXCEL_DAY_ORDER.length; i++) {
    const name = EXCEL_DAY_ORDER[i]
    if (gen.has(name) || pres.has(name)) continue
    const base = accumulator.dias[i] && typeof accumulator.dias[i] === 'object' ? accumulator.dias[i] : {}
    const row = { ...emptyDay(name), ...base, nombre: name }
    for (const { key, feedbackKey } of EVO_SESSION_CLASS_DEFS) {
      row[key] = NO_PROGRAMADA_SESSION_LINE
      row[feedbackKey] = ''
    }
    row.wodbuster = ''
    accumulator.dias[i] = row
  }
  return accumulator
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
      if (k === 'wodbuster' && typeof v === 'string') {
        merged[k] = v
        continue
      }
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
