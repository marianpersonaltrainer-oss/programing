const DAY_MS = 24 * 60 * 60 * 1000

function clean(value) {
  return String(value ?? '').trim()
}

function normalizeLabel(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

function firstNonEmpty(values) {
  for (const value of values) {
    const text = clean(value)
    if (text) return text
  }
  return ''
}

function firstObject(...values) {
  return values.find((value) => value && typeof value === 'object' && !Array.isArray(value)) || {}
}

/**
 * Normaliza una fecha a YYYY-MM-DD sin aplicar el huso horario del navegador.
 * Las fechas de programación son fechas de calendario, no instantes locales.
 */
export function normalizeProgrammingDate(value) {
  const text = clean(value)
  if (!text) return ''
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return ''
  const [, year, month, day] = match
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return ''
  }
  return `${year}-${month}-${day}`
}

export function addProgrammingDays(dateValue, amount) {
  const normalized = normalizeProgrammingDate(dateValue)
  if (!normalized || !Number.isFinite(Number(amount))) return ''
  const date = new Date(`${normalized}T00:00:00.000Z`)
  date.setTime(date.getTime() + Number(amount) * DAY_MS)
  return date.toISOString().slice(0, 10)
}

function rowData(row) {
  return firstObject(row?.data, row?.week_data, row?.weekData)
}

function rowMeta(row) {
  const data = rowData(row)
  return firstObject(row?.meta, data?.meta, data?.metadata)
}

export function getProgrammingWeekNumber(row) {
  const data = rowData(row)
  const number = Number(row?.semana ?? row?.week ?? data?.semana ?? data?.week)
  return Number.isInteger(number) && number > 0 ? number : null
}

export function getProgrammingMesocycle(row) {
  const data = rowData(row)
  return firstNonEmpty([row?.mesociclo, row?.mesocycle, data?.mesociclo, data?.mesocycle])
}

export function getProgrammingCycleId(row) {
  const data = rowData(row)
  const meta = rowMeta(row)
  return firstNonEmpty([
    row?.cycle_id,
    row?.cycleId,
    row?.cycle_key,
    row?.cycleKey,
    data?.cycle_id,
    data?.cycleId,
    data?.cycle_key,
    data?.cycleKey,
    meta?.cycle_id,
    meta?.cycleId,
    meta?.cycle_key,
    meta?.cycleKey,
  ])
}

export function getProgrammingCycleStartDate(row) {
  const data = rowData(row)
  const meta = rowMeta(row)
  return normalizeProgrammingDate(
    firstNonEmpty([
      row?.cycle_start_date,
      row?.cycleStartDate,
      data?.cycle_start_date,
      data?.cycleStartDate,
      meta?.cycle_start_date,
      meta?.cycleStartDate,
    ]),
  )
}

export function getProgrammingWeekStartDate(row) {
  const data = rowData(row)
  const meta = rowMeta(row)
  const direct = normalizeProgrammingDate(
    firstNonEmpty([
      row?.week_start_date,
      row?.weekStartDate,
      row?.start_date,
      row?.startDate,
      data?.week_start_date,
      data?.weekStartDate,
      data?.fecha_inicio,
      data?.fechaInicio,
      data?.start_date,
      data?.startDate,
      meta?.week_start_date,
      meta?.weekStartDate,
    ]),
  )
  if (direct) return direct

  const cycleStart = getProgrammingCycleStartDate(row)
  const week = getProgrammingWeekNumber(row)
  return cycleStart && week ? addProgrammingDays(cycleStart, (week - 1) * 7) : ''
}

function getPublishedAt(row) {
  return firstNonEmpty([
    row?.published_at,
    row?.publishedAt,
    row?.created_at,
    row?.createdAt,
  ])
}

