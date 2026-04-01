/** Espejo local de feedback de clase para resúmenes sin API (localStorage). */

const KEY = 'programingevo_coach_feedback_local_v1'
const MAX = 400

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
      day_key: r.day_key,
      class_label: r.class_label,
      session_how: r.session_how,
      time_for_explanation: r.time_for_explanation,
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

const HOW_KEYS = ['muy_bien', 'bien', 'regular', 'mal']

export function summarizeFeedbackForWeek(weekId, mesociclo, semana) {
  const { entries } = readFeedbackLog()
  const filtered = entries.filter((e) => {
    if (weekId != null && e.week_id != null && String(e.week_id) === String(weekId)) return true
    if (mesociclo != null && semana != null && e.mesociclo === mesociclo && Number(e.semana) === Number(semana))
      return true
    return false
  })

  const how = { muy_bien: 0, bien: 0, regular: 0, mal: 0 }
  let timeSi = 0
  let timeNo = 0
  let timeJusto = 0
  const recentNotes = []

  for (const e of filtered) {
    const sh = e.session_how
    if (sh && HOW_KEYS.includes(sh)) how[sh] += 1
    const te = e.time_for_explanation
    if (te === 'si') timeSi += 1
    else if (te === 'no') timeNo += 1
    else if (te === 'justo') timeJusto += 1
    const parts = [e.group_feelings, e.notes_next_week].filter((x) => String(x || '').trim())
    if (parts.length) {
      recentNotes.push({
        note: parts.join(' · '),
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

  return {
    count: filtered.length,
    how,
    timeSi,
    timeNo,
    timeJusto,
    recentNotes: recentNotes.slice(0, 10),
  }
}
