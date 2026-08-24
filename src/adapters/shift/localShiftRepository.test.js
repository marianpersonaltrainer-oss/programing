import { describe, expect, it } from 'vitest'
import { createEmptyShiftState, FIRST_CLASS_DISCOMFORT_OPTIONS, FIRST_CLASS_MOVEMENT_OPTIONS, SHIFT_STATE_VERSION, SYNTHETIC_ACTORS } from '../../domain/shift/shiftDomain.js'
import { createShiftService } from '../../domain/shift/shiftService.js'
import { createLocalShiftRepository } from './localShiftRepository.js'

function memoryStorage() {
  const values = new Map()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }
}

const record = { movement: FIRST_CLASS_MOVEMENT_OPTIONS[0], movementFollowUp: '', discomfort: FIRST_CLASS_DISCOMFORT_OPTIONS[0], discomfortZone: '', workingAdaptation: '', nextCoachObservation: '', volumePercent: 75, loadsUsed: '6 kg.', adaptedExercises: 'Ninguno.' }

describe('local shift repository', () => {
  it('persists opening, briefing, previous-closing incident and handover across reloads', () => {
    const storage = memoryStorage()
    const repository = createLocalShiftRepository({ storage })
    const service = createShiftService({ repository, now: () => '2026-08-05T06:42:00+02:00' })
    const started = service.start({ templateId: 'morning', actor: SYNTHETIC_ACTORS.coach })
    service.recordIncident({ shiftId: started.shift.id, actor: SYNTHETIC_ACTORS.coach, category: 'previous_closing', serviceImpact: 'none', description: 'Sala desordenada.', dueAt: '2026-08-05T09:00:00+02:00', nextAction: 'Revisar cierre.' })
    service.confirmCenterOperational({ shiftId: started.shift.id, actor: SYNTHETIC_ACTORS.coach })
    service.confirmBriefing({ shiftId: started.shift.id, actor: SYNTHETIC_ACTORS.coach })
    service.recordFirstClass({ shiftId: started.shift.id, actor: SYNTHETIC_ACTORS.coach, record })
    service.close({ shiftId: started.shift.id, actor: SYNTHETIC_ACTORS.coach, handoverReady: true })
    const loaded = createLocalShiftRepository({ storage }).load().shifts[0]
    expect(loaded).toMatchObject({ status: 'closed', centerOpening: { status: 'completed' }, shiftPreparation: { completedByName: SYNTHETIC_ACTORS.coach.name } })
    expect(loaded.incidents[0].category).toBe('previous_closing')
    expect(JSON.parse(repository.exportJson()).version).toBe(SHIFT_STATE_VERSION)
    expect(repository.reset()).toEqual(createEmptyShiftState())
  })

  it('works with a replaceable in-memory adapter', () => {
    let state = createEmptyShiftState()
    const repository = { load: () => state, save: (next) => (state = next), reset: () => (state = createEmptyShiftState()) }
    const service = createShiftService({ repository, now: () => '2026-08-05T14:25:00+02:00' })
    expect(service.start({ templateId: 'afternoon', actor: SYNTHETIC_ACTORS.coach }).shift.arrivalMode).toBe('handover')
    expect(service.recordFeedback).toBeUndefined()
  })

  it('upgrades compatible legacy data', () => {
    const storage = memoryStorage(); storage.setItem('test', JSON.stringify({ version: 1, shifts: [] }))
    expect(createLocalShiftRepository({ storage, key: 'test' }).load()).toEqual(createEmptyShiftState())
    expect(JSON.parse(storage.getItem('test')).version).toBe(SHIFT_STATE_VERSION)
  })

  it('surfaces corrupt or incompatible local data', () => {
    const storage = memoryStorage(); storage.setItem('test', '{not-json')
    expect(() => createLocalShiftRepository({ storage, key: 'test' }).load()).toThrow()
    storage.setItem('test', JSON.stringify({ version: 99, shifts: [] }))
    expect(() => createLocalShiftRepository({ storage, key: 'test' }).load()).toThrow('formato compatible')
  })
})
