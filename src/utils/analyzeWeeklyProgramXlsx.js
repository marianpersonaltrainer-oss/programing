import ExcelJS from 'exceljs'
import { EVO_SESSION_CLASS_DEFS } from '../constants/evoClasses.js'
import { EXCEL_DAY_ORDER, buildWeekSkeleton } from './excelGenerationPlan.js'
import { importProgramingEvoWeekFromXlsxBuffer } from './importProgramingEvoWeekXlsx.js'

const CORE_CLASS_KEYS = ['evofuncional', 'evobasics', 'evofit']
const CLASS_BY_KEY = Object.fromEntries(EVO_SESSION_CLASS_DEFS.map((c) => [c.key, c]))
const ALL_SESSION_KEYS = EVO_SESSION_CLASS_DEFS.map((c) => c.key)
const MOVEMENT_TAGS = {
  LM_CORE: [
    'lm deadbug press',
    'deadbug press',
    'dead bug press',
    'lm russian twist',
    'russian twist',
    'twist ruso',
    'landmine core',
  ],
  LM_ROTATIONAL: [
    'lm rotational press',
    'rotational press',
    'press rotacional',
    'prensa rotacional',
    'landmine rotational',
    'landmine twist',
    'twist landmine',
    'antirotacion',
    'anti rotacion',
    'anti-rotacion',
  ],
  LM_CARRY: [
    'offset carry',
    'cross carry',
    'cross carry offset',
    'carry offset',
    'landmine carry',
  ],
  LM_STRENGTH: [
    'landmine press',
    'landmine squat',
    'landmine lunge',
    'landmine rdl',
    'landmine row',
    'lm press',
    'lm squat',
    'lm lunge',
  ],
}

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
  return detectMovementTags(text).some((t) => t.startsWith('LM_'))
}

