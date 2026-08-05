import { describe, expect, it } from 'vitest'
import {
  closeShift,
  completeTask,
  consultBriefing,
  createEmptyShiftState,
  FIRST_CLASS_DISCOMFORT_OPTIONS,
  FIRST_CLASS_MOVEMENT_OPTIONS,
  getDirectionExceptions,
  getOwnCriticalBlockers,
  MAX_CRITICAL_TASKS,
  prepareShiftEnd,
  recordFirstClass,
  recordFeedback,
  recordIncident,
  ShiftRuleError,
  startShift,
  SYNTHETIC_ACTORS,
} from './shiftDomain.js'

const coach = SYNTHETIC_ACTORS.coach
const direction = SYNTHETIC_ACTORS.direction
const startedAt = '2026-08-04T06:42:00+02:00'

function startedShift() {
  return startShift(createEmptyShiftState(), { templateId: 'morning', actor: coach }, startedAt)
}

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

describe('minimum shift domain rules', () => {
  it('starts one owned shift with responsible, time and at most three critical tasks', () => {
    const result = startedShift()
    const shift = result.shift

    expect(result.duplicate).toBe(false)
    expect(shift.trainerId).toBe(coach.id)
    expect(shift.startedAt).toBe(startedAt)
    expect(shift.punctuality.status).toBe('on-time')
    expect(shift.tasks.filter((task) => task.critical)).toHaveLength(3)
    expect(shift.tasks.filter((task) => task.critical).length).toBeLessThanOrEqual(MAX_CRITICAL_TASKS)
    expect(shift.actions[0]).toMatchObject({ type: 'shift_started', actorId: coach.id, at: startedAt })
  })

  it('returns the existing shift instead of creating a duplicate for the same date and slot', () => {
    const first = startedShift()
    const second = startShift(first.state, { templateId: 'morning', actor: coach }, '2026-08-04T06:43:00+02:00')

    expect(second.duplicate).toBe(true)
    expect(second.state.shifts).toHaveLength(1)
    expect(second.shift.id).toBe(first.shift.id)
  })

  it('records relevant actions with actor and time', () => {
    const initial = startedShift()
    const opened = completeTask(initial.state, { shiftId: initial.shift.id, taskId: 'opening', actor: coach }, '2026-08-04T06:44:00+02:00')
    const briefed = consultBriefing(opened, { shiftId: initial.shift.id, actor: coach }, '2026-08-04T07:00:00+02:00')
    const withFirstClass = recordFirstClass(briefed, { shiftId: initial.shift.id, actor: coach, record: validFirstClassRecord }, '2026-08-04T12:00:00+02:00')
    const withFeedback = recordFeedback(withFirstClass, { shiftId: initial.shift.id, actor: coach, note: 'Revisar el material de zona B.' }, '2026-08-04T12:10:00+02:00')
    const shift = withFeedback.shifts[0]

    expect(shift.tasks.find((task) => task.id === 'opening')).toMatchObject({ completedByName: coach.name, completedAt: '2026-08-04T06:44:00+02:00' })
    expect(shift.briefing).toMatchObject({ consultedByName: coach.name, consultedAt: '2026-08-04T07:00:00+02:00' })
    expect(shift.firstClassRecord).toMatchObject({ completedByName: coach.name, completedAt: '2026-08-04T12:00:00+02:00' })
    expect(shift.feedback[0]).toMatchObject({ createdByName: coach.name, createdAt: '2026-08-04T12:10:00+02:00' })
  })

  it('requires the three selections and completed-work fields for a first class record', () => {
    const initial = startedShift()
    const params = { shiftId: initial.shift.id, actor: coach }

    expect(() => recordFirstClass(initial.state, { ...params, record: { ...validFirstClassRecord, movement: '' } }, '2026-08-04T12:00:00+02:00')).toThrowError(
      expect.objectContaining({ code: 'FIRST_CLASS_MOVEMENT_REQUIRED' }),
    )
    expect(() => recordFirstClass(initial.state, { ...params, record: { ...validFirstClassRecord, discomfort: '' } }, '2026-08-04T12:00:00+02:00')).toThrowError(
      expect.objectContaining({ code: 'FIRST_CLASS_DISCOMFORT_REQUIRED' }),
    )
    expect(() => recordFirstClass(initial.state, { ...params, record: { ...validFirstClassRecord, volumePercent: '' } }, '2026-08-04T12:00:00+02:00')).toThrowError(
      expect.objectContaining({ code: 'FIRST_CLASS_VOLUME_REQUIRED' }),
    )
    expect(() => recordFirstClass(initial.state, { ...params, record: { ...validFirstClassRecord, loadsUsed: '' } }, '2026-08-04T12:00:00+02:00')).toThrowError(
      expect.objectContaining({ code: 'FIRST_CLASS_FIELD_REQUIRED' }),
    )
    expect(() => recordFirstClass(initial.state, { ...params, record: { ...validFirstClassRecord, adaptedExercises: '' } }, '2026-08-04T12:00:00+02:00')).toThrowError(
      expect.objectContaining({ code: 'FIRST_CLASS_FIELD_REQUIRED' }),
    )
  })

  it('stores one first class record, allows optional fields to stay empty and avoids duplicates', () => {
    const initial = startedShift()
    const recordedAt = '2026-08-04T12:00:00+02:00'
    const first = recordFirstClass(initial.state, { shiftId: initial.shift.id, actor: coach, record: validFirstClassRecord }, recordedAt)
    const second = recordFirstClass(first, { shiftId: initial.shift.id, actor: coach, record: { ...validFirstClassRecord, loadsUsed: 'Otra carga.' } }, '2026-08-04T12:05:00+02:00')
    const shift = second.shifts[0]

    expect(shift.firstClassRecord).toEqual({ ...validFirstClassRecord, completedAt: recordedAt, completedById: coach.id, completedByName: coach.name })
    expect(shift.tasks.find((task) => task.id === 'first-class')).toMatchObject({ status: 'completed', completedAt: recordedAt, completedByName: coach.name })
    expect(shift.actions.filter((action) => action.type === 'first_class_recorded')).toHaveLength(1)
    expect(shift.actions.filter((action) => action.type === 'task_first-class_completed')).toHaveLength(1)
  })

  it('keeps a locally persisted Phase 2.1 shift compatible with the mandatory first class rule', () => {
    const initial = startedShift()
    const legacyState = {
      ...initial.state,
      shifts: initial.state.shifts.map((shift) => ({
        ...shift,
        tasks: shift.tasks.filter((task) => task.id !== 'first-class'),
      })),
    }
    const opened = completeTask(legacyState, { shiftId: initial.shift.id, taskId: 'opening', actor: coach }, '2026-08-04T06:44:00+02:00')
    const briefed = consultBriefing(opened, { shiftId: initial.shift.id, actor: coach }, '2026-08-04T07:00:00+02:00')
    const prepared = prepareShiftEnd(briefed, { shiftId: initial.shift.id, actor: coach, mode: 'close' }, '2026-08-04T14:20:00+02:00')

    expect(getOwnCriticalBlockers(prepared.shifts[0], coach.id).map((task) => task.id)).toEqual(['first-class'])
    expect(() => closeShift(prepared, { shiftId: initial.shift.id, actor: coach }, '2026-08-04T14:25:00+02:00')).toThrowError(
      expect.objectContaining({ code: 'OWN_CRITICAL_TASKS_PENDING' }),
    )

    const recorded = recordFirstClass(prepared, { shiftId: initial.shift.id, actor: coach, record: validFirstClassRecord }, '2026-08-04T14:22:00+02:00')
    expect(recorded.shifts[0].tasks.find((task) => task.id === 'first-class')).toMatchObject({ status: 'completed', ownerId: coach.id })
    expect(closeShift(recorded, { shiftId: initial.shift.id, actor: coach }, '2026-08-04T14:25:00+02:00').shifts[0].status).toBe('closed')
  })

  it('keeps an open incident visible to Direction without blocking a valid close', () => {
    const initial = startedShift()
    const opened = completeTask(initial.state, { shiftId: initial.shift.id, taskId: 'opening', actor: coach }, '2026-08-04T06:44:00+02:00')
    const briefed = consultBriefing(opened, { shiftId: initial.shift.id, actor: coach }, '2026-08-04T07:00:00+02:00')
    const firstClassState = recordFirstClass(briefed, { shiftId: initial.shift.id, actor: coach, record: validFirstClassRecord }, '2026-08-04T11:00:00+02:00')
    const incidentState = recordIncident(firstClassState, { shiftId: initial.shift.id, actor: coach, description: 'Remo 04 fuera de uso.' }, '2026-08-04T11:30:00+02:00')
    const prepared = prepareShiftEnd(incidentState, { shiftId: initial.shift.id, actor: coach, mode: 'close' }, '2026-08-04T14:28:00+02:00')
    const closed = closeShift(prepared, { shiftId: initial.shift.id, actor: coach }, '2026-08-04T14:30:00+02:00')
    const shift = closed.shifts[0]

    expect(shift.status).toBe('closed')
    expect(getDirectionExceptions(closed)).toEqual([
      expect.objectContaining({ label: 'Incidencia abierta', detail: 'Remo 04 fuera de uso.', owner: direction.name }),
    ])
  })

  it('blocks close only for pending critical tasks owned by the active coach', () => {
    const initial = startedShift()
    const prepared = prepareShiftEnd(initial.state, { shiftId: initial.shift.id, actor: coach, mode: 'handover' }, '2026-08-04T14:20:00+02:00')

    expect(() => closeShift(prepared, { shiftId: initial.shift.id, actor: coach }, '2026-08-04T14:25:00+02:00')).toThrowError(ShiftRuleError)
    expect(getOwnCriticalBlockers(prepared.shifts[0], coach.id).map((task) => task.id)).toEqual(['opening', 'briefing', 'first-class'])

    const withExternalCriticalTask = {
      ...prepared,
      shifts: prepared.shifts.map((shift) => ({
        ...shift,
        tasks: shift.tasks.map((task) => ['briefing', 'first-class'].includes(task.id)
          ? { ...task, ownerId: direction.id, ownerName: direction.name }
          : task),
      })),
    }
    const opened = completeTask(withExternalCriticalTask, { shiftId: initial.shift.id, taskId: 'opening', actor: coach }, '2026-08-04T14:22:00+02:00')
    expect(getOwnCriticalBlockers(opened.shifts[0], coach.id)).toHaveLength(0)
    expect(closeShift(opened, { shiftId: initial.shift.id, actor: coach }, '2026-08-04T14:25:00+02:00').shifts[0].status).toBe('closed')
  })

  it('enforces the simulated coach role for shift mutations', () => {
    expect(() => startShift(createEmptyShiftState(), { templateId: 'morning', actor: direction }, startedAt)).toThrowError(
      expect.objectContaining({ code: 'COACH_ROLE_REQUIRED' }),
    )
  })
})
