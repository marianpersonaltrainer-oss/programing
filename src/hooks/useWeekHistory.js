const HISTORY_KEY = 'programingevo_history'

function normalizeIsoDate(value) {
  const text = String(value || '').trim()
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return ''
  const date = new Date(`${text}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? '' : text
}

function addDays(isoDate, days) {
  const normalized = normalizeIsoDate(isoDate)
  if (!normalized) return ''
  const date = new Date(`${normalized}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + Number(days || 0))
  return date.toISOString().slice(0, 10)
}

function firstDefined(source, keys) {
  for (const key of keys) {
    const value = source?.[key]
    if (value !== undefined && value !== null && String(value).trim()) return value
  }
  return ''
}

function dateFromCycleId(cycleId) {
  const match = String(cycleId || '').trim().match(/:(\d{4}-\d{2}-\d{2})$/)
  return normalizeIsoDate(match?.[1])
}

/**
 * Resuelve la identidad temporal exacta de una semana local.
 * Las filas antiguas sin ninguna fecha se conservan como legacy, pero nunca se
 * pueden convertir por inferencia en el ciclo que esté abierto actualmente.
 */
export function resolveLocalWeekCycleIdentity(mesociclo, semana, weekData = {}) {
  const full = weekData && typeof weekData === 'object' ? weekData : {}
  const meta = full.meta && typeof full.meta === 'object' ? full.meta : {}
  const meso = String(
    mesociclo || firstDefined(full, ['mesociclo', 'mesocycle']) || '',
  ).trim()
  const week = Number(semana || firstDefined(full, ['semana', 'week']) || 0)
  const providedCycleId = String(
    firstDefined(full, ['cycle_id', 'cycleId']) ||
      firstDefined(meta, ['cycle_id', 'cycleId']) ||
      '',
  ).trim()
  let cycleStartDate = normalizeIsoDate(
    firstDefined(full, ['cycle_start_date', 'cycleStartDate']) ||
      firstDefined(meta, ['cycle_start_date', 'cycleStartDate']),
  )
  let weekStartDate = normalizeIsoDate(
    firstDefined(full, ['week_start_date', 'weekStartDate']) ||
      firstDefined(meta, ['week_start_date', 'weekStartDate']),
  )

  if (!cycleStartDate) cycleStartDate = dateFromCycleId(providedCycleId)
  if (!cycleStartDate && weekStartDate && Number.isInteger(week) && week > 0) {
    cycleStartDate = addDays(weekStartDate, -(week - 1) * 7)
  }
  if (cycleStartDate && Number.isInteger(week) && week > 0) {
    // La fecha calculada manda sobre una fecha de semana incoherente.
    weekStartDate = addDays(cycleStartDate, (week - 1) * 7)
  }

  const cycleId =
    cycleStartDate && meso
      ? `${meso}:${cycleStartDate}`
      : providedCycleId

  return {
    cycleId: String(cycleId || '').trim() || null,
    cycleStartDate: cycleStartDate || null,
    weekStartDate: weekStartDate || null,
    isLegacy: !cycleId,
  }
}

function entryCycleId(entry, mesociclo = '') {
  const resolved = resolveLocalWeekCycleIdentity(
    mesociclo,
    entry?.semana,
    {
      ...(entry?.weekDataFull || {}),
      cycle_id:
        entry?.cycleId ??
        entry?.cycle_id ??
        entry?.weekDataFull?.cycle_id ??
        entry?.weekDataFull?.cycleId,
      cycle_start_date:
        entry?.cycleStartDate ??
        entry?.cycle_start_date ??
        entry?.weekDataFull?.cycle_start_date ??
        entry?.weekDataFull?.cycleStartDate,
      week_start_date:
        entry?.weekStartDate ??
        entry?.week_start_date ??
        entry?.weekDataFull?.week_start_date ??
        entry?.weekDataFull?.weekStartDate,
    },
  )
  return resolved.cycleId
}

