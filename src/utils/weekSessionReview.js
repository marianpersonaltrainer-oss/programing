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

const LINE_SKIP_PREFIX_RE =
  /^(A\)|B\)|C\)|BIENVENIDA|CIERRE|CALENTAMIENTO|MOVILIDAD|SKILL|WOD|PARTE|BLOQUE|NOTA|FEEDBACK|FORMATO|AMRAP|EMOM|FOR\s+TIME|CHIPPER|TABATA|LADDER|TC\b|E\d+MOM|GESTI[OÓ]N)/i

const BORING_TOKEN_RE = /^(reps?|rep|rondas?|rounds?|min|mins?|seg|s|series|x|rm|tc|each|cada|desc|rest|score|objetivo)$/i

/** Fragmentos que parecen movimiento/accesorio (evita ruido de frases largas de coaching). */
const MOVEMENT_LIKE_RE =
  /\b(squat|sentadilla|press|row|remo|pull|push|deadlift|lunge|zancada|step|burpee|thruster|wall\s*ball|jump|swing|snatch|clean|jerk|dip|ring|muscle|toes|sit[\s-]?up|plank|carry|rdl|hinge|cluster|pike|handstand|box|copenhagen|pallof|kb|db|goblet|landmine|dominada|strict|kipping|c2b|lunges?|raises?|curls?|wall|shoulder|hip|bridge|raise|walk|rope|under|v[\s-]?up|negative|tempo|iso|isometric)\b/i

const WARMUP_TITLE_RE = /\b(calentamiento|warm[\s-]?up|movilidad\s+inicial|wod\s*prep)\b/i
const GENERIC_WARMUP_RE =
  /\b(movilidad\s+general|movilidad\s+articular|activacion\s+general|activaci[oó]n\s+general|trote\s+suave|cardio\s+suave)\b/i

function sessionWarmupIssue(raw) {
  const text = String(raw || '').trim()
  if (!text || isSessionPlaceholder(text)) return null
  const hasWarmupTitle = WARMUP_TITLE_RE.test(text)
  const hasGenericWarmup = GENERIC_WARMUP_RE.test(text)
  if (!hasWarmupTitle && !hasGenericWarmup) return null
  if (hasWarmupTitle && hasGenericWarmup) {
    return {
      severity: 'orange',
      hint:
        'Calentamiento genérico detectado: deja solo movilidad específica cuando sea estratégica; evita bloque fijo de warm-up.',
    }
  }
  return {
    severity: 'yellow',
    hint:
      'Hay bloque de calentamiento: confirma que aporta estrategia real (no obligatorio) y no es plantilla fija.',
  }
}

function tokenWorthTracking(norm) {
  if (!norm || norm.length < 6) return false
  if (norm.length >= 14) return true
  return MOVEMENT_LIKE_RE.test(norm)
}

/**
 * Trozos de texto que probablemente son movimientos o accesorios (misma columna, misma semana).
 * No sustituye al lift principal del bloque B; sirve para detectar step-ups, push-ups, etc. repetidos entre días.
 */
