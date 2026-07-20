/**
 * Lógica pura del Centro de revisión del método.
 *
 * Agrupa reglas por tema sin usar IA y nunca cambia su estado. La activación
 * solo puede producirse mediante una orden explícita y validada por la API.
 */

import {
  RULE_ORIGINS,
  RULE_STATUSES,
  RULE_STRENGTHS,
  RULE_VALIDITIES,
} from './methodRuleConstants.js'

const ACTIONS = new Set(['save_pending', 'approve', 'reject'])
const RULE_TYPES = new Set(['timing', 'load', 'exercise', 'format', 'rest'])
const MAX_SOURCE_IDS = 100
const MAX_RULE_TEXT = 4000

const TOPICS = Object.freeze([
  {
    key: 'warmup_visibility',
    label: 'Visibilidad del calentamiento',
    patterns: [/calentamiento/, /movilidad/],
    conflict: 'Hay fuentes antiguas que lo muestran siempre y otras que lo ocultan.',
    suggestion:
      'No mostrar movilidad ni calentamiento en la programación final. La sesión publicada empieza directamente en la parte A, B o C.',
    ruleType: 'format',
    strength: 'required',
  },
  {
    key: 'warmup_purpose',
    label: 'Objetivo del calentamiento',
    patterns: [/ensayo del d[ií]a/, /progresi[oó]n.*calentamiento/, /calentar bien/],
    suggestion:
      'Aunque no se muestre en la programación, reservar margen de clase para explicar, progresar y calentar los movimientos que lo necesiten.',
    ruleType: 'timing',
    strength: 'required',
  },
  {
    key: 'landmine_frequency',
    label: 'Uso de landmine',
    patterns: [/landmine/],
    conflict: 'Las fuentes antiguas discrepan entre obligatorio y opcional.',
    suggestion:
      'Usar landmine con más frecuencia cuando aporte variedad, con propuestas sencillas y fáciles de gestionar especialmente en EvoFit.',
    ruleType: 'exercise',
    strength: 'preferred',
  },
  {
    key: 'feedback_format',
    label: 'Feedback para entrenadores',
    patterns: [/feedback/, /entrenador/, /pizarra/, /marcas/],
    conflict: 'Las fuentes antiguas mezclan viñetas rígidas y prosa natural.',
    suggestion:
      'Escribir un feedback breve, natural y operativo: anticipar organización, material, solapamientos y dudas reales sin explicar técnica básica ni pedir marcas en pizarra.',
    ruleType: 'format',
    strength: 'required',
  },
  {
    key: 'effective_duration',
    label: 'Tiempo efectivo de clase',
    patterns: [/tiempo efectivo/, /duraci[oó]n/, /30\s*[-–]\s*32/, /40\s*[-–]\s*42/, /minutos? efectivos?/],
    suggestion:
      'Aprovechar la hora completa: programar normalmente 30–32 minutos efectivos cuando hay varias partes y más explicación; llegar a 40–42 minutos cuando la clase es simple y requiere pocas transiciones.',
    ruleType: 'timing',
    strength: 'required',
  },
  {
    key: 'basics_skill_progression',
    label: 'Progresión de skills en Basics',
    patterns: [/basics.*skill/, /skill.*basics/, /comba/, /subir de nivel/, /halterofilia.*basics/],
    suggestion:
      'En Basics incluir skills reales que acerquen a Funcional, además de fuerza básica con barra cuando la sala y el material lo permitan.',
    ruleType: 'exercise',
    strength: 'required',
  },
  {
    key: 'room_capacity',
    label: 'Sala, aforo y material',
    patterns: [/sala\s*(ii|2)/, /10 personas/, /aforo/, /espacio/, /4\s*[-–]\s*5 barras/, /material/],
    suggestion:
      'Diseñar para clases de hasta 10 personas respetando la sala y el material disponible; usar parejas, relevos o tandas cuando mejoren el flujo.',
    ruleType: 'format',
    strength: 'required',
  },
  {
    key: 'summer_schedule',
    label: 'Horario de julio y agosto',
    patterns: [/julio/, /agosto/, /verano/],
    suggestion:
      'En julio y agosto no hay Basics martes ni jueves; Gimnásticos solo se programa el martes; Hybrix se mantiene lunes y miércoles.',
    ruleType: 'format',
    strength: 'required',
    validity: 'temporary',
  },
  {
    key: 'muscle_pattern_rotation',
    label: 'Rotación muscular entre semanas',
    patterns: [/secuencia.*muscular/, /mismos d[ií]as/, /lunes.*mi[eé]rcoles/, /tren inferior.*semana/, /d[ií]as fijos/],
    suggestion:
      'Rotar el estímulo y la zona muscular por día entre semanas para que quien asiste siempre los mismos días no repita continuamente el mismo patrón.',
    ruleType: 'format',
    strength: 'required',
  },
  {
    key: 'cross_class_harmony',
    label: 'Armonía entre modalidades',
    patterns: [/armon[ií]a/, /mezclar.*(fit|basics|funcional)/, /(funcional|fit|basics).*(funcional|fit|basics)/],
    suggestion:
      'Coordinar Funcional, Basics, Fit, Hybrix y Gimnásticos para que una persona pueda mezclar modalidades sin repetir en días consecutivos el mismo estímulo dominante.',
    ruleType: 'format',
    strength: 'required',
  },
  {
    key: 'exercise_variety',
    label: 'Variedad de ejercicios y formatos',
    patterns: [/floor press/, /db row/, /goblet squat/, /sled push/, /trineo/, /vari(e|a)dad/, /aburrid/, /ejercicios diferentes/],
    suggestion:
      'Evitar que se repitan siempre las mismas parejas de ejercicios y formatos; ampliar la rotación con barra, landmine, trineo, máquinas, locomoción y variantes sencillas de fuerza.',
    ruleType: 'exercise',
    strength: 'required',
  },
])

