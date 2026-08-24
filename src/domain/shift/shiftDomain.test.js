import { describe, expect, it } from 'vitest'
import {
  closeShift,
  completeShiftPreparation,
  confirmCenterOperational,
  confirmClosingItem,
  createEmptyShiftState,
  FIRST_CLASS_DISCOMFORT_OPTIONS,
  FIRST_CLASS_MOVEMENT_OPTIONS,
  getClosingBlockers,
  getDirectionExceptions,
  getShiftProgress,
  MAX_CRITICAL_TASKS,
  recordFirstClass,
  recordIncident,
  SHIFT_STATE_VERSION,
  startShift,
  SYNTHETIC_ACTORS,
  upgradeLegacyShiftState,
} from './shiftDomain.js'

const coach = SYNTHETIC_ACTORS.coach
const startedAt = '2026-08-05T06:42:00+02:00'
const firstClass = {
  movement: FIRST_CLASS_MOVEMENT_OPTIONS[0], movementFollowUp: '',
  discomfort: FIRST_CLASS_DISCOMFORT_OPTIONS[0], discomfortZone: '', workingAdaptation: '', nextCoachObservation: '',
  volumePercent: 100, loadsUsed: 'Mancuernas de 6 kg.', adaptedExercises: 'Ninguno.',
}

function start(templateId = 'morning', state = createEmptyShiftState(), at = startedAt) {
  return startShift(state, { templateId, actor: coach }, at)
}

function prepare(templateId = 'morning') {
  const started = start(templateId)
  let state = started.state
  if (started.shift.arrivalMode === 'open-center') state = confirmCenterOperational(state, { shiftId: started.shift.id, actor: coach }, '2026-08-05T06:44:00+02:00')
  state = completeShiftPreparation(state, { shiftId: started.shift.id, actor: coach }, '2026-08-05T06:48:00+02:00')
  return { state, shiftId: started.shift.id }
}

