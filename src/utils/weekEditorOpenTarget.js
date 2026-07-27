function normalizeDate(value) {
  const text = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return ''
  const date = new Date(`${text}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
    ? text
    : ''
}

function addDays(isoDate, days) {
  const normalized = normalizeDate(isoDate)
  if (!normalized) return ''
  const date = new Date(`${normalized}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + Number(days || 0))
  return date.toISOString().slice(0, 10)
}

function cycleStartFromId(cycleId) {
  const match = String(cycleId || '').trim().match(/:(\d{4}-\d{2}-\d{2})$/)
  return normalizeDate(match?.[1])
}

export function resolveEditorOpenTarget({
  row = null,
  data = null,
  fallbackSemana = null,
  fallbackMeso = null,
} = {}) {
  const source = data && typeof data === 'object' ? data : row?.data || {}
  const mesocycle = String(
    row?.mesociclo ||
      source?.mesociclo ||
      source?.mesocycle ||
      fallbackMeso ||
      '',
  ).trim()
  const week = Number(row?.semana || source?.semana || source?.week || fallbackSemana || 0)
  const providedCycleId = String(
    row?.cycle_id || row?.cycleId || source?.cycle_id || source?.cycleId || '',
  ).trim()
  let cycleStartDate = normalizeDate(
    row?.cycle_start_date ||
      row?.cycleStartDate ||
      source?.cycle_start_date ||
      source?.cycleStartDate,
  )
  let weekStartDate = normalizeDate(
    row?.week_start_date ||
      row?.weekStartDate ||
      source?.week_start_date ||
      source?.weekStartDate,
  )
  if (!cycleStartDate) cycleStartDate = cycleStartFromId(providedCycleId)
  if (!cycleStartDate && weekStartDate && Number.isInteger(week) && week > 0) {
    cycleStartDate = addDays(weekStartDate, -(week - 1) * 7)
  }
  if (cycleStartDate && Number.isInteger(week) && week > 0) {
    weekStartDate = addDays(cycleStartDate, (week - 1) * 7)
  }
  const cycleId =
    cycleStartDate && mesocycle
      ? `${mesocycle}:${cycleStartDate}`
      : providedCycleId
  return {
    mesocycle: mesocycle || null,
    week: Number.isInteger(week) && week > 0 ? week : null,
    phase: String(source?.phase || row?.phase || '').trim() || null,
    cycleId: cycleId || null,
    cycleStartDate: cycleStartDate || null,
    weekStartDate: weekStartDate || null,
  }
}

export function editorOpenTargetMatchesWeekState(target, weekState) {
  if (!target?.mesocycle || !target?.week) return false
  const current = resolveEditorOpenTarget({
    data: {
      mesociclo: weekState?.mesocycle,
      semana: weekState?.week,
      phase: weekState?.phase,
      cycle_id: weekState?.cycleId ?? weekState?.cycle_id,
      cycle_start_date: weekState?.cycleStartDate ?? weekState?.cycle_start_date,
      week_start_date: weekState?.weekStartDate ?? weekState?.week_start_date,
    },
  })
  return (
    current.mesocycle === target.mesocycle &&
    current.week === target.week &&
    (current.phase || null) === (target.phase || null) &&
    (current.cycleId || null) === (target.cycleId || null) &&
    (current.cycleStartDate || null) === (target.cycleStartDate || null)
  )
}

export function resolvePendingEditorOpen(pending, weekState) {
  if (!pending) return { action: 'none', payload: null }
  return editorOpenTargetMatchesWeekState(pending.target, weekState)
    ? { action: 'apply', payload: pending }
    : { action: 'discard', payload: null }
}

export function publishedWeekMatchesExactTarget(row, {
  mesocycle,
  week,
  cycleId,
  cycleStartDate,
} = {}) {
  if (!row?.data || !mesocycle || !week || !cycleId || !cycleStartDate) return false
  const rowCycleId = String(row?.cycle_id || row?.data?.cycle_id || '').trim()
  const rowCycleStartDate = normalizeDate(
    row?.cycle_start_date || row?.data?.cycle_start_date,
  )
  return (
    String(row?.mesociclo || row?.data?.mesociclo || '').trim() === String(mesocycle).trim() &&
    Number(row?.semana || row?.data?.semana) === Number(week) &&
    rowCycleId === String(cycleId).trim() &&
    rowCycleStartDate === normalizeDate(cycleStartDate)
  )
}
