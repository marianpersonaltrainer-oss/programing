import { DAYS_ES } from '../constants/evoColors.js'
import { listWeeksLastYear } from '../lib/supabase.js'

const HISTORY_KEY = 'programingevo_history'
const ACTIVE_WEEK_KEY = 'programingevo_week'
const FEEDBACK_KEY = 'programingevo_coach_feedback_local_v1'

function safeJson(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function cleanOneLine(v) {
  return String(v || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(v, n) {
  const t = cleanOneLine(v)
  if (!t) return '—'
  return t.length > n ? `${t.slice(0, Math.max(0, n - 1)).trimEnd()}…` : t
}

function safeWeekText(day, keys) {
  for (const k of keys) {
    const val = day?.[k]
    if (String(val || '').trim()) return val
  }
  return ''
}

function parseHistoryAndActive(weekState) {
  const history = safeJson(localStorage.getItem(HISTORY_KEY), {})
  const active = safeJson(localStorage.getItem(ACTIVE_WEEK_KEY), {})

  const mesociclo = String(weekState?.mesocycle || active?.mesocycle || '').trim()
  const semanaActual = Number(weekState?.week ?? active?.week ?? 0) || 0
  const totalWeeks = Number(weekState?.totalWeeks ?? active?.totalWeeks ?? 0) || 0

  // Toma las semanas más recientes disponibles (sin asumir continuidad ni filtrar < semana actual).
  const weeks = Array.isArray(history?.[mesociclo]) ? [...history[mesociclo]] : []
  const recent = weeks
    .sort((a, b) => Number(b?.semana || 0) - Number(a?.semana || 0))
    .slice(0, 2)
  const previous = recent[0] || null

  return { mesociclo, semanaActual, totalWeeks, previous }
}

function buildPreviousWeekDays(previous) {
  const days = Array.isArray(previous?.dias) ? previous.dias : []
  const out = []
  for (const d of days) {
    const ef = truncate(safeWeekText(d, ['wodFuncional', 'evofuncional']), 150)
    const fit = truncate(safeWeekText(d, ['wodFit', 'evofit']), 150)
    const basics = truncate(safeWeekText(d, ['wodBasics', 'evobasics']), 150)
    const hasAny = [ef, fit, basics].some((x) => x && x !== '—')
    if (!hasAny) continue
    out.push([
      `${String(d?.nombre || '').toUpperCase()}:`,
      `  EvoFuncional → ${ef}`,
      `  EvoFit → ${fit}`,
      `  EvoBasics → ${basics}`,
    ].join('\n'))
  }
  return out.join('\n')
}

function buildCoachFeedbackSection(mesociclo, semanaAnterior) {
  const log = safeJson(localStorage.getItem(FEEDBACK_KEY), { entries: [] })
  const entries = Array.isArray(log?.entries) ? log.entries : []
  const filtered = entries
    .filter((e) => {
      const m = String(e?.mesociclo || '').trim()
      const s = Number(e?.semana || 0)
      return m && m === mesociclo && s === semanaAnterior
    })
    .sort((a, b) => {
      const ta = new Date(a?.created_at || a?.savedAt || 0).getTime() || 0
      const tb = new Date(b?.created_at || b?.savedAt || 0).getTime() || 0
      return tb - ta
    })

  if (!filtered.length) return '  (Sin feedback registrado)'

  return filtered
    .slice(0, 24)
    .map((e) => {
      const day = (DAYS_ES[e?.day_key] || e?.day_key || '—').toUpperCase()
      const klass = cleanOneLine(e?.class_label) || 'Clase'
      const coach = cleanOneLine(e?.coach_name) || 'Coach'
      const how = cleanOneLine(e?.session_how) || '—'
      const timing = cleanOneLine(e?.time_for_explanation) || '—'
      const next = cleanOneLine(e?.notes_next_week)
      const changed =
        e?.changed_something === true ||
        e?.changed_something === 1 ||
        e?.changed_something === '1' ||
        e?.changed_something === 'true'
      const changedText = cleanOneLine(e?.changed_details)
      const lines = [
        `  ${day} · ${klass} · ${coach}:`,
        `    Sesión: ${how} · Tiempo: ${timing}`,
      ]
      if (next) lines.push(`    Para la próxima: ${truncate(next, 220)}`)
      if (changed && changedText) lines.push(`    Cambió en sala: ${truncate(changedText, 220)}`)
      return lines.join('\n')
    })
    .join('\n')
}

function parseYearFocus(row) {
  const title = cleanOneLine(row?.title || 'Semana')
  const resumen = row?.resumen
  const foco =
    typeof resumen === 'string'
      ? cleanOneLine(resumen)
      : cleanOneLine(resumen?.foco || resumen?.focus || resumen?.estimulo || '')
  return `${title}: ${foco || 'sin foco'}`
}

async function buildLastYearSection() {
  const rows = await listWeeksLastYear(40)
  if (!rows.length) return '  (Sin datos de referencia)'
  const lines = []
  let used = 0
  for (const r of rows) {
    if (lines.length >= 15 || used >= 600) break
    const line = `  • ${truncate(parseYearFocus(r), 110)}`
    if (used + line.length + 1 > 600 && lines.length > 0) break
    lines.push(line)
    used += line.length + 1
  }
  return lines.join('\n')
}

export async function buildWeekContext(weekState) {
  const { mesociclo, semanaActual, totalWeeks, previous } = parseHistoryAndActive(weekState)
  if (!previous) return 'Primera semana del mesociclo. Sin historial previo.'

  const tituloAnterior = cleanOneLine(previous?.titulo) || `Semana ${Number(previous?.semana || 0)}`
  const resumen = previous?.resumen && typeof previous.resumen === 'object' ? previous.resumen : {}
  const foco = cleanOneLine(resumen?.foco) || '—'
  const intensidad = cleanOneLine(resumen?.intensidad) || '—'
  const nota = cleanOneLine(resumen?.nota) || '—'
  const semanaAnterior = Number(previous?.semana || Math.max(1, semanaActual - 1))
  const feedback = buildCoachFeedbackSection(mesociclo, semanaAnterior)
  const yearRef = await buildLastYearSection()
  const daysBlock = buildPreviousWeekDays(previous)

  return [
    `CONTEXTO DE LA SEMANA — ${mesociclo || 'MESOCICLO'} · S${semanaActual || '?'} de ${totalWeeks || '?'}`,
    '',
    `SEMANA ANTERIOR: ${tituloAnterior}`,
    `Foco: ${foco} · ${intensidad}`,
    `Nota del programador: ${nota}`,
    '',
    daysBlock || '(Sin días con sesión en historial)',
    '',
    'FEEDBACK DE COACHES:',
    feedback,
    '',
    'REFERENCIA ÚLTIMO AÑO (para no repetir focos):',
    yearRef,
  ].join('\n')
}

// Compatibilidad con imports anteriores.
export async function buildWeekContextMessage(weekState) {
  return buildWeekContext(weekState)
}
