import { splitEvoSessionBlocks } from '../evoBasicsSkills.js'
import { METHOD_EVO_V1 } from '../methodEvoV1.js'
import { detectIntervalStructure } from './evoIntervalDetection.js'
import { readDurationMinutes, sumSessionBlockDurations } from './evoDurationUtils.js'

const FORMAT_PATTERNS = [
  ['AMRAP', /\bAMRAP\b/i],
  ['POR_TIEMPO', /\bPOR\s+TIEMPO\b/i],
  ['INTERVALOS', /\bINTERVALOS\b/i],
  ['EMOM', /\bE\d+(?::\d{2})?MOM\b/i],
  ['IGYG', /\bIGYG\b|\bI\s*GO\s*YOU\s*GO\b/i],
  ['ESTACIONES', /\bestaci[oó]n(?:es)?\b/i],
  ['FUERZA', /\bFUERZA\b/i],
  ['CHIPPER', /\bCHIPPER\b/i],
  ['LADDER', /\bLADDER\b|\bESCALERA\b/i],
]

const STRENGTH_PATTERNS = [
  ['back_squat', /\bback\s+squat\b|\bsentadilla\s+trasera\b/i],
  ['front_squat', /\bfront\s+squat\b|\bsentadilla\s+frontal\b/i],
  ['deadlift', /\bdeadlift\b|\bpeso\s+muerto\b/i],
  ['bench_press', /\bbench\s+press\b|\bpress\s+banca\b/i],
  ['shoulder_press', /\bshoulder\s+press\b|\bpress\s+militar\b|\bstrict\s+press\b/i],
  ['floor_press', /\bfloor\s+press\b/i],
]

const MOVEMENT_FAMILIES = [
  ['squat', /\bsquat\b|\bsentadilla\b|\blunge\b|\bzancada\b/i],
  ['hinge', /\bdeadlift\b|\bhinge\b|\bRDL\b|\bromanian\b|\bhip\s+thrust\b/i],
  ['push', /\bpress\b|\bpush[\s-]?up\b|\bdip\b|\bjerk\b|\bthruster\b/i],
  ['pull', /\bpull[\s-]?up\b|\bdominada\b|\brow\b|\bremo\b/i],
  ['carry', /\bcarry\b|\bfarmer\b|\btransporte\b/i],
  ['locomotion', /\brun\b|\bcorr(?:er|e)\b|\bsprint\b|\bcarrera\b|\bskip\b/i],
]

const FATIGUE_ZONES = [
  ['shoulder', /\bpress\b|\bjerk\b|\boverhead\b|\bhspu\b|\bhandstand\b|\bpino\b/i],
  ['grip', /\bpull[\s-]?up\b|\bdominada\b|\bhang\b|\bfarmer\b|\bbarbell\b|\bbarra\b/i],
  ['lumbar', /\bdeadlift\b|\bhinge\b|\bRDL\b|\bgood\s+morning\b/i],
  ['knee', /\bsquat\b|\blunge\b|\bbox\s+jump\b|\bsalto\b/i],
  ['axial', /\bback\s+squat\b|\bfront\s+squat\b|\boverhead\s+squat\b/i],
  ['impact', /\bburpee\b|\bjump\b|\bsalto\b|\brun\b|\bcorr(?:er|e)\b/i],
]

function matchLabels(text, catalog) {
  return catalog.filter(([, re]) => re.test(String(text || ''))).map(([label]) => label)
}

export function extractSessionFormats(session) {
  return matchLabels(session, FORMAT_PATTERNS)
}

export function extractStrengthPatterns(session) {
  return matchLabels(session, STRENGTH_PATTERNS)
}

export function extractMovementFamilies(session) {
  return matchLabels(session, MOVEMENT_FAMILIES)
}

export function extractFatigueZones(session) {
  return matchLabels(session, FATIGUE_ZONES)
}

const EXERCISE_REPEAT_PATTERNS = [
  ['KB Swing', /\b(?:kettlebell\s+)?swing\b|\bkb\s+swing\b/i],
  ['Wall Ball', /\bwall\s+ball\b/i],
  ['familia Snatch', /\b(?:hang\s+)?(?:power\s+)?snatch\b|\bhang\s+muscle\s+snatch\b|\bmuscle\s+snatch\b/i],
  ['press vertical', /\b(?:strict\s+press|overhead\s+press|ohp\b|shoulder\s+press)\b/i],
]

