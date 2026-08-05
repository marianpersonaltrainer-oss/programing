export const SHIFT_STATE_VERSION = 2
export const MAX_CRITICAL_TASKS = 3
export const FIRST_CLASS_TEXT_LIMIT = 180

export const FIRST_CLASS_MOVEMENT_OPTIONS = [
  'Se movió bastante bien.',
  'Necesita bastante guía y corrección.',
  'Tiene poca movilidad o coordinación y hay que estar muy pendiente.',
]

export const FIRST_CLASS_DISCOMFORT_OPTIONS = [
  'No tenía molestia.',
  'Pudo entrenar sin dolor.',
  'Necesita bastantes adaptaciones porque la molestia limita el entrenamiento.',
]

export const FIRST_CLASS_VOLUME_OPTIONS = [25, 50, 75, 100]

export const OPENING_CHECKLIST_ITEMS = [
  { id: 'previous-shift', label: 'Revisar notas e incidencias del turno anterior.', completionEvidence: 'previous-shift-reviewed' },
  { id: 'systems', label: 'Encender y comprobar ordenador, música, luces, aire y dispositivos.', completionEvidence: 'systems-checked' },
  { id: 'spaces', label: 'Revisar sala, baños, limpieza y material.', completionEvidence: 'spaces-checked' },
  { id: 'schedule', label: 'Revisar programación, horarios y personas que vienen hoy.', completionEvidence: 'programming-reviewed' },
  { id: 'first-class-setup', label: 'Preparar material y primera clase del turno.', completionEvidence: 'first-class-prepared' },
]

export const CLOSING_CHECKLIST_ITEMS = [
  { id: 'material', label: 'Material recogido y colocado.' },
  { id: 'spaces', label: 'Sala y baños revisados.' },
  { id: 'next-coach', label: 'Sala preparada para el siguiente entrenador.' },
  { id: 'systems', label: 'Ordenador, música, aire y luces revisados.' },
]

export const SYNTHETIC_ACTORS = {
  coach: { id: 'coach-lara-demo', name: 'Lara Demo', role: 'coach' },
  direction: { id: 'direction-evo-demo', name: 'Dirección Demo', role: 'direction' },
}

export const SHIFT_TEMPLATES = {
  morning: {
    id: 'morning',
    label: 'Mañana',
    scheduledStart: '06:45',
    scheduledEnd: '14:30',
    endMode: 'handover',
    endLabel: 'Entregar turno',
    requiresNextCoachPrep: true,
    requiresFirstClass: true,
  },
  afternoon: {
    id: 'afternoon',
    label: 'Tarde',
    scheduledStart: '14:30',
    scheduledEnd: '22:15',
    endMode: 'close',
    endLabel: 'Cerrar centro',
    requiresNextCoachPrep: false,
    requiresFirstClass: true,
  },
}

export class ShiftRuleError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'ShiftRuleError'
    this.code = code
    this.details = details
  }
}

export function createEmptyShiftState() {
  return { version: SHIFT_STATE_VERSION, shifts: [] }
}

function requireCoach(actor) {
  if (!actor || actor.role !== 'coach') {
    throw new ShiftRuleError('COACH_ROLE_REQUIRED', 'Esta acción pertenece al entrenador de prueba.')
  }
}

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) throw new ShiftRuleError('INVALID_TIME', 'La hora de la acción no es válida.')
  return date
}

