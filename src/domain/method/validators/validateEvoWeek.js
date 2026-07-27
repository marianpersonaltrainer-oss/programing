import { METHOD_EVO_V1 } from '../methodEvoV1.js'
import { validateEvoBasicsRotation } from '../evoBasicsSkills.js'
import { validateDailyEquipmentSimultaneity } from '../evoInventory.js'
import {
  buildEvoSessionArchitecture,
  extractEvoWorkRestPairs,
  hasEvoOlympicFamily,
  isEvoMetabolicIntervalSession,
} from './evoQualitySignals.js'
import { validateEvoSessionContract } from './validateEvoSession.js'

const CLASS_FIELDS = [
  ['evofuncional', 'feedback_funcional', 'EvoFuncional'],
  ['evobasics', 'feedback_basics', 'EvoBasics'],
  ['evofit', 'feedback_fit', 'EvoFit'],
  ['evohybrix', 'feedback_hybrix', 'EvoHybrix'],
  ['evofuerza', 'feedback_fuerza', 'EvoFuerza'],
  ['evogimnastica', 'feedback_gimnastica', 'EvoGimnástica'],
  ['evotodos', 'feedback_evotodos', 'EvoTodos'],
]

const DAY_ALIASES = {
  lunes: 'lunes',
  martes: 'martes',
  miercoles: 'miércoles',
  miércoles: 'miércoles',
  jueves: 'jueves',
  viernes: 'viernes',
  sabado: 'sábado',
  sábado: 'sábado',
  domingo: 'domingo',
}
const DAY_ORDINAL = {
  lunes: 0,
  martes: 1,
  miércoles: 2,
  jueves: 3,
  viernes: 4,
  sábado: 5,
  domingo: 6,
}

function normalizeDay(value) {
  return DAY_ALIASES[
    String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  ] || String(value || '').trim().toLowerCase()
}

function isPlaceholder(value) {
  const text = String(value || '').trim()
  return !text || /^\(no programada esta semana\)$/i.test(text) || /^FESTIVO$/i.test(text)
}

function isHoliday(value) {
  return /^FESTIVO$/i.test(String(value || '').trim())
}

function containsAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(String(text || '')))
}

/**
 * Chequeos de coherencia de alta confianza. No pretende resolver todavía la
 * correspondencia semántica completa de todos los ejercicios.
 */
function validateFeedbackAgainstSession(session, feedback) {
  const errors = []
  const warnings = []
  const pairs = [
    {
      label: 'parejas o relevos',
      severity: 'error',
      feedback: [/\bparejas?\b/i, /\brelevos?\b/i, /\bIGYG\b/i, /\bcompañer[oa]\b/i],
      session: [/\bparejas?\b/i, /\brelevos?\b/i, /\bIGYG\b/i, /\bcompañer[oa]\b/i],
    },
    {
      label: 'carrera',
      severity: 'error',
      feedback: [/\bcorr(?:e|en|er|iendo)\b/i, /\brunning\b/i],
      session: [/\bcarrer[ao]\b/i, /\bcorrer\b/i, /\brun\b/i],
    },
    {
      label: 'estaciones',
      severity: 'warning',
      feedback: [/\bestaci[oó]n(?:es)?\b/i],
      session: [/\bestaci[oó]n(?:es)?\b/i],
    },
    {
      label: 'RowErg',
      severity: 'error',
      feedback: [/\bRowErg\b/i],
      session: [/\bRowErg\b/i],
    },
    {
      label: 'SkiErg',
      severity: 'error',
      feedback: [/\bSkiErg\b/i],
      session: [/\bSkiErg\b/i],
    },
    {
      label: 'trineo',
      severity: 'error',
      feedback: [/\btrineos?\b/i, /\bsled\b/i],
      session: [/\btrineos?\b/i, /\bsled\b/i],
    },
  ]

  for (const entity of pairs) {
    if (containsAny(feedback, entity.feedback) && !containsAny(session, entity.session)) {
      const target = entity.severity === 'warning' ? warnings : errors
      target.push({
        code: 'VAL-FEEDBACK-001',
        severity: entity.severity,
        message: `El feedback menciona ${entity.label}, pero no aparece en la sesión.`,
      })
    }
  }

  if (
    containsAny(feedback, [/\bRM\b/i]) &&
    containsAny(feedback, [/\banot/i, /\bapunt/i, /\bregistr/i, /\bnuevo\b/i]) &&
    !containsAny(session, [/\bTEST\b/i, /\bPRUEBA\b/i, /\bRETEST\b/i, /\bRE-TEST\b/i])
  ) {
    errors.push({
      code: 'VAL-RECORD-001',
      severity: 'error',
      message: 'El feedback solo puede pedir registrar RM cuando la sesión contiene un test real.',
    })
  }

  return { errors, warnings }
}

