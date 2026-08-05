import { describe, expect, it } from 'vitest'
import {
  CLOSING_ACTIVITY_DEFINITIONS,
  createEmptyShiftState,
  FIRST_CLASS_DISCOMFORT_OPTIONS,
  FIRST_CLASS_MOVEMENT_OPTIONS,
  OPENING_ACTIVITY_DEFINITIONS,
  OPENING_CHECKLIST_ITEMS,
  SHIFT_STATE_VERSION,
  SYNTHETIC_ACTORS,
} from '../../domain/shift/shiftDomain.js'
import { createShiftService } from '../../domain/shift/shiftService.js'
import { createLocalShiftRepository } from './localShiftRepository.js'

function createMemoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

const firstClassRecord = {
  movement: FIRST_CLASS_MOVEMENT_OPTIONS[0],
  movementFollowUp: '',
  discomfort: FIRST_CLASS_DISCOMFORT_OPTIONS[0],
  discomfortZone: '',
  workingAdaptation: '',
  nextCoachObservation: '',
  volumePercent: 75,
  loadsUsed: 'Mancuernas de 6 kg.',
  adaptedExercises: 'Remo en lugar de carrera.',
}

describe('local shift repository', () => {
  it('persists the guided opening, preparation, close audit and reset', () => {
    const storage = createMemoryStorage()
    const repository = createLocalShiftRepository({ storage })
    const service = createShiftService({ repository, now: () => '2026-08-05T06:42:00+02:00' })
    const started = service.start({ templateId: 'morning', actor: SYNTHETIC_ACTORS.coach })
    OPENING_CHECKLIST_ITEMS.forEach((item) => {
      const definition = OPENING_ACTIVITY_DEFINITIONS[item.id]
      service.openOpeningItem({ shiftId: started.shift.id, itemId: item.id, actor: SYNTHETIC_ACTORS.coach })
      definition.checks.forEach((check) => service.completeOpeningCheck({ shiftId: started.shift.id, itemId: item.id, checkId: check.id, actor: SYNTHETIC_ACTORS.coach }))
      service.completeOpeningItem({
        shiftId: started.shift.id,
        itemId: item.id,
        actor: SYNTHETIC_ACTORS.coach,
        evidence: { kind: definition.evidenceKind, checkIds: definition.checks.map((check) => check.id) },
      })
    })
    service.completePreparation({ shiftId: started.shift.id, actor: SYNTHETIC_ACTORS.coach })
    service.recordFirstClass({ shiftId: started.shift.id, actor: SYNTHETIC_ACTORS.coach, record: firstClassRecord })
    repository.load().shifts[0].closingChecklist.filter((item) => item.required).forEach((item) => {
      const definition = CLOSING_ACTIVITY_DEFINITIONS[item.id]
      service.openClosingItem({ shiftId: started.shift.id, itemId: item.id, actor: SYNTHETIC_ACTORS.coach })
      definition.checks.forEach((check) => service.completeClosingCheck({ shiftId: started.shift.id, itemId: item.id, checkId: check.id, actor: SYNTHETIC_ACTORS.coach }))
      service.completeClosingItem({
        shiftId: started.shift.id,
        itemId: item.id,
        actor: SYNTHETIC_ACTORS.coach,
        evidence: { kind: definition.evidenceKind, checkIds: definition.checks.map((check) => check.id) },
      })
    })
    service.close({ shiftId: started.shift.id, actor: SYNTHETIC_ACTORS.coach, note: 'Revisar remo 04.' })

    const reloadedRepository = createLocalShiftRepository({ storage })
    const shift = reloadedRepository.load().shifts[0]
    expect(shift.status).toBe('closed')
    expect(shift.openingChecklist.every((item) => item.completedByName === SYNTHETIC_ACTORS.coach.name)).toBe(true)
    expect(shift.closingChecklist.filter((item) => item.required).every((item) => item.completedByName === SYNTHETIC_ACTORS.coach.name)).toBe(true)
    expect(shift.firstClassRecord).toMatchObject({ volumePercent: 75, completedByName: SYNTHETIC_ACTORS.coach.name })
    expect(shift.closingNote).toBe('Revisar remo 04.')
    expect(JSON.parse(reloadedRepository.exportJson()).version).toBe(SHIFT_STATE_VERSION)
    expect(reloadedRepository.reset()).toEqual(createEmptyShiftState())
  })

  it('allows storage replacement and does not expose an Operativa feedback mutation', () => {
    let state = createEmptyShiftState()
    const replacementRepository = {
      load: () => state,
      save: (next) => { state = next; return next },
      reset: () => { state = createEmptyShiftState(); return state },
    }
    const service = createShiftService({ repository: replacementRepository, now: () => '2026-08-05T14:25:00+02:00' })

    const result = service.start({ templateId: 'afternoon', actor: SYNTHETIC_ACTORS.coach })
    expect(result.state.shifts[0]).toMatchObject({ templateId: 'afternoon', trainerId: SYNTHETIC_ACTORS.coach.id, endLabel: 'Cerrar centro' })
    expect(service.recordFeedback).toBeUndefined()
  })

  it('upgrades compatible Phase 2.2 local data when loading', () => {
    const storage = createMemoryStorage()
    const legacy = { version: 1, shifts: [] }
    storage.setItem('test-key', JSON.stringify(legacy))
    const repository = createLocalShiftRepository({ storage, key: 'test-key' })

    expect(repository.load()).toEqual(createEmptyShiftState())
    expect(JSON.parse(storage.getItem('test-key')).version).toBe(SHIFT_STATE_VERSION)
  })

  it('surfaces incompatible local data instead of hiding the error', () => {
    const storage = createMemoryStorage()
    storage.setItem('test-key', '{"version":99,"shifts":[]}')
    const repository = createLocalShiftRepository({ storage, key: 'test-key' })
    expect(() => repository.load()).toThrow('formato compatible')
  })
})