export function getLocalDateKey(value) {
  const date = toDate(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function actionRecord(type, actor, at, detail = {}) {
  return {
    id: `${type}-${at}-${actor.id}`,
    type,
    actorId: actor.id,
    actorName: actor.name,
    at,
    ...detail,
  }
}

function createTask(id, title, detail, actor, status = 'pending', completion = {}) {
  return {
    id,
    title,
    detail,
    status,
    critical: true,
    ownerId: actor.id,
    ownerName: actor.name,
    ...completion,
  }
}

function createShiftTasks(actor, template) {
  const tasks = [
    createTask('opening', 'Abrir y preparar la sala', 'Completar las cinco comprobaciones de apertura.', actor),
    createTask('preparation', 'Prepara tu turno', 'Revisar clases, personas y avisos antes de trabajar.', actor),
  ]
  if (template.requiresFirstClass) {
    tasks.push(createTask('first-class', 'Registrar primera clase', 'Registrar movimiento, molestia y trabajo completado.', actor))
  }
  return tasks
}

function createOpeningChecklist(actor) {
  return OPENING_CHECKLIST_ITEMS.map((item) => ({
    ...item,
    status: 'pending',
    ownerId: actor.id,
    ownerName: actor.name,
  }))
}

function createClosingChecklist(actor, template) {
  return CLOSING_CHECKLIST_ITEMS.map((item) => ({
    ...item,
    required: item.id !== 'next-coach' || template.requiresNextCoachPrep,
    status: item.id === 'next-coach' && !template.requiresNextCoachPrep ? 'not-required' : 'pending',
    ownerId: actor.id,
    ownerName: actor.name,
  }))
}

function punctualityFor(template, at) {
  const date = toDate(at)
  const [hours, minutes] = template.scheduledStart.split(':').map(Number)
  const scheduled = new Date(date)
  scheduled.setHours(hours, minutes, 0, 0)
  const differenceMinutes = Math.round((date.getTime() - scheduled.getTime()) / 60000)
  if (differenceMinutes <= 0) return { status: 'on-time', label: 'A tiempo', differenceMinutes }
  return { status: 'late', label: `${differenceMinutes} min tarde`, differenceMinutes }
}

export function startShift(state, { templateId, actor }, at) {
  requireCoach(actor)
  const template = SHIFT_TEMPLATES[templateId]
  if (!template) throw new ShiftRuleError('UNKNOWN_SHIFT_TEMPLATE', 'La franja de turno no existe.')

  const dateKey = getLocalDateKey(at)
  const existing = state.shifts.find((shift) => shift.dateKey === dateKey && shift.templateId === templateId)
  if (existing) return { state, shift: existing, duplicate: true }

  const tasks = createShiftTasks(actor, template)
  if (tasks.filter((task) => task.critical).length > MAX_CRITICAL_TASKS) {
    throw new ShiftRuleError('TOO_MANY_CRITICAL_TASKS', `Un turno no puede superar ${MAX_CRITICAL_TASKS} tareas críticas.`)
  }

  const shift = {
    id: `shift-${dateKey}-${templateId}`,
    dateKey,
    templateId,
    label: template.label,
    scheduledStart: template.scheduledStart,
    scheduledEnd: template.scheduledEnd,
    assignedShift: `${template.label} · ${template.scheduledStart}–${template.scheduledEnd}`,
    endMode: template.endMode,
    endLabel: template.endLabel,
    trainerId: actor.id,
    trainerName: actor.name,
    startedAt: at,
    punctuality: punctualityFor(template, at),
    status: 'active',
    tasks,
    openingChecklist: createOpeningChecklist(actor),
    shiftPreparation: null,
    firstClassRecord: null,
    incidents: [],
    closingChecklist: createClosingChecklist(actor, template),
    closingNote: '',
    closedAt: null,
    actions: [actionRecord('shift_started', actor, at, { assignedShift: template.id })],
  }

  return { state: { ...state, shifts: [...state.shifts, shift] }, shift, duplicate: false }
}

function updateShift(state, shiftId, update) {
  let found = false
  const shifts = state.shifts.map((shift) => {
    if (shift.id !== shiftId) return shift
    found = true
    return update(shift)
  })
  if (!found) throw new ShiftRuleError('SHIFT_NOT_FOUND', 'No se ha encontrado el turno de prueba.')
  return { ...state, shifts }
}

function assertActiveCoachShift(shift, actor) {
  requireCoach(actor)
  if (shift.status !== 'active') throw new ShiftRuleError('SHIFT_ALREADY_CLOSED', 'El turno ya está cerrado.')
  if (shift.trainerId !== actor.id) throw new ShiftRuleError('SHIFT_OWNER_REQUIRED', 'Solo el entrenador responsable puede modificar este turno.')
}

function completeTaskInShift(shift, taskId, actor, at) {
  const task = shift.tasks.find((item) => item.id === taskId)
  if (!task) throw new ShiftRuleError('TASK_NOT_FOUND', 'La tarea no existe en este turno.')
  if (task.ownerId !== actor.id) throw new ShiftRuleError('TASK_OWNER_REQUIRED', 'Solo el responsable puede completar esta tarea.')
  if (task.status === 'completed') return shift
  const tasks = shift.tasks.map((item) => item.id === taskId
    ? { ...item, status: 'completed', completedAt: at, completedById: actor.id, completedByName: actor.name }
    : item)
  return { ...shift, tasks, actions: [...shift.actions, actionRecord(`task_${taskId}_completed`, actor, at)] }
}

export function completeOpeningItem(state, { shiftId, itemId, actor, completionEvidence }, at) {
  return updateShift(state, shiftId, (shift) => {
    assertActiveCoachShift(shift, actor)
    const item = shift.openingChecklist.find((candidate) => candidate.id === itemId)
    if (!item) throw new ShiftRuleError('OPENING_ITEM_NOT_FOUND', 'La comprobación de apertura no existe.')
    const definition = OPENING_CHECKLIST_ITEMS.find((candidate) => candidate.id === itemId)
    if (completionEvidence !== definition?.completionEvidence) {
      throw new ShiftRuleError('OPENING_EVIDENCE_REQUIRED', 'Completa esta comprobación desde la acción que le corresponde.', { itemId })
    }
    if (item.ownerId !== actor.id) throw new ShiftRuleError('OPENING_ITEM_OWNER_REQUIRED', 'Solo el responsable puede completar esta comprobación.')
    if (item.status === 'completed') return shift

    const openingChecklist = shift.openingChecklist.map((candidate) => candidate.id === itemId
      ? { ...candidate, status: 'completed', completionEvidence, completedAt: at, completedById: actor.id, completedByName: actor.name }
      : candidate)
    let nextShift = {
      ...shift,
      openingChecklist,
      actions: [...shift.actions, actionRecord('opening_item_completed', actor, at, { itemId, completionEvidence })],
    }
    if (openingChecklist.every((candidate) => candidate.status === 'completed')) {
      nextShift = completeTaskInShift(nextShift, 'opening', actor, at)
    }
    return nextShift
  })
}

export function completeShiftPreparation(state, { shiftId, actor }, at) {
  return updateShift(state, shiftId, (shift) => {
    assertActiveCoachShift(shift, actor)
    if (shift.openingChecklist.some((item) => item.status !== 'completed')) {
      throw new ShiftRuleError('OPENING_INCOMPLETE', 'Completa primero la apertura de la sala.')
    }
    if (shift.shiftPreparation) return shift
    const withPreparation = {
      ...shift,
      shiftPreparation: { completedAt: at, completedById: actor.id, completedByName: actor.name },
      actions: [...shift.actions, actionRecord('shift_prepared', actor, at)],
    }
    return completeTaskInShift(withPreparation, 'preparation', actor, at)
  })
}

function cleanRequiredText(value, code, message) {
  const cleanValue = String(value || '').trim()
  if (!cleanValue) throw new ShiftRuleError(code, message)
  return cleanValue
}

export function recordIncident(state, {
  shiftId,
  actor,
  description,
  dueAt,
  nextAction,
  openingItemId = null,
  owner = SYNTHETIC_ACTORS.direction,
}, at) {
  const cleanDescription = cleanRequiredText(description, 'INCIDENT_DESCRIPTION_REQUIRED', 'Describe brevemente la incidencia.')
  const cleanNextAction = cleanRequiredText(nextAction, 'INCIDENT_NEXT_ACTION_REQUIRED', 'Indica la siguiente acción.')
  const cleanDueAt = cleanRequiredText(dueAt, 'INCIDENT_DUE_AT_REQUIRED', 'Indica un plazo para la incidencia.')
  toDate(cleanDueAt)
  if (!owner?.id || !owner?.name) throw new ShiftRuleError('INCIDENT_OWNER_REQUIRED', 'Asigna un responsable a la incidencia.')

  return updateShift(state, shiftId, (shift) => {
    assertActiveCoachShift(shift, actor)
    if (openingItemId && !shift.openingChecklist.some((item) => item.id === openingItemId)) {
      throw new ShiftRuleError('OPENING_ITEM_NOT_FOUND', 'La comprobación de apertura no existe.')
    }
    const incident = {
      id: `incident-${shift.id}-${shift.incidents.length + 1}`,
      description: cleanDescription,
      status: 'open',
      createdAt: at,
      createdById: actor.id,
      createdByName: actor.name,
      ownerId: owner.id,
      ownerName: owner.name,
      dueAt: cleanDueAt,
      nextAction: cleanNextAction,
      openingItemId,
    }
    return {
      ...shift,
      incidents: [...shift.incidents, incident],
      actions: [...shift.actions, actionRecord('incident_recorded', actor, at, { incidentId: incident.id, openingItemId })],
    }
  })
}

function firstClassText(value, { required = false, field }) {
  const cleanValue = String(value || '').trim()
  if (required && !cleanValue) {
    throw new ShiftRuleError('FIRST_CLASS_FIELD_REQUIRED', `Completa ${field}.`, { field })
  }
  if (cleanValue.length > FIRST_CLASS_TEXT_LIMIT) {
    throw new ShiftRuleError('FIRST_CLASS_TEXT_TOO_LONG', `${field} no puede superar ${FIRST_CLASS_TEXT_LIMIT} caracteres.`, { field })
  }
  return cleanValue
}

export function recordFirstClass(state, { shiftId, actor, record }, at) {
  const movement = record?.movement
  const discomfort = record?.discomfort
  const volumePercent = Number(record?.volumePercent)

  if (!FIRST_CLASS_MOVEMENT_OPTIONS.includes(movement)) {
    throw new ShiftRuleError('FIRST_CLASS_MOVEMENT_REQUIRED', 'Selecciona cómo se movió durante la clase.')
  }
  if (!FIRST_CLASS_DISCOMFORT_OPTIONS.includes(discomfort)) {
    throw new ShiftRuleError('FIRST_CLASS_DISCOMFORT_REQUIRED', 'Selecciona cómo respondió la molestia o lesión.')
  }
  if (!FIRST_CLASS_VOLUME_OPTIONS.includes(volumePercent)) {
    throw new ShiftRuleError('FIRST_CLASS_VOLUME_REQUIRED', 'Selecciona el volumen completado.')
  }

  const firstClassRecord = {
    movement,
    movementFollowUp: firstClassText(record?.movementFollowUp, { field: 'el movimiento o aspecto a seguir trabajando' }),
    discomfort,
    discomfortZone: firstClassText(record?.discomfortZone, { field: 'la zona de la molestia' }),
    workingAdaptation: firstClassText(record?.workingAdaptation, { field: 'la adaptación que funcionó' }),
    nextCoachObservation: firstClassText(record?.nextCoachObservation, { field: 'la observación para el siguiente entrenador' }),
    volumePercent,
    loadsUsed: firstClassText(record?.loadsUsed, { required: true, field: 'los pesos o cargas utilizados' }),
    adaptedExercises: firstClassText(record?.adaptedExercises, { required: true, field: 'los ejercicios adaptados o sustituidos' }),
    completedAt: at,
    completedById: actor.id,
    completedByName: actor.name,
  }

  return updateShift(state, shiftId, (shift) => {
    assertActiveCoachShift(shift, actor)
    if (!shift.shiftPreparation) throw new ShiftRuleError('SHIFT_NOT_PREPARED', 'Completa primero la preparación del turno.')
    const firstClassTask = shift.tasks.find((task) => task.id === 'first-class')
    if (!firstClassTask) throw new ShiftRuleError('FIRST_CLASS_NOT_REQUIRED', 'Este turno no tiene una primera clase pendiente.')
    if (shift.firstClassRecord) return shift
    const withRecord = {
      ...shift,
      firstClassRecord,
      actions: [...shift.actions, actionRecord('first_class_recorded', actor, at)],
    }
    return completeTaskInShift(withRecord, 'first-class', actor, at)
  })
}

export function completeClosingItem(state, { shiftId, itemId, actor }, at) {
  return updateShift(state, shiftId, (shift) => {
    assertActiveCoachShift(shift, actor)
    if (!shift.shiftPreparation) throw new ShiftRuleError('SHIFT_NOT_PREPARED', 'Completa primero la preparación del turno.')
    const item = shift.closingChecklist.find((candidate) => candidate.id === itemId)
    if (!item) throw new ShiftRuleError('CLOSING_ITEM_NOT_FOUND', 'La comprobación de cierre no existe.')
    if (!item.required) return shift
    if (item.ownerId !== actor.id) throw new ShiftRuleError('CLOSING_ITEM_OWNER_REQUIRED', 'Solo el responsable puede completar esta comprobación.')
    if (item.status === 'completed') return shift
    const closingChecklist = shift.closingChecklist.map((candidate) => candidate.id === itemId
      ? { ...candidate, status: 'completed', completedAt: at, completedById: actor.id, completedByName: actor.name }
      : candidate)
    return {
      ...shift,
      closingChecklist,
      actions: [...shift.actions, actionRecord('closing_item_completed', actor, at, { itemId })],
    }
  })
}

export function getOwnCriticalBlockers(shift, actorId) {
  return shift.tasks.filter((task) => task.critical && task.ownerId === actorId && task.status !== 'completed')
}

export function getClosingBlockers(shift, actorId) {
  const blockers = getOwnCriticalBlockers(shift, actorId).map((task) => ({
    id: `task-${task.id}`,
    type: 'task',
    label: task.title,
  }))
  shift.incidents
    .filter((incident) => incident.status === 'open' && (!incident.ownerId || !incident.dueAt || !incident.nextAction))
    .forEach((incident) => blockers.push({
      id: `incident-${incident.id}`,
      type: 'incident',
      label: `Asignar responsable, plazo y siguiente acción: ${incident.description}`,
    }))
  shift.closingChecklist
    .filter((item) => item.required && item.status !== 'completed')
    .forEach((item) => blockers.push({ id: `closing-${item.id}`, type: 'closing', label: item.label }))
  return blockers
}

export function closeShift(state, { shiftId, actor, note = '' }, at) {
  return updateShift(state, shiftId, (shift) => {
    assertActiveCoachShift(shift, actor)
    const blockers = getClosingBlockers(shift, actor.id)
    if (blockers.length > 0) {
      throw new ShiftRuleError('SHIFT_BLOCKERS_PENDING', 'Revisa las obligaciones pendientes antes de finalizar.', { blockers })
    }
    return {
      ...shift,
      status: 'closed',
      closingNote: String(note || '').trim(),
      closedAt: at,
      closedById: actor.id,
      closedByName: actor.name,
      actions: [...shift.actions, actionRecord(shift.endMode === 'handover' ? 'shift_handed_over' : 'center_closed', actor, at)],
    }
  })
}

export function getLatestShift(state) {
  return state.shifts.at(-1) || null
}

export function getShiftProgress(shift) {
  if (!shift) return 0
  const openingCompleted = shift.openingChecklist.filter((item) => item.status === 'completed').length
  const closingRequired = shift.closingChecklist.filter((item) => item.required)
  const closingCompleted = closingRequired.filter((item) => item.status === 'completed').length
  const milestones = [
    1,
    openingCompleted / shift.openingChecklist.length,
    shift.shiftPreparation ? 1 : 0,
    shift.tasks.some((task) => task.id === 'first-class') ? (shift.firstClassRecord ? 1 : 0) : 1,
    closingRequired.length ? closingCompleted / closingRequired.length : 1,
    shift.status === 'closed' ? 1 : 0,
  ]
  return Math.round((milestones.reduce((total, value) => total + value, 0) / milestones.length) * 100)
}

export function getDirectionExceptions(state) {
  return state.shifts.flatMap((shift) => shift.incidents
    .filter((incident) => incident.status === 'open')
    .map((incident) => ({
      id: incident.id,
      label: 'Incidencia abierta',
      detail: incident.description,
      owner: incident.ownerName,
      dueAt: incident.dueAt,
      nextAction: incident.nextAction,
      createdAt: incident.createdAt,
      createdBy: incident.createdByName,
      shiftLabel: `${shift.label} · ${shift.dateKey}`,
      status: 'exception',
    })))
}

function legacyCompletion(source, actor) {
  return source?.status === 'completed'
    ? {
        status: 'completed',
        completedAt: source.completedAt,
        completedById: source.completedById || actor.id,
        completedByName: source.completedByName || actor.name,
      }
    : { status: 'pending' }
}

export function upgradeLegacyShiftState(state) {
  if (state?.version === SHIFT_STATE_VERSION) return state
  if (state?.version !== 1 || !Array.isArray(state.shifts)) {
    throw new ShiftRuleError('INCOMPATIBLE_SHIFT_STATE', 'Los datos locales del turno no tienen un formato compatible.')
  }

  const shifts = state.shifts.map((legacy) => {
    const template = SHIFT_TEMPLATES[legacy.templateId] || SHIFT_TEMPLATES.morning
    const actor = { id: legacy.trainerId, name: legacy.trainerName }
    const oldOpening = legacy.tasks?.find((task) => task.id === 'opening')
    const oldPreparation = legacy.tasks?.find((task) => task.id === 'briefing')
    const oldFirstClass = legacy.tasks?.find((task) => task.id === 'first-class')
    const openingCompletion = legacyCompletion(oldOpening, actor)
    const preparationCompletion = legacyCompletion(oldPreparation, actor)
    const firstClassCompletion = legacyCompletion(oldFirstClass, actor)
    const closedCompletion = legacy.endPreparation || (legacy.status === 'closed' ? {
      completedAt: legacy.closedAt,
      completedById: actor.id,
      completedByName: actor.name,
    } : null)
    const tasks = [
      createTask('opening', 'Abrir y preparar la sala', 'Completar las cinco comprobaciones de apertura.', actor, openingCompletion.status, openingCompletion),
      createTask('preparation', 'Prepara tu turno', 'Revisar clases, personas y avisos antes de trabajar.', actor, preparationCompletion.status, preparationCompletion),
    ]
    if (template.requiresFirstClass) {
      tasks.push(createTask('first-class', 'Registrar primera clase', 'Registrar movimiento, molestia y trabajo completado.', actor, firstClassCompletion.status, firstClassCompletion))
    }

    return {
      id: legacy.id,
      dateKey: legacy.dateKey,
      templateId: legacy.templateId,
      label: legacy.label,
      scheduledStart: legacy.scheduledStart,
      scheduledEnd: legacy.scheduledEnd,
      assignedShift: `${legacy.label} · ${legacy.scheduledStart}–${legacy.scheduledEnd}`,
      endMode: template.endMode,
      endLabel: template.endLabel,
      trainerId: legacy.trainerId,
      trainerName: legacy.trainerName,
      startedAt: legacy.startedAt,
      punctuality: legacy.punctuality,
      status: legacy.status,
      tasks,
      openingChecklist: createOpeningChecklist(actor).map((item) => ({ ...item, ...openingCompletion })),
      shiftPreparation: preparationCompletion.status === 'completed'
        ? { completedAt: preparationCompletion.completedAt, completedById: preparationCompletion.completedById, completedByName: preparationCompletion.completedByName }
        : null,
      firstClassRecord: legacy.firstClassRecord || null,
      incidents: (legacy.incidents || []).map((incident) => ({
        ...incident,
        ownerId: incident.ownerId || SYNTHETIC_ACTORS.direction.id,
        ownerName: incident.ownerName || SYNTHETIC_ACTORS.direction.name,
        dueAt: incident.dueAt || `${legacy.dateKey}T${legacy.scheduledEnd}:00`,
        nextAction: incident.nextAction || 'Revisar la incidencia y confirmar la siguiente acción.',
        openingItemId: incident.openingItemId || null,
      })),
      closingChecklist: createClosingChecklist(actor, template).map((item) => closedCompletion && item.required
        ? { ...item, status: 'completed', completedAt: closedCompletion.completedAt, completedById: closedCompletion.completedById, completedByName: closedCompletion.completedByName }
        : item),
      closingNote: legacy.endPreparation?.note || '',
      closedAt: legacy.closedAt,
      closedById: legacy.status === 'closed' ? actor.id : null,
      closedByName: legacy.status === 'closed' ? actor.name : null,
      actions: legacy.actions || [],
    }
  })

  return { version: SHIFT_STATE_VERSION, shifts }
}