const MIN_DURATION_BY_CLASS = {
  evofuncional: METHOD_EVO_V1.output_contract.duration_rules.multi_part_typical_minutes[0],
  evobasics: METHOD_EVO_V1.output_contract.duration_rules.basics_skill_plus_simple_long_work_minutes[0],
  evofit: METHOD_EVO_V1.output_contract.duration_rules.multi_part_typical_minutes[0],
  evohybrix: METHOD_EVO_V1.output_contract.duration_rules.simple_single_part_or_hybrix_minutes[0],
  evogimnastica: METHOD_EVO_V1.output_contract.duration_rules.technical_specialty_approx_minutes,
  evofuerza: 25,
  evotodos: METHOD_EVO_V1.output_contract.duration_rules.multi_part_typical_minutes[0],
}

function dayIndex(name) {
  const n = String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  const map = {
    lunes: 0,
    martes: 1,
    miercoles: 2,
    jueves: 3,
    viernes: 4,
    sabado: 5,
    domingo: 6,
  }
  return map[n] ?? -1
}

function areConsecutiveDays(a, b) {
  const ia = dayIndex(a)
  const ib = dayIndex(b)
  return ia >= 0 && ib >= 0 && Math.abs(ia - ib) === 1
}

/**
 * Validaciones semanales de variedad, fatiga y duración.
 * @param {Array<{ dayName: string, classKey: string, className: string, session: string }>} entries
 */
