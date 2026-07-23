import { validateEvoWeek } from './validateEvoWeek.js'

const CLASS_KEYS = [
  'evofuncional',
  'evobasics',
  'evofit',
  'evohybrix',
  'evofuerza',
  'evogimnastica',
  'evotodos',
]

function weekHasPublishedSessions(data) {
  return (data?.dias || []).some((day) =>
    CLASS_KEYS.some((key) => {
      const t = String(day?.[key] || '').trim()
      return t && !/^\(no programada esta semana\)$/i.test(t) && !/^FESTIVO\b/i.test(t)
    }),
  )
}

/**
 * Filtra semanas aptas para contexto de generación: mismo mesociclo, anteriores a la objetivo,
 * sin borradores ni semanas futuras ni defectuosas publicadas.
 */
export function filterGenerationContextWeeks(weeks, { mesociclo, targetSemana, offer } = {}) {
  const meso = String(mesociclo || '').trim()
  const target = Number(targetSemana)
  if (!meso || !Number.isFinite(target)) return []

  return (weeks || []).filter((row) => {
    if (String(row?.mesociclo || '').trim() !== meso) return false
    const sem = Number(row?.semana)
    if (!Number.isFinite(sem) || sem >= target) return false
    if (row?.status && !['published', 'ready'].includes(String(row.status))) return false
    if (row?.is_draft === true || row?.draft === true) return false

    const data = row?.data
    if (!data || typeof data !== 'object' || !weekHasPublishedSessions(data)) return false

    const validation = validateEvoWeek(
      { ...data, mesociclo: meso, semana: sem },
      { offer, validateOfferCompleteness: false },
    )
    return validation.valid
  })
}

/** Rechaza feedback ligado a otra semana, mesociclo o clase. */
export function validateFeedbackContext(feedbackEntry, scope = {}) {
  const errors = []
  const meso = String(scope.mesociclo || '').trim()
  const semana = Number(scope.semana)
  const dayName = String(scope.dayName || '').trim().toLowerCase()
  const classKey = String(scope.classKey || '').trim().toLowerCase()

  if (!feedbackEntry || !String(feedbackEntry.text || feedbackEntry.feedback || '').trim()) {
    return { valid: true, errors }
  }

  if (meso && feedbackEntry.mesociclo && String(feedbackEntry.mesociclo).trim() !== meso) {
    errors.push({
      code: 'VAL-FEEDBACK-002',
      severity: 'error',
      message: `El feedback pertenece al mesociclo «${feedbackEntry.mesociclo}», no a «${meso}».`,
    })
  }

  if (Number.isFinite(semana) && feedbackEntry.semana != null && Number(feedbackEntry.semana) !== semana) {
    errors.push({
      code: 'VAL-FEEDBACK-002',
      severity: 'error',
      message: `El feedback corresponde a la semana ${feedbackEntry.semana}, no a la semana ${semana}.`,
    })
  }

  if (dayName && feedbackEntry.dayName && String(feedbackEntry.dayName).trim().toLowerCase() !== dayName) {
    errors.push({
      code: 'VAL-FEEDBACK-002',
      severity: 'error',
      message: `El feedback es para ${feedbackEntry.dayName}, no para ${scope.dayName}.`,
    })
  }

  if (classKey && feedbackEntry.classKey && String(feedbackEntry.classKey).trim().toLowerCase() !== classKey) {
    errors.push({
      code: 'VAL-FEEDBACK-002',
      severity: 'error',
      message: `El feedback es para la clase ${feedbackEntry.classKey}, no para ${scope.classKey}.`,
    })
  }

  return { valid: errors.length === 0, errors }
}

/** Descarta filas de otro mesociclo, temporada incorrecta o semanas futuras. */
export function rejectContaminatedContextRows(rows, { mesociclo, targetSemana, season } = {}) {
  const meso = String(mesociclo || '').trim()
  const target = Number(targetSemana)
  const rejected = []

  const kept = (rows || []).filter((row) => {
    if (meso && row?.mesociclo && String(row.mesociclo).trim() !== meso) {
      rejected.push({ row, reason: 'otro mesociclo' })
      return false
    }
    if (Number.isFinite(target) && Number(row?.semana) >= target) {
      rejected.push({ row, reason: 'semana futura o actual' })
      return false
    }
    if (season && row?.season && String(row.season).trim() !== String(season).trim()) {
      rejected.push({ row, reason: 'temporada incorrecta' })
      return false
    }
    if (row?.status === 'draft' || row?.is_draft) {
      rejected.push({ row, reason: 'borrador no aprobado' })
      return false
    }
    return true
  })

  return { kept, rejected }
}
