import { EVO_SESSION_CLASS_DEFS } from '../constants/evoClasses.js'
import { normalizeProgrammingDate } from './programmingContextSelection.js'

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

/**
 * Extrae únicamente cierres/festivos que el programador haya escrito de forma
 * afirmativa junto al día. No convierte una ausencia de clases en FESTIVO.
 */
export function resolveExplicitHolidayDays(instructions) {
  const dayAlternation = DAY_SLUGS.map(({ slug }) => slug).join('|')
  const predicateRe =
    /\b(?:festiv[oa]s?|cierre|cerrad[oa]s?|cerramos|cerrara|cerraran)\b/i
  const uncertainRe =
    /\b(?:quiza|quizas|tal\s+vez|puede\s+que|podria|pendiente|por\s+confirmar|no\s+confirmad[oa]|por\s+decidir|aun\s+no\s+(?:se\s+)?sabe)\b/i
  const openNormallyRe =
    /\b(?:no\s+(?:es|sera|son|seran)\s+festiv[oa]s?|abrimos|abre|abierto|horario\s+normal|hay\s+clase|funciona(?:mos)?\s+normal)\b/i

  const sentences = normalizeForMatch(instructions)
    .split(/[.!?;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
  const holidays = new Set()

  for (const sentence of sentences) {
    // Separa “lunes festivo y martes abrimos” en dos predicados, pero conserva
    // listas nominales como “lunes y martes son festivos”.
    const boundaryRe = new RegExp(
      `(?:,|\\by\\b)\\s+(?=(?:el\\s+)?(?:${dayAlternation})\\b)`,
      'gi',
    )
    const clauses = []
    let start = 0
    let match
    while ((match = boundaryRe.exec(sentence)) !== null) {
      const candidate = sentence.slice(start, match.index).trim()
      const remainder = sentence.slice(match.index + match[0].length)
      const nextDayClauseHasItsOwnPredicate =
        predicateRe.test(remainder) ||
        openNormallyRe.test(remainder) ||
        uncertainRe.test(remainder)
      if (
        nextDayClauseHasItsOwnPredicate &&
        (predicateRe.test(candidate) || openNormallyRe.test(candidate))
      ) {
        if (candidate) clauses.push(candidate)
        start = match.index + match[0].length
      }
    }
    const tail = sentence.slice(start).trim()
    if (tail) clauses.push(tail)

    for (const clause of clauses) {
      if (
        !predicateRe.test(clause) ||
        uncertainRe.test(clause) ||
        openNormallyRe.test(clause)
      ) {
        continue
      }
      for (const { canon, slug } of DAY_SLUGS) {
        if (new RegExp(`\\b${slug}\\b`, 'i').test(clause)) holidays.add(canon)
      }
    }
  }
  return holidays
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
    // No incluir «generes» aquí: combinado con saltos de línea podía marcar un día como preservado
    // sin querer (p. ej. contexto largo). Para no tocar un día: «no toques / regeneres / cambies el X».
    const noTouchRe = new RegExp(
      `\\bno\\s+(?:toques|modifiques|regeneres|cambies)\\s+(?:el\\s+)?\\b${slug}\\b`,
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
  const { daysPreserved: mentionedAsPreserved, daysExcluded } =
    parseExcelDayRulesFromText(instructionsAndContext)
  // El selector visual manda de forma absoluta. El contexto puede mencionar días ya hechos,
  // comparaciones o exclusiones históricas sin cambiar accidentalmente la tanda actual.
  // Para no generar un día, Marian debe desmarcarlo.
  const daysToGenerate = new Set(
    [...selected].filter((d) => EXCEL_DAY_ORDER.includes(d)),
  )
  const daysPreserved = new Set(
    [...mentionedAsPreserved].filter((d) => EXCEL_DAY_ORDER.includes(d) && !selected.has(d)),
  )

  const desdeSelector = EXCEL_DAY_ORDER.filter((d) => selected.has(d))
  const decisiónFinal = EXCEL_DAY_ORDER.filter((d) => daysToGenerate.has(d))
  console.log('[ProgramingEvo][Excel plan] resolveDaysToGenerateFromSelection', {
    desdeSelectorOrdenLunesASab: desdeSelector,
    preservadosDelTextoFueraDelSelector: [...daysPreserved].sort(),
    excluidosDetectadosEnTexto_noAfectanSelector: [...daysExcluded].sort(),
    diasQueSeMandaranALaIA: decisiónFinal,
    juevesEnSelector: selected.has('JUEVES'),
    juevesPreservadoPorTextoFueraDelSelector: daysPreserved.has('JUEVES'),
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

/**
 * Tras generar, deja «no programada» + feedback vacío en columnas no elegidas por el usuario
 * (solo días en `daysToGenerate`).
 */
export function maskUnselectedSessionColumns(accumulator, daysToGenerate, selectedSessionKeys) {
  const sel = selectedSessionKeys instanceof Set ? selectedSessionKeys : new Set(selectedSessionKeys)
  const gen = daysToGenerate instanceof Set ? daysToGenerate : new Set(daysToGenerate)
  if (!accumulator?.dias?.length || !sel.size) return accumulator

  for (let i = 0; i < EXCEL_DAY_ORDER.length; i += 1) {
    const name = EXCEL_DAY_ORDER[i]
    if (!gen.has(name)) continue
    const row = accumulator.dias[i]
    if (!row || typeof row !== 'object') continue
    for (const { key, feedbackKey } of EVO_SESSION_CLASS_DEFS) {
      if (!sel.has(key)) {
        row[key] = NO_PROGRAMADA_SESSION_LINE
        row[feedbackKey] = ''
      }
    }
  }
  return accumulator
}

export function dayChunkForHalfWeek(dayCanon) {
  const i = EXCEL_DAY_ORDER.indexOf(dayCanon)
  if (i < 0) return null
  return i <= 2 ? 'first' : 'second'
}

/** Alinea `nombre` del JSON del modelo con LUNES…SÁBADO (acentos / mayúsculas). */
export function resolveDayCanonFromNombre(raw) {
  if (raw == null || String(raw).trim() === '') return null
  const n = normalizeForMatch(raw)
  for (const canon of EXCEL_DAY_ORDER) {
    if (normalizeForMatch(canon) === n) return canon
  }
  for (const { canon, slug } of DAY_SLUGS) {
    if (n === slug) return canon
  }
  return null
}

/**
 * El modelo a veces devuelve `dias` en orden incorrecto: fusionamos por `nombre` y
 * solo usamos índice del array como respaldo.
 */
function mapPartialDiasByCanon(partialDias, allowed) {
  const byCanon = new Map()

  for (let j = 0; j < partialDias.length; j++) {
    const item = partialDias[j]
    if (!item || typeof item !== 'object') continue
    const canon = resolveDayCanonFromNombre(item.nombre)
    if (canon && allowed.has(canon)) {
      byCanon.set(canon, item)
    }
  }

  return byCanon
}

function generatedDayDate(day) {
  return normalizeProgrammingDate(
    day?.fecha ?? day?.date ?? day?.week_start_date ?? day?.weekStartDate,
  )
}

/**
 * Impide que una respuesta tardía o mal rotulada se coloque en otro día.
 * Si la salida incluye fecha, también debe coincidir con la capturada al pedirla.
 */
export function assertGeneratedDaysMatchRequest(partialJson, allowedDayNames, expectedDatesByDay = {}) {
  const allowed = allowedDayNames instanceof Set ? allowedDayNames : new Set(allowedDayNames)
  const partialDias = partialJson?.dias
  if (!Array.isArray(partialDias)) {
    throw new Error('La respuesta no contiene el array "dias" solicitado.')
  }
  if (partialDias.length !== allowed.size) {
    throw new Error(
      `La respuesta devolvió ${partialDias.length} día(s), pero esta petición esperaba exactamente ${allowed.size}.`,
    )
  }

  const seen = new Set()
  for (const item of partialDias) {
    if (!item || typeof item !== 'object') {
      throw new Error('La respuesta contiene un día vacío o inválido.')
    }
    const canon = resolveDayCanonFromNombre(item.nombre)
    if (!canon) {
      throw new Error('La respuesta no identifica el día solicitado en "nombre".')
    }
    if (!allowed.has(canon)) {
      throw new Error(
        `La IA devolvió ${canon}, pero esta petición era para ${[...allowed].join(', ')}. Se descarta para no sobrescribir otro día.`,
      )
    }
    if (seen.has(canon)) throw new Error(`La respuesta repite ${canon}.`)
    seen.add(canon)

    const expectedDate = normalizeProgrammingDate(expectedDatesByDay?.[canon])
    const actualDate = generatedDayDate(item)
    if (expectedDate && actualDate && expectedDate !== actualDate) {
      throw new Error(
        `La IA devolvió ${canon} con fecha ${actualDate}, pero la fecha solicitada era ${expectedDate}.`,
      )
    }
  }

  for (const day of allowed) {
    if (!seen.has(day)) throw new Error(`La respuesta no contiene ${day}.`)
  }
  return true
}

/** Une respuesta parcial del modelo solo en los días permitidos; no pisa cadenas no vacías con vacío del modelo salvo que forceEmpty. */
export function mergeGeneratedDaysIntoAccumulator(
  accumulator,
  partialJson,
  allowedDayNames,
  expectedDatesByDay = {},
  {
    allowHolidayCreation = false,
    allowedHolidayDays = [],
  } = {},
) {
  const allowed = allowedDayNames instanceof Set ? allowedDayNames : new Set(allowedDayNames)
  const authorizedHolidayDays =
    allowedHolidayDays instanceof Set ? allowedHolidayDays : new Set(allowedHolidayDays)
  const partialDias = partialJson?.dias
  assertGeneratedDaysMatchRequest(partialJson, allowed, expectedDatesByDay)

  const byCanon = mapPartialDiasByCanon(partialDias, allowed)

  for (let i = 0; i < EXCEL_DAY_ORDER.length; i++) {
    const name = EXCEL_DAY_ORDER[i]
    if (!allowed.has(name)) continue
    const src = byCanon.get(name)
    if (!src || typeof src !== 'object') continue
    const target = accumulator.dias[i] || emptyDay(name)
    const merged = { ...target }
    const holidayCreationAuthorized =
      allowHolidayCreation === true && authorizedHolidayDays.has(name)
    const blockedHolidayFeedbackKeys = new Set()
    for (const { key, feedbackKey } of EVO_SESSION_CLASS_DEFS) {
      if (
        !holidayCreationAuthorized &&
        /^FESTIVO\b/i.test(String(src[key] ?? '').trim()) &&
        !/^FESTIVO\b/i.test(String(target[key] ?? '').trim())
      ) {
        blockedHolidayFeedbackKeys.add(feedbackKey)
      }
    }
    for (const k of Object.keys(src)) {
      if (k === 'nombre') {
        merged.nombre = src.nombre || name
        continue
      }
      const classDef = EVO_SESSION_CLASS_DEFS.find(({ key }) => key === k)
      if (
        !holidayCreationAuthorized &&
        classDef &&
        /^FESTIVO\b/i.test(String(src[k] ?? '').trim()) &&
        !/^FESTIVO\b/i.test(String(target[k] ?? '').trim())
      ) {
        continue
      }
      if (blockedHolidayFeedbackKeys.has(k)) continue
      const v = src[k]
      if (k === 'wodbuster' && typeof v === 'string') {
        if (!holidayCreationAuthorized && /^FESTIVO\b/i.test(v.trim())) continue
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
