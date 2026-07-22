import { METHOD_EVO_V1 } from '../methodEvoV1.js'
import { validateEvoBasicsRotation } from '../evoBasicsSkills.js'
import { validateDailyEquipmentSimultaneity } from '../evoInventory.js'
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
  return !text || /^\(no programada esta semana\)$/i.test(text) || /^FESTIVO\b/i.test(text)
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

/** Validación determinista mínima previa a publicación. */
export function validateEvoWeek(week, options = {}) {
  const errors = []
  const warnings = []
  const offer = options.offer || METHOD_EVO_V1.current_context.offer
  const functionalIntervalDays = []
  const intervalSignatures = new Map()

  for (const [dayIndex, day] of (week?.dias || []).entries()) {
    const dayName = normalizeDay(day?.nombre)
    const resourceSessions = []
    for (const [sessionKey, feedbackKey, className] of CLASS_FIELDS) {
      const session = String(day?.[sessionKey] || '')
      const feedback = String(day?.[feedbackKey] || '').trim()
      const placeholder = isPlaceholder(session)
      const offeredDays = offer?.[className]

      if (Array.isArray(offeredDays) && !placeholder && !offeredDays.map(normalizeDay).includes(dayName)) {
        errors.push({
          code: 'VAL-OFFER-001',
          severity: 'error',
          dayIndex,
          classKey: sessionKey,
          message: `${className} no está ofertada el ${dayName || 'día indicado'}.`,
        })
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
      resourceSessions.push({ classKey: sessionKey, className, session })

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

      if (sessionKey === 'evofuncional' && /\bINTERVALOS\b/i.test(session)) {
        functionalIntervalDays.push({ dayIndex, dayName })
        const signatureMatch = session.match(
          /\b(\d+)\s*rondas?[\s\S]{0,100}?(\d+(?:[.,]\d+)?)\s*['′]?\s*(?:de\s*)?trabajo\s*[/|]\s*(\d+(?:[.,]\d+)?)\s*['′]?\s*(?:de\s*)?descanso/i,
        )
        if (signatureMatch) {
          const signature = `${signatureMatch[2].replace(',', '.')}+${signatureMatch[3].replace(',', '.')}`
          const entries = intervalSignatures.get(signature) || []
          entries.push(dayName)
          intervalSignatures.set(signature, entries)
        }
      }
    }
    for (const entry of validateDailyEquipmentSimultaneity(resourceSessions)) {
      warnings.push({ ...entry, dayIndex, classKey: 'material' })
    }
  }

  errors.push(...validateEvoBasicsRotation(week))

  if (functionalIntervalDays.length >= 4) {
    errors.push({
      code: 'VAL-VARIETY-002',
      severity: 'error',
      message: `EvoFuncional contiene intervalos en ${functionalIntervalDays.length} días. Rediseña la semana con formatos distintos.`,
    })
  } else if (functionalIntervalDays.length === 3) {
    warnings.push({
      code: 'VAL-VARIETY-002',
      severity: 'warning',
      message: 'EvoFuncional contiene intervalos en tres días; confirma que la repetición es deliberada y que los estímulos son claramente distintos.',
    })
  }

  for (const [signature, days] of intervalSignatures.entries()) {
    if (days.length < 2) continue
    warnings.push({
      code: 'VAL-VARIETY-002',
      severity: 'warning',
      message: `EvoFuncional repite la relación de intervalos ${signature.replace('+', "' trabajo / ")}' descanso en ${days.join(' y ')}.`,
    })
  }

  return { valid: errors.length === 0, errors, warnings }
}
