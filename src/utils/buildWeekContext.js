import { DAYS_ES } from '../constants/evoColors.js'
import { EVO_SESSION_CLASS_DEFS } from '../constants/evoClasses.js'
import {
  listCoachSessionFeedback,
  listPublishedWeekVersionsForMesocycle,
} from '../lib/supabase.js'
import {
  addProgrammingDays,
  filterFeedbackForSelectedWeekIds,
  getProgrammingMesocycle,
  getProgrammingWeekNumber,
  getProgrammingWeekStartDate,
  normalizeProgrammingDate,
  selectProgrammingContextWeeks,
} from './programmingContextSelection.js'

const HISTORY_KEY = 'programingevo_history'
const ALLOWED_PUBLICATION_STATES = new Set(['published', 'superseded'])

function safeJson(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function cleanOneLine(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(value, length) {
  const text = cleanOneLine(value)
  if (!text) return '—'
  return text.length > length
    ? `${text.slice(0, Math.max(0, length - 1)).trimEnd()}…`
    : text
}

function safeWeekText(day, keys) {
  for (const key of keys) {
    const value = day?.[key]
    if (String(value || '').trim()) return value
  }
  return ''
}

function normalizePublicationState(row) {
  return cleanOneLine(
    row?.publication_status ??
      row?.publication_state ??
      row?.status ??
      row?.data?.publication_status ??
      row?.data?.publication_state ??
      row?.data?.status,
  ).toLowerCase()
}

function isAllowedPublishedVersion(row) {
  return ALLOWED_PUBLICATION_STATES.has(normalizePublicationState(row))
}

function readLocalHistory() {
  if (typeof localStorage === 'undefined') return {}
  return safeJson(localStorage.getItem(HISTORY_KEY), {})
}

/**
 * Construye una identidad completa y estable para el objetivo del chat.
 * cycleStartDate y weekStartDate se pueden derivar entre sí, pero nunca se
 * infieren de otra semana almacenada.
 */
export function buildWeekContextTarget(weekState) {
  const mesocycle = cleanOneLine(weekState?.mesocycle ?? weekState?.mesociclo)
  const week = Number(weekState?.week ?? weekState?.semana)
  const normalizedWeek = Number.isInteger(week) && week > 0 ? week : null

  let cycleStartDate = normalizeProgrammingDate(
    weekState?.cycleStartDate ?? weekState?.cycle_start_date,
  )
  let weekStartDate = normalizeProgrammingDate(
    weekState?.weekStartDate ?? weekState?.week_start_date,
  )

  if (!weekStartDate && cycleStartDate && normalizedWeek) {
    weekStartDate = addProgrammingDays(cycleStartDate, (normalizedWeek - 1) * 7)
  }
  if (!cycleStartDate && weekStartDate && normalizedWeek) {
    cycleStartDate = addProgrammingDays(weekStartDate, -(normalizedWeek - 1) * 7)
  }

  const providedCycleId = cleanOneLine(
    weekState?.cycleId ?? weekState?.cycle_id,
  )
  const canonicalCycleId =
    mesocycle && cycleStartDate ? `${mesocycle}:${cycleStartDate}` : ''
  const cycleId = providedCycleId || canonicalCycleId
  const expectedWeekStartDate =
    cycleStartDate && normalizedWeek
      ? addProgrammingDays(cycleStartDate, (normalizedWeek - 1) * 7)
      : ''
  const identityConsistent =
    (!providedCycleId || providedCycleId === canonicalCycleId) &&
    (!weekStartDate ||
      !expectedWeekStartDate ||
      weekStartDate === expectedWeekStartDate)

  return {
    mesociclo: mesocycle,
    semana: normalizedWeek,
    totalWeeks: Number(weekState?.totalWeeks ?? weekState?.total_weeks) || null,
    phase: cleanOneLine(weekState?.phase),
    cycle_id: cycleId,
    cycle_start_date: cycleStartDate,
    week_start_date: weekStartDate,
    identity_consistent: identityConsistent,
    exact:
      !!mesocycle &&
      !!normalizedWeek &&
      !!cycleId &&
      !!cycleStartDate &&
      !!weekStartDate &&
      identityConsistent,
  }
}

export function weekContextTargetKey(weekStateOrTarget) {
  const target = buildWeekContextTarget(weekStateOrTarget)
  return [
    target.mesociclo.toLowerCase(),
    target.semana || '',
    target.cycle_id,
    target.cycle_start_date,
    target.week_start_date,
    target.totalWeeks || '',
    target.phase.toLowerCase(),
  ].join('|')
}

function assertExactTarget(target) {
  if (!target.exact) {
    throw new Error(
      'Selecciona mesociclo, semana e inicio real del ciclo antes de usar el asistente.',
    )
  }
}

function localHistoryRows(history, target) {
  const entries = Array.isArray(history?.[target.mesociclo])
    ? history[target.mesociclo]
    : []

  return entries
    .map((entry) => {
      const full =
        entry?.weekDataFull && typeof entry.weekDataFull === 'object'
          ? entry.weekDataFull
          : {}
      const publicationStatus = normalizePublicationState({
        ...full,
        ...entry,
        data: full,
      })
      const publishedAt =
        entry?.published_at ??
        entry?.publishedAt ??
        full?.published_at ??
        full?.publishedAt ??
        ''

      return {
        id:
          entry?.published_week_id ??
          entry?.publishedWeekId ??
          entry?.source_week_id ??
          entry?.sourceWeekId ??
          full?.id ??
          '',
        mesociclo: entry?.mesociclo ?? full?.mesociclo ?? target.mesociclo,
        semana: entry?.semana ?? full?.semana,
        publication_status: publicationStatus,
        published_at: publishedAt,
        cycle_id:
          entry?.cycle_id ??
          entry?.cycleId ??
          full?.cycle_id ??
          full?.cycleId ??
          full?.meta?.cycle_id ??
          full?.meta?.cycleId,
        cycle_start_date:
          entry?.cycle_start_date ??
          entry?.cycleStartDate ??
          full?.cycle_start_date ??
          full?.cycleStartDate ??
          full?.meta?.cycle_start_date ??
          full?.meta?.cycleStartDate,
        week_start_date:
          entry?.week_start_date ??
          entry?.weekStartDate ??
          full?.week_start_date ??
          full?.weekStartDate ??
          full?.meta?.week_start_date ??
          full?.meta?.weekStartDate,
        data: full,
      }
    })
    .filter((row) => row.id && row.published_at && isAllowedPublishedVersion(row))
}

/**
 * Los borradores locales no son memoria histórica. Solo se aceptan copias
 * locales identificadas explícitamente como versiones publicadas/sustituidas;
 * selectProgrammingContextWeeks exige además mismo ciclo, fecha exacta y S menor.
 */
export function selectLocalProgrammingContextWeeks(history, weekState, options = {}) {
  const target = buildWeekContextTarget(weekState)
  if (!target.exact) {
    return {
      progressionWeeks: [],
      historicalReferenceWeeks: [],
      selectedWeekIds: [],
      mode: 'incomplete-target',
    }
  }
  return selectProgrammingContextWeeks(localHistoryRows(history || {}, target), target, options)
}

function rowWeekData(row) {
  if (row?.data && typeof row.data === 'object') return row.data
  if (row?.weekDataFull && typeof row.weekDataFull === 'object') return row.weekDataFull
  return row && typeof row === 'object' ? row : {}
}

function rowDays(row) {
  const data = rowWeekData(row)
  return Array.isArray(data?.dias) ? data.dias : []
}

function buildWeekDays(row) {
  const out = []
  for (const day of rowDays(row)) {
    const legacyAliases = {
      evofuncional: ['wodFuncional'],
      evobasics: ['wodBasics'],
      evofit: ['wodFit'],
      evohybrix: ['wodHybrix'],
      evofuerza: ['wodFuerza'],
      evogimnastica: ['wodGimnastica'],
      evotodos: ['wodTodos'],
    }
    const sessions = EVO_SESSION_CLASS_DEFS.map(({ key, label }) => ({
      label,
      text: truncate(
        safeWeekText(day, [...(legacyAliases[key] || []), key]),
        key === 'evofuncional' ? 1400 : 1200,
      ),
    })).filter(({ text }) => text && text !== '—')

    if (!sessions.length) continue
    out.push([
      `${String(day?.nombre || '').toUpperCase()}:`,
      ...sessions.map(({ label, text }) => `  ${label} → ${text}`),
    ].join('\n'))
  }
  return out.join('\n')
}

function weekSummary(row) {
  const data = rowWeekData(row)
  const summary =
    data?.resumen && typeof data.resumen === 'object' ? data.resumen : {}
  const title =
    cleanOneLine(data?.titulo ?? row?.titulo) ||
    `Semana ${getProgrammingWeekNumber(row) || '?'}`
  const focus = cleanOneLine(summary?.foco ?? summary?.focus) || '—'
  const intensity = cleanOneLine(summary?.intensidad) || '—'
  return `${title} · ${getProgrammingWeekStartDate(row) || 'sin fecha'} · Foco: ${focus} · ${intensity}`
}

function buildProgressionSection(rows) {
  const weeks = Array.isArray(rows) ? rows : []
  if (!weeks.length) return '  (Primera semana del ciclo; sin progresión publicada anterior)'

  return weeks
    .map((row) => {
      const days = buildWeekDays(row)
      return [
        `S${getProgrammingWeekNumber(row)} — ${weekSummary(row)}`,
        days || '  (Sin sesiones legibles)',
      ].join('\n')
    })
    .join('\n\n')
}

function buildHistoricalReferenceSection(rows) {
  const weeks = Array.isArray(rows) ? rows : []
  if (!weeks.length) return '  (Sin referencias históricas seleccionadas)'
  return weeks
    .map(
      (row) =>
        `  • ${getProgrammingMesocycle(row)} · S${getProgrammingWeekNumber(row)} · ${weekSummary(row)}`,
    )
    .join('\n')
}

function buildCoachFeedbackSection(rows, selectedWeeks) {
  const entries = Array.isArray(rows) ? rows : []
  if (!entries.length) return '  (Sin feedback registrado para las versiones seleccionadas)'

  const weekById = new Map(
    (selectedWeeks || []).map((row) => [
      String(row?.id || ''),
      getProgrammingWeekNumber(row),
    ]),
  )

  return entries
    .slice()
    .sort((a, b) => {
      const left = new Date(a?.created_at || 0).getTime() || 0
      const right = new Date(b?.created_at || 0).getTime() || 0
      return right - left
    })
    .slice(0, 24)
    .map((entry) => {
      const day = (
        DAYS_ES[entry?.day_key] ||
        entry?.day_key ||
        '—'
      ).toUpperCase()
      const klass = cleanOneLine(entry?.class_label) || 'Clase'
      const coach = cleanOneLine(entry?.coach_name) || 'Coach'
      const how = cleanOneLine(entry?.session_how) || '—'
      const timing = cleanOneLine(entry?.time_for_explanation) || '—'
      const next = cleanOneLine(entry?.notes_next_week)
      const changed =
        entry?.changed_something === true ||
        entry?.changed_something === 1 ||
        entry?.changed_something === '1' ||
        entry?.changed_something === 'true'
      const changedText = cleanOneLine(entry?.changed_details)
      const week = weekById.get(String(entry?.week_id || ''))
      const lines = [
        `  S${week || '?'} · ${day} · ${klass} · ${coach}:`,
        `    Sesión: ${how} · Tiempo: ${timing}`,
      ]
      if (next) lines.push(`    Para la próxima: ${truncate(next, 220)}`)
      if (changed && changedText) {
        lines.push(`    Cambió en sala: ${truncate(changedText, 220)}`)
      }
      return lines.join('\n')
    })
    .join('\n')
}

export function renderWeekContext({
  target,
  progressionWeeks,
  historicalReferenceWeeks,
  coachFeedback,
}) {
  const selectedWeeks = [
    ...(progressionWeeks || []),
    ...(historicalReferenceWeeks || []),
  ]
  return [
    `CONTEXTO EXACTO — ${target.mesociclo} · S${target.semana} de ${target.totalWeeks || '?'}`,
    `Ciclo: ${target.cycle_id}`,
    `Inicio ciclo: ${target.cycle_start_date} · Inicio semana: ${target.week_start_date}`,
    target.phase ? `Fase: ${target.phase}` : '',
    '',
    'PROGRESIÓN PUBLICADA DEL CICLO (solo semanas anteriores exactas):',
    buildProgressionSection(progressionWeeks),
    '',
    'REFERENCIAS HISTÓRICAS SEPARADAS (no son progresión):',
    buildHistoricalReferenceSection(historicalReferenceWeeks),
    '',
    'FEEDBACK DE COACHES (solo IDs de versiones seleccionadas):',
    buildCoachFeedbackSection(coachFeedback, selectedWeeks),
  ]
    .filter((line, index, lines) => line !== '' || lines[index - 1] !== '')
    .join('\n')
}

/**
 * Carga un snapshot inmutable del contexto exacto. Las dependencias se pueden
 * inyectar para probar selección y carreras sin acceder a red.
 */
export async function loadExactWeekContext(weekState, dependencies = {}) {
  const target = buildWeekContextTarget(weekState)
  assertExactTarget(target)

  const listVersions =
    dependencies.listPublishedWeekVersionsForMesocycle ||
    listPublishedWeekVersionsForMesocycle
  const listFeedback =
    dependencies.listCoachSessionFeedback || listCoachSessionFeedback
  const history =
    dependencies.localHistory === undefined
      ? readLocalHistory()
      : dependencies.localHistory

  const remoteRows = await listVersions(target.mesociclo)
  const allowedRemoteRows = (Array.isArray(remoteRows) ? remoteRows : []).filter(
    isAllowedPublishedVersion,
  )
  const allowedLocalRows = localHistoryRows(history || {}, target)
  const selection = selectProgrammingContextWeeks(
    [...allowedRemoteRows, ...allowedLocalRows],
    target,
    {
      progressionLimit: dependencies.progressionLimit || 6,
      historicalLimit:
        dependencies.historicalLimit === undefined
          ? 6
          : dependencies.historicalLimit,
    },
  )

  if (selection.mode !== 'exact-cycle-date') {
    throw new Error('No se pudo verificar el ciclo y la fecha exactos del contexto.')
  }

  const feedbackRows = selection.selectedWeekIds.length
    ? await listFeedback()
    : []
  const coachFeedback = filterFeedbackForSelectedWeekIds(
    feedbackRows,
    selection.selectedWeekIds,
  )

  const snapshot = {
    target,
    targetKey: weekContextTargetKey(target),
    progressionWeeks: selection.progressionWeeks,
    historicalReferenceWeeks: selection.historicalReferenceWeeks,
    selectedWeekIds: selection.selectedWeekIds,
    coachFeedback,
  }

  return {
    ...snapshot,
    text: renderWeekContext(snapshot),
  }
}

export async function buildWeekContext(weekState, preparedContext = null) {
  const expectedKey = weekContextTargetKey(weekState)
  if (preparedContext) {
    if (preparedContext.targetKey !== expectedKey) {
      throw new Error('El contexto cargado pertenece a otra semana o ciclo.')
    }
    return preparedContext.text || renderWeekContext(preparedContext)
  }
  const loaded = await loadExactWeekContext(weekState)
  return loaded.text
}

// Compatibilidad con imports anteriores.
export async function buildWeekContextMessage(weekState) {
  return buildWeekContext(weekState)
}
