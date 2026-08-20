import { EVO_SESSION_CLASS_DEFS } from '../../constants/evoClasses.js'

const DAY_NAMES = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']

function asText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeDayName(value) {
  return String(value || '')
    .toUpperCase()
    .replaceAll('Á', 'A')
    .replaceAll('É', 'E')
    .replaceAll('Í', 'I')
    .replaceAll('Ó', 'O')
    .replaceAll('Ú', 'U')
    .trim()
}

function isProgrammableSession(value) {
  return Boolean(value) && value.toLowerCase() !== '(no programada esta semana)'
}

function weekdayFromName(name, fallback) {
  const index = DAY_NAMES.indexOf(normalizeDayName(name))
  return index >= 0 ? index + 1 : fallback + 1
}

/**
 * Converts the established Programming Excel shape into a review-only structured import.
 * No database writes occur here: callers must explicitly confirm and persist the result.
 */
export function projectLegacyWeekForStructuredImport(legacyWeek) {
  const sessions = []
  const skipped = []

  for (const [dayIndex, day] of (legacyWeek?.dias || []).entries()) {
    const dayName = asText(day?.nombre) || `Día ${dayIndex + 1}`
    const weekday = weekdayFromName(dayName, dayIndex)

    for (const classDef of EVO_SESSION_CLASS_DEFS) {
      const programming = asText(day?.[classDef.key])
      const feedback = asText(day?.[classDef.feedbackKey])

      if (!isProgrammableSession(programming)) {
        skipped.push({ dayName, classType: classDef.label, reason: 'not_programmed' })
        continue
      }

      sessions.push({
        sourceId: `legacy:${weekday}:${classDef.key}`,
        weekday,
        dayName,
        classTypeKey: classDef.key,
        classType: classDef.label,
        title: `${dayName} · ${classDef.label}`,
        programming,
        feedback,
      })
    }
  }

  return {
    sourceTitle: asText(legacyWeek?.titulo),
    sessions,
    skipped,
    summary: {
      totalSessions: sessions.length,
      daysRecognized: new Set(sessions.map((session) => session.weekday)).size,
      feedbackIncluded: sessions.filter((session) => session.feedback).length,
    },
  }
}