function strengthPrescription(text) {
  const value = String(text || '')
  const setRepMatch = value.match(/\b(\d{1,2})\s*[x×]\s*(\d{1,2})\b/i)
  const percentages = [...value.matchAll(/(?:@|al\s+)?(\d{2,3}(?:[.,]\d+)?)\s*%\s*(?:RM)?/gi)]
    .map((match) => Number(match[1].replace(',', '.')))
    .filter(Number.isFinite)
  const rirMatch = value.match(/\bRIR\s*([0-5](?:[.,]\d+)?)\b/i)
  const tempoMatch = value.match(/\btempo\s*[:=-]?\s*(\d{3,4})\b/i)
  return {
    sets: setRepMatch ? Number(setRepMatch[1]) : null,
    reps: setRepMatch ? Number(setRepMatch[2]) : null,
    percentage: percentages.length ? Math.max(...percentages) : null,
    rir: rirMatch ? Number(rirMatch[1].replace(',', '.')) : null,
    tempo: tempoMatch?.[1] || null,
  }
}

function hasVerifiableProgression(currentText, previousText) {
  const current = strengthPrescription(currentText)
  const previous = strengthPrescription(previousText)
  const changedSharedMetric = ['sets', 'reps', 'percentage', 'rir', 'tempo'].some(
    (key) =>
      current[key] != null &&
      previous[key] != null &&
      String(current[key]) !== String(previous[key]),
  )
  if (changedSharedMetric) return true
  return (
    /\b(?:sube|aumenta|incrementa)\b[^.\n]{0,40}\b\d+(?:[.,]\d+)?\s*(?:kg|%)\b/i.test(
      String(currentText || ''),
    ) ||
    /\+\s*\d+(?:[.,]\d+)?\s*(?:kg|%)\b/i.test(String(currentText || ''))
  )
}

function normalizedSessionContent(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\d+(?:[.,:]\d+)?/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
}

function allowedHolidaySet(options) {
  const source = options.allowedHolidayDays
  if (source == null) return new Set()
  const values = source instanceof Set ? [...source] : Array.isArray(source) ? source : [source]
  return new Set(values.map(normalizeDay))
}

function requireCompleteOffer(week, offer, options) {
  if (Object.prototype.hasOwnProperty.call(options, 'requireCompleteOffer')) {
    return !!options.requireCompleteOffer
  }
  const availableDays = new Set((week?.dias || []).map((day) => normalizeDay(day?.nombre)))
  const offeredDays = new Set(
    Object.values(offer || {})
      .flatMap((days) => (Array.isArray(days) ? days : []))
      .map(normalizeDay),
  )
  return offeredDays.size > 0 && [...offeredDays].every((day) => availableDays.has(day))
}

function addWeekError(target, code, message, entry = {}) {
  target.push({
    code,
    severity: 'error',
    ...(Number.isInteger(entry.dayIndex) ? { dayIndex: entry.dayIndex } : {}),
    ...(entry.classKey ? { classKey: entry.classKey } : {}),
    message,
  })
}

