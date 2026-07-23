import { METHOD_EVO_V1 } from '../methodEvoV1.js'
import { validateEvoBasicsRotation } from '../evoBasicsSkills.js'
import { validateDailyEquipmentSimultaneity } from '../evoInventory.js'
import { detectIntervalStructure } from './evoIntervalDetection.js'
import { validateWeeklyVariety } from './validateEvoWeekVariety.js'
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

function normalizeDay(value) {
  return (
    DAY_ALIASES[
      String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    ] || String(value || '').trim().toLowerCase()
  )
}

function isPlaceholder(value) {
  const text = String(value || '').trim()
  return !text || /^\(no programada esta semana\)$/i.test(text)
}

function isFestivo(value) {
  return /^FESTIVO\b/i.test(String(value || '').trim())
}

function containsAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(String(text || '')))
}

function validateOfferCompleteness(week, offer, errors) {
  if (!offer || typeof offer !== 'object') return

  for (const [, , className] of CLASS_FIELDS) {
    const offeredDays = offer[className]
    if (!Array.isArray(offeredDays) || offeredDays.length === 0) continue

    for (const offeredDay of offeredDays) {
      const dayName = normalizeDay(offeredDay)
      const dayIndex = (week?.dias || []).findIndex((day) => normalizeDay(day?.nombre) === dayName)
      if (dayIndex < 0) {
        errors.push({
          code: 'VAL-OFFER-003',
          severity: 'error',
          message: `${className} está en la oferta del ${dayName || offeredDay} pero falta ese día en la semana.`,
        })
        continue
      }

      const sessionKey = CLASS_FIELDS.find(([, , name]) => name === className)?.[0]
      const session = String(week.dias[dayIndex]?.[sessionKey] || '').trim()
      if (isPlaceholder(session) && !isFestivo(session)) {
        errors.push({
          code: 'VAL-OFFER-003',
          severity: 'error',
          dayIndex,
          classKey: sessionKey,
          message: `${className} está ofertada el ${dayName} pero no tiene sesión generada.`,
        })
      }
    }
  }
}

function validateAuthorizedFestivo(day, dayIndex, sessionKey, className, session, options, errors) {
  if (!isFestivo(session)) return
  const dayName = normalizeDay(day?.nombre)
  const authorized = (options.authorizedFestivoDays || []).map(normalizeDay)
  if (!authorized.includes(dayName)) {
    errors.push({
      code: 'VAL-FESTIVO-001',
      severity: 'error',
      dayIndex,
      classKey: sessionKey,
      message: `${className} marca FESTIVO el ${dayName} sin indicación explícita del calendario o del usuario. Usa «(no programada esta semana)» si no corresponde generar.`,
    })
  }
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

function promoteMaterialConflicts(entries) {
  const promoted = []
  for (const entry of entries) {
    const machineConflict = /\b(rowerg|skierg|bike)\b/i.test(entry.message)
    const sledConflict = /\btrineos?\b/i.test(entry.message)
    promoted.push({
      ...entry,
      severity: machineConflict || sledConflict ? 'error' : entry.severity,
      code: machineConflict || sledConflict ? 'VAL-MATERIAL-001' : entry.code,
    })
  }
  return promoted
}

/** Validación determinista previa a publicación. */
export function validateEvoWeek(week, options = {}) {
  const errors = []
  const warnings = []
  const offer = options.offer || METHOD_EVO_V1.current_context.offer
  const varietyEntries = []
  const intervalSignatures = new Map()

  for (const [dayIndex, day] of (week?.dias || []).entries()) {
    const dayName = normalizeDay(day?.nombre)
    const resourceSessions = []

    for (const [sessionKey, feedbackKey, className] of CLASS_FIELDS) {
      const session = String(day?.[sessionKey] || '')
      const feedback = String(day?.[feedbackKey] || '').trim()
      const placeholder = isPlaceholder(session)
      const festivo = isFestivo(session)
      const offeredDays = offer?.[className]

      validateAuthorizedFestivo(day, dayIndex, sessionKey, className, session, options, errors)

      if (Array.isArray(offeredDays) && !placeholder && !festivo && !offeredDays.map(normalizeDay).includes(dayName)) {
        errors.push({
          code: 'VAL-OFFER-001',
          severity: 'error',
          dayIndex,
          classKey: sessionKey,
          message: `${className} no está ofertada el ${dayName || 'día indicado'}.`,
        })
      }
      if ((placeholder || festivo) && feedback) {
        errors.push({
          code: 'VAL-OFFER-002',
          severity: 'error',
          dayIndex,
          classKey: sessionKey,
          message: `${className} no tiene sesión pero sí feedback.`,
        })
      }
      if (placeholder || festivo) continue

      resourceSessions.push({ classKey: sessionKey, className, session })
      varietyEntries.push({ dayName, classKey: sessionKey, className, session })

      const result = validateEvoSessionContract(session, {
        classKey: sessionKey,
        mesocycle: week?.mesociclo,
        mesocycleWeek: week?.semana,
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

      const interval = detectIntervalStructure(session)
      if (interval.isInterval && interval.signature) {
        const entries = intervalSignatures.get(interval.signature) || []
        entries.push({ dayName, className })
        intervalSignatures.set(interval.signature, entries)
      }
    }

    for (const entry of promoteMaterialConflicts(validateDailyEquipmentSimultaneity(resourceSessions))) {
      const target = entry.severity === 'error' ? errors : warnings
      target.push({ ...entry, dayIndex, classKey: 'material' })
    }
  }

  errors.push(...validateEvoBasicsRotation(week))

  const variety = validateWeeklyVariety(varietyEntries, options)
  errors.push(...variety.errors)
  warnings.push(...variety.warnings)

  for (const [signature, days] of intervalSignatures.entries()) {
    if (days.length < 2) continue
    errors.push({
      code: 'VAL-VARIETY-002',
      severity: 'error',
      message: `Se repite la relación de intervalos ${signature.replace('+', "' trabajo / ")}' descanso en ${days.map((d) => `${d.className} (${d.dayName})`).join(' y ')}.`,
    })
  }

  if (options.validateOfferCompleteness !== false) {
    validateOfferCompleteness(week, offer, errors)
  }

  return { valid: errors.length === 0, errors, warnings }
}
