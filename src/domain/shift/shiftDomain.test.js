import { describe, expect, it } from 'vitest'
import {
  CLOSING_ACTIVITY_DEFINITIONS,
  closeShift,
  completeClosingCheck,
  completeClosingItem,
  completeOpeningCheck,
  completeOpeningItem,
  completeShiftPreparation,
  createEmptyShiftState,
  FIRST_CLASS_DISCOMFORT_OPTIONS,
  FIRST_CLASS_MOVEMENT_OPTIONS,
  getClosingBlockers,
  getDirectionExceptions,
  MAX_CRITICAL_TASKS,
  OPENING_ACTIVITY_DEFINITIONS,
  OPENING_CHECKLIST_ITEMS,
  openClosingItem,
  openOpeningItem,
  recordFirstClass,
  recordIncident,
  SHIFT_STATE_VERSION,
  ShiftRuleError,
  startShift,
  SYNTHETIC_ACTORS,
  upgradeLegacyShiftState,
} from './shiftDomain.js'

const coach = SYNTHETIC_ACTORS.coach
const direction = SYNTHETIC_ACTORS.direction
const startedAt = '2026-08-05T06:42:00+02:00'

const validFirstClassRecord = {
  movement: FIRST_CLASS_MOVEMENT_OPTIONS[0],
  movementFollowUp: '',
  discomfort: FIRST_CLASS_DISCOMFORT_OPTIONS[0],
  discomfortZone: '',
  workingAdaptation: '',
  nextCoachObservation: '',
  volumePercent: 100,
  loadsUsed: 'Mancuernas de 6 kg.',
  adaptedExercises: 'Ninguno.',
}

function startedShift(templateId = 'morning') {
  return startShift(createEmptyShiftState(), { templateId, actor: coach }, startedAt)
}

function completeOpeningActivity(state, shiftId, itemId, index = 0) {
  const definition = OPENING_ACTIVITY_DEFINITIONS[itemId]
  const at = `2026-08-05T06:${String(43 + index).padStart(2, '0')}:00+02:00`
  let next = openOpeningItem(state, { shiftId, itemId, actor: coach }, at)
  definition.checks.forEach((check) => {
    next = completeOpeningCheck(next, { shiftId, itemId, checkId: check.id, actor: coach }, at)
  })
  return completeOpeningItem(next, {
    shiftId,
    itemId,
    actor: coach,
    evidence: { kind: definition.evidenceKind, checkIds: definition.checks.map((check) => check.id) },
  }, at)
}

function completeOpening(state, shiftId) {
  return OPENING_CHECKLIST_ITEMS.reduce(
    (current, item, index) => completeOpeningActivity(current, shiftId, item.id, index),
    state,
  )
}

function completeClosingActivity(state, shiftId, itemId, index = 0) {
  const definition = CLOSING_ACTIVITY_DEFINITIONS[itemId]
  const at = `2026-08-05T14:2${index}:00+02:00`
  let next = openClosingItem(state, { shiftId, itemId, actor: coach }, at)
  definition.checks.forEach((check) => {
    next = completeClosingCheck(next, { shiftId, itemId, checkId: check.id, actor: coach }, at)
  })
  return completeClosingItem(next, {
    shiftId,
    itemId,
    actor: coach,
    evidence: { kind: definition.evidenceKind, checkIds: definition.checks.map((check) => check.id) },
  }, at)
}

function prepareShift(templateId = 'morning') {
  const initial = startedShift(templateId)
  const opened = completeOpening(initial.state, initial.shift.id)
  const prepared = completeShiftPreparation(opened, { shiftId: initial.shift.id, actor: coach }, '2026-08-05T06:50:00+02:00')
  return { state: prepared, shiftId: initial.shift.id }
}

