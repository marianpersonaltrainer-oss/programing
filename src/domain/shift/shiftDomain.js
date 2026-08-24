export const SHIFT_STATE_VERSION = 4
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
  { id: 'previous-shift', label: 'Revisar notas e incidencias del turno anterior.' },
  { id: 'systems', label: 'Encender y comprobar ordenador, música, luces, aire y dispositivos.' },
  { id: 'spaces', label: 'Revisar sala, baños, limpieza y material.' },
  { id: 'schedule', label: 'Revisar programación, horarios y personas que vienen hoy.' },
  { id: 'first-class-setup', label: 'Preparar material y primera clase del turno.' },
]

export const OPENING_ACTIVITY_DEFINITIONS = {
  'previous-shift': {
    evidenceKind: 'previous_shift_review',
    checks: [
      { id: 'handover-note', label: 'Nota del turno anterior revisada.' },
      { id: 'active-incidents', label: 'Incidencias activas, responsables y plazos revisados.' },
    ],
  },
  systems: {
    evidenceKind: 'systems_check',
    checks: [
      { id: 'computer', label: 'Ordenador.' },
      { id: 'music', label: 'Música.' },
      { id: 'lights', label: 'Luces.' },
      { id: 'climate', label: 'Aire o climatización.' },
      { id: 'devices', label: 'Dispositivos necesarios.' },
    ],
  },
  spaces: {
    evidenceKind: 'spaces_check',
    checks: [
      { id: 'room', label: 'Sala.' },
      { id: 'bathrooms', label: 'Baños.' },
      { id: 'cleaning', label: 'Limpieza.' },
      { id: 'order', label: 'Orden.' },
      { id: 'material', label: 'Material necesario.' },
    ],
  },
  schedule: {
    evidenceKind: 'programming_review',
    checks: [
      { id: 'class-0700', label: '07:00 · EVO Funcional.' },
      { id: 'class-1030', label: '10:30 · EVO Fuerza.' },
      { id: 'class-1330', label: '13:30 · EVO Basics.' },
    ],
  },
  'first-class-setup': {
    evidenceKind: 'first_class_preparation',
    checks: [
      { id: 'context', label: 'Objetivo, estructura y personas revisados.' },
      { id: 'material', label: 'Material necesario preparado.' },
      { id: 'layout', label: 'Sala y pasos de preparación listos.' },
      { id: 'alternative', label: 'Alternativa prevista revisada.' },
    ],
  },
}

export const CLOSING_CHECKLIST_ITEMS = [
  { id: 'material', label: 'Material recogido y colocado.' },
  { id: 'room', label: 'Sala revisada y ordenada.' },
  { id: 'bathrooms', label: 'Baños revisados.' },
  { id: 'cleaning', label: 'Limpieza final comprobada.' },
  { id: 'music-lights-climate', label: 'Música, luces y clima revisados.' },
  { id: 'devices', label: 'Ordenador, pantallas y dispositivos revisados.' },
  { id: 'incidents', label: 'Incidencias resueltas o correctamente asignadas.' },
  { id: 'access', label: 'Acceso y cierre físico del centro comprobados.' },
]