function detectMovementTags(text) {
  const s = normalize(text)
  if (!s) return []
  const tags = new Set()

  // Match por diccionario explícito.
  for (const [tag, patterns] of Object.entries(MOVEMENT_TAGS)) {
    if (patterns.some((p) => s.includes(normalize(p)))) tags.add(tag)
  }

  // Heurísticas compuestas (sin necesidad de keyword "landmine" literal).
  const rotationalPressLike =
    /(rotacional|rotacion|antirotacion|anti rotacion)/.test(s) && /(press|prensa|push)/.test(s)
  const coreCarryLike =
    /(offset|carry|carga asimetrica|asimetrico)/.test(s) && /(walk|marcha|carry|farmer|cross)/.test(s)
  const lmShortLike = /\blm\b/.test(s) && /(press|twist|carry|squat|lunge|rdl|row|deadbug)/.test(s)
  if (rotationalPressLike) tags.add('LM_ROTATIONAL')
  if (coreCarryLike) tags.add('LM_CARRY')
  if (lmShortLike) tags.add('LM_STRENGTH')

  return [...tags]
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

function detectEquipmentTokens(text) {
  const s = normalize(text)
  const eq = []
  if (/\b(db|dumbbell|mancuerna)\b/.test(s)) eq.push('db')
  if (/\b(kb|kettlebell)\b/.test(s)) eq.push('kb')
  if (/\b(barra|barbell)\b/.test(s)) eq.push('bar')
  if (/\b(ring|anillas)\b/.test(s)) eq.push('rings')
  if (/\b(rower|remo|ski|bike|assault)\b/.test(s)) eq.push('erg')
  if (/\b(cajon|box)\b/.test(s)) eq.push('box')
  if (/\b(band|goma|banda)\b/.test(s)) eq.push('band')
  if (/\b(sandbag|saco)\b/.test(s)) eq.push('sandbag')
  return eq
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function summarizeWeekMemoryProfile(weekData) {
  const days = Array.isArray(weekData?.dias) ? weekData.dias : []
  const real = []
  for (const d of days) {
    const texts = CORE_CLASS_KEYS.map((k) => String(d?.[k] || '')).filter((t) => isRealSessionText(t) && !isIntentionalOffDay(t))
    if (!texts.length) continue
    const merged = texts.join(' \n ')
    const mins = texts.map((t) => extractMinutesSmart(t)).filter((n) => n > 0)
    const avgMinutes = mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : 0
    real.push({
      merged,
      stim: detectStimulus(merged),
      pattern: movementPattern(merged),
      densityBucket: avgMinutes >= 33 ? 'alta' : avgMinutes >= 24 ? 'media' : avgMinutes > 0 ? 'baja' : 'na',
    })
  }
  const out = {
    days: real.length,
    highDensityDays: 0,
    pattern: { push: 0, pull: 0, squat: 0, hinge: 0, other: 0 },
    stimulus: { fuerza: 0, potencia: 0, resistencia: 0, tecnica: 0, mixto: 0 },
    gripStressSignals: 0,
  }
  for (const x of real) {
    out.highDensityDays += x.densityBucket === 'alta' ? 1 : 0
    out.pattern[x.pattern] = (out.pattern[x.pattern] || 0) + 1
    out.stimulus[x.stim] = (out.stimulus[x.stim] || 0) + 1
    if (/\b(pull|row|remo|dominada|jalon|hang|grip|agarre|farmer|carry)\b/i.test(x.merged)) out.gripStressSignals += 1
  }
  return out
}

function buildHistoricalInsights({ currentData, historicalWeeksData }) {
  const current = summarizeWeekMemoryProfile(currentData)
  const historyProfiles = (historicalWeeksData || [])
    .map((w) => summarizeWeekMemoryProfile(w))
    .filter((x) => x.days > 0)
  if (!historyProfiles.length) {
    return {
      summary: 'Sin histórico suficiente en Supabase para comparar mesociclo.',
      bullets: ['Publica más semanas para activar memoria contextual completa.'],
      recommendations: ['Cuando haya 3+ semanas, el sistema propondrá contraste y pacing según tendencia real del mesociclo.'],
    }
  }
  const totals = historyProfiles.reduce(
    (acc, h) => {
      acc.days += h.days
      acc.highDensity += h.highDensityDays
      acc.pattern.pull += h.pattern.pull
      acc.pattern.hinge += h.pattern.hinge
      acc.pattern.squat += h.pattern.squat
      acc.grip += h.gripStressSignals
      return acc
    },
    { days: 0, highDensity: 0, grip: 0, pattern: { pull: 0, hinge: 0, squat: 0 } },
  )
  const histHighDensityRatio = totals.days ? totals.highDensity / totals.days : 0
  const curHighDensityRatio = current.days ? current.highDensityDays / current.days : 0
  const histGripRatio = totals.days ? totals.grip / totals.days : 0
  const curGripRatio = current.days ? current.gripStressSignals / current.days : 0
  const hingeSquatPullBias =
    current.days > 0 ? (current.pattern.hinge + current.pattern.squat + current.pattern.pull) / current.days : 0
  const bullets = []
  const recommendations = []
  if (curHighDensityRatio > histHighDensityRatio + 0.2) {
    bullets.push('Densidad semanal por encima del histórico del mesociclo.')
    recommendations.push('Compensar con un día más técnico/control para sostener calidad sin fatiga residual.')
  }
  if (curGripRatio > histGripRatio + 0.2) {
    bullets.push('Señal de fatiga de agarre por encima de tendencia histórica.')
    recommendations.push('Alternar agarre dominante con bloques de locomoción/core para descargar antebrazo.')
  }
  if (hingeSquatPullBias >= 0.75) {
    bullets.push('Predominio hinge/squat/pull en la semana actual.')
    recommendations.push('Abrir contraste con empuje vertical, control escapular o trabajo atlético menos traccional.')
  }
  if (!bullets.length) {
    bullets.push('Semana alineada con la tendencia reciente del mesociclo.')
    recommendations.push('Usar esta consistencia para subir creatividad en formato sin romper operatividad.')
  }
  return {
    summary: `Comparativa con ${historyProfiles.length} semana(s) previa(s) del mesociclo.`,
    bullets,
    recommendations,
  }
}

export function generateCreativeProgrammingSuggestions({
  weekData,
  objective = 'equilibrio',
  historicalInsights = null,
}) {
  const days = Array.isArray(weekData?.dias) ? weekData.dias : []
  const mergedSessions = days
    .flatMap((d) => CORE_CLASS_KEYS.map((k) => String(d?.[k] || '')))
    .filter((t) => isRealSessionText(t) && !isIntentionalOffDay(t))
  const whole = mergedSessions.join(' \n ')
  const hasPartner = /\b(partner|relay|teams?|chipper|juego|challenge)\b/i.test(whole)
  const hasGymnastic = /\b(handstand|hspu|pull up|toes to bar|muscle up|kipping|anillas|gimnast)\b/i.test(whole)
  const highLogistics = new Set(detectEquipmentTokens(whole)).size >= 5
  const base = {
    atletica: [
      'Sube locomoción y ritmo en 1 bloque principal (shuttle/runs/carry dinámico) manteniendo técnica en fatiga.',
      'Introduce un día de potencia corta (sprints o intervalos breves) para contraste atlético real.',
      'Prioriza patrones globales antes de aislamientos para sensación de clase más “atlética”.',
    ],
    divertida: [
      hasPartner
        ? 'Mantén formato partner/teams, pero añade marcador simple (rondas, reps, estaciones) para engagement.'
        : 'Añade una sesión partner/relay con objetivo claro y reglas simples para elevar adherencia.',
      'Incluye un mini-finisher memorable de 4-6 minutos con pacing progresivo.',
      'Usa storytelling de sesión (reto técnico -> reto atlético -> cierre competitivo corto).',
    ],
    pedagogica: [
      'Define 1 foco técnico principal por día y 1 cue dominante por bloque (evita sobreinstrucción).',
      'Agrupa progresiones en escalones claros (base -> intermedio -> avanzado) por clase.',
      'Añade checkpoints rápidos de calidad (respiración/control/rango) para mejorar transferencia.',
    ],
    menos_caos_logistico: [
      highLogistics
        ? 'Reduce variedad de material simultáneo (objetivo: 2-3 implementos núcleo por sesión).'
        : 'Mantén simplicidad logística y evita introducir implementos extra sin impacto real.',
      'Diseña transiciones con set-up único al inicio y cambios mínimos entre bloques.',
      'Evita estaciones con colas: prioriza formatos escalables por carriles o parejas.',
    ],
    densidad_real: [
      'Sube tiempo efectivo de trabajo sin alargar sesión: menos briefing, más intervalos con descansos definidos.',
      'Ajusta caps para sostener intensidad técnica (ni sobrar tiempo ni cerrar por fatiga temprana).',
      'Usa progresión de pacing intra-sesión (arranque controlado, bloque central exigente, cierre preciso).',
    ],
    gimnasia: [
      hasGymnastic
        ? 'Refuerza componente gimnástico con progresión de control escapular + tensión media.'
        : 'Añade bloque gimnástico claro (core-tensión-línea) con escalados operativos por nivel.',
      'Equilibra volumen de tracción y estabilidad de hombro para evitar fatiga desordenada.',
      'Combina técnica gimnástica con estímulo metabólico breve para transferencia real a clase.',
    ],
    evo: [
      'Asegura intención explícita por día + coaching cues accionables + adaptación visible por nivel.',
      'Mantén fluidez operativa: programación bonita pero ejecutable en box real.',
      'Busca equilibrio técnico/intenso/divertido con identidad EVO en toda la semana.',
    ],
    memorable: [
      'Diseña un “momento firma” semanal: benchmark corto o challenge de cierre con lectura clara de progreso.',
      'Crea contraste de sensaciones entre dos días consecutivos (control vs explosivo).',
      'Incluye una narrativa de bloque para que el alumno perciba continuidad y propósito.',
    ],
    equilibrio: [
      'Conserva contraste semanal (estímulo, densidad, formato) sin perder simplicidad operativa.',
      'Prioriza flow de clase y carga cognitiva baja para el coach en días de mayor densidad.',
      'Mantén un punto memorable sin penalizar consistencia técnica.',
    ],
  }
  const key = normalize(objective)
  let picked = base.equilibrio
  if (key.includes('atlet')) picked = base.atletica
  else if (key.includes('divert')) picked = base.divertida
  else if (key.includes('pedagog')) picked = base.pedagogica
  else if (key.includes('caos') || key.includes('logistic')) picked = base.menos_caos_logistico
  else if (key.includes('densidad') || key.includes('pacing')) picked = base.densidad_real
  else if (key.includes('gimnas')) picked = base.gimnasia
  else if (key.includes('evo')) picked = base.evo
  else if (key.includes('memor')) picked = base.memorable

  const contextTip = historicalInsights?.summary
    ? [`Contexto histórico: ${historicalInsights.summary}`]
    : ['Contexto histórico: sin datos suficientes; usar criterio operativo del Head Coach.']
  return [...picked, ...contextTip]
}

const EXP_DIMENSION_LABELS = {
  locomocion: 'Locomoción / desplazamiento real',
  flowAtletico: 'Flow atlético (ritmo + continuidad)',
  carries: 'Carries / carga en movimiento',
  contralateral: 'Patrones contralaterales / unilaterales',
  memorable: 'Momento memorable (formato, equipo, reto)',
  contrasteEmocional: 'Contraste entre días (no monotonía)',
  riquezaMotriz: 'Riqueza motriz (patrones variados)',
  personalidadEvo: 'Personalidad EVO (pedagogía, control, adaptación)',
  ritmoClase: 'Ritmo y pacing de clase',
  sensacionGimnastico: 'Sensación gimnástica / control corporal',
  diversionControlada: 'Diversión controlada (juego con intención)',
  cargaLogisticaBaja: 'Simplicidad logística (material sostenible)',
  cargaCoachBaja: 'Carga cognitiva del coach (claridad de consignas)',
}

/**
 * Capa cualitativa opcional: no modifica el score técnico; orienta lectura de experiencia de clase.
 * Compara con `previousWeekData` si existe (misma estructura JSON que `data`).
 */
export function buildExperienciaEvoLayer({
  data,
  previousWeekData = null,
  scopeReduced = false,
}) {
  const dias = Array.isArray(data?.dias) ? data.dias : []
  const prevDias = Array.isArray(previousWeekData?.dias) ? previousWeekData.dias : []

  /** Señales 0–1 por texto fusionado núcleo (Funcional/Basics/Fit). */
  function signalsFromMerged(merged) {
    const s = normalize(merged)
    const raw = String(merged || '')
    if (!s) {
      return {
        locomocion: 0,
        flowAtletico: 0,
        carries: 0,
        contralateral: 0,
        memorable: 0,
        riquezaMotriz: 0,
        personalidadEvo: 0,
        ritmoClase: 0,
        sensacionGimnastico: 0,
        diversionControlada: 0,
        cargaLogisticaBaja: 1,
        cargaCoachBaja: 0.5,
      }
    }

    let locHits = 0
    if (/\b(run|sprint|shuttle|marcha|walking|crawl|bear|drag|sled|arrastr|locomov|skipping|salt)\b/i.test(raw)) locHits += 1
    if (/\b(row|ski|bike|assault|erg)\b/i.test(raw)) locHits += 0.5
    const locomocion = clamp01(locHits * 0.45 + (/\b(warm\s*up|movilidad|dynamic)\b/i.test(raw) ? 0.15 : 0))

    const flowAtletico = clamp01(
      (/\b(flow|chipper|couplet|triplet)\b/i.test(raw) ? 0.35 : 0) +
        (/\b(amrap|for\s*time|every|round|emom)\b/i.test(raw) && /\b(run|crawl|carry|sprint)\b/i.test(raw) ? 0.45 : 0) +
        (sessionStructureKind(raw) === 'flow' ? 0.35 : 0),
    )

    const carries = clamp01(
      (/\b(carry|farmer|suitcase|cross\s*carry|offset|sled|sandbag)\b/i.test(raw) ? 0.75 : 0) +
        (detectMovementTags(raw).some((t) => t === 'LM_CARRY') ? 0.25 : 0),
    )

    const contralateral = clamp01(
      (/\b(unilateral|single\s*(arm|leg)|una\s*(mano|pierna)|contralateral|alterna|split|offset)\b/i.test(raw)
        ? 0.7
        : 0) + (/\b(bird\s*dog|dead\s*bug|pallof)\b/i.test(raw) ? 0.25 : 0),
    )

    const memorable = clamp01(
      (/\b(partner|team|relay|challenge|benchmark|juego|finisher|game)\b/i.test(raw) ? 0.75 : 0) +
        (/\b(emom|amrap|for\s*time)\b/i.test(raw) ? 0.15 : 0),
    )

    const pats = new Set()
    for (const t of merged.split(/[\n•,;]/)) {
      const p = movementPattern(t)
      if (p !== 'other') pats.add(p)
    }
    const riquezaMotriz = clamp01(
      Math.min(1, pats.size * 0.13 + (extractExercises(raw).size > 12 ? 0.08 : 0)),
    )

    const personalidadEvo = clamp01(
      (/\b(cue|adapt|regres|escal|objetivo|control|respir|tecnica|progresion|intencion)\b/i.test(raw) ? 0.55 : 0) +
        (/\b(evo|comunidad|nivel)\b/i.test(raw) ? 0.1 : 0),
    )

    const fmtWod = detectWodFormat(raw)
    const ritmoClase = clamp01(
      (fmtWod !== 'OTRO' ? 0.24 : 0.08) +
        (/\b(cap|interval|descans|min\s*-off|minuto)\b/i.test(raw) ? 0.22 : 0) +
        (extractMinutesSmart(raw) >= 16 && extractMinutesSmart(raw) <= 45 ? 0.18 : 0),
    )

    const sensacionGimnastico = clamp01(
      (/\b(ring|anill|pull\s*up|dominad|tto|ttb|hspu|handstand|muscle|gimnast|skill)\b/i.test(raw) ? 0.8 : 0),
    )

    const diversionControlada = clamp01(
      (/\b(partner|juego|relay|chipper|team)\b/i.test(raw) ? 0.55 : 0) +
        (!/\b(caos|much[oa]s\s*estacion)\b/i.test(raw) ? 0.25 : 0),
    )

    const nEq = new Set(detectEquipmentTokens(raw)).size
    const cargaLogisticaBaja = clamp01(1 - Math.max(0, nEq - 2.5) / 5)

    const lines = raw.split(/\n/).filter(Boolean).length
    const approxEx = extractExercises(raw).size
    const cargaCoachBaja = clamp01(1 - Math.min(1, (approxEx * 0.06 + lines * 0.012) / 2.2))

    return {
      locomocion,
      flowAtletico,
      carries,
      contralateral,
      memorable,
      riquezaMotriz,
      personalidadEvo,
      ritmoClase,
      sensacionGimnastico,
      diversionControlada,
      cargaLogisticaBaja,
      cargaCoachBaja,
    }
  }

  function dayRow(d) {
    const coreTexts = CORE_CLASS_KEYS.map((k) => String(d?.[k] || ''))
    const realCore = coreTexts.filter((t) => isRealSessionText(t) && !isIntentionalOffDay(t))
    const off = coreTexts.some((t) => isIntentionalOffDay(t))
    const merged = realCore.join(' \n ')
    const sig = signalsFromMerged(merged)
    const stim = detectStimulus(merged)
    const fmt = detectWodFormat(merged)
    const densityBucket =
      (() => {
        const mins = realCore.map((t) => extractMinutesSmart(t)).filter((n) => n > 0)
        const avg = mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : 0
        return avg >= 33 ? 'alta' : avg >= 24 ? 'media' : avg > 0 ? 'baja' : 'na'
      })()

    const weights = {
      locomocion: 0.1,
      flowAtletico: 0.085,
      carries: 0.08,
      contralateral: 0.08,
      memorable: 0.11,
      riquezaMotriz: 0.045,
      personalidadEvo: 0.16,
      ritmoClase: 0.06,
      sensacionGimnastico: 0.07,
      diversionControlada: 0.06,
      cargaLogisticaBaja: 0.08,
      cargaCoachBaja: 0.07,
    }
    let idx = 0
    for (const k of Object.keys(weights)) idx += sig[k] * weights[k]

    return {
      day: d?.nombre || '',
      off,
      programmed: realCore.length > 0,
      merged,
      stim,
      fmt,
      densityBucket,
      signals: { ...sig },
      indiceDia: clamp01(idx),
    }
  }

  function contrasteEntreDias(rows) {
    if (!rows || rows.length < 2) return 0.35
    const ds = new Set(rows.map((r) => r.stim))
    const df = new Set(rows.map((r) => r.fmt))
    const dd = new Set(rows.map((r) => r.densityBucket))
    const variety = ds.size + df.size + dd.size
    return clamp01((variety - 3) / 9 + 0.2)
  }

  const porDiaActual = dias.map(dayRow)
  const porDiaPrev = prevDias.length ? prevDias.map(dayRow) : []

  const activeDays = porDiaActual.filter((x) => x.programmed && !x.off)
  const prevActive = porDiaPrev.filter((x) => x.programmed && !x.off)

  function avgDim(rows, key) {
    if (!rows.length) return 0
    return rows.reduce((acc, r) => acc + (r.signals[key] ?? 0), 0) / rows.length
  }

  const dims = [
    'locomocion',
    'flowAtletico',
    'carries',
    'contralateral',
    'memorable',
    'contrasteEmocional',
    'riquezaMotriz',
    'personalidadEvo',
    'ritmoClase',
    'sensacionGimnastico',
    'diversionControlada',
    'cargaLogisticaBaja',
    'cargaCoachBaja',
  ]

  const contrasteSemanaActual = contrasteEntreDias(activeDays)
  const contrasteSemanaPrev = contrasteEntreDias(prevActive)

  const dimensionesSinContraste = dims.filter((k) => k !== 'contrasteEmocional')
  const dimensionesPromedio = Object.fromEntries(
    dimensionesSinContraste.map((k) => [k, Math.round(avgDim(activeDays, k) * 100)]),
  )
  dimensionesPromedio.contrasteEmocional = Math.round(contrasteSemanaActual * 100)

  const indiceExperienciaSemana =
    activeDays.length === 0
      ? 0
      : Math.round(
          (activeDays.reduce((a, b) => a + b.indiceDia, 0) / activeDays.length * 0.93 + contrasteSemanaActual * 0.07) *
            100,
        )

  let diaMasMemorable = null
  let diaMasPlano = null
  if (activeDays.length) {
    const byMem = [...activeDays].sort((a, b) => b.signals.memorable + b.indiceDia - (a.signals.memorable + a.indiceDia))
    const byFlat = [...activeDays].sort((a, b) => a.indiceDia - b.indiceDia)
    diaMasMemorable = byMem[0]?.day || null
    diaMasPlano = byFlat[0]?.day || null
    if (activeDays.length === 1 && diaMasMemorable === diaMasPlano) {
      /* único día programado: matizar en narrativa */
    }
  }

  const mejorasVsSemanaAnterior = []
  if (!prevActive.length) {
    mejorasVsSemanaAnterior.push('No hay semana anterior en contexto (Supabase) para comparar sensación; publica la semana previa para activar el contraste automático.')
  } else {
    for (const k of dimensionesSinContraste) {
      const cur = avgDim(activeDays, k)
      const prev = avgDim(prevActive, k)
      const delta = cur - prev
      if (delta >= 0.09) mejorasVsSemanaAnterior.push(`Sube ${EXP_DIMENSION_LABELS[k] || k} frente a la semana anterior.`)
      if (delta <= -0.09) mejorasVsSemanaAnterior.push(`Baja ${EXP_DIMENSION_LABELS[k] || k} frente a la semana anterior (refuerzo sugerido).`)
    }
    const dContr = contrasteSemanaActual - contrasteSemanaPrev
    if (dContr >= 0.09) mejorasVsSemanaAnterior.push('Más contraste emocional/estructural entre días que la semana anterior.')
    if (dContr <= -0.09) mejorasVsSemanaAnterior.push('Menos contraste entre días que la semana anterior; valora variar estímulo o formato en 1–2 jornadas.')
    const idxPrevBlend =
      prevActive.length === 0
        ? 0
        : prevActive.reduce((a, b) => a + b.indiceDia, 0) / prevActive.length * 0.88 + contrasteSemanaPrev * 0.12
    const idxCurBlend =
      activeDays.length === 0
        ? 0
        : activeDays.reduce((a, b) => a + b.indiceDia, 0) / activeDays.length * 0.88 + contrasteSemanaActual * 0.12
    if (idxCurBlend > idxPrevBlend + 0.04) mejorasVsSemanaAnterior.unshift('La sensación global de experiencia mejora respecto a la semana anterior.')
    else if (idxCurBlend < idxPrevBlend - 0.04) {
      mejorasVsSemanaAnterior.unshift('La sensación global es algo más plana que la semana anterior; conviene un contraste fuerte en 1–2 días.')
    }
  }

  const sortedDims = [...dims].sort((a, b) => dimensionesPromedio[b] - dimensionesPromedio[a])
  const top1 = sortedDims[0]
  const top2 = sortedDims[1]
  const bottom1 = sortedDims[sortedDims.length - 1]

  const queHaceEspecialLaSemana =
    activeDays.length === 0
      ? 'Sin sesiones núcleo detectables para valorar la experiencia.'
      : `Esta semana destaca sobre todo en ${EXP_DIMENSION_LABELS[top1] || top1}${
          top2 && dimensionesPromedio[top2] > 55 ? ` y en ${EXP_DIMENSION_LABELS[top2] || top2}` : ''
        }. ${
          activeDays.length === 1 ? 'Solo un día con núcleo programado: el índice resume ese bloque. ' : ''
        }${scopeReduced ? '(Modo parcial: lectura cualitativa orientativa.)' : ''}`.trim()

  const mejoraPrioritaria =
    activeDays.length === 0
      ? 'Completa al menos un día programado en Funcional/Basics/Fit para valorar experiencia.'
      : `Solo si quieres pulir sensación (${dimensionesPromedio[bottom1] ?? 0}/100 orientativo): ${
          EXP_DIMENSION_LABELS[bottom1] || bottom1
      }. Ignora esta línea si la semana ya encaja bien en box.`

  return {
    enabled: true,
    capa: 'experiencia_evo',
    indiceExperienciaSemana,
    dimensionesPromedio,
    etiquetasDimension: EXP_DIMENSION_LABELS,
    porDia: porDiaActual.map((r) => ({
      dia: r.day,
      indice: Math.round(r.indiceDia * 100),
      programado: r.programmed,
      off: r.off,
      senales: Object.fromEntries(Object.keys(r.signals).map((k) => [k, Math.round(r.signals[k] * 100)])),
    })),
    mejorasVsSemanaAnterior,
    queHaceEspecialLaSemana,
    diaMasMemorable,
    diaMasPlano,
    mejoraPrioritaria,
    nota:
      indiceExperienciaSemana >= 65
        ? 'Índice de experiencia alto: sensación “más EVO” aunque el score técnico sea conservador: son capas distintas.'
        : 'El índice de experiencia es complementario al scoring técnico: una semana puede sentirse mejor aunque el validador sea estricto.',
  }
}

/** Estados de validación para UI / informe / futuros KPI (rol programación). */
export function deriveProgramValidationOutcome({ blockingReasons, pendingCorrections, alerts }) {
  const blocking = Array.isArray(blockingReasons) ? blockingReasons.filter(Boolean) : []
  const pending = Array.isArray(pendingCorrections) ? pendingCorrections.filter(Boolean) : []
  const al = Array.isArray(alerts) ? alerts.filter(Boolean) : []
  if (blocking.length) return { key: 'bloqueado', label: 'BLOQUEADO' }
  if (pending.length) return { key: 'revision_necesaria', label: 'REVISIÓN NECESARIA' }
  if (al.length) return { key: 'aprobado_con_alertas', label: 'APROBADO CON ALERTAS' }
  return { key: 'aprobado', label: 'APROBADO' }
}

function buildCoachReviewSummary({ qualityPoints, realDayProfiles, alerts }) {
  const ordered = Object.entries(qualityPoints).sort((a, b) => a[1] - b[1])
  const weakest = ordered[0]?.[0] || 'fluidez_operativa'
  const strongest = [...ordered].sort((a, b) => b[1] - a[1])[0]?.[0] || 'intencion'
  const riskMap = {
    intencion: 'Ángulo a vigilar · estímulo podría leerse poco definido fuera del contexto de clase.',
    contraste: 'Ángulo a vigilar · monotonía perceptual entre días consecutivos.',
    coherencia_mesociclo: 'Ángulo a vigilar · alineación con foco declarado del mesociclo.',
    densidad_real: 'Ángulo a vigilar · densidad o pacing denso-plano fuera del rango que suele funcionar mejor.',
    fluidez_operativa: 'Ángulo a vigilar · transiciones/material podrían atascar en box muy concurridos.',
    carga_cognitiva_coach: 'Ángulo a vigilar · bastantes consignas en paralelo.',
    experiencia_alumno: 'Ángulo a vigilar · recuerdo de semana ante el alumno (no implica clase mala).',
    progresion_bloque: 'Ángulo a vigilar · narrativa macro semanal menos explícita en texto.',
    fatiga_acumulada: 'Ángulo a vigilar · acumulación de estímulo duro encadenado.',
    equilibrio_tecnico_intenso_divertido: 'Ángulo a vigilar · equilibrio sensación técnico/intenso/divertido.',
    personalidad_evo: 'Ángulo a vigilar · señales de identidad pedagógica EVO menos explícitas en texto.',
  }
  const improveMap = {
    intencion: 'Si quieres pulir · una frase de intención por sesión suele bastar.',
    contraste: 'Si quieres pulir · abrir más contraste en 1–2 días suele mejorar frescura percibida.',
    coherencia_mesociclo: 'Si quieres pulir · re-alinear wording con objetivo declarado del mesociclo.',
    densidad_real: 'Si quieres pulir · revisar caps y descansos con ojo práctico de sala.',
    fluidez_operativa: 'Si quieres pulir · menos implementos cambiantes mismo bloque.',
    carga_cognitiva_coach: 'Si quieres pulir · menos cues simultáneas; 1 cue dominante suele suficiente.',
    experiencia_alumno: 'Si quieres pulir · un micro formato memorable sin subir caos suele suficiente.',
    progresion_bloque: 'Si quieres pulir · un hilo fino lunes→sábado a veces marca diferencia storytelling.',
    fatiga_acumulada: 'Si quieres pulir · intercalar día más contenido después de cargas muy densas.',
    equilibrio_tecnico_intenso_divertido: 'Si quieres pulir · un bloque divertido muy simple ya cambia lectura.',
    personalidad_evo: 'Si quieres pulir · re-forzar cues EVO muy concretos en texto coach.',
  }
  const specialMap = {
    intencion: 'Intención de trabajo clara en varios bloques.',
    contraste: 'Buen contraste entre días de la semana.',
    coherencia_mesociclo: 'Se nota coherencia con el mesociclo.',
    densidad_real: 'Densidad de trabajo bien calibrada.',
    fluidez_operativa: 'Operatividad de box sólida y ejecutable.',
    carga_cognitiva_coach: 'Carga de coaching bien gestionada.',
    experiencia_alumno: 'Experiencia de clase atractiva para el alumno.',
    progresion_bloque: 'Buena progresión interna del bloque semanal.',
    fatiga_acumulada: 'Fatiga acumulada bien controlada.',
    equilibrio_tecnico_intenso_divertido: 'Equilibrio muy logrado entre técnico/intenso/divertido.',
    personalidad_evo: 'Identidad EVO marcada en la semana.',
  }
  const hasFunDay = realDayProfiles.some((d) => /\b(partner|relay|teams?|chipper|juego)\b/i.test(d.merged))
  const memorable = hasFunDay
    ? 'Potenciar un cierre de semana con reto visible (benchmark corto o challenge por equipos).'
    : 'Añadir 1 sesión con componente partner/relay para elevar recuerdo y adherencia.'
  const recHeadCoach = alerts.length
    ? 'Usa las alertas como checklist suave: prioriza operación real en box; no hace falta “limpiar” todo lo que marque el validador si la semana ya funciona.'
    : 'Semana con buena señal operativa: conserva estructura y documenta cues clave para ejecución homogénea.'

  return {
    risk: riskMap[weakest],
    priority: improveMap[weakest],
    special: specialMap[strongest],
    memorable,
    headCoach: recHeadCoach,
  }
}

function buildClaudeReport({
  week,
  mesocycle,
  phase,
  statusLabel,
  scoreDisplay,
  scoreRaw,
  basicScore,
  qualityScore,
  basicScoreDisplay,
  qualityScoreDisplay,
  alerts,
  passed,
  blockingReasons,
  pendingCorrections,
  reviewObservations = [],
  coachReview,
  historicalInsights,
  smartRecommendations,
  creativeSuggestions = [],
  experienciaEvo = { enabled: false },
}) {
  const lines = [
    `INFORME SCORING S${week} – ${String(mesocycle || '').toUpperCase()} – ${String(phase || 'SIN FASE').toUpperCase()}`,
    `Resultado: ${statusLabel}`,
    `Score (vista): ${scoreDisplay}/100`,
    scoreRaw !== scoreDisplay ? `Score interno (referencia): ${scoreRaw}` : null,
    `Validación básica: ${basicScoreDisplay}/100`,
    `Calidad de programación: ${qualityScoreDisplay}/100`,
    '',
    'BLOQUEANTES (resolver antes de dar por buena semana incompleta o inválida):',
    ...(blockingReasons.length ? blockingReasons.map((b) => `- ${b}`) : ['- Ninguno']),
    '',
    'CORRECCIONES / VALIDACIONES OPERATIVAS (revisión concreta, no solo «ideas»):',
    ...(pendingCorrections.length ? pendingCorrections.map((f) => `- ${f}`) : ['- Ninguna']),
    '',
    'OBSERVACIONES CONTEXTUALES (heurísticas; válido ignorarlas si tu criterio Head Coach discrepa):',
    ...(reviewObservations.length ? reviewObservations.map((o) => `- ${o}`) : ['- Ninguna']),
    '',
    'AVISOS DE REVISIÓN RÁPIDA (rápido vistazo antes de clase / publicación):',
    ...(alerts.length ? alerts.map((a) => `- ${a}`) : ['- Sin avisos']),
    '',
    'APROBADO:',
    ...(passed.length ? passed.map((p) => `- ${p}`) : ['- (vacío)']),
    '',
    `Contraste / área a vigilar (lente scoring): ${coachReview.risk}`,
    `Opcional técnico: ${coachReview.priority}`,
    `Qué hace especial esta semana: ${coachReview.special}`,
    `Qué podría hacerla más memorable: ${coachReview.memorable}`,
    `Recomendación de Head Coach: ${coachReview.headCoach}`,
    '',
    'MEMORIA HISTÓRICA:',
    `- ${historicalInsights.summary}`,
    ...historicalInsights.bullets.map((x) => `- ${x}`),
    '',
    'SUGERENCIAS HEAD COACH (opcionales; no implican error):',
    ...smartRecommendations.map((x) => `- ${x}`),
    '',
    'IDEAS CREATIVAS / ASISTENTE (inspiración, no auditoría):',
    ...(creativeSuggestions.length ? creativeSuggestions.map((x) => `- ${x}`) : ['- (vacío)']),
    '',
    '— EXPERIENCIA EVO (cualitativa, no sustituye al score técnico) —',
    ...(experienciaEvo?.enabled
      ? [
          `Índice experiencia semana: ${experienciaEvo.indiceExperienciaSemana}/100`,
          `Día más memorable: ${experienciaEvo.diaMasMemorable || '—'}`,
          `Día más plano: ${experienciaEvo.diaMasPlano || '—'}`,
          `Qué hace más especial la semana: ${experienciaEvo.queHaceEspecialLaSemana}`,
          `Mejora prioritaria (experiencia): ${experienciaEvo.mejoraPrioritaria}`,
          'Mejoras vs semana anterior:',
          ...(experienciaEvo.mejorasVsSemanaAnterior || []).map((x) => `- ${x}`),
          `Nota: ${experienciaEvo.nota}`,
        ]
      : [`Capa desactivada o no disponible. ${experienciaEvo?.nota || ''}`]),
  ]
    .filter((line) => line != null)
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
      let hit = EXCEL_DAY_ORDER.find((d) => normalize(d) === t)
      if (!hit) {
        for (const d of EXCEL_DAY_ORDER) {
          const dn = normalize(d)
          if (t.startsWith(dn) && (t.length === dn.length || /[\s·.,|]/.test(t[dn.length] || ''))) {
            hit = d
            break
          }
        }
      }
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
  historicalWeeksData = [],
  scope = {},
}) {
  const base = buildWeekSkeleton(week, mesocycle)
  const { data } = await importProgramingEvoWeekFromXlsxBuffer(buffer, base)
  const { daysFound } = await scanStructureFromWorkbook(buffer)
  const alerts = []
  const passed = []
  /** Errores que deberían corregirse antes de considerar la semana “lista”. */
  const pendingCorrections = []
  /** Lecturas heurísticas (A/B, tiempos estimados, pacing…): no son fallos automáticos. */
  const reviewObservations = []
  /** Casos graves: publicación / importación no recomendados hasta resolver. */
  const blockingReasons = []

  const points = {
    estructura: 0,
    variedad: 0,
    coherencia: 0,
    feedback: 0,
  }
  const scopeReduced = !!(scope?.partialWeek || scope?.activeClassesOnly || scope?.draftMode)

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
  if (totalProgrammed === 0) {
    blockingReasons.push('No hay sesiones programadas detectables en Funcional/Basics/Fit (revisa el archivo o el modo parcial).')
  }
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
      pendingCorrections.push(`Estructura: días con bloque ambiguo (${realMissing.join(', ')})`)
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
    points.estructura += scopeReduced ? 9 : 6
    if (scopeReduced) {
      passed.push('Estructura: alcance reducido validado en modo parcial/draft')
    } else {
      pendingCorrections.push('Estructura: alcance de programación muy reducido (activa modo parcial para evaluación más precisa)')
    }
  }

  let structureValid = 0
  for (const slot of programmedSlots) {
    const kind = sessionStructureKind(slot.text)
    if (kind !== 'empty') structureValid += 1
    if (kind === 'bloques') {
      reviewObservations.push(
        `${slot.day} ${slot.label}: formato leído como “bloques” sin marca explícita; si ya es claro en cabecera/coach briefing, puede ignorarse.`,
      )
    }
  }
  const stRatio = totalProgrammed ? structureValid / totalProgrammed : 1
  points.estructura += Math.round(10 * stRatio)

  let timeOk = 0
  for (const slot of programmedSlots) {
    const mins = extractMinutesSmart(slot.text)
    if (mins >= 18 && mins <= 42) timeOk += 1
    else if (mins > 0) {
      reviewObservations.push(
        `${slot.day} ${slot.label}: tiempo inferido ~${mins} min (orientativo; formatos chipper/mixtos suelen equivocarse).`,
      )
    } else {
      reviewObservations.push(
        `${slot.day} ${slot.label}: duración no inferida por el parser; no implica falta de diseño.`,
      )
    }
  }
  const timeRatio = totalProgrammed ? timeOk / totalProgrammed : 1
  points.estructura += Math.round(10 * timeRatio)
  if (timeRatio >= 0.72) passed.push('Estructura: tiempos razonablemente alineados con la referencia 18–42 min')
  else if (timeRatio >= 0.38) {
    reviewObservations.push(
      `[Tiempo semanal] Solo ${timeOk}/${totalProgrammed} sesiones entran en la ventana heurística 18–42 min; válido si el pacing real está acordado en box.`,
    )
  } else if (totalProgrammed >= 4) {
    pendingCorrections.push(
      `Estructura: muchas sesiones fuera de la referencia de tiempo del validador (${timeOk}/${totalProgrammed} en 18–42 min); revisar si el Excel refleja duración real.`,
    )
  }

  // VARIEDAD
  let variedPairs = 0
  let totalPairs = 0
  const realDayProfilesForVariety = dayProfiles.filter((d) => d.realCount > 0 && !d.off)
  for (let i = 1; i < realDayProfilesForVariety.length; i++) {
    const prev = realDayProfilesForVariety[i - 1]
    const cur = realDayProfilesForVariety[i]
    totalPairs += 1
    const similar = prev.fmt === cur.fmt && prev.stim === cur.stim && prev.densityBucket === cur.densityBucket
    if (!similar) variedPairs += 1
    else {
      reviewObservations.push(
        `${cur.day}: muy parecido a ${prev.day} en formato/estímulo/densidad (${cur.fmt}/${cur.stim}/${cur.densityBucket}); puede ser intencional en microciclo.`,
      )
    }
  }
  const fmtRatio = totalPairs ? variedPairs / totalPairs : 1
  points.variedad += Math.round(10 * fmtRatio)
  if (fmtRatio === 1) passed.push('Variedad: formato WOD varía entre días')
  else {
    reviewObservations.push(
      'Variedad: varios pares de días consecutivos se leen parecidos; contrastar con intención del mesociclo antes de cambiar nada.',
    )
  }

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
      reviewObservations.push(
        `Lunes vs semana anterior: patrón/formato parecidos (${curP} / ${curFmt}); útil solo si buscas más contraste entre semanas.`,
      )
    }
  } else {
    points.variedad += 3
    reviewObservations.push('No hay semana anterior en Hub para contrastar el lunes; publica S-1 cuando puedas para activar memoria.')
  }

  const lmDays = new Set()
  let lmCount = 0
  const lmBuckets = new Set()
  for (const key of ALL_SESSION_KEYS) {
    for (const d of data.dias || []) {
      const text = String(d[key] || '')
      const tags = detectMovementTags(text)
      if (tags.some((t) => t.startsWith('LM_'))) {
        lmCount += 1
        lmDays.add(d.nombre)
        for (const t of tags) if (t.startsWith('LM_')) lmBuckets.add(t)
      }
    }
  }
  if (lmCount === 0) {
    if (scopeReduced) {
      points.variedad += 6
      reviewObservations.push('Semana parcial/draft: no se detecta LM/landmine; revisar al cerrar plantilla si aplica a tu mesociclo.')
    } else {
      pendingCorrections.push('Variedad: ausencia total de LM en semana')
      alerts.push('Semana: no aparece LM/landmine en bloques programados')
    }
  } else if (lmDays.size >= 2) {
    points.variedad += 10
    passed.push(
      `Variedad: LM presente y distribuido (${lmDays.size} días, ${lmBuckets.size} intenciones: ${[
        ...lmBuckets,
      ]
        .map((x) => x.replace('LM_', '').toLowerCase())
        .join(', ')})`,
    )
  } else {
    points.variedad += 6
    reviewObservations.push(
      'LM/landmine concentrado en pocos bloques; distribuir más es opcional si la carga ya encaja.',
    )
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
  else pendingCorrections.push('Coherencia: hay repeticiones en días consecutivos')

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
      else {
        reviewObservations.push(
          `${day.nombre} ${CLASS_BY_KEY[key].label}: lectura A→B no encaja en regla simple push/pull/hinge; si el bloque es híbrido o intencional, ignorar.`,
        )
      }
    }
  }
  const compRatio = compChecks ? compPass / compChecks : 1
  /** Complemento A/B es heurística dura sobre texto; apenas debe restar cuando el programa es usable. */
  const compRatioForPoints = Math.max(compRatio, 0.92)
  points.coherencia += Math.round(15 * compRatioForPoints)
  if (compRatio === 1) passed.push('Coherencia: PARTE B complementa patrón de PARTE A')
  else {
    reviewObservations.push(
      'Varias sesiones con PARTE A/B que el parser no califica como “complementarias”; criterio Head Coach manda sobre esta heurística.',
    )
  }

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
  else pendingCorrections.push(`Feedback: faltan celdas (${fbFilled}/${fbTotal})`)
  if (fbUsefulRatio >= 0.6) passed.push('Feedback: contenido con señales de coaching útil')

  const basicScore = points.estructura + points.variedad + points.coherencia + points.feedback

  // 2ª capa: calidad real de programación (no solo ausencia de errores).
  const realDayProfiles = dayProfiles.filter((d) => d.realCount > 0 && !d.off)
  const sessions = programmedSlots.map((s) => s.text)
  const intentions = programmedSlots.map((s) => detectStimulus(s.text))
  const intentionClearRatio = clamp01(intentions.filter((x) => x !== 'mixto').length / Math.max(1, intentions.length))
  const distinctStim = new Set(realDayProfiles.map((d) => d.stim)).size
  const distinctDensity = new Set(realDayProfiles.map((d) => d.densityBucket).filter((x) => x !== 'na')).size
  const contrastRatio = clamp01((distinctStim + distinctDensity - 2) / 4)

  let mesoCoherence = 0.75
  const meso = normalize(mesocycle)
  if (meso.includes('autocarga')) {
    const techRes = intentions.filter((x) => x === 'tecnica' || x === 'resistencia').length
    mesoCoherence = clamp01(techRes / Math.max(1, intentions.length))
  } else if (meso.includes('fuerza')) {
    const fuerza = intentions.filter((x) => x === 'fuerza' || x === 'potencia').length
    mesoCoherence = clamp01(fuerza / Math.max(1, intentions.length))
  }

  const dayEquipmentCounts = realDayProfiles.map((d) => new Set(detectEquipmentTokens(d.merged)).size)
  const avgEq = dayEquipmentCounts.length ? dayEquipmentCounts.reduce((a, b) => a + b, 0) / dayEquipmentCounts.length : 0
  const fluidezOperativa = clamp01(1 - Math.max(0, avgEq - 3) / 4)
  const cargaCoach = clamp01(1 - Math.max(0, avgEq - 4) / 5)

  const avgDensityNum =
    realDayProfiles.length === 0
      ? 0
      : realDayProfiles.reduce((acc, d) => acc + (d.densityBucket === 'alta' ? 3 : d.densityBucket === 'media' ? 2 : 1), 0) /
        realDayProfiles.length
  const densidadReal = clamp01(1 - Math.abs(avgDensityNum - 2) / 1.5)

  const hasFun = sessions.some((t) => /\b(partner|relay|teams?|chipper|juego|challenge)\b/i.test(t))
  const hasTech = intentions.includes('tecnica')
  const hasIntense = intentions.includes('potencia') || intentions.includes('resistencia')
  const equilibrio = clamp01((Number(hasFun) + Number(hasTech) + Number(hasIntense)) / 3)
  /** Pacing/contraste leídos aquí solo guían — equilibrio de estímulos domina fuerte. */
  const experienciaAlumno = clamp01(equilibrio * 0.86 + contrastRatio * 0.1 + 0.06)

  const fatigueSeq = realDayProfiles.map((d) => (d.densityBucket === 'alta' ? 1 : 0))
  let maxHighStreak = 0
  let streak = 0
  for (const x of fatigueSeq) {
    streak = x ? streak + 1 : 0
    if (streak > maxHighStreak) maxHighStreak = streak
  }
  const fatigaAcumulada = maxHighStreak >= 3 ? 0.3 : maxHighStreak === 2 ? 0.7 : 1

  const progression = []
  for (let i = 1; i < realDayProfiles.length; i++) {
    const a = realDayProfiles[i - 1]
    const b = realDayProfiles[i]
    progression.push(a.stim !== b.stim || a.densityBucket !== b.densityBucket ? 1 : 0)
  }
  const progresionBloque = progression.length ? progression.reduce((a, b) => a + b, 0) / progression.length : 0.8

  const evoSignals = sessions.filter((t) => /\b(control|adapt|regresion|carry|antirotacion|cue|tecnica)\b/i.test(t)).length
  const personalidadEvo = clamp01(evoSignals / Math.max(1, sessions.length))

  /**
   * Ponderación cualitativa: lo subjetivo pesa pocas décimas cada una para no desmentir un informe sólido.
   * Sumatorio de pesos = 100.
   */
  const qualityRaw = {
    intencion: intentionClearRatio,
    contraste: contrastRatio,
    coherencia_mesociclo: mesoCoherence,
    densidad_real: densidadReal,
    fluidez_operativa: fluidezOperativa,
    carga_cognitiva_coach: cargaCoach,
    experiencia_alumno: experienciaAlumno,
    progresion_bloque: progresionBloque,
    fatiga_acumulada: fatigaAcumulada,
    equilibrio_tecnico_intenso_divertido: equilibrio,
    personalidad_evo: personalidadEvo,
  }
  const qualityWeights = {
    intencion: 22,
    contraste: 1,
    coherencia_mesociclo: 21,
    densidad_real: 2,
    fluidez_operativa: 6,
    carga_cognitiva_coach: 6,
    experiencia_alumno: 1,
    progresion_bloque: 8,
    fatiga_acumulada: 13,
    equilibrio_tecnico_intenso_divertido: 4,
    personalidad_evo: 16,
  }
  let qualityScore = 0
  const qualityPoints = {}
  for (const k of Object.keys(qualityWeights)) {
    const pts = Math.round((qualityRaw[k] || 0) * qualityWeights[k])
    qualityPoints[k] = pts
    qualityScore += pts
  }
  qualityScore = Math.max(0, Math.min(100, qualityScore))
  const basicScoreCapped = Math.min(100, Math.max(0, basicScore))
  /** Si checklist es alto, las heurísticas no deben dejar la «calidad» ~20–30 puntos por debajo (incoherencia con el texto). */
  let qualityAdjusted = qualityScore
  if (basicScoreCapped >= 62) {
    const qualityFloor = Math.max(qualityScore, Math.min(96, Math.round(basicScoreCapped - 12)))
    qualityAdjusted = qualityFloor
  }
  qualityAdjusted = Math.min(100, Math.max(0, qualityAdjusted))
  /** Checklist tiene prioridad mayor que lecturas sutiles pacing/contraste/flow. */
  const BASIC_BLEND = 0.81
  const scoreRaw = Math.round(basicScoreCapped * BASIC_BLEND + qualityAdjusted * (1 - BASIC_BLEND))
  const scoreDisplay = Math.min(100, Math.max(0, scoreRaw))
  const basicScoreDisplay = Math.min(100, Math.max(0, basicScoreCapped))
  const qualityScoreDisplay = Math.min(100, Math.max(0, qualityAdjusted))

  const validationOutcome = deriveProgramValidationOutcome({
    blockingReasons,
    pendingCorrections,
    alerts,
  })
  const importRecommended =
    blockingReasons.length === 0 && scoreDisplay > 70 && validationOutcome.key !== 'bloqueado'
  const kpi = {
    version: 1,
    status: validationOutcome.key,
    statusLabel: validationOutcome.label,
    scoreDisplay,
    scoreRaw,
    basicScoreDisplay,
    qualityScoreDisplay,
    counts: {
      blocking: blockingReasons.length,
      pending: pendingCorrections.length,
      alerts: alerts.length,
      observations: reviewObservations.length,
    },
    importRecommended,
  }

  const coachReview = buildCoachReviewSummary({
    qualityPoints,
    realDayProfiles,
    alerts,
  })
  const historicalInsights = buildHistoricalInsights({
    currentData: data,
    historicalWeeksData,
  })
  const smartRecommendations = [
    ...historicalInsights.recommendations,
    'Definir una frase de intención por día y usarla como filtro para descartar bloques que no aporten.',
    'Reducir a 1-2 transiciones de material críticas por sesión para mantener flujo real de clase.',
    'Añadir al menos un momento “memorable” semanal (partner/challenge/storyline) sin aumentar caos logístico.',
  ].slice(0, 6)
  const creativeSuggestions = generateCreativeProgrammingSuggestions({
    weekData: data,
    objective: 'equilibrio',
    historicalInsights,
  })

  const experienciaEvo =
    scope.experienciaEvo === false
      ? { enabled: false, nota: 'Capa Experiencia EVO desactivada para este análisis.' }
      : buildExperienciaEvoLayer({
          data,
          previousWeekData,
          scopeReduced,
        })

  const reportText = buildClaudeReport({
    week,
    mesocycle,
    phase,
    statusLabel: validationOutcome.label,
    scoreDisplay,
    scoreRaw,
    basicScore: basicScoreCapped,
    qualityScore: qualityAdjusted,
    basicScoreDisplay,
    qualityScoreDisplay,
    alerts,
    passed,
    blockingReasons,
    pendingCorrections,
    reviewObservations,
    coachReview,
    historicalInsights,
    smartRecommendations,
    creativeSuggestions,
    experienciaEvo,
  })

  return {
    parsedWeekData: data,
    score: scoreDisplay,
    scoreRaw,
    scoreDisplay,
    basicScore: basicScoreDisplay,
    basicScoreRaw: basicScoreCapped,
    qualityScore: qualityScoreDisplay,
    /** Suma naive heurísticas antes del suelo alineado con checklist (ver qualityScore público). */
    qualityScoreRaw: qualityScore,
    points,
    qualityPoints,
    coachReview,
    historicalInsights,
    smartRecommendations,
    creativeSuggestions,
    /** Contexto Head Coach · heurísticas suaves (no son fallos). */
    reviewObservations,
    alerts,
    passed,
    pendingCorrections,
    /** @deprecated usar pendingCorrections */
    failed: pendingCorrections,
    blockingReasons,
    validationOutcome,
    kpi,
    kpiExperiencia: experienciaEvo?.enabled
      ? {
          version: 1,
          indiceExperienciaSemana: experienciaEvo.indiceExperienciaSemana,
          diaMasMemorable: experienciaEvo.diaMasMemorable,
          diaMasPlano: experienciaEvo.diaMasPlano,
          dimensionesTop: Object.fromEntries(
            Object.entries(experienciaEvo.dimensionesPromedio || {})
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3),
          ),
        }
      : null,
    experienciaEvo,
    reportText,
  }
}

