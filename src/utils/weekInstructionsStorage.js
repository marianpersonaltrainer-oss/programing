const WEEK_INSTRUCTIONS_KEY_PREFIX = 'programingevo_week_instructions'

function normalizeDate(value) {
  const text = String(value || '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ''
}

/**
 * Las instrucciones de una S5 solo pertenecen al ciclo exacto que se está
 * diseñando. No se recupera la antigua clave mesociclo+semana.
 */
export function weekInstructionsStorageKey(weekState) {
  const mesocycle = String(weekState?.mesocycle || 'sin-mesociclo').trim().toLowerCase()
  const week = Number(weekState?.week || 0)
  const cycleStartDate = normalizeDate(
    weekState?.cycleStartDate ?? weekState?.cycle_start_date,
  )
  const cycleId =
    String(weekState?.cycleId ?? weekState?.cycle_id ?? '').trim() ||
    (cycleStartDate && mesocycle !== 'sin-mesociclo'
      ? `${mesocycle}:${cycleStartDate}`
      : 'sin-ciclo')
  return `${WEEK_INSTRUCTIONS_KEY_PREFIX}:${encodeURIComponent(cycleId)}:s${week}`
}
