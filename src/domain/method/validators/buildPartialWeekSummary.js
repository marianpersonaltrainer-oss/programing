import { detectIntervalStructure } from './evoIntervalDetection.js'
import { extractSessionFormats, extractStrengthPatterns, extractMovementFamilies, extractFatigueZones } from './validateEvoWeekVariety.js'

const CLASS_KEYS = [
  'evofuncional',
  'evobasics',
  'evofit',
  'evohybrix',
  'evofuerza',
  'evogimnastica',
  'evotodos',
]

function isRealSession(text) {
  const t = String(text || '').trim()
  return t && !/^\(no programada esta semana\)$/i.test(t) && !/^FESTIVO\b/i.test(t)
}

/** Resumen compacto de días ya generados para evitar repetición involuntaria en generación parcial. */
export function buildPartialWeekSummary(week) {
  const summary = {
    days: [],
    formats: [],
    strengthPatterns: [],
    movementFamilies: [],
    fatigueZones: [],
    intervalDaysByClass: {},
  }

  for (const day of week?.dias || []) {
    const dayName = String(day?.nombre || '').trim()
    const dayEntry = { dayName, classes: [] }

    for (const classKey of CLASS_KEYS) {
      const session = String(day?.[classKey] || '')
      if (!isRealSession(session)) continue

      const formats = extractSessionFormats(session)
      const strength = extractStrengthPatterns(session)
      const families = extractMovementFamilies(session)
      const fatigue = extractFatigueZones(session)
      const interval = detectIntervalStructure(session)

      dayEntry.classes.push({
        classKey,
        formats,
        strength,
        families,
        fatigue,
        interval: interval.isInterval ? interval.kind : null,
      })

      summary.formats.push(...formats.map((f) => `${dayName}:${classKey}:${f}`))
      summary.strengthPatterns.push(...strength.map((s) => `${dayName}:${classKey}:${s}`))
      summary.movementFamilies.push(...families.map((f) => `${dayName}:${classKey}:${f}`))
      summary.fatigueZones.push(...fatigue.map((z) => `${dayName}:${classKey}:${z}`))

      if (interval.isInterval) {
        const bucket = summary.intervalDaysByClass[classKey] || []
        bucket.push(dayName)
        summary.intervalDaysByClass[classKey] = bucket
      }
    }

    if (dayEntry.classes.length) summary.days.push(dayEntry)
  }

  return summary
}

/** Detecta repetición involuntaria al añadir una sesión nueva en generación parcial. */
export function validatePartialGenerationCoherence(existingSummary, { dayName, classKey, session }) {
  const errors = []
  const warnings = []
  if (!existingSummary || !isRealSession(session)) return { valid: true, errors, warnings }

  const formats = extractSessionFormats(session)
  const strength = extractStrengthPatterns(session)
  const families = extractMovementFamilies(session)

  for (const format of formats) {
    const hit = existingSummary.formats.some((entry) => entry.endsWith(`:${classKey}:${format}`))
    if (hit) {
      errors.push({
        code: 'VAL-PARTIAL-001',
        severity: 'error',
        message: `El formato «${format}» ya se usó en ${classKey} esta semana; cambia el estímulo antes de continuar la generación parcial.`,
      })
    }
  }

  for (const pattern of strength) {
    const hit = existingSummary.strengthPatterns.some((entry) => entry.endsWith(`:${classKey}:${pattern}`))
    if (hit) {
      errors.push({
        code: 'VAL-PARTIAL-001',
        severity: 'error',
        message: `El patrón de fuerza «${pattern}» ya aparece en ${classKey}; evita repetirlo en ${dayName}.`,
      })
    }
  }

  const interval = detectIntervalStructure(session)
  const priorIntervalDays = existingSummary.intervalDaysByClass?.[classKey] || []
  if (interval.isInterval && priorIntervalDays.length >= 2) {
    errors.push({
      code: 'VAL-INTERVAL-001',
      severity: 'error',
      message: `${classKey} ya tiene ${priorIntervalDays.length} días interválicos (${priorIntervalDays.join(', ')}); no añadas otro en ${dayName}.`,
    })
  }

  return { valid: errors.length === 0, errors, warnings }
}
