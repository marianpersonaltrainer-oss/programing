import ExcelJS from 'exceljs'
import { EVO_SESSION_CLASS_DEFS } from '../constants/evoClasses.js'
import { EXCEL_DAY_ORDER, buildWeekSkeleton } from './excelGenerationPlan.js'
import { importProgramingEvoWeekFromXlsxBuffer } from './importProgramingEvoWeekXlsx.js'

const CORE_CLASS_KEYS = ['evofuncional', 'evobasics', 'evofit']
const CLASS_BY_KEY = Object.fromEntries(EVO_SESSION_CLASS_DEFS.map((c) => [c.key, c]))
const CLASS_BY_LABEL_NORM = Object.fromEntries(
  EVO_SESSION_CLASS_DEFS.map((c) => [normalize(c.label), c]),
)

function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

function wordCount(s) {
  return String(s || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

function isRealSessionText(text) {
  const t = String(text || '').trim()
  return !!t && !/\(no programada esta semana\)/i.test(t)
}

function extractMinutes(text) {
  const s = String(text || '')
  let total = 0
  const aps = [...s.matchAll(/\b(amrap|for\s*time)\s*(\d{1,2})\s*['’m]?\b/gi)]
  for (const m of aps) total += Number(m[2] || 0)
  const every = [...s.matchAll(/\bevery\s+(\d{1,2})[:.]?(\d{0,2})?\s*(?:x|por)\s*(\d{1,2})\b/gi)]
  for (const m of every) {
    const mins = Number(m[1] || 0) + Number(m[2] || 0) / 60
    const rounds = Number(m[3] || 0)
    total += mins * rounds
  }
  const emom = [...s.matchAll(/\bemom\s*(\d{1,2})\b/gi)]
  for (const m of emom) total += Number(m[1] || 0)
  const minTok = [...s.matchAll(/\b(\d{1,2})\s*(?:min|')\b/gi)]
  for (const m of minTok) total += Number(m[1] || 0)
  return total
}

function detectWodFormat(text) {
  const s = normalize(text)
  if (s.includes('amrap')) return 'AMRAP'
  if (s.includes('for time')) return 'FOR TIME'
  if (s.includes('emom')) return 'EMOM'
  if (s.includes('every')) return 'EVERY'
  if (s.includes('ladder')) return 'LADDER'
  return 'OTRO'
}

function splitPartAB(text) {
  const s = String(text || '')
  const mA = s.match(/parte\s*a[\s\S]*?(?=parte\s*b|$)/i)
  const mB = s.match(/parte\s*b[\s\S]*$/i)
  return {
    a: (mA ? mA[0] : '').replace(/parte\s*a[:\s]*/i, '').trim(),
    b: (mB ? mB[0] : '').replace(/parte\s*b[:\s]*/i, '').trim(),
  }
}

function movementPattern(text) {
  const s = normalize(text)
  if (/\b(push|press|flexion|fondos)\b/.test(s)) return 'push'
  if (/\b(pull|row|remo|dominada|jalon)\b/.test(s)) return 'pull'
  if (/\b(squat|sentadilla|zancada|lunge)\b/.test(s)) return 'squat'
  if (/\b(deadlift|rdl|hinge|peso muerto|bisagra|hip thrust)\b/.test(s)) return 'hinge'
  return 'other'
}

function extractExercises(text) {
  const s = String(text || '')
  const lines = s
    .replace(/\r/g, '\n')
    .split(/\n|,|;|•/g)
    .map((x) => x.trim())
    .filter(Boolean)
  const out = new Set()
  for (const l of lines) {
    const c = normalize(
      l
        .replace(/\([^)]*\)/g, ' ')
        .replace(/@\s*[\w.,+-/:%]+/g, ' ')
        .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    if (c.length < 4) continue
    if (/^(parte a|parte b|feedback|amrap|for time|emom|every)$/.test(c)) continue
    out.add(c)
  }
  return out
}

function buildClaudeReport({ week, mesocycle, phase, score, alerts, passed, failed }) {
  const lines = [
    `INFORME SCORING S${week} – ${String(mesocycle || '').toUpperCase()} – ${String(phase || 'SIN FASE').toUpperCase()}`,
    `Score total: ${score}/100`,
    '',
    'ALERTAS:',
    ...(alerts.length ? alerts.map((a) => `- ${a}`) : ['- Sin alertas críticas']),
    '',
    'APROBADO:',
    ...(passed.length ? passed.map((p) => `- ${p}`) : ['- (vacío)']),
    '',
    'PENDIENTE DE CORRECCIÓN:',
    ...(failed.length ? failed.map((f) => `- ${f}`) : ['- (vacío)']),
  ]
  return lines.join('\n')
}

async function scanStructureFromWorkbook(buffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const sheet = wb.worksheets.find((w) => /^s\d+$/i.test(String(w.name || '').trim())) || wb.worksheets[0]
  if (!sheet) throw new Error('No se detectó hoja principal S1/S2...')
  const maxR = sheet.lastRow?.number || 0
  const daysFound = new Map()
  for (let r = 1; r <= maxR; r += 1) {
    let day = null
    const row = sheet.getRow(r)
    for (let c = 1; c <= Math.max(12, row.cellCount || 0); c += 1) {
      const t = normalize(row.getCell(c).value?.text || row.getCell(c).value || '')
      if (!t) continue
      const hit = EXCEL_DAY_ORDER.find((d) => normalize(d) === t)
      if (hit) {
        day = hit
        break
      }
    }
    if (!day) continue
    let hasA = false
    let hasB = false
    let hasF = false
    for (let rr = r + 1; rr <= Math.min(maxR, r + 12); rr += 1) {
      const rw = sheet.getRow(rr)
      let all = ''
      for (let c = 1; c <= Math.max(12, rw.cellCount || 0); c += 1) {
        const t = normalize(rw.getCell(c).value?.text || rw.getCell(c).value || '')
        if (!t) continue
        all += ` ${t}`
      }
      if (EXCEL_DAY_ORDER.some((d) => all.includes(normalize(d)))) break
      if (all.includes('PARTE A')) hasA = true
      if (all.includes('PARTE B')) hasB = true
      if (all.includes('FEEDBACK')) hasF = true
    }
    daysFound.set(day, { hasA, hasB, hasF })
  }
  return { daysFound }
}

export async function analyzeWeeklyProgramXlsx({
  buffer,
  mesocycle,
  week,
  phase = '',
  previousWeekData = null,
}) {
  const base = buildWeekSkeleton(week, mesocycle)
  const { data } = await importProgramingEvoWeekFromXlsxBuffer(buffer, base)
  const { daysFound } = await scanStructureFromWorkbook(buffer)
  const alerts = []
  const passed = []
  const failed = []

  const points = {
    estructura: 0,
    variedad: 0,
    coherencia: 0,
    feedback: 0,
  }

  // ESTRUCTURA
  const missingRowsDays = EXCEL_DAY_ORDER.filter((d) => {
    const x = daysFound.get(d)
    return !(x?.hasA && x?.hasB && x?.hasF)
  })
  if (missingRowsDays.length === 0) {
    points.estructura += 5
    passed.push('Estructura: todos los días contienen PARTE A, PARTE B y FEEDBACK')
  } else {
    failed.push(`Estructura filas A/B/FEEDBACK incompleta en: ${missingRowsDays.join(', ')}`)
    for (const d of missingRowsDays) alerts.push(`${d}: faltan filas PARTE A/PARTE B/FEEDBACK`)
  }

  let coreFilled = 0
  for (const day of data.dias || []) {
    for (const key of CORE_CLASS_KEYS) {
      if (isRealSessionText(day[key])) coreFilled += 1
      else alerts.push(`${day.nombre} ${CLASS_BY_KEY[key].label}: sin contenido de sesión`)
    }
  }
  const coreTotal = (data.dias?.length || 0) * CORE_CLASS_KEYS.length
  const fillRatio = coreTotal ? coreFilled / coreTotal : 0
  points.estructura += Math.round(10 * fillRatio)
  if (fillRatio === 1) passed.push('Estructura: EvoFuncional/EvoBasics/EvoFit completos todos los días')
  else failed.push(`Estructura: faltan celdas core (${coreFilled}/${coreTotal})`)

  let timeOk = 0
  for (const day of data.dias || []) {
    for (const key of CORE_CLASS_KEYS) {
      const mins = extractMinutes(day[key])
      if (mins >= 24 && mins <= 35) timeOk += 1
      else alerts.push(`${day.nombre} ${CLASS_BY_KEY[key].label}: tiempo estimado ${mins || 0} min (fuera de 24-35)`)
    }
  }
  const timeRatio = coreTotal ? timeOk / coreTotal : 0
  points.estructura += Math.round(10 * timeRatio)
  if (timeRatio === 1) passed.push('Estructura: tiempos estimados en rango 24-35 min')
  else failed.push(`Estructura: tiempos fuera de rango (${timeOk}/${coreTotal} en rango)`)

  // VARIEDAD
  let variedPairs = 0
  let totalPairs = 0
  for (let i = 1; i < (data.dias?.length || 0); i++) {
    const prevDay = data.dias[i - 1]
    const curDay = data.dias[i]
    const prevFmt = detectWodFormat(`${prevDay.evofuncional} ${prevDay.evobasics} ${prevDay.evofit}`)
    const curFmt = detectWodFormat(`${curDay.evofuncional} ${curDay.evobasics} ${curDay.evofit}`)
    totalPairs += 1
    if (prevFmt !== curFmt) variedPairs += 1
    else alerts.push(`${curDay.nombre} EvoFit: formato WOD igual que ${prevDay.nombre} (${curFmt})`)
  }
  const fmtRatio = totalPairs ? variedPairs / totalPairs : 1
  points.variedad += Math.round(10 * fmtRatio)
  if (fmtRatio === 1) passed.push('Variedad: formato WOD varía entre días')
  else failed.push('Variedad: hay días consecutivos con formato WOD repetido')

  const prevMonday = previousWeekData?.dias?.find((d) => normalize(d?.nombre) === normalize('LUNES')) || null
  const curMonday = data?.dias?.find((d) => normalize(d?.nombre) === normalize('LUNES')) || null
  if (prevMonday && curMonday) {
    const prevP = movementPattern(`${prevMonday.evofuncional} ${prevMonday.evobasics} ${prevMonday.evofit}`)
    const curP = movementPattern(`${curMonday.evofuncional} ${curMonday.evobasics} ${curMonday.evofit}`)
    if (prevP !== curP) {
      points.variedad += 5
      passed.push('Variedad: patrón muscular inicial distinto a la semana anterior')
    } else {
      failed.push('Variedad: la semana empieza con patrón muscular igual a la anterior')
      alerts.push(`LUNES: patrón inicial repetido (${curP}) respecto a semana anterior`)
    }
  } else {
    points.variedad += 3
    failed.push('Variedad: no se pudo comparar inicio con semana anterior (datos incompletos)')
  }

  const lmDays = new Set()
  let lmOk = 0
  for (const key of CORE_CLASS_KEYS) {
    const dayHit = (data.dias || []).find((d) => /\b(lm|landmine)\b/i.test(String(d[key] || '')))
    if (dayHit) {
      lmOk += 1
      lmDays.add(dayHit.nombre)
    } else {
      alerts.push(`Semana ${CLASS_BY_KEY[key].label}: sin trabajo LM/landmine`)
    }
  }
  if (lmOk === 3 && lmDays.size >= 3) {
    points.variedad += 10
    passed.push('Variedad: hay LM por clase core en días distintos')
  } else {
    points.variedad += Math.round((Math.min(lmOk, 3) / 3) * 10)
    failed.push('Variedad: LM insuficiente por clase/día (core)')
  }

  // COHERENCIA
  let noRepeatChecks = 0
  let noRepeatPass = 0
  for (const key of CORE_CLASS_KEYS) {
    for (let i = 1; i < (data.dias?.length || 0); i++) {
      noRepeatChecks += 1
      const a = extractExercises(data.dias[i - 1][key])
      const b = extractExercises(data.dias[i][key])
      const overlap = [...a].filter((x) => b.has(x))
      if (overlap.length === 0) noRepeatPass += 1
      else alerts.push(`${data.dias[i].nombre} ${CLASS_BY_KEY[key].label}: repite ejercicios de día previo (${overlap.slice(0, 3).join(', ')})`)
    }
  }
  const repRatio = noRepeatChecks ? noRepeatPass / noRepeatChecks : 1
  points.coherencia += Math.round(10 * repRatio)
  if (repRatio === 1) passed.push('Coherencia: sin repeticiones de ejercicios en días consecutivos por clase')
  else failed.push('Coherencia: hay repeticiones en días consecutivos')

  let compChecks = 0
  let compPass = 0
  for (const day of data.dias || []) {
    for (const key of CORE_CLASS_KEYS) {
      const { a, b } = splitPartAB(day[key])
      if (!a && !b) continue
      compChecks += 1
      const pa = movementPattern(a)
      const pb = movementPattern(b)
      const ok =
        (pa === 'push' && (pb === 'pull' || pb === 'hinge')) ||
        (pa === 'squat' && (pb === 'hinge' || pb === 'pull')) ||
        (pa !== 'push' && pa !== 'squat')
      if (ok) compPass += 1
      else alerts.push(`${day.nombre} ${CLASS_BY_KEY[key].label}: PARTE B no complementa PARTE A`)
    }
  }
  const compRatio = compChecks ? compPass / compChecks : 1
  points.coherencia += Math.round(15 * compRatio)
  if (compRatio === 1) passed.push('Coherencia: PARTE B complementa patrón de PARTE A')
  else failed.push('Coherencia: hay clases donde PARTE B no complementa PARTE A')

  // FEEDBACK
  let fbTotal = 0
  let fbFilled = 0
  let fbLong = 0
  for (const day of data.dias || []) {
    for (const cls of EVO_SESSION_CLASS_DEFS) {
      fbTotal += 1
      const t = String(day[cls.feedbackKey] || '').trim()
      if (t) fbFilled += 1
      else alerts.push(`${day.nombre} ${cls.label}: feedback vacío`)
      const wc = wordCount(t)
      if (wc >= 50) fbLong += 1
      else if (t) alerts.push(`${day.nombre} ${cls.label}: feedback de ${wc} palabras, muy corto`)
    }
  }
  const fbFillRatio = fbTotal ? fbFilled / fbTotal : 0
  const fbLongRatio = fbTotal ? fbLong / fbTotal : 0
  points.feedback += Math.round(10 * fbFillRatio)
  points.feedback += Math.round(15 * fbLongRatio)
  if (fbFillRatio === 1) passed.push('Feedback: todas las celdas tienen contenido')
  else failed.push(`Feedback: faltan celdas (${fbFilled}/${fbTotal})`)
  if (fbLongRatio === 1) passed.push('Feedback: todas las celdas superan 50 palabras')
  else failed.push(`Feedback: celdas con texto corto (${fbLong}/${fbTotal} cumplen >50 palabras)`)

  const score = points.estructura + points.variedad + points.coherencia + points.feedback
  const reportText = buildClaudeReport({
    week,
    mesocycle,
    phase,
    score,
    alerts,
    passed,
    failed,
  })

  return {
    parsedWeekData: data,
    score,
    points,
    alerts,
    passed,
    failed,
    reportText,
  }
}