export function isPublishedProgrammingWeek(row) {
  if (!row || typeof row !== 'object') return false
  if (row.is_draft === true || row.isDraft === true || row?.data?.is_draft === true) return false
  const status = normalizeLabel(
    firstNonEmpty([
      row.publication_state,
      row.publicationState,
      row.publication_status,
      row.status,
      row?.data?.publication_state,
      row?.data?.status,
    ]),
  )
  if (
    [
      'draft',
      'borrador',
      'archived',
      'archivado',
      'publishing',
      'publicando',
      'consumed',
      'legacy_unverified',
    ].includes(status)
  ) {
    return false
  }
  return !!getPublishedAt(row)
}

function targetIdentity(target) {
  const week = getProgrammingWeekNumber(target)
  const mesocycle = getProgrammingMesocycle(target)
  const cycleId = getProgrammingCycleId(target)
  let cycleStartDate = getProgrammingCycleStartDate(target)
  const weekStartDate = getProgrammingWeekStartDate(target)
  if (!cycleStartDate && weekStartDate && week) {
    cycleStartDate = addProgrammingDays(weekStartDate, -(week - 1) * 7)
  }
  return {
    mesocycle,
    mesocycleKey: normalizeLabel(mesocycle),
    week,
    cycleId,
    cycleStartDate,
    weekStartDate,
    hasStrictCycleIdentity: !!(cycleId || cycleStartDate || weekStartDate),
  }
}

function rowCycleStartDate(row) {
  const direct = getProgrammingCycleStartDate(row)
  if (direct) return direct
  const weekStart = getProgrammingWeekStartDate(row)
  const week = getProgrammingWeekNumber(row)
  return weekStart && week ? addProgrammingDays(weekStart, -(week - 1) * 7) : ''
}

/**
 * Una fila solo cuenta como progresión si pertenece inequívocamente al ciclo
 * objetivo y es una semana estrictamente anterior.
 */
export function isExactEarlierProgressionWeek(row, target) {
  const expected = targetIdentity(target)
  const rowWeek = getProgrammingWeekNumber(row)
  if (
    !isPublishedProgrammingWeek(row) ||
    !expected.mesocycleKey ||
    !expected.week ||
    !rowWeek ||
    rowWeek >= expected.week ||
    normalizeLabel(getProgrammingMesocycle(row)) !== expected.mesocycleKey
  ) {
    return false
  }

  const rowCycleId = getProgrammingCycleId(row)
  if (expected.cycleId && rowCycleId !== expected.cycleId) return false

  const rowCycleStart = rowCycleStartDate(row)
  if (expected.cycleStartDate && rowCycleStart !== expected.cycleStartDate) return false

  if (expected.weekStartDate) {
    const expectedRowDate = addProgrammingDays(
      expected.weekStartDate,
      -(expected.week - rowWeek) * 7,
    )
    if (getProgrammingWeekStartDate(row) !== expectedRowDate) return false
  }

  // Compatibilidad con filas históricas sin identidad temporal. Solo se usa
  // cuando tampoco el objetivo dispone de identidad de ciclo/fecha.
  return expected.hasStrictCycleIdentity
    ? !!(rowCycleId || rowCycleStart || getProgrammingWeekStartDate(row))
    : true
}

function rowTime(row) {
  const value = Date.parse(getPublishedAt(row))
  return Number.isFinite(value) ? value : 0
}

function stableRowId(row) {
  return firstNonEmpty([
    row?.id,
    `${normalizeLabel(getProgrammingMesocycle(row))}:s${getProgrammingWeekNumber(row) || '?'}`,
  ])
}

