import {
  createEmptyShiftState,
  SHIFT_STATE_VERSION,
  upgradeLegacyShiftState,
} from '../../domain/shift/shiftDomain.js'

export const LOCAL_SHIFT_STORAGE_KEY = 'programming-evo:phase-2:shift-state'

function isValidState(value) {
  return Boolean(value)
    && value.version === SHIFT_STATE_VERSION
    && Array.isArray(value.shifts)
}

export function createLocalShiftRepository({ storage, key = LOCAL_SHIFT_STORAGE_KEY } = {}) {
  const target = storage ?? globalThis.localStorage
  if (!target) throw new Error('No existe almacenamiento local disponible.')

  return {
    load() {
      const raw = target.getItem(key)
      if (!raw) return createEmptyShiftState()
      const parsed = JSON.parse(raw)
      try {
        const upgraded = upgradeLegacyShiftState(parsed)
        if (!isValidState(upgraded)) throw new Error('Los datos locales del turno no tienen un formato compatible.')
        if (parsed.version !== SHIFT_STATE_VERSION) target.setItem(key, JSON.stringify(upgraded))
        return upgraded
      } catch (error) {
        throw new Error(error.message || 'Los datos locales del turno no tienen un formato compatible.')
      }
    },
    save(state) {
      if (!isValidState(state)) throw new Error('No se puede guardar un estado de turno inválido.')
      target.setItem(key, JSON.stringify(state))
      return state
    },
    reset() {
      target.removeItem(key)
      return createEmptyShiftState()
    },
    exportJson() {
      return JSON.stringify(this.load(), null, 2)
    },
  }
}
