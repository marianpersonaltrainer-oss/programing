import { describe, expect, it } from 'vitest'
import {
  createEmptyShiftState,
  FIRST_CLASS_DISCOMFORT_OPTIONS,
  FIRST_CLASS_MOVEMENT_OPTIONS,
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

describe('local shift repository', () => {
  it('persists through a new adapter instance and resets synthetic data', () => {
    const storage = createMemoryStorage()
    const firstRepository = createLocalShiftRepository({ storage })
    const service = createShiftService({ repository: firstRepository, now: () => '2026-08-04T06:42:00+02:00' })
    const started = service.start({ templateId: 'morning', actor: SYNTHETIC_ACTORS.coach })
    service.recordFirstClass({
      shiftId: started.shift.id,
      actor: SYNTHETIC_ACTORS.coach,
      record: {
        movement: FIRST_CLASS_MOVEMENT_OPTIONS[0],
        movementFollowUp: '',
        discomfort: FIRST_CLASS_DISCOMFORT_OPTIONS[0],
        discomfortZone: '',
        workingAdaptation: '',
        nextCoachObservation: '',
        volumePercent: 75,
        loadsUsed: 'Mancuernas de 6 kg.',
        adaptedExercises: 'Remo en lugar de carrera.',
      },
    })

    const reloadedRepository = createLocalShiftRepository({ storage })
    expect(reloadedRepository.load().shifts).toHaveLength(1)
    expect(JSON.parse(reloadedRepository.exportJson()).shifts[0].trainerName).toBe(SYNTHETIC_ACTORS.coach.name)
    expect(reloadedRepository.load().shifts[0].firstClassRecord).toMatchObject({ volumePercent: 75, completedByName: SYNTHETIC_ACTORS.coach.name })

    expect(reloadedRepository.reset()).toEqual(createEmptyShiftState())
    expect(reloadedRepository.load().shifts).toHaveLength(0)
  })

  it('allows the service to swap storage adapters without changing domain or UI actions', () => {
    let state = createEmptyShiftState()
    const replacementRepository = {
      load: () => state,
      save: (next) => { state = next; return next },
      reset: () => { state = createEmptyShiftState(); return state },
    }
    const service = createShiftService({ repository: replacementRepository, now: () => '2026-08-04T14:25:00+02:00' })

    const result = service.start({ templateId: 'afternoon', actor: SYNTHETIC_ACTORS.coach })
    expect(result.state.shifts[0]).toMatchObject({ templateId: 'afternoon', trainerId: SYNTHETIC_ACTORS.coach.id })
  })

  it('surfaces incompatible local data instead of hiding the error', () => {
    const storage = createMemoryStorage()
    storage.setItem('test-key', '{"version":99,"shifts":[]}')
    const repository = createLocalShiftRepository({ storage, key: 'test-key' })
    expect(() => repository.load()).toThrow('formato compatible')
  })
})