export const CLOSING_ACTIVITY_DEFINITIONS = {
  material: {
    evidenceKind: 'closing_material_check',
    checks: [
      { id: 'collected', label: 'Material de la última clase recogido.' },
      { id: 'stored', label: 'Material colocado en su ubicación.' },
      { id: 'damage', label: 'Daños o faltas revisados.' },
    ],
  },
  room: {
    evidenceKind: 'closing_spaces_check',
    checks: [{ id: 'room', label: 'Sala revisada y ordenada.' }],
  },
  bathrooms: {
    evidenceKind: 'closing_bathrooms_check',
    checks: [{ id: 'bathrooms', label: 'Baños revisados.' }],
  },
  cleaning: {
    evidenceKind: 'closing_cleaning_check',
    checks: [{ id: 'cleaning', label: 'Limpieza final comprobada.' }],
  },
  'music-lights-climate': {
    evidenceKind: 'closing_systems_check',
    checks: [{ id: 'systems', label: 'Música, luces y clima revisados.' }],
  },
  devices: {
    evidenceKind: 'closing_devices_check',
    checks: [{ id: 'devices', label: 'Ordenador, pantallas y dispositivos revisados.' }],
  },
  incidents: {
    evidenceKind: 'closing_incidents_check',
    checks: [{ id: 'incidents', label: 'Incidencias revisadas.' }],
  },
  access: {
    evidenceKind: 'closing_access_check',
    checks: [{ id: 'access', label: 'Acceso y cierre físico comprobados.' }],
  },
}

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
    arrivalMode: 'open-center',
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
    arrivalMode: 'handover',
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
  const tasks = []
  if (template.arrivalMode === 'open-center') {
    tasks.push(createTask('opening', 'Centro abierto y operativo', 'Confirmar que los sistemas básicos permiten empezar.', actor))
  }
  tasks.push(createTask('preparation', 'Preparar mi turno', 'Revisar el briefing completo antes de trabajar.', actor))
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
    openedAt: null,
    openedById: null,
    openedByName: null,
    evidence: null,
    checks: OPENING_ACTIVITY_DEFINITIONS[item.id].checks.map((check) => ({
      ...check,
      status: 'pending',
    })),
  }))
}

