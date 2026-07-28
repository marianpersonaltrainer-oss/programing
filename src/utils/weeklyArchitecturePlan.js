import { EVO_SESSION_CLASS_DEFS } from '../constants/evoClasses.js'
import { EXCEL_DAY_ORDER, resolveDayCanonFromNombre } from './excelGenerationPlan.js'

const REAL_SESSION = (value) => {
  const text = String(value || '').trim()
  return !!text && !/^\(no programada esta semana\)$/i.test(text) && !/^FESTIVO\b/i.test(text)
}

const FORMAT_RULES = [
  ['intervalos', /\binterval(?:o|os|ado|ados)?\b|\bon\s*\/\s*off\b|\btrabajo\b.{0,35}\bdescans/i],
  ['EMOM', /\bE\d?MOM\b|\bevery\s+(?:minute|min)\b/i],
  ['AMRAP', /\bAMRAP\b/i],
  ['for time', /\bfor\s+time\b|\bpor\s+tiempo\b/i],
  ['IGYG', /\bIGYG\b|\bi\s+go[,\s/]+you\s+go\b/i],
  ['chipper', /\bchipper\b/i],
  ['ladder', /\bladder\b|\bescalera\b/i],
  ['estaciones', /\bestacion(?:es)?\b|\bcircuito\b/i],
  ['rondas', /\b\d+\s*(?:rondas?|rounds?)\b|\b(?:rondas?|rounds?)\s*x?\s*\d+\b/i],
]