describe('Phase 2.3 briefing domain', () => {
  it('gives the first trainer only opening, briefing and first class as critical work', () => {
    const { shift } = start()
    expect(shift.arrivalMode).toBe('open-center')
    expect(shift.centerOpening.status).toBe('pending')
    expect(shift.openingChecklist).toEqual([])
    expect(shift.tasks.map((task) => task.id)).toEqual(['opening', 'preparation', 'first-class'])
    expect(shift.tasks).toHaveLength(MAX_CRITICAL_TASKS)
  })

  it('sends a trainer receiving handover directly to the briefing', () => {
    const { shift, state } = start('afternoon', createEmptyShiftState(), '2026-08-05T14:25:00+02:00')
    expect(shift.arrivalMode).toBe('handover')
    expect(shift.centerOpening.status).toBe('not-required')
    expect(shift.tasks.map((task) => task.id)).toEqual(['preparation', 'first-class'])
    expect(completeShiftPreparation(state, { shiftId: shift.id, actor: coach }, '2026-08-05T14:26:00+02:00').shifts[0].shiftPreparation).toMatchObject({ completedByName: coach.name })
  })

  it('prevents duplicate turns and keeps progress finite for handover', () => {
    const first = start('afternoon', createEmptyShiftState(), '2026-08-05T14:25:00+02:00')
    const duplicate = startShift(first.state, { templateId: 'afternoon', actor: coach }, '2026-08-05T14:27:00+02:00')
    expect(duplicate.duplicate).toBe(true)
    expect(duplicate.state.shifts).toHaveLength(1)
    expect(Number.isFinite(getShiftProgress(first.shift))).toBe(true)
  })

  it('records a nonblocking previous closing incident with local accountability', () => {
    const previous = start('afternoon', createEmptyShiftState(), '2026-08-04T14:25:00+02:00')
    const current = start('morning', previous.state, startedAt)
    const state = recordIncident(current.state, {
      shiftId: current.shift.id, actor: coach, category: 'previous_closing', serviceImpact: 'none', evidence: 'Sala desordenada.',
      description: 'Material fuera de sitio.', dueAt: '2026-08-05T09:00:00+02:00', nextAction: 'Revisar el cierre anterior.',
    }, '2026-08-05T06:43:00+02:00')
    const incident = state.shifts.at(-1).incidents[0]
    expect(incident).toMatchObject({ category: 'previous_closing', relatedShiftId: previous.shift.id, relatedTrainerName: coach.name, serviceImpact: 'none' })
    expect(confirmCenterOperational(state, { shiftId: current.shift.id, actor: coach }, '2026-08-05T06:44:00+02:00').shifts.at(-1).centerOpening.status).toBe('completed')
    expect(getDirectionExceptions(state)[0].label).toBe('Cierre anterior')
  })

  it('blocks opening only for safety or service impact', () => {
    const started = start()
    const state = recordIncident(started.state, {
      shiftId: started.shift.id, actor: coach, category: 'previous_closing', serviceImpact: 'safety',
      description: 'Acceso inseguro.', dueAt: '2026-08-05T07:00:00+02:00', nextAction: 'Aislar la zona y revisar.',
    }, '2026-08-05T06:43:00+02:00')
    expect(() => confirmCenterOperational(state, { shiftId: started.shift.id, actor: coach }, '2026-08-05T06:44:00+02:00')).toThrowError(expect.objectContaining({ code: 'CENTER_OPENING_BLOCKED' }))
  })

  it('keeps briefing and first class sequencing', () => {
    const started = start()
    expect(() => completeShiftPreparation(started.state, { shiftId: started.shift.id, actor: coach }, '2026-08-05T06:44:00+02:00')).toThrowError(expect.objectContaining({ code: 'OPENING_INCOMPLETE' }))
    const prepared = prepare()
    const recorded = recordFirstClass(prepared.state, { shiftId: prepared.shiftId, actor: coach, record: firstClass }, '2026-08-05T12:00:00+02:00')
    expect(recorded.shifts[0].firstClassRecord).toMatchObject({ volumePercent: 100, completedByName: coach.name })
  })

  it('delivers a handover without a center closing checklist', () => {
    const prepared = prepare('morning')
    const recorded = recordFirstClass(prepared.state, { shiftId: prepared.shiftId, actor: coach, record: firstClass }, '2026-08-05T12:00:00+02:00')
    expect(recorded.shifts[0].closingChecklist).toEqual([])
    expect(getClosingBlockers(recorded.shifts[0], coach.id)).toEqual([])
    const closed = closeShift(recorded, { shiftId: prepared.shiftId, actor: coach, handoverReady: true, note: 'Audio en seguimiento.' }, '2026-08-05T14:30:00+02:00').shifts[0]
    expect(closed).toMatchObject({ status: 'closed', endMode: 'handover', closingNote: 'Audio en seguimiento.' })
    expect(closed.handoverReady.completedByName).toBe(coach.name)
  })

  it('requires the detailed checklist only for the last shift', () => {
    const prepared = prepare('afternoon')
    let state = recordFirstClass(prepared.state, { shiftId: prepared.shiftId, actor: coach, record: firstClass }, '2026-08-05T20:00:00+02:00')
    expect(state.shifts[0].closingChecklist.map((item) => item.id)).toContain('access')
    expect(() => closeShift(state, { shiftId: prepared.shiftId, actor: coach }, '2026-08-05T22:15:00+02:00')).toThrowError(expect.objectContaining({ code: 'SHIFT_BLOCKERS_PENDING' }))
    state.shifts[0].closingChecklist.forEach((item, index) => {
      state = confirmClosingItem(state, { shiftId: prepared.shiftId, itemId: item.id, actor: coach }, `2026-08-05T22:${String(index).padStart(2, '0')}:00+02:00`)
    })
    expect(closeShift(state, { shiftId: prepared.shiftId, actor: coach }, '2026-08-05T22:15:00+02:00').shifts[0].status).toBe('closed')
  })

  it('upgrades v3 data without discarding the old opening audit', () => {
    const old = start()
    const v3 = { ...old.state, version: 3, shifts: old.state.shifts.map((shift) => ({ ...shift, centerOpening: undefined, arrivalMode: undefined, openingChecklist: [{ id: 'systems', status: 'completed', completedAt: startedAt }] })) }
    const upgraded = upgradeLegacyShiftState(v3)
    expect(upgraded.version).toBe(SHIFT_STATE_VERSION)
    expect(upgraded.shifts[0].legacyOpeningAudit).toHaveLength(1)
    expect(upgraded.shifts[0].openingChecklist).toEqual([])
  })
})