function createClosingChecklist(actor, template) {
  if (template.endMode === 'handover') return []
  return CLOSING_CHECKLIST_ITEMS.map((item) => ({
    ...item,
    required: true,
    status: 'pending',
    ownerId: actor.id,
    ownerName: actor.name,
    openedAt: null,
    openedById: null,
    openedByName: null,
    evidence: null,
    checks: CLOSING_ACTIVITY_DEFINITIONS[item.id].checks.map((check) => ({
      ...check,
      status: 'pending',
    })),
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
    arrivalMode: template.arrivalMode,
    trainerId: actor.id,
    trainerName: actor.name,
    startedAt: at,
    punctuality: punctualityFor(template, at),
    status: 'active',
    tasks,
    centerOpening: template.arrivalMode === 'open-center'
      ? { status: 'pending', completedAt: null, completedById: null, completedByName: null }
      : { status: 'not-required', completedAt: null, completedById: null, completedByName: null },
    openingChecklist: [],
    shiftPreparation: null,
    firstClassRecord: null,
    incidents: [],
    closingChecklist: createClosingChecklist(actor, template),
    handoverReady: null,
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

export function confirmCenterOperational(state, { shiftId, actor }, at) {
  return updateShift(state, shiftId, (shift) => {
    assertActiveCoachShift(shift, actor)
    if (shift.arrivalMode !== 'open-center') {
      throw new ShiftRuleError('CENTER_OPENING_NOT_REQUIRED', 'Este turno recibe relevo y no abre el centro.')
    }
    if (shift.centerOpening?.status === 'completed') return shift
    const blockingIncident = shift.incidents.find((incident) => incident.status === 'open'
      && incident.category === 'previous_closing'
      && ['safety', 'service-blocking'].includes(incident.serviceImpact))
    if (blockingIncident) {
      throw new ShiftRuleError('CENTER_OPENING_BLOCKED', 'Resuelve primero el problema que afecta a la seguridad o al servicio.', { incidentId: blockingIncident.id })
    }
    const withOpening = {
      ...shift,
      centerOpening: {
        status: 'completed',
        completedAt: at,
        completedById: actor.id,
        completedByName: actor.name,
      },
      actions: [...shift.actions, actionRecord('center_opened', actor, at)],
    }
    return completeTaskInShift(withOpening, 'opening', actor, at)
  })
}

function openChecklistActivity(items, itemId, actor, at, notFoundCode, notFoundMessage) {
  const item = items.find((candidate) => candidate.id === itemId)
  if (!item) throw new ShiftRuleError(notFoundCode, notFoundMessage)
  if (item.ownerId !== actor.id) throw new ShiftRuleError('ACTIVITY_OWNER_REQUIRED', 'Solo el responsable puede realizar esta actividad.')
  if (item.openedAt || item.status === 'completed') return items
  return items.map((candidate) => candidate.id === itemId
    ? { ...candidate, openedAt: at, openedById: actor.id, openedByName: actor.name }
    : candidate)
}

function completeChecklistCheck(items, itemId, checkId, actor, at, notFoundCode, notFoundMessage) {
  const item = items.find((candidate) => candidate.id === itemId)
  if (!item) throw new ShiftRuleError(notFoundCode, notFoundMessage)
  if (!item.openedAt) throw new ShiftRuleError('ACTIVITY_NOT_OPENED', 'Abre primero la pantalla de trabajo de esta actividad.')
  const check = item.checks.find((candidate) => candidate.id === checkId)
  if (!check) throw new ShiftRuleError('ACTIVITY_CHECK_NOT_FOUND', 'La comprobación concreta no existe.')
  if (check.status === 'checked' || check.status === 'exception') return items
  return items.map((candidate) => candidate.id !== itemId ? candidate : {
    ...candidate,
    checks: candidate.checks.map((candidateCheck) => candidateCheck.id === checkId
      ? { ...candidateCheck, status: 'checked', completedAt: at, completedById: actor.id, completedByName: actor.name }
      : candidateCheck),
  })
}

function validateActivityEvidence(item, definition, evidence) {
  if (!item.openedAt) throw new ShiftRuleError('ACTIVITY_NOT_OPENED', 'Abre primero la pantalla de trabajo de esta actividad.')
  if (!evidence || evidence.kind !== definition.evidenceKind) {
    throw new ShiftRuleError('INVALID_ACTIVITY_EVIDENCE', 'La evidencia no corresponde a esta actividad.')
  }
  const expected = definition.checks.map((check) => check.id).sort()
  const received = Array.isArray(evidence.checkIds) ? [...new Set(evidence.checkIds)].sort() : []
  if (expected.length !== received.length || expected.some((id, index) => id !== received[index])) {
    throw new ShiftRuleError('INCOMPLETE_ACTIVITY_EVIDENCE', 'Faltan comprobaciones concretas para finalizar esta actividad.')
  }
  if (item.checks.some((check) => !['checked', 'exception'].includes(check.status))) {
    throw new ShiftRuleError('ACTIVITY_CHECKS_PENDING', 'Completa o traslada correctamente todas las comprobaciones.')
  }
}

export function openOpeningItem(state, { shiftId, itemId, actor }, at) {
  return updateShift(state, shiftId, (shift) => {
    assertActiveCoachShift(shift, actor)
    const openingChecklist = openChecklistActivity(
      shift.openingChecklist,
      itemId,
      actor,
      at,
      'OPENING_ITEM_NOT_FOUND',
      'La actividad de apertura no existe.',
    )
    if (openingChecklist === shift.openingChecklist) return shift
    return {
      ...shift,
      openingChecklist,
      actions: [...shift.actions, actionRecord('opening_activity_opened', actor, at, { itemId })],
    }
  })
}

export function completeOpeningCheck(state, { shiftId, itemId, checkId, actor }, at) {
  return updateShift(state, shiftId, (shift) => {
    assertActiveCoachShift(shift, actor)
    const openingChecklist = completeChecklistCheck(
      shift.openingChecklist,
      itemId,
      checkId,
      actor,
      at,
      'OPENING_ITEM_NOT_FOUND',
      'La actividad de apertura no existe.',
    )
    if (openingChecklist === shift.openingChecklist) return shift
    return {
      ...shift,
      openingChecklist,
      actions: [...shift.actions, actionRecord('opening_check_completed', actor, at, { itemId, checkId })],
    }
  })
}

export function completeOpeningItem(state, { shiftId, itemId, actor, evidence }, at) {
  return updateShift(state, shiftId, (shift) => {
    assertActiveCoachShift(shift, actor)
    const item = shift.openingChecklist.find((candidate) => candidate.id === itemId)
    if (!item) throw new ShiftRuleError('OPENING_ITEM_NOT_FOUND', 'La actividad de apertura no existe.')
    if (item.ownerId !== actor.id) throw new ShiftRuleError('OPENING_ITEM_OWNER_REQUIRED', 'Solo el responsable puede completar esta actividad.')
    if (item.status === 'completed') return shift
    const definition = OPENING_ACTIVITY_DEFINITIONS[itemId]
    validateActivityEvidence(item, definition, evidence)

    const openingChecklist = shift.openingChecklist.map((candidate) => candidate.id === itemId
      ? {
          ...candidate,
          status: 'completed',
          completedAt: at,
          completedById: actor.id,
          completedByName: actor.name,
          evidence: {
            kind: definition.evidenceKind,
            checkIds: definition.checks.map((check) => check.id),
            outcomes: candidate.checks.map((check) => ({ id: check.id, status: check.status, incidentId: check.incidentId || null })),
          },
        }
      : candidate)
    let nextShift = {
      ...shift,
      openingChecklist,
      actions: [...shift.actions, actionRecord('opening_activity_completed', actor, at, { itemId, evidenceKind: definition.evidenceKind })],
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
    if (shift.arrivalMode === 'open-center' && shift.centerOpening?.status !== 'completed') {
      throw new ShiftRuleError('OPENING_INCOMPLETE', 'Confirma primero que el centro está abierto y operativo.')
    }
    if (shift.shiftPreparation) return shift
    const withPreparation = {
      ...shift,
      shiftPreparation: { completedAt: at, completedById: actor.id, completedByName: actor.name },
      actions: [...shift.actions, actionRecord('shift_briefing_confirmed', actor, at)],
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
  openingCheckId = null,
  closingItemId = null,
  closingCheckId = null,
  category = 'operational',
  serviceImpact = 'none',
  evidence = '',
  owner = SYNTHETIC_ACTORS.direction,
}, at) {
  const cleanDescription = cleanRequiredText(description, 'INCIDENT_DESCRIPTION_REQUIRED', 'Describe brevemente la incidencia.')
  const cleanNextAction = cleanRequiredText(nextAction, 'INCIDENT_NEXT_ACTION_REQUIRED', 'Indica la siguiente acción.')
  const cleanDueAt = cleanRequiredText(dueAt, 'INCIDENT_DUE_AT_REQUIRED', 'Indica un plazo para la incidencia.')
  toDate(cleanDueAt)
  if (!owner?.id || !owner?.name) throw new ShiftRuleError('INCIDENT_OWNER_REQUIRED', 'Asigna un responsable a la incidencia.')
  if (!['operational', 'previous_closing'].includes(category)) throw new ShiftRuleError('INCIDENT_CATEGORY_INVALID', 'La categoría de la incidencia no es válida.')
  if (!['none', 'safety', 'service-blocking'].includes(serviceImpact)) throw new ShiftRuleError('INCIDENT_IMPACT_INVALID', 'El impacto de la incidencia no es válido.')

  const previousShift = category === 'previous_closing'
    ? state.shifts
      .filter((candidate) => candidate.id !== shiftId)
      .sort((left, right) => new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime())
      .at(-1) || null
    : null

  return updateShift(state, shiftId, (shift) => {
    assertActiveCoachShift(shift, actor)
    const openingItem = openingItemId ? shift.openingChecklist.find((item) => item.id === openingItemId) : null
    const closingItem = closingItemId ? shift.closingChecklist.find((item) => item.id === closingItemId) : null
    if (openingItemId && !openingItem) {
      throw new ShiftRuleError('OPENING_ITEM_NOT_FOUND', 'La actividad de apertura no existe.')
    }
    if (openingItemId && !openingCheckId) {
      throw new ShiftRuleError('OPENING_CHECK_REQUIRED', 'Selecciona el elemento de apertura afectado.')
    }
    if (openingCheckId && !openingItem?.checks.some((check) => check.id === openingCheckId)) {
      throw new ShiftRuleError('ACTIVITY_CHECK_NOT_FOUND', 'El elemento de apertura afectado no existe.')
    }
    if (closingItemId && !closingItem) {
      throw new ShiftRuleError('CLOSING_ITEM_NOT_FOUND', 'La actividad de cierre no existe.')
    }
    if (closingItemId && !closingCheckId) {
      throw new ShiftRuleError('CLOSING_CHECK_REQUIRED', 'Selecciona el elemento de cierre afectado.')
    }
    if (closingCheckId && !closingItem?.checks.some((check) => check.id === closingCheckId)) {
      throw new ShiftRuleError('ACTIVITY_CHECK_NOT_FOUND', 'El elemento de cierre afectado no existe.')
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
      category,
      serviceImpact,
      evidence: String(evidence || '').trim(),
      relatedShiftId: previousShift?.id || null,
      relatedTrainerId: previousShift?.trainerId || null,
      relatedTrainerName: previousShift?.trainerName || null,
      notification: {
        status: 'pending-local',
        recipientId: previousShift?.trainerId || SYNTHETIC_ACTORS.direction.id,
        recipientName: previousShift?.trainerName || SYNTHETIC_ACTORS.direction.name,
      },
      openingItemId,
      openingCheckId,
      closingItemId,
      closingCheckId,
    }
    const markException = (items, itemId, checkId) => items.map((item) => item.id !== itemId ? item : {
      ...item,
      checks: item.checks.map((check) => check.id !== checkId ? check : {
        ...check,
        status: 'exception',
        incidentId: incident.id,
        completedAt: at,
        completedById: actor.id,
        completedByName: actor.name,
      }),
    })
    return {
      ...shift,
      openingChecklist: openingItemId
        ? markException(shift.openingChecklist, openingItemId, openingCheckId)
        : shift.openingChecklist,
      closingChecklist: closingItemId
        ? markException(shift.closingChecklist, closingItemId, closingCheckId)
        : shift.closingChecklist,
      incidents: [...shift.incidents, incident],
      actions: [...shift.actions, actionRecord('incident_recorded', actor, at, {
        incidentId: incident.id,
        openingItemId,
        openingCheckId,
        closingItemId,
        closingCheckId,
        category,
        serviceImpact,
      })],
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

export function openClosingItem(state, { shiftId, itemId, actor }, at) {
  return updateShift(state, shiftId, (shift) => {
    assertActiveCoachShift(shift, actor)
    if (!shift.shiftPreparation) throw new ShiftRuleError('SHIFT_NOT_PREPARED', 'Completa primero la preparación del turno.')
    const closingChecklist = openChecklistActivity(
      shift.closingChecklist,
      itemId,
      actor,
      at,
      'CLOSING_ITEM_NOT_FOUND',
      'La actividad de cierre no existe.',
    )
    if (closingChecklist === shift.closingChecklist) return shift
    return {
      ...shift,
      closingChecklist,
      actions: [...shift.actions, actionRecord('closing_activity_opened', actor, at, { itemId })],
    }
  })
}

export function completeClosingCheck(state, { shiftId, itemId, checkId, actor }, at) {
  return updateShift(state, shiftId, (shift) => {
    assertActiveCoachShift(shift, actor)
    if (!shift.shiftPreparation) throw new ShiftRuleError('SHIFT_NOT_PREPARED', 'Completa primero la preparación del turno.')
    const closingChecklist = completeChecklistCheck(
      shift.closingChecklist,
      itemId,
      checkId,
      actor,
      at,
      'CLOSING_ITEM_NOT_FOUND',
      'La actividad de cierre no existe.',
    )
    if (closingChecklist === shift.closingChecklist) return shift
    return {
      ...shift,
      closingChecklist,
      actions: [...shift.actions, actionRecord('closing_check_completed', actor, at, { itemId, checkId })],
    }
  })
}

export function completeClosingItem(state, { shiftId, itemId, actor, evidence }, at) {
  return updateShift(state, shiftId, (shift) => {
    assertActiveCoachShift(shift, actor)
    if (!shift.shiftPreparation) throw new ShiftRuleError('SHIFT_NOT_PREPARED', 'Completa primero la preparación del turno.')
    const item = shift.closingChecklist.find((candidate) => candidate.id === itemId)
    if (!item) throw new ShiftRuleError('CLOSING_ITEM_NOT_FOUND', 'La actividad de cierre no existe.')
    if (!item.required) return shift
    if (item.ownerId !== actor.id) throw new ShiftRuleError('CLOSING_ITEM_OWNER_REQUIRED', 'Solo el responsable puede completar esta actividad.')
    if (item.status === 'completed') return shift
    const definition = CLOSING_ACTIVITY_DEFINITIONS[itemId]
    validateActivityEvidence(item, definition, evidence)
    const closingChecklist = shift.closingChecklist.map((candidate) => candidate.id === itemId
      ? {
          ...candidate,
          status: 'completed',
          completedAt: at,
          completedById: actor.id,
          completedByName: actor.name,
          evidence: {
            kind: definition.evidenceKind,
            checkIds: definition.checks.map((check) => check.id),
            outcomes: candidate.checks.map((check) => ({ id: check.id, status: check.status, incidentId: check.incidentId || null })),
          },
        }
      : candidate)
    return {
      ...shift,
      closingChecklist,
      actions: [...shift.actions, actionRecord('closing_activity_completed', actor, at, { itemId, evidenceKind: definition.evidenceKind })],
    }
  })
}

export function confirmClosingItem(state, { shiftId, itemId, actor }, at) {
  return updateShift(state, shiftId, (shift) => {
    assertActiveCoachShift(shift, actor)
    if (shift.endMode !== 'close') throw new ShiftRuleError('CENTER_CLOSING_NOT_REQUIRED', 'Este turno se entrega a otro entrenador.')
    if (!shift.shiftPreparation) throw new ShiftRuleError('SHIFT_NOT_PREPARED', 'Completa primero el briefing del turno.')
    const item = shift.closingChecklist.find((candidate) => candidate.id === itemId)
    if (!item) throw new ShiftRuleError('CLOSING_ITEM_NOT_FOUND', 'La comprobación de cierre no existe.')
    if (item.status === 'completed') return shift
    if (item.id === 'incidents' && shift.incidents.some((incident) => incident.status === 'open' && (!incident.ownerId || !incident.dueAt || !incident.nextAction))) {
      throw new ShiftRuleError('INCIDENT_HANDOVER_INCOMPLETE', 'Asigna responsable, plazo y siguiente acción a las incidencias abiertas.')
    }
    const closingChecklist = shift.closingChecklist.map((candidate) => candidate.id === itemId
      ? {
          ...candidate,
          status: 'completed',
          completedAt: at,
          completedById: actor.id,
          completedByName: actor.name,
          checks: candidate.checks.map((check) => ({ ...check, status: 'checked', completedAt: at, completedById: actor.id, completedByName: actor.name })),
          evidence: { kind: CLOSING_ACTIVITY_DEFINITIONS[itemId].evidenceKind, checkIds: candidate.checks.map((check) => check.id) },
        }
      : candidate)
    return { ...shift, closingChecklist, actions: [...shift.actions, actionRecord('closing_item_confirmed', actor, at, { itemId })] }
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
  if (shift.endMode === 'close') {
    shift.closingChecklist
      .filter((item) => item.required && item.status !== 'completed')
      .forEach((item) => blockers.push({ id: `closing-${item.id}`, type: 'closing', label: item.label }))
  }
  return blockers
}

export function closeShift(state, { shiftId, actor, note = '', handoverReady = false }, at) {
  return updateShift(state, shiftId, (shift) => {
    assertActiveCoachShift(shift, actor)
    if (shift.endMode === 'handover' && !handoverReady) {
      throw new ShiftRuleError('HANDOVER_CONFIRMATION_REQUIRED', 'Confirma que el relevo y la sala están preparados.')
    }
    const blockers = getClosingBlockers(shift, actor.id)
    if (blockers.length > 0) {
      throw new ShiftRuleError('SHIFT_BLOCKERS_PENDING', 'Revisa las obligaciones pendientes antes de finalizar.', { blockers })
    }
    return {
      ...shift,
      status: 'closed',
      closingNote: String(note || '').trim(),
      handoverReady: shift.endMode === 'handover'
        ? { completedAt: at, completedById: actor.id, completedByName: actor.name }
        : null,
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
  const openingProgress = shift.arrivalMode === 'open-center' ? (shift.centerOpening?.status === 'completed' ? 1 : 0) : 1
  const closingRequired = shift.closingChecklist.filter((item) => item.required)
  const closingCompleted = closingRequired.filter((item) => item.status === 'completed').length
  const milestones = [
    1,
    openingProgress,
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
      label: incident.category === 'previous_closing' ? 'Cierre anterior' : 'Incidencia abierta',
      detail: incident.description,
      owner: incident.ownerName,
      dueAt: incident.dueAt,
      nextAction: incident.nextAction,
      createdAt: incident.createdAt,
      createdBy: incident.createdByName,
      shiftLabel: `${shift.label} · ${shift.dateKey}`,
      relatedTrainerName: incident.relatedTrainerName || null,
      serviceImpact: incident.serviceImpact || 'none',
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

function upgradeChecklistActivity(base, persisted, definition, actor) {
  if (!persisted) return base
  const completed = persisted.status === 'completed'
  const openedAt = persisted.openedAt || (completed ? persisted.completedAt : null)
  const checks = base.checks.map((baseCheck) => {
    const storedCheck = persisted.checks?.find((check) => check.id === baseCheck.id)
    if (storedCheck && (!completed || storedCheck.status !== 'pending')) return { ...baseCheck, ...storedCheck }
    if (!completed) return baseCheck
    return {
      ...baseCheck,
      status: 'checked',
      completedAt: persisted.completedAt,
      completedById: persisted.completedById || actor.id,
      completedByName: persisted.completedByName || actor.name,
    }
  })
  return {
    ...base,
    ...persisted,
    openedAt,
    openedById: persisted.openedById || (openedAt ? actor.id : null),
    openedByName: persisted.openedByName || (openedAt ? actor.name : null),
    checks,
    evidence: persisted.evidence || (completed ? {
      kind: `legacy_${definition.evidenceKind}`,
      checkIds: checks.map((check) => check.id),
      outcomes: checks.map((check) => ({ id: check.id, status: check.status, incidentId: check.incidentId || null })),
      legacy: true,
    } : null),
  }
}

function upgradePhase23State(state) {
  return {
    version: 3,
    shifts: state.shifts.map((shift) => {
      const actor = { id: shift.trainerId, name: shift.trainerName }
      const template = SHIFT_TEMPLATES[shift.templateId] || SHIFT_TEMPLATES.morning
      return {
        ...shift,
        openingChecklist: createOpeningChecklist(actor).map((base) => upgradeChecklistActivity(
          base,
          shift.openingChecklist?.find((item) => item.id === base.id),
          OPENING_ACTIVITY_DEFINITIONS[base.id],
          actor,
        )),
        closingChecklist: createClosingChecklist(actor, template).map((base) => upgradeChecklistActivity(
          base,
          shift.closingChecklist?.find((item) => item.id === base.id),
          CLOSING_ACTIVITY_DEFINITIONS[base.id],
          actor,
        )),
        incidents: (shift.incidents || []).map((incident) => ({
          ...incident,
          openingCheckId: incident.openingCheckId || null,
          closingItemId: incident.closingItemId || null,
          closingCheckId: incident.closingCheckId || null,
        })),
      }
    }),
  }
}

function migratePhase23ToBriefing(state) {
  return {
    version: SHIFT_STATE_VERSION,
    shifts: state.shifts.map((shift) => {
      const actor = { id: shift.trainerId, name: shift.trainerName }
      const template = SHIFT_TEMPLATES[shift.templateId] || SHIFT_TEMPLATES.morning
      const oldOpeningTask = shift.tasks?.find((task) => task.id === 'opening')
      const oldPreparationTask = shift.tasks?.find((task) => ['preparation', 'briefing'].includes(task.id))
      const oldFirstClassTask = shift.tasks?.find((task) => task.id === 'first-class')
      const closed = shift.status === 'closed'
      const openingCompleted = closed || oldOpeningTask?.status === 'completed' || shift.openingChecklist?.every((item) => item.status === 'completed')
      const preparationCompleted = closed || oldPreparationTask?.status === 'completed' || Boolean(shift.shiftPreparation)
      const firstClassCompleted = closed || oldFirstClassTask?.status === 'completed' || Boolean(shift.firstClassRecord)
      const tasks = createShiftTasks(actor, template).map((task) => {
        const completed = task.id === 'opening' ? openingCompleted : task.id === 'preparation' ? preparationCompleted : firstClassCompleted
        if (!completed) return task
        const source = task.id === 'opening' ? oldOpeningTask : task.id === 'preparation' ? oldPreparationTask : oldFirstClassTask
        return {
          ...task,
          status: 'completed',
          completedAt: source?.completedAt || shift.closedAt || shift.startedAt,
          completedById: source?.completedById || actor.id,
          completedByName: source?.completedByName || actor.name,
        }
      })
      const closingChecklist = createClosingChecklist(actor, template).map((item) => closed
        ? {
            ...item,
            status: 'completed',
            completedAt: shift.closedAt,
            completedById: shift.closedById || actor.id,
            completedByName: shift.closedByName || actor.name,
            checks: item.checks.map((check) => ({ ...check, status: 'checked', completedAt: shift.closedAt, completedById: actor.id, completedByName: actor.name })),
            evidence: { kind: CLOSING_ACTIVITY_DEFINITIONS[item.id].evidenceKind, checkIds: item.checks.map((check) => check.id), legacy: true },
          }
        : item)
      return {
        ...shift,
        arrivalMode: template.arrivalMode,
        endMode: template.endMode,
        endLabel: template.endLabel,
        tasks,
        centerOpening: template.arrivalMode === 'open-center'
          ? {
              status: openingCompleted ? 'completed' : 'pending',
              completedAt: openingCompleted ? oldOpeningTask?.completedAt || shift.startedAt : null,
              completedById: openingCompleted ? oldOpeningTask?.completedById || actor.id : null,
              completedByName: openingCompleted ? oldOpeningTask?.completedByName || actor.name : null,
            }
          : { status: 'not-required', completedAt: null, completedById: null, completedByName: null },
        legacyOpeningAudit: shift.openingChecklist || [],
        openingChecklist: [],
        closingChecklist,
        handoverReady: closed && template.endMode === 'handover'
          ? { completedAt: shift.closedAt, completedById: shift.closedById || actor.id, completedByName: shift.closedByName || actor.name }
          : null,
        incidents: (shift.incidents || []).map((incident) => ({
          ...incident,
          category: incident.category || 'operational',
          serviceImpact: incident.serviceImpact || 'none',
          evidence: incident.evidence || '',
          relatedShiftId: incident.relatedShiftId || null,
          relatedTrainerId: incident.relatedTrainerId || null,
          relatedTrainerName: incident.relatedTrainerName || null,
          notification: incident.notification || { status: 'pending-local', recipientId: SYNTHETIC_ACTORS.direction.id, recipientName: SYNTHETIC_ACTORS.direction.name },
        })),
      }
    }),
  }
}

export function upgradeLegacyShiftState(state) {
  if (state?.version === SHIFT_STATE_VERSION) return state
  if (state?.version === 3 && Array.isArray(state.shifts)) return migratePhase23ToBriefing(state)
  if (state?.version === 2 && Array.isArray(state.shifts)) return migratePhase23ToBriefing(upgradePhase23State(state))
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

  return migratePhase23ToBriefing(upgradePhase23State({ version: 2, shifts }))
}