const TOPIC_BY_KEY = new Map(TOPICS.map((topic) => [topic.key, topic]))

function clean(value) {
  return String(value ?? '').trim()
}

function normalize(value) {
  return clean(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function slug(value) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
}

function inferTopic(row) {
  const explicit = clean(row.rule_key)
  if (explicit) {
    return TOPIC_BY_KEY.get(explicit) || {
      key: explicit,
      label: explicit.replaceAll('_', ' '),
      suggestion: clean(row.rule_text),
      ruleType: RULE_TYPES.has(row.rule_type) ? row.rule_type : 'format',
      strength: RULE_STRENGTHS.includes(row.rule_strength) ? row.rule_strength : 'preferred',
    }
  }

  const haystack = normalize(`${row.trigger_context || ''} ${row.rule_text || ''}`)
  // Los temas más específicos deben ganar a los genéricos de calentamiento/formato.
  const ordered = [
    'warmup_purpose',
    'landmine_frequency',
    'basics_skill_progression',
    'room_capacity',
    'summer_schedule',
    'muscle_pattern_rotation',
    'cross_class_harmony',
    'exercise_variety',
    'effective_duration',
    'feedback_format',
    'warmup_visibility',
  ]
  for (const key of ordered) {
    const topic = TOPIC_BY_KEY.get(key)
    if (topic?.patterns?.some((pattern) => pattern.test(haystack))) return topic
  }

  const type = RULE_TYPES.has(row.rule_type) ? row.rule_type : 'format'
  const context = slug(row.trigger_context) || 'general'
  return {
    key: '',
    groupKey: `unclassified:${type}:${context}`,
    label: `Sin clasificar · ${clean(row.trigger_context) || type}`,
    suggestion: clean(row.rule_text),
    ruleType: type,
    strength: 'preferred',
  }
}

function publicRow(row) {
  return {
    id: row.id,
    ruleKey: clean(row.rule_key) || null,
    status: clean(row.rule_status) || 'legacy_unreviewed',
    validity: clean(row.rule_validity) || null,
    strength: clean(row.rule_strength) || null,
    origin: clean(row.rule_origin) || null,
    ruleType: clean(row.rule_type) || 'format',
    triggerContext: clean(row.trigger_context),
    text: clean(row.rule_text),
    confidence: Number(row.confidence) || 0,
    classTypes: Array.isArray(row.class_types) ? row.class_types : [],
    dayOfWeek: Array.isArray(row.day_of_week) ? row.day_of_week : [],
    roomKey: clean(row.room_key) || null,
    timeSlot: clean(row.time_slot) || null,
    validFrom: row.valid_from || null,
    validTo: row.valid_to || null,
    mesocycleKey: clean(row.mesocycle_key) || null,
    weekNumber: row.week_number == null ? null : Number(row.week_number),
    createdAt: row.created_at || null,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
  }
}

function newestFirst(a, b) {
  const date = String(b.created_at || '').localeCompare(String(a.created_at || ''))
  if (date) return date
  return Number(b.id || 0) - Number(a.id || 0)
}

function buildDefaultDraft(topic, rows) {
  const explicit = rows.find((row) => clean(row.rule_key))
  const canonical = rows
    .filter((row) => row.rule_status === 'pending_review')
    .sort(newestFirst)[0]
  const source = canonical || explicit || [...rows].sort((a, b) => {
    const confidence = Number(b.confidence || 0) - Number(a.confidence || 0)
    return confidence || newestFirst(a, b)
  })[0]

  return {
    canonicalId: canonical?.id || null,
    ruleKey: topic.key || clean(source?.rule_key),
    ruleText: topic.suggestion || clean(source?.rule_text),
    ruleType: topic.ruleType || clean(source?.rule_type) || 'format',
    validity: topic.validity || clean(source?.rule_validity) || 'permanent',
    strength: topic.strength || clean(source?.rule_strength) || 'preferred',
    validFrom: source?.valid_from || null,
    validTo: source?.valid_to || null,
    mesocycleKey: source?.mesocycle_key || null,
    weekNumber: source?.week_number == null ? null : Number(source.week_number),
    dayOfWeek: Array.isArray(source?.day_of_week) ? source.day_of_week : [],
    classTypes: Array.isArray(source?.class_types) ? source.class_types : [],
    roomKey: source?.room_key || null,
    timeSlot: source?.time_slot || null,
  }
}

/**
 * @param {object[]} inputRows
 */
export function groupMethodRulesForReview(inputRows) {
  const rows = Array.isArray(inputRows) ? inputRows.filter(Boolean) : []
  const groups = new Map()

  for (const row of rows) {
    const topic = inferTopic(row)
    const groupKey = topic.groupKey || `topic:${topic.key}`
    if (!groups.has(groupKey)) groups.set(groupKey, { topic, rows: [] })
    groups.get(groupKey).rows.push(row)
  }

  const result = Array.from(groups.entries()).map(([groupId, entry]) => {
    const sortedRows = [...entry.rows].sort(newestFirst)
    const unresolved = sortedRows.filter((row) =>
      ['legacy_unreviewed', 'pending_review'].includes(row.rule_status || 'legacy_unreviewed'),
    )
    const pending = sortedRows.find((row) => row.rule_status === 'pending_review') || null
    const active = sortedRows.filter((row) => row.rule_status === 'active')

    const sourceIds = unresolved
      .filter((row) => row.id !== pending?.id)
      .map((row) => Number(row.id))
    // Una corrección creada directamente como pending_review puede no tener
    // fuentes legacy. En ese caso ella misma es el objetivo revisable.
    if (!sourceIds.length && pending?.id) sourceIds.push(Number(pending.id))

    return {
      id: groupId,
      ruleKey: entry.topic.key || null,
      label: entry.topic.label,
      conflict: entry.topic.conflict || null,
      counts: {
        total: sortedRows.length,
        unresolved: unresolved.length,
        legacy: sortedRows.filter((row) => (row.rule_status || 'legacy_unreviewed') === 'legacy_unreviewed').length,
        pending: sortedRows.filter((row) => row.rule_status === 'pending_review').length,
        active: active.length,
        rejected: sortedRows.filter((row) => row.rule_status === 'rejected').length,
        superseded: sortedRows.filter((row) => row.rule_status === 'superseded').length,
      },
      sourceIds,
      rows: sortedRows.map(publicRow),
      activeRules: active.map(publicRow),
      defaultDraft: buildDefaultDraft(entry.topic, sortedRows),
    }
  })

  result.sort((a, b) => {
    const unresolved = b.counts.unresolved - a.counts.unresolved
    if (unresolved) return unresolved
    return a.label.localeCompare(b.label, 'es')
  })

  const statusCounts = Object.fromEntries(RULE_STATUSES.map((status) => [status, 0]))
  for (const row of rows) {
    const status = RULE_STATUSES.includes(row.rule_status) ? row.rule_status : 'legacy_unreviewed'
    statusCounts[status] += 1
  }

  return {
    groups: result,
    summary: {
      total: rows.length,
      topics: result.length,
      unresolved: statusCounts.legacy_unreviewed + statusCounts.pending_review,
      conflicts: result.filter((group) => group.conflict && group.counts.unresolved > 0).length,
      ...statusCounts,
    },
  }
}

function cleanArray(values, mapper = clean) {
  if (!Array.isArray(values)) return []
  return [...new Set(values.map(mapper).filter(Boolean))]
}

function validIsoDate(value) {
  if (!value) return true
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value))
}