function addWeekWarning(target, code, message, entry = {}) {
  target.push({
    code,
    severity: 'warning',
    ...(Number.isInteger(entry.dayIndex) ? { dayIndex: entry.dayIndex } : {}),
    ...(entry.classKey ? { classKey: entry.classKey } : {}),
    message,
  })
}

const OLYMPIC_MOVEMENT_SOURCE =
  String.raw`(?:(?:hang|power|squat|muscle|split|push|dumbbell|db|barbell)\s+)*(?:clean|snatch|jerk)s?|cargadas?|arrancadas?|enviones?|envi[oó]n`

function estimatedOlympicRepetitions(session) {
  const text = String(session || '')
  const candidates = []
  const rounds = text.match(
    new RegExp(
      `\\b(\\d{1,2})\\s*rondas?\\b[^.\\n]{0,90}?\\b(\\d{1,2})\\s+(?:${OLYMPIC_MOVEMENT_SOURCE})\\b`,
      'i',
    ),
  )
  if (rounds) candidates.push(Number(rounds[1]) * Number(rounds[2]))

  const emom = text.match(
    new RegExp(
      `\\bEMOM\\s+(\\d{1,2})\\b[^.\\n]{0,90}?\\b(\\d{1,2})\\s+(?:${OLYMPIC_MOVEMENT_SOURCE})\\b`,
      'i',
    ),
  )
  if (emom) candidates.push(Number(emom[1]) * Number(emom[2]))

  const extendedEmom = text.match(
    new RegExp(
      `\\bE(\\d{1,2})MOM\\b[^\\n]{0,50}?[—–-]\\s*(\\d{1,2})\\s*MIN\\b[\\s\\S]{0,120}?\\b(\\d{1,2})\\s+(?:${OLYMPIC_MOVEMENT_SOURCE})\\b`,
      'i',
    ),
  )
  if (extendedEmom) {
    candidates.push(
      Math.ceil(Number(extendedEmom[2]) / Number(extendedEmom[1])) *
        Number(extendedEmom[3]),
    )
  }

  const setReps = text.match(/\b(\d{1,2})\s*[x×]\s*([1-9])\b/i)
  if (setReps) candidates.push(Number(setReps[1]) * Number(setReps[2]))
  return candidates.length ? Math.max(...candidates) : null
}

function isTechnicalLowVolumeOlympicSession(session) {
  const text = String(session || '')
  const technical =
    /\b(?:T[EÉ]CNICA|DRILLS?|POSICIONES?|CALIDAD\s+T[EÉ]CNICA)\b/i.test(text)
  if (!technical) return false
  const repetitions = estimatedOlympicRepetitions(text)
  return repetitions != null && repetitions <= 18
}

