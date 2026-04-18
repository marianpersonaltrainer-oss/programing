import { extractMainExerciseFromBlockB } from './sessionBlockB'
import { EVO_SESSION_CLASS_DEFS } from '../constants/evoClasses.js'

const SEVERITY_RANK = { ok: 0, yellow: 1, orange: 2, red: 3 }

function maxSeverity(a, b) {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b
}

/** Misma heurística que buildWeeklyClassBSummary en ExcelGeneratorModal */
export function isSessionPlaceholder(raw) {
  const s = String(raw || '').trim()
  if (!s) return true
  if (/^\(no programada esta semana\)\s*$/i.test(s)) return true
  if (/^FESTIVO\b/i.test(s)) return true
  return false
}

function normalizeMainExercise(s) {
  const base = String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return base
    .replace(/@\s*[\d.]+%?/gi, '')
    .replace(/[^a-z0-9áéíóúñü\s/+().-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const FORCE_PATTERNS = [
  { id: 'wave', re: /\bwave\b|loading\s*onda|\bonda[s]?\b/i },
  { id: 'emom_interval', re: /\bE2MOM\b|\bE2:30\b|\bE3:00\b|every\s*1:?30|every\s*2|ODD\s*\/\s*EVEN|odd\s*\/\s*even/i },
  { id: 'emom', re: /\bEMOM\b/i },
  { id: 'cluster', re: /\bcluster\b|3\.1\.1/i },
  { id: 'rest_pause', re: /rest[\s-]*pause|pausa\s*15/i },
  { id: 'for_load', re: /\bfor\s+load\b|subir.*carga.*cada.*ronda/i },
  { id: 'biseries', re: /\bA1\b.*\bA2\b|\bbiserie\b/i },
  { id: 'pyramid', re: /pir[aá]mide/i },
  { id: 'squat_party', re: /squat\s+party/i },
]

const WOD_PATTERNS = [
  { id: 'amrap', re: /\bAMRAP\b/i },
  { id: 'for_time', re: /\bFOR\s+TIME\b|\bFOR-TIME\b/i },
  { id: 'chipper', re: /\bCHIPPER\b|\bTC\b|time\s*cap/i },
  { id: 'tabata', re: /\bTABATA\b/i },
  { id: 'emom_wod', re: /\bWOD\b.*\bEMOM\b|\bEMOM\b.*\bWOD\b/i },
]

/** Orden: patrones más específicos antes (bisagra antes de rodilla genérica). */
const MUSCLE_PATTERNS = [
  { id: 'bisagra', re: /\b(bisagra|hinge|deadlift|rdl|rumano|sumo|hip\s*thrust|good\s*morning|peso\s*muerto)\b/i },
  { id: 'tiron', re: /\b(tiron|tir[oó]n|pull|dominada|pull-up|pullup|c2b|remo|row|tracci[oó]n)\b/i },
  { id: 'empuje', re: /\b(press|push|hombro|bench|pector|pecho|empuje|triceps|tr[ií]ceps|dip|jerk|overhead)\b/i },
  { id: 'rodilla', re: /\b(squat|sentadilla|lunge|zancada|step|wall\s*ball|thruster|rodilla)\b/i },
]

function firstMatchId(text, patterns) {
  const t = String(text || '')
  for (const { id, re } of patterns) {
    if (re.test(t)) return id
  }
  return ''
}

export function detectForceFormatBucket(text) {
  return firstMatchId(text, FORCE_PATTERNS)
}

export function detectWodFormatBucket(text) {
  return firstMatchId(text, WOD_PATTERNS)
}

export function detectMusclePatternBucket(text, resumenFoco) {
  const combined = [text, resumenFoco || ''].filter(Boolean).join('\n')
  return firstMatchId(combined, MUSCLE_PATTERNS)
}

/**
 * Revisión orientativa de la semana para una clase (evoFuncional, etc.):
 * ejercicio principal duplicado, formatos de fuerza/WOD consecutivos, patrón muscular consecutivo.
 */
export function buildWeekSessionClassReview(dias, sessionKey, options = {}) {
  const resumenFoco = options.resumenFoco || ''
  const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const n = Array.isArray(dias) ? dias.length : 0

  const rows = []
  const mainNormByDay = []
  const forceByDay = []
  const wodByDay = []
  const muscleByDay = []
  const hasProgram = []

  for (let i = 0; i < n; i += 1) {
    const dia = dias[i] || {}
    const raw = dia[sessionKey]
    const text = String(raw || '')
    const placeholder = isSessionPlaceholder(text)
    hasProgram[i] = !placeholder

    const mainLine = placeholder ? '' : extractMainExerciseFromBlockB(text)
    const mainNorm = mainLine ? normalizeMainExercise(mainLine) : ''
    mainNormByDay[i] = mainNorm

    const force = placeholder ? '' : detectForceFormatBucket(text)
    const wod = placeholder ? '' : detectWodFormatBucket(text)
    const muscle = placeholder ? '' : detectMusclePatternBucket(text, resumenFoco)
    forceByDay[i] = force
    wodByDay[i] = wod
    muscleByDay[i] = muscle

    rows.push({
      dayIdx: i,
      dayLabel: dayLabels[i] || `Día ${i + 1}`,
      mainLine: mainLine || '—',
      mainNorm,
      severity: 'ok',
      hints: [],
      _force: force,
      _wod: wod,
      _muscle: muscle,
      placeholder,
    })
  }

  const normToDays = new Map()
  for (let i = 0; i < n; i += 1) {
    const norm = mainNormByDay[i]
    if (!norm || !hasProgram[i]) continue
    if (!normToDays.has(norm)) normToDays.set(norm, [])
    normToDays.get(norm).push(i)
  }
  for (const dayIdxList of normToDays.values()) {
    if (dayIdxList.length < 2) continue
    const names = dayIdxList.map((d) => dayLabels[d] || `Día ${d + 1}`).join(', ')
    const msg = `Mismo ejercicio principal que ${names}`
    for (const d of dayIdxList) {
      rows[d].severity = maxSeverity(rows[d].severity, 'red')
      rows[d].hints.push(msg)
    }
  }

  for (let i = 0; i < n - 1; i += 1) {
    if (!hasProgram[i] || !hasProgram[i + 1]) continue
    const f1 = forceByDay[i]
    const f2 = forceByDay[i + 1]
    if (f1 && f2 && f1 === f2) {
      const msg = `Mismo formato de fuerza que ${dayLabels[i + 1] || 'siguiente'} (${f1.replace(/_/g, ' ')})`
      rows[i].severity = maxSeverity(rows[i].severity, 'orange')
      rows[i].hints.push(msg)
      rows[i + 1].severity = maxSeverity(rows[i + 1].severity, 'orange')
      rows[i + 1].hints.push(`Mismo formato de fuerza que ${dayLabels[i] || 'anterior'} (${f1.replace(/_/g, ' ')})`)
    }
    const w1 = wodByDay[i]
    const w2 = wodByDay[i + 1]
    if (w1 && w2 && w1 === w2) {
      const msg = `Mismo formato de WOD que ${dayLabels[i + 1] || 'siguiente'}`
      rows[i].severity = maxSeverity(rows[i].severity, 'orange')
      rows[i].hints.push(msg)
      rows[i + 1].severity = maxSeverity(rows[i + 1].severity, 'orange')
      rows[i + 1].hints.push(`Mismo formato de WOD que ${dayLabels[i] || 'anterior'}`)
    }
    const m1 = muscleByDay[i]
    const m2 = muscleByDay[i + 1]
    if (m1 && m2 && m1 === m2) {
      const label = m1.replace(/_/g, ' ')
      rows[i].severity = maxSeverity(rows[i].severity, 'yellow')
      rows[i].hints.push(`Patrón muscular similar a ${dayLabels[i + 1] || 'siguiente'} (${label})`)
      rows[i + 1].severity = maxSeverity(rows[i + 1].severity, 'yellow')
      rows[i + 1].hints.push(`Patrón muscular similar a ${dayLabels[i] || 'anterior'} (${label})`)
    }
  }

  let hasAnyIssue = false
  let allClear = true
  for (const r of rows) {
    if (r.placeholder) continue
    if (r.severity !== 'ok') hasAnyIssue = true
    if (r.severity !== 'ok') allClear = false
  }
  const hasAnyProgram = rows.some((r) => !r.placeholder)
  if (!hasAnyProgram) allClear = false

  const publicRows = rows.map(
    ({ dayIdx, dayLabel, mainLine, severity, hints, placeholder }) => ({
      dayIdx,
      dayLabel,
      mainLine,
      severity,
      hints,
      placeholder,
    }),
  )

  return { rows: publicRows, hasAnyIssue, allClear, hasAnyProgram }
}

/**
 * Mismo criterio que el panel lateral (rojo/naranja/amarillo), en texto breve para el prompt de generación.
 * `sessionKeys`: slugs de columna (p. ej. evofuncional). Si viene vacío, usa las tres columnas principales.
 */
export function formatReviewHintsForGenerationPrompt(dias, sessionKeys, resumenFoco = '') {
  const keys =
    Array.isArray(sessionKeys) && sessionKeys.length > 0
      ? sessionKeys
      : ['evofuncional', 'evobasics', 'evofit']
  const lines = []
  const foco = String(resumenFoco || '').trim()

  for (const sk of keys) {
    const { rows } = buildWeekSessionClassReview(dias, sk, { resumenFoco: foco })
    const label = EVO_SESSION_CLASS_DEFS.find((d) => d.key === sk)?.label || sk
    const flagged = rows.filter((r) => !r.placeholder && r.hints.length > 0)
    if (!flagged.length) continue
    lines.push(`### ${label}`)
    for (const r of flagged) {
      const tag = r.severity === 'ok' ? '' : `[${r.severity}] `
      const hintText = r.hints.join(' · ')
      lines.push(`- ${r.dayLabel}: ${tag}${hintText}`.trim())
    }
  }

  let out = lines.join('\n').trim()
  if (!out) {
    return (
      '(Auditoría heurística: en el acumulado actual no se detectan duplicados de lift principal ni ' +
      'formatos de fuerza/WOD consecutivos en las columnas revisadas.)'
    )
  }
  const max = 4500
  if (out.length > max) {
    out = `${out.slice(0, max).trim()}…\n[…auditoría truncada por tamaño]`
  }
  return out
}