export function validateWeeklyVariety(entries, options = {}) {
  const errors = []
  const warnings = []
  const maxIntervalDays = options.maxIntervalDaysPerClass ?? 2

  const intervalDaysByClass = new Map()
  const formatsByClass = new Map()
  const strengthByClass = new Map()
  const familiesByDay = []
  const fatigueByDay = []
  const exerciseDaysByClass = new Map()
  const maxExerciseDays = options.maxExerciseDaysPerClass ?? 2

  for (const entry of entries) {
    const { dayName, classKey, className, session } = entry
    const formats = extractSessionFormats(session)
    const strength = extractStrengthPatterns(session)
    const families = extractMovementFamilies(session)
    const fatigue = extractFatigueZones(session)

    for (const format of formats) {
      const list = formatsByClass.get(classKey) || []
      list.push({ dayName, format })
      formatsByClass.set(classKey, list)
    }

    for (const pattern of strength) {
      const list = strengthByClass.get(classKey) || []
      list.push({ dayName, pattern })
      strengthByClass.set(classKey, list)
    }

    if (families.length) {
      familiesByDay.push({ dayName, classKey, families })
    }
    if (fatigue.length) {
      fatigueByDay.push({ dayName, classKey, fatigue })
    }

    const interval = detectIntervalStructure(session)
    if (interval.isInterval) {
      const list = intervalDaysByClass.get(classKey) || []
      list.push({ dayName, className })
      intervalDaysByClass.set(classKey, list)
    }

    const duration = sumSessionBlockDurations(session)
    if (duration > 62) {
      errors.push({
        code: 'VAL-TIME-002',
        severity: 'error',
        classKey,
        message: `${className} el ${dayName} suma ${duration} min en bloques A/B/C; una clase no puede superar ~62 min de trabajo publicado.`,
      })
    }

    const minDuration = MIN_DURATION_BY_CLASS[classKey]
    if (minDuration != null && duration > 0 && duration < minDuration) {
      errors.push({
        code: 'VAL-TIME-003',
        severity: 'error',
        classKey,
        message: `${className} el ${dayName} suma ${duration} min efectivos; la modalidad exige al menos ~${minDuration} min de trabajo publicado.`,
      })
    }

    for (const [label, pattern] of EXERCISE_REPEAT_PATTERNS) {
      if (!pattern.test(session)) continue
      const key = `${classKey}::${label}`
      const days = exerciseDaysByClass.get(key) || []
      days.push(dayName)
      exerciseDaysByClass.set(key, days)
    }
  }

  for (const [classKey, days] of intervalDaysByClass.entries()) {
    if (days.length > maxIntervalDays) {
      errors.push({
        code: 'VAL-INTERVAL-001',
        severity: 'error',
        classKey,
        message: `${classKey} tiene ${days.length} días interválicos (${days.map((d) => d.dayName).join(', ')}). Máximo ${maxIntervalDays} por semana y modalidad.`,
      })
    }

    const sorted = [...days].sort((a, b) => dayIndex(a.dayName) - dayIndex(b.dayName))
    for (let i = 1; i < sorted.length; i += 1) {
      if (areConsecutiveDays(sorted[i - 1].dayName, sorted[i].dayName)) {
        errors.push({
          code: 'VAL-INTERVAL-002',
          severity: 'error',
          classKey,
          message: `${classKey} concentra intervalos en días consecutivos (${sorted[i - 1].dayName} y ${sorted[i].dayName}). Separa los estímulos interválicos.`,
        })
      }
    }
  }

  for (const [classKey, list] of formatsByClass.entries()) {
    const counts = new Map()
    for (const { format } of list) {
      counts.set(format, (counts.get(format) || 0) + 1)
    }
    for (const [format, count] of counts.entries()) {
      if (count >= 3) {
        errors.push({
          code: 'VAL-VARIETY-001',
          severity: 'error',
          classKey,
          message: `${classKey} repite el formato «${format}» ${count} veces en la semana. Rota estímulos antes de publicar.`,
        })
      }
    }
  }

  for (const [classKey, list] of strengthByClass.entries()) {
    const counts = new Map()
    for (const { pattern } of list) {
      counts.set(pattern, (counts.get(pattern) || 0) + 1)
    }
    for (const [pattern, count] of counts.entries()) {
      if (count >= 3) {
        errors.push({
          code: 'VAL-VARIETY-001',
          severity: 'error',
          classKey,
          message: `${classKey} repite el patrón de fuerza «${pattern}» ${count} días. Cambia el básico principal.`,
        })
      }
    }
  }

  for (let i = 0; i < familiesByDay.length; i += 1) {
    for (let j = i + 1; j < familiesByDay.length; j += 1) {
      const a = familiesByDay[i]
      const b = familiesByDay[j]
      if (!areConsecutiveDays(a.dayName, b.dayName)) continue
      const shared = a.families.filter((f) => b.families.includes(f))
      const sameClass = a.classKey === b.classKey
      if ((sameClass && shared.length >= 1) || (!sameClass && shared.length >= 2)) {
        errors.push({
          code: 'VAL-VARIETY-001',
          severity: 'error',
          message: `Las familias ${shared.join(', ')} se repiten en días consecutivos (${a.dayName} ${a.classKey} → ${b.dayName} ${b.classKey}).`,
        })
      }
    }
  }

  for (let i = 0; i < fatigueByDay.length; i += 1) {
    for (let j = i + 1; j < fatigueByDay.length; j += 1) {
      const a = fatigueByDay[i]
      const b = fatigueByDay[j]
      if (!areConsecutiveDays(a.dayName, b.dayName)) continue
      const shared = a.fatigue.filter((z) => b.fatigue.includes(z))
      const threshold = a.classKey === b.classKey ? 1 : 2
      if (shared.length >= threshold) {
        errors.push({
          code: 'VAL-FATIGUE-001',
          severity: 'error',
          message: `Fatiga acumulada (${shared.join(', ')}) entre ${a.dayName} (${a.classKey}) y ${b.dayName} (${b.classKey}). Redistribuye el estímulo.`,
        })
      }
    }
  }

  for (const [key, days] of exerciseDaysByClass.entries()) {
    const uniqueDays = [...new Set(days)]
    if (uniqueDays.length <= maxExerciseDays) continue
    const [classKey, label] = key.split('::')
    errors.push({
      code: 'VAL-VARIETY-003',
      severity: 'error',
      classKey,
      message: `${classKey} repite «${label}» en ${uniqueDays.length} días (${uniqueDays.join(', ')}). Máximo ${maxExerciseDays} apariciones semanales por modalidad.`,
    })
  }

  return { errors, warnings }
}

export { dayIndex, areConsecutiveDays, sumSessionBlockDurations, readDurationMinutes }
