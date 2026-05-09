import ExcelJS from 'exceljs'
import { EVO_SESSION_CLASS_DEFS } from '../constants/evoClasses.js'
import { EXCEL_DAY_ORDER, buildWeekSkeleton } from './excelGenerationPlan.js'
import { importProgramingEvoWeekFromXlsxBuffer } from './importProgramingEvoWeekXlsx.js'

const CORE_CLASS_KEYS = ['evofuncional', 'evobasics', 'evofit']
const CLASS_BY_KEY = Object.fromEntries(EVO_SESSION_CLASS_DEFS.map((c) => [c.key, c]))
const ALL_SESSION_KEYS = EVO_SESSION_CLASS_DEFS.map((c) => c.key)
const LM_TAGS = [
  'lm',
  'landmine',
  'rotational press',
  'deadbug press',
  'landmine twist',
  'russian twist',
  'offset carry',
  'cross carry offset',
]

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

function extractMinutesSmart(text) {
  const s = String(text || '')
  let objective = 0

  // AMRAP / cap explícito: tiempo objetivo real.
  const caps = [...s.matchAll(/\b(?:amrap|for\s*time|time\s*cap)\s*(\d{1,2})\s*['’m]?\b/gi)]
  for (const m of caps) objective += Number(m[1] || 0)

  // Every x rounds: tiempo fijo.
  const every = [...s.matchAll(/\bevery\s+(\d{1,2})[:.]?(\d{0,2})?\s*(?:x|por)\s*(\d{1,2})\b/gi)]
  for (const m of every) {
    const mins = Number(m[1] || 0) + Number(m[2] || 0) / 60
    const rounds = Number(m[3] || 0)
    objective += mins * rounds
  }

  // EMOM suele ser duración íntegra.
  const emom = [...s.matchAll(/\bemom\s*(\d{1,2})\b/gi)]
  for (const m of emom) objective += Number(m[1] || 0)

  // Bloques técnicos: no contar 1:1 como trabajo denso; factor 0.65.
  const technicalHints = /\b(tecnica|skill|drill|progresion|learning|control motor|activation|activacion)\b/i.test(s)
  if (technicalHints) objective *= 0.65

  // Fallback: minutos sueltos, evitando doble conteo agresivo.
  if (objective < 8) {
    const mins = [...s.matchAll(/\b(\d{1,2})\s*(?:min|')\b/gi)].map((m) => Number(m[1] || 0))
    if (mins.length) objective += Math.max(...mins)
  }

  return Math.round(objective)
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

function detectStimulus(text) {
  const s = normalize(text)
  if (/\b(fuerza|strength|5x|3x|heavy|rm)\b/.test(s)) return 'fuerza'
  if (/\b(potencia|power|sprint|explosiv)\b/.test(s)) return 'potencia'
  if (/\b(aerob|engine|resistencia|endurance)\b/.test(s)) return 'resistencia'
  if (/\b(tecnica|skill|drill|progresion)\b/.test(s)) return 'tecnica'
  return 'mixto'
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

function sessionStructureKind(text) {
  const s = String(text || '')
  if (!isRealSessionText(s)) return 'empty'
  const hasA = /parte\s*a/i.test(s)
  const hasB = /parte\s*b/i.test(s)
  if (hasA && hasB) return 'AB'
  if (/\b(flow|chipper|partner|teams?)\b/i.test(s)) return 'flow'
  if (/\b(tecnica|skill|drill)\b/i.test(s) && /\b(amrap|for time|emom|every|cap)\b/i.test(s)) return 'tecnica+wod'
  if (/\b(amrap|for time|emom|every|ladder|cap)\b/i.test(s)) return 'single_wod'
  return 'bloques'
}

function isIntentionalOffDay(text) {
  const s = normalize(text)
  return /\b(off|rest|descanso|no programad|open gym|evento|competicion|holiday|festivo)\b/.test(s)
}

function hasLmSignal(text) {
  const s = normalize(text)
  if (!s) return false
  return LM_TAGS.some((tag) => {
    if (tag === 'lm') return /\blm\b/.test(s)
    return s.includes(tag)
  })
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

  const programmedSlots = []
  for (const day of data.dias || []) {
    for (const key of CORE_CLASS_KEYS) {
      const text = String(day[key] || '')
      if (!isRealSessionText(text)) continue
      programmedSlots.push({
        day: day.nombre,
        key,
        label: CLASS_BY_KEY[key].label,
        text,
      })
    }
  }
  const totalProgrammed = programmedSlots.length
  const dayProfiles = (data.dias || []).map((d) => {
    const coreTexts = CORE_CLASS_KEYS.map((k) => String(d[k] || ''))
    const realCore = coreTexts.filter((t) => isRealSessionText(t))
    const off = coreTexts.some((t) => isIntentionalOffDay(t))
    const merged = realCore.join(' \n ')
    const mins = realCore.map((t) => extractMinutesSmart(t)).filter((n) => n > 0)
    const avgMinutes = mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : 0
    return {
      day: d.nombre,
      off,
      realCount: realCore.length,
      merged,
      fmt: detectWodFormat(merged),
      stim: detectStimulus(merged),
      pattern: movementPattern(merged),
      densityBucket: avgMinutes >= 33 ? 'alta' : avgMinutes >= 24 ? 'media' : avgMinutes > 0 ? 'baja' : 'na',
    }
  })

  // ESTRUCTURA
  const missingRowsDays = EXCEL_DAY_ORDER.filter((d) => {
    const x = daysFound.get(d)
    // Solo marca si hay día presente y no hay indicio de estructura básica.
    return !!x && !(x?.hasA || x?.hasB || x?.hasF)
  })
  if (missingRowsDays.length === 0) {
    points.estructura += 5
    passed.push('Estructura: se detecta estructura base en los días presentes')
  } else {
    const realMissing = missingRowsDays.filter((d) => {
      const p = dayProfiles.find((x) => x.day === d)
      return p && !p.off && p.realCount > 0
    })
    if (realMissing.length) {
      failed.push(`Estructura: días con bloque ambiguo (${realMissing.join(', ')})`)
      for (const d of realMissing) alerts.push(`${d}: no se detecta estructura clara (A/B/feedback o sesión equivalente)`)
    } else {
      points.estructura += 5
      passed.push('Estructura: días ambiguos marcados como OFF/descanso (sin penalización)')
    }
  }

  // No penalizar clases/días vacíos por defecto. Valorar consistencia de lo programado.
  if (totalProgrammed >= 6) {
    points.estructura += 10
    passed.push('Estructura: volumen semanal programado suficiente (sin forzar clases vacías)')
  } else if (totalProgrammed >= 3) {
    points.estructura += 9
    passed.push('Estructura: semana parcial válida (no se penaliza por plantilla incompleta)')
  } else {
    points.estructura += 6
    failed.push('Estructura: alcance de programación muy reducido (activa modo parcial para evaluación más precisa)')
  }

  let structureValid = 0
  for (const slot of programmedSlots) {
    const kind = sessionStructureKind(slot.text)
    if (kind !== 'empty') structureValid += 1
    if (kind === 'bloques') alerts.push(`${slot.day} ${slot.label}: estructura poco explícita; añade señal de bloques/objetivo`)
  }
  const stRatio = totalProgrammed ? structureValid / totalProgrammed : 1
  points.estructura += Math.round(10 * stRatio)

  let timeOk = 0
  for (const slot of programmedSlots) {
    const mins = extractMinutesSmart(slot.text)
    if (mins >= 20 && mins <= 38) timeOk += 1
    else if (mins > 0) alerts.push(`${slot.day} ${slot.label}: tiempo estimado ${mins} min (revisar flow real)`)
    else alerts.push(`${slot.day} ${slot.label}: no se pudo inferir duración`)
  }
  const timeRatio = totalProgrammed ? timeOk / totalProgrammed : 1
  points.estructura += Math.round(10 * timeRatio)
  if (timeRatio >= 0.8) passed.push('Estructura: tiempos mayormente en rango operativo')
  else failed.push(`Estructura: tiempos fuera de rango en varias sesiones (${timeOk}/${totalProgrammed} en rango)`)

  // VARIEDAD
  let variedPairs = 0
  let totalPairs = 0
  const realDayProfiles = dayProfiles.filter((d) => d.realCount > 0 && !d.off)
  for (let i = 1; i < realDayProfiles.length; i++) {
    const prev = realDayProfiles[i - 1]
    const cur = realDayProfiles[i]
    totalPairs += 1
    const similar = prev.fmt === cur.fmt && prev.stim === cur.stim && prev.densityBucket === cur.densityBucket
    if (!similar) variedPairs += 1
    else alerts.push(`${cur.day}: formato+estímulo+density muy parecido a ${prev.day} (${cur.fmt}/${cur.stim}/${cur.densityBucket})`)
  }
  const fmtRatio = totalPairs ? variedPairs / totalPairs : 1
  points.variedad += Math.round(10 * fmtRatio)
  if (fmtRatio === 1) passed.push('Variedad: formato WOD varía entre días')
  else failed.push('Variedad: hay días consecutivos con formato WOD repetido')

  const prevMonday = previousWeekData?.dias?.find((d) => normalize(d?.nombre) === normalize('LUNES')) || null
  const curMonday = data?.dias?.find((d) => normalize(d?.nombre) === normalize('LUNES')) || null
  if (prevMonday && curMonday) {
    const prevTxt = `${prevMonday.evofuncional} ${prevMonday.evobasics} ${prevMonday.evofit}`
    const curTxt = `${curMonday.evofuncional} ${curMonday.evobasics} ${curMonday.evofit}`
    const prevP = movementPattern(prevTxt)
    const curP = movementPattern(curTxt)
    const prevFmt = detectWodFormat(prevTxt)
    const curFmt = detectWodFormat(curTxt)
    if (prevP !== curP || prevFmt !== curFmt) {
      points.variedad += 5
      passed.push('Variedad: arranque semanal diferenciado frente a semana anterior')
    } else {
      points.variedad += 2
      failed.push('Variedad: arranque semanal muy parecido a la semana anterior')
      alerts.push(`LUNES: patrón/formato inicial repetido (${curP}/${curFmt})`)
    }
  } else {
    points.variedad += 3
    failed.push('Variedad: no se pudo comparar inicio con semana anterior (datos incompletos)')
  }

  const lmDays = new Set()
  let lmCount = 0
  for (const key of ALL_SESSION_KEYS) {
    for (const d of data.dias || []) {
      if (hasLmSignal(String(d[key] || ''))) {
        lmCount += 1
        lmDays.add(d.nombre)
      }
    }
  }
  if (lmCount === 0) {
    failed.push('Variedad: ausencia total de LM en semana')
    alerts.push('Semana: no aparece LM/landmine en ningún bloque core')
  } else if (lmDays.size >= 2) {
    points.variedad += 10
    passed.push('Variedad: LM presente y distribuido de forma razonable')
  } else {
    points.variedad += 6
    failed.push('Variedad: LM poco distribuido (concentrado en un día)')
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
      if (overlap.length <= 1) noRepeatPass += 1
      else alerts.push(`${data.dias[i].nombre} ${CLASS_BY_KEY[key].label}: repite demasiados ejercicios (${overlap.slice(0, 3).join(', ')})`)
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
      const txt = String(day[key] || '')
      const { a, b } = splitPartAB(txt)
      if (!a && !b) {
        // Si es single/flow no exigir complementariedad A/B.
        if (sessionStructureKind(txt) !== 'AB') continue
      }
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
  let fbUseful = 0
  for (const day of data.dias || []) {
    for (const cls of EVO_SESSION_CLASS_DEFS) {
      const sessionTxt = String(day[cls.key] || '')
      if (!isRealSessionText(sessionTxt) || isIntentionalOffDay(sessionTxt)) continue
      fbTotal += 1
      const t = String(day[cls.feedbackKey] || '').trim()
      if (t) fbFilled += 1
      else alerts.push(`${day.nombre} ${cls.label}: feedback vacío`)
      const wc = wordCount(t)
      const useful =
        wc >= 10 &&
        /\b(cue|clave|ritmo|transicion|adapt|regresion|escal|objetivo|respira|control)\b/i.test(normalize(t))
      if (useful) fbUseful += 1
      else if (t && wc < 8) alerts.push(`${day.nombre} ${cls.label}: feedback muy corto (${wc} palabras)`)
    }
  }
  const fbFillRatio = fbTotal ? fbFilled / fbTotal : 1
  const fbUsefulRatio = fbTotal ? fbUseful / fbTotal : 1
  points.feedback += Math.round(20 * fbFillRatio)
  points.feedback += Math.round(5 * fbUsefulRatio)
  if (fbFillRatio === 1) passed.push('Feedback: todas las clases programadas tienen contenido')
  else failed.push(`Feedback: faltan celdas (${fbFilled}/${fbTotal})`)
  if (fbUsefulRatio >= 0.6) passed.push('Feedback: contenido con señales de coaching útil')

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

