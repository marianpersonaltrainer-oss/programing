import { EVO_SESSION_CLASS_DEFS } from '../constants/evoClasses.js'

const PLACEHOLDER_RE = /^\s*(?:\(no programada esta semana\)|FESTIVO)\s*$/i

export function normalizeCoachSupportText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function hasSession(value) {
  const text = String(value || '').trim()
  return Boolean(text) && !PLACEHOLDER_RE.test(text)
}

function dayNamedInQuestion(userText) {
  const match = normalizeCoachSupportText(userText).match(
    /\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/,
  )
  return match?.[1] || ''
}

function findDay(weekData, userText, defaultDayName) {
  const days = Array.isArray(weekData?.dias) ? weekData.dias : []
  const requested = dayNamedInQuestion(userText)
  const fallback = normalizeCoachSupportText(defaultDayName)
  if (requested) {
    return days.find((day) => normalizeCoachSupportText(day?.nombre) === requested) || null
  }
  return days.find((day) => normalizeCoachSupportText(day?.nombre) === fallback) || null
}

function classDefNamedInQuestion(userText) {
  const question = normalizeCoachSupportText(userText)
  const aliases = [
    ['evofuncional', ['evofuncional', 'funcional']],
    ['evobasics', ['evobasics', 'basics', 'basic']],
    ['evofit', ['evofit', 'boxfit', 'fit']],
    ['evohybrix', ['evohybrix', 'hybrix', 'hyrox']],
    ['evofuerza', ['evofuerza']],
    ['evogimnastica', ['evogimnastica', 'gimnastica', 'gimnasticos']],
    ['evotodos', ['evotodos']],
  ]
  const key = aliases.find(([, names]) => names.some((name) => new RegExp(`\\b${name}\\b`).test(question)))?.[0]
  return EVO_SESSION_CLASS_DEFS.find((definition) => definition.key === key) || null
}

/** Indica que la pregunta nombra de forma inequívoca otro día o modalidad. */
export function questionHasExplicitCoachContext(userText) {
  return Boolean(dayNamedInQuestion(userText) || classDefNamedInQuestion(userText))
}

function combinedContextForDay(day, definitions) {
  const sessionText = definitions
    .map((definition) => `${definition.label}:\n${String(day[definition.key] || '').trim()}`)
    .join('\n\n')
  const feedbackText = definitions
    .map((definition) => {
      const feedback = String(day[definition.feedbackKey] || '').trim()
      return feedback ? `${definition.label}: ${feedback}` : ''
    })
    .filter(Boolean)
    .join('\n')

  return {
    dayName: day.nombre,
    classLabel: definitions.length === 1 ? definitions[0].label : 'Clases programadas del día',
    sessionText,
    sessionFeedbackText: feedbackText,
  }
}

/**
 * Resuelve contexto incluso cuando el coach abre el asistente sin pasar por un WOD.
 * Si no puede identificar una clase concreta, entrega todas las sesiones del día
 * activo para que la IA no responda a ciegas.
 */
export function inferCoachSupportSessionContext(userText, weekData, defaultDayName) {
  const day = findDay(weekData, userText, defaultDayName)
  if (!day) return null

  const namedClass = classDefNamedInQuestion(userText)
  if (namedClass) {
    if (hasSession(day[namedClass.key])) return combinedContextForDay(day, [namedClass])
    return {
      dayName: day.nombre,
      classLabel: namedClass.label,
      sessionText: '(no programada esta semana)',
      sessionFeedbackText: '',
    }
  }

  const programmed = EVO_SESSION_CLASS_DEFS.filter((definition) => hasSession(day[definition.key]))
  if (!programmed.length) return null
  return combinedContextForDay(day, programmed)
}

function classKeyFromLabel(classLabel) {
  const target = normalizeCoachSupportText(classLabel).replaceAll(' ', '')
  const definition = EVO_SESSION_CLASS_DEFS.find((item) => {
    const label = normalizeCoachSupportText(item.label).replaceAll(' ', '')
    return label && (target.includes(label) || label.includes(target))
  })
  return definition?.key || ''
}

function rowScore(row, source, classKey, exactCategories) {
  const name = normalizeCoachSupportText(row?.name)
  const category = normalizeCoachSupportText(row?.category)
  const classes = Array.isArray(row?.classes) ? row.classes : []
  let score = 0
  if (name && source.includes(name)) score += 10
  if (category && exactCategories.has(category)) score += 5
  if (classKey && classes.includes(classKey)) score += 2
  const sourceTokens = new Set(source.split(' ').filter((token) => token.length >= 4))
  if (name.split(' ').some((token) => token.length >= 4 && sourceTokens.has(token))) score += 2
  return score
}

/** Selección pequeña y relevante de la biblioteca para proponer sustituciones reales. */
export function buildCoachSupportLibraryBlock(rows, context, userText, maxRows = 28) {
  if (!Array.isArray(rows) || rows.length === 0) return ''
  const source = normalizeCoachSupportText(`${userText || ''}\n${context?.sessionText || ''}`)
  const classKey = classKeyFromLabel(context?.classLabel)
  const exactCategories = new Set(
    rows
      .filter((row) => {
        const name = normalizeCoachSupportText(row?.name)
        return name && source.includes(name)
      })
      .map((row) => normalizeCoachSupportText(row?.category))
      .filter(Boolean),
  )

  const selected = rows
    .map((row) => ({ row, score: rowScore(row, source, classKey, exactCategories) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || String(a.row?.name || '').localeCompare(String(b.row?.name || '')))
    .slice(0, maxRows)

  if (!selected.length) return ''

  const lines = selected.map(({ row }) => {
    const details = [row.category, row.level, Array.isArray(row.classes) ? row.classes.join('/') : '']
      .filter(Boolean)
      .join(' · ')
    const note = String(row.notes || '').trim()
    return `- ${row.name}${details ? ` (${details})` : ''}${note ? `: ${note}` : ''}`
  })

  return `BIBLIOTECA EVO RELEVANTE PARA ESTA PREGUNTA
Usa estas opciones como repertorio, no como prohibiciones por modalidad. Las clases, niveles y notas pueden proceder de una clasificación histórica: el Método EVO y el inventario del system mandan si existe contradicción. Conserva el patrón y el estímulo de la sesión antes de cambiar un ejercicio.
${lines.join('\n')}`
}

export function coachSupportContextFingerprint(context) {
  const source = `${context?.dayName || ''}|${context?.classLabel || ''}|${context?.sessionText || ''}|${context?.sessionFeedbackText || ''}`
  let hash = 5381
  for (let index = 0; index < source.length; index += 1) hash = (hash * 33) ^ source.charCodeAt(index)
  return (hash >>> 0).toString(36)
}
