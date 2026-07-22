import { METHOD_EVO_V1, METHOD_EVO_V1_VERSION } from './methodEvoV1.js'

const BASICS = METHOD_EVO_V1.class_profiles.EvoBasics
const ROTATION = BASICS.skill_rotation
const CATALOG = BASICS.skill_catalog

const COMPLEXITY_LABEL = {
  complex: 'complejo',
  simple: 'sencillo',
}

const ALIASES = {
  'Single-Leg Squat/Pistol': ['single leg squat', 'pistol squat', 'pistol'],
  'Shoulder Press/Strict Press': ['shoulder press', 'strict press', 'press estricto'],
  'Dumbbell Push Jerk': ['dumbbell push jerk', 'db push jerk'],
  'Dumbbell Split Jerk': ['dumbbell split jerk', 'db split jerk'],
  'Band-Assisted Pull-Up': ['band assisted pull up', 'banded pull up', 'pull up con banda', 'dominada con banda'],
  'Strict Pull-Up': ['strict pull up', 'pull up estricto', 'dominada estricta'],
  'Jumping Pull-Up': ['jumping pull up', 'dominada con salto'],
  'Kipping Pull-Up': ['kipping pull up', 'dominada kipping'],
  'Ring Support Hold': ['ring support hold', 'ring support', 'soporte en anillas'],
  'Feet-Assisted Ring Dip': ['feet assisted ring dip', 'ring dip asistido con pies'],
  'Banded Ring Dip': ['banded ring dip', 'ring dip con banda'],
  'Jumping Ring Dip + Negative': ['jumping ring dip', 'ring dip con salto', 'ring dip negative'],
  'Ring Dip': ['ring dip', 'fondos en anillas', 'fondo en anillas'],
  'Toes-to-Bar': ['toes to bar', 't2b'],
  'Knees-to-Armpits': ['knees to armpits'],
  'Hanging Knee Raise': ['hanging knee raise', 'elevacion de rodillas colgado'],
  'Toes-to-Rings': ['toes to rings'],
  'Handstand/Pino': ['handstand', 'pino'],
  'Tripod Handstand/Pino de tres apoyos': ['tripod handstand', 'pino de tres apoyos'],
  'Pike Handstand Push-Up': ['pike handstand push up', 'pike hspu'],
  'Kick-Up to Handstand + Negative': ['kick up to handstand', 'entrada al pino con negativa'],
  'Handstand Push-Up': ['handstand push up', 'hspu'],
  'Dumbbell/Kettlebell Thruster': ['dumbbell thruster', 'db thruster', 'kettlebell thruster', 'kb thruster'],
  'Dumbbell Shoulder Press': ['dumbbell shoulder press', 'db shoulder press'],
  'Dumbbell Push Press': ['dumbbell push press', 'db push press'],
  'Kettlebell Deadlift': ['kettlebell deadlift', 'kb deadlift'],
  'Medicine-Ball Clean': ['medicine ball clean', 'med ball clean'],
  'Medicine-Ball Power Clean': ['medicine ball power clean', 'med ball power clean'],
  'Dumbbell Power Clean': ['dumbbell power clean', 'db power clean'],
  'Dumbbell Clean': ['dumbbell clean', 'db clean'],
  'Dumbbell Snatch': ['dumbbell snatch', 'db snatch'],
  'Elevated Push-Up': ['elevated push up', 'push up elevado'],
  'Knee Push-Up': ['knee push up', 'push up de rodillas'],
  'Band-Assisted Push-Up': ['band assisted push up', 'push up con banda'],
  'False-Grip Ring Row': ['false grip ring row', 'ring row false grip'],
  'Double Under / comba eficiente': ['double under', 'double unders', 'comba eficiente'],
  'D-Ball Ground to Shoulder': ['d ball ground to shoulder', 'dball ground to shoulder', 'ground to shoulder'],
  'Sled Push / Sled Pull': ['sled push', 'sled pull', 'empuje de trineo', 'arrastre de trineo'],
  'técnica de RowErg / SkiErg': ['tecnica de rowerg', 'tecnica de skierg'],
}

export function normalizeEvoSkillText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'′]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function aliasesFor(name) {
  const base = [name, ...(ALIASES[name] || [])]
  const normalized = new Set(base.map(normalizeEvoSkillText).filter((value) => value.length >= 4))
  return [...normalized]
}