export function extractMovementTokensFromSessionText(raw) {
  const text = String(raw || '').trim()
  if (!text || isSessionPlaceholder(text)) return []
  const out = new Set()
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  for (const line of lines) {
    if (line.length > 110) continue
    if (LINE_SKIP_PREFIX_RE.test(line)) continue
    if (/OBJETIVO|FEEDBACK|PUNTOS DE ATENCI|C[OÓ]MO SE VA A SENTIR/i.test(line) && line.length > 35) continue
    if (/^[A-ZÁÉÍÓÚÑ0-9\s\-–—:.'"/]{6,}$/.test(line) && line.length < 56) continue
    const chunks = line.split(/\s*[/+|]\s*|\s*,\s+(?=[A-Za-zÁÉÍÓÚÑáéíóúñ])/)
    for (let chunk of chunks) {
      chunk = chunk
        .replace(/^\d+\s*([x×]|\b)?\s*/i, '')
        .replace(/@\s*[\d.%+-]+\s*/gi, '')
        .replace(/^\d+\s*['′"]\s*/i, '')
        .replace(/\(\s*\d+[^)]*\)/g, '')
        .trim()
      const n = normalizeMainExercise(chunk)
      if (!tokenWorthTracking(n)) continue
      const words = n.split(/\s+/).filter((w) => w && !BORING_TOKEN_RE.test(w))
      if (words.length === 0) continue
      if (words.length === 1 && n.length < 9) continue
      out.add(n)
    }
  }
  return [...out]
}

/**
 * Revisión orientativa de la semana para una clase (evoFuncional, etc.):
 * ejercicio principal duplicado, formatos de fuerza/WOD consecutivos, patrón muscular consecutivo,
 * abuso del mismo formato WOD / patrón muscular / formato de fuerza en muchos días de la misma semana,
 * y el mismo movimiento o accesorio repetido en varios días de la misma columna.
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
  const motionTokensByDay = []
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
    motionTokensByDay[i] = placeholder ? [] : extractMovementTokensFromSessionText(text)

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

  for (let i = 0; i < n; i += 1) {
    if (!hasProgram[i]) continue
    const issue = sessionWarmupIssue(String((dias?.[i] || {})[sessionKey] || ''))
    if (!issue) continue
    rows[i].severity = maxSeverity(rows[i].severity, issue.severity)
    rows[i].hints.push(issue.hint)
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

  /** Mismo formato WOD en 3+ días de la semana (aunque no sean consecutivos). */
  const wodCounts = new Map()
  const wodDayIndices = new Map()
  for (let i = 0; i < n; i += 1) {
    if (!hasProgram[i]) continue
    const w = wodByDay[i]
    if (!w) continue
    wodCounts.set(w, (wodCounts.get(w) || 0) + 1)
    if (!wodDayIndices.has(w)) wodDayIndices.set(w, [])
    wodDayIndices.get(w).push(i)
  }
  for (const [wid, count] of wodCounts) {
    if (count < 3) continue
    const label = wid.replace(/_/g, ' ')
    const msg = `Formato WOD «${label}» en ${count} días esta semana; rota (EMOM, Every, chipper, parejas, sprint, etc.).`
    for (const d of wodDayIndices.get(wid) || []) {
      rows[d].severity = maxSeverity(rows[d].severity, 'yellow')
      if (!rows[d].hints.includes(msg)) rows[d].hints.push(msg)
    }
  }

  /** Mismo patrón muscular en 4+ días (carga acumulada / monotonía). */
  const muscleCounts = new Map()
  const muscleDayIndices = new Map()
  for (let i = 0; i < n; i += 1) {
    if (!hasProgram[i]) continue
    const m = muscleByDay[i]
    if (!m) continue
    muscleCounts.set(m, (muscleCounts.get(m) || 0) + 1)
    if (!muscleDayIndices.has(m)) muscleDayIndices.set(m, [])
    muscleDayIndices.get(m).push(i)
  }
  for (const [mid, count] of muscleCounts) {
    if (count < 4) continue
    const label = mid.replace(/_/g, ' ')
    const msg = `Patrón muscular «${label}» en ${count} días; introduce otro patrón o descarga.`
    for (const d of muscleDayIndices.get(mid) || []) {
      rows[d].severity = maxSeverity(rows[d].severity, 'yellow')
      if (!rows[d].hints.includes(msg)) rows[d].hints.push(msg)
    }
  }

  /** Mismo formato de fuerza dominante en 3+ días (no solo consecutivos). */
  const forceCounts = new Map()
  const forceDayIndices = new Map()
  for (let i = 0; i < n; i += 1) {
    if (!hasProgram[i]) continue
    const f = forceByDay[i]
    if (!f) continue
    forceCounts.set(f, (forceCounts.get(f) || 0) + 1)
    if (!forceDayIndices.has(f)) forceDayIndices.set(f, [])
    forceDayIndices.get(f).push(i)
  }
  for (const [fid, count] of forceCounts) {
    if (count < 3) continue
    const label = fid.replace(/_/g, ' ')
    const msg = `Formato de fuerza «${label}» en ${count} días; alterna ondas / EMOM / series clásicas / cluster, etc.`
    for (const d of forceDayIndices.get(fid) || []) {
      rows[d].severity = maxSeverity(rows[d].severity, 'yellow')
      if (!rows[d].hints.includes(msg)) rows[d].hints.push(msg)
    }
  }

  /** Mismo movimiento/accesorio en 2+ días (texto de sesión; misma columna). Más grave si son días seguidos. */
  const tokenToDays = new Map()
  for (let i = 0; i < n; i += 1) {
    if (!hasProgram[i]) continue
    const mainN = mainNormByDay[i]
    for (const tok of motionTokensByDay[i] || []) {
      if (mainN && tok === mainN) continue
      if (!tokenToDays.has(tok)) tokenToDays.set(tok, [])
      tokenToDays.get(tok).push(i)
    }
  }
  for (const [tok, idxList] of tokenToDays) {
    const unique = [...new Set(idxList)].sort((a, b) => a - b)
    if (unique.length < 2) continue
    let hasConsecutive = false
    for (let k = 0; k < unique.length - 1; k += 1) {
      if (unique[k + 1] - unique[k] === 1) {
        hasConsecutive = true
        break
      }
    }
    const display = tok.length > 52 ? `${tok.slice(0, 49)}…` : tok
    const sev = hasConsecutive ? 'orange' : 'yellow'
    for (const d of unique) {
      const others = unique
        .filter((x) => x !== d)
        .map((x) => dayLabels[x] || `Día ${x + 1}`)
        .join(', ')
      const msg = `Movimiento o accesorio repetido en la semana («${display}»): también ${others}.`
      rows[d].severity = maxSeverity(rows[d].severity, sev)
      if (!rows[d].hints.includes(msg)) rows[d].hints.push(msg)
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
      '(Auditoría heurística: en el acumulado actual no se detectan duplicados de lift principal, ' +
      'formatos de fuerza/WOD consecutivos, abuso de formatos en la semana, ni el mismo movimiento/accesorio ' +
      'repetido entre días en las columnas revisadas.)'
    )
  }
  const max = 4500
  if (out.length > max) {
    out = `${out.slice(0, max).trim()}…\n[…auditoría truncada por tamaño]`
  }
  return out
}

function severityWeight(sev) {
  if (sev === 'red') return 3
  if (sev === 'orange') return 2
  if (sev === 'yellow') return 1
  return 0
}

/**
 * Score semanal (0-10) + días conflictivos para autocorrección.
 * Usa la misma heurística del panel, agregada por columnas seleccionadas.
 */
export function summarizeWeekQuality(dias, sessionKeys, resumenFoco = '') {
  const keys =
    Array.isArray(sessionKeys) && sessionKeys.length > 0
      ? sessionKeys
      : ['evofuncional', 'evobasics', 'evofit']

  const byClass = []
  const dayPenalty = new Map()
  let totalProgrammed = 0
  let redCount = 0
  let orangeCount = 0
  let yellowCount = 0

  for (const sk of keys) {
    const review = buildWeekSessionClassReview(dias || [], sk, { resumenFoco })
    const rows = review.rows || []
    const programmedRows = rows.filter((r) => !r.placeholder)
    const reds = programmedRows.filter((r) => r.severity === 'red').length
    const oranges = programmedRows.filter((r) => r.severity === 'orange').length
    const yellows = programmedRows.filter((r) => r.severity === 'yellow').length
    totalProgrammed += programmedRows.length
    redCount += reds
    orangeCount += oranges
    yellowCount += yellows

    for (const r of programmedRows) {
      const w = severityWeight(r.severity)
      if (!w) continue
      dayPenalty.set(r.dayIdx, (dayPenalty.get(r.dayIdx) || 0) + w)
    }

    byClass.push({
      key: sk,
      hasAnyProgram: review.hasAnyProgram,
      reds,
      oranges,
      yellows,
    })
  }

  const weightedIssues = redCount * 3 + orangeCount * 2 + yellowCount
  const denom = Math.max(1, totalProgrammed * 3)
  const issueRatio = Math.min(1, weightedIssues / denom)
  const score = Math.max(0, Math.min(10, Number((10 - issueRatio * 10).toFixed(1))))

  const blockingDayIdx = [...dayPenalty.entries()]
    .filter(([, p]) => p >= 4)
    .map(([idx]) => idx)
    .sort((a, b) => a - b)

  return {
    score,
    totalProgrammed,
    redCount,
    orangeCount,
    yellowCount,
    blockingDayIdx,
    byClass,
    hasBlocking: redCount > 0 || blockingDayIdx.length > 0,
  }
}
