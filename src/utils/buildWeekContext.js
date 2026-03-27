import { DAYS_ES } from '../constants/evoColors.js'

export function buildWeekContext(weekState) {
  const confirmed = Object.entries(weekState.sessions)
    .filter(([, s]) => s?.confirmed)
    .map(([day, s]) => {
      const dayEs = DAYS_ES[day] || day
      const classes = s.classes?.join(' + ') || ''
      return `${dayEs.toUpperCase()} (${classes}):\n${s.content}`
    })
    .join('\n\n---\n\n')

  if (!confirmed) {
    return 'Es el primer día de la semana. No hay sesiones programadas aún.'
  }

  return `SESIONES YA PROGRAMADAS ESTA SEMANA:\n\n${confirmed}`
}

export function buildWeekContextMessage(weekState) {
  const ctx = buildWeekContext(weekState)
  const meso = weekState.mesocycle
    ? `Mesociclo actual: ${weekState.mesocycle}${weekState.phase ? ` — Fase: ${weekState.phase}` : ''} | Semana ${weekState.week || 1} de ${weekState.totalWeeks || '?'}`
    : ''

  return [meso, ctx].filter(Boolean).join('\n\n')
}