export function loadHistory() {
  try {
    const saved = localStorage.getItem(HISTORY_KEY)
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

/** Lista de mesociclos que tienen al menos una semana guardada en este dispositivo. */
export function listMesocyclesInHistory() {
  return Object.keys(loadHistory()).sort()
}

/** Resumen para UI: mesociclo + nº de semanas en localStorage (cada mesociclo es una clave aparte). */
export function getAllMesocycleSummaries() {
  const history = loadHistory()
  return Object.keys(history)
    .map((mesociclo) => {
      const weeks = history[mesociclo] || []
      const uniq = new Set(
        weeks
          .map((entry) => {
            const week = Number(entry?.semana || 0)
            if (!Number.isFinite(week) || week <= 0) return ''
            return `${entryCycleId(entry, mesociclo) || 'legacy'}:s${week}`
          })
          .filter(Boolean),
      )
      return { mesociclo, count: uniq.size }
    })
    .sort((a, b) => a.mesociclo.localeCompare(b.mesociclo))
}

function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  } catch {
    // ignore quota errors
  }
}

// Guarda una semana en el historial bajo la clave del mesociclo
export function saveWeekToHistory(mesociclo, semana, weekData) {
  if (!mesociclo || !weekData) return
  const history = loadHistory()
  if (!history[mesociclo]) history[mesociclo] = []
  const identity = resolveLocalWeekCycleIdentity(mesociclo, semana, weekData)
  const weekDataFull = JSON.parse(JSON.stringify(weekData))
  if (identity.cycleId) weekDataFull.cycle_id = identity.cycleId
  if (identity.cycleStartDate) weekDataFull.cycle_start_date = identity.cycleStartDate
  if (identity.weekStartDate) weekDataFull.week_start_date = identity.weekStartDate

  // Guardar resumen compacto: titulo + resumen + nombre de días con sus WODs (no texto completo)
  const entry = {
    entryId:
      Date.now().toString(36) +
      '-' +
      Math.random()
        .toString(36)
        .slice(2, 8),
    semana,
    mesociclo,
    cycleId: identity.cycleId,
    cycleStartDate: identity.cycleStartDate,
    weekStartDate: identity.weekStartDate,
    titulo: weekData.titulo,
    resumen: weekData.resumen || null,
    dias: (weekData.dias || []).map((dia) => ({
      nombre: dia.nombre,
      // Extraer solo el bloque WOD del texto de cada clase para el contexto
      wodFuncional: extractWod(dia.evofuncional),
      wodBasics:    extractWod(dia.evobasics),
      wodFit:       extractWod(dia.evofit),
    })),
    /** Copia completa del JSON para reabrir en el modal (editar / publicar). */
    weekDataFull,
    savedAt: new Date().toISOString(),
  }

  // Versionado local: conservar varias copias por semana para poder recuperar borradores antiguos.
  history[mesociclo].push(entry)
  // Limitar crecimiento: máx 8 versiones por semana, y 80 entradas totales por mesociclo.
  const byCycleAndWeek = {}
  for (const e of history[mesociclo]) {
    const w = Number(e?.semana || 0)
    const cycleKey = entryCycleId(e, mesociclo) || 'legacy'
    const key = `${cycleKey}:s${w}`
    if (!byCycleAndWeek[key]) byCycleAndWeek[key] = []
    byCycleAndWeek[key].push(e)
  }
  const trimmed = []
  for (const weekKey of Object.keys(byCycleAndWeek)) {
    const group = byCycleAndWeek[weekKey]
      .slice()
      .sort((a, b) => new Date(b?.savedAt || 0).getTime() - new Date(a?.savedAt || 0).getTime())
      .slice(0, 8)
    trimmed.push(...group)
  }
  history[mesociclo] = trimmed
    .sort((a, b) => new Date(b?.savedAt || 0).getTime() - new Date(a?.savedAt || 0).getTime())
    .slice(0, 80)
  saveHistory(history)
}