describe('guided shift domain rules', () => {
  it('starts only the assigned shift entry and keeps opening pending', () => {
    const result = startedShift()
    const shift = result.shift

    expect(shift).toMatchObject({
      trainerId: coach.id,
      dateKey: '2026-08-05',
      startedAt,
      assignedShift: 'Mañana · 06:45–14:30',
      endMode: 'handover',
    })
    expect(shift.openingChecklist).toHaveLength(5)
    expect(shift.openingChecklist.every((item) => item.status === 'pending')).toBe(true)
    expect(shift.tasks.find((task) => task.id === 'opening').status).toBe('pending')
    expect(shift.tasks.filter((task) => task.critical)).toHaveLength(3)
    expect(shift.tasks.filter((task) => task.critical).length).toBeLessThanOrEqual(MAX_CRITICAL_TASKS)
  })

  it('recovers the existing assigned shift instead of duplicating it', () => {
    const first = startedShift()
    const second = startShift(first.state, { templateId: 'morning', actor: coach }, '2026-08-05T06:43:00+02:00')

    expect(second.duplicate).toBe(true)
    expect(second.state.shifts).toHaveLength(1)
    expect(second.shift.id).toBe(first.shift.id)
  })

  it('audits every opening item and completes opening only after all five', () => {
    const initial = startedShift()
    expect(() => completeOpeningItem(initial.state, {
      shiftId: initial.shift.id,
      itemId: OPENING_CHECKLIST_ITEMS[0].id,
      actor: coach,
    }, '2026-08-05T06:43:00+02:00')).toThrowError(expect.objectContaining({ code: 'ACTIVITY_NOT_OPENED' }))

    const first = completeOpeningActivity(initial.state, initial.shift.id, OPENING_CHECKLIST_ITEMS[0].id)
    expect(first.shifts[0].openingChecklist[0]).toMatchObject({ completedByName: coach.name, completedAt: '2026-08-05T06:43:00+02:00' })
    expect(first.shifts[0].openingChecklist[0].evidence).toMatchObject({ kind: 'previous_shift_review' })
    expect(first.shifts[0].tasks.find((task) => task.id === 'opening').status).toBe('pending')

    const opened = OPENING_CHECKLIST_ITEMS.slice(1).reduce(
      (current, item, index) => completeOpeningActivity(current, initial.shift.id, item.id, index + 1),
      first,
    )
    expect(opened.shifts[0].openingChecklist.every((item) => item.status === 'completed')).toBe(true)
    expect(opened.shifts[0].tasks.find((task) => task.id === 'opening')).toMatchObject({ status: 'completed', completedByName: coach.name })
  })

  it('registers an opening problem as an assigned incident and leaves the check pending', () => {
    const initial = startedShift()
    const opened = openOpeningItem(initial.state, { shiftId: initial.shift.id, itemId: 'systems', actor: coach }, '2026-08-05T06:43:00+02:00')
    const state = recordIncident(opened, {
      shiftId: initial.shift.id,
      actor: coach,
      description: 'La música no enciende.',
      dueAt: '2026-08-05T08:00:00+02:00',
      nextAction: 'Revisar el altavoz antes de la segunda clase.',
      openingItemId: 'systems',
      openingCheckId: 'music',
    }, '2026-08-05T06:44:00+02:00')
    const shift = state.shifts[0]

    expect(shift.openingChecklist.find((item) => item.id === 'systems').status).toBe('pending')
    expect(shift.incidents[0]).toMatchObject({
      ownerName: direction.name,
      dueAt: '2026-08-05T08:00:00+02:00',
      openingItemId: 'systems',
      openingCheckId: 'music',
    })
    expect(shift.openingChecklist.find((item) => item.id === 'systems').checks.find((check) => check.id === 'music')).toMatchObject({ status: 'exception' })
  })

  it('reveals preparation only after opening and audits its confirmation', () => {
    const initial = startedShift()
    expect(() => completeShiftPreparation(initial.state, { shiftId: initial.shift.id, actor: coach }, '2026-08-05T06:50:00+02:00')).toThrowError(
      expect.objectContaining({ code: 'OPENING_INCOMPLETE' }),
    )

    const opened = completeOpening(initial.state, initial.shift.id)
    const prepared = completeShiftPreparation(opened, { shiftId: initial.shift.id, actor: coach }, '2026-08-05T06:50:00+02:00')
    expect(prepared.shifts[0].shiftPreparation).toEqual({ completedAt: '2026-08-05T06:50:00+02:00', completedById: coach.id, completedByName: coach.name })
    expect(prepared.shifts[0].tasks.find((task) => task.id === 'preparation').status).toBe('completed')
  })

  it('requires preparation and stores one mandatory first class record without duplicates', () => {
    const initial = startedShift()
    expect(() => recordFirstClass(initial.state, { shiftId: initial.shift.id, actor: coach, record: validFirstClassRecord }, '2026-08-05T12:00:00+02:00')).toThrowError(
      expect.objectContaining({ code: 'SHIFT_NOT_PREPARED' }),
    )

    const prepared = prepareShift()
    const first = recordFirstClass(prepared.state, { shiftId: prepared.shiftId, actor: coach, record: validFirstClassRecord }, '2026-08-05T12:00:00+02:00')
    const second = recordFirstClass(first, { shiftId: prepared.shiftId, actor: coach, record: { ...validFirstClassRecord, loadsUsed: 'Otra carga.' } }, '2026-08-05T12:05:00+02:00')
    const shift = second.shifts[0]

    expect(shift.firstClassRecord).toMatchObject({ loadsUsed: 'Mancuernas de 6 kg.', completedByName: coach.name })
    expect(shift.actions.filter((action) => action.type === 'first_class_recorded')).toHaveLength(1)
    expect(shift.tasks.find((task) => task.id === 'first-class').status).toBe('completed')
  })

  it('lists concrete close blockers and allows an assigned open incident to transfer', () => {
    const prepared = prepareShift()
    const incidentState = recordIncident(prepared.state, {
      shiftId: prepared.shiftId,
      actor: coach,
      description: 'Remo 04 fuera de uso.',
      dueAt: '2026-08-05T15:00:00+02:00',
      nextAction: 'Revisar el remo y confirmar servicio.',
    }, '2026-08-05T11:30:00+02:00')
    const blockers = getClosingBlockers(incidentState.shifts[0], coach.id)

    expect(blockers.map((blocker) => blocker.label)).toEqual(expect.arrayContaining([
      'Registrar primera clase',
      'Material recogido y colocado.',
      'Sala y baños revisados.',
      'Sala preparada para el siguiente entrenador.',
      'Ordenador, música, aire y luces revisados.',
    ]))
    expect(blockers.some((blocker) => blocker.type === 'incident')).toBe(false)
  })

  it('blocks finalization until all mandatory records and closing checks are complete', () => {
    const prepared = prepareShift()
    let state = recordFirstClass(prepared.state, { shiftId: prepared.shiftId, actor: coach, record: validFirstClassRecord }, '2026-08-05T12:00:00+02:00')
    const requiredClosingItems = state.shifts[0].closingChecklist.filter((item) => item.required)

    expect(() => closeShift(state, { shiftId: prepared.shiftId, actor: coach }, '2026-08-05T14:30:00+02:00')).toThrowError(ShiftRuleError)
    requiredClosingItems.forEach((item, index) => {
      state = completeClosingActivity(state, prepared.shiftId, item.id, index)
    })

    expect(getClosingBlockers(state.shifts[0], coach.id)).toHaveLength(0)
    const closed = closeShift(state, { shiftId: prepared.shiftId, actor: coach, note: '' }, '2026-08-05T14:30:00+02:00').shifts[0]
    expect(closed).toMatchObject({ status: 'closed', endLabel: 'Entregar turno', closedByName: coach.name, closedAt: '2026-08-05T14:30:00+02:00', closingNote: '' })
    expect(closed.closingChecklist.filter((item) => item.required).every((item) => item.completedByName === coach.name)).toBe(true)
  })

  it('uses Cerrar centro for the last shift and does not require a next-coach note or check', () => {
    const prepared = prepareShift('afternoon')
    let state = recordFirstClass(prepared.state, { shiftId: prepared.shiftId, actor: coach, record: validFirstClassRecord }, '2026-08-05T20:00:00+02:00')
    state.shifts[0].closingChecklist.filter((item) => item.required).forEach((item, index) => {
      state = completeClosingActivity(state, prepared.shiftId, item.id, index)
    })
    const closed = closeShift(state, { shiftId: prepared.shiftId, actor: coach }, '2026-08-05T22:15:00+02:00').shifts[0]

    expect(closed.endLabel).toBe('Cerrar centro')
    expect(closed.closingChecklist.find((item) => item.id === 'next-coach')).toMatchObject({ required: false, status: 'not-required' })
    expect(closed.closingNote).toBe('')
  })

  it('keeps only open exceptions visible to Direction with transfer details', () => {
    const initial = startedShift()
    const state = recordIncident(initial.state, {
      shiftId: initial.shift.id,
      actor: coach,
      description: 'Remo 04 fuera de uso.',
      dueAt: '2026-08-05T15:00:00+02:00',
      nextAction: 'Revisar el remo.',
    }, '2026-08-05T11:30:00+02:00')

    expect(getDirectionExceptions(state)).toEqual([
      expect.objectContaining({ detail: 'Remo 04 fuera de uso.', owner: direction.name, dueAt: '2026-08-05T15:00:00+02:00', nextAction: 'Revisar el remo.' }),
    ])
  })

  it('upgrades persisted Phase 2.2 data without losing its shift or first class record', () => {
    const legacy = {
      version: 1,
      shifts: [{
        id: 'shift-legacy', dateKey: '2026-08-05', templateId: 'morning', label: 'Mañana', scheduledStart: '06:45', scheduledEnd: '14:30', trainerId: coach.id, trainerName: coach.name, startedAt, punctuality: { status: 'on-time', label: 'A tiempo', differenceMinutes: -3 }, status: 'active',
        tasks: [{ id: 'opening', status: 'completed', completedAt: startedAt, completedById: coach.id, completedByName: coach.name }, { id: 'briefing', status: 'completed', completedAt: startedAt, completedById: coach.id, completedByName: coach.name }, { id: 'first-class', status: 'completed', completedAt: startedAt, completedById: coach.id, completedByName: coach.name }],
        briefing: { consultedAt: startedAt }, firstClassRecord: { ...validFirstClassRecord, completedAt: startedAt, completedById: coach.id, completedByName: coach.name }, incidents: [], feedback: [{ note: 'Dato legado.' }], endPreparation: null, closedAt: null, actions: [],
      }],
    }
    const upgraded = upgradeLegacyShiftState(legacy)

    expect(upgraded.version).toBe(SHIFT_STATE_VERSION)
    expect(upgraded.shifts).toHaveLength(1)
    expect(upgraded.shifts[0].firstClassRecord).toMatchObject({ volumePercent: 100 })
    expect(upgraded.shifts[0].openingChecklist.every((item) => item.status === 'completed')).toBe(true)
    expect(upgraded.shifts[0]).not.toHaveProperty('feedback')
  })

  it('enforces the simulated coach role for mutations', () => {
    expect(() => startShift(createEmptyShiftState(), { templateId: 'morning', actor: direction }, startedAt)).toThrowError(
      expect.objectContaining({ code: 'COACH_ROLE_REQUIRED' }),
    )
  })

  it('rejects generic or incomplete activity completion evidence', () => {
    const initial = startedShift()
    let state = openOpeningItem(initial.state, { shiftId: initial.shift.id, itemId: 'systems', actor: coach }, '2026-08-05T06:43:00+02:00')

    expect(() => completeOpeningItem(state, {
      shiftId: initial.shift.id,
      itemId: 'systems',
      actor: coach,
      evidence: { kind: 'generic_completion', checkIds: [] },
    }, '2026-08-05T06:44:00+02:00')).toThrowError(expect.objectContaining({ code: 'INVALID_ACTIVITY_EVIDENCE' }))

    OPENING_ACTIVITY_DEFINITIONS.systems.checks.slice(0, -1).forEach((check) => {
      state = completeOpeningCheck(state, { shiftId: initial.shift.id, itemId: 'systems', checkId: check.id, actor: coach }, '2026-08-05T06:44:00+02:00')
    })
    expect(() => completeOpeningItem(state, {
      shiftId: initial.shift.id,
      itemId: 'systems',
      actor: coach,
      evidence: { kind: 'systems_check', checkIds: OPENING_ACTIVITY_DEFINITIONS.systems.checks.map((check) => check.id) },
    }, '2026-08-05T06:45:00+02:00')).toThrowError(expect.objectContaining({ code: 'ACTIVITY_CHECKS_PENDING' }))
  })
})