function dedupeLatestByLogicalWeek(rows) {
  const sorted = [...rows].sort((a, b) => rowTime(b) - rowTime(a))
  const seen = new Set()
  const out = []
  for (const row of sorted) {
    const key = [
      normalizeLabel(getProgrammingMesocycle(row)),
      getProgrammingCycleId(row) || rowCycleStartDate(row) || 'legacy',
      getProgrammingWeekNumber(row) || '?',
    ].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

function isUnsafeTargetOrFuture(row, target) {
  const expected = targetIdentity(target)
  const rowWeek = getProgrammingWeekNumber(row)
  if (!expected.week || !rowWeek) return true
  if (normalizeLabel(getProgrammingMesocycle(row)) !== expected.mesocycleKey) return false

  const targetCycleId = expected.cycleId
  const rowCycleId = getProgrammingCycleId(row)
  const targetHasVerifiedCycleId = targetCycleId && !/^legacy:/i.test(targetCycleId)
  const rowHasVerifiedCycleId = rowCycleId && !/^legacy:/i.test(rowCycleId)
  if (
    targetHasVerifiedCycleId &&
    rowHasVerifiedCycleId &&
    targetCycleId !== rowCycleId
  ) {
    return false
  }

  const targetCycleStart = expected.cycleStartDate
  const candidateCycleStart = rowCycleStartDate(row)
  if (targetCycleStart && candidateCycleStart && targetCycleStart !== candidateCycleStart) {
    return false
  }

  // Sin identidad suficiente, se elige la opción segura: una S igual o
  // posterior del mismo mesociclo no entra ni como referencia.
  return rowWeek >= expected.week
}

function conflictsInsideTargetCycle(row, target) {
  const expected = targetIdentity(target)
  if (normalizeLabel(getProgrammingMesocycle(row)) !== expected.mesocycleKey) return false
  const candidateCycleId = getProgrammingCycleId(row)
  if (expected.cycleId && candidateCycleId === expected.cycleId) return true
  const candidateCycleStart = rowCycleStartDate(row)
  return !!(
    expected.cycleStartDate &&
    candidateCycleStart &&
    expected.cycleStartDate === candidateCycleStart
  )
}

function isChronologicallyBeforeTarget(row, target) {
  const expected = targetIdentity(target)
  const candidateWeekStart = getProgrammingWeekStartDate(row)
  if (expected.weekStartDate) {
    // Con un objetivo fechado, una referencia sin fecha no puede demostrar que
    // sea anterior. Se excluye incluso si pertenece a otro mesociclo.
    if (!candidateWeekStart) return false
    return candidateWeekStart < expected.weekStartDate
  }
  return true
}

/**
 * Separa progresión real del ciclo y referencias antiguas. Nunca mezcla ambas
 * categorías bajo el rótulo de "semanas previas".
 */
export function selectProgrammingContextWeeks(rows, target, options = {}) {
  const progressionLimit = Math.max(1, Number(options.progressionLimit) || 6)
  const historicalLimit =
    options.historicalLimit == null
      ? 6
      : Math.max(0, Number(options.historicalLimit) || 0)
  const published = dedupeLatestByLogicalWeek(
    (Array.isArray(rows) ? rows : []).filter(isPublishedProgrammingWeek),
  )

  const progressionWeeks = published
    .filter((row) => isExactEarlierProgressionWeek(row, target))
    .sort((a, b) => getProgrammingWeekNumber(a) - getProgrammingWeekNumber(b))
    .slice(-progressionLimit)

  const progressionIds = new Set(progressionWeeks.map(stableRowId))
  const historicalReferenceWeeks = published
    .filter((row) => !progressionIds.has(stableRowId(row)))
    .filter((row) => !isUnsafeTargetOrFuture(row, target))
    .filter((row) => !conflictsInsideTargetCycle(row, target))
    .filter((row) => isChronologicallyBeforeTarget(row, target))
    .sort((a, b) => rowTime(b) - rowTime(a))
    .slice(0, historicalLimit)

  const selectedWeekIds = [...progressionWeeks, ...historicalReferenceWeeks]
    .map((row) => clean(row?.id))
    .filter(Boolean)

  return {
    progressionWeeks,
    historicalReferenceWeeks,
    selectedWeekIds: [...new Set(selectedWeekIds)],
    mode: targetIdentity(target).hasStrictCycleIdentity ? 'exact-cycle-date' : 'legacy-slot',
  }
}

/** Feedback sin fallback por mesociclo+semana: solo FK exacta de las semanas elegidas. */
export function filterFeedbackForSelectedWeekIds(rows, selectedWeekIds) {
  const ids = new Set((selectedWeekIds || []).map(clean).filter(Boolean))
  if (!ids.size) return []
  return (Array.isArray(rows) ? rows : []).filter((row) => ids.has(clean(row?.week_id)))
}