/**
 * Devuelve historial local de un mesociclo.
 *
 * - Los consumidores automáticos deben indicar `cycleId`/`cycleStartDate`; se
 *   devuelve exclusivamente ese ciclo y nunca entradas legacy.
 * - `allCycles: true` queda reservado a navegadores históricos explícitos.
 */
export function getHistoryForMesocycle(mesociclo, options = {}) {
  if (!mesociclo) return []
  const {
    cycleId: requestedCycleId = '',
    cycleStartDate = '',
    allCycles = false,
    includeLegacy = false,
  } = options || {}
  const history = loadHistory()
  let entries = history[mesociclo] || []
  if (allCycles) {
    if (!includeLegacy) {
      entries = entries.filter((entry) => !!entryCycleId(entry, mesociclo))
    }
  } else {
    const exactCycleId =
      String(requestedCycleId || '').trim() ||
      (normalizeIsoDate(cycleStartDate)
        ? `${mesociclo}:${normalizeIsoDate(cycleStartDate)}`
        : '')
    // Fallo cerrado: sin identidad exacta no se carga automáticamente un ciclo viejo.
    if (!exactCycleId) return []
    entries = entries.filter((entry) => entryCycleId(entry, mesociclo) === exactCycleId)
  }
  return entries
    .slice()
    .sort((a, b) => new Date(b?.savedAt || 0).getTime() - new Date(a?.savedAt || 0).getTime())
}

// Elimina una versión concreta del historial (fallback a semana completa si no hay entryId).
export function deleteWeekFromHistory(mesociclo, semana, entryId = null, options = {}) {
  const history = loadHistory()
  if (!history[mesociclo]) return
  if (entryId) {
    history[mesociclo] = history[mesociclo].filter((e) => e.entryId !== entryId)
  } else {
    const exactEntries = getHistoryForMesocycle(mesociclo, options)
    const exactEntryIds = new Set(
      exactEntries
        .filter((entry) => Number(entry?.semana) === Number(semana))
        .map((entry) => entry?.entryId)
        .filter(Boolean),
    )
    if (!exactEntryIds.size) return
    history[mesociclo] = history[mesociclo].filter((entry) => !exactEntryIds.has(entry?.entryId))
  }
  if (!history[mesociclo].length) delete history[mesociclo]
  saveHistory(history)
}

// Elimina el historial completo de un mesociclo
export function clearHistoryForMesocycle(mesociclo) {
  const history = loadHistory()
  delete history[mesociclo]
  saveHistory(history)
}

// Formatea el historial como texto para enviar a la IA como contexto
export function formatHistoryAsContext(entries) {
  if (!entries.length) return ''
  return entries.map((entry) => {
    const lines = [`=== SEMANA ${entry.semana} — ${entry.titulo || ''} ===`]
    if (entry.resumen) {
      lines.push(`Estímulo: ${entry.resumen.estimulo || ''}`)
      lines.push(`Intensidad: ${entry.resumen.intensidad || ''}`)
      lines.push(`Foco: ${entry.resumen.foco || ''}`)
    }
    for (const dia of (entry.dias || [])) {
      lines.push(`\n${dia.nombre}:`)
      if (dia.wodFuncional) lines.push(`  EvoFuncional WOD: ${dia.wodFuncional}`)
      if (dia.wodBasics)    lines.push(`  EvoBasics WOD: ${dia.wodBasics}`)
      if (dia.wodFit)       lines.push(`  EvoFit WOD: ${dia.wodFit}`)
    }
    return lines.join('\n')
  }).join('\n\n')
}

// Extrae el bloque WOD del texto de una sesión
function extractWod(sessionText) {
  if (!sessionText) return ''
  // Busca desde "WOD" hasta el siguiente bloque con "("
  const match = sessionText.match(/WOD[^\n]*\n([\s\S]*?)(?=\(\d+['′]|\nFEEDBACK|$)/i)
  if (match) return match[1].trim().slice(0, 300)
  return ''
}