function familyFor(name) {
  const value = normalizeEvoSkillText(name)
  if (value.includes('landmine')) return 'landmine'
  if (value.includes('double under') || value.includes('comba')) return 'jump_rope'
  if (value.includes('sled') || value.includes('trineo')) return 'sled'
  if (value.includes('rowerg') || value.includes('skierg')) return 'erg_technique'
  if (value.includes('slam ball')) return 'slam_ball'
  if (value.includes('d ball')) return 'd_ball'
  if (value.includes('kettlebell swing')) return 'kettlebell_swing'
  if (value.includes('handstand') || value.includes('pino') || value.includes('hspu')) return 'handstand'
  if (value.includes('toes to') || value.includes('knees to armpits') || value.includes('hanging knee')) return 'hanging_core'
  if (value.includes('ring dip') || value.includes('ring support') || value.includes('fondos en anillas')) return 'ring_support_dip'
  if (value.includes('pull up') || value.includes('dominada')) return 'vertical_pull'
  if (value.includes('snatch')) return 'snatch'
  if (value.includes('clean')) return 'clean'
  if (value.includes('push jerk')) return 'push_jerk'
  if (value.includes('split jerk')) return 'split_jerk'
  if (value.includes('push press')) return 'push_press'
  if (value.includes('strict press') || value.includes('shoulder press')) return 'strict_press'
  if (value.includes('thruster')) return 'thruster'
  if (value.includes('front squat')) return 'front_squat'
  if (value.includes('overhead squat')) return 'overhead_squat'
  if (value.includes('back squat')) return 'back_squat'
  if (value.includes('pistol') || value.includes('single leg squat')) return 'pistol'
  if (value.includes('split squat')) return 'split_squat'
  if (value.includes('deadlift') || value.includes('good morning')) return 'hinge_deadlift'
  if (value.includes('box jump')) return 'box_jump'
  if (value.includes('step up')) return 'step_up'
  if (value.includes('lunge')) return 'lunge'
  if (value.includes('push up')) return 'push_up'
  if (value.includes('ring row') || value.includes('false grip')) return 'ring_row_grip'
  if (value.includes('squat')) return 'simple_squat'
  if (value.includes('wall ball') || value.includes('medicine ball')) return 'medicine_ball'
  if (value.includes('knee tuck') || value.includes('v up') || value.includes('sit up') || value.includes('superman')) return 'floor_core'
  return value.replaceAll(' ', '_')
}

function catalogEntries() {
  const confirmed = [
    ...CATALOG.complex.map((name) => ({ name, complexity: 'complex', source: 'confirmed' })),
    ...CATALOG.simple.map((name) => ({ name, complexity: 'simple', source: 'confirmed' })),
  ]
  const operational = [
    ...(CATALOG.additional_operational_skills?.complex || []).map((name) => ({
      name,
      complexity: 'complex',
      source: 'operational',
    })),
    ...(CATALOG.additional_operational_skills?.simple || []).map((name) => ({
      name,
      complexity: 'simple',
      source: 'operational',
    })),
    ...(BASICS.landmine_family?.allowed || []).map((name) => ({
      name,
      complexity: 'simple',
      source: 'landmine',
    })),
  ]
  return [...confirmed, ...operational].map((entry) => ({
    ...entry,
    family: familyFor(entry.name),
    aliases: aliasesFor(entry.name),
  }))
}

export const EVO_BASICS_SKILL_CATALOG = Object.freeze(catalogEntries())
export const EVO_BASICS_COMPLEX_SKILLS = Object.freeze(
  EVO_BASICS_SKILL_CATALOG.filter((entry) => entry.complexity === 'complex'),
)
export const EVO_BASICS_SIMPLE_SKILLS = Object.freeze(
  EVO_BASICS_SKILL_CATALOG.filter((entry) => entry.complexity === 'simple'),
)

function allAliasHits(text) {
  const normalized = normalizeEvoSkillText(text)
  const hits = []
  for (const entry of EVO_BASICS_SKILL_CATALOG) {
    for (const alias of entry.aliases) {
      let from = 0
      while (from < normalized.length) {
        const index = normalized.indexOf(alias, from)
        if (index < 0) break
        const before = index === 0 || normalized[index - 1] === ' '
        const end = index + alias.length
        const after = end === normalized.length || normalized[end] === ' '
        if (before && after) hits.push({ entry, alias, index, end })
        from = index + Math.max(1, alias.length)
      }
    }
  }
  return hits
}

