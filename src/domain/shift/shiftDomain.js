export const SHIFT_STATE_VERSION = 1
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

export const SYNTHETIC_ACTORS = {
  coach: { id: 'coach-lara-demo', name: 'Lara Demo', role: 'coach' },
  direction: { id: 'direction-evo-demo', name: 'Dirección Demo', role: 'direction' },
}

export const SHIFT_TEMPLATES = {
  morning: { id: 'morning', label: 'Mañana', scheduledStart: '06:45', scheduledEnd: '14:30' },
  afternoon: { id: 'afternoon', label: 'Tarde', scheduledStart: '14:30', scheduledEnd: '22:15' },
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

function createFirstClassTask(actor) {
  return {
    id: 'first-class',
    title: 'Cerrar primera clase',
    detail: 'Registrar movimiento, molestia y trabajo completado.',
    status: 'pending',
    critical: true,
    ownerId: actor.id,
    ownerName: actor.name,
  }
}

function createShiftTasks(actor) {
  return [
    {
      id: 'opening',
      title: 'Confirmar apertura',
      detail: 'Sala revisada. Falta confirmar el inicio del turno.',
      status: 'pending',
      critical: true,
      ownerId: actor.id,
      ownerName: actor.name,
    },
    {
      id: 'briefing',
      title: 'Revisar briefing especial',
      detail: 'Primera clase ficticia a las 13:30.',
      status: 'pending',
      critical: true,
      ownerId: actor.id,
      ownerName: actor.name,
    },
    createFirstClassTask(actor),
    {
      id: 'feedback',
      title: 'Feedback operativo opcional',
      detail: 'Registrar solo si existe información útil para el relevo.',
      status: 'pending',
      critical: false,
      ownerId: actor.id,
      ownerName: actor.name,
    },
  ]
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

  const tasks = createShiftTasks(actor)
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
    trainerId: actor.id,
    trainerName: actor.name,
    startedAt: at,
    punctuality: punctualityFor(template, at),
    status: 'active',
    tasks,
    briefing: null,
    firstClassRecord: null,
    incidents: [],
    feedback: [],
    endPreparation: null,
    closedAt: null,
    actions: [actionRecord('shift_started', actor, at)],
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

export function completeTask(state, { shiftId, taskId, actor }, at) {
  return updateShift(state, shiftId, (shift) => {
    assertActiveCoachShift(shift, actor)
    const task = shift.tasks.find((item) => item.id === taskId)
    if (!task) throw new ShiftRuleError('TASK_NOT_FOUND', 'La tarea no existe en este turno.')
    if (task.ownerId !== actor.id) throw new ShiftRuleError('TASK_OWNER_REQUIRED', 'Solo el responsable puede completar esta tarea.')
    if (task.status === 'completed') return shift

    const tasks = shift.tasks.map((item) => item.id === taskId
      ? { ...item, status: 'completed', completedAt: at, completedById: actor.id, completedByName: actor.name }
      : item)
    return { ...shift, tasks, actions: [...shift.actions, actionRecord(`task_${taskId}_completed`, actor, at)] }
  })
}

export function consultBriefing(state, { shiftId, actor }, at) {
  const withTask = completeTask(state, { shiftId, taskId: 'briefing', actor }, at)
  return updateShift(withTask, shiftId, (shift) => ({
    ...shift,
    briefing: shift.briefing || { consultedAt: at, consultedById: actor.id, consultedByName: actor.name },
  }))
}

export function recordIncident(state, { shiftId, actor, description }, at) {
  const cleanDescription = String(description || '').trim()
  if (!cleanDescription) throw new ShiftRuleError('INCIDENT_DESCRIPTION_REQUIRED', 'Describe brevemente la incidencia.')
  return updateShift(state, shiftId, (shift) => {
    assertActiveCoachShift(shift, actor)
    const incident = {
      id: `incident-${shift.id}-${shift.incidents.length + 1}`,
      description: cleanDescription,
      status: 'open',
      createdAt: at,
      createdById: actor.id,
      createdByName: actor.name,
      ownerId: SYNTHETIC_ACTORS.direction.id,
      ownerName: SYNTHETIC_ACTORS.direction.name,
      nextAction: 'Revisar la incidencia y confirmar la siguiente acción.',
    }
    return { ...shift, incidents: [...shift.incidents, incident], actions: [...shift.actions, actionRecord('incident_recorded', actor, at, { incidentId: incident.id })] }
  })
}

export function recordFeedback(state, { shiftId, actor, note }, at) {
  const cleanNote = String(note || '').trim()
  if (!cleanNote) throw new ShiftRuleError('FEEDBACK_NOTE_REQUIRED', 'Escribe una nota breve para el relevo.')
  const withFeedback = updateShift(state, shiftId, (shift) => {
    assertActiveCoachShift(shift, actor)
    const feedback = {
      id: `feedback-${shift.id}-${shift.feedback.length + 1}`,
      note: cleanNote,
      createdAt: at,
      createdById: actor.id,
      createdByName: actor.name,
    }
    return { ...shift, feedback: [...shift.feedback, feedback], actions: [...shift.actions, actionRecord('feedback_recorded', actor, at, { feedbackId: feedback.id })] }
  })
  return completeTask(withFeedback, { shiftId, taskId: 'feedback', actor }, at)
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

  const withRecord = updateShift(state, shiftId, (shift) => {
    assertActiveCoachShift(shift, actor)
    if (shift.firstClassRecord) return shift
    const existingTask = shift.tasks.find((task) => task.id === 'first-class')
    const completedTask = {
      ...(existingTask || createFirstClassTask(actor)),
      status: 'completed',
      completedAt: at,
      completedById: actor.id,
      completedByName: actor.name,
    }
    const tasks = existingTask
      ? shift.tasks.map((task) => task.id === 'first-class' ? completedTask : task)
      : [...shift.tasks, completedTask]
    return {
      ...shift,
      firstClassRecord,
      tasks,
      actions: [
        ...shift.actions,
        actionRecord('first_class_recorded', actor, at),
        actionRecord('task_first-class_completed', actor, at),
      ],
    }
  })

  return withRecord
}

export function prepareShiftEnd(state, { shiftId, actor, mode, note = '' }, at) {
  if (!['close', 'handover'].includes(mode)) throw new ShiftRuleError('END_MODE_REQUIRED', 'Elige cierre o relevo.')
  return updateShift(state, shiftId, (shift) => {
    assertActiveCoachShift(shift, actor)
    const endPreparation = {
      mode,
      note: String(note || '').trim(),
      completedAt: at,
      completedById: actor.id,
      completedByName: actor.name,
    }
    return { ...shift, endPreparation, actions: [...shift.actions, actionRecord(`${mode}_prepared`, actor, at)] }
  })
}

export function getOwnCriticalBlockers(shift, actorId) {
  const blockers = shift.tasks.filter((task) => task.critical && task.ownerId === actorId && task.status !== 'completed')
  const hasFirstClassTask = shift.tasks.some((task) => task.id === 'first-class')
  if (shift.status === 'active' && shift.trainerId === actorId && !shift.firstClassRecord && !hasFirstClassTask) {
    blockers.push(createFirstClassTask({ id: shift.trainerId, name: shift.trainerName }))
  }
  return blockers
}

export function closeShift(state, { shiftId, actor }, at) {
  return updateShift(state, shiftId, (shift) => {
    assertActiveCoachShift(shift, actor)
    const blockers = getOwnCriticalBlockers(shift, actor.id)
    if (blockers.length > 0) {
      throw new ShiftRuleError('OWN_CRITICAL_TASKS_PENDING', 'Completa tus tareas críticas antes de cerrar.', { taskIds: blockers.map((task) => task.id) })
    }
    if (!shift.endPreparation) throw new ShiftRuleError('SHIFT_END_NOT_PREPARED', 'Completa primero el cierre o el relevo.')
    return { ...shift, status: 'closed', closedAt: at, actions: [...shift.actions, actionRecord('shift_closed', actor, at)] }
  })
}

export function getLatestShift(state) {
  return state.shifts.at(-1) || null
}

export function getShiftProgress(shift) {
  if (!shift) return 0
  const milestones = [
    Boolean(shift.startedAt),
    shift.tasks.find((task) => task.id === 'opening')?.status === 'completed',
    Boolean(shift.briefing),
    Boolean(shift.firstClassRecord),
    shift.incidents.length > 0 || shift.feedback.length > 0,
    Boolean(shift.endPreparation),
    shift.status === 'closed',
  ]
  return Math.round((milestones.filter(Boolean).length / milestones.length) * 100)
}

export function getDirectionExceptions(state) {
  return state.shifts.flatMap((shift) => shift.incidents
    .filter((incident) => incident.status === 'open')
    .map((incident) => ({
      id: incident.id,
      label: 'Incidencia abierta',
      detail: incident.description,
      owner: incident.ownerName,
      nextAction: incident.nextAction,
      createdAt: incident.createdAt,
      createdBy: incident.createdByName,
      shiftLabel: `${shift.label} · ${shift.dateKey}`,
      status: 'exception',
    })))
}