/**
 * Valida y normaliza una orden del panel. No accede a base de datos.
 */
export function validateMethodRuleReviewCommand(body) {
  const input = body && typeof body === 'object' ? body : {}
  const action = clean(input.action)
  if (!ACTIONS.has(action)) return { ok: false, status: 400, error: 'invalid_action' }

  const sourceIds = cleanArray(input.sourceIds, (value) => {
    const id = Number(value)
    return Number.isSafeInteger(id) && id > 0 ? id : null
  })
  if (!sourceIds.length || sourceIds.length > MAX_SOURCE_IDS) {
    return { ok: false, status: 400, error: 'invalid_source_ids' }
  }

  if (action === 'approve' && input.confirmation !== 'ACTIVAR_REGLA') {
    return { ok: false, status: 400, error: 'approval_confirmation_required' }
  }
  if (action === 'reject' && input.confirmation !== 'RECHAZAR_GRUPO') {
    return { ok: false, status: 400, error: 'rejection_confirmation_required' }
  }

  const canonicalId = input.canonicalId == null ? null : Number(input.canonicalId)
  if (canonicalId != null && (!Number.isSafeInteger(canonicalId) || canonicalId <= 0)) {
    return { ok: false, status: 400, error: 'invalid_canonical_id' }
  }

  if (action === 'reject') {
    return { ok: true, value: { action, sourceIds, canonicalId } }
  }

  const ruleKey = clean(input.ruleKey)
  const ruleText = clean(input.ruleText)
  const ruleType = clean(input.ruleType)
  const validity = clean(input.validity)
  const strength = clean(input.strength)

  if (!/^[a-z][a-z0-9_]{2,79}$/.test(ruleKey)) {
    return { ok: false, status: 400, error: 'invalid_rule_key' }
  }
  if (!ruleText || ruleText.length > MAX_RULE_TEXT) {
    return { ok: false, status: 400, error: 'invalid_rule_text' }
  }
  if (!RULE_TYPES.has(ruleType)) return { ok: false, status: 400, error: 'invalid_rule_type' }
  if (!RULE_VALIDITIES.includes(validity)) return { ok: false, status: 400, error: 'invalid_rule_validity' }
  if (!RULE_STRENGTHS.includes(strength)) return { ok: false, status: 400, error: 'invalid_rule_strength' }

  const validFrom = clean(input.validFrom) || null
  const validTo = clean(input.validTo) || null
  if (!validIsoDate(validFrom) || !validIsoDate(validTo)) {
    return { ok: false, status: 400, error: 'invalid_dates' }
  }
  if (validFrom && validTo && validFrom > validTo) {
    return { ok: false, status: 400, error: 'invalid_date_range' }
  }
  if (validity === 'temporary' && !validFrom && !validTo) {
    return { ok: false, status: 400, error: 'temporary_window_required' }
  }

  const weekNumber = input.weekNumber == null || input.weekNumber === '' ? null : Number(input.weekNumber)
  if (weekNumber != null && (!Number.isInteger(weekNumber) || weekNumber <= 0)) {
    return { ok: false, status: 400, error: 'invalid_week_number' }
  }
  if (validity === 'weekly_exception' && weekNumber == null && !(validFrom && validTo)) {
    return { ok: false, status: 400, error: 'weekly_scope_required' }
  }

  const dayOfWeek = cleanArray(input.dayOfWeek, (value) => {
    const day = Number(value)
    return Number.isInteger(day) && day >= 1 && day <= 7 ? day : null
  })

  return {
    ok: true,
    value: {
      action,
      sourceIds,
      canonicalId,
      ruleKey,
      ruleText,
      ruleType,
      validity,
      strength,
      validFrom,
      validTo,
      mesocycleKey: clean(input.mesocycleKey) || null,
      weekNumber,
      dayOfWeek,
      classTypes: cleanArray(input.classTypes),
      roomKey: clean(input.roomKey) || null,
      timeSlot: clean(input.timeSlot) || null,
      changeReason: clean(input.changeReason).slice(0, 500) || 'revision_centro_metodo',
    },
  }
}

export const METHOD_RULE_REVIEW_TOPICS = TOPICS