/** Devuelve coincidencias específicas; DB Snatch no se cuenta además como Snatch. */
export function findEvoBasicsSkillMatches(text) {
  const hits = allAliasHits(text).sort((a, b) => b.alias.length - a.alias.length || a.index - b.index)
  const selected = []
  for (const hit of hits) {
    if (selected.some((other) => hit.index >= other.index && hit.end <= other.end)) continue
    selected.push(hit)
  }
  const seen = new Set()
  return selected
    .sort((a, b) => a.index - b.index)
    .map(({ entry }) => entry)
    .filter((entry) => {
      const key = `${entry.name}:${entry.complexity}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function splitEvoSessionBlocks(raw) {
  const lines = String(raw || '').split('\n').map((line) => line.trim()).filter(Boolean)
  const headers = []
  for (let index = 0; index < lines.length; index += 1) {
    if (/^[ABC]\)\s*/i.test(lines[index]) || /^PARTE\s+[UÚ]NICA\b/i.test(lines[index])) {
      headers.push({ index, header: lines[index] })
    }
  }
  return headers.map((item, position) => {
    const end = headers[position + 1]?.index ?? lines.length
    return {
      header: item.header,
      body: lines.slice(item.index + 1, end).join('\n'),
      text: lines.slice(item.index, end).join('\n'),
    }
  })
}

export function extractEvoBasicsPrincipalSkill(session) {
  const block = splitEvoSessionBlocks(session).find(({ header }) =>
    /\b(?:SKILL|T[EÉ]CNICA|HABILIDAD|APRENDIZAJE)\b/i.test(header),
  )
  if (!block) return null
  const matches = findEvoBasicsSkillMatches(block.text)
  if (!matches.length) return { identifiable: false, block, matches: [] }
  const families = [...new Set(matches.map((entry) => entry.family))]
  const complexities = [...new Set(matches.map((entry) => entry.complexity))]
  return {
    identifiable: families.length === 1 && complexities.length === 1,
    block,
    matches,
    family: families.length === 1 ? families[0] : null,
    complexity: complexities.length === 1 ? complexities[0] : null,
    label: matches[0].name,
  }
}

export function findComplexEvoBasicsFamiliesInConditioning(session) {
  const conditioning = splitEvoSessionBlocks(session).filter(({ header }) =>
    /\b(?:AMRAP|EMOM|INTERVALOS|POR\s+TIEMPO|WOD|ACONDICIONAMIENTO|METCON|RELEVOS|ESTACIONES)\b/i.test(header),
  )
  const entries = conditioning.flatMap(({ text }) => findEvoBasicsSkillMatches(text))
  return [...new Set(entries.filter((entry) => entry.complexity === 'complex').map((entry) => entry.family))]
}

function isRealSession(value) {
  const text = String(value || '').trim()
  return !!text && !/^\(no programada esta semana\)$/i.test(text) && !/^FESTIVO\b/i.test(text)
}

export function collectEvoBasicsSkillEvents(week) {
  const events = []
  for (const [dayIndex, day] of (week?.dias || []).entries()) {
    if (!isRealSession(day?.evobasics)) continue
    const principal = extractEvoBasicsPrincipalSkill(day.evobasics)
    events.push({
      dayIndex,
      day: String(day?.nombre || ''),
      hasSession: true,
      identifiable: principal?.identifiable === true,
      label: principal?.label || null,
      family: principal?.family || null,
      complexity: principal?.complexity || null,
    })
  }
  return events
}

export function emptyEvoBasicsRotationState() {
  return { blockNumber: 1, position: 0, complex: 0, simple: 0 }
}

export function advanceEvoBasicsRotationState(rawState, complexity) {
  let state = { ...emptyEvoBasicsRotationState(), ...(rawState || {}) }
  if (state.position >= ROTATION.block_size) {
    state = { ...emptyEvoBasicsRotationState(), blockNumber: state.blockNumber + 1 }
  }
  if (complexity !== 'complex' && complexity !== 'simple') return state
  return {
    ...state,
    position: state.position + 1,
    [complexity]: state[complexity] + 1,
  }
}

export function rotationStateAfterEvents(events, initialState = emptyEvoBasicsRotationState()) {
  return (events || []).reduce(
    (state, event) => advanceEvoBasicsRotationState(state, event?.complexity),
    initialState,
  )
}

export function recommendedNextEvoBasicsComplexity(rawState) {
  const state = { ...emptyEvoBasicsRotationState(), ...(rawState || {}) }
  const remaining = ROTATION.block_size - state.position
  const complexNeeded = ROTATION.target_per_block.complex - state.complex
  const simpleNeeded = ROTATION.target_per_block.simple - state.simple
  if (complexNeeded >= remaining) return 'complex'
  if (simpleNeeded >= remaining) return 'simple'
  return ROTATION.default_pattern_when_no_constraint[state.position] || (complexNeeded > simpleNeeded ? 'complex' : 'simple')
}

function eventsFromPreviousWeeks(previousWeeks) {
  const ordered = [...(previousWeeks || [])].sort((a, b) => Number(a?.semana || 0) - Number(b?.semana || 0))
  return ordered.flatMap((week) => {
    const stored = week?.metodo_evo?.evobasics_rotation?.events
    if (Array.isArray(stored) && stored.length) return stored.filter((event) => event?.complexity)
    return collectEvoBasicsSkillEvents(week).filter((event) => event.identifiable)
  })
}

function recentCandidateLabels(complexity, historyEvents, limit = 8) {
  const recentFamilies = new Set((historyEvents || []).slice(-10).map((event) => event?.family).filter(Boolean))
  const source = complexity === 'complex' ? EVO_BASICS_COMPLEX_SKILLS : EVO_BASICS_SIMPLE_SKILLS
  const uniqueFamilies = new Set()
  const preferred = []
  const fallback = []
  for (const entry of source) {
    if (uniqueFamilies.has(entry.family)) continue
    uniqueFamilies.add(entry.family)
    const target = recentFamilies.has(entry.family) ? fallback : preferred
    target.push(entry.name)
  }
  return [...preferred, ...fallback].slice(0, limit)
}

export function buildEvoBasicsRotationContext({ previousWeeks = [], currentWeek = null, targetDay = '' } = {}) {
  const historyEvents = eventsFromPreviousWeeks(previousWeeks)
  const currentEvents = collectEvoBasicsSkillEvents(currentWeek).filter((event) => event.identifiable)
  const allEvents = [...historyEvents, ...currentEvents]
  const state = rotationStateAfterEvents(allEvents)
  const next = recommendedNextEvoBasicsComplexity(state)
  const candidates = recentCandidateLabels(next, allEvents)
  const open = `${state.position}/${ROTATION.block_size} impartidas · complejos ${state.complex}/${ROTATION.target_per_block.complex} · sencillos ${state.simple}/${ROTATION.target_per_block.simple}`
  return [
    'ROTACIÓN EVOBASICS — APLICA A LA PRÓXIMA CLASE REAL',
    `Estado del bloque móvil: ${open}.`,
    `Para ${targetDay || 'la siguiente clase'}, programa como skill principal uno ${COMPLEXITY_LABEL[next]}.`,
    `Familias/candidatos menos recientes para valorar: ${candidates.join(', ')}.`,
    'Puedes recolocar la cola por fatiga, material, simultaneidad, espacio o variedad, pero al cerrar cinco clases deben quedar exactamente 2 complejos y 3 sencillos.',
    'Solo el bloque rotulado SKILL, TÉCNICA, HABILIDAD o APRENDIZAJE avanza la rotación. Refuerzos y aplicaciones en fuerza/WOD no avanzan.',
  ].join('\n')
}

export function buildEvoMethodMetadata(week, { previousWeeks = [], startState = null } = {}) {
  const historyEvents = startState ? [] : eventsFromPreviousWeeks(previousWeeks)
  const resolvedStart = startState || rotationStateAfterEvents(historyEvents)
  const events = collectEvoBasicsSkillEvents(week)
  const identifiable = events.filter((event) => event.identifiable)
  const endState = rotationStateAfterEvents(identifiable, resolvedStart)
  return {
    version: METHOD_EVO_V1_VERSION,
    evobasics_rotation: {
      block_size: ROTATION.block_size,
      target_per_block: { ...ROTATION.target_per_block },
      start_state: resolvedStart,
      events,
      end_state: endState,
    },
  }
}

export function attachEvoMethodMetadata(week, options = {}) {
  const startState = options.startState || week?.metodo_evo?.evobasics_rotation?.start_state || null
  return {
    ...week,
    metodo_evo: buildEvoMethodMetadata(week, { ...options, startState }),
  }
}

export function validateEvoBasicsRotation(week) {
  const errors = []
  const events = collectEvoBasicsSkillEvents(week)
  const storedStart = week?.metodo_evo?.evobasics_rotation?.start_state
  let state = storedStart || emptyEvoBasicsRotationState()

  for (const event of events) {
    if (!event.identifiable) {
      errors.push({
        code: 'VAL-BASICS-002',
        severity: 'error',
        dayIndex: event.dayIndex,
        classKey: 'evobasics',
        message: 'EvoBasics necesita un único skill principal identificable en un bloque rotulado SKILL, TÉCNICA, HABILIDAD o APRENDIZAJE.',
      })
      continue
    }
    state = advanceEvoBasicsRotationState(state, event.complexity)
    if (state.complex > ROTATION.target_per_block.complex || state.simple > ROTATION.target_per_block.simple) {
      errors.push({
        code: 'VAL-BASICS-002',
        severity: 'error',
        dayIndex: event.dayIndex,
        classKey: 'evobasics',
        message: `La rotación supera el máximo del bloque: ${state.complex} complejos y ${state.simple} sencillos. Cada cinco clases deben quedar 2 + 3.`,
      })
    }
    if (
      state.position === ROTATION.block_size &&
      (state.complex !== ROTATION.target_per_block.complex || state.simple !== ROTATION.target_per_block.simple)
    ) {
      errors.push({
        code: 'VAL-BASICS-002',
        severity: 'error',
        dayIndex: event.dayIndex,
        classKey: 'evobasics',
        message: `El bloque de cinco clases cierra con ${state.complex} complejos y ${state.simple} sencillos; debe cerrar exactamente con 2 + 3.`,
      })
    }
  }
  return errors
}