function validateWeeklyClassQuality(entries, className, classKey, errors, warnings) {
  const orderedEntries = [...entries].sort((a, b) => a.dayOrdinal - b.dayOrdinal)
  const intervalEntries = orderedEntries.filter((entry) => entry.isInterval)
  if (intervalEntries.length > 2) {
    addWeekError(
      errors,
      'VAL-VARIETY-002',
      `${className} contiene intervalos metabólicos en ${intervalEntries.length} días. El máximo semanal es dos.`,
      { classKey },
    )
  }

  for (let index = 0; index < intervalEntries.length - 1; index += 1) {
    const current = intervalEntries[index]
    const next = intervalEntries[index + 1]
    if (next.dayOrdinal - current.dayOrdinal !== 1) continue
    addWeekError(
      errors,
      'VAL-VARIETY-003',
      `${className} programa intervalos metabólicos en días consecutivos (${current.dayName} y ${next.dayName}). ON/OFF, IGYG pasivo, EMOM metabólico y estaciones con recuperación también cuentan.`,
      { dayIndex: next.dayIndex, classKey },
    )
  }

  const intervalProfiles = new Map()
  for (const entry of intervalEntries) {
    const firstPair = extractEvoWorkRestPairs(entry.session)[0]
    const signature = firstPair
      ? `${firstPair.workSeconds}:${firstPair.restSeconds}`
      : entry.architecture.exact
    const values = intervalProfiles.get(signature) || []
    values.push(entry)
    intervalProfiles.set(signature, values)
  }
  for (const values of intervalProfiles.values()) {
    if (values.length < 2) continue
    addWeekError(
      errors,
      'VAL-VARIETY-004',
      `${className} repite el mismo perfil interválico en ${values.map((entry) => entry.dayName).join(' y ')}. Cambia duración, relación trabajo/descanso y dinámica.`,
      { dayIndex: values.at(-1).dayIndex, classKey },
    )
  }

  for (let index = 0; index < orderedEntries.length - 1; index += 1) {
    const current = orderedEntries[index]
    const next = orderedEntries[index + 1]
    if (next.dayOrdinal - current.dayOrdinal !== 1) continue
    const repeatsExactArchitecture =
      current.architecture.exact === next.architecture.exact &&
      (current.architecture.blockCount > 1 ||
        current.architecture.isInterval ||
        /^(?:amrap|for_time|long_task|continuous)\|/.test(current.architecture.exact))
    if (!repeatsExactArchitecture) continue
    addWeekError(
      errors,
      'VAL-ARCHITECTURE-001',
      `${className} repite la misma arquitectura completa en ${current.dayName} y ${next.dayName} (${current.architecture.exact}).`,
      { dayIndex: next.dayIndex, classKey },
    )
  }

  const skeletonEntries = new Map()
  for (const entry of orderedEntries) {
    const values = skeletonEntries.get(entry.architecture.skeleton) || []
    values.push(entry)
    skeletonEntries.set(entry.architecture.skeleton, values)
  }
  for (const [skeleton, values] of skeletonEntries.entries()) {
    const hasThreeConsecutive = values.some(
      (entry, index) =>
        index >= 2 &&
        entry.dayOrdinal - values[index - 1].dayOrdinal === 1 &&
        values[index - 1].dayOrdinal - values[index - 2].dayOrdinal === 1,
    )
    if (values.length <= 3 && !hasThreeConsecutive) continue
    addWeekError(
      errors,
      'VAL-ARCHITECTURE-002',
      `${className} repite demasiado el esqueleto ${skeleton} (${values.map((entry) => entry.dayName).join(', ')}). Usa una experiencia y una secuencia de partes distintas.`,
      { dayIndex: values.at(-1).dayIndex, classKey },
    )
  }

  const shapeEntries = new Map()
  for (const entry of orderedEntries) {
    if (!entry.architecture.shape.includes('>')) continue
    const values = shapeEntries.get(entry.architecture.shape) || []
    values.push(entry)
    shapeEntries.set(entry.architecture.shape, values)
  }
  for (const [shape, values] of shapeEntries.entries()) {
    const hasThreeConsecutive = values.some(
      (entry, index) =>
        index >= 2 &&
        entry.dayOrdinal - values[index - 1].dayOrdinal === 1 &&
        values[index - 1].dayOrdinal - values[index - 2].dayOrdinal === 1,
    )
    if (values.length <= 3 && !hasThreeConsecutive) continue
    addWeekError(
      errors,
      'VAL-ARCHITECTURE-002',
      `${className} mantiene el molde ${shape} en ${values.map((entry) => entry.dayName).join(', ')} aunque cambie el nombre del formato. Introduce al menos un día con otra arquitectura.`,
      { dayIndex: values.at(-1).dayIndex, classKey },
    )
  }

  const olympicEntries = orderedEntries.filter((entry) => entry.hasOlympicFamily)
  if (olympicEntries.length >= 3) {
    addWeekError(
      errors,
      'VAL-FATIGUE-002',
      `${className} acumula clean/snatch/jerk en ${olympicEntries.length} días (${olympicEntries.map((entry) => entry.dayName).join(', ')}). Limita la familia olímpica para proteger cadera, lumbar, agarre y hombro.`,
      { dayIndex: olympicEntries.at(-1).dayIndex, classKey },
    )
  } else if (
    olympicEntries.length === 2 &&
    olympicEntries[1].dayOrdinal - olympicEntries[0].dayOrdinal === 1
  ) {
    if (!olympicEntries.some((entry) => isTechnicalLowVolumeOlympicSession(entry.session))) {
      addWeekError(
        errors,
        'VAL-FATIGUE-002',
        `${className} coloca clean/snatch/jerk en días consecutivos sin que una exposición esté definida como técnica y de bajo volumen.`,
        { dayIndex: olympicEntries[1].dayIndex, classKey },
      )
    }
  }
}

