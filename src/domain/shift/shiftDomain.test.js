import { describe, expect, it } from 'vitest'
import {
  closeShift,
  completeTask,
  consultBriefing,
  createEmptyShiftState,
  getDirectionExceptions,
  getOwnCriticalBlockers,
  MAX_CRITICAL_TASKS,
  prepareShiftEnd,
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

describe('minimum shift domain rules', () => {
  it('starts one owned shift with responsible, time and at most three critical tasks', () => {
    const result = startedShift()
    const shift = result.shift

    expect(result.duplicate).toBe(false)
    expect(shift.trainerId).toBe(coach.id)
    expect(shift.startedAt).toBe(startedAt)
    expect(shift.punctuality.status).toBe('on-time')
    expect(shift.tasks.filter((task) => task.critical)).toHaveLength(2)
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
    const withFeedback = recordFeedback(briefed, { shiftId: initial.shift.id, actor: coach, note: 'Revisar el material de zona B.' }, '2026-08-04T12:10:00+02:00')
    const shift = withFeedback.shifts[0]

    expect(shift.tasks.find((task) => task.id === 'opening')).toMatchObject({ completedByName: coach.name, completedAt: '2026-08-04T06:44:00+02:00' })
    expect(shift.briefing).toMatchObject({ consultedByName: coach.name, consultedAt: '2026-08-04T07:00:00+02:00' })
    expect(shift.feedback[0]).toMatchObject({ createdByName: coach.name, createdAt: '2026-08-04T12:10:00+02:00' })
  })

  it('keeps an open incident visible to Direction without blocking a valid close', () => {
    const initial = startedShift()
    const opened = completeTask(initial.state, { shiftId: initial.shift.id, taskId: 'opening', actor: coach }, '2026-08-04T06:44:00+02:00')
    const briefed = consultBriefing(opened, { shiftId: initial.shift.id, actor: coach }, '2026-08-04T07:00:00+02:00')
    const incidentState = recordIncident(briefed, { shiftId: initial.shift.id, actor: coach, description: 'Remo 04 fuera de uso.' }, '2026-08-04T11:30:00+02:00')
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
    expect(getOwnCriticalBlockers(prepared.shifts[0], coach.id).map((task) => task.id)).toEqual(['opening', 'briefing'])

    const withExternalCriticalTask = {
      ...prepared,
      shifts: prepared.shifts.map((shift) => ({
        ...shift,
        tasks: shift.tasks.map((task) => task.id === 'briefing'
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