const STRENGTH_RULES = [
  ['E2MOM', /\bE2MOM\b|\bcada\s+2\s*(?:min|')/i],
  ['E3MOM', /\bE3MOM\b|\bcada\s+3\s*(?:min|')/i],
  ['E4MOM', /\bE4MOM\b|\bcada\s+4\s*(?:min|')/i],
  ['series', /\b\d+\s*[x×]\s*\d+\b|\bseries?\b/i],
  ['tempo', /\btempo\b|\b\d{3,4}\b(?=\s*(?:de\s+tempo|tempo))/i],
  ['clusters', /\bcluster/i],
]

const MOVEMENT_RULES = [
  ['sentadilla', /\bsquat\b|\bsentadilla\b|\bwall\s*ball\b/i],
  ['bisagra', /\bdeadlift\b|\bpeso\s+muerto\b|\bswing\b|\bhip\s+thrust\b|\bclean\b|\bsnatch\b/i],
  ['empuje vertical', /\bpress\b|\bpush\s*press\b|\bthruster\b|\bhandstand\b/i],
  ['empuje horizontal', /\bpush[\s-]?up\b|\bbench\b|\bfloor\s+press\b/i],
  ['tracción vertical', /\bpull[\s-]?up\b|\bchin[\s-]?up\b|\bdominad/i],
  ['tracción horizontal', /\brow\b|\bremo con\b|\bface\s*pull\b/i],
  ['locomoción', /\brun\b|\bcarrera\b|\bshuttle\b|\bsled\b|\btrineo\b|\bcarry\b/i],
  ['core', /\bcore\b|\bhollow\b|\bdead\s*bug\b|\bsit[\s-]?up\b|\bplank\b/i],
]

const MATERIAL_RULES = [
  ['barra', /\bbarra\b|\bbarbell\b/i],
  ['mancuernas', /\bDB\b|\bdumbbell\b|\bmancuerna/i],
  ['kettlebell', /\bKB\b|\bkettlebell\b|\bpesa rusa\b/i],
  ['máquinas', /\browerg\b|\bskierg\b|\bbike\b|\bremo\b|\bski\b|\bbici\b/i],
  ['trineo', /\bsled\b|\btrineo\b/i],
  ['cajón', /\bbox\b|\bcaj[oó]n\b/i],
  ['balón', /\bwall\s*ball\b|\bmed(?:icine)?\s*ball\b|\bbal[oó]n\b/i],
  ['landmine', /\blandmine\b/i],
  ['autocarga', /\bbodyweight\b|\bpush[\s-]?up\b|\bburpee\b|\bpull[\s-]?up\b/i],
]

function uniqueMatches(text, rules) {
  return rules.filter(([, re]) => re.test(text)).map(([label]) => label)
}

function cleanLine(value, max = 220) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`
}

export function extractSessionStructuralFingerprint(sessionText) {
  const text = String(sessionText || '')
  if (!REAL_SESSION(text)) return null
  const conditioningFormats = uniqueMatches(text, FORMAT_RULES)
  const strengthFormats = uniqueMatches(text, STRENGTH_RULES)
  const movementFamilies = uniqueMatches(text, MOVEMENT_RULES)
  const materials = uniqueMatches(text, MATERIAL_RULES)
  const signature = [
    strengthFormats.join('+') || 'sin-reloj-fuerza',
    conditioningFormats.join('+') || 'continuo/otro',
    movementFamilies.slice(0, 3).join('+') || 'patrón-no-detectado',
    materials.slice(0, 3).join('+') || 'material-no-detectado',
  ].join('|')
  return {
    strengthFormats,
    conditioningFormats,
    movementFamilies,
    materials,
    signature,
  }
}

export function buildWeeklyStructuralFingerprint(weekRow) {
  const data =
    weekRow?.data && typeof weekRow.data === 'object' && !Array.isArray(weekRow.data)
      ? weekRow.data
      : weekRow || {}
  const days = []
  for (const day of Array.isArray(data?.dias) ? data.dias : []) {
    const canon = resolveDayCanonFromNombre(day?.nombre)
    if (!canon) continue
    const sessions = []
    for (const { key, label } of EVO_SESSION_CLASS_DEFS) {
      const fingerprint = extractSessionStructuralFingerprint(day?.[key])
      if (!fingerprint) continue
      sessions.push({ classKey: key, classLabel: label, ...fingerprint })
    }
    if (sessions.length) days.push({ day: canon, sessions })
  }
  return {
    id: String(weekRow?.id || ''),
    mesocycle: String(weekRow?.mesociclo || data?.mesociclo || ''),
    week: Number(weekRow?.semana ?? data?.semana) || null,
    days,
    signature: days
      .flatMap((day) => day.sessions.map((session) => `${day.day}:${session.classKey}:${session.signature}`))
      .join('||'),
  }
}

export function formatWeeklyStructuralFingerprints(rows, options = {}) {
  const maxWeeks = Math.max(1, Number(options.maxWeeks) || 6)
  const fingerprints = (Array.isArray(rows) ? rows : [])
    .slice(-maxWeeks)
    .map(buildWeeklyStructuralFingerprint)
  if (!fingerprints.length) return '(Sin huellas estructurales verificadas.)'

  return fingerprints
    .map((week) => {
      const lines = [`- ${week.mesocycle || 'mesociclo'} · S${week.week ?? '?'}:`]
      for (const day of week.days) {
        const sessions = day.sessions.map((session) => {
          const formats = [
            session.strengthFormats.join('+') || 'sin reloj de fuerza',
            session.conditioningFormats.join('+') || 'continuo/otro',
          ].join(' + ')
          const movement = session.movementFamilies.slice(0, 3).join(', ') || 'patrón no detectado'
          const material = session.materials.slice(0, 3).join(', ') || 'material no detectado'
          return `${session.classLabel}: ${formats}; ${movement}; ${material}`
        })
        lines.push(`  ${day.day}: ${sessions.join(' | ')}`)
      }
      return lines.join('\n')
    })
    .join('\n')
}

function normalizeOfferClasses(weeklyOffer, day) {
  const values = weeklyOffer?.dias?.[day]
  return Array.isArray(values) ? [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))] : []
}

function normalizeClassPlans(raw) {
  if (Array.isArray(raw)) {
    return Object.fromEntries(
      raw
        .map((entry) => [
          String(entry?.classKey ?? entry?.class ?? entry?.key ?? '').trim(),
          cleanLine(entry?.plan ?? entry?.value, 420),
        ])
        .filter(([key, value]) => key && value),
    )
  }
  if (!raw || typeof raw !== 'object') return {}
  return Object.fromEntries(
    Object.entries(raw)
      .map(([key, value]) => [String(key || '').trim(), cleanLine(value, 420)])
      .filter(([key, value]) => key && value),
  )
}

/**
 * Valida que la propuesta de arquitectura cubra exactamente los días y clases
 * elegidos antes de empezar a generar sesiones.
 */
export function normalizeWeeklyArchitecturePlan(rawPlan, { generationDays = [], weeklyOffer = null } = {}) {
  if (!Array.isArray(rawPlan)) {
    throw new Error('JSON incompleto: falta weeklyArchitecture (array).')
  }

  const requestedDays = [...new Set(
    (generationDays || [])
      .map(resolveDayCanonFromNombre)
      .filter((day) => EXCEL_DAY_ORDER.includes(day)),
  )]
  const requestedSet = new Set(requestedDays)
  const seen = new Set()
  const normalized = []

  for (const raw of rawPlan) {
    const day = resolveDayCanonFromNombre(raw?.day ?? raw?.dia ?? raw?.nombre)
    if (!day) throw new Error('weeklyArchitecture contiene un día no reconocido.')
    if (seen.has(day)) throw new Error(`weeklyArchitecture repite ${day}.`)
    if (requestedSet.size && !requestedSet.has(day)) {
      throw new Error(`weeklyArchitecture incluye ${day}, que no fue seleccionado.`)
    }
    seen.add(day)

    const classPlans = normalizeClassPlans(raw?.classPlans ?? raw?.clases)
    const expectedClasses = normalizeOfferClasses(weeklyOffer, day)
    if (expectedClasses.length) {
      const actual = Object.keys(classPlans)
      const missing = expectedClasses.filter((key) => !actual.includes(key))
      const unexpected = actual.filter((key) => !expectedClasses.includes(key))
      if (missing.length || unexpected.length) {
        throw new Error(
          `weeklyArchitecture ${day} no coincide con la oferta: faltan [${missing.join(', ')}], sobran [${unexpected.join(', ')}].`,
        )
      }
    }

    const intent = cleanLine(raw?.intent ?? raw?.intencion, 240)
    const sharedFatigue = cleanLine(raw?.sharedFatigue ?? raw?.fatigaCompartida, 240)
    const antiRepetition = cleanLine(raw?.antiRepetition ?? raw?.contraste, 280)
    if (!intent || !antiRepetition || !Object.keys(classPlans).length) {
      throw new Error(`weeklyArchitecture ${day} está incompleta.`)
    }
    normalized.push({ day, intent, classPlans, sharedFatigue, antiRepetition })
  }

  const missingDays = requestedDays.filter((day) => !seen.has(day))
  if (missingDays.length) {
    throw new Error(`weeklyArchitecture no cubre: ${missingDays.join(', ')}.`)
  }

  return normalized.sort((a, b) => EXCEL_DAY_ORDER.indexOf(a.day) - EXCEL_DAY_ORDER.indexOf(b.day))
}

export const WEEKLY_ARCHITECTURE_BLOCK_START = '## PLAN ESTRUCTURAL SEMANAL APROBADO'
export const WEEKLY_ARCHITECTURE_BLOCK_END = '## FIN PLAN ESTRUCTURAL SEMANAL'

export function formatWeeklyArchitecturePlan(plan) {
  const rows = Array.isArray(plan) ? plan : []
  if (!rows.length) return ''
  const lines = [
    WEEKLY_ARCHITECTURE_BLOCK_START,
    'Este mapa se decidió ANTES de redactar días. Es vinculante: conserva el contraste entre días y clases; no recicles el esqueleto de un día anterior.',
  ]
  for (const row of rows) {
    lines.push(`- ${row.day} · intención: ${row.intent}`)
    for (const [classKey, classPlan] of Object.entries(row.classPlans || {})) {
      lines.push(`  - ${classKey}: ${classPlan}`)
    }
    if (row.sharedFatigue) lines.push(`  - fatiga compartida: ${row.sharedFatigue}`)
    lines.push(`  - contraste obligatorio: ${row.antiRepetition}`)
  }
  lines.push(WEEKLY_ARCHITECTURE_BLOCK_END)
  return lines.join('\n')
}

export function replaceWeeklyArchitectureBlock(contextPack, plan) {
  const source = String(contextPack || '').trim()
  const block = formatWeeklyArchitecturePlan(plan)
  const start = source.indexOf(WEEKLY_ARCHITECTURE_BLOCK_START)
  const end = source.indexOf(WEEKLY_ARCHITECTURE_BLOCK_END)
  const withoutOld =
    start >= 0 && end >= start
      ? `${source.slice(0, start)}${source.slice(end + WEEKLY_ARCHITECTURE_BLOCK_END.length)}`.trim()
      : source
  return [withoutOld, block].filter(Boolean).join('\n\n')
}

export function extractWeeklyArchitectureBlock(contextPack) {
  const source = String(contextPack || '')
  const start = source.indexOf(WEEKLY_ARCHITECTURE_BLOCK_START)
  const end = source.indexOf(WEEKLY_ARCHITECTURE_BLOCK_END)
  if (start < 0 || end < start) return ''
  return source.slice(start, end + WEEKLY_ARCHITECTURE_BLOCK_END.length).trim()
}