function validateHistoricalArchitecture(week, entriesByClass, options, errors) {
  const historicalWeeks =
    options.previousWeeks || options.historyWeeks || options.historicalWeeks || []
  if (!Array.isArray(historicalWeeks) || !historicalWeeks.length) return
  const latest = [...historicalWeeks].reverse().find((entry) => Array.isArray(entry?.dias))
  if (!latest) return

  for (const [classKey, entries] of entriesByClass.entries()) {
    for (const entry of entries) {
      const previousDay = latest.dias.find((day) => normalizeDay(day?.nombre) === entry.dayName)
      const previousSession = String(previousDay?.[classKey] || '')
      if (isPlaceholder(previousSession)) continue
      const previousArchitecture = buildEvoSessionArchitecture(previousSession)
      if (previousArchitecture.exact !== entry.architecture.exact) continue
      const sameKnownPattern =
        entry.architecture.pattern !== 'other' &&
        previousArchitecture.pattern === entry.architecture.pattern
      const sameUnknownContent =
        entry.architecture.pattern === 'other' &&
        previousArchitecture.pattern === 'other' &&
        normalizedSessionContent(entry.session) === normalizedSessionContent(previousSession)
      if (!sameKnownPattern && !sameUnknownContent) continue
      if (hasVerifiableProgression(entry.session, previousSession)) continue
      addWeekError(
        errors,
        'VAL-HISTORY-001',
        `${entry.className} copia en ${entry.dayName} la arquitectura exacta de la semana anterior sin una progresión verificable.`,
        { dayIndex: entry.dayIndex, classKey },
      )
    }
  }
}

