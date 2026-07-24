/**
 * Filtro ligero de semanas para el briefing (serverless).
 * Evita importar validateEvoWeek en /api/programming-week-briefing.
 */
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

export function filterBriefingContextWeeks(weeks, { mesociclo, targetSemana } = {}) {
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
    return !!data && typeof data === 'object' && weekHasPublishedSessions(data)
  })
}
