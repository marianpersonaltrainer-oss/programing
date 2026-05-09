/** Espejo local de feedback de clase para resúmenes sin API (localStorage). */

import { normalizeProgramDayKey } from './coachMadridDay.js'

const KEY = 'programingevo_coach_feedback_local_v1'
const MAX = 400
const READ_KEY = 'programingevo_coach_feedback_reads_v1'

export function readFeedbackLog() {
  try {
    const r = localStorage.getItem(KEY)
    const o = r ? JSON.parse(r) : { entries: [] }
    return Array.isArray(o.entries) ? o : { entries: [] }
  } catch {
    return { entries: [] }
  }
}

function writeFeedbackLog(log) {
  try {
    localStorage.setItem(KEY, JSON.stringify(log))
  } catch {
    /* quota */
  }
}

export function appendFeedbackLogEntry(entry) {
  const log = readFeedbackLog()
  log.entries.push({
    ...entry,
    localOnlyId: `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    savedAt: new Date().toISOString(),
  })
  while (log.entries.length > MAX) log.entries.shift()
  writeFeedbackLog(log)
}

/** Evita duplicar filas del servidor (por id). */
export function mergeServerFeedbackIntoLog(rows, weekId, mesociclo, semana) {
  if (!Array.isArray(rows) || !rows.length) return
  const log = readFeedbackLog()
  const seen = new Set(log.entries.map((e) => e.id).filter(Boolean))
  for (const r of rows) {
    if (r?.id && seen.has(r.id)) continue
    log.entries.push({
      id: r.id,
      week_id: weekId ?? null,
      mesociclo: r.mesociclo ?? mesociclo ?? null,
      semana: r.semana != null ? Number(r.semana) : semana != null ? Number(semana) : null,
      day_key: normalizeProgramDayKey(r.day_key) ?? r.day_key,
      class_label: r.class_label,
      coach_name: r.coach_name ?? null,
      session_how: r.session_how,
      time_for_explanation: r.time_for_explanation,
      changed_something: r.changed_something,
      changed_details: r.changed_details,
      group_feelings: r.group_feelings,
      notes_next_week: r.notes_next_week,
      created_at: r.created_at,
      source: 'server',
    })
    if (r?.id) seen.add(r.id)
  }
  while (log.entries.length > MAX) log.entries.shift()
  writeFeedbackLog(log)
}

/**
 * Resumen de feedback en log local solo para la publicación concreta (`week_id`).
 * Solo coincidencia exacta `week_id`; no se usa mesociclo+semana para incluir filas.
 * Entradas sin `week_id` se ignoran.
 * @param {string|null|undefined} weekId
 * @param {{ dayKey?: string|null }} [opts] — si `dayKey` (monday…saturday), solo entradas de ese día de programación
 */
export function summarizeFeedbackForWeek(weekId, opts = {}) {
  const dayFilter = normalizeProgramDayKey(opts.dayKey)
  const { entries } = readFeedbackLog()
  if (weekId == null) {
    return {
      count: 0,
      timeSi: 0,
      timeNo: 0,
      timeJusto: 0,
      recentNotes: [],
      recentChanges: [],
    }
  }
  const wid = String(weekId)
  let filtered = entries.filter((e) => e.week_id != null && String(e.week_id) === wid)
  if (dayFilter) {
    filtered = filtered.filter((e) => normalizeProgramDayKey(e.day_key) === dayFilter)
  }

  let timeSi = 0
  let timeNo = 0
  let timeJusto = 0
  const recentNotes = []

  for (const e of filtered) {
    const te = e.time_for_explanation
    if (te === 'si') timeSi += 1
    else if (te === 'no') timeNo += 1
    else if (te === 'justo') timeJusto += 1
    const gf = String(e.group_feelings || '').trim()
    const nx = String(e.notes_next_week || '').trim()
    if (gf || nx) {
      recentNotes.push({
        group_feelings: gf,
        notes_next_week: nx,
        at: e.created_at || e.savedAt,
        class_label: e.class_label,
        day_key: e.day_key,
      })
    }
  }

  recentNotes.sort((a, b) => {
    const ta = a.at ? new Date(a.at).getTime() : 0
    const tb = b.at ? new Date(b.at).getTime() : 0
    return tb - ta
  })

  const recentChanges = []
  for (const e of filtered) {
    const ch =
      e.changed_something === true ||
      e.changed_something === 'true' ||
      e.changed_something === 1 ||
      e.changed_something === '1' ||
      e.changed_something === 't'
    if (!ch) continue
    recentChanges.push({
      text: String(e.changed_details || '').trim() || '(Sin detalle)',
      at: e.created_at || e.savedAt,
      class_label: e.class_label,
      day_key: e.day_key,
    })
  }
  recentChanges.sort((a, b) => {
    const ta = a.at ? new Date(a.at).getTime() : 0
    const tb = b.at ? new Date(b.at).getTime() : 0
    return tb - ta
  })

  return {
    count: filtered.length,
    timeSi,
    timeNo,
    timeJusto,
    recentNotes: recentNotes.slice(0, 12),
    recentChanges: recentChanges.slice(0, 12),
  }
}

/** ¿Este coach tiene al menos un feedback guardado (log local) para ese día de esa semana? */
export function coachHasFeedbackForDay(weekId, dayKey, coachName) {
  if (weekId == null || !dayKey) return false
  const cn = String(coachName || '')
    .trim()
    .toLowerCase()
  if (!cn) return false
  const { entries } = readFeedbackLog()
  const w = String(weekId)
  return entries.some((e) => {
    if (e.day_key !== dayKey) return false
    if (e.week_id == null || String(e.week_id) !== w) return false
    const en = String(e.coach_name || '')
      .trim()
      .toLowerCase()
    return en === cn
  })
}

function readReadMap() {
  try {
    const raw = localStorage.getItem(READ_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeReadMap(map) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(map))
  } catch {
    /* quota */
  }
}

export function feedbackReadScopeKey(weekId, coachName) {
  const w = weekId == null ? 'no_week' : String(weekId)
  const c = String(coachName || '')
    .trim()
    .toLowerCase()
  return `${w}::${c}`
}

/** @returns {Set<string>} */
export function getReadFeedbackIds(scopeKey) {
  if (!scopeKey) return new Set()
  const map = readReadMap()
  const arr = Array.isArray(map[scopeKey]) ? map[scopeKey] : []
  return new Set(arr.map((x) => String(x)))
}

export function markFeedbackRead(scopeKey, feedbackId) {
  if (!scopeKey || feedbackId == null) return
  const map = readReadMap()
  const prev = Array.isArray(map[scopeKey]) ? map[scopeKey] : []
  const nextSet = new Set(prev.map((x) => String(x)))
  nextSet.add(String(feedbackId))
  const trimmed = Array.from(nextSet).slice(-200)
  map[scopeKey] = trimmed
  writeReadMap(map)
}