/** Validación determinista mínima previa a publicación. */
export function validateEvoWeek(week, options = {}) {
  const errors = []
  const warnings = []
  const offer = options.offer || METHOD_EVO_V1.current_context.offer
  const holidays = allowedHolidaySet(options)
  const enforceCompleteOffer = requireCompleteOffer(week, offer, options)
  const entriesByClass = new Map()
  const classNamesByKey = new Map(CLASS_FIELDS.map(([classKey, , className]) => [classKey, className]))

  for (const [dayIndex, day] of (week?.dias || []).entries()) {
    const dayName = normalizeDay(day?.nombre)
    const resourceSessions = []
    const dayHolidayAuthorized = options.allowFestivo === true || holidays.has(dayName)
    const wodbuster = String(day?.wodbuster || '').trim()
    const hasRealNonHolidaySession = CLASS_FIELDS.some(([sessionKey]) => {
      const session = String(day?.[sessionKey] || '').trim()
      return !isPlaceholder(session)
    })
    if (
      /^FESTIVO\b/i.test(wodbuster) &&
      (!/^FESTIVO$/i.test(wodbuster) || !dayHolidayAuthorized || hasRealNonHolidaySession)
    ) {
      addWeekError(
        errors,
        'VAL-OFFER-003',
        hasRealNonHolidaySession
          ? `WodBuster marca FESTIVO el ${dayName}, pero el día conserva una o más sesiones reales.`
          : `WodBuster marca FESTIVO el ${dayName} sin una autorización exacta para ese día.`,
        { dayIndex, classKey: 'wodbuster' },
      )
    }
    for (const [sessionKey, feedbackKey, className] of CLASS_FIELDS) {
      const session = String(day?.[sessionKey] || '')
      const feedback = String(day?.[feedbackKey] || '').trim()
      const placeholder = isPlaceholder(session)
      const offeredDays = offer?.[className]

      const holiday = isHoliday(session)
      const holidayAuthorized = holiday && dayHolidayAuthorized
      if (holiday && !holidayAuthorized) {
        addWeekError(
          errors,
          'VAL-OFFER-003',
          `${className} aparece como FESTIVO el ${dayName}, pero ese festivo no está autorizado por la selección actual.`,
          { dayIndex, classKey: sessionKey },
        )
      }
      if (Array.isArray(offeredDays) && !placeholder && !offeredDays.map(normalizeDay).includes(dayName)) {
        errors.push({
          code: 'VAL-OFFER-001',
          severity: 'error',
          dayIndex,
          classKey: sessionKey,
          message: `${className} no está ofertada el ${dayName || 'día indicado'}.`,
        })
      }
      if (
        enforceCompleteOffer &&
        Array.isArray(offeredDays) &&
        offeredDays.map(normalizeDay).includes(dayName) &&
        placeholder &&
        !holidayAuthorized
      ) {
        addWeekError(
          errors,
          'VAL-OFFER-004',
          `${className} está ofertada el ${dayName}, pero no contiene una sesión válida.`,
          { dayIndex, classKey: sessionKey },
        )
      }
      if (placeholder && feedback) {
        errors.push({
          code: 'VAL-OFFER-002',
          severity: 'error',
          dayIndex,
          classKey: sessionKey,
          message: `${className} no tiene sesión pero sí feedback.`,
        })
      }
      if (placeholder) continue
      resourceSessions.push({
        classKey: sessionKey,
        className,
        session,
        organizationText: feedback,
      })

      const result = validateEvoSessionContract(session, {
        classKey: sessionKey,
        mesocycle: week?.mesociclo,
        mesocycleWeek: week?.semana,
        organizationText: feedback,
      })
      for (const entry of result.errors) {
        errors.push({ ...entry, dayIndex, classKey: sessionKey })
      }
      for (const entry of result.warnings) {
        warnings.push({ ...entry, dayIndex, classKey: sessionKey })
      }
      const feedbackResult = validateFeedbackAgainstSession(session, feedback)
      for (const entry of feedbackResult.errors) {
        errors.push({ ...entry, dayIndex, classKey: sessionKey })
      }
      for (const entry of feedbackResult.warnings) {
        warnings.push({ ...entry, dayIndex, classKey: sessionKey })
      }

      const entries = entriesByClass.get(sessionKey) || []
      entries.push({
        dayIndex,
        dayName,
        dayOrdinal: DAY_ORDINAL[dayName] ?? dayIndex,
        classKey: sessionKey,
        className,
        session,
        isInterval: isEvoMetabolicIntervalSession(session),
        architecture: buildEvoSessionArchitecture(session),
        hasOlympicFamily: hasEvoOlympicFamily(session),
      })
      entriesByClass.set(sessionKey, entries)
    }
    for (const entry of validateDailyEquipmentSimultaneity(resourceSessions)) {
      warnings.push({ ...entry, dayIndex, classKey: 'material' })
    }
  }

  errors.push(...validateEvoBasicsRotation(week))

  for (const [classKey, entries] of entriesByClass.entries()) {
    validateWeeklyClassQuality(
      entries,
      classNamesByKey.get(classKey) || classKey,
      classKey,
      errors,
      warnings,
    )
  }
  validateHistoricalArchitecture(week, entriesByClass, options, errors)

  return { valid: errors.length === 0, errors, warnings }
}
